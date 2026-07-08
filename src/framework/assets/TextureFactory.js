/**
 * TextureFactory — 游戏级程序化纹理工厂（3.1 收编现网 12 份 TextureFactory 并集）
 *
 * 团队核心约定：「素材未就绪不阻塞玩法」——任何形状按 key 缓存一次生成，
 * 远程素材加载成功后按同名 key 替换即可。
 *
 * create(PIXI, renderer, tc?) → 工厂实例
 *   tc 可选：传入 TextureCache 实例共享同一缓存池（createGame 内部即如此）；
 *   缺省自建缓存。
 *
 * 形状清单（参数顺序对齐现网 TextureFactory 习惯：颜色在前）：
 *   circle(color, r, borderColor?)     圆（玩家/怪物/子弹兜底）
 *   ring(color, r, thickness?)         圆环（摇杆底盘/力场圈/CD 圈）
 *   rect(color, w, h)                  矩形条（血条/经验条）
 *   roundRect(color, w, h, radius?)    圆角矩形（面板/按钮）
 *   diamond(color, r)                  菱形（经验宝石/标记）
 *   triangle(color, size)              三角（朝向指示/箭头）
 *   star(color, px, bgAlpha?)          五角星（评级/收藏）
 *   tile(color, size, lineAlpha?)      方形地砖（可带网格描边）
 *   isoTile(color, w, h, lineAlpha?)   等距菱形地砖（SimCity/Hospital 系）
 *   joystick(kind, size)               摇杆兜底皮肤：kind = 'base' | 'knob'
 *   bake(key, draw)                    自定义：draw(g) 画 Graphics，按 key 缓存
 *
 * 兼容层：panel / framedPanel 与 TextureCache 同签名（分享缓存时直接转发）。
 */

var TextureCacheMod = require('./TextureCache.js');

function create(PIXI, renderer, tc) {
  var cache = tc || TextureCacheMod.create(PIXI, renderer);

  /** 自定义形状：draw(g) 绘制，按 key 缓存（generateTexture 一次） */
  function bake(key, draw) {
    return cache.cached('tf:' + key, function () {
      var g = new PIXI.Graphics();
      draw(g);
      return g;
    });
  }

  function circle(color, r, borderColor) {
    return bake('c:' + color + ':' + r + ':' + (borderColor === undefined ? '' : borderColor), function (g) {
      if (borderColor !== undefined) {
        g.beginFill(borderColor);
        g.drawCircle(r + 2, r + 2, r + 2);
        g.endFill();
      }
      g.beginFill(color);
      g.drawCircle(r + 2, r + 2, r);
      g.endFill();
    });
  }

  function ring(color, r, thickness) {
    var t = thickness === undefined ? 6 : thickness;
    return bake('ring:' + color + ':' + r + ':' + t, function (g) {
      g.lineStyle(t, color, 1);
      g.drawCircle(r + t, r + t, r);
    });
  }

  function rect(color, w, h) {
    return bake('r:' + color + ':' + w + 'x' + h, function (g) {
      g.beginFill(color);
      g.drawRect(0, 0, w, h);
      g.endFill();
    });
  }

  function roundRect(color, w, h, radius) {
    var rd = radius === undefined ? 12 : radius;
    return bake('rr:' + color + ':' + w + 'x' + h + ':' + rd, function (g) {
      g.beginFill(color);
      g.drawRoundedRect(0, 0, w, h, rd);
      g.endFill();
    });
  }

  function diamond(color, r) {
    return bake('d:' + color + ':' + r, function (g) {
      g.beginFill(color);
      g.moveTo(r, 0);
      g.lineTo(r * 2, r);
      g.lineTo(r, r * 2);
      g.lineTo(0, r);
      g.closePath();
      g.endFill();
    });
  }

  function triangle(color, size) {
    return bake('t:' + color + ':' + size, function (g) {
      g.beginFill(color);
      g.moveTo(size, size * 0.5);
      g.lineTo(0, 0);
      g.lineTo(0, size);
      g.closePath();
      g.endFill();
    });
  }

  function star(color, px, bgAlpha) {
    px = px || 28;
    return bake('s:' + color + ':' + px + ':' + (bgAlpha || 0), function (g) {
      var cx = px / 2;
      var cy = px / 2;
      var outer = px / 2;
      var inner = outer * 0.45;
      var pts = [];
      for (var i = 0; i < 10; i++) {
        var ang = -Math.PI / 2 + i * Math.PI / 5;
        var rad = i % 2 === 0 ? outer : inner;
        pts.push(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
      }
      if (bgAlpha) {
        g.beginFill(0x1A1A1A, bgAlpha);
        g.drawCircle(cx, cy, outer);
        g.endFill();
      }
      g.beginFill(color);
      g.drawPolygon(pts);
      g.endFill();
    });
  }

  /** 方形地砖：lineAlpha > 0 时带 1px 网格描边 */
  function tile(color, size, lineAlpha) {
    return bake('tile:' + color + ':' + size + ':' + (lineAlpha || 0), function (g) {
      if (lineAlpha) { g.lineStyle(1, 0x000000, lineAlpha); }
      g.beginFill(color, 1);
      g.drawRect(0, 0, size, size);
      g.endFill();
    });
  }

  /** 等距菱形地砖（锚点习惯：sprite.anchor.set(0.5) 后中心对格心） */
  function isoTile(color, w, h, lineAlpha) {
    return bake('iso:' + color + ':' + w + 'x' + h + ':' + (lineAlpha || 0), function (g) {
      if (lineAlpha) { g.lineStyle(1, 0x000000, lineAlpha); }
      g.beginFill(color, 1);
      g.moveTo(w / 2, 0);
      g.lineTo(w, h / 2);
      g.lineTo(w / 2, h);
      g.lineTo(0, h / 2);
      g.closePath();
      g.endFill();
    });
  }

  /** 摇杆兜底皮肤：base = 半透明圆环底盘 / knob = 实心圆杆头 */
  function joystick(kind, size) {
    var r = Math.floor(size / 2);
    if (kind === 'knob') {
      return bake('joyk:' + size, function (g) {
        g.beginFill(0xFFFFFF, 0.85);
        g.drawCircle(r, r, r);
        g.endFill();
        g.beginFill(0xD8DEE9, 1);
        g.drawCircle(r, r, r * 0.6);
        g.endFill();
      });
    }
    return bake('joyb:' + size, function (g) {
      g.beginFill(0xFFFFFF, 0.12);
      g.drawCircle(r, r, r);
      g.endFill();
      g.lineStyle(4, 0xFFFFFF, 0.5);
      g.drawCircle(r, r, r - 2);
    });
  }

  return {
    bake: bake,
    circle: circle,
    ring: ring,
    rect: rect,
    roundRect: roundRect,
    diamond: diamond,
    triangle: triangle,
    star: star,
    tile: tile,
    isoTile: isoTile,
    joystick: joystick,

    // TextureCache 兼容转发（同一缓存池）
    panel: cache.panel,
    framedPanel: cache.framedPanel,
    cached: cache.cached,
    darken: cache.darken,
    lighten: cache.lighten,

    clear: function () {
      if (!tc) { cache.clear(); }   // 共享缓存时由持有方统一清
    }
  };
}

module.exports = { create: create };
