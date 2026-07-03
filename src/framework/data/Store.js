/**
 * Store — 存档读写（收编现网 4 包同源版，实例化改造）
 * 节流落盘 + djb2 校验和 + 版本迁移；wx 不存在时退化为内存模式（Node 测试）
 *
 * create(key, opts)
 *   opts.throttleMs   节流写盘间隔，默认 3000
 *   opts.migrations   { fromVersion: fn(save)→newVersion } 版本迁移表
 * 返回 { load(), save(state, immediate?), _resetMemory() }
 */

var LOG = '[Store]';

function hasWx() {
  return typeof wx !== 'undefined' && wx && typeof wx.getStorageSync === 'function';
}

function checksum(str) {
  var h = 5381;
  for (var i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return h;
}

function create(key, opts) {
  opts = opts || {};
  var throttleMs = opts.throttleMs || 3000;
  var migrations = opts.migrations || {};
  var memory = null;
  var saveTimer = null;

  function migrate(save) {
    var guard = 0;
    while (migrations[save.v] && guard < 20) {
      save.v = migrations[save.v](save);
      guard++;
    }
    return save;
  }

  function doSave(state) {
    var data = JSON.stringify(state);
    if (!hasWx()) {
      memory = JSON.parse(data);
      return;
    }
    try {
      wx.setStorageSync(key, JSON.stringify({ sum: checksum(data), data: data }));
    } catch (e) {
      console.warn(LOG, '写档失败', e);
    }
  }

  return {
    load: function () {
      if (!hasWx()) { return memory; }
      try {
        var raw = wx.getStorageSync(key);
        if (!raw) { return null; }
        var box = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (box.sum !== undefined && checksum(box.data) !== box.sum) {
          console.warn(LOG, '校验和不符，丢弃存档');
          return null;
        }
        return migrate(JSON.parse(box.data));
      } catch (e) {
        console.warn(LOG, '读档失败', e);
        return null;
      }
    },

    save: function (state, immediate) {
      if (immediate) {
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
        doSave(state);
        return;
      }
      if (saveTimer) { return; }
      saveTimer = setTimeout(function () {
        saveTimer = null;
        doSave(state);
      }, throttleMs);
    },

    _resetMemory: function () { memory = null; }
  };
}

module.exports = { create: create };
