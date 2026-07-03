/**
 * Widget — 交互基础：按压/点击判定（cocos Widget 判定 + 现网 14px 位移阈值）
 *
 * makePressable(node, opts)
 *   opts: { w, h, onTap, onStateChange(state), moveCancelPx=14, enabled=true }
 * 给 node 挂上：cancelPress() / setEnabled(bool) / isEnabled()
 * 状态回调 state: 'up' | 'down' | 'disabled'
 *
 * 规则：
 *   - pointerdown 进 down 态
 *   - 位移超过 moveCancelPx → 取消（配合 ScrollView 拦截）
 *   - pointerup 时仍处 down 态 → 触发 onTap
 */

function makePressable(node, opts) {
  opts = opts || {};
  var moveCancelPx = opts.moveCancelPx === undefined ? 14 : opts.moveCancelPx;
  var enabled = opts.enabled === undefined ? true : !!opts.enabled;
  var downPos = null;
  var isDown = false;

  node.eventMode = 'static';
  node.cursor = 'pointer';
  if (opts.w !== undefined && opts.h !== undefined && node.hitArea === undefined) {
    // hitArea 由调用方按需设置（Rectangle 依赖 PIXI，这里不强制）
  }

  function setState(s) {
    if (opts.onStateChange) { opts.onStateChange(s); }
  }

  function cancel() {
    if (isDown) {
      isDown = false;
      downPos = null;
      setState(enabled ? 'up' : 'disabled');
    }
  }

  node.on('pointerdown', function (ev) {
    if (!enabled) { return; }
    downPos = { x: ev.data.global.x, y: ev.data.global.y };
    isDown = true;
    setState('down');
  });

  node.on('pointermove', function (ev) {
    if (!isDown || !downPos) { return; }
    var dx = ev.data.global.x - downPos.x;
    var dy = ev.data.global.y - downPos.y;
    if (dx * dx + dy * dy > moveCancelPx * moveCancelPx) {
      cancel();
    }
  });

  node.on('pointerup', function () {
    if (!isDown) { return; }
    isDown = false;
    downPos = null;
    setState('up');
    if (opts.onTap) { opts.onTap(); }
  });

  node.on('pointerupoutside', cancel);

  node.cancelPress = cancel;

  node.setEnabled = function (v) {
    enabled = !!v;
    if (!enabled) { cancel(); }
    setState(enabled ? 'up' : 'disabled');
    node.cursor = enabled ? 'pointer' : 'default';
  };

  node.isEnabled = function () { return enabled; };

  return node;
}

module.exports = { makePressable: makePressable };
