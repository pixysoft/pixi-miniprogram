/**
 * 原始功能演示 — 基础渲染：Sprite 触摸 / Graphics / Text / BitmapText
 * 全部按照 example/pages/index 的初始化序列编写（createPIXI + unsafeEval + 自建 renderer）
 */
(function () {
  'use strict';

  /* ============ 1. Sprite 与触摸交互 ============ */
  Showcase.register({
    id: 'core-sprite',
    group: 'core',
    title: 'Sprite 与触摸事件',
    menuNote: '贴图渲染 · pointerdown / 拖拽',
    subtitle: '适配层把小程序 touch 事件转成 PIXI FederatedPointerEvent，eventMode / on("pointerdown") 与浏览器版 pixi 完全一致',
    mode: 'pixi',
    width: 480, height: 640,
    desc:
      '<p>小程序没有 DOM 事件，适配层做了两件事：页面 <code>touchEvent</code> 把 wx 触摸事件喂给 <code>PIXI.dispatchEvent(e)</code>；' +
      '内部伪 window 把它转成 pixi EventSystem 认识的 TouchEvent（含坐标按 <code>designWidth / canvas.width</code> 比例换算）。</p>' +
      '<ul><li>点击船：船会闪烁并飘到点击处（pointerdown 命中检测）</li>' +
      '<li>拖动背景任意位置：海面波纹圆环跟随（stage 级 pointermove）</li>' +
      '<li>本演示的贴图来自《大航海时代 2》像素占位图集（32×32 帧）</li></ul>',
    code:
      "import { createPIXI } from './libs/pixi.miniprogram'\n" +
      "const PIXI = createPIXI(canvas, 750)   // canvas 宽度 750 设计坐标\n" +
      "unsafeEval(PIXI)\n" +
      "const renderer = PIXI.autoDetectRenderer({ width: 750, height: H, view: canvas })\n" +
      "const stage = new PIXI.Container()\n" +
      "\n" +
      "const ship = PIXI.Sprite.from('assets/uw/worldShips.png')\n" +
      "ship.eventMode = 'static'\n" +
      "ship.on('pointerdown', e => console.log(e.data.global))\n" +
      "\n" +
      "// 小程序页面里：touchEvent(e) { PIXI.dispatchEvent(e) }  ← 本站用鼠标事件模拟",
    run: function (env) {
      var PIXI = env.PIXI;
      var W = env.designWidth;
      var H = Math.round(W * env.canvas.height / env.canvas.width);
      var renderer = PIXI.autoDetectRenderer({
        width: W, height: H, backgroundColor: 0x10314f,
        premultipliedAlpha: true, preserveDrawingBuffer: true, view: env.canvas
      });
      var stage = new PIXI.Container();
      stage.eventMode = 'static';
      stage.hitArea = new PIXI.Rectangle(0, 0, W, H);

      // 海面网格底
      var grid = new PIXI.Graphics();
      grid.lineStyle(1, 0x1b4a75, 0.6);
      for (var gx = 0; gx <= W; gx += 50) { grid.moveTo(gx, 0); grid.lineTo(gx, H); }
      for (var gy = 0; gy <= H; gy += 50) { grid.moveTo(0, gy); grid.lineTo(W, gy); }
      stage.addChild(grid);

      var tip = new PIXI.Text('点击船 / 拖动海面', { fill: 0x9ecbff, fontSize: 30 });
      tip.x = 24; tip.y = 24;
      stage.addChild(tip);

      var base = PIXI.BaseTexture.from('assets/uw/worldShips.png');
      var ship = new PIXI.Sprite(PIXI.Texture.WHITE);
      ship.width = 96; ship.height = 96;
      ship.anchor.set(0.5);
      ship.x = W / 2; ship.y = H / 2;
      ship.eventMode = 'static';
      ship.cursor = 'pointer';
      stage.addChild(ship);

      function applyFrame() {
        // 帆船南向帧：第 12 帧（32×32）
        ship.texture = new PIXI.Texture(base, new PIXI.Rectangle(12 * 32, 0, 32, 32));
        ship.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        ship.width = 96; ship.height = 96;
      }
      if (base.valid) { applyFrame(); } else { base.once('loaded', applyFrame); }

      var target = { x: ship.x, y: ship.y };
      var flash = 0;
      ship.on('pointerdown', function () {
        flash = 300;
        tip.text = '命中 Sprite！pointerdown 已触发';
      });

      var rings = [];
      stage.on('pointermove', function (e) {
        var g = e.data.global;
        target.x = g.x; target.y = g.y;
        var ring = new PIXI.Graphics();
        ring.lineStyle(3, 0x6fd3ff, 0.9);
        ring.drawCircle(0, 0, 8);
        ring.x = g.x; ring.y = g.y;
        stage.addChild(ring);
        rings.push({ g: ring, life: 500 });
      });
      stage.on('pointerdown', function (e) {
        var g = e.data.global;
        target.x = g.x; target.y = g.y;
      });

      env.animate(function (dt) {
        ship.x += (target.x - ship.x) * 0.06;
        ship.y += (target.y - ship.y) * 0.06;
        ship.rotation = Math.sin(Date.now() / 400) * 0.08;
        if (flash > 0) {
          flash -= dt;
          ship.tint = (Math.floor(Date.now() / 80) % 2) ? 0xffffff : 0xff6666;
          if (flash <= 0) { ship.tint = 0xffffff; }
        }
        for (var i = rings.length - 1; i >= 0; i--) {
          var r = rings[i];
          r.life -= dt;
          r.g.scale.set(r.g.scale.x + dt / 220);
          r.g.alpha = Math.max(0, r.life / 500);
          if (r.life <= 0) { stage.removeChild(r.g); r.g.destroy(); rings.splice(i, 1); }
        }
        renderer.render(stage);
      });

      return { renderer: renderer };
    }
  });

  /* ============ 2. Graphics 矢量绘制 ============ */
  Showcase.register({
    id: 'core-graphics',
    group: 'core',
    title: 'Graphics 矢量绘制',
    menuNote: '离屏 2d canvas 适配 · 图元 API',
    subtitle: '小程序 WebGL canvas 拿不到 2d 上下文，适配层用 wx.createOffscreenCanvas 离屏 2d 承接 Graphics/Text 光栅化',
    mode: 'pixi',
    width: 480, height: 640,
    desc:
      '<p>这是本适配版最核心的一处改造：<code>PIXI.Graphics</code> 与 <code>PIXI.Text</code> 需要 2d canvas 光栅化，' +
      '而小程序同一块 canvas 只能取一种上下文。适配层重写 <code>document.createElement("canvas")</code>，' +
      '内部改用 <code>wx.createOffscreenCanvas({type:"2d"})</code>（基础库 ≥2.16.1）。</p>' +
      '<p>演示覆盖常用图元：矩形 / 圆角矩形 / 圆 / 多边形（星形）/ 弧线 / lineStyle 描边，全部实时旋转确认 WebGL 渲染路径正常。</p>',
    code:
      "const g = new PIXI.Graphics()\n" +
      "g.beginFill(0xFF3300)\n" +
      "g.drawRect(0, 0, 100, 100)\n" +
      "g.endFill()\n" +
      "\n" +
      "g.lineStyle(4, 0x4f8cff, 1)\n" +
      "g.beginFill(0xE8A33A)\n" +
      "g.drawRoundedRect(0, 0, 140, 90, 18)\n" +
      "g.drawCircle(70, 200, 46)\n" +
      "g.drawStar && g.drawStar(70, 330, 5, 50)   // 7.x extras\n" +
      "g.endFill()\n" +
      "stage.addChild(g)",
    run: function (env) {
      var PIXI = env.PIXI;
      var W = env.designWidth;
      var H = Math.round(W * env.canvas.height / env.canvas.width);
      var renderer = PIXI.autoDetectRenderer({
        width: W, height: H, backgroundColor: 0x14171f,
        premultipliedAlpha: true, preserveDrawingBuffer: true, view: env.canvas
      });
      var stage = new PIXI.Container();

      function makeItem(draw, label, x, y) {
        var c = new PIXI.Container();
        var g = new PIXI.Graphics();
        draw(g);
        c.addChild(g);
        var t = new PIXI.Text(label, { fill: 0x8b94a8, fontSize: 22 });
        t.y = 96;
        t.x = -t.width / 2;
        c.addChild(t);
        c.x = x; c.y = y;
        stage.addChild(c);
        return g;
      }

      var spin = [];
      spin.push(makeItem(function (g) {
        g.beginFill(0xE05B4B);
        g.drawRect(-40, -40, 80, 80);
        g.endFill();
      }, 'drawRect', 130, 120));

      spin.push(makeItem(function (g) {
        g.lineStyle(5, 0x4f8cff);
        g.beginFill(0x1a2030);
        g.drawRoundedRect(-45, -35, 90, 70, 16);
        g.endFill();
      }, 'roundedRect + line', 375, 120));

      spin.push(makeItem(function (g) {
        g.beginFill(0x4fc08d);
        g.drawCircle(0, 0, 42);
        g.endFill();
        g.beginFill(0x14171f);
        g.drawCircle(14, -10, 12);
        g.endFill();
      }, 'drawCircle', 620, 120));

      spin.push(makeItem(function (g) {
        g.beginFill(0xE8A33A);
        var pts = [];
        for (var i = 0; i < 10; i++) {
          var r = (i % 2) ? 20 : 48;
          var a = i / 10 * Math.PI * 2 - Math.PI / 2;
          pts.push(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.drawPolygon(pts);
        g.endFill();
      }, 'drawPolygon 星形', 130, 340));

      spin.push(makeItem(function (g) {
        g.lineStyle(6, 0xC9A8FF);
        g.arc(0, 0, 40, 0, Math.PI * 1.5);
      }, 'arc 弧线', 375, 340));

      spin.push(makeItem(function (g) {
        g.lineStyle(3, 0x6fd3ff);
        g.moveTo(-50, 30);
        g.bezierCurveTo(-20, -60, 20, 60, 50, -30);
      }, 'bezierCurveTo', 620, 340));

      // 大号动态波形：每帧 clear + 重绘
      var wave = new PIXI.Graphics();
      wave.y = 620;
      stage.addChild(wave);
      var label = new PIXI.Text('每帧 clear() + 重绘（动态 Graphics）', { fill: 0x8b94a8, fontSize: 22 });
      label.x = 130; label.y = 700;
      stage.addChild(label);

      env.animate(function () {
        var t = Date.now() / 1000;
        spin.forEach(function (g, i) { g.rotation = t * (0.4 + i * 0.12); });
        wave.clear();
        wave.lineStyle(4, 0x4f8cff, 1);
        for (var x = 0; x <= W - 120; x += 6) {
          var y = Math.sin(x / 46 + t * 2.6) * 34;
          if (x === 0) { wave.moveTo(60 + x, y); } else { wave.lineTo(60 + x, y); }
        }
        renderer.render(stage);
      });
      return { renderer: renderer };
    }
  });

  /* ============ 3. Text 文本渲染 ============ */
  Showcase.register({
    id: 'core-text',
    group: 'core',
    title: 'Text 文本渲染',
    menuNote: '样式 · 描边 · 动态更新',
    subtitle: 'PIXI.Text 光栅化走独立离屏 2d canvas（canvas2dText），支持样式与运行时改字',
    mode: 'pixi',
    width: 480, height: 640,
    desc:
      '<p>历史上（2021.1.14 提交）Text 与 Graphics 曾各需外部传入一块 type=2d canvas；' +
      '2021.12.09 起改为 <code>wx.createOffscreenCanvas</code> 内部创建，调用方无感。</p>' +
      '<ul><li>支持 fontSize / fill / fontWeight / stroke / wordWrap 等标准 TextStyle</li>' +
      '<li>运行时改 <code>text.text</code> 会自动重光栅化（右下角计数器每帧更新）</li>' +
      '<li>中文渲染正常（小程序真机使用系统字体）</li></ul>',
    code:
      "const title = new PIXI.Text('分数: 1234', {\n" +
      "  fill: '#ff0000', fontSize: 44, fontWeight: 'bold',\n" +
      "  stroke: '#ffffff', strokeThickness: 3\n" +
      "})\n" +
      "stage.addChild(title)\n" +
      "\n" +
      "title.text = '分数: ' + score   // 动态更新自动重绘",
    run: function (env) {
      var PIXI = env.PIXI;
      var W = env.designWidth;
      var H = Math.round(W * env.canvas.height / env.canvas.width);
      var renderer = PIXI.autoDetectRenderer({
        width: W, height: H, backgroundColor: 0x14171f,
        premultipliedAlpha: true, preserveDrawingBuffer: true, view: env.canvas
      });
      var stage = new PIXI.Container();

      var samples = [
        new PIXI.Text('基础样式 fontSize 40', { fill: 0xffffff, fontSize: 40 }),
        new PIXI.Text('粗体 + 颜色', { fill: 0x4fc08d, fontSize: 44, fontWeight: 'bold' }),
        new PIXI.Text('描边文字 Stroke', { fill: 0xE8A33A, fontSize: 48, stroke: 0x14171f, strokeThickness: 8, fontWeight: 'bold' }),
        new PIXI.Text('阴影 dropShadow', { fill: 0x9ecbff, fontSize: 40, dropShadow: true, dropShadowDistance: 4, dropShadowColor: 0x000000, dropShadowAlpha: 0.8 }),
        new PIXI.Text('自动换行 wordWrap：这一段较长的中文文本会在 560px 处自动折行显示，验证中文分词。', { fill: 0xdde3f0, fontSize: 30, wordWrap: true, wordWrapWidth: 560 })
      ];
      var y = 60;
      samples.forEach(function (t) {
        t.x = 60; t.y = y;
        y += t.height + 34;
        stage.addChild(t);
      });

      var counter = new PIXI.Text('', { fill: 0xff5555, fontSize: 60, fontWeight: 'bold' });
      counter.x = 60; counter.y = y + 20;
      stage.addChild(counter);
      var hint = new PIXI.Text('↑ 每帧更新 text 属性（重光栅化）', { fill: 0x8b94a8, fontSize: 24 });
      hint.x = 60; hint.y = y + 110;
      stage.addChild(hint);

      var n = 0;
      env.animate(function () {
        n++;
        if (n % 6 === 0) { counter.text = '帧数 ' + n; }
        renderer.render(stage);
      });
      return { renderer: renderer };
    }
  });

  /* ============ 4. BitmapText 位图字体 ============ */
  Showcase.register({
    id: 'core-bitmaptext',
    group: 'core',
    title: 'BitmapText 位图字体',
    menuNote: '.fnt 加载 · xmldom 解析（需联网）',
    subtitle: '小程序无 DOMParser，适配层内置 xmldom 解析 .fnt XML；fnt/json 必须走网络（小程序不能 require 本地二进制）',
    mode: 'pixi',
    width: 480, height: 400,
    desc:
      '<p>加载链路完整穿过适配层：<code>PIXI.Assets</code> → 内置 fetch 桥（wx.request）→ xmldom 解析 fnt → 纹理页图片经 <code>canvas.createImage()</code> 加载。</p>' +
      '<p class="warn">此演示从 raw.githubusercontent.com 加载 blog.fnt（与官方 example 相同资源），离线或网络受限时会失败，不影响其他演示。</p>',
    code:
      "PIXI.Assets.add('blog', 'https://raw.githubusercontent.com/skyfish-qc/imgres/master/blog.fnt')\n" +
      "PIXI.Assets.load(['blog']).then(() => {\n" +
      "  const btext = new PIXI.BitmapText('score:1234', {\n" +
      "    fontName: 'blog', fontSize: 60, tint: 0xffff00\n" +
      "  })\n" +
      "  stage.addChild(btext)\n" +
      "})",
    run: function (env) {
      var PIXI = env.PIXI;
      var W = env.designWidth;
      var H = Math.round(W * env.canvas.height / env.canvas.width);
      var renderer = PIXI.autoDetectRenderer({
        width: W, height: H, backgroundColor: 0x1a2030,
        premultipliedAlpha: true, preserveDrawingBuffer: true, view: env.canvas
      });
      var stage = new PIXI.Container();
      var loading = new PIXI.Text('加载 blog.fnt …', { fill: 0x8b94a8, fontSize: 30 });
      loading.x = 40; loading.y = 40;
      stage.addChild(loading);

      var score = 1234;
      var btext = null;
      PIXI.Assets.add('blog', 'https://raw.githubusercontent.com/skyfish-qc/imgres/master/blog.fnt');
      PIXI.Assets.load(['blog']).then(function () {
        loading.text = 'BitmapText（GPU 纹理拼字，改字零光栅化成本）';
        loading.style.fontSize = 24;
        btext = new PIXI.BitmapText('score:' + score, { fontName: 'blog', fontSize: 60, tint: 0xffff00 });
        btext.x = 40; btext.y = 120;
        stage.addChild(btext);
        var b2 = new PIXI.BitmapText('hello pixi 7.3.2', { fontName: 'blog', fontSize: 44, tint: 0x6fd3ff });
        b2.x = 40; b2.y = 240;
        stage.addChild(b2);
      }).catch(function (e) {
        loading.text = '网络资源加载失败（需联网）\n' + e;
        loading.style.fill = 0xff8888;
      });

      env.animate(function (dt) {
        if (btext) {
          score += Math.round(dt);
          btext.text = 'score:' + score;
        }
        renderer.render(stage);
      });
      return { renderer: renderer };
    }
  });
})();
