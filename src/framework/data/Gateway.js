/**
 * Gateway — 服务端接口抽象（收编 UW filter 版，实例化改造）
 * 本地实现注册 + 远程切换（可按 endpoint 过滤部分远程化）
 *
 * create(prefix)  prefix 如 '/game/uw/'
 * 返回 { registerLocal(endpoint, fn), useRemote(fn, filter?), call(endpoint, payload, cb) }
 */

var LOG = '[Gateway]';

function create(prefix) {
  prefix = prefix || '/';
  var remote = null;
  var remoteFilter = null;
  var handlers = {};

  return {
    registerLocal: function (endpoint, fn) { handlers[endpoint] = fn; },

    /**
     * @param fn function(opts, cb)：fn({ endpoint, method, data }, function (ret) {...})
     * @param filter 可选 function(endpoint) → bool：只将部分 endpoint 远程化
     */
    useRemote: function (fn, filter) {
      remote = fn;
      remoteFilter = filter || null;
      console.log(LOG, 'remote enabled', filter ? '(filtered)' : '(all)');
    },

    call: function (endpoint, payload, cb) {
      cb = cb || function () {};
      if (remote && (!remoteFilter || remoteFilter(endpoint))) {
        remote({ endpoint: prefix + endpoint, method: 'POST', data: payload }, function (ret) {
          cb(ret && ret.data !== undefined ? ret.data : ret);
        });
        return;
      }
      var handler = handlers[endpoint];
      if (!handler) {
        console.warn(LOG, 'no local handler:', endpoint);
        cb(null);
        return;
      }
      cb(handler(payload));
    }
  };
}

module.exports = { create: create };
