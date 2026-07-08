/**
 * PageShell — 微信小程序 Page 壳标准模板（3.1 收编现网 15 份重复 Page 壳）
 *
 * 职责：canvas 节点查询与尺寸设置 → createGame 工厂调用 → 触摸转发 →
 *       onHide/onShow/onUnload 生命周期 → 分享。业务只写 createGame。
 *
 * 用法（页面 js）：
 *   var lib = require('../../libs/pixi.miniprogram.js');
 *   Page(lib.framework.PageShell.create({
 *     createGame: function (canvas, w, h, page) {
 *       return require('../../game/Game.js').create(canvas, w, h);
 *     },
 *     share: { title: '来玩！', path: '/packageX/pages/index/index' }
 *   }));
 *
 * WXML 约定（selector 默认 #gameCanvas，触摸事件统一绑 onTouch）：
 *   <canvas id="gameCanvas" type="webgl" bindtouchstart="onTouch"
 *           bindtouchmove="onTouch" bindtouchend="onTouch" bindtouchcancel="onTouch"/>
 *
 * game 对象协议（createGame 返回值）：
 *   必须 dispatchTouch(e) / destroy()；可选 onHide() / onShow()（后台存档等）
 *
 * opts：
 *   createGame(canvas, width, height, page)   必填，返回 game
 *   selector='#gameCanvas'
 *   share            onShareAppMessage 返回值（对象，或 function(page) 动态生成）
 *   onReady(game, page) / onError(err, page)  初始化成功/失败钩子（失败默认 showToast）
 *   loadingKey='loading'                      data 中加载标记字段（完成置 false）
 *   wx                                        注入 wx（测试用；缺省取全局）
 *
 * 返回的对象可直接 Page(...)，也可先追加业务方法再传入。
 */

var LOG = '[PageShell]';

function create(opts) {
  opts = opts || {};
  var selector = opts.selector || '#gameCanvas';
  var loadingKey = opts.loadingKey || 'loading';

  function wxApi() {
    if (opts.wx) { return opts.wx; }
    return (typeof wx !== 'undefined' && wx) ? wx : null;
  }

  var page = {
    data: {},

    onLoad: function () {
      var that = this;
      that._game = null;
      var w = wxApi();

      function fail(err) {
        console.error(LOG, '初始化失败', err);
        if (opts.onError) {
          opts.onError(err, that);
          return;
        }
        if (w && w.showToast) {
          w.showToast({ title: '初始化失败，请重进', icon: 'none' });
        }
      }

      if (!w || !w.createSelectorQuery) {
        fail(new Error('wx.createSelectorQuery 不可用'));
        return;
      }
      var query = w.createSelectorQuery();
      query.select(selector).boundingClientRect();
      query.select(selector).node();
      query.exec(function (res) {
        var rect = res && res[0];
        var nodeRes = res && res[1];
        if (!rect || !nodeRes || !nodeRes.node) {
          fail(new Error('canvas 节点查询失败: ' + selector));
          return;
        }
        try {
          var canvas = nodeRes.node;
          canvas.width = rect.width;
          canvas.height = rect.height;
          that._game = opts.createGame(canvas, rect.width, rect.height, that);
          if (that.setData) {
            var d = {};
            d[loadingKey] = false;
            that.setData(d);
          }
          console.log(LOG, '游戏初始化完成', { w: rect.width, h: rect.height });
          if (opts.onReady) { opts.onReady(that._game, that); }
        } catch (e) {
          fail(e);
        }
      });
    },

    /** WXML 触摸事件统一入口 */
    onTouch: function (e) {
      if (this._game) { this._game.dispatchTouch(e); }
    },

    onHide: function () {
      if (this._game && this._game.onHide) { this._game.onHide(); }
    },

    onShow: function () {
      if (this._game && this._game.onShow) { this._game.onShow(); }
    },

    onUnload: function () {
      console.log(LOG, 'onUnload');
      if (this._game) {
        try {
          this._game.destroy();
        } catch (e) {
          console.warn(LOG, 'destroy', e);
        }
        this._game = null;
      }
    },

    getGame: function () { return this._game; }
  };

  page.data[loadingKey] = true;

  if (opts.share) {
    page.onShareAppMessage = function () {
      return typeof opts.share === 'function' ? opts.share(this) : opts.share;
    };
  }

  return page;
}

module.exports = { create: create };
