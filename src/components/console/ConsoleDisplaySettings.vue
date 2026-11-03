<template>
  <el-button class="display-settings-trigger" text :icon="Setting" @click="open"
    >显示设置</el-button
  >
  <el-drawer v-model="visible" title="显示设置" size="min(440px, 100vw)" append-to-body>
    <p class="display-note">统一应用于系统页面，保存在当前浏览器。</p>
    <el-form label-position="top" class="display-form" @submit.prevent="save">
      <el-form-item label="界面字体">
        <el-select v-model="draft.font" aria-label="界面字体">
          <el-option-group label="内置字体 · 无需安装">
            <el-option
              v-for="[key, font] in builtinFonts"
              :key="key"
              :label="font.label"
              :value="key"
            />
          </el-option-group>
          <el-option-group label="本机字体">
            <el-option label="系统默认" value="system" />
            <el-option
              v-for="[key, font] in localFonts"
              :key="key"
              :value="key"
              :label="`${font.label}${localAvailable[key] === undefined ? '（检测中）' : localAvailable[key] ? '' : '（未安装）'}`"
              :disabled="!localAvailable[key]"
            />
          </el-option-group>
        </el-select>
        <span class="display-note">内置字体随系统提供，无需电脑安装；切换后在下方预览。</span>
      </el-form-item>
      <div class="display-sizes">
        <el-form-item v-for="item in sizeFields" :key="item.key" :label="item.label + '（px）'">
          <el-input-number
            v-model="draft[item.key]"
            :aria-label="item.label"
            :min="item.min"
            :max="item.max"
            controls-position="right"
          />
        </el-form-item>
      </div>
    </el-form>
    <section
      class="display-preview"
      :aria-busy="fontLoading"
      :style="displayVariables(draft)"
      aria-label="显示效果预览"
    >
      <h3>效果预览</h3>
      <div class="preview-menu">订单列表　客户档案</div>
      <table>
        <thead>
          <tr>
            <th>地区名称</th>
            <th>行政编码</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>浙江省</td>
            <td>330000</td>
          </tr>
          <tr>
            <td>杭州市</td>
            <td>330100</td>
          </tr>
        </tbody>
      </table>
    </section>
    <p class="display-note font-status" role="status">
      {{ fontLoading ? '正在加载字体…' : fontError || `当前预览：${FONT_PRESETS[draft.font].label}`
      }}<el-button v-if="fontError" link type="primary" @click="previewFont">重新加载</el-button>
    </p>
    <p class="display-note font-license">
      本系统使用 MiSans 字体。<a href="/fonts/licenses/misans.pdf" target="_blank" rel="noopener"
        >字体授权</a
      >
    </p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template #footer>
      <el-button @click="Object.assign(draft, DEFAULT_DISPLAY)">恢复默认</el-button>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="fontLoading || !!fontError" @click="save"
        >应用并保存</el-button
      >
    </template>
  </el-drawer>
</template>
<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { Setting } from '@element-plus/icons-vue'
import {
  DEFAULT_DISPLAY,
  FONT_PRESETS,
  displayVariables,
  loadPreviewFont,
  isLocalFontAvailable,
  readDisplay,
  saveDisplay,
} from '@/utils/display-preferences'
const builtinFonts = Object.entries(FONT_PRESETS).filter(([, font]) => font.webFamily)
const localFonts = Object.entries(FONT_PRESETS).filter(([, font]) => font.localFamily)
const localAvailable = reactive<Record<string, boolean | undefined>>({})
const visible = ref(false)
const error = ref('')
const draft = reactive(readDisplay())
const fontLoading = ref(false)
const fontError = ref('')
let previewRequest = 0
async function previewFont() {
  const request = ++previewRequest
  fontError.value = ''
  fontLoading.value = true
  try {
    await loadPreviewFont(draft.font)
  } catch {
    if (request === previewRequest)
      fontError.value = FONT_PRESETS[draft.font].localFamily
        ? '本机未安装此字体，请选择内置字体。'
        : '字体加载失败，请重新加载后再应用。'
  } finally {
    if (request === previewRequest) fontLoading.value = false
  }
}
watch([visible, () => draft.font], ([isOpen]) => {
  if (isOpen) void previewFont()
})
const sizeFields = [
  { key: 'body', label: '正文 / 列表内容', min: 14, max: 18 },
  { key: 'tableHeader', label: '列表表头', min: 14, max: 18 },
  { key: 'menu', label: '菜单文字', min: 14, max: 18 },
  { key: 'heading', label: '页面标题', min: 16, max: 24 },
  { key: 'rowHeight', label: '列表行高', min: 36, max: 52 },
] as const
function open() {
  Object.assign(draft, readDisplay())
  error.value = ''
  visible.value = true
  for (const [key] of localFonts) {
    void isLocalFontAvailable(key as keyof typeof FONT_PRESETS).then((available) => {
      localAvailable[key] = available
    })
  }
}
function save() {
  if (fontLoading.value || fontError.value) return
  try {
    saveDisplay(draft)
    visible.value = false
  } catch {
    error.value = '浏览器未允许保存显示设置，请检查浏览器存储权限。'
  }
}
</script>
<style scoped lang="scss">
.display-settings-trigger {
  flex: none;
  color: var(--app-text-regular);
}
.display-note {
  color: var(--app-text-secondary);
  font-size: var(--app-font-size-small);
  line-height: 1.6;
  margin: 0 0 16px;
}
.display-form .display-note {
  margin: 6px 0 0;
}
.display-sizes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}
.display-sizes :deep(.el-input-number) {
  width: 100%;
}
.display-preview {
  font-family: var(--app-font-family);
  color: var(--app-text-regular);
  border: 1px solid #dce2ea;
  border-radius: 4px;
  overflow: hidden;
}
.display-preview h3 {
  font-size: var(--app-font-size-heading);
  padding: 12px;
  margin: 0;
}
.preview-menu {
  font-size: var(--app-menu-font-size);
  padding: 10px 12px;
  background: #edf3ff;
  color: #1d4ed8;
}
.display-preview table {
  border-collapse: collapse;
  width: 100%;
  font-size: var(--app-font-size-base);
}
.display-preview th,
.display-preview td {
  height: var(--app-table-row-height);
  padding: 4px 12px;
  text-align: left;
  border-bottom: 1px solid #e8ecf1;
}
.display-preview th {
  font-size: var(--app-table-header-size);
  font-weight: 600;
  background: #f1f3f6;
  color: #1f2329;
}
</style>

<style scoped>
.display-preview h3,
.display-preview table,
.display-preview th,
.display-preview td,
.preview-menu {
  font-family: var(--app-font-family);
}
.font-status {
  margin-top: 12px;
}
</style>
