<template>
  <el-alert v-if="error" type="error" :closable="false" :title="error">
    <el-button text @click="revision++">重试</el-button>
  </el-alert>
  <p v-else-if="!content" role="status">正在读取拜访内容…</p>
  <div v-else class="visit-content">
    <template v-if="form">
      <section>
        <h4><Shop />门店情况</h4>
        <dl>
          <dt>经营类型</dt>
          <dd>{{ form.businessType || '未记录' }}</dd>
          <dt>营业状态</dt>
          <dd>{{ form.businessStatus || '未记录' }}</dd>
        </dl>
        <p v-if="form.statusReason" class="note"><span>状态说明</span>{{ form.statusReason }}</p>
      </section>
      <section>
        <h4><ChatLineSquare />本次沟通</h4>
        <dl>
          <dt>沟通结果</dt>
          <dd>
            <b class="outcome" :class="{ quiet: !form.contacted }">{{ form.outcome }}</b>
          </dd>
          <template v-if="form.contacted"
            ><dt>接待人</dt>
            <dd>
              {{
                form.contacts.map((c) => [c.name, c.role].filter(Boolean).join(' · ')).join('、') ||
                '未记录'
              }}
            </dd></template
          >
          <template v-else
            ><dt>未接触原因</dt>
            <dd>{{ form.noContactReason || '未记录' }}</dd></template
          >
        </dl>
        <p v-if="!form.contacted && form.noContactDetail" class="note">
          <span>原因说明</span>{{ form.noContactDetail }}
        </p>
        <p
          v-if="visit.result && (form.contacted || visit.result !== form.noContactDetail)"
          class="note"
        >
          <span>补充记录</span>{{ visit.result }}
        </p>
      </section>
      <section v-if="form.contacted">
        <h4><Files />业务进展</h4>
        <p v-if="form.noIntention">暂无合作意向</p>
        <table v-else-if="form.businesses.length">
          <thead>
            <tr>
              <th>业务名称</th>
              <th>合作意向</th>
              <th>合作进展</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in form.businesses" :key="line.business">
              <th scope="row">{{ line.business }}</th>
              <td>
                <span :class="{ intent: line.intention }">{{ line.intention || '—' }}</span>
              </td>
              <td :class="{ signed: line.progress }">{{ line.progress || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else>未记录业务进展</p>
      </section>
      <section>
        <h4><Calendar />后续跟进</h4>
        <dl v-if="form.nextAction || form.nextDate">
          <dt>下次行动</dt>
          <dd>{{ form.nextAction || '未记录' }}</dd>
          <dt>跟进日期</dt>
          <dd>{{ form.nextDate || '未记录' }}</dd>
        </dl>
        <p v-else>未安排后续跟进</p>
      </section>
    </template>
    <section v-else>
      <h4>
        <ChatLineSquare />{{ content.submitted || visit.result ? '历史拜访备注' : '拜访内容' }}
      </h4>
      <p>{{ content.submitted || visit.result ? '本次未记录详细表单' : '尚未提交拜访内容' }}</p>
      <p v-if="visit.result" class="note">{{ visit.result }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Shop, ChatLineSquare, Files, Calendar } from '@element-plus/icons-vue'
import {
  readVisitContent,
  type ReportVisit,
  type VisitContent,
} from '@/api/core/sales-fieldwork-report'

const props = defineProps<{ visit: ReportVisit }>()
const content = ref<VisitContent | null>(null)
const form = computed(() => content.value?.form)
const revision = ref(0)
const error = ref('')
watch(
  [() => props.visit.id, revision],
  async (_, __, onCleanup) => {
    const request = new AbortController()
    onCleanup(() => request.abort())
    error.value = ''
    content.value = null
    try {
      const result = await readVisitContent(props.visit.id, request.signal)
      if (!request.signal.aborted) content.value = result
    } catch (cause) {
      if (!request.signal.aborted)
        error.value = cause instanceof Error ? cause.message : '拜访内容读取失败'
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.visit-content {
  font-size: 13px;
  line-height: 1.55;
  color: #1b334a;
  overflow-wrap: anywhere;
}
section {
  padding: 12px 0;
}
section + section {
  border-top: 1px solid #e2e9ef;
}
h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 650;
}
h4 svg {
  width: 17px;
  height: 17px;
  color: #4b7195;
}
dl {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr) max-content minmax(0, 1fr);
  gap: 6px 12px;
  margin: 0;
  align-items: baseline;
}
dt,
.note span {
  color: #597084;
  font-size: 12px;
}
dd {
  margin: 0;
}
p {
  margin: 6px 0 0;
  color: #536779;
}
.note {
  color: #253d51;
  background: #f6f8fa;
  border-left: 2px solid #c7d7e6;
  padding: 7px 10px;
  white-space: pre-wrap;
}
.note span {
  margin-right: 12px;
}
table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  table-layout: fixed;
}
th,
td {
  padding: 4px 11px;
  border-bottom: 1px solid #e4ebf1;
}
thead th {
  color: #5c7185;
  font-size: 12px;
  background: #f3f6f9;
}
th {
  font-weight: 550;
}
.outcome,
.intent {
  display: inline-block;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 550;
  padding: 1px 7px;
  background: #eaf1ff;
  color: #2e60aa;
}
.quiet,
.intent {
  background: #eff3f7;
  color: #52677b;
}
.signed {
  color: #247454;
}
@media (max-width: 580px) {
  dl {
    grid-template-columns: max-content 1fr;
  }
}
</style>
