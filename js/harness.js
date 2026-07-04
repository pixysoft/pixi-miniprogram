/**
 * harness — 演示运行时（浏览器 ↔ 小程序适配层的桥）
 *
 * 职责：
 *   1. 造一块"伪小程序 canvas"：补 createImage / requestAnimationFrame（内核会用到）
 *   2. 把 PC 鼠标事件转换成 wx 触摸事件结构，喂给 PIXI.dispatchEvent（与小程序
 *      页面里 touchEvent:function(e){ PIXI.dispatchEvent(e) } 完全同路）
 *   3. 管理演示生命周期：切换时销毁 renderer / 停 rAF / 摘 DOM
 *
 * 内核（dist/pixi.miniprogram.js）不做任何修改。
 */
(function () {
  'use strict';

  var lib = null;          // dist 产物导出：{ createPIXI, createGame, framework }
  var unsafeEval = null;

  function ensureLib() {
    if (lib) { return Promise.resolve(lib); }
    return Promise.all([
      ShowcaseLoader.commonjs('libs/pixi.miniprogram.js'),
      ShowcaseLoader.commonjs('libs/unsafeEval.js')
    ]).then(function (mods) {
      lib = mods[0];
      unsafeEval = mods[1];
      return lib;
    });
  }

  /* ---------- 伪小程序 canvas ---------- */
  function makeCanvas(width, height, rafRegistry) {
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.className = 'demo-canvas';

    // 内核 createPIXI 会执行 `canvas.parentElement = true`（小程序 canvas 无此属性），
    // renderer.destroy 又会调 parentElement.removeChild —— 真实 DOM 上该属性只读，
    // 这里用访问器整体遮蔽：写入忽略，读取返回带 removeChild 空实现的桩
    var fakeParent = { removeChild: function () {} };
    Object.defineProperty(canvas, 'parentElement', {
      configurable: true,
      get: function () { return fakeParent; },
      set: function () {}
    });

    canvas.createImage = function () { return new Image(); };

    canvas.requestAnimationFrame = function (cb) {
      var id = window.requestAnimationFrame(function (ts) {
        rafRegistry.delete(id);
        cb(ts);
      });
      rafRegistry.add(id);
      return id;
    };
    canvas.cancelAnimationFrame = function (id) {
      rafRegistry.delete(id);
      window.cancelAnimationFrame(id);
    };
    return canvas;
  }

  /* ---------- 鼠标 → wx 触摸事件 ----------
   * 坐标必须换算到"初始 canvas 显示宽度"空间（displayW/H）：
   * 内核 dispatchEvent 里的 ratio = designWidth / 初始 canvas.width，
   * 而 renderer 创建后会把 canvas.width 属性改写成设计宽度，不能再用它。
   */
  function bindPointer(canvas, displayW, displayH, getDispatcher, cleanups) {
    var nativeAdd = Element.prototype.addEventListener.bind(canvas);
    var nativeRemove = Element.prototype.removeEventListener.bind(canvas);
    var nativeRect = Element.prototype.getBoundingClientRect.bind(canvas);
    var down = false;

    function touchOf(e) {
      var rect = nativeRect();
      return {
        identifier: 0,
        x: (e.clientX - rect.left) * (displayW / rect.width),
        y: (e.clientY - rect.top) * (displayH / rect.height)
      };
    }

    function send(type, touches, changed, ts) {
      var fn = getDispatcher();
      if (!fn) { return; }
      fn({ type: type, touches: touches, changedTouches: changed, timeStamp: ts || Date.now() });
    }

    function onDown(e) {
      if (e.button !== 0) { return; }
      e.preventDefault();
      down = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      var t = touchOf(e);
      send('touchstart', [t], [t], e.timeStamp);
    }
    function onMove(e) {
      if (!down) { return; }
      var t = touchOf(e);
      send('touchmove', [t], [t], e.timeStamp);
    }
    function onUp(e) {
      if (!down) { return; }
      down = false;
      var t = touchOf(e);
      send('touchend', [], [t], e.timeStamp);
    }

    nativeAdd('pointerdown', onDown);
    nativeAdd('pointermove', onMove);
    nativeAdd('pointerup', onUp);
    nativeAdd('pointercancel', onUp);

    cleanups.push(function () {
      nativeRemove('pointerdown', onDown);
      nativeRemove('pointermove', onMove);
      nativeRemove('pointerup', onUp);
      nativeRemove('pointercancel', onUp);
    });

    /** 双指捏合模拟：以 (cx, cy) 为中心合成两指序列（PinchPan 等手势演示用） */
    return {
      simulatePinch: function (cx, cy, factor) {
        var fn = getDispatcher();
        if (!fn) { return; }
        var d0 = 60;
        var d1 = d0 * factor;
        function pair(d) {
          return [
            { identifier: 101, x: cx - d, y: cy },
            { identifier: 102, x: cx + d, y: cy }
          ];
        }
        var p0 = pair(d0);
        var p1 = pair(d1);
        fn({ type: 'touchstart', touches: p0, changedTouches: p0, timeStamp: Date.now() });
        fn({ type: 'touchmove', touches: p1, changedTouches: p1, timeStamp: Date.now() + 16 });
        fn({ type: 'touchend', touches: [], changedTouches: p1, timeStamp: Date.now() + 32 });
      }
    };
  }

  /* ---------- 演示环境 ---------- */
  /**
   * createEnv(mount, opts)
   *   mount: { stage, toolbar } 右侧演示区 DOM
   *   opts:  { width=420, height=640, mode='game'|'pixi'|'bare', designWidth=750 }
   * 返回 env（传给 demo.run）：
   *   canvas / lib / framework / PIXI(mode=pixi 时) / designWidth
   *   button(label, fn) / note(html) / onWheel(fn) / simulatePinch(cx,cy,f)
   *   animate(fn(dt)) — 自管 rAF 循环，销毁自动停
   * env._cleanup() 由 harness 调度，勿在 demo 内调用
   */
  function createEnv(mount, opts) {
    opts = opts || {};
    var width = opts.width || 420;
    var height = opts.height || 640;
    var designWidth = opts.designWidth || 750;

    var rafRegistry = new Set();
    var cleanups = [];
    var canvas = makeCanvas(width, height, rafRegistry);
    // 显示尺寸用样式表变量钉住（renderer 会把 canvas.width 改写成设计分辨率，
    // 内核还会整体覆盖 canvas.style，内联样式靠不住）
    mount.stage.style.setProperty('--demo-w', width + 'px');
    mount.stage.style.setProperty('--demo-h', height + 'px');
    mount.stage.appendChild(canvas);

    var dispatcher = null;
    var pinch = bindPointer(canvas, width, height, function () { return dispatcher; }, cleanups);

    var env = {
      canvas: canvas,
      lib: lib,
      framework: lib.framework,
      designWidth: designWidth,
      PIXI: null,

      /** demo 完成初始化后调用，接入触摸分发（game.dispatchTouch 或 PIXI.dispatchEvent） */
      setDispatcher: function (fn) { dispatcher = fn; },

      simulatePinch: pinch.simulatePinch,

      button: function (label, fn) {
        var b = document.createElement('button');
        b.className = 'demo-btn';
        b.textContent = label;
        b.addEventListener('click', fn);
        mount.toolbar.appendChild(b);
        return b;
      },

      select: function (labels, fn) {
        var s = document.createElement('select');
        s.className = 'demo-select';
        labels.forEach(function (l) {
          var o = document.createElement('option');
          o.value = l;
          o.textContent = l;
          s.appendChild(o);
        });
        s.addEventListener('change', function () { fn(s.value); });
        mount.toolbar.appendChild(s);
        return s;
      },

      note: function (html) {
        var n = document.createElement('span');
        n.className = 'demo-note';
        n.innerHTML = html;
        mount.toolbar.appendChild(n);
        return n;
      },

      onWheel: function (fn) {
        var nativeAdd = Element.prototype.addEventListener.bind(canvas);
        var nativeRemove = Element.prototype.removeEventListener.bind(canvas);
        function handler(e) {
          e.preventDefault();
          var rect = Element.prototype.getBoundingClientRect.call(canvas);
          // 与触摸桥同一坐标空间：初始显示尺寸（内核按 ratio 换算设计坐标）
          fn(e, (e.clientX - rect.left) * (width / rect.width),
                (e.clientY - rect.top) * (height / rect.height));
        }
        nativeAdd('wheel', handler, { passive: false });
        cleanups.push(function () { nativeRemove('wheel', handler); });
      },

      /** 自管动画循环（pixi 模式演示用；game 模式由 app.start 驱动） */
      animate: function (fn) {
        var stopped = false;
        var last = Date.now();
        function loop() {
          if (stopped) { return; }
          canvas.requestAnimationFrame(loop);
          var now = Date.now();
          fn(Math.min(200, now - last));
          last = now;
        }
        loop();
        cleanups.push(function () { stopped = true; });
      },

      _cleanup: function (handle) {
        try {
          if (handle && handle.destroy) { handle.destroy(); }
        } catch (e) { console.warn('[showcase] demo destroy', e); }
        try {
          if (handle && handle.game) { handle.game.destroy(); }
        } catch (e2) { console.warn('[showcase] game destroy', e2); }
        // 显式销毁 renderer：EventSystem 会从适配层的伪 window 上摘掉监听，防跨演示泄漏
        var renderer = (handle && handle.renderer) ||
                       (handle && handle.game && handle.game.app && handle.game.app.renderer);
        try {
          if (renderer && !renderer.__destroyed) {
            renderer.__destroyed = true;
            renderer.destroy();
          }
        } catch (e3) { console.warn('[showcase] renderer destroy', e3); }

        rafRegistry.forEach(function (id) { window.cancelAnimationFrame(id); });
        rafRegistry.clear();
        cleanups.forEach(function (fn) {
          try { fn(); } catch (e4) { /* noop */ }
        });
        dispatcher = null;
        if (canvas.parentElement) { canvas.parentElement.removeChild(canvas); }
      }
    };

    if (opts.mode === 'pixi') {
      // 原始功能演示：与小程序示例页同样的初始化序列
      env.PIXI = lib.createPIXI(canvas, designWidth);
      unsafeEval(env.PIXI);
      env.setDispatcher(env.PIXI.dispatchEvent);
    }
    return env;
  }

  window.ShowcaseHarness = {
    ensureLib: ensureLib,
    createEnv: createEnv,
    getLib: function () { return lib; }
  };
})();
