# 时间轴与实现

时间轴由 `applyTimeline()` 按「字迹长度」推导，改文案长度不会破坏观感。插件与独立演示页共用同一套引擎（`src/engine.js`）。

| 阶段 | 相对时刻 | 说明 |
| --- | --- | --- |
| 提笔 | `W_START=1.0s` | 开始书写；总时长 `writeDur = clamp(总笔画长/(字号*2.15)+笔画数*0.035, 2.6, 6.4)` |
| 写完 | `W_END` | 手写结束；停顿 1.5s |
| 淡出 | `W_END+1.52 → +2.32` | 画布淡出上移 |
| 鲸鱼描边 | 淡出结束前 0.14s 起，历时 2.06s | 1500 点轮廓按弧长逐段画出，笔尖跟随 |
| 填充/描边 | `+0.06 → +0.90` | SVG 渐变填充 + 内外描边交叉淡入 |
| 字标 | 填充结束前 0.19s 起，0.9s | 轻微左移淡入 |
| 字幕 | 字标结束 +0.13s，0.9s | 字距略收 |
| 停顿/呼吸 | 字幕结束后 | 鲸鱼轻微摆尾 + 光晕呼吸；插件再停 1.8s 后进入交接 |

## 结束交接（为什么不是硬切）

停顿结束后，只让鲸鱼推近，整屏随之渐隐：`1.5s`，鲸鱼 `cubic-bezier(.45,0,.25,1)`，
整屏透明度前 22% 保持不动再线性淡出。

| 对象 | 变化 |
| --- | --- |
| 鲸鱼（仅此一层） | `scale 1 → 1.25`，围绕自身包围盒中心 |
| 整屏（黑/白底 + 字标 + 副标题） | `opacity 1 → 0`，`22%` 处才开始褪 |
| 下层主界面 | **不做任何动画**，就藏在开屏后面，靠上层淡出露出来 |

实现方式：引擎给 splash 根节点加 `.dshiw-handoff`（整屏淡出），鲸鱼用一个单独包出来的
`.dshiw-whale-zoom` 分组做缩放。不能直接缩放 `.dshiw-whale-anim`：它身上跑着摆尾 / 起伏的
SVG transform 属性，CSS 变换会把属性覆盖掉；单独一层互不影响。字标和副标题不参与缩放。

- 缩放原点用 `transform-box:fill-box; transform-origin:50% 50%`，推近时鲸鱼中心不动；
  实测字标包围盒在交接过程中宽度不变。
- 不碰 AppFrame、不写宿主的 `transform-origin`——主界面没有位移，就不会出现列间缝隙、
  也不会把 overlay 里的开屏背景缩出一圈边框。
- 默认不做模糊（`DSHIW_HANDOFF_BLUR = 0`）。模糊是唯一容易掉帧的项，去掉后整段只有
  `transform` + `opacity`；想要轻微失焦把它改成 `10` 即可，模糊只作用在鲸鱼那一层。

调手感只改 `src/engine.js` 顶部这几个常量（CSS 与 JS 共用）：

```js
var DSHIW_HANDOFF_MS = 1500;
var DSHIW_HANDOFF_EASE = 'cubic-bezier(.45,0,.25,1)';   // 慢进慢出
var DSHIW_HANDOFF_BLUR = 0;                             // >0 时鲸鱼带 blur
```

内嵌预览（设置页 16:9 小舞台）只做简单淡出；`prefers-reduced-motion` 时整屏直接淡出，
不做缩放、不做模糊。

## 首屏遮罩（主界面不再闪一下）

官方 boot 卡（`data-dsh-boot`）会在 React 接管时被换成主界面，而浏览器半的开屏要等
配置就绪才挂上——这段空档里主界面会露出来。Host 半监听 `webserver/index-inject`，
推入 `style` 与 `script(head)` 两行：

1. 桌面端把这张表随 boot payload 送进渲染进程，在挂载应用之前执行；
   浏览器端由 `renderIndex` 直接写进 `index.html`——两端都赶得到。
2. 脚本用 `MutationObserver` 盯住 `[data-shell-overlay]`（AppFrame）出现的瞬间；
   DOM 变更回调早于这一帧绘制，这时把 `#dshiw-boot-cover` 插进 `body` 盖住主界面。
3. 浏览器半把开屏第一帧画出来后调用 `window.__dshiwBootCover.drop()` 摘掉。

遮罩底色取 `getComputedStyle(document.body).backgroundColor`，与 boot 卡同色，所以
boot 卡 → 遮罩 → 开屏（auto 深浅跟随 DSH）是同一个底色。缓存里 `enabled:false`
（用户关掉开屏）时完全不遮；8 秒兜底自动摘掉，防止插件异常时一直黑屏。

播放方式：

- **启动开屏**：`shell.overlay` 全屏播放，结束交接后卸载；点击 / 任意键 / `Esc` 跳过（跳过时先落到终帧 logo 再交接）。
- **设置页预览**：同一个引擎以 `inline: true` 塞进 16:9 小舞台，按挂载点尺寸缩放，不监听全局按键，点击画面跳过。

## 手写引擎
- 每个字由若干条**笔画骨架**组成，骨架点带笔宽（数据来自字体 `glyphData`，em 单位、y 向下）。
- 每帧只把「这一帧新写出的那一段」推进遮罩：`advanceReveal()` 记录每条笔画的已写长度，`paintRect()` 在脏矩形内**清掉遮罩后整笔重画**（不累积，避免帧边界圆头叠加出的亮点），再只对该矩形做 `ink ∩ mask` 合成。
- 合成必须 `clip()` 到矩形：`destination-in` 是全局算子，不裁剪会清空矩形以外的画面。
- 墨迹发光不用模糊滤镜，改为同笔画多层加宽描边叠加。
- 缺字回退：优先从其它手写体借同字符（如 `·`），仍缺则用系统楷体 fillText + 一条横向扫入的合成笔画。

## 性能（headless 软件渲染实测）
| 项目 | 数值 |
| --- | --- |
| 帧间隔 median / p95 | 16.7ms / 16.7–16.8ms（60fps） |
| 每帧渲染耗时 median / p95 | 0.2ms / 0.5ms |
| 启动开屏构建耗时 | 16–60ms（鲸鱼轮廓点构建期内置） |
| 单文件浏览器半 | 约 360KB（含 8 套笔画数据 275KB） |

## 验收
- `_test/splash-check.mjs`（开发期，不随包发布）用 headless Edge 把新引擎和旧 `index.html` / `index-light.html` 在同一组时间点定格截图，逐像素比对；深色 Caveat、浅色 Hershey、中文楷体回退三种组合均 0 差异。
- `_test/handoff-check.mjs` 用仿 AppFrame（`overlay > .dshiw-mount > .dshiw-root`）按真实经过时间采样计算样式和包围盒：鲸鱼单调推近且中心不动、字标/副标题包围盒不变、整屏只淡出、主界面零动画零 transform-origin 写入；同时验证 inline 预览和 reduce 模式不缩放。帧间隔另测（无截图），`DSHIW_GPU=1` 可开 GPU 对照。
- `_test/boot-cover-check.mjs` 直接 import Host 半的 `apply` / `bootCoverRows` / `BOOT_COVER_STYLE` / `BOOT_COVER_SCRIPT`：先用假 ctx 验证 `apply` 监听 `webserver/index-inject` 并推入两行，再在无头 Edge 里模拟「boot 卡换成 AppFrame」，验证遮罩在 AppFrame 出现时立刻盖上、同色、层级低于开屏、`drop()` 后移除，以及缓存 `enabled:false` 时完全不遮。
