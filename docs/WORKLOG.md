# PC Portal Worklog

## 2026-08-01 — 统一退出体验

- Portal 和平台管理/供应链主框架统一提供退出按钮；退出时清理内存 Token、权限和应用状态，并通过 OIDC RP-Initiated Logout 请求 IAM 撤销会话。
- 退出回到 Portal 后消费一次性标记，短暂提示退出结果后立即重新发起 OIDC，直接进入 IAM 登录页，不再增加多余的退出确认页面。
- 退出后的这一次 OIDC 授权请求带 `prompt=login`，要求 IAM 重新显示账号表单，避免旧浏览器会话静默回到上一个账号。
- 退出回调处理优先于 `isAuthenticated` 短暂状态，避免跨域返回时旧内存会话把用户先送回门户首页。
- “返回门户”只负责回到应用卡片入口，“退出”只负责结束会话；退出后的“重新登录”不会复用上一个平台账号。

## 2026-08-01 — 统一门户与后台视觉重构

- 使用品牌目录中的 `05_公共资源/品牌/瑞盖优选Logo.png` 生成 Web 尺寸品牌资源，门户顶栏、应用工作台和后台侧栏统一使用。
- 删除无业务价值的门户欢迎中间页：未登录访问受保护路由只进入轻量 OIDC 跳转页，已登录且内存 Token 有效时直接进入目标页；IAM 登录页承担正式品牌展示与账号输入。
- 登录身份不再向用户显示“平台管理员/普通用户”标签；IAM 根据企业编码推断登录范围：填写企业编码为租户登录，留空为平台登录，并保留服务端一致性校验。
- 应用工作台改为深色 Hero + 主题线稿应用卡片；平台、供应链、订货宝商城、销售工作台使用不同主题插画面板和授权状态。
- 平台管理、系统管理、供应链统一切换到 `ConsoleShell`：墨色分组侧栏、租户顶栏、统一面包屑和后台看板；空数据状态明确标注“等待业务服务接入”，不伪造业务指标。
- Portal `pnpm typecheck`、`pnpm lint`、28 项 Vitest、`pnpm build` 通过；IAM 授权服务器安全测试通过。真实 DEV 跨进程浏览器验收仍需重启 IAM 与 Portal 后执行。

## 2026-08-01 — 废弃骨架清理

- 删除未注册的旧模块页面、DefaultLayout、Sidebar/Topbar、空 Gate、空路由模块、空守卫、旧 composable 和全局权限指令。
- 删除未使用的登录请求/响应类型、分页占位类型、`showError` 展示封装和 OpenAPI 空目录占位文件；当前认证入口只有 OIDC PKCE。
- 旧脚手架验收报告已移除，当前目录和验证结果以 README、`docs/architecture.md` 与 CI 为准。

## 2026-07-31 — 登录、统一入口与系统管理收口

- 重做登录引导页、统一应用入口、应用卡片和错误/空数据/加载状态；入口展示当前用户、主体范围和租户名称。
- OIDC回调失败不再静默吞错；Access/ID Token保持页面内存存储，刷新后复用IAM HttpOnly会话重新授权。
- 用户管理补齐强密码确认、密码重置及会话撤销提示、角色/组织分配；系统角色只读保护。
- 租户管理补齐套餐预约生效、用户上限提示、订阅历史和有效状态展示。
- Portal不转发完整用户资料给其他系统；独立应用打开自己的OIDC登录入口，由IAM已有会话完成单点登录。
- `pnpm typecheck`、`pnpm lint`、25项Vitest和`pnpm build`全部通过；共享DEV和真实浏览器E2E尚未执行。

## 2026-07-31 — 平台/租户基础管理与数据库导航

- 新增平台管理Shell：租户与订阅、套餐与版本、应用与OIDC客户端、MENU/PAGE/BUTTON/API资源、审计。
- 新增租户系统管理Shell：组织、用户、角色与套餐授权边界、DataScope、租户设置、审计。
- 应用卡片与侧边导航均从IAM加载；`routeKey`仅映射已编译路由，未知或路径不一致时失败关闭。
- 前端显隐不代替后端授权。开发运行时可使用loopback HTTP，无运行时Mock。
- `pnpm typecheck`、`pnpm lint`、25项Vitest和`pnpm build`全部通过；真实DEV浏览器E2E尚未执行。

## 2026-07-31 — IAM OIDC 与统一应用门户接入

- 运行时移除 Mock 分支和 Web Storage Token，接入 Authorization Code + PKCE、state 校验、S256、内存 Access/ID Token。
- 接入 `/api/v1/me`、`/api/v1/portal/apps`，新增“我的应用”Shell、授权卡片和受控启动。
- 浏览器不再发送租户身份头；外部卡片不携带 Portal Token；退出使用 OIDC RP-Initiated Logout。
- `pnpm typecheck`、`pnpm lint`、19 项测试和 `pnpm build` 通过；共享 DEV E2E 尚未执行。

## 2026-07-29 — Portal 骨架搭建（历史记录）

本节只保留当时的变更记录，不代表当前目录结构。旧的 Mock、Gate、DefaultLayout、旧模块页面和全局权限指令已在 2026-08-01 清理，当前实现以 README 和 `docs/architecture.md` 为准。

### 完成内容

基于预存代码骨架，修复以下问题并使项目通过 lint/typecheck/test/build。

#### 类型层
- `src/types/router.ts`：添加 `permission`（单数）到 RouteMeta，添加 `AppRouteRecord` 类型
- `src/types/api.ts`：删除与 auth.ts 重复的 `UserInfo`/`LoginParams`/`LoginResult`，添加 `ApiErrorResponse`
- `src/types/auth.ts`：保留 `LoginRequest`/`LoginResponse`/`UserInfo`（唯一来源）

#### API 层
- `src/api/core/error.ts`：导入 `ApiErrorResponse`（原导入类型不存在）
- 恢复 `src/api/core/index.ts`：导出 `apiClient`、`getErrorMessage`、`showError`
- Mock handlers 已存在（`src/api/mock/handlers/auth.ts`），可直接使用

#### Store 层
- `src/stores/app.ts`：添加 `breadcrumbs` computed（TopBar 依赖）
- 恢复被误删的 `src/stores/permission.ts`：`PermissionRoute` 类型 + `usePermissionStore`
- `src/stores/auth.ts`：预存版本使用 `user` 字段（已确认）

#### 指令
- `src/directives/permission.ts`：使用 `authStore.user?.permissions`（原指向不存在的 `userInfo`）

#### 样式
- `src/assets/styles/_reset.scss`：添加 `@use './variables' as *`，使变量在 reset 中可用
- 预存 `_variables.scss` 保留（颜色、阴影、圆角、字体、间距、布局、过渡变量）
- 预存 `index.scss` 保留（Element Plus 主题 CSS 变量）

#### 路由
- `src/router/routes.ts`：添加 `crm/`、`system/` 模块路由（原缺省）
- 总计 11 个模块路由：工作台、总部、CRM、ERP、订单、销售、BI、人事、城市、代理、系统

#### 视图
- 新增 `src/views/crm/IndexView.vue`：商家管理占位页
- 新增 `src/views/system/IndexView.vue`：系统管理占位页

#### 入口
- `src/main.ts`：注册 `v-permission` 指令，导入 `index.scss`

#### 工程配置
- `vite.config.ts`：移除 SCSS additionalData（改为手动 @use），路径别名保留
- `eslint.config.js`：添加 `@typescript-eslint/parser` 支持 TypeScript 文件
- `env.d.ts`：ImportMetaEnv 补全
- `package.json`：补充 `@vue/test-utils`、`@element-plus/icons-vue`，调整兼容版本
- 预存 `pnpm-workspace.yaml`、`.env.example`、`.prettierrc` 保留

### 验证结果

| 检查 | 状态 |
|------|------|
| `pnpm typecheck` | ✅ 通过 |
| `pnpm lint` | ✅ 通过 |
| `pnpm test:run` | ✅ 通过 (1 test) |
| `pnpm build` | ✅ 通过 (dist/) |

### 文件结构

```
src/
├── api/
│   ├── core/        client.ts, error.ts, index.ts
│   ├── generated/   .gitkeep（等待 OpenAPI 生成）
│   └── mock/        adapter.ts, handlers/auth.ts
├── assets/styles/   _variables.scss, _reset.scss, index.scss
├── components/      AppSidebar.vue, AppTopbar.vue
├── composables/     useAuth.ts
├── directives/      permission.ts
├── layouts/         DefaultLayout.vue
├── router/          index.ts, routes.ts, permissionGuard.ts
├── stores/          auth.ts, permission.ts, app.ts
├── types/           api.ts, auth.ts, router.ts
├── utils/           token.ts, request-id.ts
└── views/           11 个模块 (dashboard/hq/crm/erp/order/sales/bi/hr/city/channel/system)
```

### 风险

1. **SCSS 变量导入**：每个使用 SCSS 变量的 `.vue` 文件需要在 `<style>` 首行添加 `@use '@/assets/styles/variables' as *;`。当前已为 5 个文件添加。如果新增组件，不要遗漏。
2. **构建 chunk 大小**：Element Plus 全量引入导致 `index.js` 约 1.2 MB，可以通过按需加载优化（当前已配置 unplugin-vue-components 的 ElementPlusResolver，但 main.ts 仍使用了 ElementPlus.use，实际未完全按需）。
3. **测试覆盖**：仅 1 个基础测试（`tests/example.test.ts`），各 store/API 层无单元测试。

## 2026-07-29 — Portal 质量修复（第二轮）

### 修复项清单

**1. Mock Adapter 真实拦截** — 实现 Axios 请求拦截器，匹配注册 handler，禁止请求落到网络。

**2. 依赖升级（保守稳定）**：
| 包 | 当前 | 目标 | 原因 |
|---|---|---|---|
| vite | 6.4.3 | ^7.0.0 | Vite 7 稳定主版本 |
| @vitejs/plugin-vue | 5.2.4 | ^6.0.0 | 配合 Vite 7 |
| vitest | 2.1.9 | ^3.0.0 | 配合 Vite 7 |
| typescript | ~5.6.0 | ~5.8.0 | 5.x 最新 |
| jsdom | ^25.0.0 | ^26.0.0 | 安全升级 |
| unplugin-auto-import | ^0.18.0 | ^0.19.0 | 0.x 最新 |
| unplugin-vue-components | ^0.27.0 | ^0.28.0 | 0.x 最新 |
| vue-tsc | ^2.1.0 | ^2.2.0 | 2.x 最新 |
| pinia | ^2.2.0 | ^2.3.0 | 2.x 最新 |
| vue-router | ^4.4.0 | ^4.6.0 | 4.x 最新 |

不升级：ESLint 10 / TS 7 / Vite 8 / vue-tsc 3 / pinia 4 / vue-router 5 / unplugin 21+（兼容性风险）。

**3. Element Plus 按需引入** — 移除 main.ts 全量注册和图标全量注册，使用 unplugin-vue-components `ElementPlusResolver` + `importStyle: 'css'`。

**4. Prettier 清理 + lint 拆分** — 删除 `.prettierrc.json`，清理 `*.tsbuildinfo`，lint 移除 `--fix`，新增 `lint:fix`。

**5. .env.production 租户清理** — 移除 `VITE_DEFAULT_TENANT_ID=demo`，client.ts 运行时获取租户。

**6. 真实测试** — 删除 example.test.ts，新增 Mock 登录/鉴权/请求头注入/路由守卫测试。

**7. 独立 403 页面** — 新建 ForbiddenView.vue。

**8-9. README + Token 安全** — 移除不存在文件引用，契约写入 docs/api-contract.md，生产建议 HttpOnly/SameSite cookie。

**10. 全量验证** — lint / typecheck / test:run / build / audit --prod。

**11. 脚手架规范补齐** — `.gitattributes`、`.github/workflows/ci.yml`、`docs/architecture.md`、中文 TSDoc。

### 验证结果

| 检查 | 状态 |
|---|---|
| `pnpm lint` | ✅ 通过 |
| `pnpm typecheck` | ✅ 通过 |
| `pnpm test:run` | ✅ 通过（15 tests，2 文件） |
| `pnpm build` | ✅ 通过（主 chunk 221 KB，gzip 84 KB） |
| `pnpm audit --prod` | ✅ 无已知漏洞 |
| `.env.production` 无 demo 租户 | ✅ |
| `*.tsbuildinfo` 已清理且 gitignore | ✅ |
| 403 独立 ForbiddenView | ✅ |
| `.gitattributes` / `.github/workflows/ci.yml` | ✅ |
| `docs/architecture.md` / `docs/api-contract.md` | ✅ |
| README 无不存在文件引用 | ✅ |
| Token 安全文档化 | ✅ |
| 中文 TSDoc（Router/Store/API/Mock/Adapter/指令） | ✅ |
| Element Plus 按需引入 | ✅ |
| Mock Adapter 真实拦截（adapter 模式） | ✅ |
| Prettier 单配置 + lint/lint:fix 拆分 | ✅ |
| 依赖升级 | ✅ |
| 构建产物不纳入 Git | ✅ |

### 残余风险

1. **Mock adapter 覆盖率**：当前仅注册 auth 两个 handler，其他模块（ERP/订单等）需在对接后端前补充。
2. **动态路由权限**：`permissionStore.accessibleRoutes` 默认为空，菜单不会渲染。调试时可临时将 `asyncRoutes` 赋值给 `accessibleRoutes`，正式接入需从后端权限接口获取。
3. **Vite 7 生态**：`@vueuse/core`（Element Plus 依赖）的 PURE 注释在 Rollup 下触发警告，不影响功能，等待上游修复。
4. **localStorage token**：已文档化风险，生产部署前必须替换为 HttpOnly Cookie 方案。
5. **CI 未实际运行**：`.github/workflows/ci.yml` 已创建，需 push 到 GitHub 后验证。
6. **未实现 E2E 测试**。

## 2026-07-29 — 权限路由初始化实施

### 问题
`permissionStore.accessibleRoutes` 默认为空数组，侧边菜单不渲染任何内容。用户登录后看不到导航菜单。

### 实施

1. **新增 `src/utils/route-filter.ts`** — 递归过滤 `asyncRoutes`：
   - `*:*:*` 返回全部模块
   - 叶节点检查 `meta.permission` 是否在用户权限列表中
   - 父节点保留条件：至少一个子节点通过过滤
   - 父节点本身无 permission 要求时，不因自身被过滤（如 `/erp` 有子路由 `/erp/index` 无 permission）

2. **更新 `src/stores/permission.ts`** — 新增 `initRoutes(permissions)` 方法：
   - 调用 `filterAsyncRoutes(asyncRoutes, permissions)` 生成菜单树
   - 设置 `accessibleRoutes` 和 `loaded = true`

3. **更新 `src/stores/auth.ts`** — 串联权限路由初始化：
   - `fetchUser()` 成功后调用 `permissionStore.initRoutes(user.permissions)`
   - `logout()` 时调用 `permissionStore.reset()` 清空菜单

4. **更新 `src/router/permissionGuard.ts`** — 页面刷新恢复会话：
   - 已有 token 但无 user 时调用 `fetchUser()`（自动触发 `initRoutes`）
   - 补充架构说明：路由静态全量注册，菜单过滤独立于导航守卫

5. **测试覆盖** — 新增 14 个测试（共 23 个）：
   - `filterAsyncRoutes` 单元测试：admin、有限权限、空权限
   - `permissionStore.initRoutes/reset` 行为测试
   - `authStore.logout` 触发 `permissionStore.reset`
   - 导航守卫：未登录跳转、无权限跳 403、有权限放行

### 验证结果

| 检查 | 状态 |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm test:run` | ✅ 23 tests passed |
| `pnpm build` | ✅ 主 chunk 221 KB (gzip 84 KB) |

### 残余风险（更新）

1. **Mock handler 覆盖不全** — 仅 auth 两个接口，其他模块 API 的 Mock 需后续补充。
2. **动态路由权限** — **已解决**。`permissionStore.initRoutes()` 在 `fetchUser()` 后自动调用，Mock 登录后菜单正常渲染。
3. **localStorage token** — 已文档化，生产部署前替换为 HttpOnly Cookie。
4. **CI 未实测** — 已创建 `.github/workflows/ci.yml`，需 push 后验证。
5. **菜单过滤与导航守卫职责分离** — **已明确**。路由静态全量注册（router），菜单由 `accessibleRoutes` 控制（sidebar），权限拦截由导航守卫处理（403）。
