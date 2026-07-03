/**
 * TabBar — 皮肤化标签栏（收编大航海 Game.js buildNav 手写按钮网格，改为选中态切换不重建）
 * 皮肤键 TabBar：{ bg, item: { bg, label }, active: { bg } }
 *
 * create(ctx, widgets, opts) → container，挂 { select(key), selected() }
 *   opts: { items: [{ key, label }], w, h, padX=20, gap=10, onSelect(key), skin }
 * onSelect 只在切换时触发（当前项重复点击不触发）
 */

var ThemeMod = require('./Theme.js');

function create(ctx, widgets, opts) {
  var PIXI = ctx.PIXI;
  opts = opts || {};
  var items = opts.items || [];
  var W = opts.w;
  var H = opts.h;
  var padX = opts.padX === undefined ? 20 : opts.padX;
  var gap = opts.gap === undefined ? 10 : opts.gap;
  var skin = ctx.theme.resolve('TabBar', opts.skin);

  var c = new PIXI.Container();
  c.addChild(widgets.makeBg(skin.bg, W, H));

  var current = null;
  var buttons = {};    // key → { btn, bgs }

  var bw = (W - padX * 2) / Math.max(1, items.length);
  var btnW = bw - gap;
  var btnH = H - 28;

  items.forEach(function (def, idx) {
    var btn = widgets.button(def.label, btnW, btnH, {
      skin: {
        bg: skin.item.bg,
        label: skin.item.label
      },
      onTap: function () {
        if (def.key === current) { return; }
        api.select(def.key);
        if (opts.onSelect) { opts.onSelect(def.key); }
      }
    });
    btn.x = padX + idx * bw + gap / 2;
    btn.y = 14;
    c.addChild(btn);

    // 选中态背景（active.bg 合并 item.bg），叠在按钮 up 帧之上按需显隐
    var activeBg = widgets.makeBg(ThemeMod.merge(skin.item.bg || {}, (skin.active && skin.active.bg) || {}), btnW, btnH);
    activeBg.visible = false;
    activeBg.eventMode = 'none';
    btn.addChildAt(activeBg, 1);   // 0 为按钮自身 bgHolder，1 盖在其上、label 之下

    buttons[def.key] = { btn: btn, activeBg: activeBg };
  });

  var api = c;

  c.select = function (key) {
    if (!buttons[key]) { return; }
    current = key;
    for (var k in buttons) {
      buttons[k].activeBg.visible = (k === key);
    }
  };

  c.selected = function () { return current; };

  if (items.length) { c.select(items[0].key); }

  return c;
}

module.exports = { create: create };
