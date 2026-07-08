/**
 * Joystick — 浮动式虚拟摇杆（3.1 收编 EggSoldier 向量版 + DAL 热区/方向量化版并集）
 *
 * 触摸点即摇杆中心，拖动出方向，松手隐藏。绑定在覆盖可玩区的交互层
 * （所有可命中对象的共同祖先，事件冒泡到此；UI 按钮 stopPropagation 优先）。
 *
 * create(ctx, surface, opts) → { container, getDir, dir4, dir8, active, setEnabled, reset }
 *   ctx: { PIXI, tf? (TextureFactory，用于兜底皮肤), assets? }
 *   surface: 交互层（eventMode 由本模块置 static）
 *   opts:
 *     radius=120        摇杆半径（逻辑像素）
 *     knobSize=80       杆头直径
 *     dead=0.12         死区（strength 低于此值输出 null / -1）
 *     baseTexture / knobTexture   皮肤纹理（缺省用 tf.joystick 程序化兜底）
 *     fixed: {x, y}     固定式摇杆（不随触摸点浮动；缺省浮动式）
 *     onChange(dir|null) 方向变化回调（可选；轮询 getDir 亦可）
 *
 * 输出：
 *   getDir() → { x, y, strength } | null    单位向量 + 力度 0..1
 *   dir4()  → 0下 1左 2右 3上 | -1           主轴优先四方向（DAL 习惯）
 *   dir8()  → 0..7（E 起逆时针 45° 一档）| -1
 */

function create(ctx, surface, opts) {
  var PIXI = ctx.PIXI;
  var tf = ctx.tf;
  opts = opts || {};
  var R = opts.radius === undefined ? 120 : opts.radius;
  var KNOB = opts.knobSize === undefined ? 80 : opts.knobSize;
  var DEAD = opts.dead === undefined ? 0.12 : opts.dead;

  var container = new PIXI.Container();
  container.visible = false;
  container.eventMode = 'none';   // 纯展示，不参与命中

  function skin(texture, fallbackKind, size) {
    var sp;
    if (texture) {
      sp = new PIXI.Sprite(texture);
      sp.alpha = fallbackKind === 'base' ? 0.75 : 0.9;
    } else if (tf) {
      sp = new PIXI.Sprite(tf.joystick(fallbackKind, size));
      sp.alpha = fallbackKind === 'base' ? 0.6 : 0.85;
    } else {
      sp = new PIXI.Sprite();
    }
    if (sp.anchor && sp.anchor.set) { sp.anchor.set(0.5); }
    var texW = Math.max(sp.width || 0, sp.height || 0);
    if (texW > 0) { sp.scale.set(size / texW); }
    return sp;
  }

  var base = skin(opts.baseTexture, 'base', R * 2);
  container.addChild(base);
  var knob = skin(opts.knobTexture, 'knob', KNOB);
  container.addChild(knob);

  var state = {
    active: false,
    pointerId: null,
    cx: 0,
    cy: 0,
    dir: { x: 0, y: 0, strength: 0 }
  };
  var enabled = true;

  if (opts.fixed) {
    container.x = opts.fixed.x;
    container.y = opts.fixed.y;
    container.visible = true;
  }

  function globalOf(e) {
    return (e.data && e.data.global) || e.global || { x: 0, y: 0 };
  }

  function pointerIdOf(e) {
    if (!e) { return null; }
    if (e.pointerId != null) { return e.pointerId; }
    return e.data ? e.data.pointerId : null;
  }

  function emit() {
    if (opts.onChange) {
      opts.onChange(state.dir.strength > DEAD ? state.dir : null);
    }
  }

  surface.eventMode = 'static';

  function onDown(e) {
    if (!enabled || state.active) { return; }
    state.active = true;
    state.pointerId = pointerIdOf(e);
    var g = globalOf(e);
    if (opts.fixed) {
      state.cx = opts.fixed.x;
      state.cy = opts.fixed.y;
    } else {
      state.cx = g.x;
      state.cy = g.y;
      container.x = state.cx;
      container.y = state.cy;
      container.visible = true;
    }
    knob.x = 0;
    knob.y = 0;
    state.dir.x = 0;
    state.dir.y = 0;
    state.dir.strength = 0;
    emit();
  }

  function onMove(e) {
    if (!state.active || pointerIdOf(e) !== state.pointerId) { return; }
    var g = globalOf(e);
    var dx = g.x - state.cx;
    var dy = g.y - state.cy;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) {
      state.dir.x = 0;
      state.dir.y = 0;
      state.dir.strength = 0;
      knob.x = 0;
      knob.y = 0;
      emit();
      return;
    }
    var clamped = Math.min(len, R);
    state.dir.x = dx / len;
    state.dir.y = dy / len;
    state.dir.strength = clamped / R;
    knob.x = state.dir.x * clamped;
    knob.y = state.dir.y * clamped;
    emit();
  }

  function end(e) {
    if (!state.active) { return; }
    var pid = pointerIdOf(e);
    if (e && pid != null && pid !== state.pointerId) { return; }
    state.active = false;
    state.pointerId = null;
    state.dir.x = 0;
    state.dir.y = 0;
    state.dir.strength = 0;
    knob.x = 0;
    knob.y = 0;
    if (!opts.fixed) { container.visible = false; }
    emit();
  }

  surface.on('pointerdown', onDown);
  surface.on('pointermove', onMove);
  surface.on('pointerup', end);
  surface.on('pointerupoutside', end);
  surface.on('pointercancel', end);

  return {
    container: container,

    /** 当前方向（死区内 / 无输入返回 null） */
    getDir: function () {
      return state.active && state.dir.strength > DEAD ? state.dir : null;
    },

    /** 主轴优先四方向：0下 1左 2右 3上；无输入 -1 */
    dir4: function () {
      if (!state.active || state.dir.strength <= DEAD) { return -1; }
      if (Math.abs(state.dir.x) > Math.abs(state.dir.y)) {
        return state.dir.x > 0 ? 2 : 1;
      }
      return state.dir.y > 0 ? 0 : 3;
    },

    /** 八方向：0=E 起逆时针（数学角）45° 一档；无输入 -1 */
    dir8: function () {
      if (!state.active || state.dir.strength <= DEAD) { return -1; }
      var ang = Math.atan2(-state.dir.y, state.dir.x);   // 屏幕 y 向下 → 取反成数学角
      var idx = Math.round(ang / (Math.PI / 4));
      return (idx + 8) % 8;
    },

    active: function () { return state.active; },

    setEnabled: function (on) {
      enabled = !!on;
      if (!on) { end(null); }
    },

    reset: function () { end(null); },

    destroy: function () {
      surface.off('pointerdown', onDown);
      surface.off('pointermove', onMove);
      surface.off('pointerup', end);
      surface.off('pointerupoutside', end);
      surface.off('pointercancel', end);
      container.destroy({ children: true });
    }
  };
}

module.exports = { create: create };
