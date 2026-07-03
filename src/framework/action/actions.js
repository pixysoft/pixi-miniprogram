/**
 * actions — 组合式动作系统（借鉴 cocos Action：Sequence/Spawn/Repeat + Ease 装饰）
 * 帧驱动：App 主循环调用 actions.update(dt)，不依赖 setTimeout/Date
 *
 * 动作描述为纯对象（声明式），run 时实例化：
 *   actions.run(sprite, actions.sequence(
 *     actions.moveTo(300, { x: 100, y: 200 }, easing.quadOut),
 *     actions.call(fn)
 *   ));
 *   actions.stop(sprite);
 */

var easing = require('./easing.js');

// ===== 动作描述工厂 =====

function propsTo(duration, props, ease) {
  return { kind: 'tween', duration: duration, props: props, ease: ease || easing.linear };
}

function moveTo(duration, pos, ease) {
  var p = {};
  if (pos.x !== undefined) { p.x = pos.x; }
  if (pos.y !== undefined) { p.y = pos.y; }
  return propsTo(duration, p, ease);
}

function scaleTo(duration, scale, ease) {
  return { kind: 'tween', duration: duration, props: { __scale: scale }, ease: ease || easing.linear };
}

function fadeTo(duration, alpha, ease) {
  return propsTo(duration, { alpha: alpha }, ease);
}

function rotateTo(duration, rotation, ease) {
  return propsTo(duration, { rotation: rotation }, ease);
}

/** 三次贝塞尔曲线移动（起点 = 运行时当前位置）；cp1/cp2/end = { x, y } */
function bezierTo(duration, cp1, cp2, end, ease) {
  return { kind: 'bezier', duration: duration, cp1: cp1, cp2: cp2, end: end, ease: ease || easing.linear };
}

/** Cardinal 样条穿点移动（cocos CardinalSplineTo 公式）；points = [{x,y},...] */
function splineTo(duration, points, ease, tension) {
  return {
    kind: 'spline', duration: duration, points: points,
    ease: ease || easing.linear,
    tension: tension === undefined ? 0.5 : tension
  };
}

function delay(duration) {
  return { kind: 'delay', duration: duration };
}

function call(fn) {
  return { kind: 'call', fn: fn };
}

function sequence() {
  return { kind: 'sequence', children: Array.prototype.slice.call(arguments) };
}

function spawn() {
  return { kind: 'spawn', children: Array.prototype.slice.call(arguments) };
}

function repeat(action, times) {
  return { kind: 'repeat', child: action, times: times };
}

function forever(action) {
  return { kind: 'repeat', child: action, times: Infinity };
}

// ===== 运行时 =====

/** 实例化：desc（可复用的纯对象）→ runner（有状态） */
function instantiate(desc, target) {
  switch (desc.kind) {
    case 'tween':
      return {
        elapsed: 0,
        start: null,
        step: function (dt) {
          if (this.start === null) {
            this.start = {};
            for (var k in desc.props) {
              this.start[k] = k === '__scale' ? target.scale.x : target[k];
            }
          }
          this.elapsed += dt;
          var t = desc.duration <= 0 ? 1 : Math.min(1, this.elapsed / desc.duration);
          var r = desc.ease(t);
          for (var p in desc.props) {
            var v = this.start[p] + (desc.props[p] - this.start[p]) * r;
            if (p === '__scale') { target.scale.set(v); } else { target[p] = v; }
          }
          return t >= 1;
        }
      };
    case 'bezier':
      return {
        elapsed: 0,
        p0: null,
        step: function (dt) {
          if (this.p0 === null) { this.p0 = { x: target.x, y: target.y }; }
          this.elapsed += dt;
          var t = desc.duration <= 0 ? 1 : Math.min(1, this.elapsed / desc.duration);
          var r = desc.ease(t);
          var u = 1 - r;
          // B(t) = u³p0 + 3u²r·cp1 + 3ur²·cp2 + r³·end
          target.x = u * u * u * this.p0.x + 3 * u * u * r * desc.cp1.x + 3 * u * r * r * desc.cp2.x + r * r * r * desc.end.x;
          target.y = u * u * u * this.p0.y + 3 * u * u * r * desc.cp1.y + 3 * u * r * r * desc.cp2.y + r * r * r * desc.end.y;
          return t >= 1;
        }
      };
    case 'spline':
      return {
        elapsed: 0,
        pts: null,
        step: function (dt) {
          if (this.pts === null) {
            this.pts = [{ x: target.x, y: target.y }].concat(desc.points);
          }
          this.elapsed += dt;
          var t = desc.duration <= 0 ? 1 : Math.min(1, this.elapsed / desc.duration);
          var r = desc.ease(t);
          var pts = this.pts;
          if (t >= 1) {   // 终点精确落点
            target.x = pts[pts.length - 1].x;
            target.y = pts[pts.length - 1].y;
            return true;
          }
          var segs = pts.length - 1;
          var pos = Math.min(segs - 1e-9, r * segs);
          var i = Math.floor(pos);
          var lt = pos - i;
          // Cardinal spline（cocos ccCardinalSplineAt）：tension 0.5 = Catmull-Rom
          var p0 = pts[Math.max(0, i - 1)];
          var p1 = pts[i];
          var p2 = pts[Math.min(pts.length - 1, i + 1)];
          var p3 = pts[Math.min(pts.length - 1, i + 2)];
          var s = (1 - desc.tension) / 2;
          var t2 = lt * lt;
          var t3 = t2 * lt;
          var b1 = s * (-t3 + 2 * t2 - lt);
          var b2 = s * (-t3 + t2) + (2 * t3 - 3 * t2 + 1);
          var b3 = s * (t3 - 2 * t2 + lt) + (-2 * t3 + 3 * t2);
          var b4 = s * (t3 - t2);
          target.x = p0.x * b1 + p1.x * b2 + p2.x * b3 + p3.x * b4;
          target.y = p0.y * b1 + p1.y * b2 + p2.y * b3 + p3.y * b4;
          return t >= 1;
        }
      };
    case 'delay':
      return {
        elapsed: 0,
        step: function (dt) {
          this.elapsed += dt;
          return this.elapsed >= desc.duration;
        }
      };
    case 'call':
      return {
        step: function () {
          desc.fn(target);
          return true;
        }
      };
    case 'sequence':
      return {
        idx: 0,
        cur: null,
        step: function (dt) {
          while (this.idx < desc.children.length) {
            if (!this.cur) { this.cur = instantiate(desc.children[this.idx], target); }
            if (!this.cur.step(dt)) { return false; }
            this.cur = null;
            this.idx++;
            dt = 0;  // 剩余时间不跨动作透支，保持实现简单
          }
          return true;
        }
      };
    case 'spawn':
      return {
        runners: null,
        step: function (dt) {
          if (!this.runners) {
            this.runners = desc.children.map(function (c) { return instantiate(c, target); });
          }
          var allDone = true;
          for (var i = 0; i < this.runners.length; i++) {
            if (this.runners[i] && !this.runners[i].step(dt)) {
              allDone = false;
            } else {
              this.runners[i] = null;
            }
          }
          return allDone;
        }
      };
    case 'repeat':
      return {
        count: 0,
        cur: null,
        step: function (dt) {
          while (this.count < desc.times) {
            if (!this.cur) { this.cur = instantiate(desc.child, target); }
            if (!this.cur.step(dt)) { return false; }
            this.cur = null;
            this.count++;
            dt = 0;
            if (desc.times === Infinity) { return false; }  // 无限循环每帧最多跑一轮
          }
          return true;
        }
      };
    default:
      console.warn('[actions] unknown kind', desc.kind);
      return { step: function () { return true; } };
  }
}

function createManager() {
  var running = [];   // { target, runner, done }

  return {
    /** 在 target 上运行动作；返回句柄 { cancel() } */
    run: function (target, desc, onDone) {
      var entry = { target: target, runner: instantiate(desc, target), onDone: onDone || null, dead: false };
      running.push(entry);
      return {
        cancel: function () { entry.dead = true; }
      };
    },

    /** 停止 target 上全部动作 */
    stop: function (target) {
      for (var i = 0; i < running.length; i++) {
        if (running[i].target === target) { running[i].dead = true; }
      }
    },

    update: function (dt) {
      if (!running.length) { return; }
      var alive = [];
      var snapshot = running.slice();
      for (var i = 0; i < snapshot.length; i++) {
        var e = snapshot[i];
        if (e.dead) { continue; }
        // target 已销毁（Pixi destroy 后 transform 为 null）自动停止
        if (!e.target || e.target.destroyed || e.target.transform === null) { e.dead = true; continue; }
        if (e.runner.step(dt)) {
          e.dead = true;
          if (e.onDone) { e.onDone(e.target); }
        }
      }
      for (var j = 0; j < running.length; j++) {
        if (!running[j].dead) { alive.push(running[j]); }
      }
      running = alive;
    },

    clear: function () { running = []; },

    count: function () { return running.length; }
  };
}

module.exports = {
  createManager: createManager,
  propsTo: propsTo,
  moveTo: moveTo,
  scaleTo: scaleTo,
  fadeTo: fadeTo,
  rotateTo: rotateTo,
  bezierTo: bezierTo,
  splineTo: splineTo,
  delay: delay,
  call: call,
  sequence: sequence,
  spawn: spawn,
  repeat: repeat,
  forever: forever
};
