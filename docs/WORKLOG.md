# PC Portal Worklog

## 2026-07-29 — Portal 骨架搭建

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
