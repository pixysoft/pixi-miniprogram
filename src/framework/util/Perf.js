/**
 * Perf — 轻量性能探针（3.1 收编 Mr2/EggSoldier 版，改为工厂实例化 + onReport 钩子）
 *
 * 分段耗时 + 实体计数，窗口期（默认 10s）汇总输出一行，不刷屏。
 *
 * 用法：
 *   var perf = framework.Perf.create({ windowMs: 10000, onReport: fn? });
 *   app.onTick(function (dt) {
 *     var t0 = Date.now();
 *     battle.update(dt);
 *     perf.add('battle', Date.now() - t0);
 *     perf.setCounts({ 怪: mobs.length, 弹: bullets.length });
 *     perf.frame(Date.now(), dt);      // 每帧结尾调用
 *   });
 *
 * 输出示例：
 *   [Perf] 598帧 avg 16.7ms(≈60fps) max 42ms 慢帧(>50ms)=0 |
 *          battle=2.1/8 render=5.0/15 | 怪=120 弹=38
 * 读法：分段值为 均值/最大(ms)；总帧时间远大于各段之和 → 瓶颈在 GPU 或系统侧。
 *
 * opts:
 *   windowMs=10000   汇总窗口
 *   slowMs=50        慢帧阈值
 *   log=true         窗口期满 console.log
 *   onReport(report) 汇总回调（HUD 显示等）；report =
 *     { frames, avgMs, fps, maxMs, slow, segments: {name: {avg, max}}, counts }
 */

var LOG = '[Perf]';

function create(opts) {
  opts = opts || {};
  var windowMs = opts.windowMs === undefined ? 10000 : opts.windowMs;
  var slowMs = opts.slowMs === undefined ? 50 : opts.slowMs;
  var log = opts.log === undefined ? true : !!opts.log;

  var acc = {};        // name → { sum, max }
  var order = [];      // 分段插入顺序（保证打印列稳定）
  var counts = null;   // 最近一次实体计数
  var frames = 0;
  var dtSum = 0;
  var dtMax = 0;
  var slow = 0;
  var winStart = 0;
  var lastReport = null;

  function flush(now) {
    if (!frames) { return; }
    var avg = dtSum / frames;
    var fps = avg > 0 ? Math.round(1000 / avg) : 0;

    var segments = {};
    var parts = [];
    for (var i = 0; i < order.length; i++) {
      var k = order[i];
      var a = acc[k];
      segments[k] = { avg: a.sum / frames, max: a.max };
      parts.push(k + '=' + (a.sum / frames).toFixed(1) + '/' + a.max.toFixed(0));
    }

    lastReport = {
      frames: frames,
      avgMs: avg,
      fps: fps,
      maxMs: dtMax,
      slow: slow,
      segments: segments,
      counts: counts
    };

    if (log) {
      var line = LOG + ' ' + frames + '帧 avg ' + avg.toFixed(1) + 'ms(≈' + fps + 'fps) max ' +
        dtMax.toFixed(0) + 'ms 慢帧(>' + slowMs + 'ms)=' + slow;
      if (parts.length) { line += ' | ' + parts.join(' '); }
      if (counts) {
        var cs = [];
        for (var c in counts) {
          if (counts.hasOwnProperty(c)) { cs.push(c + '=' + counts[c]); }
        }
        line += ' | ' + cs.join(' ');
      }
      console.log(line);
    }
    if (opts.onReport) { opts.onReport(lastReport); }

    acc = {};
    order = [];
    frames = 0;
    dtSum = 0;
    dtMax = 0;
    slow = 0;
    winStart = now || 0;
  }

  return {
    /** 记录某段本帧耗时（ms） */
    add: function (name, ms) {
      var a = acc[name];
      if (!a) {
        a = acc[name] = { sum: 0, max: 0 };
        order.push(name);
      }
      a.sum += ms;
      if (ms > a.max) { a.max = ms; }
    },

    /** 记录实体数量（每帧覆盖，打印时取最近值） */
    setCounts: function (c) { counts = c; },

    /** 每帧结尾调用；窗口期满自动汇总 */
    frame: function (now, dtMs) {
      if (!winStart) { winStart = now; }
      frames++;
      dtSum += dtMs;
      if (dtMs > dtMax) { dtMax = dtMs; }
      if (dtMs > slowMs) { slow++; }
      if (now - winStart >= windowMs) { flush(now); }
    },

    /** 立即汇总（场景退出时冲刷） */
    flush: function () { flush(Date.now()); },

    /** 最近一次汇总结果（未满窗口前为 null） */
    last: function () { return lastReport; }
  };
}

module.exports = { create: create };
