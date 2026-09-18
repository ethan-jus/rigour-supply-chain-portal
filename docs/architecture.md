# SCDP Web 架构

## 产品入口

`/` → `/supply-chain`；未认证时显示 Vue `/login` 表单，提交成功完成同源 OIDC 授权与回调后统一进入 `/supply-chain`。有效会话可在刷新后恢复；退出、鉴权失效或回调失败时停留在登录表单，不自动重登。
若用户没有首页菜单，选择其首个已授权业务页面；无业务授权显示 403，可退出登录。

本工程只承载 SCDP。用户及角色属于当前企业租户；没有应用目录、平台管理 Shell 或第二套用户管理。

## 认证和授权

1. Web 通过 `/auth/scdp/session` 获取 CSRF 和有效会话状态，通过 `/auth/scdp/login` 建立 HttpOnly 会话，再执行同源 Code + PKCE。校验 state、nonce、ID Token 签名和 issuer/audience。认证成功轮换会话 ID 与 CSRF。
2. `/me` 读取当前用户，`/management/supply/context` 读取 SCDP 权限状态。
3. `/scdp/navigation` 返回固定产品的数据库菜单；未知 routeKey 或不匹配路径拒绝使用。
4. 角色授予菜单和按钮功能及部门数据范围；用户配置客户、地区和仓库范围。HR 是部门、岗位和员工档案的归属服务。
5. Gateway 每次重新校验 `/token/current`，服务端继续校验功能及数据权限。前端隐藏按钮不能代替后端鉴权。
6. Access Token 接近到期或被 IAM 拒绝时，通过标准 `refresh_token` grant 续期。并发请求合并为一次刷新，轮换保存新 Refresh Token；原请求最多重试一次，页面不跳转。业务 401/403 不触发续期，网络异常保留会话。
7. 退出通过带 CSRF 的同源会话接口撤销 IAM 会话及刷新链，确认成功后清理前端状态并进入登录页；迟到的刷新响应不能恢复已退出会话。Access/Refresh Token 只存内存；ID Token 在登录回调验证后不留存，sessionStorage 仅暂存 PKCE 跳转材料。整页刷新继续用 HttpOnly 会话重新授权，运行中的续期不跳转授权页。

新租户的受保护首任管理员可以进入系统设置初始化。已存在的权限升级 PREPARING 状态保留，启用前仍需完成范围核验；不因本次入口调整自动扩大授权。

## 结构

- `auth/`：同源会话登录、OIDC 回调和内存 Token。
- `api/core/`：各领域接口与统一错误处理。
- `stores/auth.ts`：登录身份。
- `stores/supply-authorization.ts`：SCDP 功能权限及版本。
- `stores/navigation.ts`：服务端菜单。
- `router/permissionGuard.ts`：登录、导航白名单、页面权限。
- `layouts/ConsoleShell.vue`：工作区与多页签。
- `views/supply-chain/settings/`：用户、角色、菜单、业务参数、操作日志。

业务状态、客户主责、历史订单归属与选仓/出库授权由对应后端服务负责。租户隔离、HR 员工关联与这些业务规则不因入口简化而取消。

## 历史数据

IAM 用新增 V106 停用旧入口和平台主体、调整客户端名称。历史迁移、审计和引用行保留；旧公开管理接口和前端页面已删除。销售移动端接口权限归入供应链资源目录，移动端工程仍独立运行。
