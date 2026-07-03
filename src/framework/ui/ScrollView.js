/**
 * ScrollView — 垂直滚动容器（手感参数移植 cocos/egret）
 *   惯性：速度加权采样 + 摩擦衰减；回弹：越界阻尼 0.5 + 300ms 弹回
 *   拦截：子控件按下后滚动位移超阈值 → cancelPress 子控件、接管滚动
 *
 * create(ctx, opts)
 *   opts: { w, h, onScroll(y) }
 * 返回 container，挂 { content, setContentHeight(h), scrollTo(y), scrollY(),
 *                     update(dt), refresh() }
 * 需每帧调用 update(dt)（createGame 装配时自动接入 app.onTick）
 */

var CFG = {
  cancelOffset: 10,      // 滚动方向位移超此值取消子控件点击（cocos 7pt≈10px）
  overDrag: 0.5,         // 越界拖动阻尼（cocos/egret 一致）
  frictionBase: 0.992,   // 惯性摩擦（每 ms）
  overBrake: 0.85,       // 越界惯性额外制动（cocos 0.05 加速制动的近似）
  minVelocity: 0.02,     // px/ms，低于即停
  bounceMs: 300,         // 回弹时长（egret finishScrolling）
  sampleCount: 5,        // 速度采样帧数（cocos）
  sampleWeights: [1, 1.33, 1.66, 2, 2.33]  // 越新权重越大（egret 加权思路）
};

function create(ctx, opts) {
  var PIXI = ctx.PIXI;
  opts = opts || {};
  var W = opts.w;
  var H = opts.h;

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

  var contentHeight = 0;
  var dragging = false;
  var scrolling = false;      // 位移超阈值后才算真正滚动
  var pressedChild = null;    // 冒泡捕获的子控件（用于拦截取消）
  var startY = 0;
  var lastY = 0;
  var velocity = 0;           // px/ms
  var samples = [];           // { dy, dt }
  var lastMoveTs = 0;
  var inertia = false;
  var bounce = null;          // { from, to, t }

  function maxScroll() { return Math.max(0, contentHeight - H); }

  function overshoot() {
    if (content.y > 0) { return content.y; }
    var min = -maxScroll();
    if (content.y < min) { return content.y - min; }
    return 0;
  }

  function clampHard() {
    content.y = Math.min(0, Math.max(-maxScroll(), content.y));
  }

  function emitScroll() {
    if (opts.onScroll) { opts.onScroll(-content.y); }
  }

  function startBounce() {
    var over = overshoot();
    if (!over) { return; }
    bounce = { from: content.y, to: over > 0 ? 0 : -maxScroll(), t: 0 };
  }

  container.on('pointerdown', function (ev) {
    dragging = true;
    scrolling = false;
    inertia = false;
    bounce = null;
    velocity = 0;
    samples = [];
    startY = lastY = ev.data.global.y;
    lastMoveTs = Date.now();
    // 冒泡目标是子控件时记下，滚动启动时取消其按压
    pressedChild = (ev.target && ev.target !== container && ev.target.cancelPress) ? ev.target : null;
  });

  container.on('pointermove', function (ev) {
    if (!dragging) { return; }
    var y = ev.data.global.y;
    var dy = y - lastY;
    lastY = y;

    if (!scrolling) {
      if (Math.abs(y - startY) < CFG.cancelOffset) { return; }
      scrolling = true;
      if (pressedChild) {
        pressedChild.cancelPress();
        pressedChild = null;
      }
    }

    // 越界阻尼
    if (overshoot() !== 0) { dy *= CFG.overDrag; }
    content.y += dy;

    var now = Date.now();
    samples.push({ dy: dy, dt: Math.max(1, now - lastMoveTs) });
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
      sumV += (samples[i].dy / samples[i].dt) * w;
      sumW += w;
    }
    velocity = sumW ? sumV / sumW : 0;
    if (overshoot() !== 0) {
      startBounce();
    } else if (Math.abs(velocity) > CFG.minVelocity) {
      inertia = true;
    }
  }

  container.on('pointerup', onRelease);
  container.on('pointerupoutside', onRelease);

  container.content = content;

  container.setContentHeight = function (h) {
    contentHeight = h;
  };

  container.scrollTo = function (y) {
    content.y = -y;
    clampHard();
    emitScroll();
  };

  container.scrollY = function () { return -content.y; };

  /** 内容变化后调用：重置到顶部并夹紧 */
  container.refresh = function () {
    content.y = 0;
    clampHard();
    emitScroll();
  };

  container.update = function (dt) {
    if (inertia) {
      var friction = Math.pow(CFG.frictionBase, dt);
      if (overshoot() !== 0) { friction *= Math.pow(CFG.overBrake, dt / 16); }
      velocity *= friction;
      content.y += velocity * dt;
      emitScroll();
      if (Math.abs(velocity) < CFG.minVelocity) {
        inertia = false;
        startBounce();
      }
      return;
    }
    if (bounce) {
      bounce.t += dt;
      var t = Math.min(1, bounce.t / CFG.bounceMs);
      var r = 1 - (1 - t) * (1 - t);   // quadOut
      content.y = bounce.from + (bounce.to - bounce.from) * r;
      emitScroll();
      if (t >= 1) { bounce = null; }
    }
  };

  return container;
}

module.exports = { create: create, CFG: CFG };
