/**
 * Layout — 单层锚点布局（借鉴 Egret BasicLayout 定位优先级，去掉 Validator 队列）
 * 不做布局树求解；一次性计算 + relayout() 手动触发
 *
 * apply(node, spec, bounds)
 *   spec: { left, right, top, bottom, centerX, centerY, w, h }
 *     - 水平优先级 centerX > left > right；left+right 同给且无 w → 拉伸
 *     - 垂直同理 centerY > top > bottom
 *     - w/h：>1 绝对像素；<=1 视为 bounds 的比例（百分比只支持 w/h）
 *   bounds: { w, h }（如 { w: game.W, h: game.H } 或父面板尺寸）
 *
 * attach(node, spec, bounds)
 *   apply 并在 node 上挂 relayout(newBounds?)（bounds 变化后手动触发）
 */

function resolveSize(v, base) {
  if (v === undefined || v === null) { return null; }
  return v <= 1 ? Math.round(base * v) : v;
}

function apply(node, spec, bounds) {
  spec = spec || {};
  var bw = bounds.w !== undefined ? bounds.w : bounds.width;
  var bh = bounds.h !== undefined ? bounds.h : bounds.height;

  var w = resolveSize(spec.w, bw);
  var h = resolveSize(spec.h, bh);
  if (w !== null) { node.width = w; }
  if (h !== null) { node.height = h; }

  // 水平：left+right 拉伸 > centerX > left > right
  if (spec.left !== undefined && spec.right !== undefined && w === null) {
    node.width = bw - spec.left - spec.right;
    node.x = spec.left;
  } else if (spec.centerX !== undefined) {
    node.x = Math.round((bw - node.width) / 2) + spec.centerX;
  } else if (spec.left !== undefined) {
    node.x = spec.left;
  } else if (spec.right !== undefined) {
    node.x = bw - spec.right - node.width;
  }

  // 垂直：top+bottom 拉伸 > centerY > top > bottom
  if (spec.top !== undefined && spec.bottom !== undefined && h === null) {
    node.height = bh - spec.top - spec.bottom;
    node.y = spec.top;
  } else if (spec.centerY !== undefined) {
    node.y = Math.round((bh - node.height) / 2) + spec.centerY;
  } else if (spec.top !== undefined) {
    node.y = spec.top;
  } else if (spec.bottom !== undefined) {
    node.y = bh - spec.bottom - node.height;
  }

  return node;
}

function attach(node, spec, bounds) {
  var cur = bounds;
  node.relayout = function (newBounds) {
    if (newBounds) { cur = newBounds; }
    apply(node, spec, cur);
  };
  return apply(node, spec, cur);
}

module.exports = { apply: apply, attach: attach };
