# 字体

8 套内置手写体（插件配置字段 `font`），数据来自 [tegaki](https://tegaki.ink/)（MIT）的字体包；`src/tools/mkfontdata.mjs` 从 `glyphData.json` 抽出「字符 → 笔画骨架 + 笔宽」，压成 `src/data/strokefonts.json`（275KB），构建时内嵌进 `client.js`。

> 这些笔画数据是**格式转换后的派生数据**（OFL 定义为 Modified Version），必须按各字体原许可分发：版权行、Hershey 致谢与许可全文见 [../LICENSES/FONTS-ATTRIBUTION.md](../LICENSES/FONTS-ATTRIBUTION.md)。

| 配置值 | 名称 | 风格 | 许可 |
| --- | --- | --- | --- |
| `caveat` | Caveat | 随性手写（默认） | SIL OFL 1.1 |
| `tangerine` | Tangerine | 优雅花体 | SIL OFL 1.1 |
| `italianno` | Italianno | 正式花体 | SIL OFL 1.1 |
| `parisienne` | Parisienne | 法式花体 | SIL OFL 1.1 |
| `ems-allure` | Allure | 单线连笔 | SIL OFL 1.1 |
| `hershey-script` | Hershey | 经典连笔 | Hershey 自有条款 |
| `nanum-pen-script` | Nanum Pen | 手写印刷体 | SIL OFL 1.1 |
| `klee-one` | Klee One | 日系手写 | SIL OFL 1.1 |

覆盖：拉丁 ASCII 全部可写；`·` 只有 Allure / Hershey 有（其它字体自动借字）；中文等无笔画数据的字符用系统楷体 + 扫入回退。

## 增加字体
1. 装 tegaki：`npm i tegaki`（或直接取它的 `fonts/` 目录），把 `dir`/`label` 加进 `src/tools/mkfontdata.mjs` 的 `pick` 列表；
2. `node src/tools/mkfontdata.mjs [tegaki/fonts 路径]` 重新生成 `src/data/strokefonts.json`；
3. 在 `index.js` 的 `FONT_KEYS` 里加 key，`npm run build` 重建 `client.js` —— 设置页的字体 chip 会自动多一个。

鲸鱼轮廓点若需重采样：`node src/tools/gen-whalepoints.mjs`（读 `src/data/assets.json`，需要本机 Chrome/Edge）。

## 主题取色
浅色主题全部取 DeepSeek 官方 token（见 [NOTICE.md](../NOTICE.md)）：主蓝 `#3964fe`、浅主蓝 `#5686fe`/`#679efe`/`#b7c8fe`/`#edf3fe`、深墨 `#283142`、文字 `#3c3c43`、次级 `#7f8287`/`#a2a4a6`、描边 `#e5e5e5`/`#ededed`、底 `#fff`/`#fafafa`。主题对象在 `src/engine.js` 的 `DSHIW_THEMES`，改色只需改这张表。
