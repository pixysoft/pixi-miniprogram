/**
 * 原始功能演示 — 动画与特效：AnimatedSprite / myTween / Shader 遮罩
 */
(function () {
  'use strict';

  /* ============ AnimatedSprite 序列帧 ============ */
  Showcase.register({
    id: 'core-animatedsprite',
    group: 'core',
    title: 'AnimatedSprite 序列帧',
    menuNote: '图集切帧 · gotoAndPlay',
    subtitle: '与官方 example 相同的 AnimatedSprite 用法，帧来自本地条带图集（32×32 手工切片，代替远程 mc.json）',
    mode: 'pixi',
    width: 480, height: 520,
    desc:
      '<p>官方示例从远程 TexturePacker 图集（mc.json）取爆炸帧；本演示改用本地《大航海 2》船帧条带图，' +
      '用 <code>new PIXI.Texture(base, new PIXI.Rectangle(...))</code> 手工切片 — 两种方式产出的 Texture 数组对 AnimatedSprite 完全等价。</p>' +
      '<ul><li>上排 8 艘船：帆船 4 方向 × 2 帧摇摆动画，animationSpeed 各不相同</li>' +
      '<li>下排角色：行走图集 2 帧交替</li>' +
      '<li><code>gotoAndPlay(randomFrame)</code> 错峰起播，和 example 一致</li></ul>',
    code:
      "// 官方 example（远程图集）：\n" +
      "PIXI.Assets.add('mc', 'https://.../mc.json')\n" +
      "const textures = [...Array(26)].map((_, i) => PIXI.Texture.from('pic' + (i+1) + '.png'))\n" +
      "const explosion = new PIXI.AnimatedSprite(textures)\n" +
      "explosion.gotoAndPlay(Math.random() * 27 | 0)\n" +
      "\n" +
      "// 本演示（本地条带手工切帧）：\n" +
      "const base = PIXI.BaseTexture.from('assets/uw/worldShips.png')\n" +
      "const frames = [8, 9].map(i => new PIXI.Texture(base, new PIXI.Rectangle(i*32, 0, 32, 32)))\n" +
      "const ship = new PIXI.AnimatedSprite(frames)\n" +
      "ship.animationSpeed = 0.06\n" +
      "ship.play()",
    run: function (env) {
      var PIXI = env.PIXI;
      var W = env.designWidth;
      var H = Math.round(W * env.canvas.height / env.canvas.width);
      var renderer = PIXI.autoDetectRenderer({
        width: W, height: H, backgroundColor: 0x10314f,
        premultipliedAlpha: true, preserveDrawingBuffer: true, view: env.canvas
      });
      var stage = new PIXI.Container();

      var shipBase = PIXI.BaseTexture.from('assets/uw/worldShips.png');
      var charBase = PIXI.BaseTexture.from('assets/uw/portCharacters.png');
      shipBase.scaleMode = PIXI.SCALE_MODES.NEAREST;
      charBase.scaleMode = PIXI.SCALE_MODES.NEAREST;

      function frames(base, list) {
        return list.map(function (i) {
          return new PIXI.Texture(base, new PIXI.Rectangle(i * 32, 0, 32, 32));
        });
      }

      function build() {
        var label = new PIXI.Text('worldShips.png — 帆船 4 方向 × 2 帧', { fill: 0x9ecbff, fontSize: 24 });
        label.x = 40; label.y = 30;
        stage.addChild(label);

        // 帆船帧区 8..15：n,e,s,w × 2
        for (var d = 0; d < 8; d++) {
          var pair = [8 + (d % 4) * 2, 8 + (d % 4) * 2 + 1];
          var sp = new PIXI.AnimatedSprite(frames(shipBase, pair));
          sp.width = 108; sp.height = 108;
          sp.x = 55 + (d % 4) * 170;
          sp.y = 90 + Math.floor(d / 4) * 170;
          sp.animationSpeed = 0.04 + d * 0.012;
          sp.gotoAndPlay((Math.random() * 2) | 0);
          stage.addChild(sp);
        }

        var label2 = new PIXI.Text('portCharacters.png — 角色行走帧', { fill: 0x9ecbff, fontSize: 24 });
        label2.x = 40; label2.y = 470;
        stage.addChild(label2);

        var types = [[4, 5], [12, 13], [20, 21], [24, 25], [26, 27], [28, 29]];
        types.forEach(function (pair, i) {
          var sp = new PIXI.AnimatedSprite(frames(charBase, pair));
          sp.width = 84; sp.height = 84;
          sp.x = 55 + i * 112;
          sp.y = 530;
          sp.animationSpeed = 0.05;
          sp.gotoAndPlay(i % 2);
          stage.addChild(sp);
        });
      }

      var pending = 2;
      function ready() { if (--pending === 0) { build(); } }
      if (shipBase.valid) { pending--; } else { shipBase.once('loaded', ready); }
      if (charBase.valid) { pending--; } else { charBase.once('loaded', ready); }
      if (pending === 0) { build(); }

      env.animate(function () { renderer.render(stage); });
      return { renderer: renderer };
    }
  });

  /* ============ myTween 缓动库 ============ */
  Showcase.register({
    id: 'core-tween',
    group: 'core',
    title: 'myTween 缓动库',
    menuNote: '配套补间 · 11 组缓动公式',
    subtitle: '仓库自带的轻量补间库（example/libs/myTween.js），主循环里 myTween.update() 驱动',
    mode: 'pixi',
    width: 480, height: 640,
    desc:
      '<p>myTween 是随适配层提供的配套库：<code>myTween.to(obj, seconds, { x, ease, onEnd })</code>，' +
      '缓动公式覆盖 Linear / Quad / Cubic / Quart / Sine / Expo / Circ / Elastic / Back / Bounce / Quint，各含 In/Out/InOut。</p>' +
      '<p>每行一个小方块用不同缓动公式往返移动，直观对比手感差异。framework 3.0 的 <code>actions + easing</code> 是它的声明式升级版（见新增功能演示）。</p>',
    code:
      "var myTween = require('./libs/myTween')\n" +
      "\n" +
      "myTween.to(sprite, 1.2, {\n" +
      "  x: 600,\n" +
      "  ease: myTween.Bounce.Out,\n" +
      "  onEnd: function () { console.log('done') }\n" +
      "})\n" +
      "\n" +
      "function animate() {\n" +
      "  canvas.requestAnimationFrame(animate)\n" +
      "  renderer.render(stage)\n" +
      "  myTween.update()   // 主循环驱动\n" +
      "}",
    run: function (env) {
      var PIXI = env.PIXI;
      return ShowcaseLoader.commonjs('libs/myTween.js').then(function (myTween) {
        var W = env.designWidth;
        var H = Math.round(W * env.canvas.height / env.canvas.width);
        var renderer = PIXI.autoDetectRenderer({
          width: W, height: H, backgroundColor: 0x14171f,
          premultipliedAlpha: true, preserveDrawingBuffer: true, view: env.canvas
        });
        var stage = new PIXI.Container();

        var eases = [
          ['Linear.None', myTween.Linear.None, 0x8b94a8],
          ['Quad.InOut', myTween.Quad.InOut, 0x4f8cff],
          ['Cubic.Out', myTween.Cubic.Out, 0x4fc08d],
          ['Sine.InOut', myTween.Sine.InOut, 0x6fd3ff],
          ['Expo.Out', myTween.Expo.Out, 0xC9A8FF],
          ['Back.Out', myTween.Back.Out, 0xE8A33A],
          ['Elastic.Out', myTween.Elastic.Out, 0xE05B4B],
          ['Bounce.Out', myTween.Bounce.Out, 0xffd166]
        ];

        var x0 = 40, x1 = W - 120;
        eases.forEach(function (item, i) {
          var y = 80 + i * 118;
          var t = new PIXI.Text(item[0], { fill: 0x8b94a8, fontSize: 24 });
          t.x = x0; t.y = y - 40;
          stage.addChild(t);
          var track = new PIXI.Graphics();
          track.beginFill(0x232a3b);
          track.drawRoundedRect(x0, y + 26, x1 - x0 + 80, 8, 4);
          track.endFill();
          stage.addChild(track);
          var box = new PIXI.Graphics();
          box.beginFill(item[2]);
          box.drawRoundedRect(0, 0, 64, 64, 12);
          box.endFill();
          box.x = x0; box.y = y;
          stage.addChild(box);

          (function bounce(target) {
            myTween.to(box, 1.6, {
              x: target,
              ease: item[1],
              onEnd: function () { bounce(target === x1 ? x0 : x1); }
            });
          })(x1);
        });

        env.animate(function () {
          renderer.render(stage);
          myTween.update();
        });
        return {
          renderer: renderer,
          destroy: function () { myTween.clean(); }
        };
      });
    }
  });

  /* ============ Shader 遮罩 ============ */
  Showcase.register({
    id: 'core-mask-shader',
    group: 'core',
    title: '自定义 Shader 遮罩',
    menuNote: 'PIXI.Filter · generateTexture',
    subtitle: 'README 遮罩示例复刻：遮罩形状 generateTexture 后作为 uniform 传入片元着色器相乘',
    mode: 'pixi',
    width: 480, height: 520,
    desc:
      '<p>2021.3.25 提交加入的遮罩方案：小程序环境常规 <code>sprite.mask</code> 在旧版微信有兼容问题，' +
      'README 提供了 shader 乘法遮罩做法 —— 遮罩形状必须是<strong>白色</strong>（目标色 × 遮罩色）。</p>' +
      '<ul><li>左：原始黄色方块</li><li>右：同一方块经圆形 shader 遮罩后变成圆形，遮罩圆随时间缩放</li>' +
      '<li>着色器 eval 依赖 <code>unsafeEval</code> 补丁（小程序禁用 eval，本适配层已内置静态版本）</li></ul>',
    code:
      "var frag = [\n" +
      "  'varying vec2 vTextureCoord;',\n" +
      "  'uniform vec4 inputPixel;',\n" +
      "  'uniform vec2 dimensions;',\n" +
      "  'uniform sampler2D uSampler;',\n" +
      "  'uniform sampler2D masktex;',\n" +
      "  'void main(void) {',\n" +
      "  '  vec4 color = texture2D(uSampler, vTextureCoord);',\n" +
      "  '  vec2 coord = vTextureCoord.xy * inputPixel.xy / dimensions.xy;',\n" +
      "  '  gl_FragColor = color * texture2D(masktex, coord);',\n" +
      "  '}'\n" +
      "].join('\\n')\n" +
      "\n" +
      "const maskshape = new PIXI.Graphics()\n" +
      "maskshape.beginFill(0xFFFFFF)      // 必须白色\n" +
      "maskshape.drawCircle(100, 100, 100)\n" +
      "const masktex = renderer.generateTexture(maskshape)\n" +
      "\n" +
      "target.filters = [new PIXI.Filter(null, frag, { masktex, dimensions: [200, 200] })]",
    run: function (env) {
      var PIXI = env.PIXI;
      var W = env.designWidth;
      var H = Math.round(W * env.canvas.height / env.canvas.width);
      var renderer = PIXI.autoDetectRenderer({
        width: W, height: H, backgroundColor: 0x14171f,
        premultipliedAlpha: true, preserveDrawingBuffer: true, view: env.canvas
      });
      var stage = new PIXI.Container();

      function box(x, y, label) {
        var g = new PIXI.Graphics();
        g.beginFill(0xFFFF00);
        g.drawRect(0, 0, 260, 260);
        g.endFill();
        g.beginFill(0xE05B4B);
        g.drawRect(30, 30, 90, 90);
        g.endFill();
        g.beginFill(0x4f8cff);
        g.drawRect(140, 140, 90, 90);
        g.endFill();
        g.x = x; g.y = y;
        stage.addChild(g);
        var t = new PIXI.Text(label, { fill: 0x8b94a8, fontSize: 24 });
        t.x = x; t.y = y + 280;
        stage.addChild(t);
        return g;
      }

      box(60, 140, '原始 Graphics');
      var target = box(420, 140, '+ 圆形 shader 遮罩');

      var frag =
        'varying vec2 vTextureCoord;\n' +
        'uniform vec4 inputPixel;\n' +
        'uniform vec2 dimensions;\n' +
        'uniform sampler2D uSampler;\n' +
        'uniform sampler2D masktex;\n' +
        'void main(void) {\n' +
        '  vec4 color = texture2D(uSampler, vTextureCoord);\n' +
        '  vec2 coord = vTextureCoord.xy * inputPixel.xy / dimensions.xy;\n' +
        '  vec4 maskcolor = texture2D(masktex, coord);\n' +
        '  gl_FragColor = color * maskcolor;\n' +
        '}\n';

      var maskshape = new PIXI.Graphics();
      maskshape.beginFill(0xFFFFFF);
      maskshape.drawCircle(130, 130, 130);
      maskshape.endFill();
      stage.addChild(maskshape);
      var masktex = renderer.generateTexture(maskshape);
      stage.removeChild(maskshape);

      var shader = new PIXI.Filter(null, frag, {
        masktex: masktex,
        dimensions: [260, 260]
      });
      target.filters = [shader];

      env.animate(function () {
        var s = 0.75 + Math.sin(Date.now() / 600) * 0.25;
        target.scale.set(s);
        target.x = 420 + (260 - 260 * s) / 2;
        target.y = 140 + (260 - 260 * s) / 2;
        renderer.render(stage);
      });
      return { renderer: renderer };
    }
  });
})();
