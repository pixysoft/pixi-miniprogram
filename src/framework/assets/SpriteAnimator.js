/**
 * SpriteAnimator — 帧动画播放器（借鉴 Cocos AnimationCache + Pixi AnimatedSprite，dt 驱动）
 * 收编现网各游戏手写的「assets.frames() + 手动切帧」逻辑
 *
 * create(sprite, assets?) → {
 *   add(name, framesOrPrefix)   注册动画（Texture[] 或 assets 帧名前缀，懒解析并缓存）
 *   play(name, { fps=8, loop=true, onEnd })
 *   stop()                      停在当前帧
 *   playing() / current()
 *   update(dt)                  主循环驱动（createGame.animator() 自动接入）
 * }
 * sprite 销毁后 update 自动失效（destroyed 透传，供 createGame 剔除）
 */

var LOG = '[SpriteAnimator]';

function create(sprite, assets) {
  var clips = {};     // name → { src, frames|null }
  var cur = null;     // { name, frames, fps, loop, onEnd, elapsed, idx }

  function resolve(name) {
    var clip = clips[name];
    if (!clip) {
      // 未注册时按 assets 前缀懒注册
      if (assets) {
        clip = clips[name] = { src: name, frames: null };
      } else {
        console.warn(LOG, 'unknown clip', name);
        return null;
      }
    }
    if (!clip.frames) {
      if (typeof clip.src === 'string') {
        if (!assets) { return null; }
        var fs = assets.frames(clip.src);
        if (!fs.length) { return null; }
        clip.frames = fs;
      } else {
        clip.frames = clip.src;
      }
    }
    return clip.frames;
  }

  var animator = {
    add: function (name, framesOrPrefix) {
      clips[name] = { src: framesOrPrefix, frames: null };
      return animator;
    },

    play: function (name, opts) {
      opts = opts || {};
      var frames = resolve(name);
      if (!frames || !frames.length) {
        console.warn(LOG, 'clip has no frames', name);
        return animator;
      }
      cur = {
        name: name,
        frames: frames,
        fps: opts.fps || 8,
        loop: opts.loop === undefined ? true : !!opts.loop,
        onEnd: opts.onEnd || null,
        elapsed: 0,
        idx: 0
      };
      sprite.texture = frames[0];
      return animator;
    },

    stop: function () { cur = null; },

    playing: function () { return !!cur; },

    current: function () { return cur ? cur.name : null; },

    update: function (dt) {
      if (!cur || sprite.destroyed) { return; }
      cur.elapsed += dt;
      var frameMs = 1000 / cur.fps;
      while (cur.elapsed >= frameMs) {
        cur.elapsed -= frameMs;
        cur.idx++;
        if (cur.idx >= cur.frames.length) {
          if (cur.loop) {
            cur.idx = 0;
          } else {
            cur.idx = cur.frames.length - 1;
            sprite.texture = cur.frames[cur.idx];
            var onEnd = cur.onEnd;
            cur = null;
            if (onEnd) { onEnd(); }
            return;
          }
        }
        sprite.texture = cur.frames[cur.idx];
      }
    }
  };

  // sprite 销毁 → animator 视为已销毁（createGame ticking 自动剔除）
  Object.defineProperty(animator, 'destroyed', {
    get: function () { return !!sprite.destroyed; }
  });

  return animator;
}

module.exports = { create: create };
