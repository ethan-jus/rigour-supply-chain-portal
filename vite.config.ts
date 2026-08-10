import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

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
    server: {
      // 允许手机、飞书 WebView 通过本机局域网 IP 访问开发门户。
      // 仅使用默认 localhost 时，192.168.x.x 会被操作系统拒绝连接。
      host: '0.0.0.0',
      port: 5100,
      proxy: {
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
