/**
 * Toast — 顶部浮层提示（收编 KR2 tick 淡出版：主循环驱动，可控可测）
 *
 * create(ctx, widgets, opts { stageW, y=160, duration=1800, skin })
 * 返回 { container, show(msg), update(dt) }
 * createGame 装配时 update 自动接入 app.onTick
 */

function create(ctx, widgets, opts) {
  var PIXI = ctx.PIXI;
  opts = opts || {};
  var stageW = opts.stageW;
  var y = opts.y === undefined ? 160 : opts.y;
  var duration = opts.duration || 1800;
  var skin = ctx.theme.resolve('Toast', opts.skin);

  var container = new PIXI.Container();
  container.visible = false;
  container.eventMode = 'none';

  var current = null;   // { node, left }

  function show(msg) {
    if (current) {
      container.removeChild(current.node);
      current.node.destroy({ children: true });
      current = null;
    }
    var t = widgets.label(msg, { size: skin.label.size, color: skin.label.color, bold: skin.label.bold });
    var padX = 28;
    var padY = 14;
    var w = Math.ceil(t.width) + padX * 2;
    var h = Math.ceil(t.height) + padY * 2;
    var node = new PIXI.Container();
    node.addChild(widgets.makeBg(skin.bg, w, h));
    t.x = padX;
    t.y = padY;
    node.addChild(t);
    node.x = Math.round((stageW - w) / 2);
    node.y = y;
    container.addChild(node);
    container.visible = true;
    container.alpha = 1;
    current = { node: node, left: duration };
  }

  function update(dt) {
    if (!current) { return; }
    current.left -= dt;
    if (current.left <= 0) {
      container.alpha -= dt / 240;
      if (container.alpha <= 0) {
        container.removeChild(current.node);
        current.node.destroy({ children: true });
        current = null;
        container.visible = false;
      }
    }
  }

  return { container: container, show: show, update: update };
}

module.exports = { create: create };
