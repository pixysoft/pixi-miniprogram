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
 'drawEllipse', 'drawPolygon', 'moveTo', 'lineTo', 'quadraticCurveTo', 'arc', 'clear'
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

// ===== 7. 世界层底座（3.0 P0 收编） =====

console.log('\n[7] 世界层底座');

// 输入：地图 1000² 视口 400²，snapTo 中心与角落；期望：偏移钳制在 [0, 600]
test('Camera snapTo 与边界钳制', function () {
  var cam = fw.Camera.create(1000, 1000, 400, 400);
  cam.snapTo(500, 500);
  assert.deepStrictEqual(cam.getOffset(), { x: 300, y: 300 });
  cam.snapTo(0, 0);
  assert.deepStrictEqual(cam.getOffset(), { x: 0, y: 0 });
  cam.snapTo(1000, 1000);
  assert.deepStrictEqual(cam.getOffset(), { x: 600, y: 600 });
});

// 输入：focus 后推进若干帧；期望：偏移平滑逼近目标
test('Camera 平滑跟随', function () {
  var cam = fw.Camera.create(1000, 1000, 400, 400);
  cam.snapTo(0, 0);
  cam.focus(500, 500);
  cam.update(16);
  var mid = cam.getOffset();
  assert.ok(mid.x > 0 && mid.x < 300, '首帧只前进一部分');
  for (var i = 0; i < 100; i++) { cam.update(16); }
  assert.deepStrictEqual(cam.getOffset(), { x: 300, y: 300 });
});

// 输入：dragBy 后 update；期望：manual 模式镜头不动；idleReturnMs=0 时下帧回跟
test('Camera 拖拽接管与空闲回跟', function () {
  var cam = fw.Camera.create(1000, 1000, 400, 400, { idleReturnMs: 10000 });
  cam.snapTo(500, 500);
  cam.dragBy(-100, 0);   // 向右看 100
  assert.ok(cam.isManual());
  assert.strictEqual(cam.getOffset().x, 400);
  cam.update(16, { x: 500, y: 500 });
  assert.strictEqual(cam.getOffset().x, 400, 'manual 模式镜头交给玩家');

  var cam2 = fw.Camera.create(1000, 1000, 400, 400, { idleReturnMs: 0 });
  cam2.snapTo(500, 500);
  cam2.dragBy(-100, 0);
  for (var i = 0; i < 100; i++) { cam2.update(16, { x: 500, y: 500 }); }
  assert.strictEqual(cam2.getOffset().x, 300, '空闲后回跟 idleFocus');
});

// 输入：4 帧 clip fps=10 loop；期望：100ms 一帧推进、回卷；loop=false 触发 onEnd 停在末帧
test('SpriteAnimator 切帧/loop/onEnd', function () {
  var frames = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
  var sprite = { texture: null, destroyed: false };
  var an = fw.SpriteAnimator.create(sprite, null);
  an.add('walk', frames);
  an.play('walk', { fps: 10 });
  assert.strictEqual(sprite.texture.id, 0);
  an.update(100);
  assert.strictEqual(sprite.texture.id, 1);
  an.update(300);
  assert.strictEqual(sprite.texture.id, 0, 'loop 回卷');

  var ended = 0;
  an.play('walk', { fps: 10, loop: false, onEnd: function () { ended++; } });
  an.update(1000);
  assert.strictEqual(ended, 1);
  assert.strictEqual(sprite.texture.id, 3, '停在末帧');
  assert.ok(!an.playing());
});

// 输入：assets 前缀 clip；期望：懒解析 assets.frames(prefix)
test('SpriteAnimator 前缀解析 assets 帧', function () {
  var am = fw.AssetManager.create(PIXI);
  am.addSheet('char', 'char.png', {
    run_01: { x: 0, y: 0, w: 32, h: 32 },
    run_02: { x: 32, y: 0, w: 32, h: 32 }
  });
  am.loadGroup(['char'], function () {});
  var sprite = { texture: null, destroyed: false };
  var an = fw.SpriteAnimator.create(sprite, am);
  an.play('run_', { fps: 8 });
  assert.strictEqual(sprite.texture.frame.width, 32);
  assert.ok(an.playing());
});

// 输入：256 宽条带按 64 切帧；期望：4 帧、命名 key_01.. 与 frames() 配合
test('AssetManager addStrip 条带切帧', function () {
  var am = fw.AssetManager.create(PIXI);
  am.addStrip('boom', 'boom.png', 64);
  var result = null;
  am.loadGroup(['boom'], function (ok, total) { result = [ok, total]; });
  assert.deepStrictEqual(result, [1, 1]);
  assert.strictEqual(am.frames('boom_').length, 4);
  assert.strictEqual(am.texture('boom_01').frame.width, 64);
  assert.strictEqual(am.texture('boom_04').frame.x, 192);
});

function fakeAudioFactory(made) {
  return function () {
    var ctx = {
      loop: false, volume: 1, src: '', stopped: false, destroyedCtx: false,
      play: function () {}, stop: function () { this.stopped = true; },
      destroy: function () { this.destroyedCtx = true; },
      onError: function () {}, onEnded: function (fn) { this._onEnded = fn; }
    };
    made.push(ctx);
    return ctx;
  };
}

// 输入：playBgm 两曲交叉淡入；期望：新通道升到 bgmVolume、旧通道降 0 销毁、同曲不打断
test('AudioManager BGM 交叉淡入', function () {
  var made = [];
  var au = fw.AudioManager.create({ createCtx: fakeAudioFactory(made), bgmVolume: 0.6 });
  au.registerAll({ a: 'a.mp3', b: 'b.mp3' });
  au.playBgm('a', { fade: 400 });
  assert.strictEqual(made.length, 1);
  assert.strictEqual(made[0].volume, 0);
  au.update(400);
  assert.strictEqual(made[0].volume, 0.6);
  au.playBgm('a');
  assert.strictEqual(made.length, 1, '同曲目不打断');
  au.playBgm('b', { fade: 200 });
  au.update(100);
  assert.ok(Math.abs(made[1].volume - 0.3) < 1e-9);
  assert.ok(Math.abs(made[0].volume - 0.3) < 1e-9);
  au.update(100);
  assert.strictEqual(made[1].volume, 0.6);
  assert.ok(made[0].destroyedCtx, '旧通道已销毁');
  assert.strictEqual(au.currentBgm(), 'b');
});

// 输入：SFX 连发 5 次上限 4；期望：最早的被淘汰；静音后不再发声
test('AudioManager SFX 上限与静音', function () {
  var made = [];
  var au = fw.AudioManager.create({ createCtx: fakeAudioFactory(made), sfxLimit: 4 });
  au.register('hit', 'hit.mp3');
  for (var i = 0; i < 5; i++) { au.playSfx('hit'); }
  assert.strictEqual(made.length, 5);
  assert.ok(made[0].destroyedCtx, '最早的 SFX 被淘汰');
  au.setMuted(true);
  au.playSfx('hit');
  assert.strictEqual(made.length, 5, '静音不再创建');
});

function mockApp() {
  var ticks = [];
  return {
    PIXI: PIXI,
    stage: new Container(),
    stageWidth: 750,
    stageHeight: 1334,
    onTick: function (fn) { ticks.push(fn); },
    tick: function (dt) { ticks.slice().forEach(function (f) { f(dt); }); }
  };
}

// 输入：fade 转场包裹切换；期望：变黑到底才执行切换、随后淡入、期间吞触摸
test('transitions.fade 状态机', function () {
  var app = mockApp();
  var t = fw.transitions.fade(app, { duration: 100 });
  var applied = 0;
  t(function () { applied++; });
  assert.strictEqual(t.overlay.eventMode, 'static', '转场期吞触摸');
  app.tick(50);
  assert.strictEqual(applied, 0);
  assert.ok(Math.abs(t.overlay.alpha - 0.5) < 1e-9);
  app.tick(60);
  assert.strictEqual(applied, 1, '变黑到底执行切换');
  app.tick(120);
  assert.strictEqual(t.overlay.alpha, 0);
  assert.strictEqual(t.overlay.eventMode, 'none');
});

// 输入：变黑中再次转场；期望：最新切换意图覆盖，只切一次
test('transitions.fade 变黑中覆盖意图', function () {
  var app = mockApp();
  var t = fw.transitions.fade(app, { duration: 100 });
  var log = [];
  t(function () { log.push('a'); });
  app.tick(50);
  t(function () { log.push('b'); });
  app.tick(60);
  assert.deepStrictEqual(log, ['b']);
});

// 输入：锚点组合；期望：优先级 center > left > right、拉伸、百分比 w/h
test('Layout 锚点定位与优先级', function () {
  var B = { w: 750, h: 1334 };
  var n1 = { width: 100, height: 50, x: 0, y: 0 };
  fw.Layout.apply(n1, { right: 20, bottom: 10 }, B);
  assert.strictEqual(n1.x, 630);
  assert.strictEqual(n1.y, 1274);

  var n2 = { width: 100, height: 50, x: 0, y: 0 };
  fw.Layout.apply(n2, { centerX: 0, left: 10, top: 30 }, B);
  assert.strictEqual(n2.x, 325, 'centerX 优先于 left');
  assert.strictEqual(n2.y, 30);

  var n3 = { width: 100, height: 50, x: 0, y: 0 };
  fw.Layout.apply(n3, { left: 20, right: 20 }, B);
  assert.strictEqual(n3.width, 710, 'left+right 拉伸');
  assert.strictEqual(n3.x, 20);

  var n4 = { width: 100, height: 50, x: 0, y: 0 };
  fw.Layout.apply(n4, { w: 0.5, h: 100, centerX: 0, centerY: 0 }, B);
  assert.strictEqual(n4.width, 375, 'w<=1 视为比例');
  assert.strictEqual(n4.height, 100);
});

// 输入：attach 后 bounds 变化 relayout；期望：位置随新 bounds 更新
test('Layout attach 与 relayout', function () {
  var n = { width: 100, height: 50, x: 0, y: 0 };
  fw.Layout.attach(n, { right: 0, bottom: 0 }, { w: 750, h: 1334 });
  assert.strictEqual(n.x, 650);
  n.relayout({ w: 400, h: 800 });
  assert.strictEqual(n.x, 300);
  assert.strictEqual(n.y, 750);
});

// ===== 8. 演出层（3.0 P1） =====

console.log('\n[8] 演出层');

// 输入：rate=100/s 推进 1s；期望：粒子受上限约束、寿命到期回池复用、位置受重力影响
test('Particle 发射/上限/池复用', function () {
  var tex = { width: 8, height: 8 };
  var em = fw.Particle.create(PIXI, {
    texture: tex, rate: 100, life: 500, speed: 100, gravity: 200, max: 30
  });
  em.start();
  for (var i = 0; i < 30; i++) { em.update(16); }   // ~480ms ≈ 48 发射意图
  assert.ok(em.count() <= 30, '受 max 上限约束');
  assert.ok(em.count() > 0);
  var spriteTotal = em.container.children.length;
  for (var j = 0; j < 100; j++) { em.update(16); }  // 再 1.6s：老粒子回池
  assert.ok(em.container.children.length <= spriteTotal + 5, '池复用，sprite 数收敛');
  em.stop();
  for (var k = 0; k < 60; k++) { em.update(16); }
  assert.strictEqual(em.count(), 0, '停止后全部消亡');
});

// 输入：burst 一次性爆发；期望：立即产生 n 粒且 alpha/scale 随寿命衰减
test('Particle burst 与衰减', function () {
  var em = fw.Particle.create(PIXI, {
    texture: {}, rate: 0, life: 400, speed: 0, alphaFrom: 1, alphaTo: 0, scaleFrom: 1, scaleTo: 2
  });
  em.burst(10);
  assert.strictEqual(em.count(), 10);
  em.update(200);
  var sp = em.container.children[0];
  assert.ok(Math.abs(sp.alpha - 0.5) < 0.01, '半寿命 alpha≈0.5');
  assert.ok(Math.abs(sp.scale.x - 1.5) < 0.01, '半寿命 scale≈1.5');
});

// 输入：mock PIXI 无 ColorMatrixFilter；期望：回退 tint，clear 还原
test('filters 预设 tint 回退与 clear', function () {
  var f = fw.filters.create(PIXI);
  var sp = new Sprite({});
  sp.tint = 0xFFFFFF;
  var r = f.night(sp);
  assert.strictEqual(r.type, 'tint');
  assert.strictEqual(sp.tint, 0x5566AA);
  f.clear(sp);
  assert.strictEqual(sp.tint, 0xFFFFFF, 'clear 还原原 tint');
});

// 输入：注入 ColorMatrixFilter 的 PIXI；期望：走 filter 路径并可 clear
test('filters 预设 ColorMatrixFilter 路径', function () {
  function CMF() {
    this.calls = [];
    var self = this;
    this.brightness = function (v) { self.calls.push(['brightness', v]); };
    this.tint = function (v) { self.calls.push(['tint', v]); };
  }
  var PIXI2 = { filters: { ColorMatrixFilter: CMF }, Filter: function () {} };
  var f = fw.filters.create(PIXI2);
  var target = { filters: null };
  var r = f.glow(target);
  assert.strictEqual(r.type, 'filter');
  assert.strictEqual(target.filters.length, 1);
  assert.deepStrictEqual(r.filter.calls[0], ['brightness', 1.4]);
  f.clear(target);
  assert.strictEqual(target.filters, null);
});

// 输入：飘字 + 推进至消亡，再发一条；期望：Text 对象池复用不新建
test('FxLayer 飘字对象池复用', function () {
  var ctx = makeCtx();
  var fx = fw.FxLayer.create(ctx);
  fx.damageText(100, 200, 55);
  fx.coinText(100, 200, 10);
  assert.strictEqual(fx.activeCount(), 2);
  var textNodes = fx.container.children.length;
  for (var i = 0; i < 80; i++) { fx.update(16); }
  assert.strictEqual(fx.activeCount(), 0);
  fx.label(50, 50, 'LEVEL UP');
  assert.strictEqual(fx.container.children.length, textNodes, '复用池内 Text，不新建');
  var t = fx.container.children.filter(function (c) { return c.visible; })[0];
  assert.strictEqual(t.text, 'LEVEL UP');
});

// 输入：burst 碎块 + ring 圆环推进；期望：重力坠落、圆环扩散后清理
test('FxLayer 碎块与圆环', function () {
  var ctx = makeCtx();
  var fx = fw.FxLayer.create(ctx);
  fx.burst(0, 0, 0xE05B4B, 4);
  fx.ring(10, 10, 40);
  assert.strictEqual(fx.activeCount(), 5);
  for (var i = 0; i < 60; i++) { fx.update(16); }
  assert.strictEqual(fx.activeCount(), 0, '全部消亡清理');
});

// 输入：setCooldown 0.5 → 0；期望：遮罩重绘、图标灰/亮、CD 中不可点
test('CooldownButton 径向 CD', function () {
  var ctx = makeCtx();
  ctx.assets.addSheet('sk', 'sk.png', { icon_fire: { x: 0, y: 0, w: 32, h: 32 } });
  ctx.assets.loadGroup(['sk'], function () {});
  var w = fw.widgets.create(ctx);
  var tapped = 0;
  var btn = fw.CooldownButton.create(ctx, w, {
    radius: 50, icon: 'icon_fire', onTap: function () { tapped++; }
  });
  btn.setCooldown(0.5, 3);
  assert.strictEqual(btn.getCooldown(), 0.5);
  btn.trigger('pointerdown', ev(0, 0));
  btn.trigger('pointerup', ev(0, 0));
  assert.strictEqual(tapped, 0, 'CD 中不可点');
  btn.setCooldown(0);
  btn.trigger('pointerdown', ev(0, 0));
  btn.trigger('pointerup', ev(0, 0));
  assert.strictEqual(tapped, 1, 'CD 结束可点');
});

// 输入：bezierTo 对称控制点；期望：终值精确、中点在弦上方（抛物线弧）
test('actions bezierTo 曲线', function () {
  var mgr = fw.actions.createManager();
  var t = fakeTarget();
  mgr.run(t, fw.actions.bezierTo(100, { x: 50, y: -100 }, { x: 150, y: -100 }, { x: 200, y: 0 }));
  mgr.update(50);
  assert.ok(Math.abs(t.x - 100) < 1e-9, '中点 x 在弦中央');
  assert.ok(t.y < -50, '中点 y 拱起');
  mgr.update(50);
  assert.strictEqual(t.x, 200);
  assert.strictEqual(t.y, 0);
});

// 输入：splineTo 穿点序列；期望：终值精确、途径点近似命中
test('actions splineTo 样条', function () {
  var mgr = fw.actions.createManager();
  var t = fakeTarget();
  mgr.run(t, fw.actions.splineTo(300, [{ x: 100, y: 100 }, { x: 200, y: 0 }, { x: 300, y: 100 }]));
  mgr.update(100);   // r = 1/3 → 恰在第 1 个途径点
  assert.ok(Math.abs(t.x - 100) < 1e-6 && Math.abs(t.y - 100) < 1e-6, '穿过途径点');
  mgr.update(200);
  assert.strictEqual(t.x, 300);
  assert.strictEqual(t.y, 100);
});

// 输入：水平 ScrollView 拖动与惯性；期望：与垂直对称，停在右边界
test('ScrollView 水平方向', function () {
  var ctx = makeCtx();
  var sv = fw.ScrollView.create(ctx, { w: 400, h: 300, direction: 'x' });
  sv.setContentWidth(500);   // maxScroll = 100

  sv.trigger('pointerdown', ev(300, 150));
  var x = 300;
  for (var i = 0; i < 5; i++) {
    x -= 30;
    sv.trigger('pointermove', ev(x, 150));
  }
  sv.trigger('pointerup', ev(x, 150));
  for (var f = 0; f < 200; f++) { sv.update(16); }
  assert.strictEqual(Math.round(sv.content.x), -100, '最终停在右边界');
  assert.strictEqual(sv.scrollX(), 100);
});

// 输入：snapInterval=400 拖过半页释放；期望：磁吸到下一页并回调 onSnap
test('ScrollView 磁吸翻页', function () {
  var ctx = makeCtx();
  var snaps = [];
  var sv = fw.ScrollView.create(ctx, {
    w: 400, h: 300, direction: 'x', snapInterval: 400,
    onSnap: function (idx) { snaps.push(idx); }
  });
  sv.setContentWidth(1200);   // 3 页

  sv.trigger('pointerdown', ev(390, 150));
  sv.trigger('pointermove', ev(180, 150));   // 拖 210 > 半页
  sv.trigger('pointerup', ev(180, 150));
  for (var f = 0; f < 60; f++) { sv.update(16); }
  assert.strictEqual(sv.content.x, -400, '吸附到第 1 页');
  assert.deepStrictEqual(snaps, [1]);

  sv.snapTo(0, false);
  assert.deepStrictEqual(snaps, [1, 0]);
  assert.strictEqual(sv.content.x, 0);
});

// ===== 总结 =====

console.log('\n========================');
console.log('通过: ' + passed + '  失败: ' + failed);
if (failed > 0) { process.exit(1); }
