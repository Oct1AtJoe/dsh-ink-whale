# dsh-ink-whale · 墨鲸开屏

[![npm](https://img.shields.io/npm/v/dsh-ink-whale)](https://www.npmjs.com/package/dsh-ink-whale)
[![license](https://img.shields.io/npm/l/dsh-ink-whale)](LICENSE)
[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/w-j-y-wjy/dsh-ink-whale)
DeepSeek Harness（DSH）开屏插件：启动时按**真实笔顺**写出你的文字，最后收在鲸鱼锁标与副标题上，再让鲸鱼缓慢推近、整屏淡出，主界面顺势露出来。字体、文字、深浅色都在「设置 → 内置插件 → 开屏」里配置。

## 演示

![墨鲸开屏：从首笔写到鲸鱼推近、主界面浮出](https://raw.githubusercontent.com/w-j-y-wjy/dsh-ink-whale/main/assets/demo.gif)

[▶ 高清 MP4（1280×826，620 KB）](https://github.com/w-j-y-wjy/dsh-ink-whale/blob/main/assets/demo.mp4) · 浅色主题，15 秒完整流程

![设置页：内嵌预览、文字、字体、深浅](https://raw.githubusercontent.com/w-j-y-wjy/dsh-ink-whale/main/assets/plugin-settings.png)

更多截图见 [docs/DEMO.md](docs/DEMO.md)。

## 安装

npm 发布后：

```powershell
dsh plugin --profile desktop add dsh-ink-whale
```

或在 DSH 的「插件」页安装。改 Host 半或升级插件后重启 dsh；只改浏览器半刷新页面即可。本地源码：`pnpm install` → `npm run build`，再让插件管理器从本目录安装。

## 使用

- 每次页面加载播放一次，点击或按任意键跳过；系统开启「减少动态效果」时直接呈现终帧。
- **设置 → 内置插件 → 开屏**：内嵌 16:9 预览、称呼 / 问候语 / 副标题、8 套手写体、深浅色、启动开关。
- 配置写进 profile 的 Cordis patch，重启后保留；Host 设置不可用时退回本机 localStorage。

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `enabled` | `true` | 启动时播放开屏 |
| `font` | `caveat` | `caveat` / `tangerine` / `italianno` / `parisienne` / `ems-allure` / `hershey-script` / `nanum-pen-script` / `klee-one` |
| `name` | `DeepSeek` | 写出来的称呼 |
| `greeting` | `{name}` | 问候语模板，`{name}` 替换为称呼 |
| `caption` | `探索未至之境` | 鲸鱼锁标下方的副标题，留空则不显示 |
| `theme` | `auto` | `auto` 跟随 DSH 主题，或 `dark` / `light` |

也可以直接改 profile 的 `cordis.patch.yml`：

```yaml
- id: ink-whale
  config:
    font: tangerine
    name: Deepseek
    greeting: Welcome to {name}
    caption: 探索未至之境
    theme: auto
    enabled: true
```

## 构建与验收

```powershell
npm run build              # src/engine.js + 内嵌数据 → client.js
npm run build:standalone   # 旧的独立演示页 index.html / index-light.html
npm run verify             # 清单、产物、locale、icon、许可文件检查
node _test/handoff-check.mjs     # 开发期：鲸鱼推近 / 整屏淡出 / 帧间隔
node _test/boot-cover-check.mjs  # 开发期：首屏遮罩（主界面不闪）
```

交接时长、缓动与可选模糊只在 `src/engine.js` 顶部改：`DSHIW_HANDOFF_MS`、`DSHIW_HANDOFF_EASE`、`DSHIW_HANDOFF_BLUR`；首屏遮罩在 `index.js` 里，细节见 [docs/TIMELINE.md](docs/TIMELINE.md)。

## 许可

代码 MIT © [w-j-y-wjy](https://github.com/w-j-y-wjy)（[LICENSE](LICENSE)）。8 套笔画数据为 7×SIL OFL 1.1 + Hershey 条款（[LICENSES/](LICENSES/FONTS-ATTRIBUTION.md)）。DeepSeek 鲸鱼 / 字标路径版权归 DeepSeek，**未获授权**；本项目是非官方个人项目，使用限制见 [NOTICE.md](NOTICE.md)。

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)


