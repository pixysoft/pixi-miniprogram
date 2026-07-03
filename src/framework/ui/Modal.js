/**
 * Modal — 模态弹窗：遮罩(吞触摸) + 九宫格面板 + 标题 + 关闭按钮 + body 容器
 *
 * create(ctx, widgets, opts)
 *   opts: { w, h, stageW, stageH, title, skin, closable=true, onClose, maskClose=false }
 * 返回 container（初始 hidden），挂 { body, open(), close(), setTitle(str) }
 */

function create(ctx, widgets, opts) {
  var PIXI = ctx.PIXI;
  var theme = ctx.theme;
  opts = opts || {};
  var W = opts.w;
  var H = opts.h;
  var stageW = opts.stageW;
  var stageH = opts.stageH;
  var skin = theme.resolve('Modal', opts.skin);

  var c = new PIXI.Container();
  c.visible = false;

  var mask = widgets.modalMask(stageW, stageH, opts.maskClose ? doClose : null);
  c.addChild(mask);

  var panel = new PIXI.Container();
  panel.x = Math.round((stageW - W) / 2);
  panel.y = Math.round((stageH - H) / 2);
  // 面板自身吞掉触摸，避免点击面板穿透到遮罩
  panel.eventMode = 'static';
  panel.hitArea = new PIXI.Rectangle(0, 0, W, H);
  c.addChild(panel);

  panel.addChild(widgets.makeBg(skin.bg, W, H));

  var titleText = widgets.label(opts.title || '', {
    size: skin.title.size, color: skin.title.color, bold: skin.title.bold
  });
  titleText.x = 24;
  titleText.y = 20;
  panel.addChild(titleText);

  if (opts.closable !== false) {
    var closeBtn = widgets.button('×', 64, 64, {
      skin: { bg: { color: skin.close.color !== undefined ? skin.close.color : 0xE05B4B, radius: 0.5 } },
      onTap: doClose,
      fontSize: 40
    });
    closeBtn.x = W - 76;
    closeBtn.y = 12;
    panel.addChild(closeBtn);
  }

  var body = new PIXI.Container();
  body.y = 88;
  body.x = 24;
  panel.addChild(body);

  function doClose() {
    c.visible = false;
    if (opts.onClose) { opts.onClose(); }
  }

  c.body = body;
  c.bodyWidth = W - 48;
  c.bodyHeight = H - 112;

  c.open = function () { c.visible = true; };
  c.close = doClose;
  c.setTitle = function (s) { titleText.text = s; };

  return c;
}

module.exports = { create: create };
