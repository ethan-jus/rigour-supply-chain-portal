# SCDP Web 接口契约

## 认证

Vue 登录表单经 Web 同源代理建立 IAM 会话；业务 Token 使用 OIDC Authorization Code + PKCE 获取。会话登录接口不返回 Token。
业务请求通过 Gateway，携带 `Authorization: Bearer <access token>`。浏览器不提交可信租户头；身份从已验证 Token 和实时会话恢复。

| 接口 | 作用 |
|---|---|
| `GET /auth/scdp/session` | 获取有效会话状态和 CSRF token，禁止缓存 |
| `POST /auth/scdp/login` | 表单编码提交企业、账号、密码与 CSRF；成功 204，凭据失败统一 401，CSRF 失败 403 |
| `/auth/.well-known/openid-configuration` | Discovery |
| `/auth/oauth2/authorize`、`/auth/oauth2/token` | PKCE 授权、换码及刷新令牌 |
| `POST /auth/scdp/logout` | 携带 CSRF 撤销会话，成功 204；不依赖内存 Token |
| `GET /api/v1/me` | 当前企业用户、角色和权限 |
| `GET /api/v1/scdp/navigation` | 当前用户的 SCDP 菜单树 |
| `GET /api/v1/management/supply/context` | 权限模型状态、版本、当前功能权限 |
| `/api/v1/management/supply/**` | SCDP 用户、角色、菜单、参数、日志与权限升级 |
| IAM `/api/v1/token/current` | Gateway 内部实时核验；不使用 JWT 内陈旧权限 |

换码返回 `access_token / refresh_token / id_token / token_type / expires_in`。续期向 `POST /auth/oauth2/token` 提交表单 `grant_type=refresh_token&client_id=...&refresh_token=...`，不携带 Cookie 或客户端密钥。成功后同时替换 Access Token 和 Refresh Token；旧 Refresh Token 不得重复使用。服务端保存刷新令牌摘要，重放撤销会话；客户端、scope、会话有效性仍由 IAM 校验。请求超时 10 秒，单次刷新不做内部重试；后续请求可重试。若服务端已轮换而网络丢失响应，旧令牌会按重放规则失效，需重新登录。

产品接口不接受任意 applicationCode；租户来自当前登录身份。用户 principalScope 为 TENANT，不返回 `*:*:*` 授权。

## 菜单

菜单节点包含 `id/parentId/type/displayName/permissionCode/routeKey/routePath/iconKey/sortOrder/visible/keepAlive/children`。
名称、层级和图标可以维护；页面能力只可选择已实现的资源。数据库不能下发任意组件代码、JS 或未知路由。

## 状态处理

- IAM 明确 Token 失效的 401：先刷新并最多重试一次；刷新返回 `invalid_grant`，或新 Token 仍被拒绝，才清理登录并显示登录表单。普通业务 401 保留页面，不当作会话过期。
- 403：无权限页。
- 服务不可用、网络异常或导航格式不合法：503，保留会话供重试。
- 旧应用目录及平台管理接口已移除，不能作为登录依赖。

各业务查询、分页和响应解包以 `src/api/core/` 及对应服务 OpenAPI 契约为准。

代理只开放列出的认证端点及 `/auth/oauth2/jwks`，不会转发任意 IAM 内部接口。IAM 的原生 `/login` 服务端表单仍供销售移动端系统浏览器登录使用，Web 不依赖该页面。
