# 英国记忆地图 v0.4 · 街道与作者云端保存

本包是已有 v0.3 项目的合并更新，不是把文件拖进 Cloudflare 就能完成后台配置的纯静态包。
代码已实现并通过本地测试；尚未替你在 Cloudflare 创建数据库、配置 Access、部署或完成线上验收。

## 先做哪一步

先合并并推送本包，让 Pages 同时部署网页与 Functions。部署完成后打开：

```text
https://iris.icewindwillow.cn/diagnostics.html
https://map-9yd.pages.dev/diagnostics.html
```

点击「测试一张街道图片」。这个测试只请求修道院附近一张实际地图图片，不扫描、不预下载英国地图。数据库未配置时，街道功能仍可单独测试。

随后完成 D1 和 Access 配置，再验收作者登录、云端草稿和发布。不要把诊断中的 `author.configured: true` 当作邮箱登录已经成功；它只表示必要变量格式齐全。

## 1. 合并更新并推送 Git

把解压文件夹中的内容合并到原仓库根目录。不要删除原目录，不要额外套一层发布包文件夹。

```text
map/
├── public/                     # 首页、地图、相册、作者页面静态文件
│   ├── index.html
│   ├── _headers
│   ├── _routes.json
│   ├── diagnostics.html
│   ├── author/index.html
│   ├── assets/*v0.4*
│   └── data/                   # 保留自己的 memories.json
├── functions/                  # 新增，必须在仓库根目录，不在 public 内
│   ├── api/
│   ├── author.js
│   └── author/[[path]].js
├── server/                     # Functions 依赖的服务端模块，不能放入 public
├── migrations/0001_reviews.sql
├── scripts/
├── tests-v04/                  # 本地测试，不是生产服务器
├── docs/
└── package.json
```

本包不包含 `public/data/memories.json`，不会覆盖你已有的故事。两张修道院照片和它的独立记录文件保持 v0.3 的内容；同名文件已被你自行修改时，合并前保留自己的版本。

Cloudflare Pages 保持原来的设置：

```text
生产分支：main（或你原来实际使用的分支）
构建命令：exit 0
构建输出目录：public
根目录：仓库根目录，通常留空
```

本版没有 npm 第三方运行依赖，不需要开启 Node.js compatibility flag。Pages 根据仓库根目录 `functions/` 生成接口。继续使用现有 Git 集成；Cloudflare 后台拖拽 Direct Upload 不支持这套 Functions 部署。[1]

新增文件后要一并 `git add` 和提交，否则只上传 public 会出现 FUNCTIONS_NOT_DEPLOYED。这里没有替你执行 git push。

## 2. 街道地图怎么工作

```text
浏览器 → 本站 /api/maps
浏览器 → 本站 /api/tiles/{z}/{x}/{y}.png
Pages Function → OpenStreetMap 标准地图图片
```

不再在访客浏览器里加载 MapLibre、外部 JS/CSS CDN、远程矢量字体或 WebGL。使用内置二维 Web Mercator 渲染器，街道来源仍是真实 OSM 地图，不是重新画出的示意道路。

手账总览的简化海岸线继续随网站提供，街道加载不成功时不清空原地图。支持拖动、滚轮、双指缩放、地图按钮；故事卡内「查看附近街道」会进入修道院周边的细节级别。

新版街道使用普通道路图，不承诺沿用纸张底图的全部矢量配色。先验证道路加载和坐标，再考虑更精细的底图设计。

### 使用边界

- 只允许固定的 OSM 图源和英国及周边坐标范围，不是通用 URL 代理。
- 只请求当前视口瓦片，保留可见的 © OpenStreetMap contributors 署名。
- 服务端发送项目标识、保留站点来源，尊重图源缓存和条件请求；不加随机参数绕缓存，不实现离线下载、批量抓图或预热全英国。
- OSM 公共瓦片没有可用性保证，可能限流。这个入口必须遵守 OSM 规则；流量明显增长时应改用获许可的商业服务或自建瓦片服务。[2]
- 同域接口减少了访客直接连接多个外部域名的依赖，但不保证所有中国网络永远可用。浏览器到网站、网站到图源任一环节仍可能失败，需线上实测。
- 地图本身是道路浏览，不是路线规划或实时导航；没有本轮之外的地点搜索服务。

`functions/api/tiles/[[path]].js` 不依赖数据库和作者登录。首次部署就能测试它，不必等后面配置全部完成。

## 3. 创建 D1 并初始化现有评价

在 Cloudflare 账户后台找到 D1（可在菜单搜索 D1），新建数据库。建议名字为 `uk-memory-map`，也可以使用你自己的名字。

打开这个数据库的 Console，执行 `migrations/0001_reviews.sql`。先执行建表，再执行插入语句；界面不支持一次多条时分别执行。它会建立 `author_reviews`，写入：

```text
id：fountains-abbey
署名：谢老师
星级：5.0
评论：破旧的修道院比完整的好看多了！
```

数据库里星级以 0～10 的整数保存半星数，所以 5 星存 10，4.5 星存 9；NULL 才表示未评分。0 星与未评分不同。

初始化使用 `CREATE TABLE IF NOT EXISTS` 和 `INSERT OR IGNORE`：重新执行不会覆盖已有云端评价。若你已在旧版改了修道院的正式评价，请先保留该评价，初始化后在作者后台更新，不能把默认原文误当成你最新的编辑。照片和经纬度仍来自原静态记录，旅行日期没有补写。SQL 保存时间不是旅行日期。

然后进入：

```text
Workers & Pages → map → Settings → Bindings → Add → D1 database
环境：Production
Variable name（绑定名）：DB
Database：刚创建的数据库
```

`DB` 必须完全一致，大写；数据库的展示名称则可以自定。保存绑定后重新部署项目，绑定才会进入新部署。[3]

不要把 Preview 预览分支随意绑定到正式数据库。确需预览后端时单独建测试 D1；默认只在 Production 配置。

完成后诊断里的 `database.bound`、`database.ready` 都应为 true，公开 `/api/reviews` 可读取原来的 5 星评价。

## 4. 作者登录：只保护作者路径，不锁住公开地图

### 先确认域名符合 Access 条件

建议作者后台固定使用：

```text
https://iris.icewindwillow.cn/author/
```

Cloudflare Access 的自托管公网应用需要账户中的活动域名，以及 Cloudflare 完整 DNS 接入或符合条件的 partial/CNAME 接入。[4]

**之前在腾讯设置一个指向 pages.dev 的 CNAME，并不自动证明已经具备 Access 的域名条件。**创建 Access 应用时，先看 Domain 下拉菜单能否选到对应活动域名。若选不到，先停在这一步确认域名状态；不要为了本版本盲目迁移主域名 NS、修改邮箱 DNS 或购买套餐。街道修复和 D1 配置可以先完成，作者接口在未配置时会拒绝写入。

若后续决定使用另一个你控制且已满足 Access 条件的域名，可以修改 `AUTHOR_ORIGIN`，但仍需让它指向同一个 Pages 项目，并同步配置 Access。不要把未知第三方域名填进去。未经额外配置，pages.dev 不是作者登录的替代入口。

### 创建 Access 应用

在 Zero Trust → Access controls → Applications 创建 Self-hosted 应用，添加公开主机名。可能看到 “Self-hosted and private”，再选择 “Add public hostname”；以实际界面字段为准。[4]

建议：

```text
应用名：英国地图作者后台
Subdomain：iris
Domain：icewindwillow.cn（前提是在活动域名列表里）
Path：author
```

检查最终受保护范围为 `/author` 以及它的子路径 `/author/`、`/author/api/session`、`/author/api/review`。不要把 Path 留空，否则会保护整个网站。路径规则可作用于同根子路径；不要另设更具体的 Bypass 规则覆盖作者 API。[5]

在应用里只开启 One-time PIN / 邮箱验证码这一登录方式，Allow 规则使用 **Emails / 完整邮箱地址**，仅放入你和朋友需要编辑的邮箱。不要使用 Everyone、任意邮箱、整个公共邮箱域名，也不要使用 Bypass。[6]

邮箱列表必须与你在下一节设置的 `AUTHOR_EMAILS` 一致。这里没有预填她的邮箱，也不会让访客自己注册成为作者。未经允许的邮箱不会因知道网址而有编辑权。

不需要额外创建 Cloudflare Tunnel：本站已经部署在 Pages；这一节使用的是 Access 身份验证和域名路径规则。

应用建立后记下 Application Audience (AUD) Tag，以及你的 Zero Trust 团队域名，用于下一步后端验证。

## 5. 设置生产环境的四个值

在 Pages 项目 map 的 Settings → Variables and Secrets（生产环境）填入：

| 名称 | 值 |
|---|---|
| `AUTHOR_ORIGIN` | `https://iris.icewindwillow.cn`，无 `/author/`、无查询参数 |
| `ACCESS_TEAM_DOMAIN` | `https://你的团队名.cloudflareaccess.com`，不是邮箱域名、不是 dash.cloudflare.com |
| `ACCESS_AUD` | 刚才这一个 Access 应用的 AUD Tag，不是应用名称 |
| `AUTHOR_EMAILS` | 授权作者的完整邮箱；多人用英文逗号分隔 |

不要把上面的中文占位词原样填进去。邮箱名单建议作为 Secret 设置，避免提交到公开 Git 仓库；这些值均在后端读取，不写入网页。不要把 Cloudflare API Token、SSH 私钥或邮箱验证码发送到聊天里。

保存后重新部署一次。Functions 会在每次作者请求上验证 Access JWT 的签名、签发方、目标应用、过期时间和邮箱，再允许读私有草稿或写记录；不是只看浏览器按钮是否可见。[7]

写入还要求同源请求及会话绑定校验值。`pages.dev` 上的作者页面会引导到指定作者域名，它自己的作者写接口拒绝写入。两个公开域名仍能读取同一正式数据库里的已发布评价。

默认 Access Cookie/登录流程即可，不要配置跨域匿名 CORS 放行规则。若你有已有缓存、Worker 转发或 Access 策略，检查它们没有覆盖这些路径。

## 6. 缓存规则与诊断

版本化的 v0.4 CSS/JS 保留，避免旧样式混用。HTML 不使用长期缓存；公开评价和私有接口由 Function 返回 `no-store`。`_headers` 只负责静态文件，Functions 的响应头已在服务端单独设置。[8]

如果你的域名额外配置了 Cache Everything / 自定义反向代理缓存，请将这些路径排除：

```text
/author
/author/*
/api/reviews
/api/health
/api/maps
```

不要给 `/api/tiles/*` 加随机 query 参数或强制 no-cache；让它遵守地图图源返回的缓存期限。不要给整个 `/api/*` 套 HTML 重定向规则。

常见结果：

| 现象/代码 | 说明与下一步 |
|---|---|
| `FUNCTIONS_NOT_DEPLOYED`，或者接口返回首页 HTML | 先检查 functions 是否在仓库根目录并被提交、部署日志是否编译 Functions |
| `MAP_UPSTREAM_UNREACHABLE` / `TILE_TIMEOUT` | 图源链路失败或超时；保留总览，诊断中测试一张图，查看 Functions 日志 |
| `MAP_RATE_LIMITED` | 图源限流，稍后重试，不要自动频繁刷新 |
| `MAP_REFERER_REQUIRED` | 缺少来源；必须从本站页面请求，检查是否有扩展/转发去掉 Referer |
| `database.bound: false` | 未给 Production 绑定 DB，或添加后尚未重新部署 |
| 数据库已绑定但未 ready | 数据表/初始化记录缺失，或 D1 暂不可用；执行迁移并看具体 code |
| `AUTHOR_CONFIG_REQUIRED` / `ACCESS_CONFIG_REQUIRED` | 四个变量尚未填齐，或格式错误 |
| 登录后依然 `LOGIN_REQUIRED` | 检查作者路径是否由 Access 保护、团队域名、AUD、会话有效期 |
| `NOT_AN_AUTHOR` | 令牌有效，但该完整邮箱不在后端名单里 |
| `AUTHOR_ORIGIN_ONLY` | 当前域名不是配置的唯一作者后台域名 |
| `REVISION_CONFLICT` / HTTP 409 | 其他标签页已保存。保留当前输入，备份后读取最新记录再决定修改 |
| 云端保存超时 | 结果未知，不等于成功，也不一定失败。先备份文字，再读取云端核对 |

`/api/health` 只返回配置状态，不输出邮箱、Access AUD、令牌或草稿正文。诊断页可复制安全检查结果；截图也可以。

## 7. 这轮的验收标准

**街道：** 在两个域名分别打开修道院，点击「查看附近街道」，看到真实道路/建筑/地名。拖动、缩放后标记应保持坐标；来源署名始终可见；切回手账仍能正常看照片。一次图片测试成功只说明当前一次请求成功，不能替代实际页面测试或代表所有网络。

**登录：** 匿名访问公开地图不要求登录；匿名进入作者路径先经过 Access。名单内邮箱能登录，其他邮箱不能编辑。也检查备用 pages.dev 和预览域名，不能绕过写入限制。

**保存：** 作者把星级改成 4.5，写一段测试文字，点击保存云端草稿；另一设备以作者身份打开能读到草稿，而匿名窗口仍看到原评价。随后点击发布，独立未登录设备重新打开公开地图能看到已发布改动。测试后恢复真实原评论和 5 星，避免把测试内容当成旅行记录。

**边界：** 0 星、半星、未评分不同；发布前有确认；网络失败不显示虚假的“保存成功”；两个标签页的旧版本不能无提示覆盖新版本。照片和旅行日期不因评价保存而改变。

本轮不包含新建地点、上传新照片、账户自行注册、多人公共打分、通用博客后台、修改所有地图记录。这一轮只接现有修道院记录的作者评价云端读写。

## 8. 本地测试及限制

代码检查使用 Node.js 22.13+（测试使用内置 node:sqlite）；生产 Functions 本身只使用 Workers Web APIs 和 D1，不需要 Node SQLite。

```sh
npm run check
```

静态视觉预览：

```sh
npm run dev
```

`npm run dev` 只服务 public；它不会模拟 Cloudflare Access、真实 D1 或地图接口。不能用这个命令证明云端功能已接通。

本次提交前已通过 51 项 Node 测试，以及 7 组离线浏览器检查。后者使用真实页面代码、本地签名测试 JWT、SQLite 适配器、明确写有 TEST TILE 的测试图片，不是生产登录、真实 D1 或在线 OSM 验收。浏览器测试环境禁止导航，采用离线页面注入和 loopback 接口桥接。没有绕开运行环境限制。

`tests-v04/browser-server.mjs` 是仅绑定 127.0.0.1 的测试夹具，不是生产后端；测试登录 Cookie 只在该文件里生效。不要把它放进 public/functions，不要拿它对外提供服务。生产代码没有模拟登录或无密码直通开关。

没有在本环境完成：实际 OSM 瓦片成功加载、腾讯 DNS/Cloudflare Access 域名配置、邮箱收码、Cloudflare D1 实例运行、Git 推送或线上部署。本包附有本地结果；线上验收需要按第 7 节执行。

## 9. 保留数据与回退

包内不删除旧版本资源，不自动覆盖 memories.json，不在部署时重置数据库。云端评价成为当前修道院评分/评论的来源；新增评价不需要推送 Git。原静态评价仅作为接口不可用时的后备副本，页面会提示“云端未连接”。这时看到的旧评价不能当作最新云端内容。

原有公开 JSON 的副本不会因云端编辑被自动改写。因此，这版适合公开的旅行短评；从网上彻底移除原公开内容还需另行清理 Git 历史/静态副本，不是单击发布就能完成。

回退网页版本不会清空 D1，但旧版不会自动展示后来保存在 D1 的内容。回退前备份新评价；不要删除 D1 来“重试部署”。

## 官方依据（核对日期：2026-09-21）

[1] Cloudflare Pages Functions 根目录与部署：
https://developers.cloudflare.com/pages/functions/get-started/

[2] OpenStreetMap 标准瓦片使用规则（署名、标识、缓存、无批量离线使用及无可用性承诺）：
https://operations.osmfoundation.org/policies/tiles/

[3] Pages Functions D1 绑定，保存后重新部署：
https://developers.cloudflare.com/pages/functions/bindings/

[4] Cloudflare Access 自托管应用与域名前提：
https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/

[5] Access 路径保护与继承：
https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/

[6] Access 邮箱一次性验证码：
https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/

[7] 服务端验证 Access JWT：
https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/

[8] Pages 静态 _headers 与 Functions 的区分：
https://developers.cloudflare.com/pages/configuration/headers/
