# 前端打包与 Linux Nginx 部署操作说明

适用于当前 `rigour-supply-chain-portal` 项目，以及已安装并运行 Nginx 的这台 Linux 服务器。服务器操作由你手动执行。

| 项目 | 当前约定 |
| --- | --- |
| 本地项目 | `/Users/guorongrong/IdeaProjects/瑞盖/rigour-supply-chain-portal` |
| 发布代码分支 | `dev` |
| 浏览器入口 | `http://8.140.247.79:5100` |
| Linux 登录账号 | `root`，需要该服务器对应的密码或 SSH 密钥 |
| Nginx 程序 | `/usr/local/nginx/sbin/nginx` |
| Nginx 主配置 | `/usr/local/nginx/conf/nginx.conf` |
| 本前端的站点配置 | `/usr/local/nginx/conf/rigour-portal.conf` |
| 服务器网站目录 | `/var/www/rigour-portal` |
| Gateway / IAM | 同一台服务器的 `127.0.0.1:26880` / `127.0.0.1:26881` |

“Mac 终端”指 VS Code 中本机的终端；“Linux 终端”指 SSH 登录服务器后的终端。只复制代码块内的命令，不要复制终端提示符或把文件名列表当作命令。

前端部署的是 `dist/` 内的静态文件，没有需要单独启动的 Java 进程。Linux 上不需要安装 pnpm，也不需要运行 `pnpm dev`。本说明沿用指定的 HTTP 入口；正式长期使用应配置 HTTPS，并同步调整回调地址和重新构建。

**1．确认本机工具（Mac，只在首次使用或报命令不存在时处理）**

```bash
node --version
pnpm --version
```

当前项目使用 `pnpm@11.9.0`，该版本需要 Node.js 至少 22.13。若只有 pnpm 不存在，执行：

```bash
npm install --global pnpm@11.9.0
```

安装后若仍找不到 pnpm，关闭 VS Code 终端并新建终端，再检查版本。若连 `node`、`npm` 都不存在，先安装符合版本要求的 Node.js。

**2．检查本地状态（Mac，每次发布前）**

```bash
cd /Users/guorongrong/IdeaProjects/瑞盖/rigour-supply-chain-portal
git status --short --branch
```

确认需要一起打包的本地改动。构建会包含当前工作目录中的代码，不仅包含 Git 已提交的代码。若切分支或拉取时提示冲突、非快进，先处理提示，不要继续上传旧包，也不要用 `reset --hard` 清理工作。

**3．拉取 dev、构建并生成上传包（Mac，每次发布执行）**

整段执行；其中任一步失败会停止后续步骤。不要把本次 HTTP 部署脚本替换成普通 `pnpm build`。

```bash
(
  set -e
  cd /Users/guorongrong/IdeaProjects/瑞盖/rigour-supply-chain-portal
  git switch dev
  git pull --ff-only origin dev
  pnpm install --frozen-lockfile
  bash deploy/linux-http/build.sh
  mkdir -p outputs
  COPYFILE_DISABLE=1 tar -czf outputs/rigour-portal.tar.gz \
    dist -C deploy/linux-http nginx.conf README.md
  ls -lh outputs/rigour-portal.tar.gz
)
```

本次统一使用固定包名：`outputs/rigour-portal.tar.gz`，每次成功打包覆盖这个文件。包内包含 `dist/`、`nginx.conf`、`README.md`；不要与旧的“解压后根目录直接是 index.html”的纯网页包混用。本流程不生成 `release.json` 或 `SHA256SUMS`。

看到构建成功并输出压缩包信息，才进入上传步骤。黄色的 chunk 体积提示本身不代表构建失败；类型检查或构建报错需要先解决。

构建脚本已固定以下公开配置，日常发布不用手动修改环境文件：

| 配置 | 当前值 |
| --- | --- |
| API 前缀 | `/api/v1` |
| IAM issuer | `http://127.0.0.1:26881` |
| 客户端 ID | `rigour-scdp-browser` |
| 登录回调 | `http://8.140.247.79:5100/oidc/callback` |

脚本执行类型检查和 `vite build --mode desktop`，保留 PKCE 和签名校验。浏览器通过本站点的 `/api/`、`/auth/` 请求后端；issuer 不是让浏览器访问自己电脑的地址。构建变量写入产物，入口或回调地址改变时需要重新构建。[Vite 环境变量说明](https://vite.dev/guide/env-and-mode.html)

**4．上传并登录（Mac，每次发布执行）**

先上传，等到上传成功后再登录：

```bash
scp "/Users/guorongrong/IdeaProjects/瑞盖/rigour-supply-chain-portal/outputs/rigour-portal.tar.gz" root@8.140.247.79:/tmp/rigour-portal.tar.gz
```

```bash
ssh root@8.140.247.79
```

`root` 是本次 Linux 账号，不是 Mac 的用户名。`Permission denied (publickey,...,password)` 是 SSH 身份验证问题，需要检查 Linux 账号、密码或密钥，不是前端构建问题。输入密码时终端不显示字符是正常现象。

**5．备份、解压并更新前端（Linux，每次发布执行）**

下面这段只更新网站文件并备份现有配置，不覆盖服务器上已有的站点配置。会先复制资源，再替换首页，保留旧版本带哈希的资源，减少已打开页面更新时出现资源 404 的情况。它不是整个网站目录的原子切换。

首次部署也执行这一步，再执行第 6 步。每次生成的备份目录会打印出来，请保留路径。

```bash
(
  set -e
  deploy_dir=$(mktemp -d /tmp/rigour-portal.XXXXXX)
  tar -xzf /tmp/rigour-portal.tar.gz -C "$deploy_dir"
  test -f "$deploy_dir/dist/index.html"
  test -d "$deploy_dir/dist/assets"
  test -f "$deploy_dir/nginx.conf"

  mkdir -p /var/backups
  backup_dir=$(mktemp -d "/var/backups/rigour-portal-$(date +%Y%m%d-%H%M%S).XXXXXX")
  cp -p /usr/local/nginx/conf/nginx.conf "$backup_dir/nginx.conf"
  if [ -f /usr/local/nginx/conf/rigour-portal.conf ]; then
    cp -p /usr/local/nginx/conf/rigour-portal.conf "$backup_dir/rigour-portal.conf"
  fi
  if [ -d /var/www/rigour-portal ]; then
    tar -czf "$backup_dir/web.tar.gz" -C /var/www/rigour-portal .
  fi
  printf '本次备份目录：%s\n' "$backup_dir"

  mkdir -p /var/www/rigour-portal
  mv "$deploy_dir/dist/index.html" "$deploy_dir/index.html"
  cp -a "$deploy_dir/dist/." /var/www/rigour-portal/
  chmod -R a+rX /var/www/rigour-portal
  install -m 644 "$deploy_dir/index.html" /var/www/rigour-portal/.index.html.new
  mv -f /var/www/rigour-portal/.index.html.new /var/www/rigour-portal/index.html

  if [ ! -f /usr/local/nginx/conf/rigour-portal.conf ]; then
    cp "$deploy_dir/nginx.conf" /usr/local/nginx/conf/rigour-portal.conf
  fi
  printf '网站文件已更新，解压目录：%s\n' "$deploy_dir"
)
```

服务器根目录中应直接存在 `/var/www/rigour-portal/index.html` 和 `/var/www/rigour-portal/assets/`。不要复制成 `/var/www/rigour-portal/dist/index.html`。压缩包里的 `nginx.conf` 是单个站点配置，不能直接覆盖 Nginx 主配置。

**6．首次接入或恢复 5100 站点（Linux）**

当前服务器之前已经成功加载过该站点。如果一直启用，日常更新跳过本步骤。若按本文第 9 步停用过，也用下面这段恢复。它会备份主配置，取消本站点 include 的注释，或在缺少该行时加到 `http {}` 中；配置检查失败则恢复这次修改前的主配置。

```bash
(
  set -e
  main_conf=/usr/local/nginx/conf/nginx.conf
  test -f /usr/local/nginx/conf/rigour-portal.conf
  conf_backup=$(mktemp "${main_conf}.before-enable.XXXXXX")
  cp -p "$main_conf" "$conf_backup"

  sed -i 's@^[[:space:]]*#[[:space:]]*include[[:space:]]*/usr/local/nginx/conf/rigour-portal\.conf;@    include /usr/local/nginx/conf/rigour-portal.conf;@' "$main_conf"
  if ! grep -qE '^[[:space:]]*include[[:space:]]+/usr/local/nginx/conf/rigour-portal\.conf;' "$main_conf"; then
    if ! grep -qE '^[[:space:]]*http[[:space:]]*\{' "$main_conf"; then
      cp -p "$conf_backup" "$main_conf"
      printf '未找到独立的 http { 行，请核对主配置；已恢复备份。\n'
      exit 1
    fi
    sed -i '/^[[:space:]]*http[[:space:]]*{/a\    include /usr/local/nginx/conf/rigour-portal.conf;' "$main_conf"
  fi

  if ! /usr/local/nginx/sbin/nginx -t; then
    cp -p "$conf_backup" "$main_conf"
    printf '配置检查失败，已恢复主配置；请处理上方错误。\n'
    exit 1
  fi
  /usr/local/nginx/sbin/nginx -s reload
  printf '站点配置已请求加载，备份：%s\n' "$conf_backup"
)
```

本段以当前主配置的独立 `http {` 行和显式 include 形式为前提，不改动其他站点的 server 块。已有站点配置若需要调整代理地址，应单独修改 `/usr/local/nginx/conf/rigour-portal.conf`，再检查并重载。

**7．重载与启动的区别（Linux）**

Nginx 正在运行，需要让修改后的配置生效时执行：

```bash
/usr/local/nginx/sbin/nginx -t && /usr/local/nginx/sbin/nginx -s reload
```

这是整个 Nginx 的平滑配置重载，也会应用其他站点尚未加载的配置修改；不是只重启一个前端进程。通常不会中断正在处理的请求。[Nginx 官方说明](https://nginx.org/en/docs/beginners_guide.html)

仅更新静态文件或后端重启，通常不必重载 Nginx，浏览器刷新即可。不要为了更新这个前端停止整个 Nginx。

如果确认整个 Nginx 已停止：先通过 `ps -ef | grep '[n]ginx'` 检查没有 master 进程，再执行以下启动命令。Nginx 运行中不要重复启动：

```bash
/usr/local/nginx/sbin/nginx -t && /usr/local/nginx/sbin/nginx
```

**8．部署后验证（Linux + 浏览器，每次发布执行）**

Linux 检查监听和服务器内部首页：

```bash
ss -lntp | grep -E ':5100[[:space:]]'
curl --noproxy '*' -I --max-time 10 -H 'Host: 8.140.247.79' http://127.0.0.1:5100/
```

预期看到 Nginx 监听 5100，以及首页 `HTTP/1.1 200 OK`。这只证明服务器内部首页可访问。

再在浏览器访问 `http://8.140.247.79:5100/`，Mac 按 `⌘⇧R` 强制刷新，确认：页面资源加载、登录、业务查询、刷新后恢复会话都正常。若静态资源失败，在浏览器 Network 中检查具体资源 URL 的状态，不能只凭首页 200 判断全部成功。

公网访问需要入口 TCP 5100 对实际访问来源开放：云服务器查实例绑定的安全组；自建服务器查上级网络防火墙或公网映射。Linux 的 Firewalld 没运行、iptables 默认允许，并不能证明外部网络规则也放行。只放行需要的入口和来源范围。

本次排查曾确认服务器内部首页 200、Nginx 配置检查成功；公网 5100 和完整登录/业务验收仍需实际验证。本说明的整理不代表这些验收已经通过。

**9．只停止本前端（Linux，需要临时下线时）**

注释本站点的 include，再检查并重载。不要用 `nginx -s quit` 来只停这个前端，那会停止整个 Nginx。

```bash
(
  set -e
  main_conf=/usr/local/nginx/conf/nginx.conf
  conf_backup=$(mktemp "${main_conf}.before-disable.XXXXXX")
  cp -p "$main_conf" "$conf_backup"
  sed -i 's@^[[:space:]]*include[[:space:]]*/usr/local/nginx/conf/rigour-portal\.conf;@# include /usr/local/nginx/conf/rigour-portal.conf;@' "$main_conf"
  if ! /usr/local/nginx/sbin/nginx -t; then
    cp -p "$conf_backup" "$main_conf"
    printf '配置检查失败，已恢复主配置。\n'
    exit 1
  fi
  /usr/local/nginx/sbin/nginx -s reload
  printf '已请求停用 5100 站点，备份：%s\n' "$conf_backup"
)
```

再运行 `ss -lntp | grep -E ':5100[[:space:]]'`；没有输出表示该端口已不再监听。已建立的连接可能需要完成后退出。网站文件仍保留，恢复时执行第 6 步。

**10．回退网页文件（Linux，仅需要回退时）**

第 5 步已备份旧网页到输出目录下的 `web.tar.gz`。先列出备份，按发布时间选择正确的一份：

```bash
ls -dt /var/backups/rigour-portal-*
```

以下代码会要求输入所选备份目录的完整路径；输入后会覆盖当前网页以恢复该版本。它只回退网页文件，不回退 Nginx 配置或后端。

```bash
(
  set -e
  read -r -p '请输入要恢复的备份目录完整路径：' restore_backup
  test -f "$restore_backup/web.tar.gz"
  restore_dir=$(mktemp -d /tmp/rigour-portal-restore.XXXXXX)
  tar -xzf "$restore_backup/web.tar.gz" -C "$restore_dir"
  test -f "$restore_dir/index.html"
  mv "$restore_dir/index.html" "$restore_dir/index.restore.html"
  cp -a "$restore_dir/." /var/www/rigour-portal/
  chmod -R a+rX /var/www/rigour-portal
  mv -f /var/www/rigour-portal/index.restore.html /var/www/rigour-portal/index.html
)
```

回退会保留当前目录中额外的静态资源，随后执行第 8 步验证。如果还修改过主配置或站点配置，应先比较备份与当前文件，只恢复相应改动，避免覆盖其他站点后续更新，再执行 `nginx -t` 和重载。

**11．后端与登录配置（首次部署或认证失败时核对）**

首页由 Nginx 返回；业务 `/api/` 代理到 Gateway 26880；指定 `/auth/` 路径代理到 IAM 26881。Gateway 未就绪通常影响业务接口，不直接决定静态首页能否返回。

随包站点配置假定 Nginx、Gateway、IAM 在同一台 Linux 主机。其他拓扑按实际可达地址调整 `proxy_pass`；`/api/` 对应的 `proxy_pass http://127.0.0.1:26880;` 不加末尾斜线，以保留 `/api/v1/...` 路径。

IAM 已启用 OIDC 和签名时，将以下公开配置合并到现有配置，保留其他字段：

```yaml
rigour:
  iam:
    oidc:
      server:
        issuer: "http://127.0.0.1:26881"
        allow-insecure-loopback: true
        allow-insecure-http-origins: true
        allowed-origins:
          - "http://8.140.247.79:5100"
```

`allow-insecure-http-origins` 需要部署的服务版本支持；旧版本不能只添加配置就认为已放行。`allow-insecure-lan` 不能放行这个公网 IP。

IAM 中客户端 `rigour-scdp-browser` 的有效 `LOGIN_REDIRECT` 必须精确登记 `http://8.140.247.79:5100/oidc/callback`。`allowed-origins` 不等于回调登记。客户端还需要支持 Authorization Code、PKCE 和 Refresh Token；Gateway 校验的 issuer 与 IAM 保持一致。HTTP 入口的 IAM 会话 Cookie 不能设为 `Secure=true`；切换 HTTPS 时恢复 Secure。

可在 Linux 查看认证发现端点：

```bash
curl --noproxy '*' -i --max-time 10 -H 'Host: 8.140.247.79' http://127.0.0.1:5100/auth/.well-known/openid-configuration
```

预期是 issuer 匹配的 JSON，不是 `index.html`。`/auth/scdp/session` 应按当前登录状态返回会话 JSON。出现 `invalid_redirect_uri` 时核对 IAM 客户端回调登记。

**12．常见现象与检查位置**

| 现象 | 处理方向 |
| --- | --- |
| `pnpm: command not found` | Mac 安装指定 pnpm，重新打开终端；不是在 Linux 装前端运行环境 |
| `remote username contains invalid characters` | scp 用户名不能填中文字样“用户名”；本次使用服务器账号 root |
| `Permission denied` / scp 连接关闭 | 检查 SSH 账号、密码、密钥和登录权限 |
| `dist/: permission denied` / `nginx.conf: command not found` | 文件名或目录列表被当作命令执行，按本文命令操作 |
| `nginx: command not found` | 使用完整路径 `/usr/local/nginx/sbin/nginx` |
| 本机 5100 返回 200，浏览器访问失败 | 查公网入口、安全组/映射、代理/VPN；不能据此认定 Gateway 故障 |
| 首页正常，`/api/` 报 502/503 | 查 Gateway 26880、实际失败接口、路由和下游服务 |
| `/auth/` 报错或无法登录 | 查 IAM 26881、代理、issuer、Cookie 和客户端回调 |
| 页面还是旧版本 | 确认上传了本次包、更新了正确目录，再强制刷新 |

查看 Nginx 日志时，对照当前请求时间和端口，避免把其他站点的历史错误当作本次原因：

```bash
tail -n 30 /usr/local/nginx/logs/error.log
tail -n 30 /usr/local/nginx/logs/access.log
```

日常发布顺序：第 2～5 步 → 站点若停用则第 6 步 → 配置有变更时第 7 步 → 第 8 步验收。
