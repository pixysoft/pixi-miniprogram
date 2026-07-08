/**
 * TileMap — 中小地图静态瓦片渲染（3.1 收编 DAL/UW TileMap，≤128×128 全量建 Sprite）
 *
 * 与 ChunkWorld 互补：ChunkWorld 面向无限/超大地图分块流式加载；
 * TileMap 面向 JSON 手写关卡（RPG 城镇/副本），一次全量构建，带碰撞表。
 *
 * 地图 JSON 约定：
 *   {
 *     legend: { '.': { tile: 'grass', walk: true },
 *               '#': { tile: 'wall',  walk: false, over: true, under: 'grass' }, ... },
 *     ground: [ '....##....', '..........', ... ]   // 字符行，每字符一格
 *   }
 *   legend 项：tile 纹理键 / walk 可走 / over 高层遮挡（角色从后面走过）/
 *              under 高层物脚下补的地面纹理键（缺省 'grass'）
 *
 * create(ctx, mapData, opts)
 *   ctx: { PIXI, textureFor(tileKey) → PIXI.Texture|null }   纹理由调用方解析
 *        （素材未就绪返回 null 时该格跳过 — 不阻塞玩法约定）
 *   opts: { tileSize = 32 }
 *
 * 返回 {
 *   width/height/tileSize/pixelWidth/pixelHeight
 *   groundLayer / overlayLayer     两层 Container（objects 层由场景在中间自建）
 *   walkable(x, y)                 含动态占位
 *   baseWalkable(x, y)             仅静态图例
 *   setBlocked(x, y, blocked)      动态占位（NPC 站位阻挡）
 *   tileAt(x, y) → legend 项 | null
 *   destroy()
 * }
 */

var LOG = '[TileMap]';

function create(ctx, mapData, opts) {
  var PIXI = ctx.PIXI;
  var textureFor = ctx.textureFor;
  opts = opts || {};
  var TS = opts.tileSize || 32;

  var legend = mapData.legend || {};
  var rows = mapData.ground || [];
  var h = rows.length;
  var w = h ? rows[0].length : 0;

  var groundLayer = new PIXI.Container();
  var overlayLayer = new PIXI.Container();
  var collision = [];   // [y][x] true = 可走

  function put(layer, key, x, y) {
    var tex = textureFor(key);
    if (!tex) { return; }   // 素材缺失不阻塞
    var spr = new PIXI.Sprite(tex);
    spr.x = x * TS;
    spr.y = y * TS;
    spr.width = TS;
    spr.height = TS;
    layer.addChild(spr);
  }

  for (var y = 0; y < h; y++) {
    collision.push([]);
    var line = rows[y];
    for (var x = 0; x < w; x++) {
      var ch = line.charAt(x);
      var def = legend[ch] || legend['.'] || {};
      collision[y].push(!!def.walk);

      if (def.over) {
        // 高层遮挡物：脚下补地面
        put(groundLayer, def.under || 'grass', x, y);
        put(overlayLayer, def.tile, x, y);
      } else {
        put(groundLayer, def.tile, x, y);
      }
    }
  }

  console.log(LOG, 'built', w + 'x' + h);

  function inRange(x, y) {
    return x >= 0 && y >= 0 && x < w && y < h;
  }

  var api = {
    width: w,
    height: h,
    tileSize: TS,
    pixelWidth: w * TS,
    pixelHeight: h * TS,
    groundLayer: groundLayer,
    overlayLayer: overlayLayer,

    walkable: function (x, y) {
      if (!inRange(x, y)) { return false; }
      return collision[y][x];
    },

    baseWalkable: function (x, y) {
      if (!inRange(x, y)) { return false; }
      var def = legend[rows[y].charAt(x)] || legend['.'] || {};
      return !!def.walk;
    },

    /** 动态占位（NPC 站位阻挡）：解除时恢复静态图例值 */
    setBlocked: function (x, y, blocked) {
      if (!inRange(x, y)) { return; }
      collision[y][x] = blocked ? false : api.baseWalkable(x, y);
    },

    tileAt: function (x, y) {
      if (!inRange(x, y)) { return null; }
      return legend[rows[y].charAt(x)] || null;
    },

    destroy: function () {
      groundLayer.destroy({ children: true });
      overlayLayer.destroy({ children: true });
    }
  };

  return api;
}

module.exports = { create: create };
