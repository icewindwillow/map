# 英国 · 记忆地图 — 网页底座 v0.1

目标仓库：`git@github.com:icewindwillow/map.git`

**状态：仅为独立的初始代码包；尚未提交 GitHub，尚未创建或连接 Cloudflare 项目。**
这份代码不代表自动部署已经验证成功。需要先完成首次提交和一次 GitHub → Cloudflare 授权。

## 本版范围

已实现：响应式首页、礼物介绍弹窗、空地图区域、JSON 数据读取、地点/故事计数、基础文字故事卡片、加载失败重试、404 页面。

暂未实现：真实地图、地图标记和缩放、时间轴、照片展示与上传、在线编辑、数据库、账号与访问控制。没有虚构朋友的经历。

技术：HTML + CSS + 原生 JavaScript。无第三方依赖、无打包步骤，不需要地图密钥。

## 本地预览

安装 Node.js 20 或更高版本后，在此目录执行：

```sh
npm run dev
```

浏览器访问 `http://127.0.0.1:8788`。退出预览使用 Ctrl+C。
不需要 `npm install`；没有需要安装的依赖。

```sh
npm run check
```

这是底座文件检查，不等价于线上部署测试。不要直接双击 `public/index.html` 验证 JSON 读取；本地 `file://` 访问与 HTTP 网站不同。
另附的 `map-preview.html` 是可双击打开的单文件外观预览；它不属于仓库部署内容，不应替代 `public/`。

## 第一次提交到现有仓库

先把远端仓库克隆到你自己的电脑：

```sh
git clone git@github.com:icewindwillow/map.git
cd map
```

将本代码包 `map-starter/` **里面的文件与文件夹**放到刚克隆的 `map/` 根目录，而不是再套一层 `map-starter/`。保留原有 `.git/`。
本代码包不包含 `.git/`，也不包含任何密钥。若仓库此时已有内容，请先比较后合并，不要覆盖已有业务代码。

确认 `git status` 只包含本次需要提交的文件，再执行：

```sh
git add public scripts tests package.json README.md .gitignore
git diff --cached --stat
git commit -m "chore: initialize memory map website"
# 首次空仓库提交才使用下行；已有项目保留实际的生产分支名。
git branch -M main
git push -u origin main
```

如果在首次提交时 Git 提示未配置姓名/邮箱，请在自己的电脑上完成 Git 身份配置后重试；不要把访问令牌或 SSH 私钥发送到聊天中。

## Cloudflare Pages：连接 Git 自动部署

本方案保留你之前的 Git 推送 → 网站更新流程，不用拖拽上传创建项目。

Cloudflare 控制台 → Workers & Pages → Create application → Pages → Connect to Git / Import an existing Git repository。
登录并授权 GitHub，选择 `icewindwillow/map`。授权界面支持按仓库选择时，仅授权 `map` 即可。
如果之前已经连接过 GitHub，但新仓库没出现，检查 Cloudflare GitHub App 的仓库授权范围。

| 设置 | 填写 |
|---|---|
| Project name | `uk-memory-map`（名称若占用，换一个未使用的名字） |
| Production branch | `main`（或实际提交代码的生产分支） |
| Framework preset | `None` |
| Build command | `exit 0` |
| Build output directory | `public` |
| Root directory | 留空，即仓库根目录 |
| Environment variables | 本版不需要 |

选择 Save and Deploy。以控制台最终显示的 `*.pages.dev` 地址为准，不能预先假定地址已经创建。
空仓库必须至少有一次提交和一个已推送的分支，否则没有生产分支可选。

**连通验收**：页面正常打开、故事和地点计数都是 `00`、介绍弹窗正常、修改一处首页文字并推送生产分支后，Cloudflare 出现对应的新部署，网页文字随之更新。只有最后一步完成，才能确认自动部署链路接通。

## 本次检查记录

- 6 项基础文件检查通过。
- 本地 HTTP 服务：首页、CSS、JS、JSON、404 与响应头检查通过。
- 浏览器离线渲染：320 / 375 / 390 / 640 / 768 / 1024 / 1365 像素宽度无横向溢出；弹窗、计数、异常重试和正文转义检查通过。
- 当前执行环境阻止浏览器直接导航到本地 HTTP 地址，因此浏览器布局/交互使用内存中的页面内容测试，HTTP 服务另行测试；这不是 Cloudflare 线上测试。
- GitHub 提交、Cloudflare 授权、首次部署与自动更新：均未执行。

## 文件结构

```text
public/                  ← Cloudflare 发布这一整个目录
  index.html             ← 首页
  404.html               ← 未找到页面
  _headers               ← 响应头与缓存配置
  robots.txt             ← 请求搜索引擎不收录
  assets/
    style.css
    app.js
    favicon.svg
  data/
    memories.json        ← 空的故事数据入口
scripts/serve.mjs        ← 仅供本地预览，不部署为后端
tests/starter.test.mjs   ← 基础文件检查
package.json
README.md
.gitignore
```

## 下一阶段的数据入口

修改 `public/data/memories.json`。当前为空：

```json
{
  "schemaVersion": 1,
  "memories": []
}
```

每条文字故事字段：`id`（唯一非空字符串）、`title`（非空字符串）、`place`（地点文字）、`date`（日期文字）、`description`（正文）。目前后三项可省略，提供时必须是字符串。后续接真实地图时再确定坐标、照片和分类字段，不提前锁定地图服务商。

正文通过 `textContent` 写入页面，不解析 HTML。当前地点数是去除两端空格后的 `place` 文字去重数，不代表地理坐标去重。

## 隐私与边界

此底座没有任何朋友的真实经历、照片或凭据。首次查看时目标 GitHub 仓库显示为公开仓库。
发布真实资料前，请先和朋友确认公开范围。`noindex`、`robots.txt` 以及页面不显示链接**不是密码保护或访问控制**；静态资源也可能被知道地址的人直接访问。若需要私密分享，应先设计并验证服务端访问控制，且不要把私人资料提交到公开仓库。

没有接入第三方字体、统计、地图瓦片或外部图片。本版 `_headers` 的内容安全策略仅允许同源资源；接地图后要按所选地图服务的实际需要调整 `img-src`、`connect-src` 等，不能简单关闭所有限制。

## 配置依据（2026-09-21 核对）

- Cloudflare Pages Git integration：自动部署、至少一个分支、生产分支与构建设置。
  `https://developers.cloudflare.com/pages/get-started/git-integration/`
- Cloudflare Pages Static HTML：纯静态页面、`exit 0` 与发布目录。
  `https://developers.cloudflare.com/pages/framework-guides/deploy-anything/`
- Cloudflare Pages GitHub integration：GitHub App 仓库授权范围。
  `https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/`
- Cloudflare Pages Headers：静态目录内的 `_headers`。
  `https://developers.cloudflare.com/pages/configuration/headers/`
