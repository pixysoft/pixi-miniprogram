/**
 * legacy — 旧 widgets.js（现网 161 行标准版）签名兼容层
 * 存量场景把 `Widgets.create(PIXI, TF)` 改为 `framework.ui.legacy(uiCtx)` 即完成迁移，
 * 返回签名与旧版完全一致：text / button / progressBar / redDot / currency /
 * modalMask / scroller
 */

var widgetsMod = require('./widgets.js');

function create(ctx) {
  var w = widgetsMod.create(ctx);
  var PIXI = ctx.PIXI;

  return {
    /** text(str, size, color, bold) — 旧位置参数签名 */
    text: function (str, size, color, bold) {
      return w.label(str, { size: size, color: color, bold: bold });
    },

    /** button(label, w, h, color, onTap, fontSize) — color 转皮肤覆盖 */
    button: function (label, bw, bh, color, onTap, fontSize) {
      return w.button(label, bw, bh, {
        skin: color === undefined ? null : { bg: { color: color, radius: 0.28 } },
        onTap: onTap,
        fontSize: fontSize
      });
    },

    /** progressBar(w, h, fgColor, bgColor) */
    progressBar: function (pw, ph, fgColor, bgColor) {
      return w.progressBar(pw, ph, {
        skin: {
          fill: fgColor === undefined ? undefined : { color: fgColor, radius: 0.5 },
          bg: bgColor === undefined ? undefined : { color: bgColor, radius: 0.5 }
        }
      });
    },

    redDot: function (size) { return w.redDot(size); },

    /** currency(type, w) — type 为帧名（无图集时无 icon，仅数字） */
    currency: function (type, cw) { return w.currency(type, cw); },

    modalMask: function (mw, mh, onTap) { return w.modalMask(mw, mh, onTap); },

    /**
     * scroller(hit, content, viewTop, viewH, getContentH) — 旧简版拖拽滚动
     * （无惯性，与旧实现行为一致；新代码请使用 ui.scrollView）
     */
    scroller: function (hit, content, viewTop, viewH, getContentH) {
      var dragging = false;
      var lastY = 0;
      function clamp() {
        var maxScroll = Math.max(0, getContentH() - viewH);
        content.y = Math.min(viewTop, Math.max(viewTop - maxScroll, content.y));
      }
      hit.on('pointerdown', function (ev) {
        dragging = true;
        lastY = ev.data.global.y;
      });
      hit.on('pointermove', function (ev) {
        if (!dragging) { return; }
        content.y += ev.data.global.y - lastY;
        lastY = ev.data.global.y;
        clamp();
      });
      function end() { dragging = false; }
      hit.on('pointerup', end);
      hit.on('pointerupoutside', end);
      return {
        refresh: function () {
          content.y = viewTop;
          clamp();
        }
      };
    }
  };
}

module.exports = { create: create };
