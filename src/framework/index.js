/**
 * framework — Pixi 小程序游戏框架 3.1 聚合导出
 * 所有模块均为工厂式（显式传入 PIXI/ctx），不污染全局
 */

var App = require('./app/App.js');
var Timer = require('./app/Timer.js');
var PageShell = require('./app/PageShell.js');
var createGameMod = require('./app/createGame.js');
var SceneManager = require('./scene/SceneManager.js');
var EventBus = require('./scene/EventBus.js');
var transitions = require('./scene/transitions.js');
var AssetManager = require('./assets/AssetManager.js');
var TextureCache = require('./assets/TextureCache.js');
var TextureFactory = require('./assets/TextureFactory.js');
var SpriteAnimator = require('./assets/SpriteAnimator.js');
var AudioManager = require('./audio/AudioManager.js');
var Camera = require('./world/Camera.js');
var Camera2D = require('./world/Camera2D.js');
var ChunkWorld = require('./world/ChunkWorld.js');
var ChunkRenderer = require('./world/ChunkRenderer.js');
var EntityManager = require('./world/EntityManager.js');
var TileMap = require('./world/TileMap.js');
var PathFinder = require('./world/PathFinder.js');
var PinchPan = require('./input/PinchPan.js');
var Joystick = require('./input/Joystick.js');
var Layout = require('./ui/Layout.js');
var Particle = require('./fx/Particle.js');
var filters = require('./fx/filters.js');
var FxLayer = require('./fx/FxLayer.js');
var CooldownButton = require('./ui/CooldownButton.js');
var Theme = require('./ui/Theme.js');
var Widget = require('./ui/Widget.js');
var widgets = require('./ui/widgets.js');
var ScrollView = require('./ui/ScrollView.js');
var List = require('./ui/List.js');
var TabBar = require('./ui/TabBar.js');
var PageView = require('./ui/PageView.js');
var Slider = require('./ui/Slider.js');
var Modal = require('./ui/Modal.js');
var Toast = require('./ui/Toast.js');
var NumFont = require('./ui/NumFont.js');
var legacy = require('./ui/legacy.js');
var actions = require('./action/actions.js');
var easing = require('./action/easing.js');
var Store = require('./data/Store.js');
var Gateway = require('./data/Gateway.js');
var Rng = require('./data/Rng.js');
var DisplayUtil = require('./util/DisplayUtil.js');
var Perf = require('./util/Perf.js');

module.exports = {
  version: '3.1.0',

  // app
  App: App,
  Timer: Timer,
  PageShell: PageShell,
  createGame: createGameMod.createGame,

  // scene
  SceneManager: SceneManager,
  EventBus: EventBus,
  transitions: transitions,

  // assets
  AssetManager: AssetManager,
  TextureCache: TextureCache,
  TextureFactory: TextureFactory,
  SpriteAnimator: SpriteAnimator,

  // audio
  AudioManager: AudioManager,

  // world
  Camera: Camera,
  Camera2D: Camera2D,
  ChunkWorld: ChunkWorld,
  ChunkRenderer: ChunkRenderer,
  EntityManager: EntityManager,
  TileMap: TileMap,
  PathFinder: PathFinder,

  // input
  PinchPan: PinchPan,
  Joystick: Joystick,

  // fx
  Particle: Particle,
  filters: filters,
  FxLayer: FxLayer,

  // ui
  Theme: Theme,
  Widget: Widget,
  Layout: Layout,
  widgets: widgets,
  ScrollView: ScrollView,
  List: List,
  Slider: Slider,
  CooldownButton: CooldownButton,
  TabBar: TabBar,
  PageView: PageView,
  Modal: Modal,
  Toast: Toast,
  NumFont: NumFont,
  legacy: legacy,

  // action
  actions: actions,
  easing: easing,

  // data
  Store: Store,
  Gateway: Gateway,
  Rng: Rng,

  // util
  DisplayUtil: DisplayUtil,
  Perf: Perf
};
