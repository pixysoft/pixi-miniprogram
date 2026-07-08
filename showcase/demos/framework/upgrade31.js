/**
 * framework 演示 — 3.1 升级（收编现网游戏可复用能力）
 * PageShell / SceneManager 弹层栈 / TextureFactory / Joystick /
 * Camera2D / TileMap + PathFinder / Perf + NumFont
 */
(function () {
  'use strict';

  /* ============ PageShell 页面壳 ============ */
  Showcase.register({
    id: 'fw-pageshell',
    group: 'fw',
    title: 'PageShell 页面壳模板',
    menuNote: 'canvas 查询 · 生命周期 · 触摸转发（3.1 P0）',
    subtitle: '收编现网 15 份重复 Page 壳：canvas 节点查询 → createGame → 触摸转发 → onHide/onUnload 存档销毁，业务只写 createGame',
    width: 420, height: 640,
    desc:
      '<ul><li>本演示用 mock wx.createSelectorQuery 完整走了一遍小程序 Page 生命周期链路</li>' +
      '<li>工具栏按钮模拟 <code>onHide / onShow / onUnload</code>：观察左上角生命周期日志（onHide 时游戏暂停计数）</li>' +
      '<li>小程序侧 WXML 只需一个 <code>#gameCanvas</code> + 触摸事件统一绑 <code>onTouch</code></li>' +
      '<li>game 协议：必须 <code>dispatchTouch/destroy</code>，可选 <code>onHide/onShow</code>（后台存档等）</li></ul>',
    code:
      "// 页面 js 全部内容（约 10 行，替代现网 ~50 行重复壳）：\n" +
      "var lib = require('../../libs/pixi.miniprogram.js');\n" +
      "Page(lib.framework.PageShell.create({\n" +
      "  createGame: function (canvas, w, h, page) {\n" +
      "    return require('../../game/Game.js').create(canvas, w, h);\n" +
      "  },\n" +
      "  share: { title: '来玩！', path: '/packageX/pages/index/index' }\n" +
      "}));\n" +
      "\n" +
      "// WXML：\n" +
      "// <canvas id=\"gameCanvas\" type=\"webgl\" bindtouchstart=\"onTouch\"\n" +
      "//         bindtouchmove=\"onTouch\" bindtouchend=\"onTouch\" bindtouchcancel=\"onTouch\"/>",
    run: function (env) {
      var fw = env.framework;
      var logLines = [];
      var logLabel = null;
      var game = null;

      function log(msg) {
        logLines.push(msg);
        if (logLines.length > 8) { logLines.shift(); }
        if (logLabel) { logLabel.text = logLines.join('\n'); }
      }

      // mock wx：把 env.canvas 喂给 PageShell 的查询链
      var mockWx = {
        createSelectorQuery: function () {
          return {
            select: function () {
              return { boundingClientRect: function () {}, node: function () {} };
            },
            exec: function (cb) {
              cb([{ width: env.canvas.width, height: env.canvas.height }, { node: env.canvas }]);
            }
          };
        },
        showToast: function (o) { log('wx.showToast: ' + o.title); }
      };

      var page = fw.PageShell.create({
        wx: mockWx,
        createGame: function (canvas, w, h) {
          log('createGame ' + w + 'x' + h);
          game = env.lib.createGame(canvas, { designWidth: env.designWidth, background: 0x131822 });
          var ui = game.ui;
          var W = game.W;

          var title = ui.label('PageShell 生命周期演示', { size: 30, bold: true });
          title.x = 30; title.y = 30;
          game.stage.addChild(title);

          logLabel = ui.label('', { size: 22, color: 0x9ecbff });
          logLabel.x = 30; logLabel.y = 90;
          game.stage.addChild(logLabel);

          // 点击计数（验证触摸经 page.onTouch 转发进 game.dispatchTouch）
          var taps = 0;
          var tapLabel = ui.label('点击画面任意处 → 触摸转发计数: 0', { size: 24, color: 0xFFD166 });
          tapLabel.x = 30; tapLabel.y = 430;
          game.stage.addChild(tapLabel);
          game.stage.on('pointerdown', function () {
            taps++;
            tapLabel.text = '点击画面任意处 → 触摸转发计数: ' + taps;
          });

          // 后台暂停计数（onHide/onShow 协议演示）
          var running = true;
          var secs = 0;
          var runLabel = ui.label('', { size: 26, color: 0x4fc08d });
          runLabel.x = 30; runLabel.y = 500;
          game.stage.addChild(runLabel);
          game.app.timer.every(100, function () {
            if (running) { secs += 0.1; }
            runLabel.text = (running ? '游戏运行中 ' : '已暂停（onHide） ') + secs.toFixed(1) + 's';
          });

          var pill = ui.panel(W - 60, 90, { skin: { bg: { color: 0x1d2433, radius: 14 } } });
          pill.x = 30; pill.y = 560;
          game.stage.addChild(pill);
          var hint = ui.label('工具栏按钮 = 小程序生命周期事件', { size: 22, color: 0x8b94a8 });
          hint.x = 24; hint.y = 32;
          pill.addChild(hint);

          game.onHide = function () { running = false; log('game.onHide（存档时机）'); };
          game.onShow = function () { running = true; log('game.onShow'); };
          game.app.start();
          return game;
        }
      });

      // 模拟小程序框架调用 onLoad
      page.onLoad();
      log('Page.onLoad 完成');

      env.button('onHide', function () { page.onHide(); });
      env.button('onShow', function () { page.onShow(); });
      env.button('onUnload（销毁）', function () {
        page.onUnload();
        log('Page.onUnload → game.destroy');
      });

      return {
        game: { dispatchTouch: function (e) { page.onTouch(e); }, destroy: function () { page.onUnload(); } },
        renderer: game && game.app.renderer
      };
    }
  });

  /* ============ SceneManager 弹层栈 ============ */
  Showcase.register({
    id: 'fw-layerstack',
    group: 'fw',
    title: 'SceneManager 弹层栈',
    menuNote: 'pushLayer 冻结下层 · popLayer resume（3.1 P0）',
    subtitle: '收编 Mr2/EggSoldier 模式：弹层压栈时下层保持可见但 update 冻结 — 暂停战斗/结算/抽卡的标准语义',
    width: 480, height: 640,
    desc:
      '<ul><li>战斗场景里小球持续运动（update 驱动）；点「暂停」<code>pushLayer</code> 后<b>画面保留但全部静止</b> — 下层 update 被冻结</li>' +
      '<li>暂停层之上还能再叠「结算」层（弹层栈），逐层 <code>popLayer</code> 返回</li>' +
      '<li>popLayer 后对新栈顶调用 <code>resume(params)</code>（战斗场景恢复时打点）</li>' +
      '<li>与 <code>push()</code>（隐藏下层、整场切换）语义不同，两者并存</li></ul>',
    code:
      "// createGame 已内置弹层根（场景之上、toast 之下）\n" +
      "game.scenes.register('battle', () => battleScene)\n" +
      "game.scenes.register('pause', () => pauseLayer)\n" +
      "\n" +
      "game.scenes.pushLayer('pause')    // 下层可见但 update 冻结\n" +
      "game.scenes.popLayer({ from: 'pause' })   // 新栈顶 resume(params)\n" +
      "game.scenes.hasLayer()            // 弹层存在判定（吞返回键等）\n" +
      "\n" +
      "// 场景协议新增可选 resume：\n" +
      "battleScene.resume = params => console.log('战斗恢复', params)",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x131822 });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var tf = game.tf;
      var W = game.W, H = game.H;

      // ---- 战斗场景 ----
      function makeBattle() {
        var c = new PIXI.Container();
        var balls = [];
        var rng = env.framework.Rng.create(7);
        for (var i = 0; i < 14; i++) {
          var b = new PIXI.Sprite(tf.circle([0x4fc08d, 0xE05B4B, 0xFFD166, 0x9ecbff][i % 4], 16 + (i % 3) * 8));
          b.x = 60 + rng.next() * (W - 120);
          b.y = 120 + rng.next() * (H - 400);
          b._vx = (rng.next() - 0.5) * 300;
          b._vy = (rng.next() - 0.5) * 300;
          c.addChild(b);
          balls.push(b);
        }
        var frames = 0;
        var info = ui.label('', { size: 26, bold: true });
        info.x = 30; info.y = 30;
        c.addChild(info);
        var resumeInfo = ui.label('', { size: 22, color: 0x8b94a8 });
        resumeInfo.x = 30; resumeInfo.y = 70;
        c.addChild(resumeInfo);

        var pauseBtn = ui.button('暂停 pushLayer', 280, 84, {
          onTap: function () { game.scenes.pushLayer('pause'); }
        });
        pauseBtn.x = (W - 280) / 2; pauseBtn.y = H - 140;
        c.addChild(pauseBtn);

        return {
          container: c,
          enter: function () {},
          exit: function () {},
          resume: function (params) {
            resumeInfo.text = 'resume 收到: ' + JSON.stringify(params || {});
          },
          update: function (dt) {
            frames++;
            info.text = '战斗 update 帧数: ' + frames + '（弹层期间冻结）';
            var s = dt / 1000;
            for (var i = 0; i < balls.length; i++) {
              var b = balls[i];
              b.x += b._vx * s;
              b.y += b._vy * s;
              if (b.x < 40 || b.x > W - 40) { b._vx *= -1; }
              if (b.y < 110 || b.y > H - 220) { b._vy *= -1; }
            }
          }
        };
      }

      // ---- 暂停弹层 ----
      function makePause() {
        var c = new PIXI.Container();
        c.addChild(ui.modalMask(W, H, null));
        var panel = new PIXI.Sprite(tf.roundRect(0x1d2433, 400, 330, 20));
        panel.x = (W - 400) / 2; panel.y = (H - 330) / 2 - 60;
        c.addChild(panel);
        var t = ui.label('已暂停', { size: 34, bold: true });
        t.x = panel.x + 140; t.y = panel.y + 34;
        c.addChild(t);
        var ticks = 0;
        var tickLabel = ui.label('', { size: 22, color: 0x9ecbff });
        tickLabel.x = panel.x + 60; tickLabel.y = panel.y + 96;
        c.addChild(tickLabel);

        var resumeBtn = ui.button('继续 popLayer', 300, 76, {
          onTap: function () { game.scenes.popLayer({ from: 'pause' }); }
        });
        resumeBtn.x = panel.x + 50; resumeBtn.y = panel.y + 150;
        c.addChild(resumeBtn);
        var moreBtn = ui.button('再叠结算层', 300, 76, {
          onTap: function () { game.scenes.pushLayer('result'); },
          skin: { bg: { color: 0x3B72B0 } }
        });
        moreBtn.x = panel.x + 50; moreBtn.y = panel.y + 240;
        c.addChild(moreBtn);

        return {
          container: c,
          update: function () {
            ticks++;
            tickLabel.text = '弹层自身 update 正常: ' + ticks;
          }
        };
      }

      // ---- 结算弹层（第二层，验证栈叠加） ----
      function makeResult() {
        var c = new PIXI.Container();
        c.addChild(ui.modalMask(W, H, null));
        var panel = new PIXI.Sprite(tf.roundRect(0x24303f, 360, 220, 20));
        panel.x = (W - 360) / 2; panel.y = (H - 220) / 2 + 40;
        c.addChild(panel);
        var t = ui.label('结算层（栈深 2）', { size: 28, bold: true, color: 0xFFD166 });
        t.x = panel.x + 60; t.y = panel.y + 40;
        c.addChild(t);
        var back = ui.button('关闭', 240, 72, {
          onTap: function () { game.scenes.popLayer({ from: 'result' }); }
        });
        back.x = panel.x + 60; back.y = panel.y + 110;
        c.addChild(back);
        return { container: c };
      }

      game.scenes.register('battle', makeBattle);
      game.scenes.register('pause', makePause);
      game.scenes.register('result', makeResult);
      game.scenes.replace('battle');

      game.app.start();
      return { game: game };
    }
  });

  /* ============ TextureFactory ============ */
  Showcase.register({
    id: 'fw-texturefactory',
    group: 'fw',
    title: 'TextureFactory 程序化纹理',
    menuNote: 'circle/roundRect/diamond/star/tile…（3.1 P0）',
    subtitle: '收编现网 12 份 TextureFactory 并集 — 「素材未就绪不阻塞玩法」：任何形状按 key 缓存一次生成，素材到位后同名替换',
    width: 480, height: 640,
    desc:
      '<ul><li><code>game.tf</code> 与 <code>game.tc</code> 共享同一缓存池：同参数取形状永远同一纹理，零重复烘焙</li>' +
      '<li>覆盖现网高频形状：圆（可带描边）/ 圆环 / 矩形条 / 圆角矩形 / 菱形 / 三角 / 五角星 / 方砖 / 等距菱形砖 / 摇杆兜底皮肤</li>' +
      '<li><code>tf.bake(key, draw)</code> 自定义形状同样进缓存（generateTexture 一次 + Graphics 即销）</li></ul>',
    code:
      "const tf = game.tf   // createGame 已装配（与 game.tc 共享缓存）\n" +
      "\n" +
      "new PIXI.Sprite(tf.circle(0xE05B4B, 24, 0xFFFFFF))  // 圆 + 描边\n" +
      "new PIXI.Sprite(tf.roundRect(0x3B72B0, 200, 64, 14)) // 按钮兜底\n" +
      "new PIXI.Sprite(tf.rect(0x4fc08d, 120, 12))          // 血条\n" +
      "new PIXI.Sprite(tf.diamond(0x9ecbff, 16))            // 经验宝石\n" +
      "new PIXI.Sprite(tf.star(0xFFD23E, 44, 0.4))          // 评级星\n" +
      "new PIXI.Sprite(tf.isoTile(0x8888aa, 96, 48, 0.15))  // 等距地砖\n" +
      "new PIXI.Sprite(tf.joystick('base', 200))            // 摇杆兜底\n" +
      "\n" +
      "tf.bake('hp:seg', g => { /* 自定义 Graphics */ })     // 进同一缓存",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x131822 });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var tf = game.tf;
      var W = game.W;

      var title = ui.label('TextureFactory 形状全家桶', { size: 30, bold: true });
      title.x = 30; title.y = 26;
      game.stage.addChild(title);

      var items = [
        ['circle', tf.circle(0xE05B4B, 30)],
        ['circle+边', tf.circle(0x4fc08d, 30, 0xFFFFFF)],
        ['ring', tf.ring(0xFFD166, 32, 6)],
        ['rect 血条', tf.rect(0x4fc08d, 130, 18)],
        ['roundRect', tf.roundRect(0x3B72B0, 130, 58, 14)],
        ['diamond', tf.diamond(0x9ecbff, 28)],
        ['triangle', tf.triangle(0xE8A33A, 52)],
        ['star', tf.star(0xFFD23E, 62, 0.4)],
        ['tile 方砖', tf.tile(0x3E7C4F, 62, 0.25)],
        ['isoTile', tf.isoTile(0x8888aa, 110, 55, 0.2)],
        ['joy base', tf.joystick('base', 96)],
        ['joy knob', tf.joystick('knob', 60)]
      ];

      var cols = 3;
      var cellW = (W - 60) / cols;
      var cellH = 190;
      items.forEach(function (item, i) {
        var cx = 30 + (i % cols) * cellW;
        var cy = 100 + Math.floor(i / cols) * cellH;
        var box = new PIXI.Sprite(tf.roundRect(0x1d2433, cellW - 16, cellH - 16, 12));
        box.x = cx; box.y = cy;
        game.stage.addChild(box);
        var sp = new PIXI.Sprite(item[1]);
        sp.x = cx + (cellW - 16 - sp.width) / 2;
        sp.y = cy + (cellH - 60 - sp.height) / 2;
        game.stage.addChild(sp);
        var name = ui.label(item[0], { size: 20, color: 0x8b94a8 });
        name.x = cx + 14; name.y = cy + cellH - 52;
        game.stage.addChild(name);
      });

      // 缓存命中演示
      var same = tf.circle(0xE05B4B, 30) === tf.circle(0xE05B4B, 30);
      var cacheLabel = ui.label('同参重复获取 → 缓存命中同一纹理: ' + same, { size: 22, color: 0x4fc08d });
      cacheLabel.x = 30; cacheLabel.y = 100 + Math.ceil(items.length / cols) * cellH + 8;
      game.stage.addChild(cacheLabel);

      game.app.start();
      return { game: game };
    }
  });

  /* ============ Joystick 虚拟摇杆 ============ */
  Showcase.register({
    id: 'fw-joystick',
    group: 'fw',
    title: 'Joystick 虚拟摇杆',
    menuNote: '浮动/固定 · 向量+四八方向（3.1 P1）',
    subtitle: '收编 EggSoldier 向量版 + DAL 方向量化版：触摸点即中心，拖动出方向，松手隐藏；输出单位向量 + dir4/dir8 量化',
    width: 480, height: 640,
    desc:
      '<ul><li><b>按住画面任意处拖动</b>：摇杆在触摸点浮现，小人跟随方向移动（力度 = 速度）</li>' +
      '<li>HUD 实时显示 <code>getDir()</code> 向量、<code>dir4()</code>（下左右上）与 <code>dir8()</code> 量化档位</li>' +
      '<li>工具栏可切换固定式（左下角热区，DAL 模式）；皮肤缺省用 <code>tf.joystick</code> 程序化兜底，有素材传 <code>baseTexture/knobTexture</code> 即换肤</li></ul>',
    code:
      "const joy = game.joystick(surface, {   // surface = 覆盖可玩区的交互层\n" +
      "  radius: 120, dead: 0.12,\n" +
      "  // fixed: { x: 160, y: H - 200 },     // 固定式（缺省浮动）\n" +
      "  // baseTexture / knobTexture          // 皮肤（缺省 tf.joystick 兜底）\n" +
      "})\n" +
      "stage.addChild(joy.container)\n" +
      "\n" +
      "game.app.onTick(dt => {\n" +
      "  const d = joy.getDir()                // { x, y, strength } | null\n" +
      "  if (d) { hero.x += d.x * speed * d.strength * dt / 1000 }\n" +
      "  joy.dir4()   // 0下 1左 2右 3上 | -1（主轴优先，RPG 走格）\n" +
      "  joy.dir8()   // 0..7 八方向 | -1\n" +
      "})",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x16221a });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var tf = game.tf;
      var W = game.W, H = game.H;

      // 地面网格
      var g = new PIXI.Graphics();
      g.lineStyle(1, 0x24402e, 0.8);
      for (var x = 0; x <= W; x += 60) { g.moveTo(x, 0); g.lineTo(x, H); }
      for (var y = 0; y <= H; y += 60) { g.moveTo(0, y); g.lineTo(W, y); }
      game.stage.addChild(g);

      // 小人
      var hero = new PIXI.Container();
      var body = new PIXI.Sprite(tf.circle(0x4fc08d, 26, 0xFFFFFF));
      body.x = -28; body.y = -28;
      hero.addChild(body);
      var nose = new PIXI.Sprite(tf.triangle(0xFFD166, 22));
      nose.x = 10; nose.y = -11;
      hero.addChild(nose);
      hero.x = W / 2; hero.y = H / 2;
      game.stage.addChild(hero);

      // 触摸面（全屏）
      var surface = new PIXI.Sprite(tf.roundRect(0x000000, 16, 16, 0));
      surface.width = W; surface.height = H;
      surface.alpha = 0.001;
      game.stage.addChild(surface);

      var joy = null;
      var hud = ui.panel(W - 60, 120, { skin: { bg: { color: 0x000000, alpha: 0.55, radius: 12 } } });
      hud.x = 30; hud.y = 24;
      hud.eventMode = 'none';   // HUD 不吸收触摸，摇杆热区全屏有效
      game.stage.addChild(hud);
      var l1 = ui.label('', { size: 24, bold: true, color: 0x9ecbff });
      l1.x = 20; l1.y = 14;
      hud.addChild(l1);
      var l2 = ui.label('', { size: 22, color: 0x8b94a8 });
      l2.x = 20; l2.y = 56;
      hud.addChild(l2);

      var DIR4_NAME = ['下', '左', '右', '上'];

      function build(fixed) {
        if (joy) { joy.destroy(); }
        joy = game.joystick(surface, {
          radius: 110,
          fixed: fixed ? { x: 170, y: H - 200 } : null
        });
        game.stage.addChild(joy.container);
      }
      build(false);

      game.app.onTick(function (dt) {
        var d = joy.getDir();
        if (d) {
          var speed = 360 * d.strength * dt / 1000;
          hero.x = Math.max(30, Math.min(W - 30, hero.x + d.x * speed));
          hero.y = Math.max(30, Math.min(H - 30, hero.y + d.y * speed));
          hero.rotation = Math.atan2(d.y, d.x);
          l1.text = 'dir=(' + d.x.toFixed(2) + ', ' + d.y.toFixed(2) + ')  strength=' + d.strength.toFixed(2);
          l2.text = 'dir4=' + DIR4_NAME[joy.dir4()] + '   dir8=' + joy.dir8();
        } else {
          l1.text = '按住画面拖动 — 摇杆在触摸点浮现';
          l2.text = 'dir4=-1   dir8=-1';
        }
      });

      var fixed = false;
      env.button('切换 浮动/固定', function () {
        fixed = !fixed;
        build(fixed);
        game.toast.show(fixed ? '固定式（左下热区）' : '浮动式（触摸点即中心）');
      });

      game.app.start();
      return { game: game };
    }
  });

  /* ============ Camera2D ============ */
  Showcase.register({
    id: 'fw-camera2d',
    group: 'fw',
    title: 'Camera2D 缩放相机',
    menuNote: '锚点缩放 · 格坐标 · 视口查询（3.1 P1）',
    subtitle: '收编 CnC2/SimCity 相机：直接操纵 world 容器 position/scale — pan / zoomAt / toTile / focusTile / visibleTiles 一体',
    width: 760, height: 480, designWidth: 1200,
    desc:
      '<ul><li><b>拖动</b>平移（自动钳制不出界，地图小于视口的轴向自动居中）；<b>滚轮</b>以指针为锚缩放（0.5x ~ 2.0x）</li>' +
      '<li><b>单击</b>：<code>cam.toTile(x, y)</code> 屏幕 → 格坐标，落一个高亮标记</li>' +
      '<li>右上小地图：<code>cam.visibleTiles()</code> 画视口框；<b>点小地图</b>：<code>cam.focusTile</code> 跳镜头</li>' +
      '<li>与 3.0 Camera（偏移输出式平滑跟随）互补；与 PinchPan 组合即 RTS 手势镜头</li></ul>',
    code:
      "const cam = framework.Camera2D.create(world, viewport, mapW*TILE, mapH*TILE, {\n" +
      "  maxScale: 2, tileSize: TILE   // minScale 缺省自适应「整图可见」\n" +
      "})\n" +
      "\n" +
      "framework.PinchPan.create(stage, {\n" +
      "  onPan: (dx, dy) => cam.pan(dx, dy),\n" +
      "  onPinch: (f, cx, cy) => cam.zoomAt(f, cx, cy),\n" +
      "  onTap: (x, y) => select(cam.toTile(x, y))\n" +
      "})\n" +
      "\n" +
      "minimap.on('pointertap', e => cam.focusTile(gx, gy))\n" +
      "const v = cam.visibleTiles()   // 小地图视口框",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x101620 });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var tf = game.tf;
      var fw = env.framework;
      var W = game.W, H = game.H;

      var TILE = 48;
      var MAP_W = 48, MAP_H = 36;

      var world = new PIXI.Container();
      game.stage.addChild(world);

      // 地形
      var colors = [0x2E4E3E, 0x3E7C4F, 0x4E8E5A, 0x3A6EA8, 0x6E6A62];
      for (var ty = 0; ty < MAP_H; ty++) {
        for (var tx = 0; tx < MAP_W; tx++) {
          var v = Math.sin(tx * 0.35) * Math.cos(ty * 0.3) + Math.sin(tx * 0.1 + ty * 0.17) * 0.8;
          var idx = v > 1 ? 4 : (v > 0.4 ? 2 : (v > -0.4 ? 1 : (v > -1 ? 0 : 3)));
          var sp = new PIXI.Sprite(tf.tile(colors[idx], TILE, 0.12));
          sp.x = tx * TILE;
          sp.y = ty * TILE;
          world.addChild(sp);
        }
      }
      var marker = new PIXI.Sprite(tf.ring(0xFFD166, 20, 5));
      marker.visible = false;
      world.addChild(marker);

      var cam = fw.Camera2D.create(world, { x: 0, y: 0, w: W, h: H }, MAP_W * TILE, MAP_H * TILE, {
        maxScale: 2, tileSize: TILE
      });
      cam.focusTile(MAP_W / 2, MAP_H / 2);

      var status = ui.label('拖动=平移  滚轮=锚点缩放  单击=toTile', { size: 24, color: 0x9ecbff });
      status.x = 24; status.y = 20;
      game.stage.addChild(status);
      var zoomLabel = ui.label('', { size: 24, bold: true, color: 0xFFD166 });
      zoomLabel.x = 24; zoomLabel.y = 58;
      game.stage.addChild(zoomLabel);

      fw.PinchPan.create(game.stage, {
        onPan: function (dx, dy) { cam.pan(dx, dy); },
        onPinch: function (f, cx, cy) { cam.zoomAt(f, cx, cy); },
        onTap: function (x, y) {
          var t = cam.toTile(x, y);
          var gx = Math.round(t.x), gy = Math.round(t.y);
          marker.visible = true;
          marker.x = (gx + 0.5) * TILE - 25;
          marker.y = (gy + 0.5) * TILE - 25;
          status.text = 'toTile → (' + gx + ', ' + gy + ')';
        }
      });
      env.onWheel(function (e, cx, cy) {
        env.simulatePinch(cx, cy, e.deltaY < 0 ? 1.12 : 0.9);
      });

      // 小地图
      var MINI = 170;
      var miniScale = MINI / MAP_W;
      var mini = new PIXI.Container();
      mini.x = W - MINI - 24; mini.y = 24;
      game.stage.addChild(mini);
      mini.addChild(new PIXI.Sprite(tf.roundRect(0x000000, MINI + 8, Math.round(MAP_H * miniScale) + 8, 6)));
      var miniView = new PIXI.Graphics();
      miniView.x = 4; miniView.y = 4;
      mini.addChild(miniView);
      mini.eventMode = 'static';
      mini.hitArea = new PIXI.Rectangle(0, 0, MINI + 8, Math.round(MAP_H * miniScale) + 8);
      mini.on('pointertap', function (ev) {
        if (ev.stopPropagation) { ev.stopPropagation(); }   // 不透传给 PinchPan onTap
        var local = mini.toLocal(ev.data.global);
        cam.focusTile((local.x - 4) / miniScale, (local.y - 4) / miniScale);
      });

      game.app.onTick(function () {
        zoomLabel.text = 'zoom ' + cam.scale().toFixed(2) + 'x';
        var v = cam.visibleTiles();
        miniView.clear();
        miniView.beginFill(0x2E4E3E, 0.9);
        miniView.drawRect(0, 0, MINI, MAP_H * miniScale);
        miniView.endFill();
        miniView.lineStyle(2, 0xFFFFFF, 0.9);
        miniView.drawRect(
          Math.max(0, v.x0 * miniScale), Math.max(0, v.y0 * miniScale),
          Math.min(MAP_W, v.x1 - v.x0) * miniScale, Math.min(MAP_H, v.y1 - v.y0) * miniScale);
      });

      game.app.start();
      return { game: game };
    }
  });

  /* ============ TileMap + PathFinder ============ */
  Showcase.register({
    id: 'fw-tilemap-path',
    group: 'fw',
    title: 'TileMap + PathFinder',
    menuNote: '字符图例地图 · A* 点击寻路（3.1 P1）',
    subtitle: '收编 DAL/UW TileMap 与 Mr2 A*：legend 字符行手写关卡 + 碰撞表，点击目的地八方向寻路走过去',
    width: 480, height: 640,
    desc:
      '<ul><li>地图由 <code>legend + ground 字符行</code>定义：草地可走、水/山不可走、树为 <b>over 高层</b>（角色从后面走过，脚下自动补地）</li>' +
      '<li><b>点击任意格</b>：<code>PathFinder.find(map.walkable, ...)</code> 八方向 A*，黄点显示路径，小人逐格走</li>' +
      '<li>点到水面/山体：自动找<b>目标附近最近可走格</b>（Mr2 行为）；封死区域返回 null 弹提示</li>' +
      '<li>工具栏可放置/移除 NPC 占位（<code>setBlocked</code> 动态碰撞）</li></ul>',
    code:
      "const map = framework.TileMap.create({ PIXI, textureFor }, {\n" +
      "  legend: {\n" +
      "    '.': { tile: 'grass', walk: true },\n" +
      "    '~': { tile: 'water', walk: false },\n" +
      "    'T': { tile: 'tree',  walk: false, over: true, under: 'grass' }\n" +
      "  },\n" +
      "  ground: ['....~~....', '..T.......', /* ... */]\n" +
      "}, { tileSize: 48 })\n" +
      "world.addChild(map.groundLayer)   // 角色层夹在 ground 与 overlay 之间\n" +
      "world.addChild(objectLayer)\n" +
      "world.addChild(map.overlayLayer)\n" +
      "\n" +
      "const path = framework.PathFinder.find(\n" +
      "  (x, y) => map.walkable(x, y), hero.gx, hero.gy, tx, ty,\n" +
      "  { diagonal: true, nearest: true })   // [{x,y}, ...] | null\n" +
      "map.setBlocked(x, y, true)             // NPC 站位动态占格",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x101620 });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var tf = game.tf;
      var fw = env.framework;
      var W = game.W;

      var TILE = 50;
      var mapData = {
        legend: {
          '.': { tile: 'grass', walk: true },
          '~': { tile: 'water', walk: false },
          '#': { tile: 'rock', walk: false },
          'T': { tile: 'tree', walk: false, over: true, under: 'grass' },
          ',': { tile: 'sand', walk: true }
        },
        ground: [
          '...T.....~~~~.',
          '.T.....,,,~~~.',
          '......,,,,,~~.',
          '..###.,..,,~~.',
          '..#...,....~..',
          '..#.T.,.T.....',
          '......,......T',
          '.T....,,,.....',
          '......T,,,....',
          '..~~~....,....',
          '.~~~~~...,..T.',
          '.~~~~....,....',
          '..~~..T..,....',
          '..............',
          '....T....T....',
          '..............'
        ]
      };

      var texMap = {
        grass: tf.tile(0x3E7C4F, TILE, 0.1),
        water: tf.tile(0x3A6EA8, TILE, 0.1),
        rock: tf.tile(0x6E6A62, TILE, 0.1),
        sand: tf.tile(0xC9B27C, TILE, 0.1),
        tree: tf.bake('tree:' + TILE, function (g) {
          g.beginFill(0x1E4228);
          g.drawCircle(TILE / 2, TILE / 2 - 6, TILE / 2 - 8);
          g.endFill();
          g.beginFill(0x6B4A2B);
          g.drawRect(TILE / 2 - 4, TILE / 2 + 8, 8, 14);
          g.endFill();
        })
      };

      var map = fw.TileMap.create({
        PIXI: PIXI,
        textureFor: function (key) { return texMap[key] || null; }
      }, mapData, { tileSize: TILE });

      var world = new PIXI.Container();
      world.x = (W - map.pixelWidth) / 2;
      world.y = 30;
      game.stage.addChild(world);
      world.addChild(map.groundLayer);
      var objectLayer = new PIXI.Container();
      world.addChild(objectLayer);
      world.addChild(map.overlayLayer);

      // 路径标记 + 小人
      var pathDots = new PIXI.Container();
      objectLayer.addChild(pathDots);
      var hero = new PIXI.Sprite(tf.circle(0xE05B4B, 15, 0xFFFFFF));
      hero.gx = 0; hero.gy = 13;
      objectLayer.addChild(hero);
      function place(sp, gx, gy) {
        sp.x = gx * TILE + TILE / 2 - sp.width / 2;
        sp.y = gy * TILE + TILE / 2 - sp.height / 2;
      }
      place(hero, hero.gx, hero.gy);

      var npcs = [];   // 动态占位演示

      var status = ui.label('点击任意格 → A* 寻路走过去', { size: 24, color: 0x9ecbff });
      status.x = 30; status.y = map.pixelHeight + 50;
      game.stage.addChild(status);

      // 行走状态机
      var walking = [];
      var stepMs = 0;
      game.app.onTick(function (dt) {
        if (!walking.length) { return; }
        stepMs += dt;
        if (stepMs >= 130) {
          stepMs = 0;
          var next = walking.shift();
          hero.gx = next.x; hero.gy = next.y;
          place(hero, hero.gx, hero.gy);
          if (pathDots.children.length) { pathDots.removeChildAt(0); }
        }
      });

      map.groundLayer.eventMode = 'static';
      game.stage.eventMode = 'static';
      game.stage.on('pointertap', function (ev) {
        var local = world.toLocal(ev.data.global);
        var gx = Math.floor(local.x / TILE);
        var gy = Math.floor(local.y / TILE);
        if (gx < 0 || gy < 0 || gx >= map.width || gy >= map.height) { return; }

        var path = fw.PathFinder.find(function (x, y) { return map.walkable(x, y); },
          hero.gx, hero.gy, gx, gy, { diagonal: true, nearest: true });
        if (!path) {
          status.text = '(' + gx + ',' + gy + ') 不可达（PathFinder → null）';
          game.toast.show('不可达！');
          return;
        }
        status.text = '目标 (' + gx + ',' + gy + ')  路径 ' + path.length + ' 步' +
          (map.walkable(gx, gy) ? '' : '（目标不可走 → 最近可走格）');
        pathDots.removeChildren();
        for (var i = 0; i < path.length; i++) {
          var dot = new PIXI.Sprite(tf.circle(0xFFD166, 6));
          place(dot, path[i].x, path[i].y);
          pathDots.addChild(dot);
        }
        walking = path.slice();
        stepMs = 130;
      });

      env.button('放置 NPC 占位', function () {
        // 在小人右侧找一个可走格放 NPC（setBlocked 动态碰撞）
        for (var r = 1; r <= 4; r++) {
          var gx = hero.gx + r;
          if (map.walkable(gx, hero.gy)) {
            var npc = new PIXI.Sprite(tf.circle(0x9ecbff, 14, 0x3B72B0));
            place(npc, gx, hero.gy);
            objectLayer.addChild(npc);
            map.setBlocked(gx, hero.gy, true);
            npcs.push({ sp: npc, x: gx, y: hero.gy });
            game.toast.show('NPC 占格 (' + gx + ',' + hero.gy + ') — 寻路会绕开');
            return;
          }
        }
      });
      env.button('清除 NPC', function () {
        npcs.forEach(function (n) {
          map.setBlocked(n.x, n.y, false);
          n.sp.destroy();
        });
        npcs = [];
      });

      game.app.start();
      return { game: game };
    }
  });

  /* ============ Perf + NumFont ============ */
  Showcase.register({
    id: 'fw-perf-numfont',
    group: 'fw',
    title: 'Perf 探针 + NumFont 数字',
    menuNote: '分段耗时窗口汇总 · BMFont 图字回退链（3.1 P1）',
    subtitle: 'Perf：分段耗时/实体计数 2s 窗口汇总（现网 Mr2/EggSoldier 版）；NumFont：BMFont 艺术数字，字体未就绪自动回退 PIXI.Text',
    width: 480, height: 640,
    desc:
      '<ul><li>顶部大数字用 <b>NumFont</b>（blog.fnt 远程加载）：加载前显示的是 <code>PIXI.Text</code> 回退，字体就绪后下一次 setText <b>无缝切换图字</b>（样式突变可见）</li>' +
      '<li><b>Perf</b>：sim / render 两个分段打点 + 实体计数，2 秒窗口汇总到 HUD（也打 console）；' +
      '点「压力 +200」增加实体观察 avg/max 与慢帧变化</li>' +
      '<li>输出读法：分段值为 均值/最大(ms)；总帧时间远大于各段之和 → 瓶颈在 GPU/系统侧</li></ul>',
    code:
      "// ---- Perf ----\n" +
      "const perf = game.perf({ windowMs: 10000, onReport: r => hud.show(r) })\n" +
      "game.app.onTick(dt => {\n" +
      "  const t0 = Date.now(); sim.update(dt); perf.add('sim', Date.now() - t0)\n" +
      "  perf.setCounts({ 实体: entities.length })\n" +
      "  perf.frame(Date.now(), dt)\n" +
      "})\n" +
      "\n" +
      "// ---- NumFont ----\n" +
      "const nf = game.numFont({ fallbackStyle: { fontSize: 48, fill: 0xFFD166 } })\n" +
      "const tex = PIXI.Texture.from(fontPngUrl)\n" +
      "nf.load(fntUrl, tex)            // wx.request 拉 fnt；失败静默保持 Text 回退\n" +
      "const score = nf.make()          // 池化友好：make 一次 setText 复用\n" +
      "score.setText('12345', 0xFFD166, 1.2)   // 未就绪自动回退 PIXI.Text",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x131822 });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var tf = game.tf;
      var W = game.W, H = game.H;

      // ---- NumFont ----
      var nf = game.numFont({ fallbackStyle: { fontSize: 52, fill: 0xFFD166, fontWeight: 'bold' } });
      var fontState = ui.label('NumFont: PIXI.Text 回退中（字体加载…）', { size: 22, color: 0x8b94a8 });
      fontState.x = 30; fontState.y = 120;
      game.stage.addChild(fontState);

      var score = nf.make();
      score.x = W / 2; score.y = 80;
      game.stage.addChild(score);
      var scoreVal = 0;
      score.setText('0');

      var fontTex = PIXI.Texture.from('assets/remote/blog_0.png');
      nf.load('assets/remote/blog.fnt', fontTex, function (ok) {
        fontState.text = ok
          ? 'NumFont: 字体就绪 → 下一次 setText 切换图字'
          : 'NumFont: 加载失败，保持 PIXI.Text 回退（玩法不受阻）';
      });

      game.app.timer.every(100, function () {
        scoreVal += 137;
        score.setText(String(scoreVal), 0xFFD166, 0.9);
      });

      // ---- 压力实体 ----
      var entities = [];
      var pool = new PIXI.Container();
      pool.y = 170;
      game.stage.addChild(pool);
      var rng = env.framework.Rng.create(3);
      function spawn(n) {
        for (var i = 0; i < n; i++) {
          var sp = new PIXI.Sprite(tf.circle([0x4fc08d, 0xE05B4B, 0x9ecbff][i % 3], 6));
          sp.x = rng.next() * W;
          sp.y = rng.next() * (H - 420);
          sp._vx = (rng.next() - 0.5) * 200;
          sp._vy = (rng.next() - 0.5) * 200;
          pool.addChild(sp);
          entities.push(sp);
        }
      }
      spawn(150);

      // ---- Perf ----
      var hudPanel = ui.panel(W - 60, 210, { skin: { bg: { color: 0x000000, alpha: 0.55, radius: 12 } } });
      hudPanel.x = 30; hudPanel.y = H - 250;
      game.stage.addChild(hudPanel);
      var perfTitle = ui.label('Perf（2s 窗口，等待首次汇总…）', { size: 24, bold: true, color: 0x4fc08d });
      perfTitle.x = 20; perfTitle.y = 14;
      hudPanel.addChild(perfTitle);
      var perfBody = ui.label('', { size: 22, color: 0x9ecbff });
      perfBody.x = 20; perfBody.y = 54;
      hudPanel.addChild(perfBody);

      var perf = game.perf({
        windowMs: 2000,
        onReport: function (r) {
          perfTitle.text = 'Perf  ' + r.frames + '帧  avg ' + r.avgMs.toFixed(1) +
            'ms (≈' + r.fps + 'fps)  慢帧 ' + r.slow;
          var lines = ['max ' + r.maxMs.toFixed(0) + 'ms'];
          for (var k in r.segments) {
            if (r.segments.hasOwnProperty(k)) {
              lines.push(k + ' = ' + r.segments[k].avg.toFixed(2) + ' / ' + r.segments[k].max.toFixed(1) + ' ms');
            }
          }
          if (r.counts) { lines.push('实体 = ' + r.counts['实体']); }
          perfBody.text = lines.join('\n');
        }
      });

      game.app.onTick(function (dt) {
        var t0 = Date.now();
        var s = dt / 1000;
        for (var i = 0; i < entities.length; i++) {
          var e = entities[i];
          e.x += e._vx * s;
          e.y += e._vy * s;
          if (e.x < 0 || e.x > W) { e._vx *= -1; }
          if (e.y < 0 || e.y > H - 420) { e._vy *= -1; }
        }
        perf.add('sim', Date.now() - t0);
        perf.setCounts({ 实体: entities.length });
        perf.frame(Date.now(), dt);
      });

      env.button('压力 +200 实体', function () { spawn(200); });
      env.button('清空实体', function () {
        entities.forEach(function (e) { e.destroy(); });
        entities = [];
      });

      game.app.start();
      return { game: game };
    }
  });
})();
