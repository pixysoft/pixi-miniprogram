#pixijs 小程序 WebGL 的适配版本。
---
  - 2026.7.08 **v3.1.0**：framework 收编现网 18 款游戏的高频自建模块（按现网复用度 P0/P1 排序），产物不变（`dist/pixi.miniprogram.js`），冒烟测试 69 项全绿（`npm test`），showcase 新增 7 项演示：
    - **P0 消除重复**：
      - `PageShell` 页面壳模板（收编现网 15 份重复 Page 壳）：canvas 节点查询 → `createGame` → 触摸转发（WXML 统一绑 `onTouch`）→ `onHide/onShow/onUnload` 生命周期 → 分享；业务页面只写 `Page(framework.PageShell.create({ createGame, share }))` 约 10 行
      - `SceneManager` 弹层栈（收编 Mr2/EggSoldier 模式）：`pushLayer/popLayer/hasLayer/currentLayer` — 弹层压栈时**下层保持可见但 update 冻结**（暂停战斗/结算/抽卡标准语义，与 `push` 整场切换语义并存）；popLayer 对新栈顶调 `resume(params)`；createGame 内置弹层根（场景之上、toast 之下）
      - `TextureFactory` 程序化纹理工厂（收编现网 12 份并集，`game.tf`，与 `game.tc` 共享缓存）：`circle（可带描边）/ring/rect/roundRect/diamond/triangle/star/tile/isoTile/joystick` + `bake(key, draw)` 自定义 — 「素材未就绪不阻塞玩法」约定的引擎化
    - **P1 支撑品类**：
      - `Joystick` 虚拟摇杆（收编 EggSoldier 向量版 + DAL 量化版）：浮动式（触摸点即中心）/固定式热区，输出单位向量 + 力度、`dir4()`（主轴优先四方向）、`dir8()`；皮肤缺省 `tf.joystick` 兜底；`game.joystick(surface, opts)`
      - `Camera2D` 缩放相机（收编 CnC2/SimCity）：直接操纵 world 容器 — `pan/zoomAt（锚点缩放）/setScale/focusWorld/focusTile/toWorld/toTile/tileToScreen/visibleWorld/visibleTiles`，边界钳制 + 地图小于视口自动居中；与 3.0 Camera（偏移输出式平滑跟随）互补，与 PinchPan 组合即 RTS 手势镜头
      - `TileMap` 静态瓦片地图（收编 DAL/UW，≤128×128 中小关卡）：legend 字符图例 + ground/overlay 分层（over 高层自动补地）+ `walkable` 碰撞表 + `setBlocked` 动态占位；纹理经 `textureFor(key)` 注入，缺素材跳格不阻塞；与 ChunkWorld（无限分块）互补
      - `PathFinder` 格子 A*（收编 Mr2/DAL）：八/四方向、`canWalk` 注入、目标不可走自动找最近可走格、maxSteps/maxIterations 上限；返回格序列，`dirs()` 转方向序列
      - `Perf` 性能探针（收编 Mr2/EggSoldier，工厂化 + `onReport` 钩子）：分段耗时 `add(name, ms)` + 实体计数 + 窗口汇总（均值/最大/慢帧），HUD 或 console 双出口；`game.perf(opts)`
      - `NumFont` BMFont 艺术数字（收编 EggSoldier，实例化 + 回退链）：fnt 文本/XML 单行格式解析、逐字符 Sprite 拼接（池化友好 `make()/setText`）、字体未就绪自动回退 `PIXI.Text` 且就绪后无缝切图字；`game.numFont(opts)`
    - 场景协议新增可选 `resume(params)`；`createGame` 返回值追加 `game.tf / game.joystick / game.numFont / game.perf`
---
  - 2026.7.03 **v3.0.0**：framework 补齐「世界表现层」（分支 feature/fable5_dev_3）。主包产物仍为 `dist/pixi.miniprogram.js`，插件线独立分包产物 `dist/plugins/spine.player.js`（不进主包）：
    - **P0 收编现网 fork**：`Camera` 世界相机（平滑跟随 + 拖拽接管 + 空闲回跟 + 边界钳制，合并大航海/Rich4 版）、`SpriteAnimator` 帧动画播放器（dt 驱动，`game.animator(sprite)` 自动接管）+ `assets.addStrip` 等宽条带切帧、`AudioManager`（BGM 双通道交叉淡入 + SFX 并发上限 4，URL 由游戏注册，`game.audio` 自动接入主循环）、`transitions.fade` 内置转场（phase 状态机，转场期吞触摸）、`Layout` 单层锚点布局（center > left > right 优先级 + left/right 拉伸 + w/h 百分比 + relayout）
    - **P1 演出层**：`Particle` 轻量粒子（点/圆发射器 + 对象池 + 上限 100）、`filters` 预设（night/hurt/glow/custom，无 ColorMatrixFilter 时回退 tint）、`FxLayer` 战斗飘字/碎块/圆环（收编 KR2 Fx，Text 对象池 + FxText 皮肤键）、`CooldownButton` 径向 CD 按钮（收编 KR2 skillButton，皮肤化）、`actions.bezierTo / splineTo` 曲线动作（cocos 公式）、ScrollView 轴向化（`direction:'x'` 水平 + `snapInterval` 磁吸）
    - **P2 世界层**：`ChunkWorld` 分块世界（ChunkProvider 协议 + 32×32 chunk + 视口外卸载 + `staticProvider` 包装 1.0 静态图）、`ChunkRenderer`（每 chunk 一 Container + Sprite 池）、`EntityManager` Lite（spawn/despawn + `syncTo` 位置插值，多人他船平滑）、`PinchPan` 手势插件（单指平移/双指缩放/点击/长按）、`TabBar`（皮肤化选中态）+ `PageView`（磁吸翻页）
    - **P3 胶水（按需分包）**：`plugins/SpinePlayer`（Spine 3.8 加载/播放/dispose，独立产物）、`assets.loadBitmapFont` + `ui.richLabel` 分段着色、`app.snapshot` 截图（wx 写临时文件/存相册，非 wx 回 dataURL）
    - 冒烟测试 60 项全绿（`npm test`）；明确不做：ECS/物理/布局树/多 Camera/EXML 编辑器链路
---
  - 2026.7.03 **v2.0.0**：新增 framework 游戏框架层（分支 feature/fable5_dev_2.0）。产物同为单文件 `dist/pixi.miniprogram.js`，新导出 `framework` 与 `createGame`：
    - app：App 主循环（tick 优先级 / maxDt / Timer / actions 接管）、createGame 一步装配
    - scene：SceneManager（场景栈 + transition 钩子）、EventBus（快照分发）
    - assets：AssetManager（TexturePacker 图集 / 手写切片 / 资源组 / 帧名索引 / 九宫格元数据）、TextureCache（程序化纹理缓存）
    - ui：Theme 皮肤主题（JSON 换皮，缺帧自动回退程序化纹理）、Button 三态、ScrollView（惯性/回弹/子控件拦截，参数移植 cocos/egret）、List 虚拟化、Slider、ProgressBar、Modal、Toast、legacy 旧 widgets 兼容层
    - action：sequence/spawn/repeat/ease 组合式动作；data：Store/Gateway/Rng
    - 用法：`const { createGame, framework } = require('libs/pixi.miniprogram.js')`，示例见 `example/pages/framework/`；冒烟测试 `npm test`
---
  - 2021.1.11 修复graphics在新版微信内不正常显示的bug
  - 2021.1.14 改写PIXI.Text和PIXI.Graphics的渲染逻辑，需要在wxml文件中添加两个type 2d的canvas，然后把canvas传入PIXI中。其中一个用于Graphics渲染，一个用于Text渲染，传入参数示例：PIXI = createPIXI(canvas,stageWidth,canvas2d,canvas2dText)
  - 2021.3.25 添加遮罩实现示例
  - 2021.3.29 添加performance的判断
  - 2021.5.11 修改animate库不能显示的问题
  - 2021.12.09 使用微信小程序新版本的获取离屏canvas接口获取2d离屏canvas，减少创建PIXI时候额外传入的两个canvas，该版本需要微信小程序基础库2.16.1以上。如果要兼容旧版本的基础库，请使用v1.0版本代码。
  - 2022.03.29 添加音频支持
  - 2022.04.11 添加3.8版本spine库
  - 2022.06.12 修改背景不能透明的问题
  - 2023.11.03 修改pixi版本为6.3.2,旧版本5.2.1看release
  - 2023.11.03 修改pixi版本为7.3.2,旧版本5.2.1,6.3.2看release，6.3.2版本里面的example里面的libs文件夹没有更新到pixi库，请在dist里面复制过去覆盖使用
  - 2024.5.28 添加live2d
---

## framework 3.1 速览（新增模块用法）

```javascript
var lib = require('libs/pixi.miniprogram.js');
var fw = lib.framework;

// 1) PageShell：页面 js 全部内容（替代现网 ~50 行重复壳）
Page(fw.PageShell.create({
  createGame: function (canvas, w, h, page) {
    return require('../../game/Game.js').create(canvas, w, h);
  },
  share: { title: '来玩！', path: '/packageX/pages/index/index' }
}));
// WXML: <canvas id="gameCanvas" type="webgl" bindtouchstart="onTouch"
//        bindtouchmove="onTouch" bindtouchend="onTouch" bindtouchcancel="onTouch"/>

// 2) 弹层栈：暂停/结算/抽卡（下层可见但 update 冻结）
game.scenes.pushLayer('pause');
game.scenes.popLayer({ from: 'pause' });   // 新栈顶 resume(params)

// 3) TextureFactory：素材未就绪不阻塞玩法
new PIXI.Sprite(game.tf.circle(0xE05B4B, 24, 0xFFFFFF));
new PIXI.Sprite(game.tf.star(0xFFD23E, 44, 0.4));

// 4) 虚拟摇杆
var joy = game.joystick(surface, { radius: 120 });
stage.addChild(joy.container);
game.app.onTick(function (dt) {
  var d = joy.getDir();                    // {x, y, strength} | null
  if (d) { hero.x += d.x * speed * d.strength * dt / 1000; }
});

// 5) Camera2D + PinchPan：RTS 手势镜头
var cam = fw.Camera2D.create(world, viewport, mapW * TILE, mapH * TILE,
  { maxScale: 2, tileSize: TILE });
fw.PinchPan.create(stage, {
  onPan: function (dx, dy) { cam.pan(dx, dy); },
  onPinch: function (f, cx, cy) { cam.zoomAt(f, cx, cy); },
  onTap: function (x, y) { select(cam.toTile(x, y)); }
});

// 6) TileMap + PathFinder：字符图例关卡 + 点击寻路
var map = fw.TileMap.create({ PIXI: PIXI, textureFor: textureFor }, mapJson, { tileSize: 48 });
var path = fw.PathFinder.find(function (x, y) { return map.walkable(x, y); },
  hero.gx, hero.gy, tx, ty, { diagonal: true, nearest: true });

// 7) Perf：分段耗时窗口汇总
var perf = game.perf({ windowMs: 10000, onReport: function (r) { hud.show(r); } });
game.app.onTick(function (dt) {
  var t0 = Date.now(); sim.update(dt); perf.add('sim', Date.now() - t0);
  perf.frame(Date.now(), dt);
});

// 8) NumFont：BMFont 艺术数字（未就绪自动回退 PIXI.Text）
var nf = game.numFont();
nf.load(fntUrl, PIXI.Texture.from(fontPngUrl));
var score = nf.make();
score.setText('12345', 0xFFD166, 1.2);
```

PC 端演示：`showcase/` 目录（`python3 -m http.server` 后访问），3.1 新增 7 项可交互演示。

## 使用

可参考 example 目录下的示例项目或参照以下流程：

1. 复制dist目录的pixi.miniprogram.js到目录libs下

2. 导入小程序适配版本的 pixi.js

```javascript
import {createPIXI} from "../../libs/pixi.miniprogram"
var unsafeEval = require("../../libs/unsafeEval")
var installSpine = require("../../libs/pixi-spine")
var installAnimate = require("../../libs/pixi-animate")
var myTween = require("../../libs/myTween")
var PIXI = {};
var app = getApp()
Page({
    onLoad:function () {
        var info = wx.getSystemInfoSync();
        var sw = info.screenWidth;//获取屏幕宽高
        var sh = info.screenHeight;//获取屏幕宽高
        var tw = 750;
        var th = parseInt(tw*sh/sw);//计算canvas实际高度
        var stageWidth = tw;
        var stageHeight = th;
        var query = wx.createSelectorQuery();
        query.select('#myCanvas').node().exec((res) => {
            var canvas = res[0].node;
            canvas.width = sw;//设置canvas实际宽高
            canvas.height = sh;//设置canvas实际宽高,从而实现全屏
            PIXI = createPIXI(canvas,stageWidth);//传入canvas，传入canvas宽度，用于计算触摸坐标比例适配触摸位置
            unsafeEval(PIXI);//适配PIXI里面使用的eval函数
            installSpine(PIXI);//注入Spine库
            installAnimate(PIXI);//注入Animate库
            var renderer = PIXI.autoDetectRenderer({width:stageWidth, height:stageHeight,backgroundAlpha:1,premultipliedAlpha:true,preserveDrawingBuffer:true,'view':canvas});//通过view把小程序的canvas传入
            var stage = new PIXI.Container();
            var bg = PIXI.Sprite.from("https://raw.githubusercontent.com/skyfish-qc/imgres/master/bg.jpg");
            stage.addChild(bg);
            bg.eventMode = 'static';
            bg.on("pointerdown",function(e){
                console.log("pointerdown",e.data.global)
            });
            bg.on("pointerup",function(e){
                console.log("touchend")
				// 获取base64图像
                const b64Data = canvas.getContext("webgl").canvas.toDataURL()
                const time = new Date().getTime();
                const filePath = `${wx.env.USER_DATA_PATH}/temp_image_${time}.png`
                // base64格式的图片要去除逗号前面的部分才能正确解码
                const buffer = wx.base64ToArrayBuffer(b64Data.substring(b64Data.indexOf(',') + 1))
                // 写入临时文件
                wx.getFileSystemManager().writeFile({
                    filePath,
                    data: buffer,
                    encoding: 'utf8',
                    success: res => {
                        console.log('保存图片：', filePath)
                        wx.saveImageToPhotosAlbum({
                            filePath:filePath,
                            success(res) {
                                console.log('已保存图片到相册')
                            }
                        })
                    }
                })
            });
            
            //小程序不支持加载本地fnt，json文件，所以涉及到fnt，json文件的加载需要放到网络服务器
            PIXI.Assets.add("blog","https://raw.githubusercontent.com/skyfish-qc/imgres/master/blog.fnt")
            PIXI.Assets.add("mc","https://raw.githubusercontent.com/skyfish-qc/imgres/master/mc.json")
            PIXI.Assets.add('spineboypro', "https://raw.githubusercontent.com/skyfish-qc/imgres/master/spineboy-pro.json")
            PIXI.Assets.load(["blog","mc","spineboypro"]).then(function(res){
                var btext = new PIXI.BitmapText('score:1234',{'fontName':'blog','fontSize':'60px','tint':0xffff00});
                btext.x = 40;
                btext.y = 140;
                stage.addChild(btext);
                var explosionTextures = [];
                for (var i = 0; i < 26; i++) {
                    var texture = PIXI.Texture.from('pic'+(i+1)+'.png');
                    explosionTextures.push(texture);
                }
                for (i = 0; i < 2; i++) {
                    var explosion = new PIXI.AnimatedSprite(explosionTextures);

                    explosion.x = Math.random() * stageWidth;
                    explosion.y = Math.random() * stageHeight*0.2;
                    explosion.anchor.set(0.5);
                    explosion.rotation = Math.random() * Math.PI;
                    explosion.scale.set(0.75 + Math.random() * 0.5);
                    explosion.gotoAndPlay((Math.random() * 27|0));
                    stage.addChild(explosion);
                }
                var spineBoyPro = new PIXI.spine.Spine(res.spineboypro.spineData);
                spineBoyPro.x = stageWidth / 2;
                spineBoyPro.y = 1200;

                spineBoyPro.scale.set(0.5);
                spineBoyPro.state.setAnimation(0, "hoverboard",true);
                stage.addChild(spineBoyPro);
                
                //测试Animate
                var mymc = new PIXI.animate.MovieClip();
                stage.addChild(mymc);

                const testTxt = new PIXI.Text("test",{fill:'#ff0000',fontSize:44});
                testTxt.x = 100;
                testTxt.y = 400;
                stage.addChild(testTxt);

                const testTxt2 = new PIXI.Text("",{fill:'#ff0000',fontSize:44});
                testTxt2.x = 100;
                testTxt2.y = 500;
                stage.addChild(testTxt2);
                testTxt2.text = "test2";

                const graphics = new PIXI.Graphics();
                graphics.beginFill(0xFF3300);
                graphics.drawRect(0, 0, 100, 100);
                graphics.endFill();
                graphics.x = 100;
                graphics.y = 200;
                stage.addChild(graphics);

                const graphics2 = new PIXI.Graphics();
                graphics2.beginFill(0xFFFF00);
                graphics2.drawRect(0, 0, 200, 200);
                graphics2.endFill();
                graphics2.x = 200;
                graphics2.y = 400;
                stage.addChild(graphics2);

                //遮罩示例start
                //遮罩示意shader
                var frag = `
                varying vec2 vTextureCoord;
                uniform vec4 inputPixel;
                uniform vec2 dimensions;
                uniform sampler2D uSampler;
                uniform sampler2D masktex;
                void main(void) {
                    vec4 color = texture2D(uSampler, vTextureCoord);
                    vec2 coord = vTextureCoord.xy * inputPixel.xy / dimensions.xy;
                    vec4 maskcolor = texture2D(masktex, coord);
                    gl_FragColor = color*maskcolor;
                }
                `;
                const maskshape = new PIXI.Graphics();
                maskshape.beginFill(0xFFFFFF);//用于遮罩的形状必须为白色，因为shader遮罩原理是目标颜色乘以遮罩形状颜色，设置成白色可以避免干扰目标颜色。
                maskshape.drawCircle(100, 100, 100);
                maskshape.endFill();
                maskshape.x = 200;
                maskshape.y = 600;
                stage.addChild(maskshape);//先加入渲染
                var masktex = renderer.generateTexture(maskshape);//获取到遮罩形状纹理，如果是直接加载外部遮罩图片，上面部分可以省略。
                stage.removeChild(maskshape);//获得纹理后移除
                var uniform = {
                    masktex:masktex,
                    dimensions: [200, 200]//传入遮罩纹理图片尺寸，用于计算纹理的实际uv
                }
                
                var shader = new PIXI.Filter(null,frag,uniform);
                graphics2.filters = [shader];//给graphics2物体进行遮罩，原来是方形的经过遮罩后变成圆形
                //遮罩示例end

                renderer.render(stage);
            });
            //myTween缓动库使用示例
            /*
            缓动公式：Linear,Quad,Cubic,Quart,Sine,Expo,Circ,Elastic,Back,Bounce,Quint
            比如myTween.Quad.Out,myTween.Quad.In,myTween.Quad.InOut
            onEnd:结束事件
            onUpdate:每帧触发
            myTween.clean();//清除所有事件
            */
            var tweenObj = PIXI.Sprite.from("img/head.png");
            tweenObj.y = 500;
            stage.addChild(tweenObj);
            var tx = 600;
            function tweenMove() {
                myTween.to(tweenObj,1,{x:tx,ease:myTween.Quad.Out,onEnd:function(){
                    if(tx>0) {
                        tx = 0;
                    } else {
                        tx = 600;
                    }
                    tweenMove();
                }});
            }
            tweenMove();
            function animate() {
                canvas.requestAnimationFrame(animate);
                renderer.render(stage);
                myTween.update();
            }
            animate();
            // renderer.render(stage);
        });
    },
    touchEvent:function(e){
        //接收小程序的触摸事件传给PIXI
        PIXI.dispatchEvent(e);
    }
})

```

## 说明

- 本项目当前使用的 pixi.js 版本号为 7.3.2。
- 该适配版本的 PIXI 不在全局环境中，如使用 pixi.js 的其他配套类库，需要自行传入 PIXI 到类库中。可参考libs里面的pixi-spine的做法。
- 改写PIXI.Text和PIXI.Graphics的渲染逻辑，以适配小程序的显示。
- 视频不支持
