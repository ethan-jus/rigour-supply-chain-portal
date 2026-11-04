<template>
  <ErpListWorkspace title="供应商档案列表" :total="total">
    <template #filters
      ><el-form :model="filters" label-width="88px" @submit.prevent="search"
        ><div class="erp-query-grid">
          <el-form-item label="供应商编码"
            ><el-input v-model="filters.supplierCode" clearable placeholder="输入供应商编码"
          /></el-form-item>
          <el-form-item label="供应商名称"
            ><el-input v-model="filters.supplierName" clearable placeholder="输入供应商名称"
          /></el-form-item>
          <el-form-item label="联系电话"
            ><el-input v-model="filters.contactPhone" clearable placeholder="输入联系电话"
          /></el-form-item>
          <el-form-item label="状态"
            ><el-select v-model="filters.statusCode" clearable placeholder="全部状态"
              ><el-option label="启用" value="ACTIVE" /><el-option
                label="停用"
                value="DISABLED" /></el-select
          ></el-form-item>
        </div>
        <div class="erp-query-actions">
          <el-button :icon="Search" type="primary" native-type="submit" :loading="loading"
            >查询</el-button
          ><el-button :icon="Refresh" @click="reset">重置</el-button>
        </div></el-form
      ></template
    >
    <template #actions
      ><DhbPageSyncButton scope="SUPPLIER" label="供应商" @completed="load" /><el-button
        v-if="can('erp:supply:write')"
        type="primary"
        :icon="Plus"
        @click="openEditor()"
        >新增供应商</el-button
      ></template
    >
    <template #default
      ><el-table v-loading="loading" :data="rows" row-key="id" height="100%">
        <el-table-column
          type="index"
          label="序号"
          width="65"
          :index="(i: number) => (page - 1) * size + i + 1"
        />
        <el-table-column prop="supplierCode" label="供应商编码" width="165" show-overflow-tooltip />
        <!-- @vue-generic {ErpSupplierProfileView} --><el-table-column
          label="供应商名称"
          min-width="220"
          show-overflow-tooltip
          ><template #default="{ row }"
            ><el-button link type="primary" @click="openDetail(row)">{{
              row.supplierName
            }}</el-button></template
          ></el-table-column
        >
        <el-table-column prop="contactName" label="联系人" width="115" show-overflow-tooltip />
        <el-table-column prop="contactPhone" label="联系电话" width="160" show-overflow-tooltip />
        <!-- @vue-generic {ErpSupplierProfileView} --><el-table-column label="状态" width="90"
          ><template #default="{ row }"
            ><el-tag :type="row.statusCode === 'ACTIVE' ? 'success' : 'info'">{{
              row.statusCode === 'ACTIVE' ? '启用' : '停用'
            }}</el-tag></template
          ></el-table-column
        >
        <!-- @vue-generic {ErpSupplierProfileView} --><el-table-column label="更新时间" width="170"
          ><template #default="{ row }">{{
            displayDateTime(row.updatedTime)
          }}</template></el-table-column
        >
        <!-- @vue-generic {ErpSupplierProfileView} --><el-table-column
          label="操作"
          width="180"
          fixed="right"
          ><template #default="{ row }"
            ><div class="erp-row-actions">
              <el-button link type="primary" @click="openDetail(row)">查看</el-button
              ><el-button
                v-if="can('erp:supply:write')"
                link
                type="primary"
                @click="openEditor(row)"
                >编辑</el-button
              ><el-button v-if="can('erp:supply:write')" link type="danger" @click="remove(row)"
                >删除</el-button
              >
            </div></template
          ></el-table-column
        >
        <template #empty
          ><el-empty :description="failed ? '加载失败，请重试' : '暂无供应商档案'" :image-size="72"
            ><el-button v-if="failed" @click="load">重新加载</el-button></el-empty
          ></template
        >
      </el-table></template
    >
    <template #pagination
      ><el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :page-sizes="[20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="search"
    /></template>
  </ErpListWorkspace>
  <ErpSupplierProfileEditor v-model="editorVisible" :supplier-id="selectedId" @saved="load" />
  <ErpSupplierDetail v-model="detailVisible" :supplier-id="selectedId" />
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus } from '@element-plus/icons-vue'
import {
  getErpSupplierProfiles,
  deleteErpSupplierProfile,
  type ErpSupplierProfileView,
} from '@/api/core/erp-internal'
import { errorMessage } from '@/api/core/error'
import { displayDateTime } from '@/utils/business-date'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import ErpListWorkspace from '@/components/erp/ErpListWorkspace.vue'
import ErpSupplierProfileEditor from '@/components/erp/ErpSupplierProfileEditor.vue'
import ErpSupplierDetail from '@/components/erp/ErpSupplierDetail.vue'
import DhbPageSyncButton from '@/components/supply/DhbPageSyncButton.vue'
const { can } = useSupplyPermissions()
const filters = reactive({ supplierCode: '', supplierName: '', contactPhone: '', statusCode: '' })
const rows = ref<ErpSupplierProfileView[]>([]),
  total = ref(0),
  page = ref(1),
  size = ref(20),
  loading = ref(false),
  failed = ref(false),
  editorVisible = ref(false),
  detailVisible = ref(false),
  selectedId = ref<string>()
let request = 0
async function load() {
  const token = ++request
  loading.value = true
  failed.value = false
  try {
    const data = await getErpSupplierProfiles({
      begin: (page.value - 1) * size.value,
      step: size.value,
      supplierCode: filters.supplierCode.trim() || undefined,
      supplierName: filters.supplierName.trim() || undefined,
      contactPhone: filters.contactPhone.trim() || undefined,
      statusCode: filters.statusCode || undefined,
    })
    if (token !== request) return
    rows.value = data.items
    total.value = data.total
    if (page.value > 1 && !data.items.length) {
      page.value--
      void load()
    }
  } catch (reason) {
    if (token === request) {
      failed.value = true
      rows.value = []
      total.value = 0
      ElMessage.error(errorMessage(reason, '供应商列表加载失败'))
    }
  } finally {
    if (token === request) loading.value = false
  }
}
function search() {
  page.value = 1
  void load()
}
function reset() {
  Object.assign(filters, { supplierCode: '', supplierName: '', contactPhone: '', statusCode: '' })
  search()
}
function openEditor(row?: ErpSupplierProfileView) {
  selectedId.value = row ? String(row.id) : undefined
  editorVisible.value = true
}
function openDetail(row: ErpSupplierProfileView) {
  selectedId.value = String(row.id)
  detailVisible.value = true
}
async function remove(row: ErpSupplierProfileView) {
  try {
    await ElMessageBox.confirm(`确认删除供应商“${row.supplierName}”？`, '删除供应商', {
      type: 'warning',
      confirmButtonText: '删除',
    })
  } catch {
    return
  }
  try {
    await deleteErpSupplierProfile(row.id, row.revision)
    ElMessage.success('供应商已删除')
    await load()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '供应商删除失败，请刷新后重试'))
  }
}
onMounted(() => {
  void load()
})
</script>
