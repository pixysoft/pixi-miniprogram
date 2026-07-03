/**
 * Theme — 主题/皮肤配置（借鉴 EUI Theme：组件名 → 皮肤配置映射）
 *
 * 皮肤配置为平铺 JSON：
 *   { bg: { frame?, slice?, color?, alpha?, radius? },
 *     label: { size, color, bold },
 *     states: { down: {...覆盖}, disabled: {...覆盖} } }
 * frame 存在且图集就绪时用图集帧（slice 有值走九宫格）；否则回退程序化 panel。
 *
 * create() → { set(themeJson), get(name), resolve(name, override) }
 */

/** 默认主题：即现网程序化 UI 风格（1.0 视觉本身成为默认皮肤） */
var DEFAULTS = {
  Button: {
    bg: { color: 0x3B72B0, alpha: 1, radius: 0.28 },   // radius<1 表示 h 的比例
    label: { size: 0, color: 0xFFFFFF, bold: true },    // size 0 = 按高度自适应
    // down 态默认回退为 scale 0.95（组件内置），有 down 帧时自动换帧不缩放
    states: {
      disabled: { alpha: 0.5 }
    }
  },
  Panel: {
    bg: { color: 0x14171F, alpha: 0.96, radius: 12 }
  },
  ProgressBar: {
    bg: { color: 0x14171F, alpha: 1, radius: 0.5 },
    fill: { color: 0x5CB85C, alpha: 1, radius: 0.5 },
    label: { size: 0, color: 0xFFFFFF, bold: true }
  },
  Slider: {
    track: { color: 0x14171F, alpha: 1, radius: 0.5 },
    fill: { color: 0x3B72B0, alpha: 1, radius: 0.5 },
    thumb: { color: 0xFFFFFF, alpha: 1 }
  },
  Modal: {
    mask: { color: 0x000000, alpha: 0.6 },
    bg: { color: 0x1B2030, alpha: 1, radius: 16 },
    title: { size: 32, color: 0xFFFFFF, bold: true },
    close: { color: 0xE05B4B }
  },
  Toast: {
    bg: { color: 0x14171F, alpha: 0.9, radius: 12 },
    label: { size: 26, color: 0xFFFFFF, bold: false }
  },
  ScrollView: {},
  List: {},
  Label: {
    size: 26, color: 0xFFFFFF, bold: false
  },
  RedDot: { color: 0xE05B4B },
  Currency: {
    bg: { color: 0x14171F, alpha: 0.8, radius: 0.5 },
    label: { size: 24, color: 0xFFFFFF, bold: true }
  }
};

/** 两层浅合并：state/part 级覆盖，够用且可预期 */
function merge(base, over) {
  if (!over) { return base; }
  var out = {};
  var k;
  for (k in base) { out[k] = base[k]; }
  for (k in over) {
    var bv = base[k];
    var ov = over[k];
    if (bv && ov && typeof bv === 'object' && typeof ov === 'object' &&
        !Array.isArray(bv) && !Array.isArray(ov)) {
      out[k] = merge(bv, ov);
    } else {
      out[k] = ov;
    }
  }
  return out;
}

function create() {
  var theme = {};

  return {
    /** 全局设置主题（组件名 → 皮肤配置），与默认主题合并 */
    set: function (themeJson) { theme = themeJson || {}; },

    /** 取组件皮肤（默认 ← 主题） */
    get: function (name) {
      return merge(DEFAULTS[name] || {}, theme[name]);
    },

    /** 取组件皮肤并叠加实例级覆盖（默认 ← 主题 ← 实例 skin） */
    resolve: function (name, override) {
      return merge(this.get(name), override);
    }
  };
}

module.exports = { create: create, merge: merge, DEFAULTS: DEFAULTS };
