/**
 * framework 演示 — 演出层与数据层
 * Particle / FxLayer / filters / AudioManager / Store+Gateway+Rng / app.snapshot
 */
(function () {
  'use strict';

  /* ============ Particle 粒子 ============ */
  Showcase.register({
    id: 'fw-particle',
    group: 'fw',
    title: 'Particle 轻量粒子',
    menuNote: '点/圆发射器 · 对象池 · burst（3.0 P1）',
    subtitle: 'Egret particle 属性集裁剪版：rate/life/speed/angle/spread/gravity/alpha/scale，上限 100 粒防低端机掉帧',
    desc:
      '<ul><li><b>火焰</b>：向上窄扇面 + 缩小衰减；<b>喷泉</b>：重力回落；<b>雪</b>：圆形出生区缓慢飘落</li>' +
      '<li><b>点击画布任意处</b>：<code>burst(24)</code> 一次性爆发（不依赖 start）</li>' +
      '<li>粒子精灵走对象池复用，HUD 显示活跃数（上限 100）</li></ul>',
    code:
      "const fire = game.particle({\n" +
      "  texture: game.tc.circle(10, 0xFF8844),\n" +
      "  rate: 60, life: 700, lifeVar: 200,\n" +
      "  speed: 160, angle: -90, spread: 40,\n" +
      "  scaleFrom: 1.2, scaleTo: 0.2, alphaTo: 0,\n" +
      "  max: 100\n" +
      "})\n" +
      "stage.addChild(fire.container)\n" +
      "fire.setPos(x, y)\n" +
      "fire.start()          // 持续发射\n" +
      "boom.burst(24)        // 一次性爆发",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x14171F });
      var ui = game.ui;
      var W = game.W, H = game.H;

      var fire = game.particle({
        texture: game.tc.circle(10, 0xFF8844),
        rate: 60, life: 700, lifeVar: 200,
        speed: 160, speedVar: 40, angle: -90, spread: 40,
        scaleFrom: 1.2, scaleTo: 0.2, alphaFrom: 1, alphaTo: 0
      });
      fire.setPos(W * 0.2, H * 0.42);
      game.stage.addChild(fire.container);
      fire.start();

      var fountain = game.particle({
        texture: game.tc.circle(7, 0x6fd3ff),
        rate: 50, life: 1400, speed: 330, speedVar: 60,
        angle: -90, spread: 30, gravity: 420,
        alphaTo: 0.1
      });
      fountain.setPos(W * 0.5, H * 0.46);
      game.stage.addChild(fountain.container);
      fountain.start();

      var snow = game.particle({
        texture: game.tc.circle(6, 0xFFFFFF),
        rate: 24, life: 2600, speed: 60, speedVar: 20,
        angle: 90, spread: 30, shape: 'circle', radius: 130,
        alphaFrom: 0.9, alphaTo: 0, scaleFrom: 1, scaleTo: 0.4
      });
      snow.setPos(W * 0.8, H * 0.2);
      game.stage.addChild(snow.container);
      snow.start();

      var boom = game.particle({
        texture: game.tc.panel(10, 10, 0xFFD166, 1, 3),
        rate: 0, life: 600, lifeVar: 150,
        speed: 300, speedVar: 120, spread: 360, gravity: 300,
        alphaTo: 0, scaleTo: 0.3
      });
      game.stage.addChild(boom.container);

      ['火焰', '喷泉', '雪'].forEach(function (name, i) {
        var t = ui.label(name, { size: 24, color: 0x8b94a8 });
        t.x = [W * 0.2, W * 0.5, W * 0.8][i] - t.width / 2;
        t.y = H * 0.52;
        game.stage.addChild(t);
      });

      game.stage.on('pointerdown', function (e) {
        var g = e.data.global;
        boom.setPos(g.x, g.y);
        boom.burst(24);
      });

      var hud = ui.label('', { size: 24, color: 0x4fc08d });
      hud.x = 30; hud.y = 24;
      game.stage.addChild(hud);
      game.app.onTick(function () {
        hud.text = '活跃粒子 ' + (fire.count() + fountain.count() + snow.count() + boom.count()) +
          '（各发射器上限 100，对象池复用）— 点击画布 burst';
      });

      game.app.start();
      return { game: game };
    }
  });

  /* ============ FxLayer 战斗反馈 ============ */
  Showcase.register({
    id: 'fw-fxlayer',
    group: 'fw',
    title: 'FxLayer 战斗反馈层',
    menuNote: '飘字 · 碎块 · 圆环（3.0 P1）',
    subtitle: '收编 KR2 Fx：伤害/暴击/金币飘字（Text 对象池）+ 死亡碎块四散 + 技能圆环扩散',
    desc:
      '<ul><li><b>点击怪物</b>：普通/魔法/灼烧伤害随机飘字，10% 暴击（1.5 倍字号）；掉血到 0 播放 <code>burst</code> 碎块 + 金币飘字后重生</li>' +
      '<li>飘字皮肤键 <code>FxText: { damage/coin/crit/label }</code> 可整体换色</li>' +
      '<li>Text 实例走对象池 — 连点不产生新对象（HUD 显示活跃数）</li></ul>',
    code:
      "const fx = game.fxLayer({})          // 自动接入主循环\n" +
      "stage.addChild(fx.container)\n" +
      "\n" +
      "fx.damageText(x, y, 128)                    // 白色伤害\n" +
      "fx.damageText(x, y, 128, 'magic')           // 紫色魔法\n" +
      "fx.damageText(x, y, 384, null, true)        // 暴击 1.5x\n" +
      "fx.coinText(x, y, 50)                       // +50 金币\n" +
      "fx.burst(x, y, 0xE05B4B, 8)                 // 死亡碎块\n" +
      "fx.ring(x, y, 90, 0xF2914E)                 // 圆环扩散",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x1B2030 });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var W = game.W;

      var fx = game.fxLayer({});
      game.stage.addChild(fx.container);

      var tip = ui.label('点击怪物攻击！', { size: 30, bold: true });
      tip.x = 40; tip.y = 40;
      game.stage.addChild(tip);
      var poolInfo = ui.label('', { size: 24, color: 0x8b94a8 });
      poolInfo.x = 40; poolInfo.y = 90;
      game.stage.addChild(poolInfo);

      var monsters = [];
      [[180, 400, 0x7A4A8C, '史莱姆'], [400, 480, 0x4A6E8C, '石像鬼'], [590, 380, 0x8C5A4A, '火蜥蜴']].forEach(function (m) {
        var c = new PIXI.Container();
        var body = new PIXI.Sprite(game.tc.circle(64, m[2]));
        c.addChild(body);
        var eyes = new PIXI.Graphics();
        eyes.beginFill(0xFFFFFF);
        eyes.drawCircle(42, 48, 10);
        eyes.drawCircle(86, 48, 10);
        eyes.endFill();
        eyes.beginFill(0x14171f);
        eyes.drawCircle(44, 50, 5);
        eyes.drawCircle(88, 50, 5);
        eyes.endFill();
        c.addChild(eyes);
        c.x = m[0] - 64; c.y = m[1] - 64;
        var hpBar = ui.progressBar(128, 22);
        hpBar.y = 140;
        c.addChild(hpBar);
        var name = ui.label(m[3], { size: 20, color: 0x8b94a8 });
        name.x = 34; name.y = 168;
        c.addChild(name);
        c.eventMode = 'static';
        c.cursor = 'pointer';
        var mon = { c: c, hp: 500, max: 500, bar: hpBar, color: m[2], home: { x: m[0], y: m[1] } };
        hpBar.setRatio(1);
        hpBar.setText('500');
        c.on('pointerdown', function () { hit(mon); });
        game.stage.addChild(c);
        monsters.push(mon);
      });

      function hit(mon) {
        if (mon.hp <= 0) { return; }
        var crit = Math.random() < 0.1;
        var types = [null, 'magic', 'burn'];
        var dmg = 40 + Math.floor(Math.random() * 80);
        if (crit) { dmg *= 3; }
        mon.hp = Math.max(0, mon.hp - dmg);
        mon.bar.setRatio(mon.hp / mon.max);
        mon.bar.setText(String(mon.hp));
        var cx = mon.home.x, cy = mon.home.y - 40;
        fx.damageText(cx, cy, dmg, types[Math.floor(Math.random() * 3)], crit);
        if (crit) { fx.ring(cx, cy + 40, 100, 0xF2914E); }
        mon.c.x = mon.home.x - 64 + (Math.random() * 12 - 6);
        if (mon.hp <= 0) {
          fx.burst(cx, cy + 40, mon.color, 10);
          fx.coinText(cx, cy, 50 + Math.floor(Math.random() * 100));
          fx.label(cx - 30, cy - 60, '击杀！', 0xFFD166);
          mon.c.visible = false;
          game.app.timer.after(1600, function () {
            mon.hp = mon.max;
            mon.bar.setRatio(1);
            mon.bar.setText(String(mon.max));
            mon.c.visible = true;
            fx.label(cx - 30, cy, '重生', 0x4fc08d);
          });
        }
      }

      game.app.onTick(function () {
        poolInfo.text = '活跃 Fx 对象：' + fx.activeCount() + '（Text 对象池复用）';
      });

      game.app.start();
      return { game: game };
    }
  });

  /* ============ filters 预设 ============ */
  Showcase.register({
    id: 'fw-filters',
    group: 'fw',
    title: 'filters 滤镜预设',
    menuNote: 'night / hurt / glow · tint 回退（3.0 P1）',
    subtitle: 'ColorMatrixFilter 预设三件套；unsafeEval 不可用时自动回退 tint 叠色（设计文档风险对策）',
    desc:
      '<ul><li><b>night</b>：降亮度 + 偏蓝（昼夜系统）；<b>hurt</b>：红闪（受击）；<b>glow</b>：提亮（选中提示）</li>' +
      '<li>作用目标是整个场景容器 — 一行代码全场变夜晚</li>' +
      '<li>返回 <code>{ type: "filter" | "tint" }</code> 告知实际走了哪条路径；<code>clear(target)</code> 只清本模块施加的效果</li></ul>',
    code:
      "const filters = game.filters\n" +
      "\n" +
      "const r = filters.night(sceneRoot)   // { type: 'filter' } 或降级 { type: 'tint' }\n" +
      "filters.hurt(player)\n" +
      "filters.glow(selectedBuilding)\n" +
      "filters.clear(sceneRoot)             // 清除预设（filter 与 tint 回退都清）\n" +
      "\n" +
      "// 自定义 shader（沿 README 遮罩示例封装）：\n" +
      "const f = filters.custom(fragSrc, { masktex, dimensions: [200, 200] })",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x0E2C4A });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var W = game.W;

      var scene = new PIXI.Container();
      game.stage.addChild(scene);

      // 小镇场景：地面 + 建筑 + 太阳
      var ground = new PIXI.Sprite(game.tc.panel(W, 300, 0x3E7C4F, 1, 0));
      ground.y = 560;
      scene.addChild(ground);
      var sun = new PIXI.Sprite(game.tc.circle(60, 0xFFD166));
      sun.x = W - 220; sun.y = 60;
      scene.addChild(sun);
      var houses = [];
      [[80, 0x8C5A4A], [280, 0x4A6E8C], [480, 0x7A6E4A]].forEach(function (hcfg) {
        var h = new PIXI.Container();
        var body = new PIXI.Sprite(game.tc.panel(150, 170, hcfg[1], 1, 6));
        body.y = 60;
        h.addChild(body);
        var roof = new PIXI.Graphics();
        roof.beginFill(0x5A3A30);
        roof.moveTo(-14, 64); roof.lineTo(75, 0); roof.lineTo(164, 64);
        roof.endFill();
        h.addChild(roof);
        var win = new PIXI.Sprite(game.tc.panel(44, 44, 0xFFE9A0, 1, 4));
        win.x = 52; win.y = 120;
        h.addChild(win);
        h.x = hcfg[0]; h.y = 400;
        scene.addChild(h);
        houses.push(h);
      });

      var status = ui.label('预设：无', { size: 28, bold: true, color: 0xFFD166 });
      status.x = 40; status.y = 40;
      game.stage.addChild(status);
      var pathInfo = ui.label('', { size: 24, color: 0x8b94a8 });
      pathInfo.x = 40; pathInfo.y = 90;
      game.stage.addChild(pathInfo);

      function apply(name) {
        game.filters.clear(scene);
        houses.forEach(function (h) { game.filters.clear(h); });
        if (name === 'night') {
          var r = game.filters.night(scene);
          status.text = '预设：night（全场景变夜）';
          pathInfo.text = '实际路径 type = "' + r.type + '"';
        } else if (name === 'hurt') {
          var r2 = game.filters.hurt(scene);
          status.text = '预设：hurt（受击红闪）';
          pathInfo.text = '实际路径 type = "' + r2.type + '"';
          game.app.timer.after(500, function () {
            game.filters.clear(scene);
            status.text = '预设：无（hurt 已自动清除）';
          });
        } else if (name === 'glow') {
          var r3 = game.filters.glow(houses[1]);
          status.text = '预设：glow（中间房子被选中提亮）';
          pathInfo.text = '实际路径 type = "' + r3.type + '"';
        } else {
          status.text = '预设：无';
          pathInfo.text = '';
        }
      }

      env.button('night 夜晚', function () { apply('night'); });
      env.button('hurt 受击', function () { apply('hurt'); });
      env.button('glow 选中', function () { apply('glow'); });
      env.button('clear 清除', function () { apply(null); });

      game.app.start();
      return { game: game };
    }
  });

  /* ============ AudioManager ============ */
  Showcase.register({
    id: 'fw-audio',
    group: 'fw',
    title: 'AudioManager 音频管理',
    menuNote: 'BGM 交叉淡入 · SFX 并发上限（3.0 P0）',
    subtitle: '双通道 BGM 交叉淡入（切曲无爆音断音）；SFX 并发上限 4 防 iOS 爆音；URL 注册制',
    width: 480, height: 420,
    desc:
      '<ul><li>点「BGM A / B」切换背景音：旧曲淡出与新曲淡入同时进行（400ms 双通道交叉），同曲目重复点击不打断</li>' +
      '<li>「连发 8 个 SFX」验证并发上限：同时最多 4 路，最旧的被淘汰</li>' +
      '<li>音源是运行时合成的和弦 WAV（data URI），无外部依赖；静音开关记住曲目，解除后可续播</li></ul>',
    code:
      "const audio = game.audio          // createGame 已装配并接入主循环\n" +
      "\n" +
      "audio.registerAll({\n" +
      "  bgm_town: 'https://cdn/.../town.mp3',\n" +
      "  bgm_sea: 'https://cdn/.../sea.mp3',\n" +
      "  sfx_coin: 'https://cdn/.../coin.mp3'\n" +
      "})\n" +
      "\n" +
      "audio.playBgm('bgm_town', { fade: 400 })   // 交叉淡入切曲\n" +
      "audio.playSfx('sfx_coin')                  // 并发上限 4\n" +
      "audio.setMuted(true)                       // 记住曲目",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x14171F });
      var ui = game.ui;
      var W = game.W;

      /** 合成多音符循环 WAV（data URI） */
      function chordURI(freqs, secs) {
        var rate = 22050;
        var n = Math.floor(rate * secs);
        var buf = new ArrayBuffer(44 + n * 2);
        var v = new DataView(buf);
        function str(o, s) { for (var i = 0; i < s.length; i++) { v.setUint8(o + i, s.charCodeAt(i)); } }
        str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt ');
        v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
        v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data');
        v.setUint32(40, n * 2, true);
        for (var i = 0; i < n; i++) {
          var s = 0;
          for (var f = 0; f < freqs.length; f++) {
            // 音符分段：每 0.4s 换一个音符做旋律感
            var seg = Math.floor(i / rate / 0.4) % freqs.length;
            if (f === seg) { s += Math.sin(i / rate * freqs[f] * Math.PI * 2) * 0.8; }
          }
          var envAmp = Math.min(1, (n - i) / (rate * 0.05));
          v.setInt16(44 + i * 2, s * 9000 * envAmp, true);
        }
        var bytes = new Uint8Array(buf);
        var bin = '';
        for (var j = 0; j < bytes.length; j++) { bin += String.fromCharCode(bytes[j]); }
        return 'data:audio/wav;base64,' + btoa(bin);
      }

      var status = ui.label('未播放', { size: 30, bold: true, color: 0xFFD166 });
      status.x = 40; status.y = 60;
      game.stage.addChild(status);
      var sub = ui.label('（浏览器策略：需先点击页面任意处才允许出声）', { size: 22, color: 0x8b94a8 });
      sub.x = 40; sub.y = 120;
      game.stage.addChild(sub);

      game.audio.registerAll({
        bgm_a: chordURI([262, 330, 392, 330], 3.2),   // C 大调琶音
        bgm_b: chordURI([220, 262, 330, 262], 3.2),   // a 小调琶音
        sfx_coin: chordURI([880, 1175], 0.22),
        sfx_hit: chordURI([170, 130], 0.18)
      });

      env.button('BGM A（C 大调）', function () {
        game.audio.playBgm('bgm_a', { fade: 400 });
        status.text = 'BGM A 播放中（交叉淡入 400ms）';
      });
      env.button('BGM B（a 小调）', function () {
        game.audio.playBgm('bgm_b', { fade: 400 });
        status.text = 'BGM B 播放中（交叉淡入 400ms）';
      });
      env.button('停止 BGM', function () {
        game.audio.stopBgm();
        status.text = 'BGM 已停止';
      });
      env.button('SFX 金币', function () { game.audio.playSfx('sfx_coin'); });
      env.button('连发 8 个 SFX', function () {
        var i = 0;
        var cancel = game.app.timer.every(90, function () {
          game.audio.playSfx(i % 2 ? 'sfx_coin' : 'sfx_hit');
          if (++i >= 8) { cancel(); }
        });
        game.toast.show('8 连发（并发上限 4，最旧被淘汰）');
      });
      var muted = false;
      env.button('静音开关', function () {
        muted = !muted;
        game.audio.setMuted(muted);
        if (!muted && game.audio.currentBgm()) {
          var key = game.audio.currentBgm();
          // 静音时记住了曲目，解除后由游戏侧重新 playBgm
          game.audio.playBgm(key === 'bgm_a' ? 'bgm_b' : 'bgm_a', { fade: 0 });
          game.audio.playBgm(key, { fade: 0 });
        }
        status.text = muted ? '已静音（记住曲目）' : '已解除静音';
      });

      var vol = ui.label('BGM 音量', { size: 26 });
      vol.x = 40; vol.y = 220;
      game.stage.addChild(vol);
      var slider = ui.slider({
        w: W - 80, min: 0, max: 100, step: 5, value: 60,
        onChange: function (v) { game.audio.setVolume(v / 100, undefined); }
      });
      slider.x = 40; slider.y = 280;
      game.stage.addChild(slider);

      game.app.start();
      return { game: game };
    }
  });

  /* ============ Store / Gateway / Rng ============ */
  Showcase.register({
    id: 'fw-data',
    group: 'fw',
    title: 'Store / Gateway / Rng 数据层',
    menuNote: '存档校验 · 接口抽象 · 可复现随机',
    subtitle: 'Store：节流落盘 + djb2 校验 + 版本迁移；Gateway：本地实现可整体切远程；Rng：mulberry32 种子复现',
    width: 480, height: 640,
    desc:
      '<ul><li><b>Store</b>：「打金币」后存档（wx.storage → 本站 localStorage）；<b>刷新页面再回来金币仍在</b>；校验和防篡改，版本迁移表平滑升档</li>' +
      '<li><b>Rng</b>：同种子两条流水完全一致（画布对比）；<code>weighted</code> 按权重抽卡</li>' +
      '<li><b>Gateway</b>：本地 handler 起步、上线后 <code>useRemote</code> 平滑切服务器（可按 endpoint 过滤），调用方无感</li></ul>',
    code:
      "// Store：节流写盘 + 校验 + 迁移（迁移表键 = 存档 v 字段）\n" +
      "const store = framework.Store.create('save', {\n" +
      "  migrations: { 1: save => { save.data.gems = 0; return 2 } }\n" +
      "})\n" +
      "const save = store.load() || { v: 2, data: { gold: 0, gems: 0 } }\n" +
      "store.save(save, true)   // immediate=true 立即落盘，否则节流\n" +
      "\n" +
      "// Rng：种子复现\n" +
      "const rng = framework.Rng.create(12345)\n" +
      "rng.int(100); rng.pick(list)\n" +
      "rng.weighted([{ v: 'SSR', w: 1 }, { v: 'R', w: 9 }]).v\n" +
      "\n" +
      "// Gateway：本地 handler 同步返回；useRemote 后走服务器\n" +
      "const gw = framework.Gateway.create('/game/demo/')\n" +
      "gw.registerLocal('shop/buy', payload => ({ ok: true }))\n" +
      "gw.call('shop/buy', { id: 1 }, ret => { /* ... */ })\n" +
      "gw.useRemote((opts, cb) => wx.request({ ...opts, success: cb }),\n" +
      "             ep => ep.startsWith('rank/'))   // 只远程化部分接口",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x14171F });
      var ui = game.ui;
      var fw = env.framework;
      var W = game.W;

      /* Store */
      var t1 = ui.label('Store 持久化存档', { size: 30, bold: true });
      t1.x = 40; t1.y = 36;
      game.stage.addChild(t1);

      var store = fw.Store.create('showcase_save', {
        throttleMs: 500,
        migrations: {
          1: function (save) { save.data.gems = 0; return 2; }   // v1 → v2 补 gems 字段
        }
      });
      var loaded = store.load();
      var state = (loaded && loaded.data) || { gold: 0, gems: 0 };

      var goldLabel = ui.label('', { size: 28, color: 0xFFD166 });
      goldLabel.x = 40; goldLabel.y = 90;
      game.stage.addChild(goldLabel);
      function refreshGold() {
        goldLabel.text = '金币 ' + state.gold + '   宝石 ' + state.gems + '（刷新页面后仍在）';
      }
      refreshGold();

      var mine = ui.button('打金币 +10（节流落盘）', 400, 84, {
        onTap: function () {
          state.gold += 10;
          store.save({ v: 2, data: state });
          refreshGold();
        }
      });
      mine.x = 40; mine.y = 150;
      game.stage.addChild(mine);
      var wipe = ui.button('清档', 180, 84, {
        skin: { bg: { color: 0xE05B4B } },
        onTap: function () {
          state = { gold: 0, gems: 0 };
          store.save({ v: 2, data: state }, true);
          refreshGold();
          game.toast.show('已清档');
        }
      });
      wipe.x = 470; wipe.y = 150;
      game.stage.addChild(wipe);

      /* Rng */
      var t2 = ui.label('Rng 可复现随机（seed = 12345）', { size: 30, bold: true });
      t2.x = 40; t2.y = 290;
      game.stage.addChild(t2);
      var rngOut = ui.label('', { size: 24, color: 0x9ecbff });
      rngOut.x = 40; rngOut.y = 340;
      game.stage.addChild(rngOut);

      function rollBoth() {
        var a = fw.Rng.create(12345);
        var b = fw.Rng.create(12345);
        var la = [], lb = [];
        for (var i = 0; i < 8; i++) { la.push(a.int(100)); lb.push(b.int(100)); }
        var gacha = [];
        var c = fw.Rng.create(Date.now());
        for (var j = 0; j < 6; j++) {
          gacha.push(c.weighted([
            { v: 'SSR', w: 1 }, { v: 'SR', w: 3 }, { v: 'R', w: 10 }
          ]).v);
        }
        rngOut.text = '流水 A: ' + la.join(' ') + '\n流水 B: ' + lb.join(' ') +
          '  ← 同种子完全一致\nweighted 抽卡: ' + gacha.join(' ');
      }
      rollBoth();
      var reroll = ui.button('重新生成', 240, 76, { onTap: rollBoth });
      reroll.x = 40; reroll.y = 460;
      game.stage.addChild(reroll);

      /* Gateway */
      var t3 = ui.label('Gateway 接口抽象', { size: 30, bold: true });
      t3.x = 40; t3.y = 590;
      game.stage.addChild(t3);
      var gwOut = ui.label('', { size: 24, color: 0x9ecbff });
      gwOut.x = 40; gwOut.y = 640;
      game.stage.addChild(gwOut);

      var gw = fw.Gateway.create('/game/showcase/');
      var stock = 3;
      gw.registerLocal('shop/buy', function () {
        if (stock > 0) {
          stock--;
          return { ok: true, left: stock };
        }
        return { ok: false, msg: '售罄' };
      });

      var buyLocal = ui.button('本地 shop/buy', 280, 76, {
        onTap: function () {
          gw.call('shop/buy', { id: 1 }, function (ret) {
            gwOut.text = '本地 handler 返回: ' + JSON.stringify(ret);
          });
        }
      });
      buyLocal.x = 40; buyLocal.y = 700;
      game.stage.addChild(buyLocal);

      var goRemote = ui.button('切换远程', 240, 76, {
        skin: { bg: { color: 0xE8A33A } },
        onTap: function () {
          gw.useRemote(function (opts, cb) {
            // 真实项目里这里是 wx.request；演示用延迟模拟服务器
            setTimeout(function () {
              cb({ ok: true, from: 'server', endpoint: opts.endpoint });
            }, 300);
          });
          gwOut.text = '已 useRemote — 再点「本地 shop/buy」看返回来源变化';
        }
      });
      goRemote.x = 360; goRemote.y = 700;
      game.stage.addChild(goRemote);

      game.app.start();
      return { game: game };
    }
  });

  /* ============ app.snapshot ============ */
  Showcase.register({
    id: 'fw-snapshot',
    group: 'fw',
    title: 'app.snapshot 截图分享',
    menuNote: 'wx 存相册 / 非 wx 回 dataURL（3.0 P3）',
    subtitle: '内核封装 README 截图流程：wx 环境写临时 png（可存相册）；非 wx 环境自动回退返回 dataURL',
    width: 480, height: 520,
    desc:
      '<p>本站 polyfill <b>刻意不提供</b> <code>wx.getFileSystemManager</code>，' +
      '因此走的是内核内置的非 wx 降级路径 — 拿到 dataURL 后贴回舞台形成「画中画」，并可下载。</p>' +
      '<p>这正是"同一份代码，两端行为自动适配"的演示：小程序端同一行 <code>app.snapshot()</code> 会写文件 + 存相册。</p>',
    code:
      "game.app.snapshot((err, res) => {\n" +
      "  if (err) return\n" +
      "  // wx 环境：res = 临时文件路径（opts.album=true 已存相册）\n" +
      "  // 非 wx 环境：res = dataURL\n" +
      "}, { album: true })",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x0E2C4A });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var fw = env.framework;
      var W = game.W;

      // 动态场景
      var sun = new PIXI.Sprite(game.tc.circle(50, 0xFFD166));
      sun.x = W - 180; sun.y = 60;
      game.stage.addChild(sun);
      var sea = new PIXI.Sprite(game.tc.panel(W, 320, 0x14406b, 1, 0));
      sea.y = 420;
      game.stage.addChild(sea);
      var ship = new PIXI.Sprite(game.tc.panel(60, 60, 0xFFFFFF, 1, 8));
      ship.anchor && ship.anchor.set(0.5);
      ship.y = 420;
      game.stage.addChild(ship);
      game.app.actions.run(ship, fw.actions.forever(fw.actions.sequence(
        fw.actions.moveTo(2500, { x: W - 80 }, fw.easing.sineInOut),
        fw.actions.moveTo(2500, { x: 80 }, fw.easing.sineInOut)
      )));
      ship.x = 80;

      var frame = ui.panel(260, 360, { skin: { bg: { color: 0x000000, alpha: 0.4, radius: 12 } } });
      frame.x = 30; frame.y = 60;
      game.stage.addChild(frame);
      var frameLabel = ui.label('截图预览区', { size: 22, color: 0x8b94a8 });
      frameLabel.x = 24; frameLabel.y = 18;
      frame.addChild(frameLabel);
      var shot = null;
      var lastURL = null;

      env.button('app.snapshot()', function () {
        game.app.snapshot(function (err, res) {
          if (err || !res) {
            game.toast.show('截图失败');
            return;
          }
          lastURL = res;
          if (shot) { frame.removeChild(shot); shot.destroy(); }
          shot = PIXI.Sprite.from(res);
          shot.width = 212;
          shot.height = 212 * game.H / W;
          shot.x = 24; shot.y = 56;
          frame.addChild(shot);
          game.toast.show('已回 dataURL（非 wx 降级路径）');
        });
      });
      env.button('下载 PNG', function () {
        if (!lastURL) {
          game.toast.show('先截一张');
          return;
        }
        var a = document.createElement('a');
        a.href = lastURL;
        a.download = 'app-snapshot.png';
        a.click();
      });

      game.app.start();
      return { game: game };
    }
  });
})();
