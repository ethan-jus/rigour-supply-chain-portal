# 架构说明 — PC 运营门户

## 职责边界

本仓库为前端展示层，只管理页面状态和用户输入，不复制任何业务状态机。

- 订单、库存、考勤等状态机由后端领域服务持有
- 财务金额不在前端使用浮点数核算
- BI 页面仅调用分析查询 API，不跨领域聚合指标

## 分层结构

```
src/
├── api/                  API 通信层
│   ├── core/             手写 HTTP Client、认证拦截、错误处理
│   ├── generated/        OpenAPI 生成代码（只读，不手改）
│   └── mock/             开发阶段 Mock Adapter
├── stores/               全局状态（Pinia）
├── router/               路由配置 + 权限守卫
├── views/                页面组件（按模块）
├── layouts/              页面布局（DefaultLayout）
├── components/            共享组件（Sidebar、Topbar）
├── composables/           组合式函数（useAuth）
├── directives/            自定义指令（v-permission）
├── types/                 TypeScript 类型定义
├── utils/                 工具函数（token、request-id）
└── assets/styles/         设计 Token 和全局样式
```

## 依赖方向

```
views → stores → api/core → axios
       router    api/mock
       directives
       composables
```

- views 不直接操作 axios 或 token，通过 store 和 api 层
- stores 通过 apiClient 发起请求，不处理 HTTP 细节
- api/core 管理认证头、错误解包、租户注入
- mock 在 api 层拦截，对上层透明

## 认证流程

1. 用户提交登录表单 → `authStore.login()`
2. `authStore.login()` 调用 `apiClient.post('/auth/login')`
3. Mock Adapter（开发）或后端返回 token
4. token 存入 `localStorage`（⚠️ 过渡方案，生产应使用 HttpOnly cookie）
5. `apiClient` 在每次请求中注入 `Authorization` 头
6. 路由守卫检查 `authStore.isAuthenticated`，未登录跳转 `/login`
7. 401 响应自动清除 token 并跳转登录

## 权限模型

- 用户 → roles（角色） → permissions（权限标识）
- `*:*:*` 表示超级管理员，拥有全部权限
- 路由 `meta.permission` 定义页面所需权限
- `v-permission` 指令控制元素显隐
- 403 使用独立 ForbiddenView，不复用 404

## 路由结构

| 模块 | 路径 | 权限前缀 |
|---|---|---|
| 工作台 | /dashboard | — |
| 总部管理 | /hq | — |
| ERP | /erp | erp |
| 订单管理 | /order | order |
| 销售管理 | /sales | sales |
| 数据分析 | /bi | bi |
| 人事管理 | /hr | hr |
| 城市运营 | /city | city |
| 代理管理 | /channel | channel |

## 当前未实现范围

- 开放 API 代码生成（`src/api/generated/` 为空占位）
- 动态路由按权限注入（`permissionStore` 已定义，未接入后端接口）
- 多租户切换 UI
- Keep-alive 缓存策略细化
- E2E 测试
