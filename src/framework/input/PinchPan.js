/**
 * PinchPan — 单指平移 / 双指缩放 / 点击 手势插件（收编 CnC2 RTS 手势的距离/中心点计算）
 * 插件式：不进 core 默认；与 Camera.dragBy 组合（onPan 里转发即可）
 *
 * create(node, handlers) → { reset, destroy }
 *   node：覆盖视口的交互层（需 eventMode/hitArea 已设置）
 *   handlers: {
 *     onPan(dx, dy)                单指拖动增量（stage 坐标）
 *     onPinch(factor, cx, cy)      双指缩放：本次距离比 + 双指中心点
 *     onTap(x, y)                  未移动的快速点击
 *     onLongPress?(x, y)           长按（默认 550ms）
 *     tapPx=12, longPressMs=550
 *   }
 */

function create(node, handlers) {
  handlers = handlers || {};
  var tapPx = handlers.tapPx === undefined ? 12 : handlers.tapPx;
  var longPressMs = handlers.longPressMs === undefined ? 550 : handlers.longPressMs;

  var pointers = {};       // pointerId → { x, y, sx, sy, t }
  var pointerCount = 0;
  var pinchDist = 0;
  var longTimer = null;
  var longFired = false;

  function clearLong() {
    if (longTimer) {
      clearTimeout(longTimer);
      longTimer = null;
    }
  }

  function onDown(ev) {
    var id = ev.data.pointerId;
    var g = ev.data.global;
    pointers[id] = { x: g.x, y: g.y, sx: g.x, sy: g.y, t: Date.now() };
    pointerCount++;
    longFired = false;

    if (pointerCount === 2) {
      var ids = Object.keys(pointers);
      var a = pointers[ids[0]];
      var b = pointers[ids[1]];
      pinchDist = Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
      clearLong();
      return;
    }
    if (handlers.onLongPress) {
      clearLong();
      longTimer = setTimeout(function () {
        longFired = true;
        var p = pointers[id];
        if (p) { handlers.onLongPress(p.x, p.y); }
      }, longPressMs);
    }
  }

  function onMove(ev) {
    var id = ev.data.pointerId;
    var p = pointers[id];
    if (!p) { return; }
    var g = ev.data.global;
    var dx = g.x - p.x;
    var dy = g.y - p.y;
    p.x = g.x;
    p.y = g.y;

    var movedFromStart = Math.sqrt((g.x - p.sx) * (g.x - p.sx) + (g.y - p.sy) * (g.y - p.sy));
    if (movedFromStart > tapPx) { clearLong(); }

    if (pointerCount >= 2) {
      var ids = Object.keys(pointers);
      var a = pointers[ids[0]];
      var b = pointers[ids[1]];
      var d = Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
      if (pinchDist > 0 && handlers.onPinch) {
        handlers.onPinch(d / pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      pinchDist = d;
      return;
    }
    if (handlers.onPan && movedFromStart > tapPx) {
      handlers.onPan(dx, dy);
    }
  }

  function onUp(ev) {
    var id = ev.data.pointerId;
    var p = pointers[id];
    if (!p) { return; }
    var g = ev.data.global;
    delete pointers[id];
    pointerCount = Math.max(0, pointerCount - 1);
    clearLong();
    if (pointerCount > 0) { return; }
    pinchDist = 0;

    var moved = Math.sqrt((g.x - p.sx) * (g.x - p.sx) + (g.y - p.sy) * (g.y - p.sy)) > tapPx;
    var dur = Date.now() - p.t;
    if (!moved && !longFired && dur < longPressMs && handlers.onTap) {
      handlers.onTap(g.x, g.y);
    }
  }

  node.on('pointerdown', onDown);
  node.on('pointermove', onMove);
  node.on('pointerup', onUp);
  node.on('pointerupoutside', onUp);

  return {
    reset: function () {
      pointers = {};
      pointerCount = 0;
      pinchDist = 0;
      clearLong();
    },

    destroy: function () {
      this.reset();
      if (node.off) {
        node.off('pointerdown', onDown);
        node.off('pointermove', onMove);
        node.off('pointerup', onUp);
        node.off('pointerupoutside', onUp);
      }
    }
  };
}

module.exports = { create: create };
