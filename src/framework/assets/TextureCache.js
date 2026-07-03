/**
 * TextureCache — 程序化纹理缓存（收编 KR2 cached 模式）
 * 供框架内部（皮肤回退 panel）与游戏 TextureFactory 共用一套缓存/销毁
 *
 * create(PIXI, renderer) → { cached(key, make), panel(...), clear() }
 */

function darken(color, f) {
  var r = Math.floor(((color >> 16) & 0xff) * f);
  var g = Math.floor(((color >> 8) & 0xff) * f);
  var b = Math.floor((color & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

function lighten(color, f) {
  var r = Math.min(255, ((color >> 16) & 0xff) + Math.floor((255 - ((color >> 16) & 0xff)) * f));
  var g = Math.min(255, ((color >> 8) & 0xff) + Math.floor((255 - ((color >> 8) & 0xff)) * f));
  var b = Math.min(255, (color & 0xff) + Math.floor((255 - (color & 0xff)) * f));
  return (r << 16) | (g << 8) | b;
}

function create(PIXI, renderer) {
  var cache = {};

  /** 缓存包装：make() 返回 Graphics，自动 generateTexture + destroy */
  function cached(key, make) {
    if (cache[key]) { return cache[key]; }
    var g = make();
    var tex = renderer.generateTexture(g);
    g.destroy();
    cache[key] = tex;
    return tex;
  }

  /** 圆角面板（程序化 UI 的基础件，皮肤缺帧时的回退） */
  function panel(w, h, color, alpha, radius) {
    var a = alpha === undefined ? 1 : alpha;
    var r = radius === undefined ? 16 : radius;
    return cached('p:' + w + ':' + h + ':' + color + ':' + a + ':' + r, function () {
      var g = new PIXI.Graphics();
      g.beginFill(color, a);
      g.drawRoundedRect(0, 0, w, h, r);
      g.endFill();
      return g;
    });
  }

  /** 带边框面板 */
  function framedPanel(w, h, color, borderColor, radius) {
    var r = radius === undefined ? 14 : radius;
    return cached('fp:' + w + ':' + h + ':' + color + ':' + borderColor + ':' + r, function () {
      var g = new PIXI.Graphics();
      g.lineStyle(4, borderColor, 1);
      g.beginFill(color, 1);
      g.drawRoundedRect(2, 2, w - 4, h - 4, r);
      g.endFill();
      return g;
    });
  }

  /** 实心圆（红点等） */
  function circle(radius, color, alpha) {
    var a = alpha === undefined ? 1 : alpha;
    return cached('c:' + radius + ':' + color + ':' + a, function () {
      var g = new PIXI.Graphics();
      g.beginFill(color, a);
      g.drawCircle(radius, radius, radius);
      g.endFill();
      return g;
    });
  }

  /** 圆环（描边圆：爆炸扩散、CD 按钮外圈） */
  function ring(radius, color, thickness) {
    var t = thickness === undefined ? 3 : thickness;
    return cached('r:' + radius + ':' + color + ':' + t, function () {
      var g = new PIXI.Graphics();
      g.lineStyle(t, color, 1);
      g.drawCircle(radius, radius, radius - t / 2);
      return g;
    });
  }

  return {
    cached: cached,
    panel: panel,
    framedPanel: framedPanel,
    circle: circle,
    ring: ring,
    darken: darken,
    lighten: lighten,

    clear: function () {
      for (var k in cache) {
        if (cache[k] && cache[k].destroy) {
          try { cache[k].destroy(true); } catch (e) { /* noop */ }
        }
      }
      cache = {};
    }
  };
}

module.exports = { create: create, darken: darken, lighten: lighten };
