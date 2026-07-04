/**
 * FxLayer — 战斗即时反馈层（收编 KR2 Fx.js：飘字/碎块/圆环，加对象池 + 皮肤化）
 * 皮肤键 FxText：{ damage/coin/crit/label: { size, color, bold } }
 *
 * create(ctx, opts { layer? }) → {
 *   container                    未传 layer 时自建（调用方 addChild 定位到世界层）
 *   damageText(x, y, amount, damageType?, crit?)
 *   coinText(x, y, amount)
 *   label(x, y, str, color?)
 *   burst(x, y, color, count=5)  死亡碎块四散坠落
 *   ring(x, y, radius, color?)   爆炸圆环扩散
 *   update(dt) / clear() / activeCount()
 * }
 * update 由场景每帧驱动（或 createGame track）
 */

function create(ctx, opts) {
  var PIXI = ctx.PIXI;
  var tc = ctx.tc;
  var theme = ctx.theme;
  opts = opts || {};

  var skin = theme.get('FxText');
  var layer = opts.layer || new PIXI.Container();
  if (!opts.layer) { layer.eventMode = 'none'; }

  var floats = [];     // { obj, vy, lifeMs, maxMs }
  var particles = [];  // { obj, vx, vy, lifeMs }
  var rings = [];      // { obj, lifeMs, maxMs }
  var textPool = [];   // 飘字对象池

  function style(name) {
    return skin[name] || { size: 26, color: 0xFFFFFF, bold: true };
  }

  function acquireText(str, size, color, bold) {
    var t = textPool.pop();
    if (!t) {
      t = new PIXI.Text('', {});
      if (t.anchor && t.anchor.set) { t.anchor.set(0.5); }
      layer.addChild(t);
    }
    t.text = str;
    t.style.fontSize = size;
    t.style.fill = color;
    t.style.fontWeight = bold ? 'bold' : 'normal';
    t.style.stroke = 0x14161C;
    t.style.strokeThickness = 3;
    t.visible = true;
    t.alpha = 1;
    return t;
  }

  function releaseText(t) {
    t.visible = false;
    textPool.push(t);
  }

  function pushFloat(t, vy, lifeMs) {
    floats.push({ obj: t, vy: vy, lifeMs: lifeMs, maxMs: lifeMs });
  }

  var fx = {
    container: layer,

    damageText: function (x, y, amount, damageType, crit) {
      var s = crit ? style('crit') : style('damage');
      var color = s.color;
      if (!crit && damageType === 'magic') { color = 0xC9A8FF; }
      if (!crit && damageType === 'burn') { color = 0xF2914E; }
      var t = acquireText(String(amount), crit ? Math.round(s.size * 1.5) : s.size, color, s.bold);
      t.x = x + (Math.random() * 16 - 8);
      t.y = y - 18;
      pushFloat(t, -55, 650);
    },

    coinText: function (x, y, amount) {
      var s = style('coin');
      var t = acquireText('+' + amount, s.size, s.color, s.bold);
      t.x = x;
      t.y = y - 26;
      pushFloat(t, -42, 800);
    },

    label: function (x, y, str, color) {
      var s = style('label');
      var t = acquireText(str, s.size, color === undefined ? s.color : color, s.bold);
      t.x = x;
      t.y = y;
      pushFloat(t, -30, 1000);
    },

    /** 死亡碎块：小方块四散坠落 */
    burst: function (x, y, color, count) {
      var n = count || 5;
      for (var i = 0; i < n; i++) {
        var s = new PIXI.Sprite(tc.panel(8, 8, color, 1, 2));
        if (s.anchor && s.anchor.set) { s.anchor.set(0.5); }
        s.x = x;
        s.y = y;
        layer.addChild(s);
        particles.push({
          obj: s,
          vx: (Math.random() * 2 - 1) * 130,
          vy: -60 - Math.random() * 110,
          lifeMs: 550
        });
      }
    },

    /** 爆炸/技能圆环扩散 */
    ring: function (x, y, radius, color) {
      var r = new PIXI.Sprite(tc.ring(radius, color === undefined ? 0xF2914E : color, 4));
      if (r.anchor && r.anchor.set) {
        r.anchor.set(0.5);
      } else if (r.pivot) {
        r.pivot.set(radius, radius);
      }
      r.x = x;
      r.y = y;
      r.scale.set(0.25);
      layer.addChild(r);
      rings.push({ obj: r, lifeMs: 320, maxMs: 320 });
    },

    update: function (dtMs) {
      var i;
      for (i = floats.length - 1; i >= 0; i--) {
        var f = floats[i];
        f.lifeMs -= dtMs;
        f.obj.y += f.vy * dtMs / 1000;
        f.obj.alpha = Math.max(0, f.lifeMs / f.maxMs);
        if (f.lifeMs <= 0) {
          releaseText(f.obj);
          floats.splice(i, 1);
        }
      }
      for (i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.lifeMs -= dtMs;
        p.vy += 420 * dtMs / 1000;
        p.obj.x += p.vx * dtMs / 1000;
        p.obj.y += p.vy * dtMs / 1000;
        p.obj.rotation += 0.12;
        p.obj.alpha = Math.max(0, p.lifeMs / 550);
        if (p.lifeMs <= 0) {
          layer.removeChild(p.obj);
          p.obj.destroy();
          particles.splice(i, 1);
        }
      }
      for (i = rings.length - 1; i >= 0; i--) {
        var r = rings[i];
        r.lifeMs -= dtMs;
        var t = 1 - r.lifeMs / r.maxMs;
        r.obj.scale.set(0.25 + 0.75 * t);
        r.obj.alpha = 1 - t;
        if (r.lifeMs <= 0) {
          layer.removeChild(r.obj);
          r.obj.destroy();
          rings.splice(i, 1);
        }
      }
    },

    clear: function () {
      floats.forEach(function (f) { releaseText(f.obj); });
      particles.forEach(function (p) { layer.removeChild(p.obj); p.obj.destroy(); });
      rings.forEach(function (r) { layer.removeChild(r.obj); r.obj.destroy(); });
      floats = [];
      particles = [];
      rings = [];
    },

    activeCount: function () {
      return floats.length + particles.length + rings.length;
    }
  };

  // 层容器销毁 → fx 视为已销毁（createGame ticking 自动剔除）
  Object.defineProperty(fx, 'destroyed', {
    get: function () { return !!layer.destroyed; }
  });

  return fx;
}

module.exports = { create: create };
