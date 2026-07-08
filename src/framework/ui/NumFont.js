/**
 * NumFont — BMFont 艺术数字（3.1 收编 EggSoldier NumFont，实例化 + PIXI.Text 回退链）
 *
 * HUD 大数字（伤害飘字/金币/倒计时）专用：fnt 描述 + 单图逐字符切帧拼接。
 * 「素材未就绪不阻塞玩法」：ready() 为 false 时 make() 节点自动回退 PIXI.Text，
 * 字体就绪后下一次 setText 无缝切换为图字。
 *
 * create(ctx, opts)
 *   ctx: { PIXI }
 *   opts: { fallbackStyle: { fontSize=32, fill=0xffffff, fontWeight='bold' } }
 *
 * 实例 API：
 *   setFnt(fntText, texture)   注入 BMFont 描述（文本/XML 单行格式均可）+ 字模图纹理
 *   load(fntUrl, texture, cb?) wx.request 拉取 fnt 文本后 setFnt（无 wx 静默失败回退）
 *   ready()                    字模是否就绪
 *   canRender(str)             字符串是否全部有字模
 *   make() → node              池化友好节点：make() 一次，setText(str, tint?, scale?) 复用
 *                              中心锚点（与 PIXI.Text anchor 0.5 摆放习惯一致）
 */

var LOG = '[NumFont]';

/**
 * 解析 BMFont 描述：兼容两种单行格式
 *   文本：char id=48 x=.. y=.. width=.. height=.. xoffset=.. yoffset=.. xadvance=..
 *   XML： <char id="48" x=".." .../>
 */
function parseFnt(txt) {
  var chars = {};
  var lineHeight = 0;
  var lines = String(txt).split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var kv = {};
    line.replace(/(\w+)="?(-?\d+)"?/g, function (mm, k, v) {
      kv[k] = parseInt(v, 10);
      return mm;
    });
    if (/(^|<)common[\s>]/.test(line.trim()) && kv.lineHeight) {
      lineHeight = kv.lineHeight;
      continue;
    }
    if (!/(^|<)char[\s>]/.test(line.trim()) || kv.id == null) { continue; }
    chars[String.fromCharCode(kv.id)] = {
      x: kv.x, y: kv.y, w: kv.width, h: kv.height,
      xoff: kv.xoffset || 0, yoff: kv.yoffset || 0,
      xadv: kv.xadvance || kv.width
    };
  }
  return { chars: chars, lineHeight: lineHeight };
}

function create(ctx, opts) {
  var PIXI = ctx.PIXI;
  opts = opts || {};
  var fb = opts.fallbackStyle || {};
  var fallbackStyle = {
    fontSize: fb.fontSize || 32,
    fill: fb.fill === undefined ? 0xffffff : fb.fill,
    fontWeight: fb.fontWeight || 'bold'
  };

  var _chars = null;
  var _lineHeight = 39;
  var _tex = null;       // 字模图纹理（PIXI.Texture 或 BaseTexture 皆可）
  var _charTex = {};     // char → 子帧 Texture

  function baseTextureOf(tex) {
    return tex && tex.baseTexture ? tex.baseTexture : tex;
  }

  function charTexture(ch) {
    var t = _charTex[ch];
    if (t) { return t; }
    var info = _chars && _chars[ch];
    if (!info || !_tex) { return null; }
    t = new PIXI.Texture(baseTextureOf(_tex), new PIXI.Rectangle(info.x, info.y, info.w, info.h));
    _charTex[ch] = t;
    return t;
  }

  var api = {
    setFnt: function (fntText, texture) {
      var parsed = parseFnt(fntText);
      _chars = parsed.chars;
      if (parsed.lineHeight) { _lineHeight = parsed.lineHeight; }
      _tex = texture;
      _charTex = {};
    },

    load: function (fntUrl, texture, cb) {
      cb = cb || function () {};
      if (typeof wx === 'undefined' || !wx || !wx.request) {
        cb(false);
        return;
      }
      wx.request({
        url: fntUrl,
        timeout: 4000,
        dataType: 'text',
        success: function (res) {
          if (res.statusCode === 200 && typeof res.data === 'string') {
            api.setFnt(res.data, texture);
            cb(api.ready());
          } else {
            cb(false);
          }
        },
        fail: function () {
          console.warn(LOG, 'fnt load failed', fntUrl);
          cb(false);
        }
      });
    },

    ready: function () { return !!(_chars && _tex); },

    canRender: function (str) {
      if (!api.ready()) { return false; }
      str = String(str);
      for (var i = 0; i < str.length; i++) {
        if (!_chars[str[i]]) { return false; }
      }
      return true;
    },

    /**
     * 数字文本节点（池化友好）：make() 一次，setText(str, tint, scale) 复用。
     * 字模未就绪 / 含缺字字符时回退 PIXI.Text（就绪后下一次 setText 切图字）。
     */
    make: function () {
      var node = new PIXI.Container();
      var fallback = null;   // 懒建 PIXI.Text

      function hideSprites() {
        for (var i = 0; i < node.children.length; i++) {
          var c = node.children[i];
          if (c !== fallback) { c.visible = false; }
        }
      }

      node.setText = function (str, tint, scale) {
        str = String(str);
        scale = scale || 1;

        if (!api.canRender(str)) {
          // 回退链：PIXI.Text
          hideSprites();
          if (!fallback) {
            fallback = new PIXI.Text(str, fallbackStyle);
            if (fallback.anchor && fallback.anchor.set) { fallback.anchor.set(0.5); }
            node.addChild(fallback);
          }
          fallback.visible = true;
          fallback.text = str;
          if (tint != null) { fallback.tint = tint; }
          node.scale.set(scale);
          return;
        }

        if (fallback) { fallback.visible = false; }
        var i;
        var w = 0;
        var infos = [];
        for (i = 0; i < str.length; i++) {
          var info = _chars[str[i]];
          infos.push(info);
          w += info.xadv;
        }
        var x = -w / 2;
        var used = 0;
        for (i = 0; i < str.length; i++) {
          var tex = charTexture(str[i]);
          if (!tex) { continue; }
          // 复用 sprite 池（跳过 fallback 节点）
          var sp = null;
          while (used < node.children.length) {
            if (node.children[used] !== fallback) {
              sp = node.children[used];
              break;
            }
            used++;
          }
          if (!sp) {
            sp = new PIXI.Sprite();
            node.addChild(sp);
          }
          sp.visible = true;
          sp.texture = tex;
          sp.tint = tint == null ? 0xffffff : tint;
          sp.x = x + infos[i].xoff;
          sp.y = -_lineHeight / 2 + infos[i].yoff;
          x += infos[i].xadv;
          used++;
        }
        for (i = used; i < node.children.length; i++) {
          if (node.children[i] !== fallback) { node.children[i].visible = false; }
        }
        node.scale.set(scale);
      };
      return node;
    }
  };

  return api;
}

module.exports = { create: create, parseFnt: parseFnt };
