import { fileURLToPath, URL } from 'node:url'
import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// 使用插件实际生成的无扩展名导入路径；组件目录来自已安装版本，升级时自动同步。
const elementPlusComponents = join(dirname(createRequire(import.meta.url).resolve('element-plus/package.json')), 'es/components')
const elementPlusStyles = readdirSync(elementPlusComponents)
  .filter(component => existsSync(join(elementPlusComponents, component, 'style/css.mjs')))
  .map(component => `element-plus/es/components/${component}/style/css`)

/**
 * Vite 构建配置
 *
 * - Element Plus 按需引入：unplugin-vue-components 的 ElementPlusResolver
 *   + importStyle: 'css' 自动导入组件样式，不需要在 main.ts 全量注册
 * - 路径别名 @ → src/
 * - 开发代理 /api → Gateway（默认 localhost:26880）
 * - 生产关闭 sourcemap
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      vue(),
      AutoImport({
        resolvers: [ElementPlusResolver()],
        imports: ['vue', 'vue-router', 'pinia'],
        dts: 'src/auto-imports.d.ts',
      }),
      Components({
        resolvers: [ElementPlusResolver({ importStyle: 'css' })],
        dts: 'src/components.d.ts',
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      // 自动导入插件生成的样式依赖不会出现在启动扫描中。预构建全部组件样式，
      // 避免首次打开懒加载页面时重新打包依赖、整页刷新并丢失内存会话。
      include: elementPlusStyles,
    },
    server: {
      // 允许手机、飞书 WebView 通过本机局域网 IP 访问开发SCDP。
      // 仅使用默认 localhost 时，192.168.x.x 会被操作系统拒绝连接。
      host: '0.0.0.0',
      port: 5100,
      // OAuth 回调必须与注册地址完全一致，端口占用时直接报错。
      strictPort: true,
      proxy: {
        '^/auth/(scdp/(session|login|logout)|oauth2/(authorize|token|jwks)|\\.well-known/openid-configuration)(?:\\?|$)': {
          target: env.VITE_OIDC_ISSUER || 'http://localhost:26881',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/auth/, ''),
          cookiePathRewrite: '/auth',
          configure: (proxy) => {
            proxy.on('proxyRes', (response) => {
              // 会话在授权前失效时回到 Vue 登录表单，不展示 IAM 服务地址。
              const location = response.headers.location
              if (location && new URL(location, env.VITE_OIDC_ISSUER || 'http://localhost:26881').pathname === '/login') {
                response.headers.location = '/#/login?reason=reauthenticate'
              }
            })
          },
        },
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:26880',
          changeOrigin: true,
        },
      },
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 800,
    },
  }
})
