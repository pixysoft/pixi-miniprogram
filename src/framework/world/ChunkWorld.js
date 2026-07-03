/**
 * ChunkWorld — 分块世界数据（大航海 2.0 无限大陆前置；协议对齐 BrickCraft ChunkProvider）
 * chunk 默认 32×32 瓦片；视口外 keepRing 圈即卸载，内存不随移动增长
 *
 * ChunkProvider 协议（游戏侧实现，seed 生成 / 远程 / 预烘焙均可）：
 *   provider.getChunk(cx, cy, cb(tiles|null))   tiles = 长度 chunkSize² 的数组（行优先）
 *   provider.unloadChunk?(cx, cy)               可选卸载钩子（脏数据冲刷）
 *
 * create(provider, opts { chunkSize=32, keepRing=2, onLoad(cx,cy), onUnload(cx,cy) }) → {
 *   getTile(wx, wy)                瓦片坐标取值；chunk 未加载返回 undefined
 *   setTile(wx, wy, v)             写回（仅已加载 chunk；持久化由 provider 侧负责）
 *   setViewTiles(x0, y0, x1, y1)   视口瓦片范围驱动加载/卸载
 *   chunkAt(wx, wy) / loadedCount() / eachLoaded(fn)
 * }
 *
 * 1.0 静态全图包装：staticProvider(tiles, mapW, mapH, chunkSize)
 * （`region:classic` 预烘焙 chunk 源即用它包装 B64 解码结果）
 */

var LOG = '[ChunkWorld]';

function key(cx, cy) { return cx + ',' + cy; }

function create(provider, opts) {
  opts = opts || {};
  var chunkSize = opts.chunkSize || 32;
  var keepRing = opts.keepRing === undefined ? 2 : opts.keepRing;

  var chunks = {};    // key → { cx, cy, tiles, loading }
  var view = null;    // { c0x, c0y, c1x, c1y } 视口覆盖的 chunk 范围

  function chunkCoord(w) { return Math.floor(w / chunkSize); }

  function load(cx, cy) {
    var k = key(cx, cy);
    if (chunks[k]) { return; }
    var entry = { cx: cx, cy: cy, tiles: null, loading: true };
    chunks[k] = entry;
    provider.getChunk(cx, cy, function (tiles) {
      // 等待期间可能已被卸载
      if (chunks[k] !== entry) { return; }
      entry.tiles = tiles;
      entry.loading = false;
      if (opts.onLoad) { opts.onLoad(cx, cy); }
    });
  }

  function unload(cx, cy) {
    var k = key(cx, cy);
    if (!chunks[k]) { return; }
    delete chunks[k];
    if (provider.unloadChunk) { provider.unloadChunk(cx, cy); }
    if (opts.onUnload) { opts.onUnload(cx, cy); }
  }

  return {
    chunkSize: chunkSize,

    getTile: function (wx, wy) {
      var c = chunks[key(chunkCoord(wx), chunkCoord(wy))];
      if (!c || !c.tiles) { return undefined; }
      var lx = wx - c.cx * chunkSize;
      var ly = wy - c.cy * chunkSize;
      return c.tiles[ly * chunkSize + lx];
    },

    setTile: function (wx, wy, v) {
      var c = chunks[key(chunkCoord(wx), chunkCoord(wy))];
      if (!c || !c.tiles) { return false; }
      var lx = wx - c.cx * chunkSize;
      var ly = wy - c.cy * chunkSize;
      c.tiles[ly * chunkSize + lx] = v;
      return true;
    },

    chunkAt: function (wx, wy) {
      return chunks[key(chunkCoord(wx), chunkCoord(wy))] || null;
    },

    /**
     * 视口瓦片范围（含边界）驱动：范围内加载，范围外 keepRing 圈之外卸载
     */
    setViewTiles: function (x0, y0, x1, y1) {
      var c0x = chunkCoord(x0);
      var c0y = chunkCoord(y0);
      var c1x = chunkCoord(x1);
      var c1y = chunkCoord(y1);
      view = { c0x: c0x, c0y: c0y, c1x: c1x, c1y: c1y };

      for (var cy = c0y; cy <= c1y; cy++) {
        for (var cx = c0x; cx <= c1x; cx++) { load(cx, cy); }
      }
      // 卸载 keepRing 圈外的
      for (var k in chunks) {
        var c = chunks[k];
        if (c.cx < c0x - keepRing || c.cx > c1x + keepRing ||
            c.cy < c0y - keepRing || c.cy > c1y + keepRing) {
          unload(c.cx, c.cy);
        }
      }
    },

    loadedCount: function () {
      var n = 0;
      for (var k in chunks) {
        if (chunks[k].tiles) { n++; }
      }
      return n;
    },

    eachLoaded: function (fn) {
      for (var k in chunks) {
        var c = chunks[k];
        if (c.tiles) { fn(c); }
      }
    },

    clear: function () {
      for (var k in chunks) { unload(chunks[k].cx, chunks[k].cy); }
      view = null;
    }
  };
}

/** 1.0 静态全图包装为 ChunkProvider（范围外瓦片回 fill，默认 0） */
function staticProvider(tiles, mapW, mapH, chunkSize, fill) {
  chunkSize = chunkSize || 32;
  fill = fill === undefined ? 0 : fill;
  return {
    getChunk: function (cx, cy, cb) {
      var out = new Array(chunkSize * chunkSize);
      for (var ly = 0; ly < chunkSize; ly++) {
        for (var lx = 0; lx < chunkSize; lx++) {
          var wx = cx * chunkSize + lx;
          var wy = cy * chunkSize + ly;
          out[ly * chunkSize + lx] =
            (wx >= 0 && wx < mapW && wy >= 0 && wy < mapH) ? tiles[wy * mapW + wx] : fill;
        }
      }
      cb(out);
    }
  };
}

module.exports = { create: create, staticProvider: staticProvider };
