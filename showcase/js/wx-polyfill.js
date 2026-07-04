/**
 * wx-polyfill — 在 PC 浏览器中模拟小程序 wx API（演示站专用，不修改内核）
 *
 * 覆盖内核实际用到的接口：
 *   wx.getPerformance / wx.createOffscreenCanvas / wx.request
 *   wx.createInnerAudioContext / wx.getStorageSync 系列 / wx.getSystemInfoSync
 *   wx.base64ToArrayBuffer / wx.arrayBufferToBase64 / wx.env
 *
 * 刻意不提供 wx.getFileSystemManager：framework 的 app.snapshot 检测到缺失后
 * 会自动回退返回 dataURL（内核内置的非 wx 降级路径）。
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') { return; }

  var STORAGE_PREFIX = 'pixi-showcase:';

  /* ---------- InnerAudioContext：HTMLAudioElement 包装 ---------- */
  function InnerAudioContext() {
    var audio = document.createElement('audio');
    audio.preload = 'auto';
    var handlers = { canplay: [], play: [], pause: [], ended: [], error: [], stop: [] };

    function bind(evt, key) {
      audio.addEventListener(evt, function () {
        handlers[key].forEach(function (fn) { fn(); });
      });
    }
    bind('canplay', 'canplay');
    bind('play', 'play');
    bind('pause', 'pause');
    bind('ended', 'ended');
    audio.addEventListener('error', function () {
      handlers.error.forEach(function (fn) { fn({ errMsg: 'audio error' }); });
    });

    var ctx = {
      play: function () {
        var p = audio.play();
        if (p && p.catch) { p.catch(function () { /* 浏览器自动播放策略拦截时静默 */ }); }
      },
      pause: function () { audio.pause(); },
      stop: function () {
        audio.pause();
        try { audio.currentTime = 0; } catch (e) { /* noop */ }
        handlers.stop.forEach(function (fn) { fn(); });
      },
      seek: function (v) { try { audio.currentTime = v; } catch (e) { /* noop */ } },
      destroy: function () {
        audio.pause();
        audio.removeAttribute('src');
        try { audio.load(); } catch (e) { /* noop */ }
      },
      onCanplay: function (fn) { handlers.canplay.push(fn); },
      onPlay: function (fn) { handlers.play.push(fn); },
      onPause: function (fn) { handlers.pause.push(fn); },
      onEnded: function (fn) { handlers.ended.push(fn); },
      onError: function (fn) { handlers.error.push(fn); },
      onStop: function (fn) { handlers.stop.push(fn); },
      offCanplay: function () { handlers.canplay = []; },
      offEnded: function () { handlers.ended = []; }
    };

    Object.defineProperty(ctx, 'src', {
      get: function () { return audio.src; },
      set: function (v) { audio.src = v; }
    });
    Object.defineProperty(ctx, 'loop', {
      get: function () { return audio.loop; },
      set: function (v) { audio.loop = !!v; }
    });
    Object.defineProperty(ctx, 'volume', {
      get: function () { return audio.volume; },
      set: function (v) { audio.volume = Math.max(0, Math.min(1, v)); }
    });
    Object.defineProperty(ctx, 'autoplay', {
      get: function () { return audio.autoplay; },
      set: function (v) { audio.autoplay = !!v; }
    });
    Object.defineProperty(ctx, 'currentTime', {
      get: function () { return audio.currentTime; }
    });
    Object.defineProperty(ctx, 'paused', {
      get: function () { return audio.paused; }
    });
    return ctx;
  }

  /* ---------- wx.request → fetch ---------- */
  function request(opts) {
    opts = opts || {};
    var wantArrayBuffer = opts.responseType === 'arraybuffer' || opts.dataType === 'arraybuffer';
    fetch(opts.url, {
      method: opts.method || 'GET',
      headers: opts.header || undefined,
      body: opts.data !== undefined && opts.method && opts.method !== 'GET' ? opts.data : undefined
    }).then(function (resp) {
      var headerObj = {};
      resp.headers.forEach(function (v, k) { headerObj[k] = v; });
      var bodyP = wantArrayBuffer ? resp.arrayBuffer() : resp.text();
      return bodyP.then(function (body) {
        // 与 wx.request 一致：dataType 非 arraybuffer 时若是 JSON 文本尝试解析
        if (!wantArrayBuffer && typeof body === 'string' && opts.dataType !== 'text') {
          try { body = JSON.parse(body); } catch (e) { /* 保留文本 */ }
        }
        if (opts.success) {
          opts.success({ statusCode: resp.status, data: body, header: headerObj });
        }
      });
    }).catch(function (err) {
      if (opts.fail) { opts.fail({ errMsg: String(err) }); }
    });
  }

  /* ---------- base64 <-> ArrayBuffer ---------- */
  function base64ToArrayBuffer(b64) {
    var bin = window.atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
    return bytes.buffer;
  }

  function arrayBufferToBase64(buf) {
    var bytes = new Uint8Array(buf);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) { bin += String.fromCharCode(bytes[i]); }
    return window.btoa(bin);
  }

  window.wx = {
    env: { USER_DATA_PATH: '/showcase-tmp' },

    getPerformance: function () { return window.performance; },

    createOffscreenCanvas: function (opts) {
      opts = opts || {};
      var cvs = document.createElement('canvas');
      cvs.width = opts.width || 1;
      cvs.height = opts.height || 1;
      return cvs;
    },

    createInnerAudioContext: function () { return new InnerAudioContext(); },

    request: request,

    getSystemInfoSync: function () {
      return {
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        pixelRatio: window.devicePixelRatio || 1,
        platform: 'pc-showcase',
        SDKVersion: '0.0.0'
      };
    },

    getStorageSync: function (key) {
      try {
        var v = window.localStorage.getItem(STORAGE_PREFIX + key);
        return v === null ? '' : v;
      } catch (e) { return ''; }
    },

    setStorageSync: function (key, value) {
      try { window.localStorage.setItem(STORAGE_PREFIX + key, value); } catch (e) { /* noop */ }
    },

    removeStorageSync: function (key) {
      try { window.localStorage.removeItem(STORAGE_PREFIX + key); } catch (e) { /* noop */ }
    },

    base64ToArrayBuffer: base64ToArrayBuffer,
    arrayBufferToBase64: arrayBufferToBase64
  };
})();
