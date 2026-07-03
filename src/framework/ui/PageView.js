/**
 * PageView — 水平磁吸翻页容器（水平 ScrollView + snapInterval 磁吸，手感对齐 cocos PageView）
 *
 * create(ctx, opts) → container（基于 ScrollView），追加挂 {
 *   addPage(node)            按页宽依次排列
 *   setPageCount(n)          直接设内容宽（页由调用方摆放时用）
 *   goTo(index, animated?)   翻到第 index 页
 *   pageIndex()
 * }
 *   opts: { w, h, pageW=w, onPage(index) }
 * 需每帧 update(dt)（createGame ui.pageView 自动接入）
 */

var ScrollView = require('./ScrollView.js');

function create(ctx, opts) {
  opts = opts || {};
  var pageW = opts.pageW || opts.w;
  var pageIdx = 0;

  var sv = ScrollView.create(ctx, {
    w: opts.w,
    h: opts.h,
    direction: 'x',
    snapInterval: pageW,
    onSnap: function (idx) {
      pageIdx = idx;
      if (opts.onPage) { opts.onPage(idx); }
    }
  });

  var pages = 0;

  sv.addPage = function (node) {
    node.x = pages * pageW;
    sv.content.addChild(node);
    pages++;
    sv.setContentWidth(pages * pageW);
    return node;
  };

  sv.setPageCount = function (n) {
    pages = n;
    sv.setContentWidth(n * pageW);
  };

  sv.goTo = function (index, animated) {
    sv.snapTo(index, animated);
  };

  sv.pageIndex = function () { return pageIdx; };

  return sv;
}

module.exports = { create: create };
