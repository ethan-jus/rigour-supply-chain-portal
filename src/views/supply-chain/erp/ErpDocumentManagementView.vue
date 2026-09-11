<template>
  <div class="erp-document-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">{{ pageConfig.eyebrow }}</span>
        <h1>{{ pageConfig.title }}</h1>
        <p>{{ pageConfig.description }}</p>
      </div>
      <div class="heading-actions">
        <el-button v-if="mode === 'procurement' || mode === 'transfer'" type="primary" @click="openCreate">
          新增{{ pageConfig.shortTitle }}
        </el-button>
      </div>
    </div>

    <div class="workflow-strip" :aria-label="`${pageConfig.title}业务流程`">
      <div v-for="step in workflowSteps" :key="step.title" class="workflow-step" :class="{ 'is-active': step.active }">
        <span>{{ step.index }}</span>
        <strong>{{ step.title }}</strong>
        <small>{{ step.description }}</small>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="searchRows">
        <el-form-item :label="`${pageConfig.shortTitle}号`">
          <el-input v-model="filters.documentNo" clearable :placeholder="documentNoPlaceholder" style="width: 210px" />
        </el-form-item>
        <el-form-item v-if="mode === 'stockOut'" label="客户名称">
          <el-input v-model="filters.customerName" clearable placeholder="销售出库客户" style="width: 180px" />
        </el-form-item>
        <el-form-item v-if="mode === 'stockOut'" label="销售订单">
          <el-input v-model="filters.salesOrderNo" clearable placeholder="销售订单号" style="width: 180px" />
        </el-form-item>
        <el-form-item v-if="mode === 'stockIn'" label="入库类型">
          <el-select v-model="filters.stockInTypeCode" clearable placeholder="全部类型" style="width: 150px">
            <el-option v-for="item in stockInTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="mode === 'stockOut'" label="出库类型">
          <el-select v-model="filters.stockOutTypeCode" clearable placeholder="全部类型" style="width: 150px">
            <el-option v-for="item in stockOutTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="mode === 'procurement' || mode === 'stockIn'" label="供应商">
          <el-select
            v-model="filters.supplierId"
            clearable
            filterable
            remote
            reserve-keyword
            :remote-method="searchSuppliers"
            :loading="supplierLoading"
            placeholder="全部供应商"
            style="width: 180px"
          >
            <el-option v-for="item in supplierOptions" :key="item.id" :label="item.supplierName" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="mode !== 'transfer'" :label="warehouseFilterLabel">
          <el-select
            v-model="filters.warehouseId"
            clearable
            filterable
            remote
            reserve-keyword
            :remote-method="searchWarehouses"
            :loading="warehouseLoading"
            placeholder="全部仓库"
            style="width: 170px"
          >
            <el-option v-for="item in warehouseOptions" :key="item.id" :label="item.warehouseName" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="mode === 'transfer'" label="调出仓库">
          <el-select
            v-model="filters.sourceWarehouseId"
            clearable
            filterable
            remote
            reserve-keyword
            :remote-method="searchWarehouses"
            :loading="warehouseLoading"
            placeholder="全部调出仓"
            style="width: 170px"
          >
            <el-option v-for="item in warehouseOptions" :key="item.id" :label="item.warehouseName" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="mode === 'transfer'" label="调入仓库">
          <el-select
            v-model="filters.targetWarehouseId"
            clearable
            filterable
            remote
            reserve-keyword
            :remote-method="searchWarehouses"
            :loading="warehouseLoading"
            placeholder="全部调入仓"
            style="width: 170px"
          >
            <el-option v-for="item in warehouseOptions" :key="item.id" :label="item.warehouseName" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="timeRangeLabel">
          <el-date-picker
            v-model="filters.timeRange"
            type="datetimerange"
            unlink-panels
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="截止时间"
            style="width: 330px"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.statusCode" clearable placeholder="全部状态" style="width: 140px">
            <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item class="filter-actions">
          <el-button type="primary" :loading="loading" native-type="submit">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="result-heading">
      <div>
        <div class="result-title-line">
          <h2>{{ pageConfig.title }}列表</h2>
          <span class="result-count"><strong>{{ pageData.total }}</strong> 条</span>
        </div>
      </div>
    </div>

    <el-card class="list-card" shadow="never">
      <div class="table-viewport">
        <el-table
          class="business-table supply-scroll-table"
          height="100%"
          v-loading="loading"
          :data="pageData.items"
          row-key="id"
          @row-click="openDetail"
        >
          <el-table-column type="index" label="序号" width="80" fixed="left" :index="tableRowIndex" />
          <el-table-column :label="`${pageConfig.shortTitle}号`" width="190" show-overflow-tooltip>
            <template #default="scope"><strong>{{ documentNo(scope.row) }}</strong></template>
          </el-table-column>
          <el-table-column v-if="mode === 'procurement'" label="供应商" min-width="190" show-overflow-tooltip>
            <template #default="scope">{{ supplierName(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'procurement'" label="入库仓库" min-width="170" show-overflow-tooltip>
            <template #default="scope">{{ targetWarehouseName(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'procurement'" label="预计到货" width="170">
            <template #default="scope">{{ formatTime(expectedArrivalTime(scope.row)) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'stockIn'" label="入库类型" width="130">
            <template #default="scope">{{ stockInTypeLabel(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'stockIn'" label="来源采购单" width="170" show-overflow-tooltip>
            <template #default="scope">{{ procurementNo(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'stockIn'" label="来源调拨单" width="170" show-overflow-tooltip>
            <template #default="scope">{{ transferNo(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'stockIn'" label="入库仓库" min-width="170" show-overflow-tooltip>
            <template #default="scope">{{ warehouseName(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'stockIn'" label="供应商" min-width="170" show-overflow-tooltip>
            <template #default="scope">{{ supplierName(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'stockIn'" label="入库时间" width="170">
            <template #default="scope">{{ formatTime(stockInTime(scope.row)) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'stockOut'" label="出库类型" width="130">
            <template #default="scope">{{ stockOutTypeLabel(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'stockOut'" label="销售订单" width="170" show-overflow-tooltip>
            <template #default="scope">{{ salesOrderNo(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'stockOut'" label="调拨单号" width="170" show-overflow-tooltip>
            <template #default="scope">{{ transferNo(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'stockOut'" label="客户名称" min-width="190" show-overflow-tooltip>
            <template #default="scope">{{ customerName(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'stockOut'" label="出库仓库" min-width="170" show-overflow-tooltip>
            <template #default="scope">{{ warehouseName(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'stockOut'" label="出库时间" width="170">
            <template #default="scope">{{ formatTime(stockOutTime(scope.row)) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'transfer'" label="来源仓库" min-width="180" show-overflow-tooltip>
            <template #default="scope">{{ sourceWarehouseName(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'transfer'" label="目标仓库" min-width="180" show-overflow-tooltip>
            <template #default="scope">{{ targetWarehouseName(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'transfer'" label="调拨出库单" width="170" show-overflow-tooltip>
            <template #default="scope">{{ stockOutNo(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'transfer'" label="调拨入库单" width="170" show-overflow-tooltip>
            <template #default="scope">{{ stockInNo(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'transfer'" label="出库时间" width="170">
            <template #default="scope">{{ formatTime(stockOutTime(scope.row)) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'transfer'" label="入库时间" width="170">
            <template #default="scope">{{ formatTime(stockInTime(scope.row)) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="120">
            <template #default="scope">
              <el-tag :type="statusTag(scope.row.statusCode)" effect="light">{{ statusLabel(scope.row.statusCode) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="商品数量" width="110" align="right">
            <template #default="scope">{{ formatNumber(scope.row.totalQuantity) }}</template>
          </el-table-column>
          <el-table-column v-if="mode === 'procurement' || mode === 'stockIn'" label="金额" width="130" align="right">
            <template #default="scope">{{ formatMoney(scope.row.totalAmount) }}</template>
          </el-table-column>
          <el-table-column label="更新时间" width="170">
            <template #default="scope">{{ formatTime(scope.row.updatedTime) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="260" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openDetail(scope.row)">详情</el-button>
              <el-button v-if="canEdit(scope.row)" link type="primary" @click.stop="openEdit(scope.row)">编辑</el-button>
              <el-button v-if="canStockIn(scope.row)" link type="primary" @click.stop="openProcurementStockIn(scope.row)">入库</el-button>
              <el-button v-if="canTransferStockOut(scope.row)" link type="primary" @click.stop="openTransferAction(scope.row, 'out')">确认出库</el-button>
              <el-button v-if="canTransferStockIn(scope.row)" link type="primary" @click.stop="openTransferAction(scope.row, 'in')">确认入库</el-button>
              <el-button v-if="canDelete(scope.row)" link type="danger" @click.stop="deleteDocument(scope.row)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty :description="`暂无${pageConfig.shortTitle}`" /></template>
        </el-table>
      </div>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100]"
          :total="pageData.total"
          @current-change="loadRows"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-drawer v-model="detailVisible" class="erp-document-detail-drawer" size="min(980px, 92vw)" :with-header="false">
      <div v-if="detail" class="detail-shell">
        <header class="detail-hero">
          <div>
            <span>{{ pageConfig.shortTitle }}详情</span>
            <h2>{{ documentNo(detail) }}</h2>
            <p>{{ mainRelation(detail) }}</p>
          </div>
          <el-button circle plain :aria-label="`关闭${pageConfig.shortTitle}详情`" @click="detailVisible = false">×</el-button>
        </header>
        <div class="detail-content">
          <div class="detail-summary detail-summary--three">
            <div><span>状态</span><strong>{{ statusLabel(detail.statusCode) }}</strong></div>
            <div><span>数量</span><strong>{{ formatNumber(detail.totalQuantity) }}</strong></div>
            <div><span>明细行</span><strong>{{ detail.lines?.length || detail.lineCount || 0 }}</strong></div>
          </div>
          <el-descriptions :column="3" border>
            <el-descriptions-item
              v-for="item in documentDetailItems(detail)"
              :key="item.label"
              :label="item.label"
              :span="item.span || 1"
            >
              {{ item.value }}
            </el-descriptions-item>
          </el-descriptions>
          <h3 class="detail-title">商品明细</h3>
          <el-table class="supply-scroll-table detail-table" :data="detail.lines || []" max-height="360" size="small">
            <el-table-column prop="productName" label="商品" min-width="220" fixed="left">
              <template #default="scope">{{ lineProductName(scope.row) }}</template>
            </el-table-column>
            <el-table-column label="商品编码" width="150"><template #default="scope">{{ lineProductCode(scope.row) || '-' }}</template></el-table-column>
            <el-table-column label="规格编码" width="150"><template #default="scope">{{ lineVariantCode(scope.row) || '-' }}</template></el-table-column>
            <el-table-column label="单位" width="90">
              <template #default="scope">{{ unitLabel(scope.row.unitCode) }}</template>
            </el-table-column>
            <el-table-column label="数量" width="110" align="right"><template #default="scope">{{ formatNumber(scope.row.quantity) }}</template></el-table-column>
            <el-table-column v-if="mode === 'procurement'" label="已入库数量" width="120" align="right">
              <template #default="scope">{{ formatNumber(scope.row.receivedQuantity) }}</template>
            </el-table-column>
            <el-table-column v-if="mode === 'procurement' || mode === 'stockIn'" label="单价" width="120" align="right">
              <template #default="scope">{{ formatMoney(scope.row.unitPrice) }}</template>
            </el-table-column>
            <el-table-column v-if="mode === 'procurement' || mode === 'stockIn'" label="金额" width="130" align="right">
              <template #default="scope">{{ formatMoney(scope.row.lineAmount ?? scope.row.amount) }}</template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
          </el-table>
        </div>
      </div>
      <el-skeleton v-else :rows="8" animated />
    </el-drawer>

    <el-dialog v-model="editorVisible" :title="editingId ? `编辑${pageConfig.shortTitle}` : `新增${pageConfig.shortTitle}`" width="min(1040px, 94vw)" destroy-on-close>
      <el-form :model="form" label-width="110px">
        <el-row :gutter="16">
          <el-col v-if="mode === 'procurement'" :span="12">
            <el-form-item label="供应商">
              <el-select v-model="form.supplierId" filterable remote reserve-keyword placeholder="搜索供应商" :remote-method="searchSuppliers" :loading="supplierLoading" style="width: 100%">
                <el-option v-for="item in supplierOptions" :key="item.id" :label="item.supplierName" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="mode === 'procurement' ? '入库仓库' : '来源仓库'">
              <el-select v-model="form.sourceWarehouseId" filterable remote reserve-keyword placeholder="搜索仓库" :remote-method="searchWarehouses" :loading="warehouseLoading" style="width: 100%">
                <el-option v-for="item in warehouseOptions" :key="item.id" :label="item.warehouseName" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col v-if="mode === 'transfer'" :span="12">
            <el-form-item label="目标仓库">
              <el-select v-model="form.targetWarehouseId" filterable remote reserve-keyword placeholder="搜索仓库" :remote-method="searchWarehouses" :loading="warehouseLoading" style="width: 100%">
                <el-option v-for="item in warehouseOptions" :key="item.id" :label="item.warehouseName" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col v-if="mode === 'procurement'" :span="12">
            <el-form-item label="预计到货">
              <el-date-picker v-model="form.expectedArrivalTime" type="datetime" placeholder="预计到货时间" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="1000" show-word-limit />
            </el-form-item>
          </el-col>
        </el-row>
        <div class="form-section-title">
          <h3>商品明细</h3>
          <el-button @click="addLine">添加商品</el-button>
        </div>
        <div v-for="(line, index) in form.lines" :key="line.localId" class="line-editor">
          <el-row :gutter="12">
            <el-col :span="7">
              <el-form-item :label="`商品${index + 1}`">
                <el-select v-model="line.productId" filterable remote reserve-keyword placeholder="搜索商品" :remote-method="searchProducts" :loading="productLoading" style="width: 100%" @change="selectProduct(line)">
                  <el-option v-for="item in productOptions" :key="item.id" :label="item.productName" :value="item.id" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="5">
              <el-form-item label="规格">
                <el-select v-model="line.productVariantId" placeholder="选择规格" style="width: 100%" @change="selectVariant(line)">
                  <el-option v-for="item in line.variants" :key="item.id" :label="variantLabel(item)" :value="item.id" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="4">
              <el-form-item label="数量">
                <el-input-number v-model="line.quantity" :min="0.000001" :precision="2" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col v-if="mode === 'procurement'" :span="4">
              <el-form-item label="单价">
                <el-input-number v-model="line.unitPrice" :min="0" :precision="2" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="4" class="line-actions">
              <el-button type="danger" link @click="removeLine(index)">删除</el-button>
            </el-col>
          </el-row>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button v-if="mode === 'procurement'" :loading="saving" @click="saveDocument(false)">保存草稿</el-button>
        <el-button v-if="mode === 'procurement'" type="primary" :loading="saving" @click="saveDocument(true)">保存并提交</el-button>
        <el-button v-else type="primary" :loading="saving" @click="saveDocument(false)">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="stockInVisible" title="确认采购入库" width="min(860px, 92vw)" destroy-on-close>
      <el-alert class="request-hint" type="info" show-icon :closable="false" title="确认后会生成入库单，并增加采购单目标仓库库存。" />
      <el-form :model="stockInForm" label-width="110px">
        <el-form-item label="入库时间">
          <el-date-picker v-model="stockInForm.stockInTime" type="datetime" placeholder="默认当前时间" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="stockInForm.remark" type="textarea" :rows="2" maxlength="1000" show-word-limit />
        </el-form-item>
        <el-table :data="stockInForm.lines" size="small" max-height="300">
          <el-table-column prop="productName" label="商品" min-width="220" />
          <el-table-column label="单位" width="90">
            <template #default="scope">{{ unitLabel(scope.row.unitCode) }}</template>
          </el-table-column>
          <el-table-column label="可入库" width="110" align="right"><template #default="scope">{{ formatNumber(scope.row.remainingQuantity) }}</template></el-table-column>
          <el-table-column label="本次入库" width="180">
            <template #default="scope"><el-input-number v-model="scope.row.quantity" :min="0" :max="scope.row.remainingQuantity" :precision="2" /></template>
          </el-table-column>
        </el-table>
      </el-form>
      <template #footer>
        <el-button @click="stockInVisible = false">取消</el-button>
        <el-button type="primary" :loading="stockInLoading" @click="confirmStockIn">确认入库</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="transferActionVisible" :title="transferActionType === 'out' ? '确认调拨出库' : '确认调拨入库'" width="520px" destroy-on-close>
      <el-form :model="transferActionForm" label-width="110px">
        <el-form-item :label="transferActionType === 'out' ? '出库时间' : '入库时间'">
          <el-date-picker v-model="transferActionForm.time" type="datetime" placeholder="默认当前时间" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="transferActionForm.remark" type="textarea" :rows="2" maxlength="1000" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="transferActionVisible = false">取消</el-button>
        <el-button type="primary" :loading="transferActionLoading" @click="confirmTransferAction">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  confirmProcurementStockIn,
  confirmTransferStockIn,
  confirmTransferStockOut,
  createProcurementOrder,
  createTransferOrder,
  deleteProcurementOrder,
  deleteTransferOrder,
  getProcurementOrder,
  getProcurementOrders,
  getStockInOrder,
  getStockInOrders,
  getStockOutOrder,
  getStockOutOrders,
  getTransferOrder,
  getTransferOrders,
  updateProcurementOrder,
  updateTransferOrder,
  type ProcurementOrderDetail,
  type ProcurementOrderLine,
  type ProcurementOrderSummary,
  type ProcurementStockInCommand,
  type StockInOrderDetail,
  type StockInOrderSummary,
  type StockOutOrderDetail,
  type StockOutOrderSummary,
  type TransferOrderDetail,
  type TransferOrderSummary,
} from '@/api/core/erp-documents'
import {
  getErpInventoryWarehouses,
  getErpSupplierProfiles,
  type ErpInternalPage,
  type ErpInternalWarehouseView,
  type ErpSupplierProfileView,
} from '@/api/core/erp-internal'
import {
  getErpManagedProduct,
  getErpManagedProducts,
  type ErpManagedProductSummary,
  type ErpManagedProductVariant,
} from '@/api/core/erp-product'
import {
  businessDictionaryLabel,
  businessDictionaryOptions,
  loadBusinessDictionaries,
} from '@/utils/business-dictionary'

type DocumentMode = 'procurement' | 'stockIn' | 'stockOut' | 'transfer'
type DocumentSummary = ProcurementOrderSummary | StockInOrderSummary | StockOutOrderSummary | TransferOrderSummary
type DocumentDetail = ProcurementOrderDetail | StockInOrderDetail | StockOutOrderDetail | TransferOrderDetail
type WorkflowStep = { index: number; title: string; description: string; active: boolean }
type FilterDateRange = Array<Date | string> | null

interface LineForm {
  localId: string
  productId: string
  productVariantId: string
  productName: string
  unitCode: string
  quantity: number
  unitPrice: number
  variants: ErpManagedProductVariant[]
}

interface StockInLineForm {
  procurementOrderLineId: string
  productName: string
  unitCode: string
  remainingQuantity: number
  quantity: number
}

const route = useRoute()

const pageConfigs: Record<DocumentMode, { title: string; shortTitle: string; eyebrow: string; description: string; avatar: string }> = {
  procurement: { title: '采购订单', shortTitle: '采购单', eyebrow: 'ERP · 采购管理', description: '创建采购商品和供应商订单，后续按订单确认入库。', avatar: '采' },
  stockIn: { title: '入库单', shortTitle: '入库单', eyebrow: 'ERP · 库存管理', description: '查看采购入库或调拨入库生成的入库凭证。', avatar: '入' },
  stockOut: { title: '出库单', shortTitle: '出库单', eyebrow: 'ERP · 库存管理', description: '查看销售出库或调拨出库生成的出库凭证。', avatar: '出' },
  transfer: { title: '库存调拨', shortTitle: '调拨单', eyebrow: 'ERP · 库存管理', description: '独立处理仓库之间的库存转移。', avatar: '调' },
}

const workflowConfigs: Record<DocumentMode, Array<Omit<WorkflowStep, 'active'>>> = {
  procurement: [
    { index: 1, title: '新增采购单', description: '选择供应商和采购商品' },
    { index: 2, title: '提交采购单', description: '确认采购数量和价格' },
    { index: 3, title: '确认入库', description: '到货后生成入库单' },
  ],
  stockIn: [
    { index: 1, title: '业务来源', description: '采购订单或调拨单确认生成' },
    { index: 2, title: '入库凭证', description: '记录入库仓库和商品数量' },
    { index: 3, title: '增加库存', description: '库存余额随入库单增加' },
  ],
  stockOut: [
    { index: 1, title: '业务来源', description: '销售订单或调拨单确认生成' },
    { index: 2, title: '出库凭证', description: '记录出库仓库和商品数量' },
    { index: 3, title: '扣减库存', description: '库存余额随出库单扣减' },
  ],
  transfer: [
    { index: 1, title: '新增调拨单', description: '选择来源仓和目标仓' },
    { index: 2, title: '确认调拨出库', description: '来源仓生成调拨出库单' },
    { index: 3, title: '确认调拨入库', description: '目标仓生成调拨入库单' },
    { index: 4, title: '完成调拨', description: '两边库存变动闭环' },
  ],
}

const mode = computed<DocumentMode>(() => {
  const routeKey = String(route.meta.routeKey || '')
  if (routeKey.includes('procurement.orders')) return 'procurement'
  if (routeKey.includes('inventory.outbound')) return 'stockOut'
  if (routeKey.includes('inventory.transfers')) return 'transfer'
  return 'stockIn'
})
const pageConfig = computed(() => pageConfigs[mode.value])
const statusDictionaryCode = computed(() => {
  if (mode.value === 'procurement') return 'PURCHASE_STATUS'
  if (mode.value === 'stockIn') return 'STOCK_IN_STATUS'
  if (mode.value === 'stockOut') return 'STOCK_OUT_STATUS'
  return 'TRANSFER_STATUS'
})
const statusOptions = computed(() => businessDictionaryOptions('ERP', statusDictionaryCode.value))
const stockInTypeOptions = computed(() => businessDictionaryOptions('ERP', 'STOCK_IN_TYPE'))
const stockOutTypeOptions = computed(() => businessDictionaryOptions('ERP', 'STOCK_OUT_TYPE'))
const documentNoPlaceholder = computed(() => {
  if (mode.value === 'stockIn') return 'SI/RK/采购/调拨/备注'
  if (mode.value === 'stockOut') return 'SO/FH/销售/调拨'
  if (mode.value === 'transfer') return 'TR/DB'
  return 'PO/来源采购单'
})
const warehouseFilterLabel = computed(() => {
  if (mode.value === 'procurement') return '入库仓库'
  if (mode.value === 'stockOut') return '出库仓库'
  return '入库仓库'
})
const timeRangeLabel = computed(() => {
  if (mode.value === 'procurement') return '预计到货'
  if (mode.value === 'stockOut') return '出库时间'
  if (mode.value === 'transfer') return '出库时间'
  return '入库时间'
})
const workflowSteps = computed<WorkflowStep[]>(() => {
  const activeIndex = mode.value === 'stockIn' || mode.value === 'stockOut'
    ? 1
    : mode.value === 'transfer' && filters.statusCode === 'OUT_CONFIRMED'
      ? 1
      : mode.value === 'transfer' && filters.statusCode === 'IN_CONFIRMED'
        ? 2
        : 0
  return workflowConfigs[mode.value].map((step, index) => ({ ...step, active: index === activeIndex }))
})

const loading = ref(false)
const saving = ref(false)
const detailVisible = ref(false)
const editorVisible = ref(false)
const stockInVisible = ref(false)
const stockInLoading = ref(false)
const transferActionVisible = ref(false)
const transferActionLoading = ref(false)
const transferActionType = ref<'out' | 'in'>('out')
const selectedTransfer = ref<TransferOrderSummary | null>(null)
const detail = ref<DocumentDetail | null>(null)
const editingId = ref<string | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<ErpInternalPage<DocumentSummary>>({ total: 0, begin: 0, step: 20, items: [] })

const filters = reactive({
  documentNo: '',
  customerName: '',
  salesOrderNo: '',
  supplierId: '',
  warehouseId: '',
  sourceWarehouseId: '',
  targetWarehouseId: '',
  stockInTypeCode: '',
  stockOutTypeCode: '',
  timeRange: null as FilterDateRange,
  statusCode: '',
})

const form = reactive({
  supplierId: '',
  sourceWarehouseId: '',
  targetWarehouseId: '',
  expectedArrivalTime: null as Date | string | null,
  remark: '',
  revision: null as number | null,
  lines: [] as LineForm[],
})

const stockInForm = reactive({
  procurementOrderId: '',
  procurementRevision: 0,
  stockInTime: null as Date | string | null,
  remark: '',
  lines: [] as StockInLineForm[],
})

const transferActionForm = reactive({
  time: null as Date | string | null,
  remark: '',
})

const supplierLoading = ref(false)
const warehouseLoading = ref(false)
const productLoading = ref(false)
const supplierOptions = ref<ErpSupplierProfileView[]>([])
const warehouseOptions = ref<ErpInternalWarehouseView[]>([])
const productOptions = ref<ErpManagedProductSummary[]>([])

function tableRowIndex(index: number): number {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

onMounted(() => {
  void loadBusinessDictionaries([
    { moduleCode: 'COMMON', code: 'PRODUCT_UNIT' },
    { moduleCode: 'ERP', code: 'PURCHASE_STATUS' },
    { moduleCode: 'ERP', code: 'STOCK_IN_STATUS' },
    { moduleCode: 'ERP', code: 'STOCK_IN_TYPE' },
    { moduleCode: 'ERP', code: 'STOCK_OUT_STATUS' },
    { moduleCode: 'ERP', code: 'STOCK_OUT_TYPE' },
    { moduleCode: 'ERP', code: 'TRANSFER_STATUS' },
  ])
  void Promise.all([loadRows(), searchSuppliers(''), searchWarehouses(''), searchProducts('')])
})

watch(mode, () => {
  resetFilters()
})

async function loadRows() {
  loading.value = true
  try {
    const common = { begin: (currentPage.value - 1) * pageSize.value, step: pageSize.value }
    const from = rangeStart(filters.timeRange)
    const to = rangeEnd(filters.timeRange)
    if (mode.value === 'procurement') {
      pageData.value = await getProcurementOrders({
        ...common,
        procurementNo: empty(filters.documentNo),
        supplierId: empty(filters.supplierId),
        targetWarehouseId: empty(filters.warehouseId),
        statusCode: empty(filters.statusCode),
        expectedArrivalFrom: from,
        expectedArrivalTo: to,
      }) as ErpInternalPage<DocumentSummary>
    } else if (mode.value === 'stockIn') {
      pageData.value = await getStockInOrders({
        ...common,
        stockInNo: empty(filters.documentNo),
        stockInTypeCode: empty(filters.stockInTypeCode),
        warehouseId: empty(filters.warehouseId),
        supplierId: empty(filters.supplierId),
        statusCode: empty(filters.statusCode),
        stockInTimeFrom: from,
        stockInTimeTo: to,
      }) as ErpInternalPage<DocumentSummary>
    } else if (mode.value === 'stockOut') {
      pageData.value = await getStockOutOrders({
        ...common,
        stockOutNo: empty(filters.documentNo),
        stockOutTypeCode: empty(filters.stockOutTypeCode),
        warehouseId: empty(filters.warehouseId),
        statusCode: empty(filters.statusCode),
        customerName: empty(filters.customerName),
        salesOrderNo: empty(filters.salesOrderNo),
        stockOutTimeFrom: from,
        stockOutTimeTo: to,
      }) as ErpInternalPage<DocumentSummary>
    } else {
      pageData.value = await getTransferOrders({
        ...common,
        transferNo: empty(filters.documentNo),
        sourceWarehouseId: empty(filters.sourceWarehouseId),
        targetWarehouseId: empty(filters.targetWarehouseId),
        statusCode: empty(filters.statusCode),
        stockOutTimeFrom: from,
        stockOutTimeTo: to,
      }) as ErpInternalPage<DocumentSummary>
    }
  } catch (reason) {
    ElMessage.error(errorMessage(reason, `${pageConfig.value.shortTitle}列表加载失败`))
  } finally {
    loading.value = false
  }
}

function searchRows() {
  currentPage.value = 1
  void loadRows()
}

function resetFilters() {
  filters.documentNo = ''
  filters.customerName = ''
  filters.salesOrderNo = ''
  filters.supplierId = ''
  filters.warehouseId = ''
  filters.sourceWarehouseId = ''
  filters.targetWarehouseId = ''
  filters.stockInTypeCode = ''
  filters.stockOutTypeCode = ''
  filters.timeRange = null
  filters.statusCode = ''
  currentPage.value = 1
  void loadRows()
}

function handleSizeChange() {
  currentPage.value = 1
  void loadRows()
}

async function openDetail(row: DocumentSummary) {
  detailVisible.value = true
  detail.value = null
  try {
    detail.value = await fetchDetail(row.id)
  } catch (reason) {
    ElMessage.error(errorMessage(reason, `${pageConfig.value.shortTitle}详情加载失败`))
  }
}

function openCreate() {
  editingId.value = null
  resetForm()
  addLine()
  editorVisible.value = true
}

async function openEdit(row: DocumentSummary) {
  try {
    const current = await fetchDetail(row.id)
    editingId.value = row.id
    fillForm(current)
    editorVisible.value = true
  } catch (reason) {
    ElMessage.error(errorMessage(reason, `${pageConfig.value.shortTitle}加载失败`))
  }
}

async function saveDocument(submit: boolean) {
  if (mode.value !== 'procurement' && mode.value !== 'transfer') return
  const command = buildDocumentCommand(submit)
  if (!command) return
  saving.value = true
  try {
    if (mode.value === 'procurement') {
      if (editingId.value) await updateProcurementOrder(editingId.value, command)
      else await createProcurementOrder(command)
    } else {
      if (editingId.value) await updateTransferOrder(editingId.value, command)
      else await createTransferOrder(command)
    }
    ElMessage.success(`${pageConfig.value.shortTitle}已保存`)
    editorVisible.value = false
    await loadRows()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, `${pageConfig.value.shortTitle}保存失败`))
  } finally {
    saving.value = false
  }
}

async function deleteDocument(row: DocumentSummary) {
  try {
    await ElMessageBox.confirm(`确认删除${pageConfig.value.shortTitle}「${documentNo(row)}」？后端会按规则做逻辑删除。`, `删除${pageConfig.value.shortTitle}`, {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    if (mode.value === 'procurement') await deleteProcurementOrder(row.id, row.revision)
    else if (mode.value === 'transfer') await deleteTransferOrder(row.id, row.revision)
    ElMessage.success(`${pageConfig.value.shortTitle}已删除`)
    await loadRows()
  } catch (reason) {
    if (reason === 'cancel' || reason === 'close') return
    ElMessage.error(errorMessage(reason, `${pageConfig.value.shortTitle}删除失败`))
  }
}

async function openProcurementStockIn(row: DocumentSummary) {
  const current = await getProcurementOrder(row.id)
  stockInForm.procurementOrderId = current.id
  stockInForm.procurementRevision = current.revision
  stockInForm.stockInTime = new Date()
  stockInForm.remark = ''
  stockInForm.lines = current.lines.map((line) => {
    const remainingQuantity = Math.max(Number(line.quantity || 0) - Number(line.receivedQuantity || 0), 0)
    return {
      procurementOrderLineId: line.id,
      productName: line.productName,
      unitCode: line.unitCode,
      remainingQuantity,
      quantity: remainingQuantity,
    }
  }).filter((line) => line.remainingQuantity > 0)
  if (!stockInForm.lines.length) {
    ElMessage.warning('该采购单已无可入库数量')
    return
  }
  stockInVisible.value = true
}

async function confirmStockIn() {
  const lines = stockInForm.lines
    .filter((line) => Number(line.quantity) > 0)
    .map((line) => ({ procurementOrderLineId: line.procurementOrderLineId, quantity: line.quantity }))
  if (!lines.length) {
    ElMessage.warning('请输入入库数量')
    return
  }
  stockInLoading.value = true
  try {
    const command: ProcurementStockInCommand = {
      procurementOrderId: stockInForm.procurementOrderId,
      procurementRevision: stockInForm.procurementRevision,
      stockInTime: toIso(stockInForm.stockInTime),
      lines,
      remark: empty(stockInForm.remark),
    }
    await confirmProcurementStockIn(command)
    ElMessage.success('采购入库已确认')
    stockInVisible.value = false
    await loadRows()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '采购入库失败'))
  } finally {
    stockInLoading.value = false
  }
}

function openTransferAction(row: DocumentSummary, action: 'out' | 'in') {
  selectedTransfer.value = row as TransferOrderSummary
  transferActionType.value = action
  transferActionForm.time = new Date()
  transferActionForm.remark = ''
  transferActionVisible.value = true
}

async function confirmTransferAction() {
  if (!selectedTransfer.value) return
  transferActionLoading.value = true
  try {
    if (transferActionType.value === 'out') {
      await confirmTransferStockOut(selectedTransfer.value.id, {
        revision: selectedTransfer.value.revision,
        stockOutTime: toIso(transferActionForm.time),
        remark: empty(transferActionForm.remark),
      })
    } else {
      await confirmTransferStockIn(selectedTransfer.value.id, {
        revision: selectedTransfer.value.revision,
        stockInTime: toIso(transferActionForm.time),
        remark: empty(transferActionForm.remark),
      })
    }
    ElMessage.success(transferActionType.value === 'out' ? '调拨出库已确认' : '调拨入库已确认')
    transferActionVisible.value = false
    await loadRows()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, transferActionType.value === 'out' ? '调拨出库失败' : '调拨入库失败'))
  } finally {
    transferActionLoading.value = false
  }
}

async function fetchDetail(id: string): Promise<DocumentDetail> {
  if (mode.value === 'procurement') return getProcurementOrder(id)
  if (mode.value === 'stockIn') return getStockInOrder(id)
  if (mode.value === 'stockOut') return getStockOutOrder(id)
  return getTransferOrder(id)
}

function buildDocumentCommand(submit: boolean) {
  if (mode.value === 'procurement') {
    if (!form.supplierId) {
      ElMessage.warning('请选择供应商')
      return null
    }
    if (!form.sourceWarehouseId) {
      ElMessage.warning('请选择入库仓库')
      return null
    }
    const lines = buildLines(true)
    if (!lines) return null
    return {
      submit,
      supplierId: form.supplierId,
      targetWarehouseId: form.sourceWarehouseId,
      expectedArrivalTime: toIso(form.expectedArrivalTime),
      lines,
      remark: empty(form.remark),
      revision: editingId.value ? form.revision : null,
    }
  }
  if (!form.sourceWarehouseId || !form.targetWarehouseId) {
    ElMessage.warning('请选择来源仓库和目标仓库')
    return null
  }
  if (String(form.sourceWarehouseId) === String(form.targetWarehouseId)) {
    ElMessage.warning('来源仓库和目标仓库不能相同')
    return null
  }
  const lines = buildLines(false)
  if (!lines) return null
  return {
    sourceWarehouseId: form.sourceWarehouseId,
    targetWarehouseId: form.targetWarehouseId,
    lines,
    remark: empty(form.remark),
    revision: editingId.value ? form.revision : null,
  }
}

function buildLines(withPrice: boolean) {
  if (!form.lines.length) {
    ElMessage.warning('请添加商品明细')
    return null
  }
  const lines = form.lines.map((line) => ({
    productId: line.productId,
    productVariantId: line.productVariantId,
    quantity: line.quantity,
    unitPrice: withPrice ? line.unitPrice : undefined,
  }))
  if (lines.some((line) => !line.productId || !line.productVariantId || !line.quantity)) {
    ElMessage.warning('请完善商品、规格和数量')
    return null
  }
  return lines
}

function fillForm(current: DocumentDetail) {
  resetForm()
  form.revision = current.revision
  form.remark = current.remark || ''
  if ('supplierId' in current) {
    form.supplierId = String(current.supplierId)
    form.sourceWarehouseId = String(current.targetWarehouseId)
    form.expectedArrivalTime = current.expectedArrivalTime
    form.lines = current.lines.map((line) => lineFromProcurement(line))
  } else if ('sourceWarehouseId' in current) {
    form.sourceWarehouseId = String(current.sourceWarehouseId)
    form.targetWarehouseId = String(current.targetWarehouseId)
    form.lines = current.lines.map((line) => lineFromTransfer(line))
  }
  if (!form.lines.length) addLine()
}

function lineFromProcurement(line: ProcurementOrderLine): LineForm {
  return {
    localId: crypto.randomUUID(),
    productId: String(line.productId),
    productVariantId: String(line.productVariantId),
    productName: line.productName,
    unitCode: line.unitCode,
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice),
    variants: [],
  }
}

function lineFromTransfer(line: TransferOrderDetail['lines'][number]): LineForm {
  return {
    localId: crypto.randomUUID(),
    productId: String(line.productId),
    productVariantId: String(line.productVariantId),
    productName: line.productName,
    unitCode: line.unitCode,
    quantity: Number(line.quantity),
    unitPrice: 0,
    variants: [],
  }
}

function resetForm() {
  form.supplierId = ''
  form.sourceWarehouseId = ''
  form.targetWarehouseId = ''
  form.expectedArrivalTime = null
  form.remark = ''
  form.revision = null
  form.lines = []
}

function addLine() {
  form.lines.push({
    localId: crypto.randomUUID(),
    productId: '',
    productVariantId: '',
    productName: '',
    unitCode: '',
    quantity: 1,
    unitPrice: 0,
    variants: [],
  })
}

function removeLine(index: number) {
  if (form.lines.length === 1) {
    ElMessage.warning('至少保留一条商品明细')
    return
  }
  form.lines.splice(index, 1)
}

async function searchSuppliers(query: string) {
  supplierLoading.value = true
  try {
    const result = await getErpSupplierProfiles({ begin: 0, step: 20, supplierName: empty(query), statusCode: 'ACTIVE' })
    supplierOptions.value = result.items
  } finally {
    supplierLoading.value = false
  }
}

async function searchWarehouses(query: string) {
  warehouseLoading.value = true
  try {
    const result = await getErpInventoryWarehouses({ begin: 0, step: 20, warehouseName: empty(query), statusCode: 'ACTIVE' })
    warehouseOptions.value = result.items
  } finally {
    warehouseLoading.value = false
  }
}

async function searchProducts(query: string) {
  productLoading.value = true
  try {
    const result = await getErpManagedProducts({ begin: 0, step: 20, productName: empty(query), shelfStatusCode: 'ON_SHELF', submitStatusCode: 'SUBMITTED' })
    productOptions.value = result.items
  } finally {
    productLoading.value = false
  }
}

async function selectProduct(line: LineForm) {
  if (!line.productId) return
  const product = await getErpManagedProduct(line.productId)
  line.productName = product.productName
  line.unitCode = product.unitCode || ''
  line.variants = product.variants
  const variant = product.variants.find((item) => item.defaultFlag) || product.variants[0]
  if (variant) {
    line.productVariantId = variant.id
    selectVariant(line)
  }
}

function selectVariant(line: LineForm) {
  const variant = line.variants.find((item) => String(item.id) === String(line.productVariantId))
  if (!variant) return
  line.unitCode = variant.unitCode || line.unitCode
  if (mode.value === 'procurement') line.unitPrice = Number(variant.purchasePrice || variant.salePrice || 0)
}

function documentNo(row: DocumentSummary | DocumentDetail) {
  if (mode.value === 'procurement' && 'procurementNo' in row) return row.procurementNo || '-'
  if (mode.value === 'stockIn' && 'stockInNo' in row) return row.stockInNo || '-'
  if (mode.value === 'stockOut' && 'stockOutNo' in row) return row.stockOutNo || '-'
  if (mode.value === 'transfer' && 'transferNo' in row) return row.transferNo || '-'
  return '-'
}

function isExternalSource(row: DocumentSummary | DocumentDetail) {
  return Boolean(row.sourceSystemCode)
}

function sourceSystemLabel(row: DocumentSummary | DocumentDetail) {
  if (row.sourceSystemCode === 'DINGHUOBAO') return '订货宝'
  return row.sourceSystemCode || '-'
}

function sourceDocumentNo(row: DocumentSummary | DocumentDetail) {
  return row.sourceDocumentNo || '-'
}

function mainRelation(row: DocumentSummary | DocumentDetail) {
  if (mode.value === 'procurement' && 'supplierName' in row) return `供应商：${row.supplierName || '-'}`
  if (mode.value === 'stockIn' && 'stockInNo' in row) {
    return row.procurementNo ? `来源采购单：${row.procurementNo}` : row.transferOrderNo ? `来源调拨单：${row.transferOrderNo}` : '手工入库'
  }
  if (mode.value === 'stockOut' && 'stockOutNo' in row) {
    return row.salesOrderNo ? `来源销售单：${row.salesOrderNo}` : row.transferOrderNo ? `来源调拨单：${row.transferOrderNo}` : '手工出库'
  }
  if (mode.value === 'transfer' && 'sourceWarehouseName' in row) {
    return `${row.sourceWarehouseName || '-'} → ${row.targetWarehouseName || '-'}`
  }
  return '-'
}

function supplierName(row: DocumentSummary | DocumentDetail) {
  return 'supplierName' in row ? row.supplierName || '-' : '-'
}

function sourceWarehouseName(row: DocumentSummary | DocumentDetail) {
  return 'sourceWarehouseName' in row ? row.sourceWarehouseName || '-' : '-'
}

function targetWarehouseName(row: DocumentSummary | DocumentDetail) {
  return 'targetWarehouseName' in row ? row.targetWarehouseName || '-' : '-'
}

function warehouseName(row: DocumentSummary | DocumentDetail) {
  return 'warehouseName' in row ? row.warehouseName || '-' : '-'
}

function customerName(row: DocumentSummary | DocumentDetail) {
  return 'customerNameSnapshot' in row ? row.customerNameSnapshot || '-' : '-'
}

function procurementNo(row: DocumentSummary | DocumentDetail) {
  return 'procurementNo' in row ? row.procurementNo || '-' : '-'
}

function salesOrderNo(row: DocumentSummary | DocumentDetail) {
  return 'salesOrderNo' in row ? row.salesOrderNo || '-' : '-'
}

function transferNo(row: DocumentSummary | DocumentDetail) {
  if ('transferNo' in row) return row.transferNo || '-'
  return 'transferOrderNo' in row ? row.transferOrderNo || '-' : '-'
}

function stockInNo(row: DocumentSummary | DocumentDetail) {
  return 'stockInNo' in row ? row.stockInNo || '-' : '-'
}

function stockOutNo(row: DocumentSummary | DocumentDetail) {
  return 'stockOutNo' in row ? row.stockOutNo || '-' : '-'
}

function stockInTypeCode(row: DocumentSummary | DocumentDetail) {
  return 'stockInTypeCode' in row ? row.stockInTypeCode || '-' : '-'
}

function stockInTypeLabel(row: DocumentSummary | DocumentDetail) {
  return businessDictionaryLabel('ERP', 'STOCK_IN_TYPE', stockInTypeCode(row), '入库类型')
}

function stockOutTypeCode(row: DocumentSummary | DocumentDetail) {
  return 'stockOutTypeCode' in row ? row.stockOutTypeCode || '-' : '-'
}

function stockOutTypeLabel(row: DocumentSummary | DocumentDetail) {
  return businessDictionaryLabel('ERP', 'STOCK_OUT_TYPE', stockOutTypeCode(row), '出库类型')
}

function expectedArrivalTime(row: DocumentSummary | DocumentDetail) {
  return 'expectedArrivalTime' in row ? row.expectedArrivalTime : null
}

function stockInTime(row: DocumentSummary | DocumentDetail) {
  return 'stockInTime' in row ? row.stockInTime : null
}

function stockOutTime(row: DocumentSummary | DocumentDetail) {
  return 'stockOutTime' in row ? row.stockOutTime : null
}

function primaryInfo(row: DocumentSummary | DocumentDetail) {
  if ('targetWarehouseName' in row && 'procurementNo' in row) return `入库仓库：${row.targetWarehouseName || '-'}`
  if ('warehouseName' in row) return `仓库：${row.warehouseName || '-'}`
  if ('customerNameSnapshot' in row) return `客户：${row.customerNameSnapshot || '-'}`
  if ('sourceWarehouseName' in row) return `来源仓库：${row.sourceWarehouseName || '-'}`
  return '-'
}

function secondaryInfo(row: DocumentSummary | DocumentDetail) {
  if ('expectedArrivalTime' in row) return `预计到货：${formatTime(row.expectedArrivalTime)}`
  if ('stockInTime' in row) return `入库时间：${formatTime(row.stockInTime)}`
  if ('stockOutTime' in row && 'stockOutNo' in row) return `出库时间：${formatTime(row.stockOutTime)}`
  if ('targetWarehouseName' in row) return `目标仓库：${row.targetWarehouseName || '-'}`
  return '-'
}

function documentDetailItems(row: DocumentDetail) {
  const result: Array<{ label: string; value: string; span?: number }> = [
    { label: `${pageConfig.value.shortTitle}号`, value: documentNo(row) },
    { label: '状态', value: statusLabel(row.statusCode) },
    { label: '商品数量', value: formatNumber(row.totalQuantity) },
    { label: '明细行', value: String(row.lines?.length || row.lineCount || 0) },
  ]
  if (isExternalSource(row)) {
    result.push(
      { label: '来源系统', value: sourceSystemLabel(row) },
      { label: '来源单号', value: sourceDocumentNo(row), span: 2 },
    )
  }
  if (mode.value === 'procurement' && 'procurementNo' in row) {
    result.push(
      { label: '供应商', value: supplierName(row) },
      { label: '入库仓库', value: targetWarehouseName(row) },
      { label: '预计到货', value: formatTime(expectedArrivalTime(row)) },
      { label: '采购金额', value: formatMoney(row.totalAmount) },
    )
  } else if (mode.value === 'stockIn' && 'stockInNo' in row) {
    result.push(
      { label: '入库类型', value: stockInTypeLabel(row) },
      { label: '来源采购单', value: procurementNo(row) },
      { label: '来源调拨单', value: transferNo(row) },
      { label: '入库仓库', value: warehouseName(row) },
      { label: '供应商', value: supplierName(row) },
      { label: '入库时间', value: formatTime(stockInTime(row)) },
      { label: '入库金额', value: formatMoney(row.totalAmount) },
    )
  } else if (mode.value === 'stockOut' && 'stockOutNo' in row) {
    result.push(
      { label: '出库类型', value: stockOutTypeLabel(row) },
      { label: '销售订单', value: salesOrderNo(row) },
      { label: '调拨单号', value: transferNo(row) },
      { label: '客户名称', value: customerName(row) },
      { label: '出库仓库', value: warehouseName(row) },
      { label: '出库时间', value: formatTime(stockOutTime(row)) },
    )
  } else if (mode.value === 'transfer' && 'transferNo' in row) {
    result.push(
      { label: '来源仓库', value: sourceWarehouseName(row) },
      { label: '目标仓库', value: targetWarehouseName(row) },
      { label: '调拨出库单', value: stockOutNo(row) },
      { label: '调拨入库单', value: stockInNo(row) },
      { label: '出库时间', value: formatTime(stockOutTime(row)) },
      { label: '入库时间', value: formatTime(stockInTime(row)) },
    )
  }
  result.push(
    { label: '备注', value: row.remark || '-', span: 3 },
    { label: '创建人', value: row.createdBy || '-' },
    { label: '创建时间', value: formatTime(row.createdTime) },
    { label: '更新人', value: row.updatedBy || '-' },
    { label: '更新时间', value: formatTime(row.updatedTime) },
  )
  return result
}

function canEdit(row: DocumentSummary) {
  if (isExternalSource(row)) return false
  return (mode.value === 'procurement' || mode.value === 'transfer') && row.statusCode === 'DRAFT'
}

function canDelete(row: DocumentSummary) {
  return canEdit(row)
}

function canStockIn(row: DocumentSummary) {
  if (isExternalSource(row)) return false
  return mode.value === 'procurement' && ['SUBMITTED', 'PARTIAL_IN'].includes(row.statusCode)
}

function canTransferStockOut(row: DocumentSummary) {
  if (isExternalSource(row)) return false
  return mode.value === 'transfer' && row.statusCode === 'DRAFT'
}

function canTransferStockIn(row: DocumentSummary) {
  if (isExternalSource(row)) return false
  return mode.value === 'transfer' && row.statusCode === 'OUT_CONFIRMED'
}

function statusLabel(value: string | null | undefined) {
  return businessDictionaryLabel('ERP', statusDictionaryCode.value, value, '状态')
}

function unitLabel(value: string | null | undefined) {
  return businessDictionaryLabel('COMMON', 'PRODUCT_UNIT', value, '单位')
}

function statusTag(value: string | null | undefined) {
  if (['COMPLETED', 'CONFIRMED', 'IN_CONFIRMED'].includes(value || '')) return 'success'
  if (['SUBMITTED', 'OUT_CONFIRMED', 'PARTIAL_IN'].includes(value || '')) return 'warning'
  if (value === 'CANCELLED') return 'info'
  return 'primary'
}

function lineProductName(row: Record<string, unknown>) {
  return String(row.productName || row.productNameSnapshot || '-')
}

function lineProductCode(row: Record<string, unknown>) {
  return String(row.productCode || row.productCodeSnapshot || '')
}

function lineVariantCode(row: Record<string, unknown>) {
  return String(row.variantCode || row.variantCodeSnapshot || '')
}

function variantLabel(value: ErpManagedProductVariant) {
  return [value.variantCode, value.specificationSnapshot].filter(Boolean).join(' · ') || value.id
}

function formatMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '-'
  return `¥${Number(value).toFixed(2)}`
}

function formatNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '-'
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function formatTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function toIso(value: Date | string | null) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function rangeStart(value: FilterDateRange) {
  return toIso(value?.[0] ?? null) || undefined
}

function rangeEnd(value: FilterDateRange) {
  return toIso(value?.[1] ?? null) || undefined
}

function empty(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized || undefined
}

function errorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}
</script>

<style scoped lang="scss">
.erp-document-page {
  min-height: 0;
}

.form-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8px 0 12px;

  h3 {
    margin: 0;
    font-size: 16px;
  }
}

.line-editor {
  padding: 12px 12px 0;
  margin-bottom: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
}

.line-actions {
  display: flex;
  align-items: center;
}
</style>
