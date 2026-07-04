/**
 * Camera — 世界相机（收编大航海平滑跟随 + Rich4 手动拖拽/空闲回跟，取并集）
 * 输出场景内的世界像素偏移；不做多 Camera、不做缩放（缩放归 PinchPan 手势）
 *
 * create(mapW, mapH, viewW, viewH, opts)
 *   opts.idleReturnMs  拖拽后静置多久恢复自动跟随，默认 2500
 * 返回 {
 *   focus(x, y)          平滑聚焦世界坐标（强制退出手动模式）
 *   setTarget(x, y)      focus 别名（兼容大航海签名）
 *   snapTo(x, y)         立即定位（场景进入）
 *   dragBy(dx, dy)       手动拖拽（进入 manual 模式）
 *   isManual()
 *   update(dt, idleFocus?)  每帧推进；idleFocus 为空闲回跟点 { x, y }
 *   getOffset() → { x, y }
 *   resize(mapW, mapH, viewW, viewH)
 * }
 */

function create(mapW, mapH, viewW, viewH, opts) {
  opts = opts || {};
  var idleReturnMs = opts.idleReturnMs === undefined ? 2500 : opts.idleReturnMs;

  var current = { x: 0, y: 0 };
  var target = { x: 0, y: 0 };
  var manualUntil = 0;   // 手动模式截止时间戳；0 = 自动跟随

  function clamp(p) {
    p.x = Math.max(0, Math.min(p.x, Math.max(0, mapW - viewW)));
    p.y = Math.max(0, Math.min(p.y, Math.max(0, mapH - viewH)));
  }

  var cam = {
    focus: function (x, y) {
      manualUntil = 0;
      target.x = x - viewW / 2;
      target.y = y - viewH / 2;
      clamp(target);
    },

    snapTo: function (x, y) {
      cam.focus(x, y);
      current.x = target.x;
      current.y = target.y;
    },

    dragBy: function (dx, dy) {
      manualUntil = Date.now() + idleReturnMs;
      current.x -= dx;
      current.y -= dy;
      clamp(current);
      target.x = current.x;
      target.y = current.y;
    },

    isManual: function () {
      return manualUntil > Date.now();
    },

    update: function (dt, idleFocus) {
      if (manualUntil) {
        if (Date.now() < manualUntil) { return; }   // 手动模式：镜头交给玩家
        manualUntil = 0;
        if (idleFocus) { cam.focus(idleFocus.x, idleFocus.y); }
      }
      // 线性插值平滑跟随（每 16ms 约 0.13~0.2 衰减）
      var k = Math.min(1, dt / 90);
      current.x += (target.x - current.x) * Math.min(1, 0.12 + k * 0.1);
      current.y += (target.y - current.y) * Math.min(1, 0.12 + k * 0.1);
      clamp(current);
    },

    getOffset: function () {
      return { x: Math.round(current.x), y: Math.round(current.y) };
    },

    resize: function (mw, mh, vw, vh) {
      mapW = mw;
      mapH = mh;
      viewW = vw;
      viewH = vh;
      clamp(target);
      clamp(current);
    }
  };

  cam.setTarget = cam.focus;
  return cam;
}

module.exports = { create: create };
