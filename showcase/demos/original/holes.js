/**
 * 原始功能演示 — Graphics 挖洞（beginHole / endHole）与越界洞修复
 * 背景：earcut 三角化要求洞完全在外轮廓内。越界洞（典型：全屏遮罩挖一个
 * 半径超出屏边的光圈）会让 earcut 退化——三角形丢失、甚至把洞画成实心。
 * 本仓库在 buildPoly.triangulate 前对洞点做外轮廓包围盒 clamp（贴边截断），
 * 越界弧段语义上本就无效，截断后输入恢复合法；界内洞零改动。
 * 现网案例：传奇小程序石墓七层"永暗光照"把玩家整个罩黑（2026-07 走查）。
 */
(function () {
  'use strict';

  Showcase.register({
    id: 'core-holes',
    group: 'core',
    title: 'Graphics 挖洞与越界修复',
    menuNote: 'beginHole · 越界洞 clamp · 地牢光照',
    subtitle: 'earcut 对"洞越出外轮廓"的输入会静默退化；适配层在三角化前对洞点做包围盒 clamp，越界光圈类遮罩恢复正确',
    mode: 'pixi',
    width: 480, height: 640,
    desc:
      '<p>三个横排样例，自左向右：</p>' +
      '<ul><li><b>界内洞</b>：矩形挖圆洞，洞后有旋转指针穿过——洞是真透的（回归基准，patch 不改变其行为）</li>' +
      '<li><b>越界洞（本次修复点）</b>：洞圆心贴外形右边缘、半径超出外形——修复前 earcut 退化只剩 2 个三角形' +
      '（大面积丢填充）或把洞画成实心；修复后洞被贴边截断，外形其余部分填充完整</li>' +
      '<li><b>地牢光照实例</b>：全屏暗幕 + 中心光圈（半径大于演示区宽），即传奇石墓七层同款场景，' +
      '点击画布任意处移动光圈——修复前这个写法会把中心罩成实心黑</li></ul>' +
      '<p>修复位置：<code>src/pixi.js buildPoly.triangulate</code>（搜 "pixi-miniprogram patch"）。' +
      '洞点按外轮廓包围盒收缩 1e-2 像素 clamp；界内洞坐标不受影响。</p>',
    code:
      "const g = new PIXI.Graphics()\n" +
      "g.beginFill(0x000000, 0.82)\n" +
      "g.drawRect(0, 0, W, H)        // 全屏暗幕\n" +
      "g.beginHole()\n" +
      "g.drawCircle(cx, cy, R)       // R 超出屏边也安全（patch 后）\n" +
      "g.endHole()\n" +
      "g.endFill()\n" +
      "\n" +
      "// patch 语义：洞点 clamp 进外轮廓包围盒，越界弧段贴边截断\n" +
      "// hp[j] = clamp(hp[j], obMin + ε, obMax - ε)",
    run: function (env) {
      var PIXI = env.PIXI;
      var W = env.designWidth;
      var H = Math.round(W * env.canvas.height / env.canvas.width);
      var renderer = PIXI.autoDetectRenderer({
        width: W, height: H, backgroundColor: 0x1a2030,
        premultipliedAlpha: true, preserveDrawingBuffer: true, view: env.canvas
      });
      var stage = new PIXI.Container();
      stage.eventMode = 'static';
      stage.hitArea = new PIXI.Rectangle(0, 0, W, H);

      function caption(txt, x, y, color) {
        var t = new PIXI.Text(txt, { fill: color || 0x8b94a8, fontSize: 22 });
        t.x = x; t.y = y;
        stage.addChild(t);
        return t;
      }

      /* ── 1. 界内洞（回归基准）：洞后指针可见 = 洞是真透的 ── */
      var box1 = new PIXI.Container();
      box1.x = 40; box1.y = 90;
      stage.addChild(box1);
      var needle = new PIXI.Graphics();   // 洞下层旋转指针
      needle.lineStyle(8, 0x4fc08d, 1);
      needle.moveTo(-70, 0);
      needle.lineTo(70, 0);
      needle.x = 100; needle.y = 100;
      box1.addChild(needle);
      var g1 = new PIXI.Graphics();
      g1.beginFill(0xE05B4B, 1);
      g1.drawRect(0, 0, 200, 200);
      g1.beginHole();
      g1.drawCircle(100, 100, 62);
      g1.endHole();
      g1.endFill();
      box1.addChild(g1);
      caption('界内洞（基准）', 60, 300);

      /* ── 2. 越界洞（修复点）：圆心贴右缘、半径超界 ── */
      var box2 = new PIXI.Container();
      box2.x = 280; box2.y = 90;
      stage.addChild(box2);
      var grid2 = new PIXI.Graphics();   // 底格：填充丢失时会露出来
      grid2.lineStyle(1, 0x3a4257, 1);
      for (var gx = 0; gx <= 200; gx += 20) { grid2.moveTo(gx, 0); grid2.lineTo(gx, 200); }
      for (var gy = 0; gy <= 200; gy += 20) { grid2.moveTo(0, gy); grid2.lineTo(200, gy); }
      box2.addChild(grid2);
      var g2 = new PIXI.Graphics();
      g2.beginFill(0xE8A33A, 1);
      g2.drawRect(0, 0, 200, 200);
      g2.beginHole();
      g2.drawCircle(200, 100, 130);   // 越界：圆心在右缘，130 > 可容纳半径
      g2.endHole();
      g2.endFill();
      box2.addChild(g2);
      caption('越界洞（修复点）', 300, 300);

      /* ── 3. 地牢光照实例：全区暗幕 + 超界光圈，点击移动 ── */
      var lightY = 360;
      var lightH = H - lightY - 70;
      var scene = new PIXI.Container();   // 被照亮的"地面"
      scene.x = 0; scene.y = lightY;
      stage.addChild(scene);
      var floor = new PIXI.Graphics();
      floor.beginFill(0x6b5a3e, 1);
      floor.drawRect(0, 0, W, lightH);
      floor.endFill();
      floor.lineStyle(1, 0x8a744e, 0.7);
      for (var fx = 0; fx <= W; fx += 44) { floor.moveTo(fx, 0); floor.lineTo(fx, lightH); }
      for (var fy = 0; fy <= lightH; fy += 44) { floor.moveTo(0, fy); floor.lineTo(W, fy); }
      scene.addChild(floor);
      for (var s = 0; s < 14; s++) {
        var dot = new PIXI.Graphics();
        dot.beginFill([0xc9a8ff, 0x6fd3ff, 0x4fc08d][s % 3], 1);
        dot.drawCircle(0, 0, 8 + (s % 3) * 4);
        dot.endFill();
        dot.x = 40 + (s * 137) % (W - 80);
        dot.y = 30 + (s * 89) % (lightH - 60);
        scene.addChild(dot);
      }
      var shade = new PIXI.Graphics();   // 暗幕（每次点击重画）
      scene.addChild(shade);
      var lit = { x: W / 2, y: lightH / 2, R: W * 0.55 };   // 半径 > 区宽一半 → 必越界
      function drawShade() {
        shade.clear();
        shade.beginFill(0x000000, 0.85);
        shade.drawRect(0, 0, W, lightH);
        shade.beginHole();
        shade.drawCircle(lit.x, lit.y, lit.R);
        shade.endHole();
        shade.endFill();
      }
      drawShade();
      caption('地牢光照（点击移动光圈；石墓七层同款写法）', 40, lightY + lightH + 16);

      stage.on('pointerdown', function (e) {
        var g = e.data.global;
        if (g.y >= lightY && g.y <= lightY + lightH) {
          lit.x = g.x;
          lit.y = g.y - lightY;
          drawShade();
        }
      });

      caption('Graphics 挖洞：beginHole / endHole', 40, 30, 0xdde3f0);

      env.animate(function () {
        needle.rotation += 0.02;
        renderer.render(stage);
      });
      return { renderer: renderer };
    }
  });
})();
