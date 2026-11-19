#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$project_dir"

# 两个 SCM 入口共用同一产物，回调由浏览器按当前入口生成。
# desktop 为现有 HTTP 入口保留 PKCE 和签名校验所需的实现。
export NODE_ENV=production
export VITE_APP_ENV=production
export VITE_API_BASE_URL=/api/v1
export VITE_OIDC_ISSUER=http://127.0.0.1:26881
export VITE_OIDC_CLIENT_ID=rigour-scdp-browser
export VITE_OIDC_REDIRECT_URI=''

pnpm typecheck
pnpm exec vite build --mode desktop --outDir rgscdp_dist
