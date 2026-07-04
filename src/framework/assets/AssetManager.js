/**
 * AssetManager — 图集/资源组管理（借鉴 Egret RES：组加载 + 帧名全局索引）
 *
 * 图集格式：TexturePacker JSON Hash
 *   { frames: { 帧名: { frame: {x,y,w,h}, slice?: [l,t,r,b] } }, meta: { image } }
 * 兼容手写切片（收编 UW Assets.js 模式）：addSheet(key, imageUrl, defs)
 *   defs: { 帧名: { x, y, w, h, slice? } }
 * 等宽横条带（收编 CnC2 SpriteAtlas 模式）：addStrip(key, imageUrl, frameW)
 *   加载后按图宽切帧，帧名 key_01..key_NN（与 frames(prefix) 直接配合）
 *
 * create(PIXI) → {
 *   addAtlas(key, atlasJson, imageUrl), addSheet(key, imageUrl, defs),
 *   addStrip(key, imageUrl, frameW), loadGroup(keys, cb),
 *   texture(frameName), slice(frameName), frames(prefix), ready(key), clear()
 * }
 */

var LOG = '[AssetManager]';

function create(PIXI) {
  var atlases = {};    // key → { image, defs, base, ready }
  var frameIndex = {}; // frameName → { atlasKey, def }
  var texCache = {};   // frameName → Texture

  function register(key, imageUrl, defs) {
    atlases[key] = { image: imageUrl, defs: defs, base: null, ready: false };
    for (var name in defs) {
      if (frameIndex[name]) {
        console.warn(LOG, 'duplicate frame name:', name, '(atlas', key + ')');
      }
      frameIndex[name] = { atlasKey: key, def: defs[name] };
    }
  }

  /** 条带图集加载完成后按 base 宽度切帧并注册帧索引 */
  function buildStripDefs(key, atlas) {
    var count = Math.max(1, Math.floor(atlas.base.width / atlas.strip.frameW));
    var h = atlas.base.height;
    var defs = {};
    for (var i = 0; i < count; i++) {
      var idx = i + 1;
      var name = key + '_' + (idx < 10 ? '0' + idx : idx);
      defs[name] = { x: i * atlas.strip.frameW, y: 0, w: atlas.strip.frameW, h: h };
      frameIndex[name] = { atlasKey: key, def: defs[name] };
    }
    atlas.defs = defs;
  }

  function loadOne(key, cb) {
    var atlas = atlases[key];
    if (!atlas) {
      console.warn(LOG, 'unknown atlas:', key);
      cb(false);
      return;
    }
    if (atlas.ready) { cb(true); return; }
    var base = PIXI.BaseTexture.from(atlas.image);
    atlas.base = base;
    function done() {
      if (atlas.strip && !atlas.defs) { buildStripDefs(key, atlas); }
      atlas.ready = true;
      cb(true);
    }
    if (base.valid) {
      done();
    } else {
      base.once('loaded', done);
      base.once('error', function () {
        console.warn(LOG, 'atlas load failed:', key, atlas.image);
        cb(false);
      });
    }
  }

  return {
    /** TexturePacker JSON Hash 图集 */
    addAtlas: function (key, atlasJson, imageUrl) {
      var defs = {};
      var frames = atlasJson.frames || {};
      for (var name in frames) {
        var f = frames[name];
        defs[name] = {
          x: f.frame.x, y: f.frame.y, w: f.frame.w, h: f.frame.h,
          slice: f.slice || (f.frame.slice || null)
        };
      }
      var img = imageUrl || (atlasJson.meta && atlasJson.meta.image);
      register(key, img, defs);
    },

    /** 手写切片图集：defs = { 帧名: {x,y,w,h,slice?} } */
    addSheet: function (key, imageUrl, defs) {
      register(key, imageUrl, defs);
    },

    /** 等宽横条带切帧（帧数 = 图宽 / frameW，向下取整） */
    addStrip: function (key, imageUrl, frameW) {
      atlases[key] = { image: imageUrl, defs: null, base: null, ready: false, strip: { frameW: frameW } };
    },

    /**
     * 组加载：keys 为图集 key 数组；全部完成后 cb(okCount, total)
     * 失败不阻塞（对应帧走程序化回退）
     */
    loadGroup: function (keys, cb) {
      cb = cb || function () {};
      var total = keys.length;
      if (!total) { cb(0, 0); return; }
      var left = total;
      var ok = 0;
      keys.forEach(function (key) {
        loadOne(key, function (success) {
          if (success) { ok++; }
          left--;
          if (left === 0) { cb(ok, total); }
        });
      });
    },

    /** 帧名 → Texture；图集未就绪或帧不存在返回 null（调用方走回退） */
    texture: function (frameName) {
      if (texCache[frameName]) { return texCache[frameName]; }
      var hit = frameIndex[frameName];
      if (!hit) { return null; }
      var atlas = atlases[hit.atlasKey];
      if (!atlas || !atlas.ready) { return null; }
      var d = hit.def;
      var tex = new PIXI.Texture(atlas.base, new PIXI.Rectangle(d.x, d.y, d.w, d.h));
      texCache[frameName] = tex;
      return tex;
    },

    /** 帧的九宫格元数据 [l,t,r,b]；无则 null */
    slice: function (frameName) {
      var hit = frameIndex[frameName];
      return (hit && hit.def.slice) || null;
    },

    /** 前缀取帧序列（按名称排序），帧动画用 */
    frames: function (prefix) {
      var names = [];
      for (var name in frameIndex) {
        if (name.indexOf(prefix) === 0) { names.push(name); }
      }
      names.sort();
      var self = this;
      return names.map(function (n) { return self.texture(n); }).filter(function (t) { return !!t; });
    },

    /**
     * 位图字体胶水（P3：Pixi 自带 BitmapText，fnt 走网络）
     * fntData：fnt 文件文本（XML/文本格式），textureUrl：字形图
     * 成功 cb(true)；PIXI.BitmapFont 不可用或解析失败 cb(false)（调用方回退系统字体）
     */
    loadBitmapFont: function (key, fntData, textureUrl, cb) {
      cb = cb || function () {};
      if (!PIXI.BitmapFont || !PIXI.BitmapFont.install) {
        console.warn(LOG, 'PIXI.BitmapFont unavailable, fallback to system font');
        cb(false);
        return;
      }
      var base = PIXI.BaseTexture.from(textureUrl);
      function install() {
        try {
          PIXI.BitmapFont.install(fntData, new PIXI.Texture(base));
          cb(true);
        } catch (e) {
          console.warn(LOG, 'bitmap font install failed:', key, e);
          cb(false);
        }
      }
      if (base.valid) {
        install();
      } else {
        base.once('loaded', install);
        base.once('error', function () {
          console.warn(LOG, 'bitmap font texture failed:', key, textureUrl);
          cb(false);
        });
      }
    },

    ready: function (key) {
      return !!(atlases[key] && atlases[key].ready);
    },

    /** 帧是否可用（图集就绪且帧存在） */
    has: function (frameName) {
      var hit = frameIndex[frameName];
      return !!(hit && atlases[hit.atlasKey] && atlases[hit.atlasKey].ready);
    },

    clear: function () {
      for (var k in texCache) {
        try { texCache[k].destroy(); } catch (e) { /* noop */ }
      }
      texCache = {};
      for (var a in atlases) {
        if (atlases[a].base) {
          try { atlases[a].base.destroy(); } catch (e2) { /* noop */ }
        }
      }
      atlases = {};
      frameIndex = {};
    }
  };
}

module.exports = { create: create };
