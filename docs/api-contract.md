# API 接口契约

## 基础约定

| 项目 | 约定 |
|---|---|
| API 前缀 | `/api/v1` |
| 认证方式 | `Authorization: Bearer <token>` |
| 租户头 | `X-Tenant-Id` |
| 追踪头 | `X-Request-Id`（UUID 或时间戳+随机串） |
| Content-Type | `application/json` |

## 标准响应格式

```json
{
  "code": "OK",
  "message": "操作成功",
  "data": {},
  "requestId": "lzabc123-def456",
  "timestamp": "2026-07-29T10:00:00+08:00"
}
```

- `code` 为 `"OK"` 表示成功，其他值表示业务错误
- `data` 为具体返回数据，类型因接口而异
- `requestId` 用于日志追踪和问题排查

## 错误码

| code | 含义 |
|---|---|
| `IAM_UNAUTHORIZED` | 未登录或 token 过期 |
| `IAM_INVALID_TOKEN` | token 无效 |
| `IAM_FORBIDDEN` | 无权限访问 |
| `IAM_TENANT_MISMATCH` | 租户不匹配 |
| `VALIDATION_ERROR` | 参数校验失败 |
| `RATE_LIMITED` | 请求频率限制 |
| `INTERNAL_ERROR` | 服务器内部错误 |

## 分页

请求参数：
```json
{ "page": 1, "pageSize": 20, "sort": "createdAt,desc" }
```

响应格式：
```json
{
  "code": "OK",
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 20,
    "total": 150
  }
}
```

## 认证接口

### POST /auth/login

请求：
```json
{ "username": "admin", "password": "xxx" }
```

响应：
```json
{
  "accessToken": "eyJhbGci...",
  "tokenType": "Bearer",
  "expiresIn": 7200,
  "refreshToken": "eyJhbGci..."
}
```

### GET /auth/me

响应：
```json
{
  "id": "u001",
  "username": "admin",
  "displayName": "系统管理员",
  "avatar": "",
  "email": "admin@rigour.cn",
  "phone": "13800138000",
  "roles": ["super_admin"],
  "permissions": ["*:*:*"],
  "tenantId": "rigour"
}
```
