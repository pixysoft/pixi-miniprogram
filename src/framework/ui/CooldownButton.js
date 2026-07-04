/**
 * CooldownButton — 圆形径向 CD 按钮（收编 KR2 widgets.skillButton，皮肤化）
 * 皮肤键 CooldownButton：{ bg, rim: { color, active }, mask, label }
 *
 * create(ctx, widgets, opts { radius, icon?, onTap, skin })
 *   icon：图集帧名或 Texture（可空）
 * 返回 container，挂 {
 *   setCooldown(ratio, secLeft?)   ratio 0..1（1=刚用完）；>0 置灰 + 扇形遮罩
 *   setActive(on)                  外圈高亮（技能就绪/选中）
 *   getCooldown()
 * }
 */

var Widget = require('./Widget.js');

function create(ctx, widgets, opts) {
  var PIXI = ctx.PIXI;
  var tc = ctx.tc;
  var assets = ctx.assets;
  opts = opts || {};
  var radius = opts.radius || 60;
  var skin = ctx.theme.resolve('CooldownButton', opts.skin);

  var c = new PIXI.Container();

  var bg = new PIXI.Sprite(tc.circle(radius, skin.bg.color));
  bg.x = -radius;
  bg.y = -radius;
  c.addChild(bg);

  var rim = new PIXI.Sprite(tc.ring(radius, skin.rim.color, 3));
  rim.x = -radius;
  rim.y = -radius;
  c.addChild(rim);

  var ic = null;
  var iconTex = null;
  if (typeof opts.icon === 'string' && assets && assets.has(opts.icon)) {
    iconTex = assets.texture(opts.icon);
  } else if (opts.icon && opts.icon.baseTexture) {
    iconTex = opts.icon;
  }
  if (iconTex) {
    ic = new PIXI.Sprite(iconTex);
    var size = radius * 1.1;
    ic.width = size;
    ic.height = size;
    if (ic.anchor && ic.anchor.set) {
      ic.anchor.set(0.5);
    } else if (ic.pivot) {
      ic.pivot.set(size / 2, size / 2);
    }
    c.addChild(ic);
  }

  // 径向 CD 遮罩：Graphics arc 每次 setCooldown 重绘
  var mask = new PIXI.Graphics();
  c.addChild(mask);

  var cdText = widgets.label('', { size: skin.label.size, color: skin.label.color, bold: skin.label.bold });
  cdText.y = -14;
  c.addChild(cdText);

  c.hitArea = PIXI.Circle
    ? new PIXI.Circle(0, 0, radius + 8)
    : new PIXI.Rectangle(-radius - 8, -radius - 8, (radius + 8) * 2, (radius + 8) * 2);

  var ratio = 0;

  Widget.makePressable(c, {
    onTap: function () {
      if (ratio <= 0 && opts.onTap) { opts.onTap(); }
    }
  });

  c.setCooldown = function (r, secLeft) {
    ratio = r;
    mask.clear();
    if (r > 0) {
      if (ic) { ic.alpha = 0.4; }
      mask.beginFill(skin.mask.color, skin.mask.alpha);
      mask.moveTo(0, 0);
      var start = -Math.PI / 2;
      var end = start + Math.PI * 2 * r;
      mask.arc(0, 0, radius, start, end);
      mask.lineTo(0, 0);
      mask.endFill();
      cdText.text = secLeft > 0 ? String(secLeft) : '';
      cdText.x = -cdText.width / 2;
    } else {
      if (ic) { ic.alpha = 1; }
      cdText.text = '';
    }
  };

  c.setActive = function (on) {
    rim.tint = on ? skin.rim.active : 0xFFFFFF;
  };

  c.getCooldown = function () { return ratio; };

  return c;
}

module.exports = { create: create };
