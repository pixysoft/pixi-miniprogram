/**
 * framework 演示 — 容器组件：ScrollView / List 虚拟化 / TabBar+PageView / CooldownButton
 */
(function () {
  'use strict';

  /* ============ ScrollView ============ */
  Showcase.register({
    id: 'fw-scrollview',
    group: 'fw',
    title: 'ScrollView 滚动容器',
    menuNote: '惯性 · 回弹 · 磁吸（3.0 轴向化）',
    subtitle: '手感参数移植 cocos/egret：速度加权采样惯性 + 越界阻尼 0.5 + 300ms 回弹；3.0 增加水平轴向与 snapInterval 磁吸',
    desc:
      '<ul><li><b>上半</b>：垂直 ScrollView — 拖动列表体验惯性滚动与顶底回弹；' +
      '按住色块再滑动，位移超 10px 自动取消子控件点击（拦截接管）</li>' +
      '<li><b>下半</b>：水平 ScrollView + <code>snapInterval</code> — 松手自动吸附到整卡位（卡片轮播手感），释放速度超阈值翻向下一卡</li></ul>',
    code:
      "// 垂直 + 惯性回弹\n" +
      "const sv = ui.scrollView({ w: 640, h: 420 })\n" +
      "sv.content.addChild(longContent)\n" +
      "sv.setContentHeight(2000)\n" +
      "\n" +
      "// 水平 + 磁吸（3.0）\n" +
      "const snap = ui.scrollView({\n" +
      "  w: 640, h: 240, direction: 'x',\n" +
      "  snapInterval: 320,\n" +
      "  onSnap: idx => console.log('吸附到', idx)\n" +
      "})\n" +
      "snap.setContentWidth(320 * 8)",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x14171F });
      var ui = game.ui;
      var PIXI = game.PIXI;
      var W = game.W;

      var t1 = ui.label('垂直：惯性 + 回弹 + 点击拦截', { size: 28, bold: true });
      t1.x = 40; t1.y = 30;
      game.stage.addChild(t1);

      var sv = ui.scrollView({ w: W - 80, h: 430 });
      sv.x = 40; sv.y = 80;
      game.stage.addChild(sv);

      var colors = [0xE05B4B, 0xE8A33A, 0x4fc08d, 0x4f8cff, 0xC9A8FF, 0x6fd3ff];
      var rowH = 110;
      for (var i = 0; i < 18; i++) {
        (function (idx) {
          var row = ui.panel(W - 80 - 16, 96);
          row.y = idx * rowH;
          var chip = new PIXI.Sprite(game.tc.panel(64, 64, colors[idx % colors.length], 1, 14));
          chip.x = 18; chip.y = 16;
          chip.eventMode = 'static';
          var Widget = env.framework.Widget;
          Widget.makePressable(chip, {
            onTap: function () { game.toast.show('点中第 ' + (idx + 1) + ' 行色块'); }
          });
          row.addChild(chip);
          var lbl = ui.label('第 ' + (idx + 1) + ' 行 — 按住我再滑动试试拦截', { size: 26 });
          lbl.x = 104; lbl.y = 32;
          row.addChild(lbl);
          sv.content.addChild(row);
        })(i);
      }
      sv.setContentHeight(18 * rowH);

      var t2 = ui.label('水平：snapInterval 磁吸翻卡', { size: 28, bold: true });
      t2.x = 40; t2.y = 550;
      game.stage.addChild(t2);

      var CARD = 300;
      var snapInfo = ui.label('当前卡片：1 / 8', { size: 24, color: 0x8b94a8 });
      snapInfo.x = 470; snapInfo.y = 554;
      game.stage.addChild(snapInfo);

      var snap = ui.scrollView({
        w: W - 80, h: 300, direction: 'x',
        snapInterval: CARD,
        onSnap: function (idx) { snapInfo.text = '当前卡片：' + (idx + 1) + ' / 8'; }
      });
      snap.x = 40; snap.y = 600;
      game.stage.addChild(snap);
      for (var c = 0; c < 8; c++) {
        var card = ui.panel(CARD - 20, 270, { skin: { bg: { color: 0x1a2030, radius: 18 } } });
        card.x = c * CARD;
        card.y = 10;
        var big = ui.label(String(c + 1), { size: 110, bold: true, color: colors[c % colors.length] });
        big.x = 100; big.y = 60;
        card.addChild(big);
        snap.content.addChild(card);
      }
      snap.setContentWidth(8 * CARD);

      game.app.start();
      return { game: game };
    }
  });

  /* ============ List 虚拟化 ============ */
  Showcase.register({
    id: 'fw-list',
    group: 'fw',
    title: 'List 虚拟化列表',
    menuNote: '1000 行 · 只建可视实例',
    subtitle: 'EUI DataGroup 思路：等高 item + 复用池，「可视区 + 2」个实例滚 1000 条数据',
    desc:
      '<p>滚动时 item 实例被重定位 + 重绑定（<code>updateItem(item, index, data)</code>），' +
      '实例数恒定 — 顶部计数展示实例池大小 vs 数据量。手感继承 ScrollView（惯性/回弹）。</p>',
    code:
      "const list = ui.list({\n" +
      "  w: 640, h: 720, itemHeight: 96, gap: 8,\n" +
      "  createItem() {                       // 只会被调用「可视区+2」次\n" +
      "    const row = ui.panel(640, 96)\n" +
      "    row.label = ui.label('', { size: 26 })\n" +
      "    row.addChild(row.label)\n" +
      "    return row\n" +
      "  },\n" +
      "  updateItem(row, idx, data) {         // 滚动时重绑定\n" +
      "    row.label.text = idx + ' — ' + data\n" +
      "  }\n" +
      "})\n" +
      "list.setData(bigArray)   // 1000 条",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x14171F });
      var ui = game.ui;
      var W = game.W;
      var created = 0;

      var info = ui.label('', { size: 26, color: 0x4fc08d });
      info.x = 40; info.y = 36;
      game.stage.addChild(info);

      var GOODS = ['胡椒', '丝绸', '瓷器', '琥珀', '火枪', '朗姆酒', '橄榄油', '玻璃珠'];
      var list = ui.list({
        w: W - 80, h: 860, itemHeight: 96, gap: 8,
        createItem: function () {
          created++;
          var row = ui.panel(W - 80, 96);
          row.chip = new game.PIXI.Sprite(game.tc.circle(20, 0x4f8cff));
          row.chip.x = 22; row.chip.y = 28;
          row.addChild(row.chip);
          row.label = ui.label('', { size: 26 });
          row.label.x = 84; row.label.y = 20;
          row.addChild(row.label);
          row.sub = ui.label('', { size: 20, color: 0x8b94a8 });
          row.sub.x = 84; row.sub.y = 56;
          row.addChild(row.sub);
          return row;
        },
        updateItem: function (row, idx, data) {
          row.label.text = '#' + (idx + 1) + '  ' + data.name + '  ×' + data.qty;
          row.sub.text = '单价 ' + data.price + ' 金 · 虚拟化重绑定';
          row.chip.tint = data.color;
        }
      });
      list.x = 40; list.y = 90;
      game.stage.addChild(list);

      var colors = [0xE05B4B, 0xE8A33A, 0x4fc08d, 0x4f8cff, 0xC9A8FF];
      var data = [];
      for (var i = 0; i < 1000; i++) {
        data.push({
          name: GOODS[i % GOODS.length],
          qty: 1 + (i * 7) % 99,
          price: 10 + (i * 13) % 490,
          color: colors[i % colors.length]
        });
      }
      list.setData(data);
      info.text = '数据 ' + data.length + ' 条，实例仅 ' + created + ' 个（可视区 + 2）';

      game.app.start();
      return { game: game };
    }
  });

  /* ============ TabBar + PageView ============ */
  Showcase.register({
    id: 'fw-tab-pageview',
    group: 'fw',
    title: 'TabBar + PageView',
    menuNote: '标签切页 · 磁吸翻页（3.0 P2）',
    subtitle: 'TabBar 选中态切换不重建；PageView = 水平 ScrollView + 页宽磁吸，双向联动',
    desc:
      '<ul><li>点 Tab 或左右拖拽页面，两者状态互相同步（<code>onSelect</code> ↔ <code>onPage</code>）</li>' +
      '<li>TabBar 皮肤键 <code>TabBar: { bg, item, active }</code>，选中态换帧/换色不重建按钮</li>' +
      '<li>PageView 释放速度超 0.3px/ms 即翻页，与 cocos PageView 手感一致</li></ul>',
    code:
      "const pv = ui.pageView({\n" +
      "  w: 640, h: 700,\n" +
      "  onPage: idx => tab.select(keys[idx])\n" +
      "})\n" +
      "pages.forEach(p => pv.addPage(p))\n" +
      "\n" +
      "const tab = ui.tabBar({\n" +
      "  items: [{ key: 'port', label: '港口' }, { key: 'sea', label: '航海' }, ...],\n" +
      "  w: 640, h: 110,\n" +
      "  onSelect: key => pv.goTo(keys.indexOf(key), true)\n" +
      "})",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x14171F });
      var ui = game.ui;
      var W = game.W;
      var PAGES = [
        { key: 'port', label: '港口', color: 0x2b4a6f, icon: 0xE8A33A, text: '酒馆 · 造船厂 · 交易所' },
        { key: 'sea', label: '航海', color: 0x10314f, icon: 0x6fd3ff, text: '扬帆起航，探索新大陆' },
        { key: 'battle', label: '海战', color: 0x4a2330, icon: 0xE05B4B, text: '炮击 · 接舷 · 撞角' },
        { key: 'guild', label: '商会', color: 0x233c2c, icon: 0x4fc08d, text: '委托任务与声望' }
      ];
      var keys = PAGES.map(function (p) { return p.key; });
      var tab = null;

      var pv = ui.pageView({
        w: W - 80, h: 640,
        onPage: function (idx) { if (tab) { tab.select(keys[idx]); } }
      });
      pv.x = 40; pv.y = 60;
      game.stage.addChild(pv);

      PAGES.forEach(function (p, i) {
        var page = new game.PIXI.Container();
        var bg = new game.PIXI.Sprite(game.tc.panel(W - 100, 620, p.color, 1, 20));
        bg.x = 0; bg.y = 10;
        page.addChild(bg);
        var chip = new game.PIXI.Sprite(game.tc.circle(60, p.icon));
        chip.x = (W - 100) / 2 - 60; chip.y = 130;
        page.addChild(chip);
        var big = ui.label(p.label, { size: 64, bold: true });
        big.x = (W - 100 - big.width) / 2; big.y = 300;
        page.addChild(big);
        var sub = ui.label(p.text + '（第 ' + (i + 1) + ' 页，左右拖拽翻页）', { size: 26, color: 0xBBc6da });
        sub.x = (W - 100 - sub.width) / 2; sub.y = 400;
        page.addChild(sub);
        pv.addPage(page);
      });

      tab = ui.tabBar({
        items: PAGES.map(function (p) { return { key: p.key, label: p.label }; }),
        w: W - 80, h: 116,
        onSelect: function (key) { pv.goTo(keys.indexOf(key), true); }
      });
      tab.x = 40; tab.y = 740;
      game.stage.addChild(tab);
      tab.select('port');

      game.app.start();
      return { game: game };
    }
  });

  /* ============ CooldownButton ============ */
  Showcase.register({
    id: 'fw-cooldown',
    group: 'fw',
    title: 'CooldownButton 技能按钮',
    menuNote: '径向 CD 遮罩 · 就绪高亮（3.0 P1）',
    subtitle: '收编 KR2 skillButton：扇形遮罩表现冷却进度，秒数倒计时，外圈 active 高亮',
    desc:
      '<ul><li>点击技能进入冷却：径向扇形遮罩从满盘转空，中心显示剩余秒数</li>' +
      '<li>冷却完毕 <code>setActive(true)</code> 外圈高亮提示就绪</li>' +
      '<li>三个技能 CD 时长不同（3s / 5s / 8s），互不影响</li></ul>',
    code:
      "const skill = ui.cooldownButton({\n" +
      "  radius: 70,\n" +
      "  onTap: () => {\n" +
      "    if (skill.getCooldown() > 0) return    // 还在 CD\n" +
      "    cast()\n" +
      "    startCooldown(skill, 5000)\n" +
      "  }\n" +
      "})\n" +
      "\n" +
      "// 每帧推进：\n" +
      "skill.setCooldown(leftMs / totalMs, Math.ceil(leftMs / 1000))\n" +
      "skill.setActive(leftMs <= 0)",
    run: function (env) {
      var game = env.lib.createGame(env.canvas, { designWidth: env.designWidth, background: 0x1B2030 });
      var ui = game.ui;
      var fw = env.framework;
      var W = game.W;

      var title = ui.label('点击技能释放（径向 CD）', { size: 34, bold: true });
      title.x = 40; title.y = 50;
      game.stage.addChild(title);

      var castLabel = ui.label('', { size: 30, color: 0xFFD166 });
      castLabel.x = 40; castLabel.y = 130;
      game.stage.addChild(castLabel);

      // 目标靶子：释放技能时飘伤害
      var fxl = game.fxLayer({});
      game.stage.addChild(fxl.container);
      var target = new game.PIXI.Sprite(game.tc.circle(70, 0x4a2330));
      target.x = W / 2 - 70; target.y = 260;
      game.stage.addChild(target);
      var tLabel = ui.label('训练假人', { size: 24, color: 0x8b94a8 });
      tLabel.x = W / 2 - 54; tLabel.y = 420;
      game.stage.addChild(tLabel);

      var skills = [
        { name: '火球', cd: 3000, color: 0xE05B4B, dmg: 120 },
        { name: '冰锥', cd: 5000, color: 0x6fd3ff, dmg: 260 },
        { name: '陨石', cd: 8000, color: 0xE8A33A, dmg: 540 }
      ];
      var states = [];

      skills.forEach(function (s, i) {
        var btn = ui.cooldownButton({
          radius: 74,
          skin: { bg: { color: 0x25304a } },
          onTap: function () {
            var st = states[i];
            if (st.left > 0) {
              game.toast.show(s.name + ' 冷却中');
              return;
            }
            st.left = s.cd;
            castLabel.text = '释放「' + s.name + '」！';
            fxl.damageText(W / 2, 320, s.dmg, null, s.dmg > 300);
            fxl.ring(W / 2, 330, 90, s.color);
            fxl.burst(W / 2, 330, s.color, 8);
          }
        });
        btn.x = 140 + i * 240;
        btn.y = 620;
        game.stage.addChild(btn);

        var icon = new game.PIXI.Sprite(game.tc.circle(34, s.color));
        icon.x = -34; icon.y = -34;
        btn.addChildAt(icon, 1);

        var name = ui.label(s.name + ' ' + (s.cd / 1000) + 's', { size: 24, color: 0x8b94a8 });
        name.x = 140 + i * 240 - name.width / 2;
        name.y = 720;
        game.stage.addChild(name);

        states.push({ btn: btn, left: 0, total: s.cd });
      });

      game.app.onTick(function (dt) {
        states.forEach(function (st) {
          if (st.left > 0) {
            st.left = Math.max(0, st.left - dt);
            st.btn.setCooldown(st.left / st.total, Math.ceil(st.left / 1000));
            st.btn.setActive(false);
          } else {
            st.btn.setCooldown(0);
            st.btn.setActive(true);
          }
        });
      });

      game.app.start();
      return { game: game };
    }
  });
})();
