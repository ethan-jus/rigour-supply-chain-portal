#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$project_dir"

# 本次 Linux HTTP 部署的公开配置。desktop 仅启用现有 HTTP 加密兼容路径，
# NODE_ENV=production 仍生成优化后的静态文件，保留 PKCE 和签名校验。
export NODE_ENV=production
export VITE_APP_ENV=development
export VITE_API_BASE_URL=/api/v1
export VITE_OIDC_ISSUER=http://127.0.0.1:26881
export VITE_OIDC_CLIENT_ID=rigour-scdp-browser
export VITE_OIDC_REDIRECT_URI=http://8.140.247.79:5100/oidc/callback

pnpm typecheck
pnpm exec vite build --mode desktop
