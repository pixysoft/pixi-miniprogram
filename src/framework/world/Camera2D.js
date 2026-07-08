/**
 * Camera2D — 世界容器相机：平移 + 锚点缩放 + 格坐标换算 + 视口查询（3.1 收编 CnC2/SimCity 相机并集）
 *
 * 与 3.0 Camera（偏移输出式、平滑跟随）互补：
 *   Camera   —— 输出偏移量，游戏自己搬 world.x/y，适合跟随镜头，不做缩放
 *   Camera2D —— 直接操纵 world 容器的 position/scale，适合 RTS/SLG 手势镜头
 * 与 PinchPan 组合：onPan → cam.pan(dx, dy)；onPinch → cam.zoomAt(factor, cx, cy)
 *
 * create(world, viewport, worldW, worldH, opts)
 *   world     被操纵的 PIXI.Container
 *   viewport  { x, y, w, h } 屏幕视口（stage 坐标）
 *   worldW/H  世界像素尺寸
 *   opts:
 *     minScale / maxScale     缩放范围；minScale 缺省自适应「地图不小于视口」（可小到 0.45 兜底）
 *     tileSize                格尺寸（启用 toTile/focusTile/visibleTiles）
 *
 * 返回 {
 *   pan(dx, dy)                     增量平移（自动钳制）
 *   zoomAt(factor, sx, sy)          以屏幕点为锚缩放
 *   setScale(s, sx?, sy?)           直接设定缩放（锚点缺省视口中心）
 *   scale()                         当前缩放
 *   focusWorld(wx, wy)              视口中心对准世界像素点
 *   focusTile(gx, gy)               视口中心对准格中心
 *   toWorld(sx, sy) → {x, y}        屏幕 → 世界像素
 *   toTile(sx, sy)  → {x, y}        屏幕 → 格（浮点）
 *   tileToScreen(gx, gy) → {x, y}   格中心 → 屏幕
 *   visibleWorld()  → {x0,y0,x1,y1} 当前可见世界像素范围
 *   visibleTiles()  → {x0,y0,x1,y1} 当前可见格范围（小地图视框用）
 *   resize(viewport, worldW, worldH)
 * }
 */

function create(world, viewport, worldW, worldH, opts) {
  opts = opts || {};
  var TILE = opts.tileSize || 0;
  var maxScale = opts.maxScale === undefined ? 1.6 : opts.maxScale;
  var minScale;

  function computeMinScale() {
    if (opts.minScale !== undefined) { return opts.minScale; }
    // 自适应：整图都可看到，但不小于 0.45 兜底
    return Math.max(viewport.w / worldW, viewport.h / worldH, 0.45);
  }
  minScale = computeMinScale();

  function clamp() {
    var s = world.scale.x;
    var wpx = worldW * s;
    var hpx = worldH * s;
    var minX = viewport.x + viewport.w - wpx;
    var maxX = viewport.x;
    var minY = viewport.y + viewport.h - hpx;
    var maxY = viewport.y;
    // 地图小于视口的轴向：居中
    world.x = wpx <= viewport.w
      ? viewport.x + (viewport.w - wpx) / 2
      : Math.min(maxX, Math.max(minX, world.x));
    world.y = hpx <= viewport.h
      ? viewport.y + (viewport.h - hpx) / 2
      : Math.min(maxY, Math.max(minY, world.y));
  }

  var cam = {
    pan: function (dx, dy) {
      world.x += dx;
      world.y += dy;
      clamp();
    },

    zoomAt: function (factor, sx, sy) {
      var oldS = world.scale.x;
      var newS = Math.min(maxScale, Math.max(minScale, oldS * factor));
      if (newS === oldS) { return; }
      var wx = (sx - world.x) / oldS;
      var wy = (sy - world.y) / oldS;
      world.scale.set(newS);
      world.x = sx - wx * newS;
      world.y = sy - wy * newS;
      clamp();
    },

    setScale: function (s, sx, sy) {
      var anchorX = sx === undefined ? viewport.x + viewport.w / 2 : sx;
      var anchorY = sy === undefined ? viewport.y + viewport.h / 2 : sy;
      var factor = Math.min(maxScale, Math.max(minScale, s)) / world.scale.x;
      cam.zoomAt(factor, anchorX, anchorY);
    },

    scale: function () { return world.scale.x; },

    focusWorld: function (wx, wy) {
      var s = world.scale.x;
      world.x = viewport.x + viewport.w / 2 - wx * s;
      world.y = viewport.y + viewport.h / 2 - wy * s;
      clamp();
    },

    focusTile: function (gx, gy) {
      cam.focusWorld((gx + 0.5) * TILE, (gy + 0.5) * TILE);
    },

    toWorld: function (sx, sy) {
      var s = world.scale.x;
      return { x: (sx - world.x) / s, y: (sy - world.y) / s };
    },

    toTile: function (sx, sy) {
      var w = cam.toWorld(sx, sy);
      return { x: w.x / TILE - 0.5, y: w.y / TILE - 0.5 };
    },

    tileToScreen: function (gx, gy) {
      var s = world.scale.x;
      return {
        x: world.x + (gx + 0.5) * TILE * s,
        y: world.y + (gy + 0.5) * TILE * s
      };
    },

    visibleWorld: function () {
      var s = world.scale.x;
      return {
        x0: (viewport.x - world.x) / s,
        y0: (viewport.y - world.y) / s,
        x1: (viewport.x + viewport.w - world.x) / s,
        y1: (viewport.y + viewport.h - world.y) / s
      };
    },

    visibleTiles: function () {
      var v = cam.visibleWorld();
      return { x0: v.x0 / TILE, y0: v.y0 / TILE, x1: v.x1 / TILE, y1: v.y1 / TILE };
    },

    resize: function (vp, ww, wh) {
      if (vp) { viewport = vp; }
      if (ww) { worldW = ww; }
      if (wh) { worldH = wh; }
      minScale = computeMinScale();
      world.scale.set(Math.min(maxScale, Math.max(minScale, world.scale.x)));
      clamp();
    }
  };

  world.scale.set(Math.min(maxScale, Math.max(minScale, world.scale.x || 1)));
  clamp();
  return cam;
}

module.exports = { create: create };
