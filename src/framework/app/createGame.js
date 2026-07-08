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
 *   game.particle(cfg) / game.fxLayer(opts) — 演出层（自动接入主循环）
 *   game.filters — Filter 预设（night/hurt/glow/custom）
 *   ui.cooldownButton(opts) / ui.tabBar(opts) / ui.pageView(opts)
 *
 * 3.1 追加：
 *   game.tf — TextureFactory 游戏级程序化纹理（与 tc 共享缓存）
 *   game.joystick(surface, opts) — 虚拟摇杆
 *   game.numFont(opts) — BMFont 艺术数字（Text 回退链）
 *   game.perf(opts) — 性能探针
 *   scenes.pushLayer/popLayer — 弹层栈（冻结下层 update；layerRoot 位于 toast 之下）
 */

var App = require('./App.js');
var TextureCache = require('../assets/TextureCache.js');
var TextureFactory = require('../assets/TextureFactory.js');
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
var Particle = require('../fx/Particle.js');
var filtersMod = require('../fx/filters.js');
var FxLayer = require('../fx/FxLayer.js');
var CooldownButton = require('../ui/CooldownButton.js');
var TabBar = require('../ui/TabBar.js');
var PageView = require('../ui/PageView.js');
var NumFont = require('../ui/NumFont.js');
var Joystick = require('../input/Joystick.js');
var Perf = require('../util/Perf.js');

function createGame(PIXI, canvas, opts) {
  opts = opts || {};
  var app = App.create(PIXI, canvas, opts);
  var tc = TextureCache.create(PIXI, app.renderer);
  var tf = TextureFactory.create(PIXI, app.renderer, tc);
  var assets = AssetManager.create(PIXI);
  var theme = Theme.create();
  if (opts.theme) { theme.set(opts.theme); }

  var uiCtx = { PIXI: PIXI, tc: tc, tf: tf, assets: assets, theme: theme };
  var w = widgetsMod.create(uiCtx);

  var sceneRoot = new PIXI.Container();
  app.stage.addChild(sceneRoot);
  var layerRoot = new PIXI.Container();   // 弹层根：场景之上、toast 之下
  app.stage.addChild(layerRoot);
  var scenes = SceneManager.create(sceneRoot, layerRoot);
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
  ui.cooldownButton = function (o) { return CooldownButton.create(uiCtx, w, o); };
  ui.tabBar = function (o) { return TabBar.create(uiCtx, w, o); };
  ui.pageView = function (o) { return track(PageView.create(uiCtx, o)); };

  return {
    app: app,
    PIXI: PIXI,
    stage: app.stage,
    W: app.stageWidth,
    H: app.stageHeight,
    tc: tc,
    tf: tf,
    assets: assets,
    theme: theme,
    scenes: scenes,
    bus: bus,
    toast: toast,
    ui: ui,
    audio: audio,

    /** 帧动画播放器（sprite 销毁后自动停更） */
    animator: function (sprite) { return track(SpriteAnimator.create(sprite, assets)); },

    /** 粒子发射器（container 销毁后自动停更） */
    particle: function (cfg) { return track(Particle.create(PIXI, cfg)); },

    /** 战斗反馈层：飘字/碎块/圆环 */
    fxLayer: function (o) { return track(FxLayer.create(uiCtx, o)); },

    /** 虚拟摇杆（surface = 覆盖可玩区的交互层；container 需调用方挂树） */
    joystick: function (surface, o) { return Joystick.create(uiCtx, surface, o); },

    /** BMFont 艺术数字（未就绪回退 PIXI.Text） */
    numFont: function (o) { return NumFont.create(uiCtx, o); },

    /** 性能探针 */
    perf: function (o) { return Perf.create(o); },

    filters: filtersMod.create(PIXI),

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
