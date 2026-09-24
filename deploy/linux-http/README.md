# 前端 HTTP 上线配置

- 入口：`http://8.140.247.79:2026`
- 静态目录：`/usr/local/nginx/rgscdp_dist`
- Gateway：`127.0.0.1:26880`；IAM：`127.0.0.1:26881`
- 分支：`dev`

## 构建

先检查后端 `application-prod.yml` 和服务器环境变量，再在前端仓库执行：

```bash
bash deploy/linux-http/build.sh
```

脚本先做类型检查，再输出 `rgscdp_dist/`。HTTP 部署使用已有的 `desktop` 加密兼容路径，仍保留 PKCE 与签名校验。公开构建变量为：

| 变量 | 值 |
| --- | --- |
| VITE_API_BASE_URL | `/api/v1` |
| VITE_OIDC_ISSUER | `http://127.0.0.1:26881` |
| VITE_OIDC_CLIENT_ID | `rigour-scdp-browser` |
| VITE_OIDC_REDIRECT_URI | `http://8.140.247.79:2026/oidc/callback` |

浏览器通过同源 `/auth/` 请求 IAM；issuer 用于校验令牌，不让浏览器直连它的本机端口。更改公开入口或回调后需要重新构建。

## 部署到现有 Nginx

本目录的 `nginx.conf` 只包含本项目的 `server` 块，是上线时的参考片段，**不能覆盖服务器主配置**。

按本次部署约定：

1. 备份 `/usr/local/nginx/conf/nginx.conf`，记录原有站点的访问状态。
2. 将 `rgscdp_dist/` 的内容部署到 `/usr/local/nginx/rgscdp_dist/`，确保该目录直接包含 `index.html` 和 `assets/`。
3. 在服务器原 `nginx.conf` 的 `http` 段中直接追加本项目 `server` 块，监听 `2026`；保留原有 `server`、`include`、端口和路径。不要另行替换或停用旧站点配置。
4. 执行 `/usr/local/nginx/sbin/nginx -t`。失败则恢复本次备份，不加载错误配置。
5. 检查通过后执行 `/usr/local/nginx/sbin/nginx -s reload`，平滑加载。
6. 检查原有 `80`、`8099`、`5100` 站点，并验证新入口的首页、登录、令牌更新及业务 API。

`/api/` 由 Gateway 统一认证，再按功能路由到各微服务。`/auth/` 仅暴露模板列出的 IAM 登录与 OIDC 端点，不能把所有 IAM 内部端点直接对外代理。

公网访问还需要实例安全组允许入口 TCP `2026`。后端微服务、MySQL 和 Redis 只绑定服务器回环地址。

需要回退时，先核对备份之后是否有其他管理员改动，再恢复本次备份并执行 `nginx -t` 和平滑加载；不停止整个 Nginx 服务。
