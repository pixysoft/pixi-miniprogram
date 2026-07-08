/**
 * PathFinder — 格子 A* 寻路（3.1 收编 Mr2/DAL 实现并集）
 *
 * find(canWalk, sx, sy, tx, ty, opts) → [{x, y}, ...] | null
 *   canWalk(x, y) → bool     碰撞注入（TileMap.walkable 可直接传）
 *   返回从起点「下一步」到终点的格序列（不含起点）；起点即终点返回 []；
 *   不可达返回 null。
 *
 * opts:
 *   diagonal=true       八方向（false = 四方向）
 *   maxSteps=256        路径长度上限（超出的分支剪掉）
 *   maxIterations=4000  搜索迭代上限（小规模场景线性扫 open 表足够）
 *   nearest=true        目标不可走时，自动找目标附近最近可走格（半径 3 内环扫）
 *
 * 另附 dirs(path, sx, sy) 工具：把格序列转为方向索引序列
 *   （八方向 0..7 = 下/左下/左/左上/上/右上/右/右下 — Mir 方向序习惯由调用方自行映射，
 *    此处返回 DIR8 表索引，表本身也一并导出）
 */

// 八方向增量：N NE E SE S SW W NW 顺时针（0 = 上）
var DIR8 = [
  [0, -1], [1, -1], [1, 0], [1, 1],
  [0, 1], [-1, 1], [-1, 0], [-1, -1]
];
var DIR4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function find(canWalk, sx, sy, tx, ty, opts) {
  opts = opts || {};
  var diagonal = opts.diagonal === undefined ? true : !!opts.diagonal;
  var maxSteps = opts.maxSteps || 256;
  var maxIterations = opts.maxIterations || 4000;
  var nearest = opts.nearest === undefined ? true : !!opts.nearest;
  var deltas = diagonal ? DIR8 : DIR4;

  if (sx === tx && sy === ty) { return []; }

  if (!canWalk(tx, ty)) {
    if (!nearest) { return null; }
    // 目标不可走：目标附近半径 1..3 环扫最近可走格
    var best = null;
    for (var r = 1; r <= 3 && !best; r++) {
      for (var d = 0; d < DIR8.length; d++) {
        var nx = tx + DIR8[d][0] * r;
        var ny = ty + DIR8[d][1] * r;
        if (canWalk(nx, ny)) {
          best = [nx, ny];
          break;
        }
      }
    }
    if (!best) { return null; }
    tx = best[0];
    ty = best[1];
    if (sx === tx && sy === ty) { return []; }
  }

  var open = [{ x: sx, y: sy, g: 0, f: 0, parent: null }];
  var visited = {};
  visited[sx + ',' + sy] = true;
  var found = null;
  var iterations = 0;

  while (open.length && iterations < maxIterations) {
    iterations++;
    // 取 f 最小（小规模场景线性扫足够；大地图交给 WASM/分层方案）
    var bi = 0;
    for (var i = 1; i < open.length; i++) {
      if (open[i].f < open[bi].f) { bi = i; }
    }
    var cur = open.splice(bi, 1)[0];
    if (cur.x === tx && cur.y === ty) {
      found = cur;
      break;
    }
    if (cur.g >= maxSteps) { continue; }
    for (var k = 0; k < deltas.length; k++) {
      var nx2 = cur.x + deltas[k][0];
      var ny2 = cur.y + deltas[k][1];
      var key = nx2 + ',' + ny2;
      if (visited[key] || !canWalk(nx2, ny2)) { continue; }
      visited[key] = true;
      var g = cur.g + 1;
      // 切比雪夫（八方向可采纳）/ 曼哈顿（四方向）
      var hx = Math.abs(tx - nx2);
      var hy = Math.abs(ty - ny2);
      var hCost = diagonal ? Math.max(hx, hy) : hx + hy;
      open.push({ x: nx2, y: ny2, g: g, f: g + hCost, parent: cur });
    }
  }

  if (!found) { return null; }
  var path = [];
  var node = found;
  while (node.parent) {
    path.unshift({ x: node.x, y: node.y });
    node = node.parent;
  }
  return path;
}

/** 格序列 → DIR8 方向索引序列（相邻格步进） */
function dirs(path, sx, sy) {
  var out = [];
  var px = sx;
  var py = sy;
  for (var i = 0; i < path.length; i++) {
    var dx = path[i].x - px;
    var dy = path[i].y - py;
    for (var d = 0; d < DIR8.length; d++) {
      if (DIR8[d][0] === dx && DIR8[d][1] === dy) {
        out.push(d);
        break;
      }
    }
    px = path[i].x;
    py = path[i].y;
  }
  return out;
}

module.exports = { find: find, dirs: dirs, DIR8: DIR8, DIR4: DIR4 };
