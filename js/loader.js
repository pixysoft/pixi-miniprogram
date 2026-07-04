/**
 * loader — 迷你 CommonJS 加载器
 * 仓库产物（dist/pixi.miniprogram.js、example/libs/*.js）全部是
 * `module.exports = ...` 的小程序模块格式；浏览器里用 fetch + new Function
 * 包一层 module/exports 即可原样运行，无需改内核。
 */
(function () {
  'use strict';

  var cache = {};

  function loadCommonJS(url) {
    if (cache[url]) { return cache[url]; }
    cache[url] = fetch(url)
      .then(function (resp) {
        if (!resp.ok) { throw new Error('load failed: ' + url + ' (' + resp.status + ')'); }
        return resp.text();
      })
      .then(function (code) {
        var module = { exports: {} };
        /* exports 作为独立形参：dist 产物顶层 `!function(t,e){...}(exports, ...)` 直接写它 */
        var fn = new Function('module', 'exports', code + '\n//# sourceURL=' + url);
        fn(module, module.exports);
        return module.exports;
      });
    return cache[url];
  }

  window.ShowcaseLoader = { commonjs: loadCommonJS };
})();
