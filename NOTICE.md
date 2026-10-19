# 来源与许可（NOTICE）

本项目是**非官方**的个人项目，与 DeepSeek（杭州深度求索）及其关联方**无任何关联，未获其授权或背书**。

## 一、文件与许可对照

| 路径 | 内容 | 许可 |
| --- | --- | --- |
| `index.js`、`src/engine.js`、`src/client.template.js`、`src/build-plugin.mjs`、`cordis.patch.yml`、`locale/**`、`icon.svg`、文档 | 本项目代码与原创图标 | MIT（[LICENSE](LICENSE)） |
| `client.js`（构建产物） | 上述代码 + 内嵌的笔画数据与官方 logo 路径 | MIT + OFL/Hershey + DeepSeek 素材（见下两行） |
| `src/data/strokefonts.json`（及 `client.js` 内嵌的同一份） | 从 OFL / Hershey 字体**转换格式得到的笔画数据** | 7 套 SIL OFL 1.1、Hershey Script 自有条款 → [LICENSES/FONTS-ATTRIBUTION.md](LICENSES/FONTS-ATTRIBUTION.md) |
| `src/data/whale.svg`、`wordmark.svg`、`whalepoints.json`、`assets.json` 里的 logo 路径（及 `client.js` 内嵌的同一份） | DeepSeek 官方 logo / 字标路径 | **版权与商标归 DeepSeek 所有，未获授权**（见第二节） |
| 浅色主题色值 | DeepSeek 官网 CSS 变量里的色码 | 色码属事实信息，不受版权保护 |
| `src/template.html`、`src/build.mjs`、`index.html`、`index-light.html`、`classic.html` | 旧版独立演示页（保留，不参与插件运行） | 同本项目 MIT + 内嵌数据/素材 |

`client.js` 是插件的浏览器半，也是上述内容的打包（代码 MIT + 内嵌字体派生数据 OFL/Hershey + 内嵌官方 logo 路径）；npm 包随附 `LICENSES/` 目录，**满足字体的随附要求**。

## 二、DeepSeek 官方素材（唯一有权利风险的部分）

| 素材 | 出处 | 核查结果 |
| --- | --- | --- |
| 鲸鱼 mark 路径 | `api-docs.deepseek.com/img/logo-mark-light.svg`（浅底 `#3c3c43`）、`logo-mark-dark.svg`（深底 `#dfdfd6`） | 文件内**无任何版权/许可声明** |
| `deepseek` 字标路径 | `fe-static.deepseek.com/chat/static/web-logo.svg`（`#3964FE`） | 同上，无声明 |
| 品牌色令牌 | `www.deepseek.com` 的 CSS 变量 | 色码为事实信息 |

- DeepSeek 未公开面向第三方的 logo / 商标使用许可或品牌规范（已查官网与 [GitHub 组织](https://github.com/deepseek-ai)；DSH 安装包内的 `welcome-brand.svg` 也没有授权说明）。这些矢量路径因此属于**无授权再发布**——上传 GitHub 不会被平台拦（平台不做许可审核），但权利人可主张权利。
- 使用限制（务必遵守）：① 不得冒充官方、暗示背书或用于商业宣传；② 不要拿官方 logo 当本仓库的头像/组织标识；③ 仓库名与描述保持描述性用法，不要以 "DeepSeek" 打头。
- 想要**零第三方素材**的版本：把 `src/data/whale.svg` 等换成自己的图形，页面代码不用改。

## 三、手写字体
见 [LICENSES/FONTS-ATTRIBUTION.md](LICENSES/FONTS-ATTRIBUTION.md)：笔画数据取自 [tegaki](https://tegaki.ink/)（MIT）的字体包，字体本身 7 套 SIL OFL 1.1、1 套 Hershey 自有条款。tegaki 仅在开发期用于导出数据（`src/tools/mkfontdata.mjs`），页面运行时不引用它。

> 以上为依据许可证原文与素材核查得出的工程判断，不构成法律意见。