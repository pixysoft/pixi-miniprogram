/**
 * ScrollView — 滚动容器（手感参数移植 cocos/egret；3.0 轴向化：垂直/水平对称）
 *   惯性：速度加权采样 + 摩擦衰减；回弹：越界阻尼 0.5 + 300ms 弹回
 *   拦截：子控件按下后滚动位移超阈值 → cancelPress 子控件、接管滚动
 *   磁吸：snapInterval 设定后释放时吸附到最近整数倍位置（PageView 翻页手感）
 *
 * create(ctx, opts)
 *   opts: { w, h, direction='y'|'x', onScroll(pos),
 *           snapInterval?, onSnap(index) }
 * 返回 container，挂 { content, setContentHeight(h), setContentWidth(w),
 *                     setContentSize(len), scrollTo(pos), scrollY(), scrollX(),
 *                     snapTo(index, animated?), update(dt), refresh() }
 * 需每帧调用 update(dt)（createGame 装配时自动接入 app.onTick）
 */

var CFG = {
  cancelOffset: 10,      // 滚动方向位移超此值取消子控件点击（cocos 7pt≈10px）
  overDrag: 0.5,         // 越界拖动阻尼（cocos/egret 一致）
  frictionBase: 0.992,   // 惯性摩擦（每 ms）
  overBrake: 0.85,       // 越界惯性额外制动（cocos 0.05 加速制动的近似）
  minVelocity: 0.02,     // px/ms，低于即停
  bounceMs: 300,         // 回弹时长（egret finishScrolling）
  snapMs: 300,           // 磁吸吸附时长（quintOut）
  snapVelocity: 0.3,     // px/ms，超过即翻向速度方向的下一页
  sampleCount: 5,        // 速度采样帧数（cocos）
  sampleWeights: [1, 1.33, 1.66, 2, 2.33]  // 越新权重越大（egret 加权思路）
};

function quintOut(t) { var p = t - 1; return p * p * p * p * p + 1; }

function create(ctx, opts) {
  var PIXI = ctx.PIXI;
  opts = opts || {};
  var W = opts.w;
  var H = opts.h;
  var axis = opts.direction === 'x' ? 'x' : 'y';
  var viewLen = axis === 'x' ? W : H;
  var snapInterval = opts.snapInterval || 0;

  var container = new PIXI.Container();
  container.eventMode = 'static';
  container.hitArea = new PIXI.Rectangle(0, 0, W, H);

  var maskG = new PIXI.Graphics();
  maskG.beginFill(0xFFFFFF);
  maskG.drawRect(0, 0, W, H);
  maskG.endFill();
  container.addChild(maskG);

  var content = new PIXI.Container();
  content.mask = maskG;
  container.addChild(content);

  var contentLen = 0;
  var dragging = false;
  var scrolling = false;      // 位移超阈值后才算真正滚动
  var pressedChild = null;    // 冒泡捕获的子控件（用于拦截取消）
  var startPos = 0;
  var lastPos = 0;
  var velocity = 0;           // px/ms
  var samples = [];           // { d, dt }
  var lastMoveTs = 0;
  var inertia = false;
  var bounce = null;          // { from, to, t, dur, snap? }
  var snapIndex = -1;         // 上次吸附页

  function maxScroll() { return Math.max(0, contentLen - viewLen); }

  function overshoot() {
    if (content[axis] > 0) { return content[axis]; }
    var min = -maxScroll();
    if (content[axis] < min) { return content[axis] - min; }
    return 0;
  }

  function clampHard() {
    content[axis] = Math.min(0, Math.max(-maxScroll(), content[axis]));
  }

  function emitScroll() {
    if (opts.onScroll) { opts.onScroll(-content[axis]); }
  }

  function emitSnap(idx) {
    if (idx !== snapIndex) {
      snapIndex = idx;
      if (opts.onSnap) { opts.onSnap(idx); }
    }
  }

  function startBounce() {
    var over = overshoot();
    if (!over) { return; }
    bounce = { from: content[axis], to: over > 0 ? 0 : -maxScroll(), t: 0, dur: CFG.bounceMs };
  }

  /** 磁吸：按当前位置 + 速度方向选目标页，quintOut 吸附 */
  function startSnap() {
    var pos = -content[axis];
    var idx = Math.round(pos / snapInterval);
    if (Math.abs(velocity) > CFG.snapVelocity) {
      idx = velocity < 0 ? Math.ceil(pos / snapInterval) : Math.floor(pos / snapInterval);
    }
    idx = Math.max(0, Math.min(idx, Math.floor(maxScroll() / snapInterval)));
    bounce = { from: content[axis], to: -idx * snapInterval + 0, t: 0, dur: CFG.snapMs, snap: idx };
  }

  container.on('pointerdown', function (ev) {
    dragging = true;
    scrolling = false;
    inertia = false;
    bounce = null;
    velocity = 0;
    samples = [];
    startPos = lastPos = ev.data.global[axis];
    lastMoveTs = Date.now();
    // 冒泡目标是子控件时记下，滚动启动时取消其按压
    pressedChild = (ev.target && ev.target !== container && ev.target.cancelPress) ? ev.target : null;
  });

  container.on('pointermove', function (ev) {
    if (!dragging) { return; }
    var pos = ev.data.global[axis];
    var d = pos - lastPos;
    lastPos = pos;

    if (!scrolling) {
      if (Math.abs(pos - startPos) < CFG.cancelOffset) { return; }
      scrolling = true;
      if (pressedChild) {
        pressedChild.cancelPress();
        pressedChild = null;
      }
    }

    // 越界阻尼
    if (overshoot() !== 0) { d *= CFG.overDrag; }
    content[axis] += d;

    var now = Date.now();
    samples.push({ d: d, dt: Math.max(1, now - lastMoveTs) });
    if (samples.length > CFG.sampleCount) { samples.shift(); }
    lastMoveTs = now;
    emitScroll();
  });

  function onRelease() {
    if (!dragging) { return; }
    dragging = false;
    if (!scrolling) { return; }
    scrolling = false;
    // 加权平均速度（新样本权重大）
    var sumV = 0;
    var sumW = 0;
    for (var i = 0; i < samples.length; i++) {
      var w = CFG.sampleWeights[i] || 1;
      sumV += (samples[i].d / samples[i].dt) * w;
      sumW += w;
    }
    velocity = sumW ? sumV / sumW : 0;
    if (snapInterval > 0) {
      startSnap();
    } else if (overshoot() !== 0) {
      startBounce();
    } else if (Math.abs(velocity) > CFG.minVelocity) {
      inertia = true;
    }
  }

  container.on('pointerup', onRelease);
  container.on('pointerupoutside', onRelease);

  container.content = content;

  container.setContentSize = function (len) { contentLen = len; };
  container.setContentHeight = function (h) { contentLen = h; };
  container.setContentWidth = function (w) { contentLen = w; };

  container.scrollTo = function (pos) {
    content[axis] = -pos;
    clampHard();
    emitScroll();
  };

  container.scrollY = function () { return -content[axis]; };
  container.scrollX = function () { return -content[axis]; };

  /** 磁吸模式：跳到第 index 页（animated 默认 true） */
  container.snapTo = function (index, animated) {
    if (!snapInterval) { return; }
    var idx = Math.max(0, Math.min(index, Math.floor(maxScroll() / snapInterval)));
    if (animated === false) {
      content[axis] = -idx * snapInterval + 0;   // +0 归一化 -0
      emitScroll();
      emitSnap(idx);
      return;
    }
    bounce = { from: content[axis], to: -idx * snapInterval + 0, t: 0, dur: CFG.snapMs, snap: idx };
  };

  /** 内容变化后调用：重置到起点并夹紧 */
  container.refresh = function () {
    content[axis] = 0;
    clampHard();
    emitScroll();
  };

  container.update = function (dt) {
    if (inertia) {
      var friction = Math.pow(CFG.frictionBase, dt);
      if (overshoot() !== 0) { friction *= Math.pow(CFG.overBrake, dt / 16); }
      velocity *= friction;
      content[axis] += velocity * dt;
      emitScroll();
      if (Math.abs(velocity) < CFG.minVelocity) {
        inertia = false;
        startBounce();
      }
      return;
    }
    if (bounce) {
      bounce.t += dt;
      var t = Math.min(1, bounce.t / bounce.dur);
      var r = bounce.snap !== undefined ? quintOut(t) : 1 - (1 - t) * (1 - t);   // 磁吸 quintOut / 回弹 quadOut
      content[axis] = bounce.from + (bounce.to - bounce.from) * r;
      emitScroll();
      if (t >= 1) {
        var snapped = bounce.snap;
        bounce = null;
        if (snapped !== undefined) { emitSnap(snapped); }
      }
    }
  };

  return container;
}

module.exports = { create: create, CFG: CFG };
