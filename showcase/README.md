# pixi-miniprogram Showcase — PC 端演示站

把 **微信小程序版 Pixi 适配层 + framework 游戏框架 3.0** 搬到 PC 浏览器里在线演示。
内核产物 `dist/pixi.miniprogram.js` **零修改**，浏览器兼容全部由演示站自己的
polyfill / 桥接层完成。

## 快速开始

纯静态站点，无构建步骤。任选一种方式启动 HTTP 服务后打开 `index.html`：

```bash
cd showcase
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

或直接把 `showcase/` 整个目录上传到任意静态托管（GitHub Pages / nginx / OSS）即可访问。
注意不能用 `file://` 直接打开（模块通过 fetch 加载）。

## 演示内容

- **原始框架功能（11 项）**：Sprite 触摸 / Graphics / Text / BitmapText /
  AnimatedSprite / myTween / Shader 遮罩 / Spine / 音频 / 截图 / 扩展库注入模式
- **framework 新增（24 项）**：createGame 主循环、皮肤化 UI 全家桶
  （widgets / Modal / Toast / Slider / Theme / ScrollView / List / TabBar / PageView / CooldownButton）、
  actions 动作系统、SceneManager 转场、Layout 锚点，以及 3.0 世界表现层
  （Camera / SpriteAnimator+addStrip / ChunkWorld / EntityManager / PinchPan /
  Particle / FxLayer / filters / AudioManager / Store+Gateway+Rng / app.snapshot），
  压轴为组合了世界层全家桶的可玩大场景 **「综合场景：航海世界」**。

每个演示页 = 可交互实时渲染 + 使用说明 + 代码片段。

## 工作原理（不改内核）

```
浏览器
 ├─ js/wx-polyfill.js   模拟 wx.*（离屏 canvas / request / 音频 / storage / 系统信息）
 ├─ js/loader.js        迷你 CommonJS 加载器（fetch + new Function 跑小程序模块）
 ├─ js/harness.js       伪小程序 canvas（createImage / rAF）+ 鼠标→wx 触摸事件桥
 │                       + 演示生命周期（切换时销毁 renderer、防跨演示监听泄漏）
 └─ libs/pixi.miniprogram.js   ← dist 原样拷贝，一行未改
```

要点：

- 内核 `createPIXI` 深度依赖 `wx.createOffscreenCanvas` / `wx.getPerformance` 等，
  polyfill 用浏览器等价物一一承接；
- 触摸链路与小程序完全同路：鼠标事件被转成 `{ touches, changedTouches }`
  结构后喂给 `PIXI.dispatchEvent(e)`（即小程序页面里 `touchEvent` 的做法）；
  滚轮会被合成为双指捏合序列，走真实的 PinchPan onPinch 路径；
- 刻意**不**提供 `wx.getFileSystemManager`，让 `app.snapshot` 走内核内置的
  非 wx 降级路径（返回 dataURL），演示"一套代码两端自适配"。

## 素材说明

- `assets/uw/`：像素图集（16px 瓦片 / 32px 船与角色帧），来自
  JohanLi/uncharted-waters-2（MIT）像素占位素材，仅演示用；
- `assets/remote/`：原官方 example 的远程资源本地镜像
  （blog.fnt + blog_0.png 位图字体、spineboy-pro.json/.atlas/.png 骨骼数据），
  演示站完全离线可用，不依赖外网；
- 其余视觉全部为 `tc.*` 程序化纹理（方块 / 圆角面板 / 圆环），
  音频为运行时合成 WAV（data URI）。

## 已知限制

- Live2D 运行时体量大且授权受限，只做注入模式的文档化演示（见「扩展库生态注入模式」）；
- 双指手势用滚轮模拟；真机小程序端请参考 `example/` 目录。
