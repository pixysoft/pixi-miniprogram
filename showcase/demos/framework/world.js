/**
 * framework 演示 — 世界表现层（3.0 P0/P2）
 * Camera / SpriteAnimator+addStrip / ChunkWorld+ChunkRenderer / EntityManager / PinchPan
 */
(function () {
  'use strict';

  /* 共用：程序化瓦片纹理组 */
  function makeTileTextures(game) {
    var tc = game.tc;
    return {
      water: null,   // 海面留背景色
      waterLight: tc.panel(32, 32, 0x14406b, 1, 0),
      sand: tc.panel(32, 32, 0xC9B27C, 1, 0),
      grass: tc.panel(32, 32, 0x3E7C4F, 1, 0),
      forest: tc.panel(32, 32, 0x2C5E3A, 1, 0),
      rock: tc.panel(32, 32, 0x6E6A62, 1, 0)
    };
  }

  /* 共用：确定性岛屿地形（无需资源，任何坐标可求值 → 无限世界） */
  function terrainAt(wx, wy) {
    function h(x, y) {
      var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return n - Math.floor(n);
    }
    var v = 0;
    v += Math.sin(wx * 0.11) * Math.cos(wy * 0.13) * 0.5;
    v += Math.sin(wx * 0.031 + 5) * Math.cos(wy * 0.027 + 2) * 0.9;
    v += h(Math.floor(wx / 3), Math.floor(wy / 3)) * 0.25;
    if (v > 1.05) { return 5; }        // rock
    if (v > 0.85) { return 4; }        // forest
    if (v > 0.62) { return 3; }        // grass
    if (v > 0.5) { return 2; }         // sand
    if (v > 0.3) { return 1; }         // 浅水
    return 0;                          // deep water
  }

  function tileTexture(texs) {
    var order = [null, texs.waterLight, texs.sand, texs.grass, texs.forest, texs.rock];
    return function (tile) { return order[tile] || null; };
  }

  /* ============ Camera 世界相机 ============ */
  Showcase.register({
    id: 'fw-camera',
    group: 'fw',
    title: 'Camera 世界相机',
    menuNote: '平滑跟随 · 拖拽接管 · 空闲回跟（3.0 P0）',
    subtitle: '合并大航海平滑跟随 + Rich4 手动拖拽：镜头插值追目标，拖动接管 2.5s 后自动回跟，边界钳制',
    width: 760, height: 480, designWidth: 1200,
    desc:
      '<ul><li>船沿路径自动巡航，镜头 <code>cam.focus(ship)</code> 平滑跟随（线性插值，非硬锁定）</li>' +
      '<li><b>拖动画面</b>：进入手动模式（左上角状态变橙），镜头交给你；静置 2.5s 自动飞回船身</li>' +
      '<li>地图 3600×2400，镜头永远不出界（clamp）；小地图白框 = 当前视口</li></ul>',
    code:
      "const cam = framework.Camera.create(mapW, mapH, game.W, game.H, { idleReturnMs: 2500 })\n" +
      "\n" +
      "// 拖拽接管（stage 级 pointermove）\n" +
      "stage.on('pointermove', e => cam.dragBy(dx, dy))\n" +
      "\n" +
      "game.app.onTick(dt => {\n" +
      "  cam.update(dt, { x: ship.x, y: ship.y })   // 空闲回跟点\n" +
      "  if (!cam.isManual()) cam.focus(ship.x, ship.y)\n" +
      "  const off = cam.getOffset()\n" +
      "  world.x = -off.x; world.y = -off.y\n" +
      "})",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x0E2C4A });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var fw = env.framework;
      var W = game.W, H = game.H;
      var MAP_W = 3600, MAP_H = 2400;

      var world = new PIXI.Container();
      game.stage.addChild(world);

      // 稀疏岛屿装饰（性能：直接铺 64px 大块）
      var texs = makeTileTextures(game);
      for (var ty = 0; ty < MAP_H / 64; ty++) {
        for (var tx = 0; tx < MAP_W / 64; tx++) {
          var t = terrainAt(tx * 2, ty * 2);
          if (t < 2) { continue; }
          var order = [null, null, texs.sand, texs.grass, texs.forest, texs.rock];
          var sp = new PIXI.Sprite(order[t]);
          sp.x = tx * 64; sp.y = ty * 64;
          sp.width = 64; sp.height = 64;
          world.addChild(sp);
        }
      }
      // 地图边界
      var border = new PIXI.Graphics();
      border.lineStyle(6, 0xE8A33A, 0.8);
      border.drawRect(0, 0, MAP_W, MAP_H);
      world.addChild(border);

      var ship = new PIXI.Sprite(game.tc.panel(46, 46, 0xFFFFFF, 1, 10));
      ship.anchor && ship.anchor.set(0.5);
      world.addChild(ship);
      var shipBase = PIXI.BaseTexture.from('assets/uw/worldShips.png');
      shipBase.scaleMode = PIXI.SCALE_MODES.NEAREST;
      function setShipTex() {
        ship.texture = new PIXI.Texture(shipBase, new PIXI.Rectangle(12 * 32, 0, 32, 32));
        ship.width = 56; ship.height = 56;
      }
      if (shipBase.valid) { setShipTex(); } else { shipBase.once('loaded', setShipTex); }

      var cam = fw.Camera.create(MAP_W, MAP_H, W, H, { idleReturnMs: 2500 });
      cam.snapTo(600, 600);

      // 巡航路径
      var waypoints = [
        { x: 600, y: 600 }, { x: 2800, y: 700 }, { x: 3000, y: 1900 },
        { x: 1500, y: 2100 }, { x: 500, y: 1500 }
      ];
      var wpIdx = 0;
      ship.x = waypoints[0].x; ship.y = waypoints[0].y;

      // 拖拽接管
      var dragging = false, lastX = 0, lastY = 0;
      game.stage.on('pointerdown', function (e) {
        dragging = true;
        lastX = e.data.global.x; lastY = e.data.global.y;
      });
      game.stage.on('pointermove', function (e) {
        if (!dragging) { return; }
        var g = e.data.global;
        cam.dragBy(g.x - lastX, g.y - lastY);
        lastX = g.x; lastY = g.y;
      });
      game.stage.on('pointerup', function () { dragging = false; });
      game.stage.on('pointerupoutside', function () { dragging = false; });

      // HUD
      var hud = ui.panel(430, 96, { skin: { bg: { color: 0x000000, alpha: 0.55, radius: 12 } } });
      hud.x = 20; hud.y = 20;
      game.stage.addChild(hud);
      var mode = ui.label('', { size: 26, bold: true });
      mode.x = 20; mode.y = 14;
      hud.addChild(mode);
      var pos = ui.label('', { size: 22, color: 0x8b94a8 });
      pos.x = 20; pos.y = 54;
      hud.addChild(pos);

      // 小地图
      var MINI = 150;
      var mini = new PIXI.Container();
      mini.x = W - MINI - 24; mini.y = 24;
      game.stage.addChild(mini);
      var miniBg = new PIXI.Sprite(game.tc.panel(MINI, MINI * MAP_H / MAP_W, 0x000000, 0.55, 8));
      mini.addChild(miniBg);
      var miniShip = new PIXI.Sprite(game.tc.circle(4, 0xFFFFFF));
      mini.addChild(miniShip);
      var miniView = new PIXI.Graphics();
      mini.addChild(miniView);

      game.app.onTick(function (dt) {
        // 船巡航
        var wp = waypoints[wpIdx];
        var dx = wp.x - ship.x, dy = wp.y - ship.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 10) {
          wpIdx = (wpIdx + 1) % waypoints.length;
        } else {
          var speed = 220 * dt / 1000;
          ship.x += dx / dist * speed;
          ship.y += dy / dist * speed;
          ship.rotation = Math.sin(Date.now() / 300) * 0.06;
        }

        if (!cam.isManual()) { cam.focus(ship.x, ship.y); }
        cam.update(dt, { x: ship.x, y: ship.y });
        var off = cam.getOffset();
        world.x = -off.x;
        world.y = -off.y;

        mode.text = cam.isManual() ? '手动模式（2.5s 后回跟）' : '自动跟随中';
        mode.style.fill = cam.isManual() ? 0xE8A33A : 0x4fc08d;
        pos.text = '镜头偏移 ' + off.x + ', ' + off.y + ' — 拖动画面接管镜头';

        var k = MINI / MAP_W;
        miniShip.x = ship.x * k - 4;
        miniShip.y = ship.y * k - 4;
        miniView.clear();
        miniView.lineStyle(2, 0xFFFFFF, 0.9);
        miniView.drawRect(off.x * k, off.y * k, W * k, H * k);
      });

      game.app.start();
      return { game: game };
    }
  });

  /* ============ SpriteAnimator + addStrip ============ */
  Showcase.register({
    id: 'fw-animator',
    group: 'fw',
    title: 'SpriteAnimator + addStrip',
    menuNote: '条带切帧 · dt 驱动帧动画（3.0 P0）',
    subtitle: 'assets.addStrip 按等宽切条带图集自动注册帧（key_01..NN）；game.animator(sprite) 自动接管主循环',
    width: 480, height: 560,
    desc:
      '<ul><li><code>addStrip("ship", url, 32)</code>：worldShips.png（1024×32）自动切成 ship_01..ship_32</li>' +
      '<li>SpriteAnimator dt 驱动（与帧率解耦），支持 fps / loop / onEnd；sprite 销毁后自动从主循环剔除</li>' +
      '<li>点方向按钮切换航向 clip（4 方向 × 2 帧）；拖 fps 滑杆实时变速</li></ul>',
    code:
      "game.assets.addStrip('ship', 'assets/uw/worldShips.png', 32)\n" +
      "game.assets.loadGroup(['ship'], () => {\n" +
      "  const anim = game.animator(shipSprite)      // 自动接入主循环\n" +
      "  anim.add('sail_n', [assets.texture('ship_09'), assets.texture('ship_10')])\n" +
      "  anim.add('sail_e', [assets.texture('ship_11'), assets.texture('ship_12')])\n" +
      "  anim.play('sail_e', { fps: 4, loop: true })\n" +
      "})",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x10314f });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var W = game.W;

      var status = ui.label('加载条带图集…', { size: 28 });
      status.x = 40; status.y = 40;
      game.stage.addChild(status);

      game.assets.addStrip('ship', 'assets/uw/worldShips.png', 32);
      game.assets.addStrip('walker', 'assets/uw/portCharacters.png', 32);

      game.assets.loadGroup(['ship', 'walker'], function (ok) {
        if (!ok) {
          status.text = '图集加载失败';
          return;
        }
        var A = game.assets;
        status.text = 'addStrip 自动切帧：ship_01..32 / walker_01..32';
        status.style.fontSize = 24;
        status.style.fill = 0x9ecbff;

        function tex(n) {
          var t = A.texture(n);
          t.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
          return t;
        }

        // 大船（帆船帧区 9..16 = n,e,s,w × 2）
        var ship = new PIXI.Sprite(tex('ship_13'));
        ship.width = 160; ship.height = 160;
        ship.x = (W - 160) / 2; ship.y = 150;
        game.stage.addChild(ship);
        var anim = game.animator(ship);
        anim.add('北', [tex('ship_09'), tex('ship_10')]);
        anim.add('东', [tex('ship_11'), tex('ship_12')]);
        anim.add('南', [tex('ship_13'), tex('ship_14')]);
        anim.add('西', [tex('ship_15'), tex('ship_16')]);
        anim.play('南', { fps: 4 });

        var fps = 4;
        var cur = '南';
        var info = ui.label('clip: 南   fps: 4', { size: 28, color: 0xFFD166 });
        info.x = 40; info.y = 360;
        game.stage.addChild(info);

        ['北', '东', '南', '西'].forEach(function (dir, i) {
          var b = ui.button(dir, 130, 76, {
            onTap: function () {
              cur = dir;
              anim.play(dir, { fps: fps });
              info.text = 'clip: ' + dir + '   fps: ' + fps;
            }
          });
          b.x = 40 + i * 156; b.y = 430;
          game.stage.addChild(b);
        });

        var slider = ui.slider({
          w: W - 80, min: 1, max: 24, step: 1, value: 4,
          onChange: function (v) {
            fps = v;
            anim.play(cur, { fps: fps });
            info.text = 'clip: ' + cur + '   fps: ' + fps;
          }
        });
        slider.x = 40; slider.y = 560;
        game.stage.addChild(slider);

        // 一排小角色（懒注册：直接用帧名前缀播放）
        var caption = ui.label('portCharacters 条带 — 多实例独立播放', { size: 24, color: 0x8b94a8 });
        caption.x = 40; caption.y = 640;
        game.stage.addChild(caption);
        for (var i = 0; i < 6; i++) {
          var start = [5, 13, 21, 25, 27, 29][i];
          var w = new PIXI.Sprite(tex('walker_' + (start < 10 ? '0' + start : start)));
          w.width = 84; w.height = 84;
          w.x = 40 + i * 106; w.y = 690;
          game.stage.addChild(w);
          var wa = game.animator(w);
          wa.add('idle', [
            tex('walker_' + (start < 10 ? '0' + start : start)),
            tex('walker_' + (start + 1 < 10 ? '0' + (start + 1) : (start + 1)))
          ]);
          wa.play('idle', { fps: 2 + i });
        }
      });

      game.app.start();
      return { game: game };
    }
  });

  /* ============ ChunkWorld + ChunkRenderer ============ */
  Showcase.register({
    id: 'fw-chunkworld',
    group: 'fw',
    title: 'ChunkWorld 无限分块世界',
    menuNote: 'ChunkProvider · 视口加载/卸载（3.0 P2）',
    subtitle: '32×32 瓦片一个 chunk，视口驱动按需加载，出视口 keepRing 圈即卸载 — 内存不随移动增长',
    width: 760, height: 480, designWidth: 1200,
    desc:
      '<ul><li><b>拖动画面</b>朝任何方向无限航行 — 地形由确定性函数按坐标即时生成（ChunkProvider 协议：seed 生成 / 远程 / 预烘焙均可）</li>' +
      '<li>HUD 实时显示已加载 chunk 数与渲染容器数：无论走多远，数量恒定在视口规模</li>' +
      '<li>ChunkRenderer 每 chunk 一个 Container + Sprite 池，卸载即回收</li>' +
      '<li><code>staticProvider</code> 可把 1.0 时代整张静态地图包装成同一协议</li></ul>',
    code:
      "const provider = {\n" +
      "  getChunk(cx, cy, cb) {          // 任意生成源：seed / 远程 / 预烘焙\n" +
      "    const tiles = new Array(32 * 32)\n" +
      "    /* ...按世界坐标求地形... */\n" +
      "    cb(tiles)\n" +
      "  }\n" +
      "}\n" +
      "const world = framework.ChunkWorld.create(provider, { chunkSize: 32, keepRing: 2 })\n" +
      "const renderer = framework.ChunkRenderer.create(PIXI, world, {\n" +
      "  tileSize: 24,\n" +
      "  textureFor: tile => tileTextures[tile]   // null = 跳过（海面留背景）\n" +
      "})\n" +
      "\n" +
      "game.app.onTick(() => renderer.update(camX, camY, game.W, game.H))",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x0E2C4A });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var fw = env.framework;
      var W = game.W, H = game.H;
      var TILE = 24;
      var loads = 0, unloads = 0;

      var provider = {
        getChunk: function (cx, cy, cb) {
          var size = 32;
          var tiles = new Array(size * size);
          for (var ly = 0; ly < size; ly++) {
            for (var lx = 0; lx < size; lx++) {
              tiles[ly * size + lx] = terrainAt(cx * size + lx, cy * size + ly);
            }
          }
          cb(tiles);
        }
      };

      var world = fw.ChunkWorld.create(provider, {
        chunkSize: 32, keepRing: 1,
        onLoad: function () { loads++; },
        onUnload: function () { unloads++; }
      });

      var texs = makeTileTextures(game);
      var chunkRenderer = fw.ChunkRenderer.create(PIXI, world, {
        tileSize: TILE,
        textureFor: tileTexture(texs),
        pad: 0
      });
      game.stage.addChild(chunkRenderer.container);

      var camX = 0, camY = 0;
      var dragging = false, lastX = 0, lastY = 0;
      game.stage.on('pointerdown', function (e) {
        dragging = true;
        lastX = e.data.global.x; lastY = e.data.global.y;
      });
      game.stage.on('pointermove', function (e) {
        if (!dragging) { return; }
        var g = e.data.global;
        camX -= g.x - lastX;
        camY -= g.y - lastY;
        lastX = g.x; lastY = g.y;
      });
      game.stage.on('pointerup', function () { dragging = false; });
      game.stage.on('pointerupoutside', function () { dragging = false; });

      var hud = ui.panel(560, 128, { skin: { bg: { color: 0x000000, alpha: 0.55, radius: 12 } } });
      hud.x = 20; hud.y = 20;
      game.stage.addChild(hud);
      var l1 = ui.label('', { size: 24, bold: true, color: 0x4fc08d });
      l1.x = 20; l1.y = 14;
      hud.addChild(l1);
      var l2 = ui.label('', { size: 22, color: 0x8b94a8 });
      l2.x = 20; l2.y = 52;
      hud.addChild(l2);
      var l3 = ui.label('拖动画面无限航行 →', { size: 22, color: 0x9ecbff });
      l3.x = 20; l3.y = 88;
      hud.addChild(l3);

      game.app.onTick(function () {
        chunkRenderer.update(camX, camY, W, H);
        l1.text = '常驻 chunk: ' + world.loadedCount() + '   渲染容器: ' + chunkRenderer.builtCount();
        l2.text = '累计 加载 ' + loads + ' / 卸载 ' + unloads + '   世界坐标 (' +
          Math.round(camX / TILE) + ', ' + Math.round(camY / TILE) + ')';
      });

      game.app.start();
      return {
        game: game,
        destroy: function () { chunkRenderer.destroy(); }
      };
    }
  });

  /* ============ EntityManager ============ */
  Showcase.register({
    id: 'fw-entities',
    group: 'fw',
    title: 'EntityManager 实体插值',
    menuNote: 'spawn/despawn · syncTo 多人平滑（3.0 P2）',
    subtitle: '非 ECS 的轻量实体注册表；syncTo(x, y, ms) 在服务器 tick 之间平滑插值 — 多人他船不再瞬移',
    width: 760, height: 480, designWidth: 1200,
    desc:
      '<ul><li>模拟服务器每 <b>800ms</b> 广播一次船位（左上角 tick 计数）：' +
      '<b>绿色船队</b>用 <code>syncTo(x, y, 800)</code> 平滑插值；<b>红色船队</b>直接落点 — 肉眼可见的瞬移对比</li>' +
      '<li>「增援 / 撤离」按钮验证 spawn/despawn（传 layer 时 sprite 自动上/下树）</li>' +
      '<li>实体可挂自定义 <code>update(dt, ent)</code>（船头摇摆就是它做的）</li></ul>',
    code:
      "const em = framework.EntityManager.create({ layer: worldLayer })\n" +
      "\n" +
      "const ship = em.spawn('ship-1', {\n" +
      "  sprite: shipSprite, x: 100, y: 100,\n" +
      "  update(dt, ent) { ent.sprite.rotation = Math.sin(t) * 0.1 }\n" +
      "})\n" +
      "\n" +
      "// 服务器 tick 到达：\n" +
      "onServerTick(pos => ship.syncTo(pos.x, pos.y, 800))   // 800ms 内插值到位\n" +
      "\n" +
      "em.despawn('ship-1')\n" +
      "game.app.onTick(dt => em.update(dt))",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x0E2C4A });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var fw = env.framework;
      var W = game.W, H = game.H;

      var layer = new PIXI.Container();
      game.stage.addChild(layer);
      var em = fw.EntityManager.create({ layer: layer });
      var rng = fw.Rng.create(42);
      var nextId = 0;
      var tick = 0;

      function randomPos() {
        return { x: 100 + rng.next() * (W - 200), y: 140 + rng.next() * (H - 240) };
      }

      function addShip(smooth) {
        var id = 'ship-' + (nextId++);
        var sp = new PIXI.Sprite(game.tc.panel(40, 40, smooth ? 0x4fc08d : 0xE05B4B, 1, 9));
        sp.anchor && sp.anchor.set(0.5);
        var p = randomPos();
        var phase = rng.next() * Math.PI * 2;
        em.spawn(id, {
          sprite: sp, x: p.x, y: p.y,
          smooth: smooth,
          update: function (dt, ent) {
            ent.sprite.rotation = Math.sin(Date.now() / 350 + phase) * 0.12;
          }
        });
        return id;
      }

      for (var i = 0; i < 8; i++) { addShip(true); }
      for (var j = 0; j < 8; j++) { addShip(false); }

      // 模拟服务器 tick
      game.app.timer.every(800, function () {
        tick++;
        em.each(function (ent) {
          var p = randomPos();
          if (ent.smooth) {
            ent.syncTo(p.x, p.y, 800);     // 插值
          } else {
            ent.syncTo(p.x, p.y, 0);       // 直接落点（对比组）
          }
        });
      });
      game.app.onTick(function (dt) { em.update(dt); });

      var hud = ui.panel(620, 96, { skin: { bg: { color: 0x000000, alpha: 0.55, radius: 12 } } });
      hud.x = 20; hud.y = 20;
      game.stage.addChild(hud);
      var l1 = ui.label('', { size: 24, bold: true });
      l1.x = 20; l1.y = 12;
      hud.addChild(l1);
      var l2 = ui.label('绿 = syncTo 800ms 插值   红 = 直接落点（瞬移）', { size: 22, color: 0x8b94a8 });
      l2.x = 20; l2.y = 52;
      hud.addChild(l2);

      game.app.onTick(function () {
        l1.text = '服务器 tick #' + tick + '   实体数 ' + em.count();
      });

      env.button('增援 +4 艘（绿）', function () {
        for (var k = 0; k < 4; k++) { addShip(true); }
      });
      env.button('全部撤离', function () {
        var ids = [];
        em.each(function (e) { ids.push(e.id); });
        ids.forEach(function (id) { em.despawn(id); });
        game.toast.show('已 despawn ' + ids.length + ' 个实体');
      });

      game.app.start();
      return { game: game };
    }
  });

  /* ============ PinchPan 手势 ============ */
  Showcase.register({
    id: 'fw-pinchpan',
    group: 'fw',
    title: 'PinchPan 手势插件',
    menuNote: '平移 · 双指缩放 · 点击 · 长按（3.0 P2）',
    subtitle: '收编 CnC2 RTS 手势：单指平移 / 双指捏合缩放 / tap / 长按，插件式不进 core',
    width: 760, height: 480, designWidth: 1200,
    desc:
      '<ul><li><b>拖动</b>：onPan 平移世界</li>' +
      '<li><b>滚轮</b>：本站把滚轮合成为双指捏合事件序列喂给适配层 — 走的是真实 onPinch 路径（0.5x ~ 2.5x）</li>' +
      '<li><b>单击</b>：onTap 落旗标记；<b>按住 550ms</b>：onLongPress 弹提示</li>' +
      '<li>移动超过 tapPx(12px) 自动取消 tap/长按判定</li></ul>',
    code:
      "const pp = framework.PinchPan.create(stage, {\n" +
      "  onPan: (dx, dy) => { world.x += dx; world.y += dy },\n" +
      "  onPinch: (factor, cx, cy) => zoomAround(factor, cx, cy),\n" +
      "  onTap: (x, y) => placeFlag(x, y),\n" +
      "  onLongPress: (x, y) => showMenu(x, y)\n" +
      "})\n" +
      "pp.destroy()   // 场景退出时摘除监听",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x0E2C4A });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var fw = env.framework;
      var W = game.W, H = game.H;

      var world = new PIXI.Container();
      game.stage.addChild(world);

      // 网格 + 参照物
      var g = new PIXI.Graphics();
      g.lineStyle(1, 0x1b4a75, 0.7);
      for (var x = -1200; x <= 2400; x += 80) { g.moveTo(x, -800); g.lineTo(x, 1600); }
      for (var y = -800; y <= 1600; y += 80) { g.moveTo(-1200, y); g.lineTo(2400, y); }
      world.addChild(g);
      var texs = makeTileTextures(game);
      [[200, 200, texs.grass], [700, 420, texs.sand], [1100, 160, texs.rock], [400, 700, texs.forest]].forEach(function (item) {
        var s = new PIXI.Sprite(item[2]);
        s.x = item[0]; s.y = item[1];
        s.width = 120; s.height = 120;
        world.addChild(s);
      });

      var status = ui.label('拖动=平移  滚轮=捏合缩放  单击=落旗  长按=菜单', { size: 24, color: 0x9ecbff });
      status.x = 20; status.y = 20;
      game.stage.addChild(status);
      var zoomLabel = ui.label('zoom 1.00x', { size: 24, bold: true, color: 0xFFD166 });
      zoomLabel.x = 20; zoomLabel.y = 60;
      game.stage.addChild(zoomLabel);

      function zoomAround(factor, cx, cy) {
        var next = Math.max(0.5, Math.min(2.5, world.scale.x * factor));
        var applied = next / world.scale.x;
        world.x = cx - (cx - world.x) * applied;
        world.y = cy - (cy - world.y) * applied;
        world.scale.set(next);
        zoomLabel.text = 'zoom ' + next.toFixed(2) + 'x';
      }

      fw.PinchPan.create(game.stage, {
        onPan: function (dx, dy) {
          world.x += dx;
          world.y += dy;
          status.text = 'onPan  dx=' + Math.round(dx) + ' dy=' + Math.round(dy);
        },
        onPinch: function (factor, cx, cy) {
          zoomAround(factor, cx, cy);
          status.text = 'onPinch  factor=' + factor.toFixed(3);
        },
        onTap: function (x, y) {
          status.text = 'onTap  (' + Math.round(x) + ', ' + Math.round(y) + ')';
          var local = world.toLocal(new PIXI.Point(x, y));
          var flag = new PIXI.Graphics();
          flag.beginFill(0xE05B4B);
          flag.moveTo(0, 0); flag.lineTo(0, -46); flag.lineTo(34, -36); flag.lineTo(0, -26);
          flag.endFill();
          flag.x = local.x; flag.y = local.y;
          world.addChild(flag);
        },
        onLongPress: function (x, y) {
          status.text = 'onLongPress  (' + Math.round(x) + ', ' + Math.round(y) + ')';
          game.toast.show('长按触发！');
        }
      });

      // 滚轮 → 双指捏合合成（canvas 像素坐标，dispatchEvent 内部会换算设计坐标）
      env.onWheel(function (e, cx, cy) {
        env.simulatePinch(cx, cy, e.deltaY < 0 ? 1.12 : 0.9);
      });

      game.app.start();
      return { game: game };
    }
  });
})();
