/**
 * AudioManager — 音频管理（收编大航海 Audio.js，抽掉游戏私有 URL 逻辑）
 * BGM 单逻辑通道、两个 InnerAudioContext 交替实现交叉淡入；
 * SFX 并发上限 4（防 iOS 爆音）；资源 URL 由游戏注册，框架不管加载来源。
 * wx 环境不可用时静默降级（状态照常流转，便于测试与 mock）。
 *
 * create(opts) → {
 *   register(key, url) / registerAll(map)
 *   playBgm(key, { fade=400 })   同曲目重复调用不打断
 *   stopBgm() / currentBgm()
 *   playSfx(key, { volume })
 *   setVolume(bgm, sfx) / setMuted(m)
 *   update(dt)                   驱动交叉淡入（createGame 自动接入）
 *   destroy()
 * }
 *   opts.createCtx  音频上下文工厂（默认 wx.createInnerAudioContext；可注入 mock）
 *   opts.sfxLimit   SFX 并发上限，默认 4
 */

var LOG = '[AudioManager]';

function defaultFactory() {
  if (typeof wx !== 'undefined' && wx && typeof wx.createInnerAudioContext === 'function') {
    return function () { return wx.createInnerAudioContext(); };
  }
  return null;
}

function create(opts) {
  opts = opts || {};
  var createCtx = opts.createCtx === undefined ? defaultFactory() : opts.createCtx;
  var sfxLimit = opts.sfxLimit || 4;

  var urls = {};          // key → url
  var muted = false;
  var bgmVolume = opts.bgmVolume === undefined ? 0.6 : opts.bgmVolume;
  var sfxVolume = opts.sfxVolume === undefined ? 1 : opts.sfxVolume;

  var bgmKey = null;      // 当前逻辑曲目
  var bgmCtx = null;      // 主通道
  var fading = null;      // { out: ctx|null, dur, t } — in 通道即 bgmCtx
  var sfxPool = [];       // 活跃 SFX ctx

  function makeCtx(loop, volume, src) {
    if (!createCtx) { return null; }
    try {
      var c = createCtx();
      c.loop = !!loop;
      c.volume = volume;
      c.src = src;
      if (c.onError) {
        c.onError(function (e) {
          console.warn(LOG, 'audio error（已静默）', e && e.errMsg);
        });
      }
      c.play();
      return c;
    } catch (e) {
      console.warn(LOG, 'audio ctx failed', e);
      return null;
    }
  }

  function kill(ctx) {
    if (!ctx) { return; }
    try { ctx.stop(); } catch (e) { /* noop */ }
    try { ctx.destroy(); } catch (e2) { /* noop */ }
  }

  return {
    register: function (key, url) { urls[key] = url; },

    registerAll: function (map) {
      for (var k in map) { urls[k] = map[k]; }
    },

    playBgm: function (key, o) {
      o = o || {};
      if (bgmKey === key) { return; }        // 同曲目不打断
      bgmKey = key;
      if (muted || !urls[key]) {
        if (!urls[key]) { console.warn(LOG, 'unknown bgm', key); }
        return;
      }
      var fade = o.fade === undefined ? 400 : o.fade;
      var old = bgmCtx;
      bgmCtx = makeCtx(true, fade > 0 ? 0 : bgmVolume, urls[key]);
      if (fade > 0 && (bgmCtx || old)) {
        if (fading && fading.out) { kill(fading.out); }
        fading = { out: old, dur: fade, t: 0 };
      } else {
        kill(old);
        fading = null;
      }
    },

    stopBgm: function () {
      bgmKey = null;
      if (fading && fading.out) { kill(fading.out); }
      fading = null;
      kill(bgmCtx);
      bgmCtx = null;
    },

    currentBgm: function () { return bgmKey; },

    playSfx: function (key, o) {
      o = o || {};
      if (muted || !urls[key]) { return; }
      // 并发上限：淘汰最早的
      for (var i = sfxPool.length - 1; i >= 0; i--) {
        if (sfxPool[i].ended) { sfxPool.splice(i, 1); }
      }
      while (sfxPool.length >= sfxLimit) { kill(sfxPool.shift()); }
      var c = makeCtx(false, o.volume === undefined ? sfxVolume : o.volume, urls[key]);
      if (c) {
        if (c.onEnded) { c.onEnded(function () { c.ended = true; }); }
        sfxPool.push(c);
      }
    },

    setVolume: function (bgm, sfx) {
      if (bgm !== undefined) {
        bgmVolume = bgm;
        if (bgmCtx && !fading) { bgmCtx.volume = bgmVolume; }
      }
      if (sfx !== undefined) { sfxVolume = sfx; }
    },

    setMuted: function (m) {
      muted = !!m;
      if (muted) {
        var key = bgmKey;
        this.stopBgm();
        bgmKey = key;   // 记住曲目，解除静音后由游戏重新 playBgm
      }
    },

    isMuted: function () { return muted; },

    /** 交叉淡入推进：out 通道降到 0 销毁，in 通道升到 bgmVolume */
    update: function (dt) {
      if (!fading) { return; }
      fading.t += dt;
      var r = Math.min(1, fading.t / fading.dur);
      if (bgmCtx) { bgmCtx.volume = bgmVolume * r; }
      if (fading.out) { fading.out.volume = Math.max(0, bgmVolume * (1 - r)); }
      if (r >= 1) {
        if (fading.out) { kill(fading.out); }
        fading = null;
      }
    },

    destroy: function () {
      this.stopBgm();
      bgmKey = null;
      for (var i = 0; i < sfxPool.length; i++) { kill(sfxPool[i]); }
      sfxPool = [];
    }
  };
}

module.exports = { create: create };
