# 瑞盖优选统一应用门户与供应链管理端 (Portal)

一期复用一个 Vue 工程承载两层体验：员工登录后先进入“我的应用”卡片目录，点击“供应链平台”后再进入供应链管理 Console。订货宝、飞书销售工作台及其他公司系统作为并列应用入口；是否支持单点登录以各系统真实能力为准。

当前已完成 OIDC Authorization Code + PKCE、ID Token签名/声明校验、内存 Token、“我的应用”、平台管理中心、租户系统管理和数据库导航链路。销售管理已登记销售管控、外勤考勤、拜访、门店覆盖、组织、任务、异常和规则配置菜单骨架；飞书销售工作台卡片进入受控引导页，不在PC端复制现场作业。当前按本地loopback地址开发，但尚未执行真实DEV跨进程浏览器验收，不能把自动构建结果误报为已上线。

## 技术栈

| 组件 | 选择 |
|---|---|
| 框架 | Vue 3 + TypeScript |
| 构建 | Vite 7 |
| UI 库 | Element Plus（按需引入） |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 |
| 测试 | Vitest + jsdom |
| 代码规范 | ESLint + Prettier |

## 环境要求

- Node.js >= 24.0.0
- pnpm >= 9.0.0

## 快速开始

```bash
pnpm install
pnpm dev        # localhost:5100，通过localhost:26880的Gateway连接真实DEV数据
pnpm build      # 生产构建
pnpm test       # 运行测试
pnpm typecheck  # 类型检查
pnpm lint       # 代码检查
pnpm lint:fix   # 代码检查（自动修复）
```

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | API 基础路径 |
| `VITE_APP_ENV` | `dev` | 运行环境标识 |
| `VITE_API_TARGET` | `http://localhost:26880` | 本地Gateway代理目标 |
| `VITE_OIDC_ISSUER` | `http://localhost:26881` | 当前本地IAM issuer；非开发构建必须HTTPS |
| `VITE_OIDC_CLIENT_ID` | 无 | Portal 公开客户端 ID |
| `VITE_OIDC_REDIRECT_URI` | 当前站点 `/oidc/callback` | 精确注册的登录回调 |
| `VITE_OIDC_POST_LOGOUT_REDIRECT_URI` | 当前站点 `/` | 精确注册的退出回调 |
| `VITE_FEISHU_SALES_WORKBENCH_URL` | 开发环境`http://localhost:5200/#/home` | 飞书H5地址；生产必须配置HTTPS或飞书受控地址 |

Portal 不发送租户身份头；Gateway 从已验签 JWT 重建可信租户上下文。

## API 契约

详见 [docs/api-contract.md](docs/api-contract.md)。

## 架构说明

详见 [docs/architecture.md](docs/architecture.md)。

## 项目结构

```
src/
├── api/               # API 层
│   └── core/          # HTTP Client、错误处理
├── auth/              # OIDC PKCE、回调与内存 Token
├── assets/styles/     # 设计 Token 和全局样式
├── components/        # 通用组件
├── layouts/           # 页面布局
├── router/            # 路由配置和权限守卫
├── stores/            # Pinia Store
├── types/             # TypeScript 类型
├── utils/             # 工具函数
└── views/             # 页面视图
```

## 认证与安全

Portal 是公开 PKCE 客户端，不接收 Refresh Token。Access Token 和 ID Token 仅保存于页面内存；刷新页面或短期 Token 失效后，重新发起授权并复用 IAM 的 Secure/HttpOnly 会话。退出使用 OIDC RP-Initiated Logout，卡片跳往外部系统时不转发 Portal Token。

## 基础管理路由

| 层级 | 路径 | 数据库授权 |
|---|---|---|
| 我的应用 | `/apps` | IAM应用卡片 |
| 平台管理 | `/platform-admin` | 租户、套餐、应用、资源、审计 |
| 租户系统管理 | `/system-admin` | 组织、用户、角色、DataScope、租户菜单、设置、审计 |
| 供应链Console | `/supply-chain` | CRM、订单、销售、ERP、HR、城市、渠道和BI |
| 销售管理 | `/supply-chain/sales` | IAM驱动的销售管控、外勤、拜访、门店、异常和规则菜单 |
| 飞书销售工作台卡片 | `/sales-workbench` | 进入受控启动页并打开独立销售H5；不复用供应链销售管理后台 |

导航由IAM按“平台资源目录 ∩ 套餐范围 ∩ 租户菜单启用 ∩ 角色授权”生成，`routeKey`必须匹配Portal已编译白名单。租户可覆盖名称、图标、排序、显示状态并创建无路由分组，但不能修改平台路由和权限编码。BUTTON/API使用`permissionCode`；前端只控制体验，最终授权由Gateway和后端执行。

## 职责边界

- 页面只管理展示状态和用户输入
- 业务判定由后端领域服务完成
- 前端不得复制业务状态机
- 财务金额不得在前端使用浮点数核算
- BI 页面只调用分析查询 API，不聚合多个领域服务计算指标

## License

Internal
