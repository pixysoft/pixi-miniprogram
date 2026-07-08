/**
 * SceneManager — 场景栈 + 独立弹层栈（3.1 收编 Mr2/EggSoldier pushLayer 模式）
 *
 * 场景协议：{ container, enter(params), exit(), update(dt), resume(params)? }
 * 工厂注册制：register(name, factory)；factory 懒调用一次
 * setTransition(fn(applyFn)) 可挂转场效果（默认直切；弹层不走转场）
 *
 * 弹层栈（pushLayer/popLayer）：
 *   弹层压栈时「冻结」下层（场景与更低弹层的 update 不再执行，但保持可见）——
 *   暂停战斗 / 结算 / 抽卡等半透明覆盖层的标准语义；
 *   与 push()（隐藏下层场景、整场切换）语义不同，两者并存。
 *   popLayer 后对新的栈顶（弹层或场景）调用 resume(params)（若实现）。
 *
 * create(rootContainer, layerRoot?)
 *   layerRoot 可选：弹层挂载容器（应位于场景根之上）；缺省与 rootContainer 同一容器，
 *   每次 pushLayer 时置顶。
 */

var LOG = '[SceneManager]';

function create(rootContainer, layerRoot) {
  var factories = {};
  var instances = {};
  var stack = [];
  var layers = [];       // 弹层栈（覆盖在场景之上，冻结下层 update）
  var transition = null; // function(apply) — 由游戏挂淡入淡出等效果

  var layerContainer = layerRoot || rootContainer;

  function instance(name) {
    if (!instances[name]) {
      var f = factories[name];
      if (!f) {
        console.error(LOG, 'unknown scene/layer', name);
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

  function clearLayers() {
    while (layers.length) {
      var s = instance(layers.pop());
      if (s) { hide(s); }
    }
  }

  function wrap(fn) {
    if (transition) { transition(fn); } else { fn(); }
  }

  return {
    register: function (name, factory) { factories[name] = factory; },

    setTransition: function (fn) { transition = fn; },

    /** 清栈切换（主流程；弹层一并清空） */
    replace: function (name, params) {
      wrap(function () {
        clearLayers();
        while (stack.length) { hide(instance(stack.pop())); }
        var s = instance(name);
        if (s) { stack.push(name); show(s, params); }
      });
    },

    /** 叠加（弹层式场景：隐藏下层场景，整场切换语义） */
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

    /**
     * 弹层压栈：下层保持可见但 update 冻结（不走转场）。
     * 弹层容器挂到 layerRoot 并置顶。
     */
    pushLayer: function (name, params) {
      var s = instance(name);
      if (!s) { return; }
      s.isLayer = true;
      if (s.container.parent !== layerContainer) {
        layerContainer.addChild(s.container);
      }
      layers.push(name);
      show(s, params);
    },

    /** 弹层出栈：新栈顶（弹层或场景）resume(params) 若实现 */
    popLayer: function (params) {
      if (!layers.length) { return; }
      hide(instance(layers.pop()));
      var top = layers[layers.length - 1];
      if (top) {
        var s = instance(top);
        if (s && s.resume) { s.resume(params); }
        return;
      }
      var sc = stack[stack.length - 1];
      if (sc) {
        var scene = instance(sc);
        if (scene && scene.resume) { scene.resume(params); }
      }
    },

    hasLayer: function () { return layers.length > 0; },

    currentLayer: function () { return layers[layers.length - 1] || null; },

    current: function () { return stack[stack.length - 1] || null; },

    currentScene: function () {
      var top = stack[stack.length - 1];
      return top ? instances[top] : null;
    },

    update: function (dt) {
      // 弹层栈顶 update；无弹层时场景 update（弹层冻结下层）
      if (layers.length) {
        var topLayer = instances[layers[layers.length - 1]];
        if (topLayer && topLayer.update) { topLayer.update(dt); }
        return;
      }
      var top = stack[stack.length - 1];
      if (top && instances[top] && instances[top].update) {
        instances[top].update(dt);
      }
    }
  };
}

module.exports = { create: create };
