<template>
  <ErpRecordDrawer v-model="visible" title="供应商详情" size="min(840px, 96vw)" destroy-on-close>
    <div v-loading="loading" class="supplier-detail">
      <template v-if="supplier">
        <header class="supplier-summary">
          <div>
            <h2>{{ supplier.supplierName }}</h2>
            <span>{{ supplier.supplierCode }}</span>
          </div>
          <el-tag :type="supplier.statusCode === 'ACTIVE' ? 'success' : 'info'">{{
            supplier.statusCode === 'ACTIVE' ? '启用' : '停用'
          }}</el-tag>
        </header>
        <section>
          <h3>联系信息</h3>
          <dl>
            <div>
              <dt>联系人</dt>
              <dd>{{ supplier.contactName || '—' }}</dd>
            </div>
            <div>
              <dt>联系电话</dt>
              <dd>{{ supplier.contactPhone || '—' }}</dd>
            </div>
            <div class="full">
              <dt>联系地址</dt>
              <dd>{{ supplier.address || '—' }}</dd>
            </div>
          </dl>
        </section>
        <section>
          <h3>财务信息</h3>
          <dl>
            <div class="full">
              <dt>开户名称</dt>
              <dd>{{ supplier.accountName || '—' }}</dd>
            </div>
            <div>
              <dt>开户银行</dt>
              <dd>{{ supplier.bankName || '—' }}</dd>
            </div>
            <div>
              <dt>银行账号</dt>
              <dd>{{ supplier.bankAccountNo || '—' }}</dd>
            </div>
            <div class="full">
              <dt>开票抬头</dt>
              <dd>{{ supplier.invoiceTitle || '—' }}</dd>
            </div>
            <div class="full">
              <dt>纳税人识别号</dt>
              <dd>{{ supplier.taxpayerNumber || '—' }}</dd>
            </div>
          </dl>
        </section>
        <section>
          <h3>备注</h3>
          <p>{{ supplier.remark || '暂无备注' }}</p>
        </section>
        <div class="supplier-audit">
          创建时间：{{ time(supplier.createdTime)
          }}<span>更新时间：{{ time(supplier.updatedTime) }}</span>
        </div>
      </template>
      <el-empty v-else-if="!loading" description="供应商加载失败"
        ><el-button @click="load">重新加载</el-button></el-empty
      >
    </div>
    <template #footer><el-button @click="visible = false">关闭</el-button></template>
  </ErpRecordDrawer>
</template>
<script setup lang="ts">
import ErpRecordDrawer from './ErpRecordDrawer.vue'
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getErpSupplierProfile, type ErpSupplierProfileView } from '@/api/core/erp-internal'
import { errorMessage } from '@/api/core/error'
const visible = defineModel<boolean>({ default: false }),
  props = defineProps<{ supplierId?: string }>()
const supplier = ref<ErpSupplierProfileView>(),
  loading = ref(false)
let request = 0
const time = (value?: string | null) =>
  value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
async function load() {
  if (!props.supplierId) return
  const token = ++request
  loading.value = true
  try {
    const row = await getErpSupplierProfile(props.supplierId)
    if (token === request) supplier.value = row
  } catch (reason) {
    if (token === request) ElMessage.error(errorMessage(reason, '供应商详情加载失败'))
  } finally {
    if (token === request) loading.value = false
  }
}
watch(visible, (value) => {
  if (value) {
    supplier.value = undefined
    void load()
  } else request++
})
</script>
<style scoped>
.supplier-detail {
  min-height: 200px;
}
.supplier-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 24px;
}
.supplier-summary h2 {
  margin: 0 0 6px;
  font-size: 20px;
  line-height: 28px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.supplier-summary span {
  font-size: 13px;
  color: #64748b;
}
.supplier-detail section {
  margin-bottom: 18px;
  padding: 18px 20px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
}
.supplier-detail h3 {
  margin: 0 0 18px;
  font-size: 15px;
  font-weight: 600;
}
.supplier-detail dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px 28px;
  margin: 0;
}
.supplier-detail .full {
  grid-column: 1/-1;
}
.supplier-detail dt {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 6px;
}
.supplier-detail dd,
.supplier-detail p {
  font-size: 14px;
  line-height: 22px;
  color: #172033;
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.supplier-audit {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #94a3b8;
}
@media (max-width: 600px) {
  .supplier-detail dl {
    grid-template-columns: 1fr;
  }
  .supplier-detail section {
    padding: 16px;
  }
}
</style>
