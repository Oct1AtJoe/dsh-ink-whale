# 字体版权与许可声明（Font Attribution）

本项目的 `src/data/strokefonts.json`（以及构建产物 `client.js`、`index.html` / `index-light.html` 内嵌的同一份数据）是从下列字体**转换格式得到的派生数据（笔画骨架 + 笔宽）**，不是原字体文件。按 OFL 1.1 的定义，格式转换属于 "Modified Version"，因此**这部分数据必须按下面各自的许可分发**（OFL 第 5 条：不得改为其它许可），不能纳入本项目的 MIT 许可。

字体本身来自 [tegaki](https://tegaki.ink/)（MIT）的预生成字体包；笔画数据的版权仍归各字体作者。

## SIL Open Font License, Version 1.1 字体（7 套）
许可全文见 [OFL-1.1.txt](OFL-1.1.txt)。上述 7 个字体在来源声明中**均未声明 Reserved Font Name**（另核对 Caveat 上游 [OFL.txt](https://github.com/googlefonts/caveat/blob/main/OFL.txt)，同样没有）。

| 数据键 | 字体名 | 设计者 | 版权声明 |
| --- | --- | --- | --- |
| `caveat` | Caveat | Impallari Type | Copyright 2014 The Caveat Project Authors (https://github.com/googlefonts/caveat) |
| `tangerine` | Tangerine | Toshi Omagari | Copyright (c) 2010 by Toshi Omagari |
| `italianno` | Italianno | Robert Leuschke | Copyright 2009 The Italianno Project Authors (https://github.com/googlefonts/italianno) |
| `parisienne` | Parisienne | Brian J. Bonislawsky (Astigmatic) | Copyright (c) 2012 by Brian J. Bonislawsky DBA Astigmatic (AOETI) |
| `ems-allure` | EMS Allure（Allura 的单线派生） | Sheldon B. Michaels；SVG 转换 Windell H. Oskay | Copyright 2010 The Allura Project Authors (https://github.com/googlefonts/allura); single-line version by Sheldon B. Michaels |
| `nanum-pen-script` | Nanum Pen Script | Sandoll Communications Inc. for NHN Corporation | Copyright © 2010 NHN Corporation. All rights reserved. Font designed by Sandoll Communications Inc. |
| `klee-one` | Klee One | Fontworks Inc. | Copyright 2020 The Klee Project Authors (https://github.com/fontworks-fonts/Klee) |

## Hershey Script 1-stroke（`hershey-script`）
**不属于 OFL**。Hershey 字体可被任何人用于任何目的，条件是随字体数据分发以下致谢：

- The Hershey Fonts were originally created by Dr. A. V. Hershey while working at the U. S. National Bureau of Standards.
- The format of the Font data in this distribution was originally created by James Hurt, Cognition, Inc., 900 Technology Park Drive, Billerica, MA 01821.
- This version was prepared in 2011 and converted to SVG fonts in 2019 by Windell H. Oskay (www.evilmadscientist.com), adapted from emergent.unpythonic.net/software/hershey by way of "Hershey Fonts in SVG" by Marty McGuire.

字体数据可转换成任何其它格式，**唯独不能**转成美国 NTIS 分发的格式（每点八字节写作 `xxx yyy:`）。

## 本项目的义务（已满足）
1. 随附 OFL 1.1 全文与各字体版权声明（本文件 + [OFL-1.1.txt](OFL-1.1.txt)）——OFL 第 2 条；
2. 字体派生数据保持 OFL/Hershey 条款，未改为其它许可——OFL 第 5 条；
3. 未以任何字体作者或版权持有者的名义为本项目背书、宣传——OFL 第 4 条；
4. 未单独售卖字体数据——OFL 第 1 条。