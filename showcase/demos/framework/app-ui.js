/**
 * framework 演示 — 主循环与 UI 工业化
 * createGame / widgets / Modal+Toast / Slider / Theme 换肤
 */
(function () {
  'use strict';

  /* ============ createGame 主循环 ============ */
  Showcase.register({
    id: 'fw-creategame',
    group: 'fw',
    title: 'createGame 主循环 / Timer',
    menuNote: '一步装配 · tick 优先级 · 帧定时器',
    subtitle: 'createGame(canvas, opts) 一行替代所有初始化样板：createPIXI + unsafeEval + renderer + stage + 资源/UI/场景上下文',
    desc:
      '<p><code>createGame</code> 返回的 game 上下文包含：<code>app</code>（主循环）/ <code>stage</code> / <code>W,H</code>（设计坐标）/ ' +
      '<code>tc</code>（程序化纹理缓存）/ <code>assets</code> / <code>theme</code> / <code>scenes</code> / <code>bus</code> / <code>ui</code> / <code>toast</code> / <code>audio</code>。</p>' +
      '<ul><li><b>tick 优先级</b>：<code>onTick(fn, priority)</code> 小值先跑 — 画布里「逻辑→表现」两行文字由不同优先级的 tick 更新，永远逻辑先行</li>' +
      '<li><b>maxDt 钳制</b>：切后台回来 dt 上限 200ms，防跳变（左上角实时 dt）</li>' +
      '<li><b>Timer</b>：帧驱动 <code>timer.after / every</code>，不依赖 setTimeout — 中间的心跳方块每 800ms 蹦一下</li></ul>',
    code:
      "const { createGame, framework } = require('libs/pixi.miniprogram.js')\n" +
      "\n" +
      "const game = createGame(canvas, { background: 0x1B2030 })\n" +
      "\n" +
      "game.app.onTick(dt => { /* 逻辑 */ }, 0)     // 优先级小者先执行\n" +
      "game.app.onTick(dt => { /* 表现 */ }, 10)\n" +
      "\n" +
      "game.app.timer.every(800, () => pulse())     // 帧驱动定时器\n" +
      "const cancel = game.app.timer.after(3000, () => once())\n" +
      "\n" +
      "game.app.start()\n" +
      "// 页面 touchEvent(e) { game.dispatchTouch(e) }",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x1B2030 });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var W = game.W;

      var title = ui.label('App 主循环', { size: 40, bold: true });
      title.x = 40; title.y = 40;
      game.stage.addChild(title);

      var dtLabel = ui.label('', { size: 26, color: 0x8b94a8 });
      dtLabel.x = 40; dtLabel.y = 110;
      game.stage.addChild(dtLabel);

      var logicLabel = ui.label('', { size: 28, color: 0x4fc08d });
      logicLabel.x = 40; logicLabel.y = 180;
      game.stage.addChild(logicLabel);
      var renderLabel = ui.label('', { size: 28, color: 0x9ecbff });
      renderLabel.x = 40; renderLabel.y = 230;
      game.stage.addChild(renderLabel);

      var order = [];
      var frame = 0;
      game.app.onTick(function () {
        order.push('逻辑(0)');
        frame++;
        logicLabel.text = '优先级 0：逻辑帧 #' + frame;
      }, 0);
      game.app.onTick(function (dt) {
        order.push('表现(10)');
        renderLabel.text = '优先级 10：表现帧 #' + frame + '（顺序 ' + order.join(' → ') + '）';
        order = [];
        dtLabel.text = 'dt = ' + dt + ' ms（maxDt 钳制 200ms）';
      }, 10);

      // Timer 心跳方块
      var heart = new PIXI.Sprite(game.tc.panel(90, 90, 0xE05B4B, 1, 20));
      heart.anchor && heart.anchor.set(0.5);
      heart.x = W / 2; heart.y = 460;
      game.stage.addChild(heart);
      var beats = 0;
      var beatLabel = ui.label('timer.every(800ms)：0 次', { size: 26, color: 0x8b94a8 });
      beatLabel.x = 40; beatLabel.y = 560;
      game.stage.addChild(beatLabel);
      game.app.timer.every(800, function () {
        beats++;
        beatLabel.text = 'timer.every(800ms)：' + beats + ' 次';
        game.app.actions.run(heart, env.framework.actions.sequence(
          env.framework.actions.scaleTo(120, 1.35, env.framework.easing.quadOut),
          env.framework.actions.scaleTo(240, 1, env.framework.easing.backOut)
        ));
      });

      var onceLabel = ui.label('timer.after(3000ms)：等待中…', { size: 26, color: 0xE8A33A });
      onceLabel.x = 40; onceLabel.y = 620;
      game.stage.addChild(onceLabel);
      game.app.timer.after(3000, function () {
        onceLabel.text = 'timer.after(3000ms)：✓ 已触发（一次性）';
      });

      game.app.start();
      return { game: game };
    }
  });

  /* ============ UI 基础件 ============ */
  Showcase.register({
    id: 'fw-widgets',
    group: 'fw',
    title: 'UI 基础件 widgets',
    menuNote: 'label · richLabel · button · progressBar · currency',
    subtitle: '皮肤化基础组件全家福：无图集时自动回退程序化圆角纹理（tc.panel），接入图集 + theme.json 即换皮',
    desc:
      '<p><code>game.ui.*</code> 工厂产出即用组件，全部支持皮肤回退链：<b>图集九宫格 → 拉伸帧 → 程序化 panel</b>。</p>' +
      '<ul><li><b>button</b>：三态（up/down/disabled），无 down 帧时按下自动 scale 0.95（cocos zoomScale 思路）</li>' +
      '<li><b>richLabel</b>（3.0 P3）：分段着色富文本，支持 wrapWidth 贪心换行</li>' +
      '<li><b>progressBar / redDot / currency</b>：现网四包同源收编</li></ul>' +
      '<p>点「获得金币」看 currency 数值与富文本联动；「禁用/启用」切换按钮 disabled 态。</p>',
    code:
      "const ui = game.ui\n" +
      "\n" +
      "const btn = ui.button('点我', 280, 88, { onTap: () => game.toast.show('hi') })\n" +
      "btn.setEnabled(false)          // disabled 态（皮肤 alpha 0.5）\n" +
      "\n" +
      "const rich = ui.richLabel([\n" +
      "  { text: '获得 ' },\n" +
      "  { text: '999', color: 0xFFD166, bold: true, size: 34 },\n" +
      "  { text: ' 金币' }\n" +
      "], { size: 28, wrapWidth: 600 })\n" +
      "\n" +
      "const bar = ui.progressBar(500, 36)\n" +
      "bar.setRatio(0.3); bar.setText('30%')\n" +
      "\n" +
      "const coin = ui.currency(game.tc.circle(16, 0xFFD166), 220)\n" +
      "coin.setValue(1234)",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x14171F });
      var ui = game.ui;
      var fw = env.framework;
      var W = game.W;
      var coins = 0;

      var title = ui.label('widgets 皮肤化组件', { size: 38, bold: true });
      title.x = 40; title.y = 36;
      game.stage.addChild(title);

      // 面板容器
      var panel = ui.panel(W - 80, 200);
      panel.x = 40; panel.y = 100;
      game.stage.addChild(panel);
      var pLabel = ui.label('ui.panel 程序化圆角面板', { size: 24, color: 0x8b94a8 });
      pLabel.x = 24; pLabel.y = 18;
      panel.addChild(pLabel);

      var rich = ui.richLabel([], { size: 28, wrapWidth: W - 160 });
      rich.x = 24; rich.y = 66;
      panel.addChild(rich);
      function updateRich() {
        rich.setSegments([
          { text: '战报：勇者 ' },
          { text: '出海', color: 0x6fd3ff, bold: true },
          { text: ' 击沉海盗船，获得 ' },
          { text: String(coins), color: 0xFFD166, bold: true, size: 34 },
          { text: ' 金币，士气 ' },
          { text: '+15%', color: 0x4fc08d, bold: true }
        ]);
      }
      updateRich();

      // currency + redDot
      var coin = ui.currency(game.tc.circle(16, 0xFFD166), 240);
      coin.x = 40; coin.y = 330;
      game.stage.addChild(coin);
      coin.setValue(0);
      var dot = ui.redDot(22);
      dot.x = 268; dot.y = 322;
      dot.visible = false;
      game.stage.addChild(dot);

      // progressBar
      var bar = ui.progressBar(W - 80, 40);
      bar.x = 40; bar.y = 410;
      bar.setRatio(0);
      bar.setText('0 / 500');
      game.stage.addChild(bar);

      // buttons
      var gain = ui.button('获得金币 +50', 300, 92, {
        onTap: function () {
          coins += 50;
          coin.setValue(coins);
          dot.visible = true;
          bar.setRatio(Math.min(1, coins / 500));
          bar.setText(Math.min(500, coins) + ' / 500');
          updateRich();
          game.toast.show('+50 金币');
          game.app.actions.run(coin, fw.actions.sequence(
            fw.actions.scaleTo(100, 1.12, fw.easing.quadOut),
            fw.actions.scaleTo(180, 1, fw.easing.backOut)
          ));
        }
      });
      gain.x = 40; gain.y = 490;
      game.stage.addChild(gain);

      var toggle = ui.button('禁用左边按钮', 300, 92, {
        skin: { bg: { color: 0xE8A33A } },
        onTap: function () {
          var disabled = gain.__off = !gain.__off;
          gain.setEnabled(!disabled);
          toggle.setLabel(disabled ? '启用左边按钮' : '禁用左边按钮');
        }
      });
      toggle.x = 370; toggle.y = 490;
      game.stage.addChild(toggle);

      var nine = ui.label('↓ 三态演示：按住按钮观察 down 态缩放', { size: 24, color: 0x8b94a8 });
      nine.x = 40; nine.y = 620;
      game.stage.addChild(nine);

      game.app.start();
      return { game: game };
    }
  });

  /* ============ Modal + Toast ============ */
  Showcase.register({
    id: 'fw-modal-toast',
    group: 'fw',
    title: 'Modal 弹窗 + Toast 提示',
    menuNote: '遮罩吞触摸 · 主循环驱动淡出',
    subtitle: 'Modal：全屏遮罩 + 居中面板 + 关闭按钮，面板自身吞触摸防穿透；Toast：tick 驱动淡出，可控可测',
    desc:
      '<ul><li><b>Modal</b>：<code>ui.modal({ w, h, title })</code> 自动取 stage 尺寸做遮罩；' +
      '<code>maskClose</code> 可选点遮罩关闭；body 是自由容器</li>' +
      '<li><b>Toast</b>：<code>game.toast.show(msg)</code> 顶部浮层，重复调用顶掉旧条，淡出由主循环推进（不是 setTimeout），切后台不会漏帧跳变</li>' +
      '<li>弹窗打开时点击背后的按钮无反应 — 验证遮罩吞触摸</li></ul>',
    code:
      "const modal = ui.modal({ w: 560, h: 420, title: '结算', maskClose: true })\n" +
      "modal.body.addChild(ui.label('获得三连胜！'))\n" +
      "game.stage.addChild(modal)\n" +
      "\n" +
      "modal.open()\n" +
      "modal.close()\n" +
      "modal.setTitle('新标题')\n" +
      "\n" +
      "game.toast.show('背包已满')   // 1.8s 后自动淡出",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x1B2030 });
      var ui = game.ui;
      var W = game.W;

      var count = 0;
      var behind = ui.button('我在弹窗后面（点我 +1）', 420, 92, {
        onTap: function () {
          count++;
          behind.setLabel('我在弹窗后面（点我 +1）: ' + count);
        }
      });
      behind.x = (W - 420) / 2; behind.y = 300;
      game.stage.addChild(behind);

      var modal = ui.modal({ w: 560, h: 460, title: '战斗结算', maskClose: true });
      var mText = ui.richLabel([
        { text: '胜利！', color: 0x4fc08d, bold: true, size: 40 },
        { text: '\n' }
      ], { size: 28 });
      var l1 = ui.label('金币 +320   经验 +80', { size: 30 });
      l1.y = 70;
      var l2 = ui.label('（遮罩与面板都吞触摸，\n点不到后面的按钮）', { size: 24, color: 0x8b94a8 });
      l2.y = 140;
      modal.body.addChild(mText);
      modal.body.addChild(l1);
      modal.body.addChild(l2);
      var inBtn = ui.button('领取奖励', 240, 80, {
        skin: { bg: { color: 0x4fc08d } },
        onTap: function () {
          game.toast.show('奖励已领取');
          modal.close();
        }
      });
      inBtn.y = 240;
      modal.body.addChild(inBtn);
      game.stage.addChild(modal);

      var open = ui.button('打开 Modal', 300, 92, {
        onTap: function () { modal.open(); }
      });
      open.x = 60; open.y = 120;
      game.stage.addChild(open);

      var toastBtn = ui.button('弹个 Toast', 300, 92, {
        skin: { bg: { color: 0xE8A33A } },
        onTap: function () { game.toast.show('提示 ' + new Date().toLocaleTimeString()); }
      });
      toastBtn.x = 390; toastBtn.y = 120;
      game.stage.addChild(toastBtn);

      game.app.start();
      return { game: game };
    }
  });

  /* ============ Slider ============ */
  Showcase.register({
    id: 'fw-slider',
    group: 'fw',
    title: 'Slider 滑杆',
    menuNote: '轨道直达 · thumb 拖拽 · step',
    subtitle: '收编 SimCity slider + 大航海数量滑杆：min/max/step、轨道点击直达、与 ProgressBar 联动',
    desc:
      '<ul><li>拖 thumb 或直接点轨道任意位置</li>' +
      '<li><code>step</code> 量化取值（本例 step=5）</li>' +
      '<li>上方进度条 / 出售数量 / 总价实时联动 — 大航海交易面板的实际用法</li></ul>',
    code:
      "const slider = ui.slider({\n" +
      "  w: 500, min: 0, max: 100, step: 5, value: 30,\n" +
      "  onChange: v => {\n" +
      "    bar.setRatio(v / 100)\n" +
      "    bar.setText(String(v))\n" +
      "  }\n" +
      "})\n" +
      "slider.setValue(50)   // 程序设值\n" +
      "slider.getValue()",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x14171F });
      var ui = game.ui;
      var W = game.W;
      var PRICE = 35;

      var title = ui.label('出售货物 — 胡椒', { size: 36, bold: true });
      title.x = 40; title.y = 40;
      game.stage.addChild(title);

      var bar = ui.progressBar(W - 80, 40);
      bar.x = 40; bar.y = 120;
      game.stage.addChild(bar);

      var qty = ui.label('', { size: 30 });
      qty.x = 40; qty.y = 190;
      game.stage.addChild(qty);
      var total = ui.label('', { size: 30, color: 0xFFD166, bold: true });
      total.x = 40; total.y = 240;
      game.stage.addChild(total);

      function refresh(v) {
        bar.setRatio(v / 100);
        bar.setText(v + ' / 100');
        qty.text = '数量：' + v + ' 桶（step = 5）';
        total.text = '总价：' + (v * PRICE) + ' 金币（单价 ' + PRICE + '）';
      }

      var slider = ui.slider({
        w: W - 80, min: 0, max: 100, step: 5, value: 30,
        onChange: refresh
      });
      slider.x = 40; slider.y = 330;
      game.stage.addChild(slider);
      refresh(30);

      var half = ui.button('一半', 180, 80, { onTap: function () { slider.setValue(50); refresh(50); } });
      half.x = 40; half.y = 430;
      game.stage.addChild(half);
      var max = ui.button('全部', 180, 80, {
        skin: { bg: { color: 0x4fc08d } },
        onTap: function () { slider.setValue(100); refresh(100); }
      });
      max.x = 250; max.y = 430;
      game.stage.addChild(max);

      game.app.start();
      return { game: game };
    }
  });

  /* ============ Theme 换肤 ============ */
  Showcase.register({
    id: 'fw-theme',
    group: 'fw',
    title: 'Theme 主题换肤',
    menuNote: 'JSON 换皮 · 缺帧自动回退',
    subtitle: '借鉴 EUI Theme：组件名 → 皮肤 JSON 映射；不改一行业务代码整体换皮',
    desc:
      '<p>皮肤配置是平铺 JSON：<code>{ bg: { color/frame/slice }, label: { size, color }, states: { down, disabled } }</code>。' +
      '<code>frame</code> 指图集帧（有 slice 走九宫格），图集缺失时自动回退程序化配色 — 保证任何阶段 UI 都能渲染。</p>' +
      '<p>顶部按钮切换 3 套主题：所有组件（按钮/面板/进度条/Toast）即时变色重建，业务代码零改动。也支持 <code>opts.skin</code> 单实例覆盖（右侧橙色按钮）。</p>',
    code:
      "// 全局换肤\n" +
      "game.theme.set({\n" +
      "  Button:      { bg: { color: 0x8A5CF6, radius: 0.5 } },\n" +
      "  Panel:       { bg: { color: 0x221B36, alpha: 0.96 } },\n" +
      "  ProgressBar: { fill: { color: 0x8A5CF6 } }\n" +
      "})\n" +
      "\n" +
      "// 单实例覆盖\n" +
      "ui.button('警告', 240, 80, { skin: { bg: { color: 0xE8A33A } } })",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x14171F });
      var ui = game.ui;
      var W = game.W;

      var THEMES = {
        '默认蓝': null,
        '紫夜': {
          Button: { bg: { color: 0x8A5CF6, radius: 0.5 } },
          Panel: { bg: { color: 0x221B36, alpha: 0.96, radius: 18 } },
          ProgressBar: { fill: { color: 0x8A5CF6 } },
          Label: { color: 0xE8DEFF }
        },
        '翠绿': {
          Button: { bg: { color: 0x2F9E68, radius: 0.28 } },
          Panel: { bg: { color: 0x11291C, alpha: 0.96, radius: 8 } },
          ProgressBar: { fill: { color: 0x4fc08d } },
          Label: { color: 0xD8F5E5 }
        }
      };

      var holder = null;
      function build() {
        if (holder) { game.stage.removeChild(holder); holder.destroy({ children: true }); }
        holder = new game.PIXI.Container();
        game.stage.addChild(holder);

        var title = ui.label('当前主题组件', { size: 36, bold: true });
        title.x = 40; title.y = 130;
        holder.addChild(title);

        var panel = ui.panel(W - 80, 160);
        panel.x = 40; panel.y = 200;
        holder.addChild(panel);
        var inner = ui.label('ui.panel — 主题 Panel 键控制底色/圆角', { size: 26 });
        inner.x = 24; inner.y = 24;
        panel.addChild(inner);

        var bar = ui.progressBar(W - 128, 36);
        bar.x = 24; bar.y = 90;
        bar.setRatio(0.66);
        bar.setText('66%');
        panel.addChild(bar);

        var b1 = ui.button('主题按钮', 280, 92, {
          onTap: function () { game.toast.show('主题按钮'); }
        });
        b1.x = 40; b1.y = 400;
        holder.addChild(b1);

        var b2 = ui.button('实例覆盖', 280, 92, {
          skin: { bg: { color: 0xE8A33A } },
          onTap: function () { game.toast.show('skin 覆盖优先于主题'); }
        });
        b2.x = 360; b2.y = 400;
        holder.addChild(b2);
      }

      var y = 40;
      var x = 40;
      Object.keys(THEMES).forEach(function (name) {
        var b = ui.button(name, 200, 72, {
          onTap: function () {
            // theme.set 合并；切换前重置为默认 + 增量
            game.theme.set(THEMES[name] || { Button: { bg: { color: 0x3B72B0, radius: 0.28 } }, Panel: { bg: { color: 0x14171F, alpha: 0.96, radius: 12 } }, ProgressBar: { fill: { color: 0x5CB85C } }, Label: { color: 0xFFFFFF } });
            build();
            game.toast.show('已切换主题：' + name);
          }
        });
        b.x = x; b.y = y;
        x += 224;
        game.stage.addChild(b);
      });

      build();
      game.app.start();
      return { game: game };
    }
  });
})();
