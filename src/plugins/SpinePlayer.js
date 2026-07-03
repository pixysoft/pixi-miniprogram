/**
 * SpinePlayer — Spine 3.8 骨骼动画胶水层（独立分包产物，不进默认主包）
 * 依赖游戏侧已挂载 pixi-spine（适配器 example 的 pixi-spine 产物），本插件只封装
 * 加载 / 播放 / 混合 / 销毁 dispose 的样板代码。
 *
 * 构建：npm run build 同时产出 dist/plugins/spine.player.js；
 * 小程序侧将其放独立分包，require 后传入 PIXI 使用。
 *
 * create(PIXI) → {
 *   available()                        pixi-spine 是否已挂载
 *   load(key, jsonUrl, cb(err, inst))  Loader 加载骨骼；inst 为 PIXI.spine.Spine
 *   play(inst, name, { loop=true, track=0 })
 *   mix(inst, from, to, duration)     动作混合时长
 *   dispose(inst)                     从父容器摘除并销毁骨骼与贴图引用
 * }
 */

var LOG = '[SpinePlayer]';

function create(PIXI) {
  var loaded = {};   // key → spineData

  function available() {
    return !!(PIXI && PIXI.spine && PIXI.spine.Spine);
  }

  return {
    available: available,

    load: function (key, jsonUrl, cb) {
      if (!available()) {
        console.warn(LOG, 'pixi-spine not attached');
        cb(new Error('pixi-spine not attached'), null);
        return;
      }
      if (loaded[key]) {
        cb(null, new PIXI.spine.Spine(loaded[key]));
        return;
      }
      var loader = new PIXI.Loader();
      loader.add(key, jsonUrl);
      loader.load(function (l, resources) {
        var res = resources[key];
        if (!res || !res.spineData) {
          console.warn(LOG, 'spine load failed', key, jsonUrl);
          cb(new Error('spine load failed: ' + key), null);
          return;
        }
        loaded[key] = res.spineData;
        cb(null, new PIXI.spine.Spine(res.spineData));
      });
      loader.onError.add(function () {
        console.warn(LOG, 'loader error', key);
      });
    },

    play: function (inst, name, opts) {
      opts = opts || {};
      if (!inst || !inst.state) { return; }
      inst.state.setAnimation(opts.track || 0, name, opts.loop === undefined ? true : !!opts.loop);
    },

    mix: function (inst, from, to, duration) {
      if (!inst || !inst.stateData) { return; }
      inst.stateData.setMix(from, to, duration);
    },

    dispose: function (inst) {
      if (!inst) { return; }
      try {
        if (inst.parent) { inst.parent.removeChild(inst); }
        inst.destroy({ children: true });
      } catch (e) {
        console.warn(LOG, 'dispose', e);
      }
    },

    /** 释放缓存的骨骼数据（切场景大清理时用） */
    clearCache: function () { loaded = {}; }
  };
}

module.exports = { create: create };
