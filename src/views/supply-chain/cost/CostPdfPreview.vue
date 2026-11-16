<template>
  <section class="pdf-preview" :aria-label="name">
    <div v-if="pages" class="pdf-controls">
      <el-button :disabled="busy || page <= 1" @click="page--">上一页</el-button>
      <span aria-live="polite">第 {{ page }} / {{ pages }} 页</span>
      <el-button :disabled="busy || page >= pages" @click="page++">下一页</el-button>
    </div>
    <p v-if="busy" role="status">正在加载文件…</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div class="pdf-page" :aria-busy="busy">
      <canvas ref="canvas" v-show="!error" role="img" :aria-label="`${name}，第${page}页`" />
    </div>
  </section>
</template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

const props = defineProps<{ name: string; url: string }>()
const canvas = ref<HTMLCanvasElement>(),
  page = ref(1),
  pages = ref(0),
  busy = ref(false),
  error = ref('')
let generation = 0,
  loading: PDFDocumentLoadingTask | undefined,
  document: PDFDocumentProxy | undefined,
  rendering: RenderTask | undefined

// 字体、中文字符映射和解码器随应用发布，不将业务文件发往在线预览服务。
const assets = import.meta.glob<string>('/node_modules/pdfjs-dist/{cmaps,standard_fonts,wasm}/*', {
  query: '?url',
  import: 'default',
  eager: true,
})
class LocalPdfAssets {
  async fetch({ kind, filename }: { kind: string; filename: string }) {
    const folder = { cMapUrl: 'cmaps', standardFontDataUrl: 'standard_fonts', wasmUrl: 'wasm' }[
      kind
    ]
    const url = folder && assets[`/node_modules/pdfjs-dist/${folder}/${filename}`]
    if (!url) throw new Error('PDF resource unavailable')
    const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' })
    if (!response.ok) throw new Error('PDF resource unavailable')
    return new Uint8Array(await response.arrayBuffer())
  }
}
async function draw(serial: number) {
  const pdf = document
  if (!pdf || !canvas.value) return
  busy.value = true
  try {
    const previous = rendering
    previous?.cancel()
    await previous?.promise.catch(() => {})
    const source = await pdf.getPage(page.value)
    if (serial !== generation || !canvas.value) return
    const base = source.getViewport({ scale: 1 })
    const scale = Math.min(800 / base.width, 2, Math.sqrt(4_000_000 / (base.width * base.height)))
    const viewport = source.getViewport({ scale })
    const target = canvas.value
    target.width = Math.ceil(viewport.width)
    target.height = Math.ceil(viewport.height)
    rendering = source.render({ canvas: target, viewport })
    await rendering.promise
  } catch {
    if (serial === generation) error.value = '文件暂时无法预览，请下载后查看。'
  } finally {
    if (serial === generation) busy.value = false
  }
}
watch(
  () => props.url,
  async (url) => {
    const serial = ++generation
    rendering?.cancel()
    void loading?.destroy().catch(() => {})
    document = undefined
    pages.value = 0
    page.value = 1
    error.value = ''
    busy.value = true
    try {
      const pdfjs = await import('pdfjs-dist')
      if (serial !== generation) return
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      const task = pdfjs.getDocument({
        url,
        withCredentials: false,
        useWorkerFetch: false,
        BinaryDataFactory: LocalPdfAssets,
        disableWorkerRendering: true,
        maxImageSize: 16_000_000,
      })
      loading = task
      const pdf = await task.promise
      if (serial !== generation) {
        await task.destroy()
        return
      }
      document = pdf
      pages.value = pdf.numPages
      await nextTick()
      await draw(serial)
    } catch (cause) {
      console.warn('[PDF preview]', cause instanceof Error ? cause.name : 'File load failed')
      if (serial === generation) {
        error.value = '文件暂时无法预览，请下载后查看。'
        busy.value = false
      }
    }
  },
  { immediate: true },
)
watch(page, () => {
  if (document) void draw(generation)
})
onBeforeUnmount(() => {
  generation++
  rendering?.cancel()
  void loading?.destroy().catch(() => {})
})
</script>
<style scoped>
.pdf-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}
.pdf-page {
  max-height: 65vh;
  overflow: auto;
  background: #f4f6f9;
}
canvas {
  display: block;
  max-width: 100%;
  height: auto;
  margin: auto;
}
</style>
