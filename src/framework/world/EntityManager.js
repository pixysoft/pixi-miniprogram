/**
 * EntityManager Lite — 世界实体注册表（非 ECS，明确不做组件系统）
 * 用途：地图上 N 艘 NPC/玩家船、多人同屏他船平滑移动
 *
 * create(opts { layer? }) → {
 *   spawn(id, ent)      ent = { sprite?, x=0, y=0, update?(dt, ent) }
 *                       挂 ent.syncTo(x, y, ms)（多人位置插值，服务器 tick 间平滑）
 *   get(id) / has(id)
 *   despawn(id, { destroySprite=true })
 *   each(fn) / count()
 *   update(dt)          推进插值与实体自定义 update，同步 sprite 坐标
 *   clear()
 * }
 * 传入 layer 时 spawn/despawn 自动 addChild/removeChild sprite
 */

var LOG = '[EntityManager]';

function create(opts) {
  opts = opts || {};
  var layer = opts.layer || null;
  var entities = {};   // id → ent
  var count = 0;

  return {
    spawn: function (id, ent) {
      if (entities[id]) {
        console.warn(LOG, 'duplicate id, despawn first:', id);
        this.despawn(id);
      }
      ent = ent || {};
      ent.id = id;
      ent.x = ent.x || 0;
      ent.y = ent.y || 0;
      ent.__sync = null;   // { fromX, fromY, toX, toY, t, dur }

      /** 位置插值：ms 内平滑移动到 (x, y)；ms<=0 直接落点 */
      ent.syncTo = function (x, y, ms) {
        if (!ms || ms <= 0) {
          ent.x = x;
          ent.y = y;
          ent.__sync = null;
          return;
        }
        ent.__sync = { fromX: ent.x, fromY: ent.y, toX: x, toY: y, t: 0, dur: ms };
      };

      if (ent.sprite) {
        ent.sprite.x = ent.x;
        ent.sprite.y = ent.y;
        if (layer) { layer.addChild(ent.sprite); }
      }
      entities[id] = ent;
      count++;
      return ent;
    },

    get: function (id) { return entities[id] || null; },

    has: function (id) { return !!entities[id]; },

    despawn: function (id, o) {
      var ent = entities[id];
      if (!ent) { return; }
      delete entities[id];
      count--;
      if (ent.sprite) {
        if (layer) { layer.removeChild(ent.sprite); }
        if (!o || o.destroySprite !== false) {
          try { ent.sprite.destroy(); } catch (e) { /* noop */ }
        }
      }
    },

    each: function (fn) {
      for (var id in entities) { fn(entities[id]); }
    },

    count: function () { return count; },

    update: function (dt) {
      for (var id in entities) {
        var ent = entities[id];
        if (ent.__sync) {
          var s = ent.__sync;
          s.t += dt;
          var r = Math.min(1, s.t / s.dur);
          ent.x = s.fromX + (s.toX - s.fromX) * r;
          ent.y = s.fromY + (s.toY - s.fromY) * r;
          if (r >= 1) { ent.__sync = null; }
        }
        if (ent.update) { ent.update(dt, ent); }
        if (ent.sprite) {
          ent.sprite.x = ent.x;
          ent.sprite.y = ent.y;
        }
      }
    },

    clear: function () {
      for (var id in entities) { this.despawn(id); }
    }
  };
}

module.exports = { create: create };
