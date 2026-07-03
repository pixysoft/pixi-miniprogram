/**
 * createGame — 一站式装配（替代各游戏 Game.js 里重复的初始化样板）
 *
 * createGame(PIXI, canvas, opts)
 *   opts: { designWidth, maxDt, background, theme(主题JSON), sceneRoot? }
 * 返回 game = {
 *   app, PIXI, stage, W, H, tc, assets, theme, scenes, bus, toast, ui,
 *   dispatchTouch(e), destroy()
 * }
 *
 * ui 在 widgets 基础上追加容器组件工厂（自动接入主循环 update）：
 *   ui.scrollView(opts) / ui.list(opts) / ui.slider(opts) / ui.modal(opts)
 *   ui.legacy() — 旧 widgets 签名兼容层
 *
 * 3.0 追加：
 *   game.audio — AudioManager（update 自动接入主循环）
 *   game.animator(sprite) — SpriteAnimator（sprite 销毁自动剔除）
 */

var App = require('./App.js');
var TextureCache = require('../assets/TextureCache.js');
var AssetManager = require('../assets/AssetManager.js');
var Theme = require('../ui/Theme.js');
var widgetsMod = require('../ui/widgets.js');
var ScrollView = require('../ui/ScrollView.js');
var List = require('../ui/List.js');
var Slider = require('../ui/Slider.js');
var Modal = require('../ui/Modal.js');
var Toast = require('../ui/Toast.js');
var legacyMod = require('../ui/legacy.js');
var SceneManager = require('../scene/SceneManager.js');
var EventBus = require('../scene/EventBus.js');
var AudioManager = require('../audio/AudioManager.js');
var SpriteAnimator = require('../assets/SpriteAnimator.js');

function createGame(PIXI, canvas, opts) {
  opts = opts || {};
  var app = App.create(PIXI, canvas, opts);
  var tc = TextureCache.create(PIXI, app.renderer);
  var assets = AssetManager.create(PIXI);
  var theme = Theme.create();
  if (opts.theme) { theme.set(opts.theme); }

  var uiCtx = { PIXI: PIXI, tc: tc, assets: assets, theme: theme };
  var w = widgetsMod.create(uiCtx);

  var sceneRoot = new PIXI.Container();
  app.stage.addChild(sceneRoot);
  var scenes = SceneManager.create(sceneRoot);
  var bus = EventBus.create();

  var toast = Toast.create(uiCtx, w, { stageW: app.stageWidth });
  app.stage.addChild(toast.container);

  var audio = AudioManager.create(opts.audio);

  // 需要每帧驱动的 UI 实例（scrollView/list），销毁后自动剔除
  var ticking = [];
  function track(node) {
    ticking.push(node);
    return node;
  }

  app.onTick(function (dt) {
    scenes.update(dt);
    toast.update(dt);
    audio.update(dt);
    for (var i = ticking.length - 1; i >= 0; i--) {
      var node = ticking[i];
      if (node.destroyed) {
        ticking.splice(i, 1);
      } else if (node.update) {
        node.update(dt);
      }
    }
  }, 0);

  // ui = widgets + 容器组件工厂
  var ui = {};
  for (var k in w) { ui[k] = w[k]; }
  ui.scrollView = function (o) { return track(ScrollView.create(uiCtx, o)); };
  ui.list = function (o) { return track(List.create(uiCtx, o)); };
  ui.slider = function (o) { return Slider.create(uiCtx, w, o); };
  ui.modal = function (o) {
    o = o || {};
    if (o.stageW === undefined) { o.stageW = app.stageWidth; }
    if (o.stageH === undefined) { o.stageH = app.stageHeight; }
    return Modal.create(uiCtx, w, o);
  };
  ui.legacy = function () { return legacyMod.create(uiCtx); };

  return {
    app: app,
    PIXI: PIXI,
    stage: app.stage,
    W: app.stageWidth,
    H: app.stageHeight,
    tc: tc,
    assets: assets,
    theme: theme,
    scenes: scenes,
    bus: bus,
    toast: toast,
    ui: ui,
    audio: audio,

    /** 帧动画播放器（sprite 销毁后自动停更） */
    animator: function (sprite) { return track(SpriteAnimator.create(sprite, assets)); },

    dispatchTouch: function (e) { app.dispatchTouch(e); },

    destroy: function () {
      app.destroy();
      tc.clear();
      assets.clear();
      bus.clear();
      audio.destroy();
      ticking = [];
    }
  };
}

module.exports = { createGame: createGame };
