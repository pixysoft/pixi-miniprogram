/**
 * Rng — 可复现随机数（mulberry32）
 * 收编现网标准版 + Rich4 weighted / int(min,max)
 * create(seed) → { next, int, range, pick, shuffle, weighted, state }
 */

function create(seed) {
  var s = (seed === undefined ? Date.now() : seed) >>> 0;
  var count = 0;

  function next() {
    count++;
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    var t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next: next,

    /** int(max) → [0,max) ；int(min,max) → [min,max] */
    int: function (a, b) {
      if (b === undefined) { return Math.floor(next() * a); }
      return a + Math.floor(next() * (b - a + 1));
    },

    range: function (min, max) { return min + next() * (max - min); },

    pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },

    shuffle: function (arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(next() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    },

    /** weighted([{w, ...}]) → 按 w 加权随机取一项 */
    weighted: function (items) {
      var total = 0;
      for (var i = 0; i < items.length; i++) { total += items[i].w || 1; }
      var r = next() * total;
      for (var j = 0; j < items.length; j++) {
        r -= items[j].w || 1;
        if (r <= 0) { return items[j]; }
      }
      return items[items.length - 1];
    },

    /** 复现用：{ seed, count } */
    state: function () { return { seed: seed, count: count }; }
  };
}

module.exports = { create: create };
