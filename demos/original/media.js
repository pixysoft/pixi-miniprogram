/**
 * 原始功能演示 — 生态与系统：Spine / 音频 / 截图 / 扩展库
 */
(function () {
  'use strict';

  /* ============ Spine 骨骼动画 ============ */
  Showcase.register({
    id: 'core-spine',
    group: 'core',
    title: 'Spine 骨骼动画',
    menuNote: 'pixi-spine 注入模式',
    subtitle: 'PIXI 不在全局，第三方库需套一层 install(PIXI) 注入 — 这是本适配版的库生态约定',
    mode: 'pixi',
    width: 480, height: 640,
    desc:
      '<p>2022.04.11 提交加入 Spine 3.8 支持。因为适配版 PIXI 不挂到全局，' +
      'pixi-spine 被改造成 <code>module.exports = installSpine</code>，用时 <code>installSpine(PIXI)</code> 注入。</p>' +
      '<ul><li>骨骼数据为官方 example 同款 spineboy-pro（json + atlas + 纹理页），已镜像到 <code>assets/remote/</code>，不依赖外网</li>' +
      '<li>按钮可切换 hoverboard / walk / run / jump 动画，验证 <code>state.setAnimation</code></li></ul>',
    code:
      "var installSpine = require('./libs/pixi-spine')\n" +
      "installSpine(PIXI)   // 注入，之后 PIXI.spine.* 可用\n" +
      "\n" +
      "PIXI.Assets.add('spineboypro', 'assets/remote/spineboy-pro.json')\n" +
      "PIXI.Assets.load(['spineboypro']).then(res => {\n" +
      "  const boy = new PIXI.spine.Spine(res.spineboypro.spineData)\n" +
      "  boy.state.setAnimation(0, 'hoverboard', true)\n" +
      "  stage.addChild(boy)\n" +
      "})",
    run: function (env) {
      var PIXI = env.PIXI;
      return ShowcaseLoader.commonjs('libs/pixi-spine.js').then(function (installSpine) {
        installSpine(PIXI);
        var W = env.designWidth;
        var H = Math.round(W * env.canvas.height / env.canvas.width);
        var renderer = PIXI.autoDetectRenderer({
          width: W, height: H, backgroundColor: 0x1a2030,
          premultipliedAlpha: true, preserveDrawingBuffer: true, view: env.canvas
        });
        var stage = new PIXI.Container();
        var status = new PIXI.Text('加载 spineboy-pro …', { fill: 0x8b94a8, fontSize: 28 });
        status.x = 40; status.y = 40;
        stage.addChild(status);

        var boy = null;
        PIXI.Assets.add('spineboypro', 'assets/remote/spineboy-pro.json');
        PIXI.Assets.load(['spineboypro']).then(function (res) {
          boy = new PIXI.spine.Spine(res.spineboypro.spineData);
          boy.x = W / 2;
          boy.y = H - 100;
          boy.scale.set(0.55);
          boy.state.setAnimation(0, 'hoverboard', true);
          stage.addChild(boy);
          status.text = '当前动画：hoverboard';

          ['hoverboard', 'walk', 'run', 'jump'].forEach(function (name) {
            env.button(name, function () {
              if (!boy) { return; }
              boy.state.setAnimation(0, name, name !== 'jump');
              status.text = '当前动画：' + name;
            });
          });
        }).catch(function (e) {
          status.text = '骨骼资源加载失败\n' + e;
          status.style.fill = 0xff8888;
        });

        env.animate(function () { renderer.render(stage); });
        return { renderer: renderer };
      });
    }
  });

  /* ============ 音频适配 ============ */
  Showcase.register({
    id: 'core-audio',
    group: 'core',
    title: 'Audio 音频适配',
    menuNote: 'InnerAudioContext 桥接',
    subtitle: '适配层实现 HTMLAudioElement 语义的 Audio 类，内部代理 wx.createInnerAudioContext（本站 polyfill 回 HTMLAudio）',
    mode: 'pixi',
    width: 480, height: 300,
    desc:
      '<p>2022.03.29 提交加入音频支持：伪 document 的 <code>createElement("audio")</code> 返回适配层 Audio 实例，' +
      '因此 pixi sound 类库或直接 <code>new Audio(url)</code> 的代码可以照常工作。</p>' +
      '<p>演示用运行时合成的 WAV（data URI）播放两个音级 — 无需外部音频文件。点击画布上的方块也会触发音效（验证触摸 + 音频链路）。</p>',
    code:
      "// 适配层内部（src/index.js）：\n" +
      "//   createElement('audio') → new Audio()  // 包装 wx.createInnerAudioContext\n" +
      "\n" +
      "const audio = document.createElement('audio')\n" +
      "audio.src = 'https://example.com/bgm.mp3'\n" +
      "audio.loop = true\n" +
      "audio.play()",
    run: function (env) {
      var PIXI = env.PIXI;
      var W = env.designWidth;
      var H = Math.round(W * env.canvas.height / env.canvas.width);
      var renderer = PIXI.autoDetectRenderer({
        width: W, height: H, backgroundColor: 0x14171f,
        premultipliedAlpha: true, preserveDrawingBuffer: true, view: env.canvas
      });
      var stage = new PIXI.Container();
      stage.eventMode = 'static';
      stage.hitArea = new PIXI.Rectangle(0, 0, W, H);

      var status = new PIXI.Text('点击下方按钮或画布内方块播放音效', { fill: 0x9ecbff, fontSize: 28 });
      status.x = 40; status.y = 40;
      stage.addChild(status);

      var boxes = [];
      [0x4f8cff, 0x4fc08d, 0xE8A33A, 0xE05B4B].forEach(function (color, i) {
        var g = new PIXI.Graphics();
        g.beginFill(color);
        g.drawRoundedRect(0, 0, 120, 120, 16);
        g.endFill();
        g.x = 60 + i * 160;
        g.y = 160;
        g.eventMode = 'static';
        g.cursor = 'pointer';
        (function (idx) {
          g.on('pointerdown', function () {
            playTone(330 + idx * 110);
            status.text = '播放 ' + (330 + idx * 110) + ' Hz';
            g.scale.set(0.9);
            setTimeout(function () { g.scale.set(1); }, 120);
          });
        })(i);
        stage.addChild(g);
        boxes.push(g);
      });

      /** 合成 0.3s 正弦波 WAV → data URI（演示专用，避免外部音频依赖） */
      function toneURI(freq) {
        var rate = 22050, secs = 0.3, n = Math.floor(rate * secs);
        var buf = new ArrayBuffer(44 + n * 2);
        var v = new DataView(buf);
        function str(o, s) { for (var i = 0; i < s.length; i++) { v.setUint8(o + i, s.charCodeAt(i)); } }
        str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt ');
        v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
        v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data');
        v.setUint32(40, n * 2, true);
        for (var i = 0; i < n; i++) {
          var fadeOut = 1 - i / n;
          v.setInt16(44 + i * 2, Math.sin(i / rate * freq * Math.PI * 2) * 12000 * fadeOut, true);
        }
        var bytes = new Uint8Array(buf);
        var bin = '';
        for (var j = 0; j < bytes.length; j++) { bin += String.fromCharCode(bytes[j]); }
        return 'data:audio/wav;base64,' + btoa(bin);
      }

      var cache = {};
      function playTone(freq) {
        if (!cache[freq]) { cache[freq] = toneURI(freq); }
        // 与小程序页面同样的用法：经适配层 Audio → wx.createInnerAudioContext
        var ctx = wx.createInnerAudioContext();
        ctx.src = cache[freq];
        ctx.play();
        ctx.onEnded(function () { ctx.destroy(); });
      }

      env.button('播放 440Hz', function () { playTone(440); status.text = '播放 440 Hz'; });
      env.button('播放 660Hz', function () { playTone(660); status.text = '播放 660 Hz'; });

      env.animate(function () { renderer.render(stage); });
      return { renderer: renderer };
    }
  });

  /* ============ 截图导出 ============ */
  Showcase.register({
    id: 'core-snapshot',
    group: 'core',
    title: '截图导出 toDataURL',
    menuNote: 'preserveDrawingBuffer · 保存图片',
    subtitle: 'README 示例：小程序里 base64 写临时文件再存相册；PC 直接下载 PNG',
    mode: 'pixi',
    width: 480, height: 480,
    desc:
      '<p>截图前提：renderer 创建时 <code>preserveDrawingBuffer: true</code>。' +
      '小程序流程 = <code>canvas.toDataURL()</code> → <code>wx.base64ToArrayBuffer</code> → 文件系统写临时 png → <code>wx.saveImageToPhotosAlbum</code>。</p>' +
      '<p>点击「截图下载」把当前帧（时钟持续走动，每次截图内容不同）保存为 PNG。</p>',
    code:
      "// 小程序端（README 示例节选）：\n" +
      "const b64 = canvas.getContext('webgl').canvas.toDataURL()\n" +
      "const buffer = wx.base64ToArrayBuffer(b64.substring(b64.indexOf(',') + 1))\n" +
      "wx.getFileSystemManager().writeFile({\n" +
      "  filePath: wx.env.USER_DATA_PATH + '/shot.png',\n" +
      "  data: buffer, encoding: 'utf8',\n" +
      "  success: () => wx.saveImageToPhotosAlbum({ filePath })\n" +
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

      var face = new PIXI.Graphics();
      face.lineStyle(6, 0x4f8cff);
      face.beginFill(0x131722);
      face.drawCircle(0, 0, 220);
      face.endFill();
      face.x = W / 2; face.y = H / 2;
      stage.addChild(face);
      for (var i = 0; i < 12; i++) {
        var a = i / 12 * Math.PI * 2;
        var tick = new PIXI.Graphics();
        tick.beginFill(0x8b94a8);
        tick.drawRect(-4, -210, 8, 26);
        tick.endFill();
        tick.rotation = a;
        face.addChild(tick);
      }
      var handM = new PIXI.Graphics();
      handM.beginFill(0x4fc08d);
      handM.drawRect(-5, -180, 10, 180);
      handM.endFill();
      face.addChild(handM);
      var handS = new PIXI.Graphics();
      handS.beginFill(0xE05B4B);
      handS.drawRect(-3, -200, 6, 200);
      handS.endFill();
      face.addChild(handS);

      env.button('截图下载 PNG', function () {
        var url = env.canvas.toDataURL('image/png');
        var a = document.createElement('a');
        a.href = url;
        a.download = 'pixi-miniprogram-snapshot.png';
        a.click();
      });

      env.animate(function () {
        var now = Date.now() / 1000;
        handS.rotation = (now % 60) / 60 * Math.PI * 2;
        handM.rotation = (now % 3600) / 3600 * Math.PI * 2;
        renderer.render(stage);
      });
      return { renderer: renderer };
    }
  });

  /* ============ 扩展库生态 ============ */
  Showcase.register({
    id: 'core-ecosystem',
    group: 'core',
    title: '扩展库生态注入模式',
    menuNote: 'pixi-animate · Live2D · 注入约定',
    subtitle: '所有第三方 PIXI 类库统一改造为 install(PIXI) 工厂 — 演示 pixi-animate 注入与 MovieClip 创建',
    mode: 'pixi',
    width: 480, height: 360,
    desc:
      '<p>适配版 PIXI 不在全局环境，官方类库需按 README 约定包一层：</p>' +
      '<ul><li><b>pixi-spine</b>：<code>installSpine(PIXI)</code> → <code>PIXI.spine.*</code>（见 Spine 演示）</li>' +
      '<li><b>pixi-animate</b>：<code>installAnimate(PIXI)</code> → <code>PIXI.animate.MovieClip</code>（2021.5.11 修复显示问题）</li>' +
      '<li><b>Live2D</b>（2024.5.28）：四段注入 — live2d 核心 + Cubism4 核心 + <code>installCubism4(PIXI, core)</code> + <code>installPixiLive2d(PIXI, live2d, core)</code>，模型经 <code>PIXI.live2d.Live2DModel.from(url)</code> 加载。Live2D 运行时体量大且授权受限，本演示站不在线加载，小程序端可参考 example/pages/index。</li></ul>' +
      '<p>下方画布验证 pixi-animate 注入成功：<code>PIXI.animate.MovieClip</code> 可实例化并加入舞台。</p>',
    code:
      "var installAnimate = require('./libs/pixi-animate')\n" +
      "installAnimate(PIXI)\n" +
      "const mc = new PIXI.animate.MovieClip()\n" +
      "stage.addChild(mc)\n" +
      "\n" +
      "// Live2D（小程序端 example/pages/index/index.js）：\n" +
      "installCubism4(PIXI, Live2DCubismCore)\n" +
      "installPixiLive2d(PIXI, live2d, Live2DCubismCore)\n" +
      "const model = await PIXI.live2d.Live2DModel.from(model3JsonUrl)",
    run: function (env) {
      var PIXI = env.PIXI;
      return ShowcaseLoader.commonjs('libs/pixi-animate.js').then(function (installAnimate) {
        installAnimate(PIXI);
        var W = env.designWidth;
        var H = Math.round(W * env.canvas.height / env.canvas.width);
        var renderer = PIXI.autoDetectRenderer({
          width: W, height: H, backgroundColor: 0x14171f,
          premultipliedAlpha: true, preserveDrawingBuffer: true, view: env.canvas
        });
        var stage = new PIXI.Container();

        var ok = !!(PIXI.animate && PIXI.animate.MovieClip);
        var lines = [
          'PIXI.animate 注入：' + (ok ? '✓ 成功' : '✗ 失败'),
          'PIXI.animate.MovieClip 实例化：' + (function () {
            try {
              var mc = new PIXI.animate.MovieClip();
              stage.addChild(mc);
              return '✓ 成功（已加入舞台）';
            } catch (e) { return '✗ ' + e.message; }
          })(),
          '',
          '注入约定：module.exports = function install(PIXI) { ... }',
          '好处：多个 PIXI 实例（多页面）互不污染'
        ];
        lines.forEach(function (s, i) {
          var t = new PIXI.Text(s, {
            fill: s.indexOf('✓') >= 0 ? 0x4fc08d : (s.indexOf('✗') >= 0 ? 0xff8888 : 0x9ecbff),
            fontSize: 28
          });
          t.x = 40; t.y = 50 + i * 56;
          stage.addChild(t);
        });

        env.animate(function () { renderer.render(stage); });
        return { renderer: renderer };
      });
    }
  });
})();
