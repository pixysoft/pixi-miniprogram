/**
 * EventBus — 轻量事件总线
 * emit 采用快照遍历，回调内 on/off 不影响本次分发（收编 CnC2 安全版）
 * on(evt, fn) 返回 off 闭包
 */

function create() {
  var handlers = {};

  return {
    on: function (evt, fn) {
      (handlers[evt] = handlers[evt] || []).push(fn);
      return function off() {
        var list = handlers[evt] || [];
        var i = list.indexOf(fn);
        if (i >= 0) { list.splice(i, 1); }
      };
    },

    once: function (evt, fn) {
      var off = this.on(evt, function () {
        off();
        fn.apply(null, arguments);
      });
      return off;
    },

    emit: function (evt, payload) {
      (handlers[evt] || []).slice().forEach(function (fn) { fn(payload); });
    },

    clear: function () { handlers = {}; }
  };
}

module.exports = { create: create };
