/**
 * Slider — 水平滑杆（收编 SimCity slider + 大航海数量滑杆需求）
 * 轨道点击直达 + thumb 拖拽；支持 min/max/step
 *
 * create(ctx, widgets, opts)
 *   opts: { w, h=44, min=0, max=100, step=1, value, skin, onChange(v) }
 * 返回 container，挂 { setValue(v), getValue() }
 */

function create(ctx, widgets, opts) {
  var PIXI = ctx.PIXI;
  var tc = ctx.tc;
  var theme = ctx.theme;
  opts = opts || {};
  var W = opts.w;
  var H = opts.h || 44;
  var min = opts.min === undefined ? 0 : opts.min;
  var max = opts.max === undefined ? 100 : opts.max;
  var step = opts.step || 1;
  var value = opts.value === undefined ? min : opts.value;

  var skin = theme.resolve('Slider', opts.skin);
  var thumbSize = H + 12;

  var c = new PIXI.Container();
  c.eventMode = 'static';
  // thumb 超出轨道上下沿，热区放大
  c.hitArea = new PIXI.Rectangle(-thumbSize / 2, -8, W + thumbSize, H + 16);

  var trackH = Math.round(H * 0.45);
  var trackY = Math.round((H - trackH) / 2);
  var track = widgets.makeBg(skin.track, W, trackH);
  track.y = trackY;
  c.addChild(track);

  var fill = widgets.makeBg(skin.fill, W, trackH);
  fill.y = trackY;
  fill.scale.x = 0;
  c.addChild(fill);

  var thumb;
  if (skin.thumb && skin.thumb.frame && ctx.assets && ctx.assets.has(skin.thumb.frame)) {
    thumb = new PIXI.Sprite(ctx.assets.texture(skin.thumb.frame));
    thumb.width = thumbSize;
    thumb.height = thumbSize;
  } else {
    thumb = new PIXI.Sprite(tc.circle(thumbSize / 2,
      skin.thumb && skin.thumb.color !== undefined ? skin.thumb.color : 0xFFFFFF));
  }
  thumb.anchor.set(0.5);
  thumb.y = H / 2;
  c.addChild(thumb);

  function ratio() {
    return max === min ? 0 : (value - min) / (max - min);
  }

  function layout() {
    var r = ratio();
    fill.scale.x = r;
    thumb.x = r * W;
  }

  function snap(v) {
    v = Math.max(min, Math.min(max, v));
    return min + Math.round((v - min) / step) * step;
  }

  function setFromGlobalX(gx) {
    var local = c.toLocal({ x: gx, y: 0 });
    var v = snap(min + (local.x / W) * (max - min));
    if (v !== value) {
      value = v;
      layout();
      if (opts.onChange) { opts.onChange(value); }
    }
  }

  var dragging = false;
  c.on('pointerdown', function (ev) {
    dragging = true;
    setFromGlobalX(ev.data.global.x);
  });
  c.on('pointermove', function (ev) {
    if (dragging) { setFromGlobalX(ev.data.global.x); }
  });
  function end() { dragging = false; }
  c.on('pointerup', end);
  c.on('pointerupoutside', end);

  c.setValue = function (v) {
    value = snap(v);
    layout();
  };
  c.getValue = function () { return value; };

  layout();
  return c;
}

module.exports = { create: create };
