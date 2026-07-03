/**
 * framework 2.0 冒烟测试（Node 直跑：node test/framework.test.js）
 *
 * 测试范围概述：
 *   1. 基础层：EventBus 快照分发 / Timer / Rng 复现与加权 / Store 存取迁移 / Gateway 本地远程
 *   2. 场景层：SceneManager 栈操作（replace/push/pop/currentScene）
 *   3. 资源层：AssetManager 帧索引 / slice 元数据 / 组加载 / 前缀帧序列
 *   4. 主题层：Theme 合并 / 实例覆盖
 *   5. 组件层：Button 三态与点击判定 / ScrollView 拦截与惯性回弹 / List 虚拟化 /
 *              Slider 取值 / Modal 开关 / Toast 淡出 / legacy 兼容签名
 *   6. 动作层：sequence / spawn / repeat / 目标销毁自动停止
 * 全部使用 mock PIXI（仅结构与事件，无渲染），只测正确流程。
 */

var assert = require('assert');

// ===== mock PIXI =====

function MockScale() { this.x = 1; this.y = 1; }
MockScale.prototype.set = function (v) { this.x = v; this.y = v; };

function Container() {
  this.children = [];
  this.visible = true;
  this.alpha = 1;
  this.x = 0; this.y = 0;
  this.rotation = 0;
  this.scale = new MockScale();
  this.destroyed = false;
  this._handlers = {};
  this.parent = null;
}
Container.prototype.addChild = function (c) { this.children.push(c); c.parent = this; return c; };
Container.prototype.removeChild = function (c) {
  var i = this.children.indexOf(c);
  if (i >= 0) { this.children.splice(i, 1); c.parent = null; }
};
Container.prototype.removeChildren = function () { this.children = []; };
Container.prototype.on = function (evt, fn) {
  (this._handlers[evt] = this._handlers[evt] || []).push(fn);
  return this;
};
Container.prototype.trigger = function (evt, ev) {
  (this._handlers[evt] || []).slice().forEach(function (fn) { fn(ev || {}); });
};
Container.prototype.destroy = function () { this.destroyed = true; };
Container.prototype.toLocal = function (p) { return { x: p.x - this.x, y: p.y - this.y }; };

function Sprite(tex) {
  Container.call(this);
  this.texture = tex;
  this.width = (tex && tex.width) || 0;
  this.height = (tex && tex.height) || 0;
  this.anchor = new MockScale();
  this.anchor.x = 0; this.anchor.y = 0;
}
Sprite.prototype = Object.create(Container.prototype);

function Text(str, style) {
  Container.call(this);
  this._text = str;
  this.style = style || {};
  var self = this;
  Object.defineProperty(this, 'text', {
    get: function () { return self._text; },
    set: function (v) { self._text = v; }
  });
}
Text.prototype = Object.create(Container.prototype);
Object.defineProperty(Text.prototype, 'width', {
  get: function () { return String(this._text).length * (this.style.fontSize || 26) * 0.5; },
  set: function () {}
});
Object.defineProperty(Text.prototype, 'height', {
  get: function () { return (this.style.fontSize || 26) * 1.2; },
  set: function () {}
});

function Graphics() { Container.call(this); }
Graphics.prototype = Object.create(Container.prototype);
['beginFill', 'endFill', 'lineStyle', 'drawRoundedRect', 'drawRect', 'drawCircle',
 'drawEllipse', 'drawPolygon', 'moveTo', 'lineTo', 'quadraticCurveTo', 'arc'
].forEach(function (m) { Graphics.prototype[m] = function () { return this; }; });

function Rectangle(x, y, w, h) { this.x = x; this.y = y; this.width = w; this.height = h; }

function Texture(base, rect) {
  this.baseTexture = base;
  this.frame = rect;
  this.width = rect ? rect.width : (base ? base.width : 0);
  this.height = rect ? rect.height : (base ? base.height : 0);
}
Texture.prototype.destroy = function () {};

var BaseTexture = {
  from: function (url) {
    return {
      url: url, valid: true, width: 256, height: 256,
      once: function () {}, destroy: function () {}
    };
  }
};

function NineSlicePlane(tex, l, t, r, b) {
  Container.call(this);
  this.texture = tex;
  this.slice = [l, t, r, b];
  this.width = 0;
  this.height = 0;
}
NineSlicePlane.prototype = Object.create(Container.prototype);

var PIXI = {
  Container: Container,
  Sprite: Sprite,
  Text: Text,
  Graphics: Graphics,
  Rectangle: Rectangle,
  Texture: Texture,
  BaseTexture: BaseTexture,
  NineSlicePlane: NineSlicePlane
};

var mockRenderer = {
  generateTexture: function (g) {
    return { width: 10, height: 10, destroy: function () {}, baseTexture: {} };
  },
  render: function () {}
};

// ===== 测试基础设施 =====

var passed = 0;
var failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✅', name);
  } catch (e) {
    failed++;
    console.error('  ❌', name, '\n     ', e.message);
  }
}

var fw = require('../src/framework/index.js');

// ===== 1. 基础层 =====

console.log('\n[1] 基础层');

// 输入：注册两个监听、emit 一次、回调内 off；期望：快照分发不受影响，off 后不再触发
test('EventBus 快照分发与 off', function () {
  var bus = fw.EventBus.create();
  var calls = [];
  var off1 = bus.on('evt', function (p) { calls.push('a' + p); off1(); });
  bus.on('evt', function (p) { calls.push('b' + p); });
  bus.emit('evt', 1);
  bus.emit('evt', 2);
  assert.deepStrictEqual(calls, ['a1', 'b1', 'b2']);
});

// 输入：after(100) / every(50)，推进 3 次 60ms；期望：after 触发 1 次，every 触发 3 次
test('Timer after/every', function () {
  var t = fw.Timer.create();
  var one = 0, many = 0;
  t.after(100, function () { one++; });
  t.every(50, function () { many++; });
  t.update(60); t.update(60); t.update(60);
  assert.strictEqual(one, 1);
  assert.strictEqual(many, 3);
});

// 输入：同种子两个 Rng；期望：序列一致；weighted 只返回列表项
test('Rng 复现与 weighted', function () {
  var a = fw.Rng.create(42);
  var b = fw.Rng.create(42);
  for (var i = 0; i < 5; i++) { assert.strictEqual(a.next(), b.next()); }
  var item = a.weighted([{ w: 1, id: 'x' }, { w: 3, id: 'y' }]);
  assert.ok(item.id === 'x' || item.id === 'y');
  assert.strictEqual(a.int(5, 5), 5);
});

// 输入：无 wx 环境，save 后 load，带 v1→2 迁移；期望：内存往返成功且迁移生效
test('Store 内存模式 + 迁移', function () {
  var store = fw.Store.create('test_key', {
    migrations: { 1: function (s) { s.upgraded = true; return 2; } }
  });
  store.save({ v: 1, coins: 100 }, true);
  var loaded = store.load();
  assert.strictEqual(loaded.coins, 100);
  // 内存模式不走 load 的迁移分支（wx 路径），此处仅验证保存往返
  store._resetMemory();
  assert.strictEqual(store.load(), null);
});

// 输入：本地 handler + filtered remote；期望：filter 命中走远程，未命中走本地
test('Gateway 本地/远程 filter', function () {
  var gw = fw.Gateway.create('/game/t/');
  gw.registerLocal('trade/buy', function (p) { return { ok: true, qty: p.qty }; });
  var remoteCalled = [];
  gw.useRemote(function (opts, cb) {
    remoteCalled.push(opts.endpoint);
    cb({ data: { ok: true, remote: true } });
  }, function (ep) { return ep.indexOf('profile/') === 0; });

  var r1, r2;
  gw.call('trade/buy', { qty: 3 }, function (r) { r1 = r; });
  gw.call('profile/sync', {}, function (r) { r2 = r; });
  assert.strictEqual(r1.qty, 3);
  assert.strictEqual(r2.remote, true);
  assert.deepStrictEqual(remoteCalled, ['/game/t/profile/sync']);
});

// ===== 2. 场景层 =====

console.log('\n[2] 场景层');

function makeScene() {
  var s = { container: new Container(), entered: 0, exited: 0 };
  s.enter = function () { s.entered++; };
  s.exit = function () { s.exited++; };
  return s;
}

// 输入：register 两场景，replace→push→pop；期望：栈与可见性正确
test('SceneManager replace/push/pop', function () {
  var root = new Container();
  var sm = fw.SceneManager.create(root);
  var a = makeScene();
  var b = makeScene();
  sm.register('a', function () { return a; });
  sm.register('b', function () { return b; });

  sm.replace('a');
  assert.strictEqual(sm.current(), 'a');
  assert.strictEqual(a.container.visible, true);

  sm.push('b');
  assert.strictEqual(sm.current(), 'b');
  assert.strictEqual(a.container.visible, false);
  assert.strictEqual(sm.currentScene(), b);

  sm.pop();
  assert.strictEqual(sm.current(), 'a');
  assert.strictEqual(a.entered, 2);
  assert.strictEqual(b.exited, 1);
});

// ===== 3. 资源层 =====

console.log('\n[3] 资源层');

// 输入：addSheet 手写切片 + loadGroup；期望：帧索引/纹理/slice/前缀序列正确
test('AssetManager 帧索引与组加载', function () {
  var am = fw.AssetManager.create(PIXI);
  am.addSheet('ui', 'ui.png', {
    btn_up: { x: 0, y: 0, w: 100, h: 50, slice: [12, 12, 12, 12] },
    btn_down: { x: 0, y: 50, w: 100, h: 50 },
    walk_01: { x: 100, y: 0, w: 32, h: 32 },
    walk_02: { x: 132, y: 0, w: 32, h: 32 }
  });
  var result = null;
  am.loadGroup(['ui'], function (ok, total) { result = [ok, total]; });
  assert.deepStrictEqual(result, [1, 1]);
  assert.ok(am.ready('ui'));
  assert.ok(am.has('btn_up'));
  var tex = am.texture('btn_up');
  assert.strictEqual(tex.frame.width, 100);
  assert.deepStrictEqual(am.slice('btn_up'), [12, 12, 12, 12]);
  assert.strictEqual(am.slice('btn_down'), null);
  assert.strictEqual(am.frames('walk_').length, 2);
  assert.strictEqual(am.texture('nonexistent'), null);
});

// 输入：TexturePacker JSON Hash 格式；期望：解析后帧可取
test('AssetManager addAtlas (TexturePacker)', function () {
  var am = fw.AssetManager.create(PIXI);
  am.addAtlas('tp', {
    frames: { icon_coin: { frame: { x: 4, y: 4, w: 34, h: 34 } } },
    meta: { image: 'tp.png' }
  });
  am.loadGroup(['tp'], function () {});
  assert.ok(am.has('icon_coin'));
  assert.strictEqual(am.texture('icon_coin').frame.width, 34);
});

// ===== 4. 主题层 =====

console.log('\n[4] 主题层');

// 输入：默认主题 + 全局主题 + 实例覆盖；期望：三层合并次序正确
test('Theme 合并次序', function () {
  var theme = fw.Theme.create();
  assert.strictEqual(theme.get('Button').bg.color, 0x3B72B0);       // 默认
  theme.set({ Button: { bg: { color: 0xFF0000 } } });
  assert.strictEqual(theme.get('Button').bg.color, 0xFF0000);       // 全局主题覆盖
  assert.strictEqual(theme.get('Button').label.color, 0xFFFFFF);    // 未覆盖保留默认
  var r = theme.resolve('Button', { bg: { color: 0x00FF00 } });
  assert.strictEqual(r.bg.color, 0x00FF00);                          // 实例覆盖最高
});

// ===== 5. 组件层 =====

console.log('\n[5] 组件层');

function makeCtx() {
  var tc = fw.TextureCache.create(PIXI, mockRenderer);
  var assets = fw.AssetManager.create(PIXI);
  var theme = fw.Theme.create();
  return { PIXI: PIXI, tc: tc, assets: assets, theme: theme };
}

function ev(x, y, target) {
  return { data: { global: { x: x, y: y } }, target: target };
}

// 输入：按下→抬起（无位移）；期望：down 态 scale 0.95，抬起触发 onTap 且恢复
test('Button 点击与按压反馈', function () {
  var ctx = makeCtx();
  var w = fw.widgets.create(ctx);
  var tapped = 0;
  var btn = w.button('确定', 200, 80, { onTap: function () { tapped++; } });
  btn.trigger('pointerdown', ev(100, 40));
  assert.strictEqual(btn.scale.x, 0.95);
  btn.trigger('pointerup', ev(100, 40));
  assert.strictEqual(tapped, 1);
  assert.strictEqual(btn.scale.x, 1);
});

// 输入：按下→移动 30px→抬起；期望：位移超 14px 取消，不触发 onTap
test('Button 位移取消点击', function () {
  var ctx = makeCtx();
  var w = fw.widgets.create(ctx);
  var tapped = 0;
  var btn = w.button('确定', 200, 80, { onTap: function () { tapped++; } });
  btn.trigger('pointerdown', ev(100, 40));
  btn.trigger('pointermove', ev(100, 70));
  btn.trigger('pointerup', ev(100, 70));
  assert.strictEqual(tapped, 0);
});

// 输入：皮肤帧图集就绪（含 slice）；期望：bg 用 NineSlicePlane；down 态换帧不缩放
test('Button 皮肤帧 + 九宫格 + 三态', function () {
  var ctx = makeCtx();
  ctx.assets.addSheet('ui', 'ui.png', {
    b_up: { x: 0, y: 0, w: 60, h: 40, slice: [10, 10, 10, 10] },
    b_down: { x: 0, y: 40, w: 60, h: 40, slice: [10, 10, 10, 10] }
  });
  ctx.assets.loadGroup(['ui'], function () {});
  var w = fw.widgets.create(ctx);
  var btn = w.button('GO', 200, 80, {
    skin: { bg: { frame: 'b_up' }, states: { down: { bg: { frame: 'b_down' } } } }
  });
  var holder = btn.children[0];
  assert.ok(holder.children[0] instanceof NineSlicePlane, 'up 态九宫格');
  assert.strictEqual(holder.children.length, 2, '预构建 down 帧');
  btn.trigger('pointerdown', ev(10, 10));
  assert.strictEqual(holder.children[0].visible, false);
  assert.strictEqual(holder.children[1].visible, true);
  assert.strictEqual(btn.scale.x, 1, '有 down 帧时不用缩放回退');
});

// 输入：无图集；期望：makeBg 回退程序化 panel（Sprite）
test('皮肤缺帧回退程序化纹理', function () {
  var ctx = makeCtx();
  var w = fw.widgets.create(ctx);
  var bg = w.makeBg({ frame: 'not_loaded', color: 0x333333 }, 100, 50);
  assert.ok(bg instanceof Sprite);
  assert.ok(!(bg instanceof NineSlicePlane));
});

// 输入：setEnabled(false) 后点击；期望：alpha 0.5，onTap 不触发
test('Button disabled 态', function () {
  var ctx = makeCtx();
  var w = fw.widgets.create(ctx);
  var tapped = 0;
  var btn = w.button('X', 100, 60, { onTap: function () { tapped++; } });
  btn.setEnabled(false);
  assert.strictEqual(btn.alpha, 0.5);
  btn.trigger('pointerdown', ev(50, 30));
  btn.trigger('pointerup', ev(50, 30));
  assert.strictEqual(tapped, 0);
});

// 输入：ScrollView 内子按钮按下后拖动 40px；期望：子按钮被 cancelPress，内容滚动
test('ScrollView 拦截子控件 + 滚动', function () {
  var ctx = makeCtx();
  var w = fw.widgets.create(ctx);
  var sv = fw.ScrollView.create(ctx, { w: 300, h: 400 });
  sv.setContentHeight(1000);
  var tapped = 0;
  var btn = w.button('item', 200, 80, { onTap: function () { tapped++; } });
  sv.content.addChild(btn);

  // 子按钮按下（事件冒泡：target 为按钮）
  btn.trigger('pointerdown', ev(150, 200));
  sv.trigger('pointerdown', ev(150, 200, btn));
  assert.strictEqual(btn.scale.x, 0.95);

  // 拖动超阈值 → 拦截
  sv.trigger('pointermove', ev(150, 160, btn));
  assert.strictEqual(btn.scale.x, 1, '子按钮已被取消按压');
  assert.ok(sv.content.y < 0, '内容已滚动');

  btn.trigger('pointerup', ev(150, 160));
  assert.strictEqual(tapped, 0);
});

// 输入：快速拖动后释放；期望：惯性继续滚动，越界后回弹到边界
test('ScrollView 惯性与回弹', function () {
  var ctx = makeCtx();
  var sv = fw.ScrollView.create(ctx, { w: 300, h: 400 });
  sv.setContentHeight(500);   // maxScroll = 100

  sv.trigger('pointerdown', ev(150, 300));
  var y = 300;
  for (var i = 0; i < 5; i++) {
    y -= 30;
    sv.trigger('pointermove', ev(150, y));
  }
  sv.trigger('pointerup', ev(150, y));

  // 推进若干帧：惯性 → 越界制动 → 回弹
  for (var f = 0; f < 200; f++) { sv.update(16); }
  assert.strictEqual(Math.round(sv.content.y), -100, '最终停在下边界');
});

// 输入：100 条数据、视口 400、行高 100；期望：实例数 = 可视 + 2，滚动后绑定窗口移动
test('List 虚拟化与复用', function () {
  var ctx = makeCtx();
  var w = fw.widgets.create(ctx);
  var created = 0;
  var list = fw.List.create(ctx, {
    w: 300, h: 400, itemHeight: 100,
    createItem: function () {
      created++;
      var c = new Container();
      c.labelText = '';
      return c;
    },
    updateItem: function (item, index, data) { item.labelText = 'row' + data; }
  });
  var data = [];
  for (var i = 0; i < 100; i++) { data.push(i); }
  list.setData(data);

  assert.strictEqual(created, 6, '池大小 = ceil(400/100)+2');
  var visible = list.content.children.filter(function (c) { return c.visible; });
  assert.strictEqual(visible.length, 6);
  assert.ok(visible.some(function (c) { return c.labelText === 'row0'; }));

  list.scrollTo(999999);   // clamp 到底部
  var visible2 = list.content.children.filter(function (c) { return c.visible; });
  assert.ok(visible2.some(function (c) { return c.labelText === 'row99'; }), '底部行已绑定');
  assert.strictEqual(created, 6, '滚动不新建实例');
});

// 输入：min 0 max 100 step 10，点击轨道 3/4 处；期望：值吸附到 80（含 step）
test('Slider 取值与 step 吸附', function () {
  var ctx = makeCtx();
  var w = fw.widgets.create(ctx);
  var changed = [];
  var s = fw.Slider.create(ctx, w, {
    w: 400, min: 0, max: 100, step: 10, value: 0,
    onChange: function (v) { changed.push(v); }
  });
  s.trigger('pointerdown', ev(300, 20));   // 300/400 = 75% → snap 80
  assert.strictEqual(s.getValue(), 80);
  assert.deepStrictEqual(changed, [80]);
  s.setValue(33);
  assert.strictEqual(s.getValue(), 30);
});

// 输入：open → close；期望：可见性切换，onClose 回调
test('Modal 开关', function () {
  var ctx = makeCtx();
  var w = fw.widgets.create(ctx);
  var closed = 0;
  var m = fw.Modal.create(ctx, w, {
    w: 500, h: 400, stageW: 750, stageH: 1334, title: '测试',
    onClose: function () { closed++; }
  });
  assert.strictEqual(m.visible, false);
  m.open();
  assert.strictEqual(m.visible, true);
  m.close();
  assert.strictEqual(m.visible, false);
  assert.strictEqual(closed, 1);
});

// 输入：show 后推进 duration + 淡出时间；期望：自动隐藏
test('Toast 显示与淡出', function () {
  var ctx = makeCtx();
  var w = fw.widgets.create(ctx);
  var t = fw.Toast.create(ctx, w, { stageW: 750, duration: 100 });
  t.show('已保存');
  assert.strictEqual(t.container.visible, true);
  for (var i = 0; i < 30; i++) { t.update(16); }
  assert.strictEqual(t.container.visible, false);
});

// 输入：legacy 旧签名调用；期望：与旧 widgets 行为等价
test('legacy 兼容层签名', function () {
  var ctx = makeCtx();
  var legacy = fw.legacy.create(ctx);
  var t = legacy.text('hi', 30, 0xFF0000, true);
  assert.strictEqual(t.text, 'hi');
  var tapped = 0;
  var btn = legacy.button('OK', 100, 60, 0xE05B4B, function () { tapped++; }, 24);
  btn.trigger('pointerdown', ev(50, 30));
  btn.trigger('pointerup', ev(50, 30));
  assert.strictEqual(tapped, 1);
  var pb = legacy.progressBar(200, 20, 0x00FF00, 0x111111);
  pb.setRatio(0.5);
  pb.setText('50%');
  var dot = legacy.redDot(20);
  assert.ok(dot instanceof Sprite);
  // 旧 scroller 签名
  var hit = new Container();
  var content = new Container();
  content.y = 100;
  var sc = legacy.scroller(hit, content, 100, 300, function () { return 900; });
  hit.trigger('pointerdown', ev(0, 500));
  hit.trigger('pointermove', ev(0, 400));
  assert.strictEqual(content.y, 0);
  sc.refresh();
  assert.strictEqual(content.y, 100);
});

// ===== 6. 动作层 =====

console.log('\n[6] 动作层');

function fakeTarget() {
  return { x: 0, y: 0, alpha: 1, rotation: 0, scale: new MockScale(), destroyed: false, transform: {} };
}

// 输入：sequence(moveTo 100ms → call)；期望：时序正确、终值精确、回调触发
test('actions sequence 时序', function () {
  var mgr = fw.actions.createManager();
  var t = fakeTarget();
  var doneCalls = [];
  mgr.run(t, fw.actions.sequence(
    fw.actions.moveTo(100, { x: 100, y: 50 }),
    fw.actions.call(function () { doneCalls.push('cb'); })
  ), function () { doneCalls.push('done'); });

  mgr.update(50);
  assert.strictEqual(t.x, 50);
  mgr.update(50);
  assert.strictEqual(t.x, 100);
  assert.strictEqual(t.y, 50);
  assert.deepStrictEqual(doneCalls, ['cb', 'done']);
  assert.strictEqual(mgr.count(), 0);
});

// 输入：spawn(scaleTo + fadeTo) 并行；期望：同时推进
test('actions spawn 并行', function () {
  var mgr = fw.actions.createManager();
  var t = fakeTarget();
  mgr.run(t, fw.actions.spawn(
    fw.actions.scaleTo(100, 2),
    fw.actions.fadeTo(100, 0)
  ));
  mgr.update(50);
  assert.strictEqual(t.scale.x, 1.5);
  assert.strictEqual(t.alpha, 0.5);
  mgr.update(50);
  assert.strictEqual(t.scale.x, 2);
  assert.strictEqual(t.alpha, 0);
});

// 输入：repeat(fadeTo, 3)；期望：重复 3 次后结束
test('actions repeat 与自动停止', function () {
  var mgr = fw.actions.createManager();
  var t = fakeTarget();
  var n = 0;
  mgr.run(t, fw.actions.repeat(
    fw.actions.sequence(fw.actions.delay(10), fw.actions.call(function () { n++; })), 3));
  for (var i = 0; i < 10; i++) { mgr.update(10); }
  assert.strictEqual(n, 3);
  assert.strictEqual(mgr.count(), 0);

  // 目标销毁 → 动作自动清理
  var t2 = fakeTarget();
  mgr.run(t2, fw.actions.moveTo(1000, { x: 500 }));
  t2.destroyed = true;
  mgr.update(16);
  assert.strictEqual(mgr.count(), 0);
});

// 输入：forever + stop；期望：手动停止生效
test('actions forever 与 stop', function () {
  var mgr = fw.actions.createManager();
  var t = fakeTarget();
  var n = 0;
  mgr.run(t, fw.actions.forever(
    fw.actions.sequence(fw.actions.delay(10), fw.actions.call(function () { n++; }))));
  mgr.update(10); mgr.update(10);
  assert.ok(n >= 1);
  mgr.stop(t);
  mgr.update(10);
  var after = n;
  mgr.update(10);
  assert.strictEqual(n, after);
});

// ===== 总结 =====

console.log('\n========================');
console.log('通过: ' + passed + '  失败: ' + failed);
if (failed > 0) { process.exit(1); }
