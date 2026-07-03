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
  delay: delay,
  call: call,
  sequence: sequence,
  spawn: spawn,
  repeat: repeat,
  forever: forever
};
