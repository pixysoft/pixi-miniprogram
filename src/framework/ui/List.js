/**
 * List — 虚拟化列表（EUI DataGroup 可视区渲染思路；cocos ListView 无复用，故取 EUI 方案）
 * 等高 item + 复用池：只创建「可视区 + 2」个 item 实例，滚动时重定位重绑定
 *
 * create(ctx, opts)
 *   opts: { w, h, itemHeight, gap=0,
 *           createItem() → PIXI.Container,       // 创建一个 item（结构）
 *           updateItem(item, index, data) }       // 绑定第 index 条数据
 * 返回 container（基于 ScrollView），挂 { setData(arr), refresh(), scrollTo }
 */

var ScrollView = require('./ScrollView.js');

function create(ctx, opts) {
  var itemHeight = opts.itemHeight;
  var gap = opts.gap || 0;
  var rowH = itemHeight + gap;

  var sv = ScrollView.create(ctx, {
    w: opts.w,
    h: opts.h,
    onScroll: function () { bind(); }
  });

  var data = [];
  var pool = [];        // { node, index }
  var poolSize = Math.ceil(opts.h / rowH) + 2;

  function ensurePool() {
    while (pool.length < poolSize) {
      var node = opts.createItem();
      node.visible = false;
      sv.content.addChild(node);
      pool.push({ node: node, index: -1 });
    }
  }

  function bind() {
    if (!data.length) {
      for (var k = 0; k < pool.length; k++) { pool[k].node.visible = false; pool[k].index = -1; }
      return;
    }
    var top = sv.scrollY();
    var first = Math.max(0, Math.floor(top / rowH));
    var last = Math.min(data.length - 1, first + poolSize - 1);

    // 回收不在可视区的
    var free = [];
    var used = {};
    var i;
    for (i = 0; i < pool.length; i++) {
      var p = pool[i];
      if (p.index < first || p.index > last) {
        p.index = -1;
        p.node.visible = false;
        free.push(p);
      } else {
        used[p.index] = p;
      }
    }
    // 绑定新进入可视区的
    for (i = first; i <= last; i++) {
      var slot = used[i];
      if (!slot) {
        slot = free.pop();
        if (!slot) { break; }
        slot.index = i;
        opts.updateItem(slot.node, i, data[i]);
      }
      slot.node.y = i * rowH;
      slot.node.visible = true;
    }
  }

  sv.setData = function (arr) {
    data = arr || [];
    sv.setContentHeight(data.length * rowH - (data.length ? gap : 0));
    ensurePool();
    // 强制全部重绑定
    for (var i = 0; i < pool.length; i++) { pool[i].index = -1; pool[i].node.visible = false; }
    bind();
  };

  /** 数据内容变化（长度不变）时刷新可视区 */
  var rawRefresh = sv.refresh;
  sv.refresh = function () {
    rawRefresh();
    for (var i = 0; i < pool.length; i++) { pool[i].index = -1; pool[i].node.visible = false; }
    bind();
  };

  return sv;
}

module.exports = { create: create };
