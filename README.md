# 瑞盖优选供应链运营门户 (Portal)

瑞盖优选 B2B 供应链平台 PC 运营门户。

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
pnpm dev        # 开发服务器（Mock 模式）
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
| `VITE_ENABLE_MOCK` | `true` | 启用 Mock 数据 |
| `VITE_APP_ENV` | `local` | 运行环境标识 |

注意：生产环境不设置 `VITE_DEFAULT_TENANT_ID`；租户 ID 由认证响应或租户选择上下文运行时覆盖。

## API 契约

详见 [docs/api-contract.md](docs/api-contract.md)。

## 架构说明

详见 [docs/architecture.md](docs/architecture.md)。

## 项目结构

```
src/
├── api/               # API 层
│   ├── core/          # HTTP Client、错误处理
│   ├── generated/     # OpenAPI 生成代码
│   └── mock/          # Mock 数据适配器（开发阶段请求拦截）
├── assets/styles/     # 设计 Token 和全局样式
├── components/        # 通用组件
├── composables/       # 组合式函数
├── directives/        # 自定义指令（v-permission）
├── layouts/           # 页面布局
├── router/            # 路由配置和权限守卫
├── stores/            # Pinia Store
├── types/             # TypeScript 类型
├── utils/             # 工具函数
└── views/             # 页面视图
```

## 认证与安全

### 当前实现（过渡）

Token 存储在 `localStorage`，每次请求通过 `Authorization: Bearer <token>` 传递。

**风险**：localStorage 受 XSS 攻击影响，恶意脚本可读取 token。

### 生产建议

- 使用 HttpOnly + SameSite=Strict Cookie 存储 token
- 配合 CSRF Token 双重提交或 SameSite Cookie 防御
- 短期 token + refresh token 轮转
- CSP 策略限制内联脚本

`src/utils/token.ts` 为过渡封装层，接入后端认证服务后应替换为 Cookie 方案。

## 模块路由

| 模块 | 路径 | 图标 |
|---|---|---|
| 工作台 | `/dashboard` | Odometer |
| 总部管理 | `/hq` | OfficeBuilding |
| ERP | `/erp` | SetUp |
| 订单管理 | `/order` | List |
| 销售管理 | `/sales` | User |
| 数据分析 | `/bi` | DataAnalysis |
| 人事管理 | `/hr` | Avatar |
| 城市运营 | `/city` | MapLocation |
| 代理管理 | `/channel` | Connection |

## 职责边界

- 页面只管理展示状态和用户输入
- 业务判定由后端领域服务完成
- 前端不得复制业务状态机
- 财务金额不得在前端使用浮点数核算
- BI 页面只调用分析查询 API，不聚合多个领域服务计算指标

## License

Internal
