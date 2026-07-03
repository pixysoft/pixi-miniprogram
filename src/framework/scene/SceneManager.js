/**
 * SceneManager — 场景栈（收编现网标准版 + currentScene()）
 * 场景协议：{ container, enter(params), exit(), update(dt) }
 * 工厂注册制：register(name, factory)；factory 懒调用一次
 * setTransition(fn(applyFn)) 可挂转场效果（默认直切）
 */

var LOG = '[SceneManager]';

function create(rootContainer) {
  var factories = {};
  var instances = {};
  var stack = [];
  var transition = null;   // function(apply) — 由游戏挂淡入淡出等效果

  function instance(name) {
    if (!instances[name]) {
      var f = factories[name];
      if (!f) {
        console.error(LOG, 'unknown scene', name);
        return null;
      }
      instances[name] = f();
      instances[name].container.visible = false;
      rootContainer.addChild(instances[name].container);
    }
    return instances[name];
  }

  function show(scene, params) {
    scene.container.visible = true;
    if (scene.enter) { scene.enter(params || {}); }
  }

  function hide(scene) {
    if (scene.exit) { scene.exit(); }
    scene.container.visible = false;
  }

  function wrap(fn) {
    if (transition) { transition(fn); } else { fn(); }
  }

  return {
    register: function (name, factory) { factories[name] = factory; },

    setTransition: function (fn) { transition = fn; },

    /** 清栈切换（主流程） */
    replace: function (name, params) {
      wrap(function () {
        while (stack.length) { hide(instance(stack.pop())); }
        var s = instance(name);
        if (s) { stack.push(name); show(s, params); }
      });
    },

    /** 叠加（弹层式场景） */
    push: function (name, params) {
      wrap(function () {
        var top = stack[stack.length - 1];
        if (top) { hide(instance(top)); }
        var s = instance(name);
        if (s) { stack.push(name); show(s, params); }
      });
    },

    pop: function (params) {
      if (stack.length <= 1) { return; }
      wrap(function () {
        hide(instance(stack.pop()));
        var top = stack[stack.length - 1];
        if (top) { show(instance(top), params); }
      });
    },

    current: function () { return stack[stack.length - 1] || null; },

    currentScene: function () {
      var top = stack[stack.length - 1];
      return top ? instances[top] : null;
    },

    update: function (dt) {
      var top = stack[stack.length - 1];
      if (top && instances[top] && instances[top].update) {
        instances[top].update(dt);
      }
    }
  };
}

module.exports = { create: create };
