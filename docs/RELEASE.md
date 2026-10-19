# 发布清单

只列必做步骤。npm 与 GitHub 都是公开操作，确认后再执行。

## 发布前

```powershell
npm run build
npm run verify
node _test/client-check.mjs
node _test/handoff-check.mjs
node _test/boot-cover-check.mjs
npm pack --dry-run
```

- `npm pack --dry-run` 看一眼文件清单与体积；演示视频（`assets/demo.mp4`）不随包发布，只在仓库里。
- 确认文档不含个人姓名 / 邮箱 / 学校信息；`git log` 的作者信息在公开仓库里也会显示。

## npm

```powershell
npm login
npm publish --access public    # 包名未加 scope 时可省略 --access public
npm view dsh-ink-whale version
```

## GitHub

```powershell
git remote add origin https://github.com/<owner>/dsh-ink-whale.git
git push -u origin main
git tag v0.1.0
git push origin v0.1.0
```

- 仓库描述：DSH 手写墨迹开屏插件；topics：`deepseek-harness`、`dsh-plugin`、`splash-screen`。
- Release 正文贴 README 的「演示」段，附 `assets/demo.mp4` 链接。

## 发布后

- 换一台干净环境跑 `dsh plugin --profile desktop add dsh-ink-whale`，重启 DSH，确认开屏、设置页、首屏无闪现。
- 需要时再给 awesome-dsh-plugin 提 PR。
