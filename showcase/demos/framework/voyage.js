/**
 * 综合大场景 — 航海世界
 * 世界层全家桶组合：ChunkWorld + ChunkRenderer + Camera + EntityManager +
 * SpriteAnimator(addStrip) + FxLayer + Particle + CooldownButton + AudioManager + Store
 */
(function () {
  'use strict';

  Showcase.register({
    id: 'fw-voyage',
    group: 'fw',
    title: '综合场景：航海世界',
    menuNote: '世界层全家桶 · 可玩大地图',
    subtitle: 'ChunkWorld 无限海域 + Camera 跟随 + EntityManager NPC 船 + SpriteAnimator 航向帧 + FxLayer 战斗 + 炮击 CD 技能',
    width: 860, height: 540, designWidth: 1400,
    desc:
      '<p>这是把 3.0 世界表现层模块组合成真实游戏场景的还原（大航海 2.0 的技术底座）：</p>' +
      '<ul><li><b>点击海面</b>：舰船起航（SpriteAnimator 按航向切 4 方向帧），Camera 平滑跟随，尾迹粒子跟随船体</li>' +
      '<li><b>拖动画面</b>：镜头手动接管，2.5s 静置回跟；海域由 ChunkWorld 按视口无限生成/卸载（左上角 HUD）</li>' +
      '<li><b>靠近红色海盗船</b>点「炮击」（右下 CD 按钮，3s 冷却）：FxLayer 伤害飘字 + 碎块 + 圆环，击沉得金币（Store 持久化，刷新不丢）</li>' +
      '<li>海盗船 = EntityManager 实体，syncTo 插值巡航，被击沉后 despawn，10 秒后增援</li></ul>',
    code:
      "// 1. 无限海域\n" +
      "const world = framework.ChunkWorld.create(seedProvider, { chunkSize: 32 })\n" +
      "const terrain = framework.ChunkRenderer.create(PIXI, world, { tileSize: 24, textureFor })\n" +
      "\n" +
      "// 2. 相机跟船\n" +
      "const cam = framework.Camera.create(Infinity...)  // 演示里用大边界\n" +
      "game.app.onTick(dt => {\n" +
      "  if (!cam.isManual()) cam.focus(ship.x, ship.y)\n" +
      "  cam.update(dt, ship)\n" +
      "  const off = cam.getOffset()\n" +
      "  terrain.update(off.x, off.y, game.W, game.H)\n" +
      "  worldLayer.position.set(-off.x, -off.y)\n" +
      "})\n" +
      "\n" +
      "// 3. 航向帧动画 + NPC 插值 + 战斗反馈\n" +
      "game.animator(shipSprite).play(headingClip(dx, dy), { fps: 4 })\n" +
      "npc.syncTo(nextX, nextY, 1200)\n" +
      "fx.damageText(x, y, 260, null, crit); fx.burst(x, y, 0xE05B4B, 10)",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x0B2A47 });
      var PIXI = game.PIXI;
      var ui = game.ui;
      var fw = env.framework;
      var W = game.W, H = game.H;
      var TILE = 26;
      var MAP = 20000;              // 逻辑边界（够浪）

      /* ---------- 存档 ---------- */
      var store = fw.Store.create('voyage_save', { throttleMs: 800 });
      var saved = store.load();
      var gold = (saved && saved.data && saved.data.gold) || 0;

      /* ---------- 地形（群岛密度调到一屏可见 2~3 座岛） ---------- */
      function terrainAt(wx, wy) {
        function h(x, y) {
          var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
          return n - Math.floor(n);
        }
        var v = 0;
        v += Math.sin(wx * 0.1) * Math.cos(wy * 0.12) * 0.5;
        v += Math.sin(wx * 0.033 + 5) * Math.cos(wy * 0.029 + 2) * 0.9;
        v += h(Math.floor(wx / 3), Math.floor(wy / 3)) * 0.25;
        if (v > 1.05) { return 5; }
        if (v > 0.85) { return 4; }
        if (v > 0.62) { return 3; }
        if (v > 0.5) { return 2; }
        if (v > 0.3) { return 1; }
        return 0;
      }
      function isLand(wx, wy) { return terrainAt(wx, wy) >= 2; }

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
      var world = fw.ChunkWorld.create(provider, { chunkSize: 32, keepRing: 1 });
      var tc = game.tc;
      var tileTex = [null,
        tc.panel(32, 32, 0x11395f, 1, 0),
        tc.panel(32, 32, 0xC9B27C, 1, 0),
        tc.panel(32, 32, 0x3E7C4F, 1, 0),
        tc.panel(32, 32, 0x2C5E3A, 1, 0),
        tc.panel(32, 32, 0x6E6A62, 1, 0)];
      var terrain = fw.ChunkRenderer.create(PIXI, world, {
        tileSize: TILE,
        textureFor: function (t) { return tileTex[t] || null; },
        pad: 0
      });

      // 注意：ChunkRenderer.update 内部自带相机位移（container.x = -offX），
      // 因此地形直接挂 stage；船/特效层由我们手动跟随相机
      game.stage.addChild(terrain.container);

      var worldLayer = new PIXI.Container();
      game.stage.addChild(worldLayer);

      var shipLayer = new PIXI.Container();
      worldLayer.addChild(shipLayer);

      var fx = game.fxLayer({});
      worldLayer.addChild(fx.container);

      /* ---------- 音效（合成） ---------- */
      function toneURI(freqs, secs) {
        var rate = 22050, n = Math.floor(rate * secs);
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
          for (var f = 0; f < freqs.length; f++) { s += Math.sin(i / rate * freqs[f] * Math.PI * 2); }
          v.setInt16(44 + i * 2, s / freqs.length * 11000 * (1 - i / n), true);
        }
        var bytes = new Uint8Array(buf);
        var bin = '';
        for (var j = 0; j < bytes.length; j++) { bin += String.fromCharCode(bytes[j]); }
        return 'data:audio/wav;base64,' + btoa(bin);
      }
      game.audio.registerAll({
        cannon: toneURI([90, 55], 0.35),
        coin: toneURI([880, 1175], 0.2),
        sail: toneURI([392, 523], 0.18)
      });

      /* ---------- 相机 ---------- */
      var cam = fw.Camera.create(MAP, MAP, W, H, { idleReturnMs: 2500 });

      /* ---------- 玩家船 ---------- */
      // 出生点选在群岛海域（tile 340,310 附近首屏即见岛链）
      var startX = 340 * TILE, startY = 312 * TILE;
      while (isLand(Math.round(startX / TILE), Math.round(startY / TILE))) { startX += TILE * 3; }
      var ship = new PIXI.Sprite(tc.panel(44, 44, 0xFFFFFF, 1, 8));
      ship.anchor && ship.anchor.set(0.5);
      ship.x = startX; ship.y = startY;
      shipLayer.addChild(ship);
      cam.snapTo(ship.x, ship.y);

      var anim = null;
      var heading = '南';
      game.assets.addStrip('vship', 'assets/uw/worldShips.png', 32);
      game.assets.loadGroup(['vship'], function (ok) {
        if (!ok) { return; }
        function tex(n) {
          var t = game.assets.texture('vship_' + (n < 10 ? '0' + n : n));
          t.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
          return t;
        }
        anim = game.animator(ship);
        anim.add('北', [tex(9), tex(10)]);
        anim.add('东', [tex(11), tex(12)]);
        anim.add('南', [tex(13), tex(14)]);
        anim.add('西', [tex(15), tex(16)]);
        anim.play('南', { fps: 3 });
        ship.texture = tex(13);
        ship.width = 58; ship.height = 58;
      });

      function setHeading(dx, dy) {
        var dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '东' : '西') : (dy > 0 ? '南' : '北');
        if (dir !== heading && anim) {
          heading = dir;
          anim.play(dir, { fps: 5 });
          ship.width = 58; ship.height = 58;
        }
      }

      var sailTarget = null;
      var wake = game.particle({
        texture: tc.circle(6, 0xBFE3FF),
        rate: 26, life: 700, speed: 26, spread: 360,
        alphaFrom: 0.7, alphaTo: 0, scaleFrom: 1, scaleTo: 0.3
      });
      worldLayer.addChild(wake.container);

      /* ---------- 海盗（EntityManager） ---------- */
      var em = fw.EntityManager.create({ layer: shipLayer });
      var rng = fw.Rng.create(2024);
      var pirateSeq = 0;

      function spawnPirate() {
        var id = 'pirate-' + (pirateSeq++);
        var a = rng.next() * Math.PI * 2;
        var d = 260 + rng.next() * 400;   // 首屏可见（视口半宽 700）
        var px = ship.x + Math.cos(a) * d;
        var py = ship.y + Math.sin(a) * d;
        var sp = new PIXI.Sprite(tc.panel(40, 40, 0xE05B4B, 1, 8));
        sp.anchor && sp.anchor.set(0.5);
        var ent = em.spawn(id, {
          sprite: sp, x: px, y: py, hp: 100,
          update: function (dt, e) {
            e.sprite.rotation = Math.sin(Date.now() / 320 + d) * 0.1;
          }
        });
        ent.isPirate = true;
        return ent;
      }
      for (var p = 0; p < 5; p++) { spawnPirate(); }

      // 海盗巡航：每 1.2s 服务器 tick，位置插值
      game.app.timer.every(1200, function () {
        em.each(function (ent) {
          if (!ent.isPirate) { return; }
          var a = rng.next() * Math.PI * 2;
          ent.syncTo(ent.x + Math.cos(a) * 120, ent.y + Math.sin(a) * 120, 1200);
        });
      });

      /* ---------- 交互 ---------- */
      var dragging = false, dragMoved = 0, lastX = 0, lastY = 0;
      game.stage.on('pointerdown', function (e) {
        dragging = true;
        dragMoved = 0;
        lastX = e.data.global.x; lastY = e.data.global.y;
      });
      game.stage.on('pointermove', function (e) {
        if (!dragging) { return; }
        var g = e.data.global;
        dragMoved += Math.abs(g.x - lastX) + Math.abs(g.y - lastY);
        if (dragMoved > 12) {
          cam.dragBy(g.x - lastX, g.y - lastY);
        }
        lastX = g.x; lastY = g.y;
      });
      function release(e) {
        if (!dragging) { return; }
        dragging = false;
        if (dragMoved <= 12) {
          var off = cam.getOffset();
          var g = e.data.global;
          sailTarget = { x: g.x + off.x, y: g.y + off.y };
          game.audio.playSfx('sail');
          fx.ring(sailTarget.x, sailTarget.y, 40, 0xBFE3FF);
        }
      }
      game.stage.on('pointerup', release);
      game.stage.on('pointerupoutside', release);

      /* ---------- HUD ---------- */
      var hud = ui.panel(560, 128, { skin: { bg: { color: 0x000000, alpha: 0.55, radius: 12 } } });
      hud.x = 20; hud.y = 20;
      game.stage.addChild(hud);
      var hudGold = ui.label('', { size: 28, bold: true, color: 0xFFD166 });
      hudGold.x = 20; hudGold.y = 14;
      hud.addChild(hudGold);
      var hudInfo = ui.label('', { size: 22, color: 0x8b94a8 });
      hudInfo.x = 20; hudInfo.y = 56;
      hud.addChild(hudInfo);
      var hudTip = ui.label('点海面 = 起航   拖动 = 看地图   靠近海盗按「炮击」', { size: 22, color: 0x9ecbff });
      hudTip.x = 20; hudTip.y = 90;
      hud.addChild(hudTip);

      function saveGold() {
        store.save({ v: 1, data: { gold: gold } });
      }

      /* ---------- 炮击技能 ---------- */
      var CD = 3000;
      var cdLeft = 0;
      var cannonBtn = ui.cooldownButton({
        radius: 78,
        skin: { bg: { color: 0x25304a } },
        onTap: function () {
          if (cdLeft > 0) {
            game.toast.show('装填中…');
            return;
          }
          cdLeft = CD;
          game.audio.playSfx('cannon');
          fx.ring(ship.x, ship.y, 240, 0xF2914E);
          var hits = 0;
          em.each(function (ent) {
            if (!ent.isPirate || ent.dead) { return; }
            var dx = ent.x - ship.x, dy = ent.y - ship.y;
            if (dx * dx + dy * dy < 240 * 240) {
              hits++;
              var crit = Math.random() < 0.25;
              var dmg = crit ? 100 : (40 + Math.floor(Math.random() * 40));
              ent.hp -= dmg;
              fx.damageText(ent.x, ent.y, dmg, null, crit);
              if (ent.hp <= 0) {
                ent.dead = true;
                fx.burst(ent.x, ent.y, 0xE05B4B, 12);
                var loot = 80 + Math.floor(Math.random() * 120);
                fx.coinText(ent.x, ent.y - 20, loot);
                gold += loot;
                saveGold();
                game.audio.playSfx('coin');
                var id = ent.id;
                game.app.timer.after(400, function () { em.despawn(id); });
                game.app.timer.after(10000, function () {
                  spawnPirate();
                  game.toast.show('海盗增援出现！');
                });
              }
            }
          });
          if (!hits) { fx.label(ship.x, ship.y - 60, '射程内无目标', 0x8b94a8); }
        }
      });
      var icon = new PIXI.Sprite(tc.circle(36, 0xE05B4B));
      icon.x = -36; icon.y = -36;
      cannonBtn.addChildAt(icon, 1);
      cannonBtn.x = W - 130;
      cannonBtn.y = H - 130;
      game.stage.addChild(cannonBtn);
      var cLabel = ui.label('炮击', { size: 24, color: 0x8b94a8 });
      cLabel.x = W - 156; cLabel.y = H - 40;
      game.stage.addChild(cLabel);

      /* ---------- 主循环 ---------- */
      game.app.onTick(function (dt) {
        // 航行
        if (sailTarget) {
          var dx = sailTarget.x - ship.x, dy = sailTarget.y - ship.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 8) {
            sailTarget = null;
            wake.stop();
          } else {
            var step = 190 * dt / 1000;
            var nx = ship.x + dx / dist * step;
            var ny = ship.y + dy / dist * step;
            // 撞岛检测：陆地不可行
            if (isLand(Math.round(nx / TILE), Math.round(ny / TILE))) {
              sailTarget = null;
              wake.stop();
              fx.label(ship.x, ship.y - 50, '前方陆地！', 0xE8A33A);
            } else {
              ship.x = nx; ship.y = ny;
              setHeading(dx, dy);
              if (!wake.running()) { wake.start(); }
              wake.setPos(ship.x, ship.y + 16);
            }
          }
        }

        em.update(dt);

        if (!cam.isManual()) { cam.focus(ship.x, ship.y); }
        cam.update(dt, { x: ship.x, y: ship.y });
        var off = cam.getOffset();
        terrain.update(off.x, off.y, W, H);
        worldLayer.x = -off.x;
        worldLayer.y = -off.y;

        // CD 推进
        if (cdLeft > 0) {
          cdLeft = Math.max(0, cdLeft - dt);
          cannonBtn.setCooldown(cdLeft / CD, Math.ceil(cdLeft / 1000));
          cannonBtn.setActive(false);
        } else {
          cannonBtn.setCooldown(0);
          // 射程内有海盗 → 高亮就绪
          var inRange = false;
          em.each(function (ent) {
            if (!ent.isPirate || ent.dead) { return; }
            var dx2 = ent.x - ship.x, dy2 = ent.y - ship.y;
            if (dx2 * dx2 + dy2 * dy2 < 240 * 240) { inRange = true; }
          });
          cannonBtn.setActive(inRange);
        }

        hudGold.text = '金币 ' + gold + '（Store 持久化）';
        hudInfo.text = '海盗 ' + em.count() + ' 艘   常驻 chunk ' + world.loadedCount() +
          '   坐标 (' + Math.round(ship.x / TILE) + ', ' + Math.round(ship.y / TILE) + ')' +
          (cam.isManual() ? '   [镜头手动]' : '');
      });

      game.app.start();
      return {
        game: game,
        destroy: function () { terrain.destroy(); }
      };
    }
  });
})();
