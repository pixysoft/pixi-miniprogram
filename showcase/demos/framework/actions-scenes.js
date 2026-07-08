/**
 * framework 演示 — 动作系统 / 场景栈与转场 / Layout 锚点布局
 */
(function () {
  'use strict';

  /* ============ actions 动作系统 ============ */
  Showcase.register({
    id: 'fw-actions',
    group: 'fw',
    title: 'actions 组合式动作',
    menuNote: 'sequence · spawn · bezier · spline',
    subtitle: '借鉴 cocos Action：声明式纯对象描述，run 时实例化，主循环 dt 驱动，目标销毁自动停止',
    desc:
      '<ul><li><b>sequence + repeat</b>：红球在两点间用不同缓动往返（forever）</li>' +
      '<li><b>spawn 并行</b>：绿块移动同时旋转 + 半透明</li>' +
      '<li><b>bezierTo</b>（3.0 P1）：蓝球沿三次贝塞尔曲线飞行（青色轨迹为控制点连线）</li>' +
      '<li><b>splineTo</b>（3.0 P1）：黄球穿过 4 个路径点的 Catmull-Rom 样条（cocos CardinalSplineTo 公式）</li>' +
      '<li>动作描述是纯对象，可复用；<code>actions.stop(target)</code> / 句柄 <code>cancel()</code> 随时停</li></ul>',
    code:
      "const A = framework.actions, E = framework.easing\n" +
      "\n" +
      "game.app.actions.run(ball, A.forever(A.sequence(\n" +
      "  A.moveTo(1200, { x: 600 }, E.quadInOut),\n" +
      "  A.moveTo(1200, { x: 40 }, E.backOut)\n" +
      ")))\n" +
      "\n" +
      "game.app.actions.run(box, A.spawn(          // 并行\n" +
      "  A.moveTo(900, { y: 500 }),\n" +
      "  A.rotateTo(900, Math.PI * 2),\n" +
      "  A.fadeTo(900, 0.4)\n" +
      "))\n" +
      "\n" +
      "A.bezierTo(1500, cp1, cp2, end, E.sineInOut)          // 曲线\n" +
      "A.splineTo(2000, [{x,y}, ...], E.linear, 0.5)          // 样条穿点",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x14171F });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var A = env.framework.actions;
      var E = env.framework.easing;
      var W = game.W;

      function section(text, y) {
        var t = ui.label(text, { size: 26, color: 0x8b94a8 });
        t.x = 40; t.y = y;
        game.stage.addChild(t);
      }

      // 1. sequence + forever
      section('sequence + forever（两段不同缓动）', 40);
      var ball = new PIXI.Sprite(game.tc.circle(26, 0xE05B4B));
      ball.x = 40; ball.y = 100;
      game.stage.addChild(ball);
      game.app.actions.run(ball, A.forever(A.sequence(
        A.moveTo(1100, { x: W - 100 }, E.quadInOut),
        A.moveTo(1100, { x: 40 }, E.backOut)
      )));

      // 2. spawn
      section('spawn 并行（移动 + 旋转 + 淡出，点击重播）', 220);
      var box = new PIXI.Sprite(game.tc.panel(70, 70, 0x4fc08d, 1, 14));
      box.anchor && box.anchor.set(0.5);
      game.stage.addChild(box);
      function playSpawn() {
        box.x = 80; box.y = 320; box.alpha = 1; box.rotation = 0;
        game.app.actions.stop(box);
        game.app.actions.run(box, A.sequence(
          A.spawn(
            A.moveTo(1300, { x: W - 110 }, E.sineInOut),
            A.rotateTo(1300, Math.PI * 2),
            A.fadeTo(1300, 0.35)
          ),
          A.delay(400),
          A.call(playSpawn)
        ));
      }
      playSpawn();
      box.eventMode = 'static';
      box.on('pointerdown', playSpawn);

      // 3. bezierTo
      section('bezierTo 三次贝塞尔', 430);
      var bz = new PIXI.Sprite(game.tc.circle(22, 0x4f8cff));
      game.stage.addChild(bz);
      var p0 = { x: 60, y: 560 };
      var cp1 = { x: 240, y: 460 };
      var cp2 = { x: 460, y: 660 };
      var pEnd = { x: W - 90, y: 520 };
      var guide = new PIXI.Graphics();
      guide.lineStyle(2, 0x2a3a55, 1);
      guide.moveTo(p0.x, p0.y);
      guide.lineTo(cp1.x, cp1.y);
      guide.lineTo(cp2.x, cp2.y);
      guide.lineTo(pEnd.x, pEnd.y);
      [cp1, cp2].forEach(function (p) {
        guide.beginFill(0x2a3a55);
        guide.drawCircle(p.x, p.y, 6);
        guide.endFill();
      });
      game.stage.addChild(guide);
      function playBezier() {
        bz.x = p0.x; bz.y = p0.y;
        game.app.actions.run(bz, A.sequence(
          A.bezierTo(1600, cp1, cp2, pEnd, E.sineInOut),
          A.delay(300),
          A.call(playBezier)
        ));
      }
      playBezier();

      // 4. splineTo
      section('splineTo Catmull-Rom 样条穿点', 700);
      var pts = [
        { x: 200, y: 900 }, { x: 360, y: 780 }, { x: 520, y: 920 }, { x: W - 80, y: 800 }
      ];
      var g2 = new PIXI.Graphics();
      pts.forEach(function (p) {
        g2.beginFill(0x2a3a55);
        g2.drawCircle(p.x, p.y, 8);
        g2.endFill();
      });
      game.stage.addChild(g2);
      var sp = new PIXI.Sprite(game.tc.circle(22, 0xFFD166));
      game.stage.addChild(sp);
      function playSpline() {
        sp.x = 60; sp.y = 840;
        game.app.actions.run(sp, A.sequence(
          A.splineTo(2200, pts, E.linear, 0.5),
          A.delay(300),
          A.call(playSpline)
        ));
      }
      playSpline();

      game.app.start();
      return { game: game };
    }
  });

  /* ============ SceneManager + transitions ============ */
  Showcase.register({
    id: 'fw-scenes',
    group: 'fw',
    title: 'SceneManager 场景栈 + fade 转场',
    menuNote: 'push/pop/replace · 转场吞触摸（3.0 P0）',
    subtitle: '工厂注册制场景栈；transitions.fade 内置 phase 状态机转场，变黑期间吞触摸防连点',
    desc:
      '<ul><li><b>replace</b>：主城 ↔ 战斗 互相替换（栈底更换）</li>' +
      '<li><b>push / pop</b>：从任意场景压入「背包」，返回时恢复原场景（enter/exit 钩子日志见画布底部）</li>' +
      '<li><b>transitions.fade</b>：160ms 变黑 → 切场景 → 变亮；转场中触摸被 overlay 吞掉；变黑中再次切换会覆盖切换意图</li></ul>',
    code:
      "game.scenes.register('city', () => makeCityScene())\n" +
      "game.scenes.register('battle', () => makeBattleScene())\n" +
      "game.scenes.setTransition(framework.transitions.fade(game.app, { duration: 200 }))\n" +
      "\n" +
      "game.scenes.replace('battle')       // 替换栈顶\n" +
      "game.scenes.push('bag')             // 压栈（原场景 exit）\n" +
      "game.scenes.pop()                   // 弹栈恢复\n" +
      "\n" +
      "// 场景协议：{ container, enter(params), exit(), update(dt) }",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x0d1017 });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var fw = env.framework;
      var W = game.W;
      var H = game.H;

      var logLines = [];
      var logLabel = ui.label('', { size: 20, color: 0x8b94a8 });
      logLabel.x = 40; logLabel.y = H - 170;

      function log(s) {
        logLines.push(s);
        if (logLines.length > 4) { logLines.shift(); }
        logLabel.text = logLines.join('\n');
      }

      function makeScene(name, color, accent) {
        var c = new PIXI.Container();
        var bg = new PIXI.Sprite(game.tc.panel(W, H, color, 1, 0));
        c.addChild(bg);
        var big = ui.label(name, { size: 72, bold: true, color: accent });
        big.x = (W - big.width) / 2; big.y = 200;
        c.addChild(big);
        var deco = new PIXI.Sprite(game.tc.circle(80, accent, 0.25));
        deco.x = W / 2 - 80; deco.y = 340;
        c.addChild(deco);
        var t = 0;
        return {
          container: c,
          enter: function () { log('[' + name + '] enter'); },
          exit: function () { log('[' + name + '] exit'); },
          update: function (dt) {
            t += dt;
            deco.y = 340 + Math.sin(t / 400) * 20;
          }
        };
      }

      game.scenes.register('city', function () { return makeScene('主城', 0x1B2A40, 0x6fd3ff); });
      game.scenes.register('battle', function () { return makeScene('战斗', 0x40201B, 0xE05B4B); });
      game.scenes.register('bag', function () { return makeScene('背包(push)', 0x1B402A, 0x4fc08d); });
      game.scenes.setTransition(fw.transitions.fade(game.app, { duration: 200 }));
      game.scenes.replace('city');

      var bCity = ui.button('replace 主城', 260, 84, {
        onTap: function () { game.scenes.replace('city'); }
      });
      bCity.x = 40; bCity.y = H - 320;
      game.stage.addChild(bCity);
      var bBattle = ui.button('replace 战斗', 260, 84, {
        skin: { bg: { color: 0xE05B4B } },
        onTap: function () { game.scenes.replace('battle'); }
      });
      bBattle.x = 320; bBattle.y = H - 320;
      game.stage.addChild(bBattle);
      var bPush = ui.button('push 背包', 260, 84, {
        skin: { bg: { color: 0x4fc08d } },
        onTap: function () { game.scenes.push('bag'); }
      });
      bPush.x = 40; bPush.y = H - 220;
      game.stage.addChild(bPush);
      var bPop = ui.button('pop 返回', 260, 84, {
        skin: { bg: { color: 0xE8A33A } },
        onTap: function () { game.scenes.pop(); }
      });
      bPop.x = 320; bPop.y = H - 220;
      game.stage.addChild(bPop);

      game.stage.addChild(logLabel);
      game.app.start();
      return { game: game };
    }
  });

  /* ============ Layout 锚点布局 ============ */
  Showcase.register({
    id: 'fw-layout',
    group: 'fw',
    title: 'Layout 锚点布局',
    menuNote: 'left/right/center · 百分比 · relayout（3.0 P0）',
    subtitle: '借鉴 Egret BasicLayout 定位优先级（centerX > left > right），单层求解 + relayout 手动触发',
    desc:
      '<ul><li>虚线框是布局容器（bounds），点按钮改变 bounds 宽度后 <code>relayout()</code> — 所有元素按锚点规则重排</li>' +
      '<li><b>left+right 同给</b>：顶栏自动拉伸填满</li>' +
      '<li><b>w 用小数</b>：中央面板宽 = bounds 的 70%</li>' +
      '<li><b>right/bottom</b>：右下角按钮贴边</li></ul>',
    code:
      "const L = framework.Layout\n" +
      "\n" +
      "L.attach(topBar, { left: 20, right: 20, top: 20, h: 90 }, bounds)   // 拉伸\n" +
      "L.attach(panel, { centerX: 0, centerY: 0, w: 0.7, h: 300 }, bounds) // 70% 宽\n" +
      "L.attach(okBtn, { right: 20, bottom: 20 }, bounds)                  // 贴右下\n" +
      "\n" +
      "bounds.w = 520\n" +
      "topBar.relayout(bounds)   // bounds 变化后手动触发",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x14171F });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var L = env.framework.Layout;
      var W = game.W;

      var bounds = { w: W - 120, h: 700 };
      var root = new PIXI.Container();
      root.x = 60; root.y = 120;
      game.stage.addChild(root);

      var frame = new PIXI.Graphics();
      root.addChild(frame);
      function drawFrame() {
        frame.clear();
        frame.lineStyle(2, 0x4f8cff, 0.5);
        var dash = 14;
        for (var x = 0; x < bounds.w; x += dash * 2) {
          frame.moveTo(x, 0); frame.lineTo(Math.min(x + dash, bounds.w), 0);
          frame.moveTo(x, bounds.h); frame.lineTo(Math.min(x + dash, bounds.w), bounds.h);
        }
        for (var y = 0; y < bounds.h; y += dash * 2) {
          frame.moveTo(0, y); frame.lineTo(0, Math.min(y + dash, bounds.h));
          frame.moveTo(bounds.w, y); frame.lineTo(bounds.w, Math.min(y + dash, bounds.h));
        }
      }
      drawFrame();

      var topBar = new PIXI.Sprite(game.tc.panel(100, 90, 0x25304a, 1, 14));
      root.addChild(topBar);
      var topLabel = ui.label('left:20 + right:20 → 拉伸', { size: 24 });
      topLabel.x = 20; topLabel.y = 30;
      topBar.addChild(topLabel);

      var panel = new PIXI.Sprite(game.tc.panel(100, 280, 0x1a2030, 1, 18));
      root.addChild(panel);
      var pLabel = ui.label('centerX/centerY + w:0.7（70%）', { size: 24, color: 0x9ecbff });
      pLabel.x = 20; pLabel.y = 20;
      panel.addChild(pLabel);

      var okBtn = new PIXI.Sprite(game.tc.panel(190, 80, 0x4fc08d, 1, 16));
      root.addChild(okBtn);
      var okLabel = ui.label('right+bottom', { size: 24 });
      okLabel.x = 20; okLabel.y = 26;
      okBtn.addChild(okLabel);

      var leftBtn = new PIXI.Sprite(game.tc.panel(190, 80, 0xE8A33A, 1, 16));
      root.addChild(leftBtn);
      var lLabel = ui.label('left+bottom', { size: 24 });
      lLabel.x = 24; lLabel.y = 26;
      leftBtn.addChild(lLabel);

      function apply() {
        L.apply(topBar, { left: 20, right: 20, top: 20, h: 90 }, bounds);
        L.apply(panel, { centerX: 0, centerY: 0, w: 0.7, h: 280 }, bounds);
        L.apply(okBtn, { right: 20, bottom: 20, w: 190, h: 80 }, bounds);
        L.apply(leftBtn, { left: 20, bottom: 20, w: 190, h: 80 }, bounds);
        drawFrame();
      }
      apply();

      var state = 0;
      var widths = [W - 120, W - 320, W - 120];
      env.button('切换容器宽度 relayout()', function () {
        state = (state + 1) % widths.length;
        bounds.w = widths[state];
        apply();
        game.toast.show('bounds.w = ' + bounds.w);
      });

      var hint = ui.label('点上方工具栏按钮改变 bounds 宽度', { size: 26, color: 0x8b94a8 });
      hint.x = 60; hint.y = 40;
      game.stage.addChild(hint);

      game.app.start();
      return { game: game };
    }
  });
})();
