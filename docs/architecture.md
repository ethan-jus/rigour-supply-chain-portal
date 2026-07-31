# 架构说明 — 统一应用门户与供应链管理 Console

## 职责边界

本仓库为前端展示层，一期在同一 Vue 工程中承载两个职责隔离的 Shell：

1. 统一应用门户：登录、“我的应用”、应用卡片过滤和安全启动。
2. 供应链管理 Console：点击供应链平台卡片后进入，承载 CRM、ERP、订单、销售监管和 BI 等业务页面。

两层只共享认证、设计 Token 和 API Core，不把供应链菜单直接放在登录后的应用目录首页，也不复制任何业务状态机。

- 订单、库存、考勤等状态机由后端领域服务持有
- 财务金额不在前端使用浮点数核算
- BI 页面仅调用分析查询 API，不跨领域聚合指标

## 分层结构

```
src/
├── api/                  API 通信层
│   ├── core/             手写 HTTP Client、认证拦截、错误处理
│   └── generated/        OpenAPI 生成代码（只读，不手改）
├── auth/                 OIDC PKCE、回调和内存 Token
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
       router    auth/oidc
       directives
       composables
```

- views 不直接操作 axios 或 token，通过 store 和 api 层
- stores 通过 apiClient 发起请求，不处理 HTTP 细节
- api/core 管理认证头和错误解包，不接受浏览器注入租户身份头
- 服务当前可在本机运行，但使用DEV真实接口/数据库；运行时代码无 Mock 分支

## 认证流程

1. Portal 生成高熵 `state`、PKCE verifier 和 S256 challenge，跳转 IAM。
2. IAM 完成统一登录并返回 Authorization Code；Portal 校验 state 并换码，再根据Discovery/JWKS校验ID Token的RS256签名、issuer、audience/azp、nonce和时间声明。
3. Token 只保存在页面内存，PKCE 临时材料只在 `sessionStorage` 跨重定向保存。
4. Portal 通过 Gateway 获取 `/me` 和 `/portal/apps`，初始化用户、应用许可和功能权限。
5. 登录成功先进入“我的应用”，卡片目标不接收 Portal Token。
6. 退出通过 `/connect/logout` 撤销 IAM 会话；旧 Access Token 随即失效。

## 授权模型

- 应用许可决定“我的应用”展示哪些卡片以及能否启动对应管理Shell
- MENU/PAGE资源决定侧边导航和页面访问；数据库只下发稳定`routeKey`和路径，未知映射失败关闭
- BUTTON/API资源共用`permissionCode`，允许同一能力的UI显隐与后端授权对齐
- 功能权限决定供应链 Console 内的菜单、页面、按钮和接口
- DataScope 决定进入页面后可访问的数据范围
- 角色是应用许可、功能权限和 DataScope 的授权集合，不在前端硬编码角色名称
- `*:*:*` 表示超级管理员，拥有全部权限
- 路由 `meta.permission` 定义页面所需权限
- `v-permission` 指令控制元素显隐
- 403 使用独立 ForbiddenView，不复用 404
- 前端显隐不是最终安全边界，Gateway 和领域服务必须逐接口复核

## 目标路由结构

| 层级/模块 | 目标路径 | 授权要求 |
|---|---|---|
| 登录 | `/login` | 无 |
| 我的应用 | `/apps` | 已登录 |
| 平台管理 | `/platform-admin` | `PLATFORM_ADMIN`应用许可 + 数据库导航 |
| 租户系统管理 | `/system-admin` | `SYSTEM_ADMIN`应用许可 + 数据库导航 |
| 供应链 Console | `/supply-chain` | `SUPPLY_CHAIN` 应用许可 |
| ERP | `/supply-chain/erp` | 应用许可 + `erp:*` |
| 订单管理 | `/supply-chain/order` | 应用许可 + `order:*` |
| 销售管理 | `/supply-chain/sales` | 应用许可 + `sales:*` |
| 数据分析 | `/supply-chain/bi` | 应用许可 + `bi:*` |
| 人事/城市/代理 | `/supply-chain/...` | 对应功能权限和 DataScope |

## 当前未实现或未验收范围

- 订货宝、飞书销售工作台及其他系统的受控启动配置
- 开放 API 代码生成（`src/api/generated/` 为空占位）
- 业务领域接口对DataScope的实际消费（IAM的DataScope管理已完成）
- 多租户切换 UI
- Keep-alive 缓存策略细化
- 本地IAM/Gateway/Portal连接真实DEV数据的跨进程浏览器E2E验收；域名和HTTPS留待部署阶段
