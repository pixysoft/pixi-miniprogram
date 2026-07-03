/**
 * filters — Filter 预设（night/hurt/glow 三预设起步 + custom 自定义 shader）
 * 内部用 Pixi ColorMatrixFilter；unsafeEval 环境不可用时回退 tint 叠层
 * （回退路径与设计文档风险对策一致：滤镜退化 tint）
 *
 * create(PIXI) → {
 *   night(target) / hurt(target) / glow(target)   返回 { type: 'filter'|'tint' }
 *   custom(fragSrc, uniforms)                     返回 PIXI.Filter 或 null
 *   clear(target)                                 移除本模块施加的效果
 * }
 */

var LOG = '[filters]';

var TINT_FALLBACK = {
  night: 0x5566AA,
  hurt: 0xFF6666,
  glow: 0xFFFFCC
};

function create(PIXI) {
  function cmfAvailable() {
    return !!(PIXI.filters && PIXI.filters.ColorMatrixFilter);
  }

  function applyMatrix(target, name, tune) {
    if (cmfAvailable()) {
      var f = new PIXI.filters.ColorMatrixFilter();
      tune(f);
      target.filters = (target.filters || []).concat([f]);
      f.__fwPreset = name;
      return { type: 'filter', filter: f };
    }
    // 回退：tint 叠层（Container 无 tint 时静默跳过）
    if (target.tint !== undefined) {
      if (target.__fwTintBackup === undefined) { target.__fwTintBackup = target.tint; }
      target.tint = TINT_FALLBACK[name];
      return { type: 'tint' };
    }
    console.warn(LOG, 'no ColorMatrixFilter and target has no tint', name);
    return { type: 'none' };
  }

  return {
    /** 昼夜：降亮度 + 偏蓝 */
    night: function (target) {
      return applyMatrix(target, 'night', function (f) {
        if (f.brightness) { f.brightness(0.55, false); }
        if (f.tint) { f.tint(0x8899DD, true); }
      });
    },

    /** 受伤：红色闪白 */
    hurt: function (target) {
      return applyMatrix(target, 'hurt', function (f) {
        if (f.tint) { f.tint(0xFF5555, false); }
      });
    },

    /** 高亮：提升亮度（选中/可交互提示） */
    glow: function (target) {
      return applyMatrix(target, 'glow', function (f) {
        if (f.brightness) { f.brightness(1.4, false); }
      });
    },

    /** 自定义 shader（溶解/圆形遮罩等，沿 README 遮罩示例封装） */
    custom: function (fragSrc, uniforms) {
      if (!PIXI.Filter) {
        console.warn(LOG, 'PIXI.Filter unavailable');
        return null;
      }
      try {
        return new PIXI.Filter(undefined, fragSrc, uniforms || {});
      } catch (e) {
        console.warn(LOG, 'custom filter failed', e);
        return null;
      }
    },

    /** 移除本模块施加的预设（filter 与 tint 回退都清） */
    clear: function (target) {
      if (target.filters && target.filters.length) {
        target.filters = target.filters.filter(function (f) { return !f.__fwPreset; });
        if (!target.filters.length) { target.filters = null; }
      }
      if (target.__fwTintBackup !== undefined) {
        target.tint = target.__fwTintBackup;
        delete target.__fwTintBackup;
      }
    }
  };
}

module.exports = { create: create };
