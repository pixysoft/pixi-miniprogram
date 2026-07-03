/**
 * transitions — SceneManager 内置转场工厂（收编大航海 Game.js fade 状态机 phase 0/1/2）
 *
 * transitions.fade(app, opts { duration=160, color=0x000000 })
 *   返回可直接 scenes.setTransition(...) 的函数；
 *   内部全屏 overlay + 主循环推进，转场期间吞触摸；
 *   变黑中再次切换 → 最新切换意图覆盖；变亮中 → 直接切。
 */

function fade(app, opts) {
  opts = opts || {};
  var duration = opts.duration || 160;
  var PIXI = app.PIXI;

  var overlay = new PIXI.Graphics();
  overlay.beginFill(opts.color === undefined ? 0x000000 : opts.color, 1);
  overlay.drawRect(0, 0, app.stageWidth, app.stageHeight);
  overlay.endFill();
  overlay.alpha = 0;
  overlay.eventMode = 'none';
  app.stage.addChild(overlay);

  var phase = 0;        // 0 空闲 | 1 变黑 | 2 变亮
  var pending = null;   // 变黑到底后执行的切换

  app.onTick(function (dt) {
    if (!phase) { return; }
    var step = dt / duration;
    if (phase === 1) {
      overlay.alpha = Math.min(1, overlay.alpha + step);
      if (overlay.alpha >= 1) {
        if (pending) { pending(); pending = null; }
        phase = 2;
      }
    } else {
      overlay.alpha = Math.max(0, overlay.alpha - step);
      if (overlay.alpha <= 0) {
        phase = 0;
        overlay.eventMode = 'none';
      }
    }
  });

  function transition(apply) {
    if (phase === 1) { pending = apply; return; }   // 变黑中：覆盖切换意图
    if (phase === 2) { apply(); return; }           // 正在淡入：直接切
    phase = 1;
    pending = apply;
    overlay.eventMode = 'static';                   // 转场期间吞触摸
  }

  transition.overlay = overlay;
  return transition;
}

module.exports = { fade: fade };
