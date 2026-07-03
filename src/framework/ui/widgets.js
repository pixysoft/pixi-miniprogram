/**
 * widgets — 皮肤化基础组件：label / panel / nineSlice / button / progressBar /
 *           redDot / currency / modalMask
 * 全部返回 PIXI.Container/Sprite 并挂操作方法；调用方负责定位（与现网约定一致）
 *
 * create(ctx)  ctx = { PIXI, tc(TextureCache), assets(AssetManager|null), theme(Theme) }
 */

var Widget = require('./Widget.js');
var ThemeMod = require('./Theme.js');

function create(ctx) {
  var PIXI = ctx.PIXI;
  var tc = ctx.tc;
  var assets = ctx.assets;
  var theme = ctx.theme;

  function resolveRadius(radius, h) {
    if (radius === undefined) { return 12; }
    return radius < 1 ? Math.round(h * radius) : radius;
  }

  /**
   * 皮肤背景构建（回退链核心）：
   *   frame 可用 → 九宫格(有 slice) / 拉伸 Sprite
   *   否则     → 程序化圆角 panel
   */
  function makeBg(cfg, w, h) {
    cfg = cfg || {};
    if (cfg.frame && assets && assets.has(cfg.frame)) {
      var tex = assets.texture(cfg.frame);
      var slice = cfg.slice || assets.slice(cfg.frame);
      if (slice) {
        var nine = new PIXI.NineSlicePlane(tex, slice[0], slice[1], slice[2], slice[3]);
        nine.width = w;
        nine.height = h;
        return nine;
      }
      var sp = new PIXI.Sprite(tex);
      sp.width = w;
      sp.height = h;
      return sp;
    }
    var color = cfg.color === undefined ? 0x14171F : cfg.color;
    return new PIXI.Sprite(tc.panel(w, h, color, cfg.alpha, resolveRadius(cfg.radius, h)));
  }

  /** 九宫格图（皮肤帧直用；无帧时回退 panel） */
  function nineSlice(frameName, w, h, sliceOverride) {
    return makeBg({ frame: frameName, slice: sliceOverride }, w, h);
  }

  /** 文本（皮肤 Label 键为默认样式） */
  function label(str, opts) {
    opts = opts || {};
    var skin = theme.get('Label');
    var t = new PIXI.Text(str, {
      fontSize: opts.size || skin.size || 26,
      fill: opts.color === undefined ? (skin.color === undefined ? 0xFFFFFF : skin.color) : opts.color,
      fontWeight: (opts.bold === undefined ? skin.bold : opts.bold) ? 'bold' : 'normal',
      wordWrap: !!opts.wrapWidth,
      wordWrapWidth: opts.wrapWidth || 0,
      align: opts.align || 'left'
    });
    return t;
  }

  /** 面板容器：九宫格/程序化背景 + 子件自由摆放 */
  function panel(w, h, opts) {
    opts = opts || {};
    var skin = theme.resolve('Panel', opts.skin);
    var c = new PIXI.Container();
    c.addChild(makeBg(skin.bg, w, h));
    c.panelWidth = w;
    c.panelHeight = h;
    return c;
  }

  /**
   * 按钮：三态皮肤（up 基态 / down / disabled）
   * button(labelStr, w, h, opts { skin, onTap, fontSize, moveCancelPx })
   * 挂 setLabel / setEnabled / cancelPress
   */
  function button(labelStr, w, h, opts) {
    opts = opts || {};
    var skin = theme.resolve('Button', opts.skin);
    var c = new PIXI.Container();

    var bgHolder = new PIXI.Container();
    c.addChild(bgHolder);
    var bgs = { up: makeBg(skin.bg, w, h) };
    bgHolder.addChild(bgs.up);

    var states = skin.states || {};
    // 预构建有独立帧的状态背景（隐藏备用），无帧状态走属性回退
    ['down', 'disabled'].forEach(function (s) {
      if (states[s] && states[s].bg) {
        bgs[s] = makeBg(ThemeMod.merge(skin.bg || {}, states[s].bg), w, h);
        bgs[s].visible = false;
        bgHolder.addChild(bgs[s]);
      }
    });

    var fontSize = opts.fontSize || skin.label.size || Math.round(h * 0.42);
    var t = label(labelStr, { size: fontSize, color: skin.label.color, bold: skin.label.bold });
    c.addChild(t);
    function centerLabel() {
      t.x = Math.round((w - t.width) / 2);
      t.y = Math.round((h - t.height) / 2);
    }
    centerLabel();

    c.hitArea = new PIXI.Rectangle(0, 0, w, h);

    function applyState(state) {
      // 背景帧切换
      for (var k in bgs) { bgs[k].visible = false; }
      (bgs[state] || bgs.up).visible = true;
      // 属性回退/覆盖：down 无独立帧时回退 scale 0.95（cocos zoomScale 思路）
      var cfg = states[state] || {};
      c.alpha = cfg.alpha !== undefined ? cfg.alpha : 1;
      var scale = cfg.scale;
      if (scale === undefined) {
        scale = (state === 'down' && !bgs.down) ? 0.95 : 1;
      }
      c.scale.set(scale);
    }

    Widget.makePressable(c, {
      onTap: opts.onTap,
      moveCancelPx: opts.moveCancelPx,
      onStateChange: applyState
    });

    c.setLabel = function (s) {
      t.text = s;
      centerLabel();
    };

    return c;
  }

  /** 进度条：setRatio(0..1) / setText(str) */
  function progressBar(w, h, opts) {
    opts = opts || {};
    var skin = theme.resolve('ProgressBar', opts.skin);
    var c = new PIXI.Container();
    c.addChild(makeBg(skin.bg, w, h));
    var fill = makeBg(skin.fill, w, h);
    fill.scale.x = 0;
    c.addChild(fill);
    var t = label('', { size: skin.label.size || Math.round(h * 0.7), color: skin.label.color, bold: skin.label.bold });
    c.addChild(t);
    c.setRatio = function (r) {
      fill.scale.x = Math.max(0, Math.min(1, r));
    };
    c.setText = function (s) {
      t.text = s;
      t.x = Math.round((w - t.width) / 2);
      t.y = Math.round((h - t.height) / 2);
    };
    return c;
  }

  /** 红点 */
  function redDot(size) {
    var skin = theme.get('RedDot');
    var s = size || 18;
    return new PIXI.Sprite(tc.circle(s / 2, skin.color === undefined ? 0xE05B4B : skin.color));
  }

  /** 货币胶囊：icon(帧名或纹理) + 数字；setValue(n) */
  function currency(icon, w, opts) {
    opts = opts || {};
    var skin = theme.resolve('Currency', opts.skin);
    var h = opts.h || 44;
    var c = new PIXI.Container();
    c.addChild(makeBg(skin.bg, w, h));
    var iconTex = null;
    if (typeof icon === 'string' && assets && assets.has(icon)) {
      iconTex = assets.texture(icon);
    } else if (icon && icon.baseTexture) {
      iconTex = icon;
    }
    if (iconTex) {
      var ic = new PIXI.Sprite(iconTex);
      var iconSize = h - 10;
      ic.width = iconSize;
      ic.height = iconSize;
      ic.x = 6;
      ic.y = 5;
      c.addChild(ic);
    }
    var t = label('0', { size: skin.label.size, color: skin.label.color, bold: skin.label.bold });
    t.x = h + 2;
    t.y = Math.round((h - t.height) / 2);
    c.addChild(t);
    c.setValue = function (n) { t.text = String(n); };
    return c;
  }

  /** 模态遮罩（吞噬触摸；onTap 可选） */
  function modalMask(w, h, onTap) {
    var skin = theme.get('Modal');
    var m = new PIXI.Sprite(tc.panel(w, h,
      skin.mask.color === undefined ? 0x000000 : skin.mask.color,
      skin.mask.alpha === undefined ? 0.6 : skin.mask.alpha, 0));
    m.eventMode = 'static';
    m.on('pointerdown', function (ev) {
      if (ev.stopPropagation) { ev.stopPropagation(); }
      if (onTap) { onTap(); }
    });
    return m;
  }

  return {
    makeBg: makeBg,
    nineSlice: nineSlice,
    label: label,
    panel: panel,
    button: button,
    progressBar: progressBar,
    redDot: redDot,
    currency: currency,
    modalMask: modalMask
  };
}

module.exports = { create: create };
