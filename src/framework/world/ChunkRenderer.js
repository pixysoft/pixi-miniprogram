/**
 * ChunkRenderer — 分块渲染层（每 chunk 一个 Container + 瓦片 Sprite 池）
 * 与 ChunkWorld + Camera 组合：update(camera 偏移) → 驱动 world 加载并摆放 chunk 容器
 *
 * create(PIXI, world, opts) → { container, update(offX, offY, viewW, viewH), rebuild(cx,cy), destroy }
 *   opts: {
 *     tileSize,                     瓦片像素
 *     textureFor(tile, wx, wy),    瓦片 → 纹理（null 跳过，如海洋底色留给背景）
 *     pad=1                        视口外多渲染几圈瓦片（chunk 粒度）
 *   }
 * chunk 容器按需构建（world onLoad 后首次可见时），卸载即回收 Sprite 进池
 */

var LOG = '[ChunkRenderer]';

function key(cx, cy) { return cx + ',' + cy; }

function create(PIXI, world, opts) {
  opts = opts || {};
  var tileSize = opts.tileSize;
  var textureFor = opts.textureFor;
  var pad = opts.pad === undefined ? 1 : opts.pad;
  var chunkSize = world.chunkSize;
  var chunkPx = chunkSize * tileSize;

  var container = new PIXI.Container();
  container.eventMode = 'none';

  var built = {};      // key → { node, cx, cy }
  var spritePool = [];

  function acquire(tex) {
    var sp = spritePool.pop();
    if (sp) {
      sp.texture = tex;
      sp.visible = true;
      return sp;
    }
    return new PIXI.Sprite(tex);
  }

  function buildChunk(c) {
    var node = new PIXI.Container();
    node.x = c.cx * chunkPx;
    node.y = c.cy * chunkPx;
    for (var ly = 0; ly < chunkSize; ly++) {
      for (var lx = 0; lx < chunkSize; lx++) {
        var tile = c.tiles[ly * chunkSize + lx];
        var tex = textureFor(tile, c.cx * chunkSize + lx, c.cy * chunkSize + ly);
        if (!tex) { continue; }
        var sp = acquire(tex);
        sp.x = lx * tileSize;
        sp.y = ly * tileSize;
        sp.width = tileSize;
        sp.height = tileSize;
        node.addChild(sp);
      }
    }
    container.addChild(node);
    built[key(c.cx, c.cy)] = { node: node, cx: c.cx, cy: c.cy };
  }

  function releaseChunk(k) {
    var b = built[k];
    if (!b) { return; }
    // Sprite 回池（不销毁纹理）
    while (b.node.children.length) {
      var sp = b.node.children[b.node.children.length - 1];
      b.node.removeChild(sp);
      sp.visible = false;
      spritePool.push(sp);
    }
    container.removeChild(b.node);
    b.node.destroy();
    delete built[k];
  }

  return {
    container: container,

    /**
     * 每帧/相机移动时调用：offX/offY 为 Camera.getOffset()（世界像素）
     * 内部换算瓦片视口 → world.setViewTiles，并构建/回收 chunk 容器
     */
    update: function (offX, offY, viewW, viewH) {
      var padPx = pad * chunkPx;
      var x0 = Math.floor((offX - padPx) / tileSize);
      var y0 = Math.floor((offY - padPx) / tileSize);
      var x1 = Math.floor((offX + viewW + padPx) / tileSize);
      var y1 = Math.floor((offY + viewH + padPx) / tileSize);
      world.setViewTiles(x0, y0, x1, y1);

      // 已加载但未构建的 chunk → 构建；已卸载的 → 回收
      var liveKeys = {};
      world.eachLoaded(function (c) {
        var k = key(c.cx, c.cy);
        liveKeys[k] = true;
        if (!built[k]) { buildChunk(c); }
      });
      for (var k in built) {
        if (!liveKeys[k]) { releaseChunk(k); }
      }

      container.x = -offX + 0;   // +0 归一化 -0
      container.y = -offY + 0;
    },

    /** 瓦片数据变更后重建单个 chunk */
    rebuild: function (cx, cy) {
      var k = key(cx, cy);
      if (!built[k]) { return; }
      releaseChunk(k);
      var c = world.chunkAt(cx * chunkSize, cy * chunkSize);
      if (c && c.tiles) { buildChunk(c); }
    },

    builtCount: function () {
      var n = 0;
      for (var k in built) { n++; }
      return n;
    },

    destroy: function () {
      for (var k in built) { releaseChunk(k); }
      spritePool = [];
      try {
        container.destroy({ children: true });
      } catch (e) {
        console.warn(LOG, 'destroy', e);
      }
    }
  };
}

module.exports = { create: create };
