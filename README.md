# 瑞盖供应链数字化平台 Web

工程名：`rigour-supply-chain-digital-web`。后端工程：`rigour-supply-chain-digital-platform`。

访问首页时，已登录用户直接进入供应链工作区；未登录用户显示本工程的登录表单。登录成功统一进入首页。用户、角色、菜单、业务参数和操作日志统一维护在供应链「系统设置」。企业之间保持 SaaS 租户隔离。

## 本地启动

```bash
pnpm install --frozen-lockfile
pnpm dev
```

访问 `http://localhost:5100`。Vite 使用严格端口模式，5100 被占用会报错，不会自动改用 5101。后端 Gateway 默认 `26880`，IAM 默认 `26881`。更换工程目录后，需要在 VS Code 中重新打开本目录。

| 配置 | 用途 |
|---|---|
| `VITE_API_BASE_URL` | API 前缀，默认 `/api/v1` |
| `VITE_API_TARGET` | Vite 代理的 Gateway 地址 |
| `VITE_OIDC_ISSUER` | IAM 地址，必须与服务端 issuer 一致 |
| `VITE_OIDC_CLIENT_ID` | SCDP 公开客户端 ID；本地默认 `rigour-scdp-browser` |
| `VITE_OIDC_REDIRECT_URI` | 精确登记的 `/oidc/callback` 地址 |

Web 通过同源 `/auth/` 白名单代理调用 IAM，会话和密码校验由 IAM 完成；浏览器无需访问 IAM 端口。部署时也必须配置该代理，参照后端 `scripts/desktop/nginx.conf`。

客户端公开标识已随 IAM V106 迁移改名。前后端应一起更新；IAM 启动时先执行 Flyway，浏览器再重新登录。远程 Git 仓库地址尚未改名，保留现有 origin。

## 登录与自动续期

登录采用 Authorization Code + PKCE，获取短期 Access Token 和轮换式 Refresh Token。请求或路由切换发现 Access Token 即将到期时，自动调用同源 `/auth/oauth2/token` 刷新，并继续原页面；并发请求只刷新一次。服务端明确拒绝 Access Token 时，刷新成功后最多重试原请求一次。

两种 Token 只保存在页面内存，不写入 localStorage/sessionStorage。刷新整个页面仍通过 IAM 的 HttpOnly 会话恢复。网络中断和服务 503 不清除登录；Refresh Token 失效、会话过期或撤销后需要重新登录。续期不延长 IAM 会话的最大期限。

首次启用：先重新构建并启动 IAM，确认 Flyway V109 成功（给 SCDP 客户端增加 `refresh_token` 授权），再刷新 Web 并登录一次。已有页面中的旧令牌不会自动变成双 Token。无需新增环境配置或把客户端密钥放进前端。

## 开发约定

- Vue 3、TypeScript、Vite、Pinia、Element Plus。
- OIDC Authorization Code + PKCE；Token 只保存于内存。
- `/me` 提供当前租户身份和实际权限；`/scdp/navigation` 提供动态菜单。
- 菜单可配置名称、层级、图标和排序；路由必须匹配已编译的 `routeKey` 白名单。
- ACTIVE 模式仅使用 SCDP 角色权限。前端没有超级管理员通配符旁路。
- 普通业务用户关联 HR 员工；功能、部门范围、客户范围、仓库授权分别计算。
- 品牌 PNG 使用用户提供的原图：页面 `src/assets/brand/scdp-logo.png`，浏览器 `public/scdp-icon.png`。

## 验证

```bash
pnpm typecheck
pnpm lint
pnpm test:run
pnpm build
```

本地构建、隔离测试与共享 DEV 的真实业务验收分别记录。详见 [架构](docs/architecture.md) 和 [接口契约](docs/api-contract.md)。
