/**
 * main — 演示站主壳：左侧菜单 / 右侧演示区 + 概述页 + hash 路由
 */
(function () {
  'use strict';

  var demos = [];
  var demosById = {};

  window.Showcase = {
    register: function (demo) {
      demos.push(demo);
      demosById[demo.id] = demo;
    }
  };

  var GROUPS = [
    { key: 'core', label: '原始框架功能', tag: 'Pixi 适配层', tagClass: 'core' },
    { key: 'fw', label: '新增游戏框架', tag: 'framework 3.0', tagClass: 'fw' }
  ];

  var current = null;   // { demo, env, handle }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (html !== undefined) { e.innerHTML = html; }
    return e;
  }

  /* ---------- 菜单 ---------- */
  function buildMenu() {
    var menu = document.getElementById('menu');
    GROUPS.forEach(function (g) {
      var title = el('div', 'group-title',
        g.label + ' <span class="tag ' + g.tagClass + '">' + g.tag + '</span>');
      menu.appendChild(title);
      demos.filter(function (d) { return d.group === g.key; }).forEach(function (d) {
        var btn = el('button', 'item');
        btn.innerHTML = d.title + (d.menuNote ? '<small>' + d.menuNote + '</small>' : '');
        btn.dataset.demo = d.id;
        btn.addEventListener('click', function () {
          location.hash = '#' + d.id;
        });
        menu.appendChild(btn);
      });
    });
  }

  function markActive(id) {
    var items = document.querySelectorAll('#menu .item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].dataset.demo === id);
    }
  }

  /* ---------- 演示装载 ---------- */
  function teardown() {
    if (current && current.env) {
      current.env._cleanup(current.handle);
    }
    current = null;
  }

  function showDemo(demo) {
    teardown();
    markActive(demo.id);
    var content = document.getElementById('content');
    content.innerHTML = '';
    content.scrollTop = 0;

    content.appendChild(el('h2', 'demo-title', demo.title));
    if (demo.subtitle) { content.appendChild(el('div', 'demo-subtitle', demo.subtitle)); }

    var toolbar = el('div', '');
    toolbar.id = 'toolbar';
    content.appendChild(toolbar);

    var stage = el('div', '');
    stage.id = 'stage';
    content.appendChild(stage);

    content.appendChild(el('div', 'section-label', '使用说明'));
    var doc = el('div', '');
    doc.id = 'doc';
    doc.innerHTML = demo.desc || '';
    content.appendChild(doc);

    content.appendChild(el('div', 'section-label', '代码片段'));
    var codeBox = el('div', '');
    codeBox.id = 'code';
    var pre = document.createElement('pre');
    pre.textContent = (demo.code || '').trim();
    codeBox.appendChild(pre);
    content.appendChild(codeBox);

    var env = ShowcaseHarness.createEnv(
      { stage: stage, toolbar: toolbar },
      { width: demo.width, height: demo.height, mode: demo.mode || 'game', designWidth: demo.designWidth }
    );
    current = { demo: demo, env: env, handle: null };

    Promise.resolve()
      .then(function () { return demo.run(env); })
      .then(function (handle) {
        if (current && current.env === env) {
          current.handle = handle || null;
          if (handle && handle.game && handle.game.dispatchTouch) {
            env.setDispatcher(handle.game.dispatchTouch);
          }
        } else if (handle) {
          env._cleanup(handle);   // 装载期间已被切走
        }
      })
      .catch(function (err) {
        console.error('[showcase] demo failed', err);
        var box = el('div', 'error-box',
          '<b>演示初始化失败</b><br>' + String(err && err.message || err) +
          '<br><span style="color:var(--text-dim)">请查看浏览器控制台了解详情；单个演示失败不影响其他演示。</span>');
        stage.appendChild(box);
      });
  }

  /* ---------- 概述页 ---------- */
  function showOverview() {
    teardown();
    markActive(null);
    var content = document.getElementById('content');
    var coreCount = demos.filter(function (d) { return d.group === 'core'; }).length;
    var fwCount = demos.filter(function (d) { return d.group === 'fw'; }).length;
    content.innerHTML =
      '<div class="overview">' +
      '<h2>pixi-miniprogram <em style="color:var(--accent);font-style:normal">Showcase</em></h2>' +
      '<p class="lead">pixi.js 微信小程序 WebGL 适配版 + framework 游戏框架 3.0 — PC 端在线演示</p>' +

      '<div class="cards">' +

      '<div class="card"><h3><span class="dot" style="background:var(--orange)"></span>这是什么</h3><ul>' +
      '<li>本项目把 <b>pixi.js 7.3.2</b> 完整适配进微信小程序 WebGL 环境：伪 window / document、离屏 canvas、触摸系统、XHR/fetch、音频全部桥接</li>' +
      '<li>3.0 在适配层之上新增 <b>framework 游戏框架层</b>：主循环、场景栈、资源、皮肤化 UI、动作系统、世界表现层，60 项冒烟测试全绿</li>' +
      '<li>本演示站用一层 <b>wx polyfill</b> 让同一份产物（dist/pixi.miniprogram.js，零修改）直接跑在浏览器里</li>' +
      '</ul></div>' +

      '<div class="card"><h3><span class="dot" style="background:var(--orange)"></span>原始框架功能（' + coreCount + ' 项演示）</h3><ul>' +
      '<li><b>渲染</b>：Sprite / Graphics（离屏 2d 适配）/ Text / BitmapText</li>' +
      '<li><b>动画</b>：AnimatedSprite 序列帧、myTween 缓动库</li>' +
      '<li><b>特效</b>：自定义 Shader 遮罩滤镜</li>' +
      '<li><b>生态</b>：Spine 骨骼动画、pixi-animate、Live2D 注入模式</li>' +
      '<li><b>系统</b>：触摸事件桥接、音频适配、截图导出</li>' +
      '</ul></div>' +

      '<div class="card"><h3><span class="dot" style="background:var(--green)"></span>framework 2.0 — UI 工业化（部分）</h3><ul>' +
      '<li><b>app</b>：App 主循环（tick 优先级 / maxDt / Timer）、createGame 一步装配</li>' +
      '<li><b>ui</b>：Theme 皮肤主题、Button 三态、ScrollView 惯性回弹、List 虚拟化、Slider、Modal、Toast</li>' +
      '<li><b>action</b>：sequence / spawn / repeat / ease 组合式动作</li>' +
      '<li><b>scene</b>：SceneManager 场景栈、EventBus；<b>data</b>：Store / Gateway / Rng</li>' +
      '</ul></div>' +

      '<div class="card"><h3><span class="dot" style="background:var(--green)"></span>framework 3.0 — 世界表现层（' + fwCount + ' 项演示）</h3><ul>' +
      '<li><b>P0</b>：Camera 世界相机、SpriteAnimator + addStrip、AudioManager、transitions.fade、Layout 锚点</li>' +
      '<li><b>P1</b>：Particle 粒子、filters 预设、FxLayer 战斗飘字、CooldownButton、bezier/spline 曲线动作</li>' +
      '<li><b>P2</b>：ChunkWorld 分块世界、EntityManager、PinchPan 手势、TabBar + PageView</li>' +
      '<li><b>P3</b>：SpinePlayer 分包、richLabel、app.snapshot 截图</li>' +
      '</ul></div>' +

      '</div>' +

      '<div class="hint">👈 点击左侧菜单任意条目开始演示。每个演示页包含 <b>可交互的实时渲染</b>、<b>使用说明</b> 和 <b>代码片段</b>。' +
      '演示里的美术资源使用程序化方块 / 圆角面板，以及《大航海时代 2》像素占位图集（16px 瓦片 / 32px 船与角色帧）。' +
      '压轴演示 <b>「综合场景：航海世界」</b> 将世界层全家桶组合成一个可玩的大地图场景。</div>' +
      '</div>';
  }

  /* ---------- 路由 ---------- */
  function route() {
    var id = location.hash.replace(/^#/, '');
    if (id && demosById[id]) {
      showDemo(demosById[id]);
    } else {
      showOverview();
    }
  }

  window.addEventListener('hashchange', route);

  window.addEventListener('DOMContentLoaded', function () {
    document.querySelector('#sidebar .brand').addEventListener('click', function () {
      location.hash = '';
    });
    buildMenu();
    var content = document.getElementById('content');
    content.innerHTML = '<div class="loading">正在加载 pixi.miniprogram 内核…</div>';
    ShowcaseHarness.ensureLib()
      .then(route)
      .catch(function (err) {
        content.innerHTML = '<div class="error-box"><b>内核加载失败</b><br>' + err +
          '<br>请通过 HTTP 服务访问本页（如 <code>python3 -m http.server</code>），不要用 file:// 直接打开。</div>';
      });
  });
})();
