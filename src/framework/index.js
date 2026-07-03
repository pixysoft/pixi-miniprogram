/**
 * framework — Pixi 小程序游戏框架 2.0 聚合导出
 * 所有模块均为工厂式（显式传入 PIXI/ctx），不污染全局
 */

var App = require('./app/App.js');
var Timer = require('./app/Timer.js');
var createGameMod = require('./app/createGame.js');
var SceneManager = require('./scene/SceneManager.js');
var EventBus = require('./scene/EventBus.js');
var AssetManager = require('./assets/AssetManager.js');
var TextureCache = require('./assets/TextureCache.js');
var Theme = require('./ui/Theme.js');
var Widget = require('./ui/Widget.js');
var widgets = require('./ui/widgets.js');
var ScrollView = require('./ui/ScrollView.js');
var List = require('./ui/List.js');
var Slider = require('./ui/Slider.js');
var Modal = require('./ui/Modal.js');
var Toast = require('./ui/Toast.js');
var legacy = require('./ui/legacy.js');
var actions = require('./action/actions.js');
var easing = require('./action/easing.js');
var Store = require('./data/Store.js');
var Gateway = require('./data/Gateway.js');
var Rng = require('./data/Rng.js');
var DisplayUtil = require('./util/DisplayUtil.js');

module.exports = {
  version: '2.0.0',

  // app
  App: App,
  Timer: Timer,
  createGame: createGameMod.createGame,

  // scene
  SceneManager: SceneManager,
  EventBus: EventBus,

  // assets
  AssetManager: AssetManager,
  TextureCache: TextureCache,

  // ui
  Theme: Theme,
  Widget: Widget,
  widgets: widgets,
  ScrollView: ScrollView,
  List: List,
  Slider: Slider,
  Modal: Modal,
  Toast: Toast,
  legacy: legacy,

  // action
  actions: actions,
  easing: easing,

  // data
  Store: Store,
  Gateway: Gateway,
  Rng: Rng,

  // util
  DisplayUtil: DisplayUtil
};
