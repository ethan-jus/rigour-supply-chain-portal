# SCM 前端统一发布

- 入口为 `https://scm.wpbsaedu.cn` 和 `http://8.140.247.79:2026`
- 两个入口共用 `/usr/local/nginx/rgscdp_dist` 下的 `index.html` 和 `assets/`
- Gateway：`127.0.0.1:26880`；IAM：`127.0.0.1:26881`
- 分支：`dev`

## 构建

先检查后端 `application-prod.yml` 和服务器环境变量，再在前端仓库执行：

```bash
bash deploy/linux-http/build.sh
```

脚本先做类型检查，再输出一份 `rgscdp_dist/`。构建保留 `desktop` 模式下的 HTTP 登录、PKCE 与签名校验。

| 变量 | 值 |
| --- | --- |
| VITE_API_BASE_URL | `/api/v1` |
| VITE_OIDC_ISSUER | `http://127.0.0.1:26881` |
| VITE_OIDC_CLIENT_ID | `rigour-scdp-browser` |
| VITE_OIDC_REDIRECT_URI | 空值，浏览器使用当前访问地址的 `/oidc/callback` |

浏览器通过同源 `/auth/` 请求 IAM。issuer 用于校验令牌。每个入口的回调地址仍须在 IAM 精确登记。

## 部署到现有 Nginx

本目录的 `nginx.conf` 只包含本项目的 `server` 块，是上线时的参考片段，**不能覆盖服务器主配置**。

已配置两个入口的服务器只需发布一次：

1. 备份共享目录当前的 `index.html`，先同步新构建的静态资源。
2. 原子替换共享目录的 `index.html`，保留旧页面仍可能请求的带哈希文件。
3. 检查两个入口的首页与 `/oidc/callback` 返回同一份 HTML，并分别验证登录及业务页。

首次配置时，把端口和域名的 `server` 块指向同一个静态目录。修改 Nginx 配置后先执行 `/usr/local/nginx/sbin/nginx -t`，通过后平滑加载。

`/api/` 由 Gateway 统一认证，再按功能路由到各微服务。`/auth/` 仅暴露模板列出的 IAM 登录与 OIDC 端点，不能把所有 IAM 内部端点直接对外代理。

公网访问还需要实例安全组允许入口 TCP `2026`。后端微服务、MySQL 和 Redis 只绑定服务器回环地址。

静态发布回退时，恢复共享目录的 `index.html` 并复核两个入口。
