/**
 * App — 主循环封装（收编现网 PixiApp 标准版，增加 tick 优先级 / Timer / actions 接管）
 *
 * create(PIXI, canvas, opts)
 *   opts.designWidth  设计宽度，默认 750（stage 逻辑坐标系）
 *   opts.maxDt        单帧 dt 上限 ms，默认 200（切后台回来防跳变）
 *   opts.background   背景色，默认 0x000000
 * 返回 { PIXI, renderer, stage, stageWidth, stageHeight, timer, actions,
 *        onTick(fn, priority?), offTick(fn), start, stop, dispatchTouch, destroy }
 */

var Timer = require('./Timer.js');
var actionsMod = require('../action/actions.js');

var LOG = '[App]';

function create(PIXI, canvas, opts) {
  opts = opts || {};
  var designWidth = opts.designWidth || 750;
  var maxDt = opts.maxDt || 200;

  var stageWidth = designWidth;
  var stageHeight = Math.round(designWidth * canvas.height / canvas.width);

  var renderer = PIXI.autoDetectRenderer({
    width: stageWidth,
    height: stageHeight,
    backgroundAlpha: opts.backgroundAlpha === undefined ? 1 : opts.backgroundAlpha,
    backgroundColor: opts.background === undefined ? 0x000000 : opts.background,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
    view: canvas
  });

  var stage = new PIXI.Container();
  // stage 级触摸：拖拽 move/up 需要全屏 hitArea
  stage.eventMode = 'static';
  stage.hitArea = new PIXI.Rectangle(0, 0, stageWidth, stageHeight);

  var timer = Timer.create();
  var actions = actionsMod.createManager();

  var tickFns = [];   // { fn, priority }
  var running = false;
  var rafId = null;

  var app = {
    PIXI: PIXI,
    renderer: renderer,
    stage: stage,
    stageWidth: stageWidth,
    stageHeight: stageHeight,
    timer: timer,
    actions: actions,

    /** priority 小者先执行，默认 0 */
    onTick: function (fn, priority) {
      tickFns.push({ fn: fn, priority: priority || 0 });
      tickFns.sort(function (a, b) { return a.priority - b.priority; });
    },

    offTick: function (fn) {
      for (var i = tickFns.length - 1; i >= 0; i--) {
        if (tickFns[i].fn === fn) { tickFns.splice(i, 1); }
      }
    },

    start: function () {
      if (running) { return; }
      running = true;
      var lastTs = Date.now();
      function loop() {
        if (!running) { return; }
        rafId = canvas.requestAnimationFrame(loop);
        var now = Date.now();
        var dt = Math.min(maxDt, now - lastTs);
        lastTs = now;
        var snapshot = tickFns.slice();
        for (var i = 0; i < snapshot.length; i++) { snapshot[i].fn(dt); }
        timer.update(dt);
        actions.update(dt);
        renderer.render(stage);
      }
      loop();
      console.log(LOG, 'loop started', { w: stageWidth, h: stageHeight });
    },

    stop: function () {
      running = false;
      if (rafId) {
        canvas.cancelAnimationFrame(rafId);
        rafId = null;
      }
    },

    dispatchTouch: function (e) {
      if (PIXI && typeof PIXI.dispatchEvent === 'function') {
        PIXI.dispatchEvent(e);
      }
    },

    destroy: function () {
      this.stop();
      tickFns = [];
      timer.clear();
      actions.clear();
      try {
        stage.destroy({ children: true });
      } catch (e) {
        console.warn(LOG, 'stage destroy', e);
      }
    }
  };

  return app;
}

module.exports = { create: create };
