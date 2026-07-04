/**
 * Particle — 轻量粒子发射器（Egret particle 属性集裁剪：点/圆两种发射形状 + 对象池）
 * 不做编辑器、不做九类发射形状；上限默认 100 粒（低端机防掉帧）
 *
 * create(PIXI, cfg) → emitter
 *   cfg: {
 *     texture,                     粒子纹理（tc.circle/panel 或图集帧）
 *     rate=20,                     每秒发射数
 *     life=800, lifeVar=0,         寿命 ms（±随机量）
 *     speed=100, speedVar=0,       初速 px/s
 *     angle=-90, spread=360,       发射方向（度，-90 朝上）与扇面
 *     gravity=0,                   px/s²（number 为 y 向；或 { x, y }）
 *     alphaFrom=1, alphaTo=0,      寿命内线性衰减
 *     scaleFrom=1, scaleTo=1,
 *     shape='point', radius=0,     'point' | 'circle'（圆内随机出生点）
 *     max=100, blend
 *   }
 * emitter = { container, start, stop, running, burst(n), setPos(x,y),
 *             update(dt), count, destroy }
 * 主循环统一 update(dt)；发射器挂 Container，由调用方 addChild 定位
 */

var LOG = '[Particle]';

function create(PIXI, cfg) {
  cfg = cfg || {};
  var rate = cfg.rate === undefined ? 20 : cfg.rate;
  var life = cfg.life === undefined ? 800 : cfg.life;
  var lifeVar = cfg.lifeVar || 0;
  var speed = cfg.speed === undefined ? 100 : cfg.speed;
  var speedVar = cfg.speedVar || 0;
  var angle = cfg.angle === undefined ? -90 : cfg.angle;
  var spread = cfg.spread === undefined ? 360 : cfg.spread;
  var gx = typeof cfg.gravity === 'object' ? (cfg.gravity.x || 0) : 0;
  var gy = typeof cfg.gravity === 'object' ? (cfg.gravity.y || 0) : (cfg.gravity || 0);
  var alphaFrom = cfg.alphaFrom === undefined ? 1 : cfg.alphaFrom;
  var alphaTo = cfg.alphaTo === undefined ? 0 : cfg.alphaTo;
  var scaleFrom = cfg.scaleFrom === undefined ? 1 : cfg.scaleFrom;
  var scaleTo = cfg.scaleTo === undefined ? 1 : cfg.scaleTo;
  var shape = cfg.shape || 'point';
  var radius = cfg.radius || 0;
  var max = cfg.max === undefined ? 100 : cfg.max;

  var container = new PIXI.Container();
  container.eventMode = 'none';

  var alive = [];    // { sp, vx, vy, life, maxLife }
  var pool = [];     // 空闲 sprite
  var running = false;
  var acc = 0;       // 发射累积量

  function acquire() {
    var sp = pool.pop();
    if (!sp) {
      sp = new PIXI.Sprite(cfg.texture);
      if (sp.anchor && sp.anchor.set) { sp.anchor.set(0.5); }
      if (cfg.blend !== undefined) { sp.blendMode = cfg.blend; }
      container.addChild(sp);
    }
    sp.visible = true;
    return sp;
  }

  function spawnOne() {
    if (alive.length >= max) { return; }
    var sp = acquire();
    var a = (angle + (Math.random() - 0.5) * spread) * Math.PI / 180;
    var v = speed + (Math.random() - 0.5) * 2 * speedVar;
    sp.x = 0;
    sp.y = 0;
    if (shape === 'circle' && radius > 0) {
      var t = Math.random() * Math.PI * 2;
      var r = Math.sqrt(Math.random()) * radius;
      sp.x = Math.cos(t) * r;
      sp.y = Math.sin(t) * r;
    }
    sp.alpha = alphaFrom;
    sp.scale.set(scaleFrom);
    var lf = Math.max(1, life + (Math.random() - 0.5) * 2 * lifeVar);
    alive.push({
      sp: sp,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: lf,
      maxLife: lf
    });
  }

  var emitter = {
    container: container,

    start: function () { running = true; },

    stop: function () { running = false; acc = 0; },

    running: function () { return running; },

    /** 一次性爆发 n 粒（不依赖 start） */
    burst: function (n) {
      for (var i = 0; i < n; i++) { spawnOne(); }
    },

    setPos: function (x, y) {
      container.x = x;
      container.y = y;
    },

    update: function (dt) {
      if (running && rate > 0) {
        acc += rate * dt / 1000;
        while (acc >= 1) {
          acc -= 1;
          spawnOne();
        }
      }
      var sec = dt / 1000;
      for (var i = alive.length - 1; i >= 0; i--) {
        var p = alive[i];
        p.life -= dt;
        if (p.life <= 0) {
          p.sp.visible = false;
          pool.push(p.sp);
          alive.splice(i, 1);
          continue;
        }
        p.vx += gx * sec;
        p.vy += gy * sec;
        p.sp.x += p.vx * sec;
        p.sp.y += p.vy * sec;
        var r = 1 - p.life / p.maxLife;   // 0→1
        p.sp.alpha = alphaFrom + (alphaTo - alphaFrom) * r;
        p.sp.scale.set(scaleFrom + (scaleTo - scaleFrom) * r);
      }
    },

    count: function () { return alive.length; },

    destroy: function () {
      running = false;
      alive = [];
      pool = [];
      try {
        container.destroy({ children: true });
      } catch (e) {
        console.warn(LOG, 'destroy', e);
      }
    }
  };

  // container 销毁 → emitter 视为已销毁（createGame ticking 自动剔除）
  Object.defineProperty(emitter, 'destroyed', {
    get: function () { return !!container.destroyed; }
  });

  return emitter;
}

module.exports = { create: create };
