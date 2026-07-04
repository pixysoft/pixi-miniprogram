/**
 * Timer — 帧驱动定时器（由 App 主循环 update(dt) 驱动，不依赖 setTimeout）
 * after(ms, fn)  一次性；every(ms, fn) 周期性；均返回取消函数
 */

function create() {
  var items = [];

  function add(interval, fn, repeat) {
    var item = { left: interval, interval: interval, fn: fn, repeat: repeat, dead: false };
    items.push(item);
    return function cancel() { item.dead = true; };
  }

  return {
    after: function (ms, fn) { return add(ms, fn, false); },
    every: function (ms, fn) { return add(ms, fn, true); },

    update: function (dt) {
      if (!items.length) { return; }
      var alive = [];
      // 快照遍历：回调内新增的定时器下一帧生效
      var snapshot = items.slice();
      for (var i = 0; i < snapshot.length; i++) {
        var it = snapshot[i];
        if (it.dead) { continue; }
        it.left -= dt;
        if (it.left <= 0) {
          it.fn();
          if (it.repeat) {
            it.left += it.interval;
          } else {
            it.dead = true;
          }
        }
      }
      for (var j = 0; j < items.length; j++) {
        if (!items[j].dead) { alive.push(items[j]); }
      }
      items = alive;
    },

    clear: function () { items = []; }
  };
}

module.exports = { create: create };
