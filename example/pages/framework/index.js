/**
 * framework 2.0 演示页 — createGame 一步装配
 * 演示：Button 三态 / ScrollView+List 虚拟化 / Slider / ProgressBar / Modal / Toast / actions
 */
var lib = require('../../libs/pixi.miniprogram.js');

Page({
  onLoad: function () {
    var that = this;
    var query = wx.createSelectorQuery();
    query.select('#gameCanvas').boundingClientRect();
    query.select('#gameCanvas').node();
    query.exec(function (res) {
      var rect = res[0];
      var canvas = res[1].node;
      canvas.width = rect.width;
      canvas.height = rect.height;
      that._game = that.buildDemo(canvas);
    });
  },

  buildDemo: function (canvas) {
    var game = lib.createGame(canvas, { background: 0x1B2030 });
    var PIXI = game.PIXI;
    var ui = game.ui;
    var fw = lib.framework;
    var W = game.W;

    var title = ui.label('framework 2.0 demo', { size: 34, bold: true });
    title.x = 24; title.y = 40;
    game.stage.addChild(title);

    // Button（默认皮肤 = 程序化；接入图集 + theme.json 后自动换肤）
    var btn = ui.button('点我 Toast', 280, 88, {
      onTap: function () { game.toast.show('Hello framework 2.0'); }
    });
    btn.x = 24; btn.y = 110;
    game.stage.addChild(btn);

    // Modal
    var modal = ui.modal({ w: 560, h: 420, title: '弹窗演示' });
    var mLabel = ui.label('皮肤化 Modal：遮罩吞触摸\n九宫格背景 + 关闭按钮', { size: 26 });
    modal.body.addChild(mLabel);
    game.stage.addChild(modal);
    var btn2 = ui.button('打开弹窗', 280, 88, {
      skin: { bg: { color: 0xE89A3A } },
      onTap: function () { modal.open(); }
    });
    btn2.x = 340; btn2.y = 110;
    game.stage.addChild(btn2);

    // Slider + ProgressBar 联动
    var bar = ui.progressBar(500, 36);
    bar.x = 24; bar.y = 240;
    bar.setRatio(0.3);
    bar.setText('30');
    game.stage.addChild(bar);
    var slider = ui.slider({
      w: 500, min: 0, max: 100, step: 1, value: 30,
      onChange: function (v) { bar.setRatio(v / 100); bar.setText(String(v)); }
    });
    slider.x = 24; slider.y = 300;
    game.stage.addChild(slider);

    // List 虚拟化（100 行只建可视实例）
    var list = ui.list({
      w: W - 48, h: 500, itemHeight: 96, gap: 8,
      createItem: function () {
        var row = ui.panel(W - 48, 96);
        row.label = ui.label('', { size: 26 });
        row.label.x = 20; row.label.y = 32;
        row.addChild(row.label);
        return row;
      },
      updateItem: function (row, idx, data) {
        row.label.text = '第 ' + (idx + 1) + ' 行 — ' + data;
      }
    });
    list.x = 24; list.y = 390;
    game.stage.addChild(list);
    var data = [];
    for (var i = 0; i < 100; i++) { data.push('虚拟化列表项'); }
    list.setData(data);

    // actions 组合动作
    var dot = new PIXI.Sprite(game.tc.circle(16, 0xE05B4B));
    dot.x = 24; dot.y = 920;
    game.stage.addChild(dot);
    game.app.actions.run(dot, fw.actions.forever(fw.actions.sequence(
      fw.actions.moveTo(1200, { x: W - 80 }, fw.easing.quadInOut),
      fw.actions.moveTo(1200, { x: 24 }, fw.easing.quadInOut)
    )));

    game.app.start();
    return game;
  },

  touchEvent: function (e) {
    if (this._game) { this._game.dispatchTouch(e); }
  },

  onUnload: function () {
    if (this._game) { this._game.destroy(); this._game = null; }
  }
});
