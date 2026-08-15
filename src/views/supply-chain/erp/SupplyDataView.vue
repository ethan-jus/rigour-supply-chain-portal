<template>
  <div class="supply-data-page">
    <el-card shadow="never">
      <template #header>
        <div class="page-header">
          <div>
            <span>ERP · {{ page.group }}</span>
            <h1>{{ page.title }}</h1>
            <p>{{ page.description }}</p>
          </div>
          <el-button v-if="canSync" type="primary" :loading="syncing" @click="synchronize">
            同步{{ page.syncLabel }}
          </el-button>
        </div>
      </template>

      <el-alert class="boundary-alert" type="info" :closable="false" show-icon
        title="列表只查询 ERP 本地数据；同步由 ERP 编排 Integration 访问订货宝。" />

      <div class="query-panel">
        <el-form class="query-bar" inline @submit.prevent="queryData">
          <el-form-item label="搜索条件">
            <el-input v-model="filters.keyword" clearable :placeholder="page.placeholder" @keyup.enter="queryData" />
          </el-form-item>
          <el-form-item v-if="page.objectType !== 'INVENTORY' && page.objectType !== 'SUPPLIER'" :label="statusFilterLabel">
            <el-input v-model="filters.status" clearable :placeholder="statusFilterPlaceholder" @keyup.enter="queryData" />
          </el-form-item>
          <el-form-item v-else label="库存状态">
            <el-select v-model="filters.status" clearable placeholder="全部库存状态" style="min-width: 180px">
              <el-option label="有可用库存" value="AVAILABLE" />
              <el-option label="无可用库存" value="NO_AVAILABLE" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="page.objectType === 'INVENTORY'" label="仓库">
            <el-select
              v-model="filters.warehouseCodes"
              multiple
              clearable
              filterable
              collapse-tags
              collapse-tags-tooltip
              :loading="warehouseLoading"
              placeholder="全部仓库（可多选）"
              style="min-width: 280px"
            >
              <el-option
                v-for="warehouse in warehouseOptions"
                :key="warehouse.warehouseCode"
                :label="`${warehouse.name}（${warehouse.warehouseCode}）`"
                :value="warehouse.warehouseCode"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="loading" @click="queryData">查询</el-button>
            <el-button @click="reset">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <div class="result-heading">
        <div>
          <h2>{{ page.title }}列表</h2>
          <p>共 {{ data.total }} 条数据，本页 {{ data.items.length }} 条；列表字段按订货宝业务含义拆分，点击数据行可查看完整资料。</p>
        </div>
      </div>

      <el-table
        v-loading="loading"
        class="business-table"
        :data="data.items"
        row-key="id"
        @row-click="openDetail"
      >
        <el-table-column :label="listIdentityLabel" width="280" fixed="left">
          <template #default="scope">
            <div class="record-identity">
              <span class="record-avatar">{{ rowIdentity(scope.row).title.slice(0, 1) || '?' }}</span>
              <div class="record-identity-content">
                <strong :title="rowIdentity(scope.row).title">{{ rowIdentity(scope.row).title }}</strong>
                <span>{{ rowIdentity(scope.row).code }}</span>
                <small>{{ rowIdentity(scope.row).meta }}</small>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-for="column in page.columns"
          :key="column.key"
          :label="column.label"
          :width="column.width"
          :align="column.format === 'money' ? 'right' : 'left'"
          :header-align="column.format === 'money' ? 'right' : 'left'"
        >
          <template #default="scope">
            <div v-if="column.format === 'status'" class="status-cell">
              <el-tag :type="statusTagType(formatColumnValue(scope.row, column))" effect="light" size="small">
                {{ formatColumnValue(scope.row, column) }}
              </el-tag>
            </div>
            <span v-else :class="column.format === 'time' ? 'sync-time' : 'status-text'">
              {{ formatColumnValue(scope.row, column) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="96" fixed="right" align="center">
          <template #default="scope">
            <el-button link type="primary" @click.stop="openDetail(scope.row)">详情</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无本地数据，可点击右上角同步当前类型" /></template>
      </el-table>

      <el-drawer
        v-model="detailVisible"
        class="business-detail-drawer"
        size="min(1080px, 92vw)"
        :with-header="false"
        destroy-on-close
      >
        <div class="detail-shell">
          <header class="detail-hero">
            <div>
              <span>ERP · {{ page.group }}</span>
              <h2>{{ detailHero.title }}</h2>
              <p>{{ detailHero.code }} · {{ detailHero.meta }}</p>
              <el-tag :type="statusTagType(detailHero.status)" effect="light">{{ detailHero.status }}</el-tag>
            </div>
            <el-button circle plain aria-label="关闭详情" @click="detailVisible = false">×</el-button>
          </header>
          <div class="detail-metrics">
            <div v-for="metric in detailMetrics" :key="metric.label" class="detail-metric">
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </div>
          </div>
          <div class="detail-content">
        <el-skeleton v-if="detailLoading" :rows="8" animated />
        <el-alert v-else-if="detailError" class="detail-error" type="error" :closable="false" show-icon :title="detailError" />
        <template v-else-if="orderDetail && page.objectType === 'PURCHASE_ORDER'">
          <el-descriptions :column="3" border>
            <el-descriptions-item label="采购单号">{{ value(orderDetail.number) }}</el-descriptions-item>
            <el-descriptions-item label="订货宝采购单ID">{{ value(orderDetail.sourceId) }}</el-descriptions-item>
            <el-descriptions-item label="供应商编码">{{ value(orderDetail.supplierCode) }}</el-descriptions-item>
            <el-descriptions-item label="供应商名称">{{ value(orderDetail.supplierName) }}</el-descriptions-item>
            <el-descriptions-item label="仓库编码">{{ value(orderDetail.warehouseCode) }}</el-descriptions-item>
            <el-descriptions-item label="仓库名称">{{ value(orderDetail.warehouseName) }}</el-descriptions-item>
            <el-descriptions-item label="单据状态">{{ purchaseStatusLabel(orderDetail.sourceStatus) }}</el-descriptions-item>
            <el-descriptions-item label="付款状态">{{ purchasePaymentStatusLabel(orderDetail.paymentStatus) }}</el-descriptions-item>
            <el-descriptions-item label="经办人">{{ value(orderDetail.staffName) }}</el-descriptions-item>
            <el-descriptions-item label="采购金额">{{ money(orderDetail.totalAmount) }}</el-descriptions-item>
            <el-descriptions-item label="已付金额">{{ money(orderDetail.paidAmount) }}</el-descriptions-item>
            <el-descriptions-item label="商品总数量">{{ value(orderDetail.goodsCount) }}</el-descriptions-item>
            <el-descriptions-item label="预计交货时间">{{ time(orderDetail.deliveryAt) }}</el-descriptions-item>
            <el-descriptions-item label="订货宝创建时间">{{ time(orderDetail.sourceCreatedAt) }}</el-descriptions-item>
            <el-descriptions-item label="订货宝更新时间">{{ time(orderDetail.sourceUpdatedAt) }}</el-descriptions-item>
            <el-descriptions-item label="ERP下载状态">{{ orderDetail.downloaded == null ? '-' : orderDetail.downloaded ? '已下载' : '未下载' }}</el-descriptions-item>
            <el-descriptions-item label="单据备注" :span="3">{{ value(orderDetail.remark) }}</el-descriptions-item>
            <el-descriptions-item label="内部沟通" :span="3">{{ value(orderDetail.internalCommunication) }}</el-descriptions-item>
          </el-descriptions>
          <div class="detail-title-row">
            <h3 class="detail-title">采购明细（{{ orderDetail.lines.length }}）</h3>
            <div class="detail-payment-note">
              <el-tag :type="statusTagType(purchasePaymentStatusLabel(orderDetail.paymentStatus))" effect="light" size="small">
                整单付款状态：{{ purchasePaymentStatusLabel(orderDetail.paymentStatus) }}
              </el-tag>
              <small>明细行未返回独立付款状态，以上为采购单整体付款状态</small>
            </div>
          </div>
          <el-table :data="orderDetail.lines" size="small" border>
            <el-table-column prop="sourceGoodsId" label="订货宝商品ID" min-width="150" />
            <el-table-column prop="goodsCode" label="商品编码" min-width="140" />
            <el-table-column prop="goodsName" label="商品名称" min-width="190" show-overflow-tooltip />
            <el-table-column prop="optionsId" label="规格组合ID" min-width="130" />
            <el-table-column prop="optionsGoodsCode" label="规格商品编码" min-width="150" />
            <el-table-column prop="optionsSummary" label="规格" min-width="150" show-overflow-tooltip />
            <el-table-column prop="baseQuantity" label="基础数量" width="100" />
            <el-table-column prop="purchaseUnitCode" label="采购单位编码" width="120" />
            <el-table-column prop="purchaseUnitName" label="采购单位" width="100" />
            <el-table-column prop="purchaseUnitQuantity" label="采购数量" width="100" />
            <el-table-column label="单价" width="110" align="right"><template #default="scope">{{ money(scope.row.unitPrice) }}</template></el-table-column>
            <el-table-column prop="warehousedQuantity" label="已入库" width="100" />
            <el-table-column prop="returnedQuantity" label="已退货" width="100" />
            <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
          </el-table>
        </template>
        <template v-else-if="returnDetail && page.objectType === 'PURCHASE_RETURN'">
          <el-descriptions :column="3" border>
            <el-descriptions-item label="退货单号">{{ value(returnDetail.number) }}</el-descriptions-item>
            <el-descriptions-item label="订货宝退货单ID">{{ value(returnDetail.sourceId) }}</el-descriptions-item>
            <el-descriptions-item label="供应商编码">{{ value(returnDetail.supplierCode) }}</el-descriptions-item>
            <el-descriptions-item label="供应商名称">{{ value(returnDetail.supplierName) }}</el-descriptions-item>
            <el-descriptions-item label="仓库编码">{{ value(returnDetail.warehouseCode) }}</el-descriptions-item>
            <el-descriptions-item label="仓库名称">{{ value(returnDetail.warehouseName) }}</el-descriptions-item>
            <el-descriptions-item label="退货状态">{{ purchaseReturnStatusLabel(returnDetail.sourceStatus) }}</el-descriptions-item>
            <el-descriptions-item label="经办人">{{ value(returnDetail.staffName) }}</el-descriptions-item>
            <el-descriptions-item label="联系人">{{ value(returnDetail.contactName) }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ value(returnDetail.contactPhone) }}</el-descriptions-item>
            <el-descriptions-item label="退货金额">{{ money(returnDetail.returnAmount) }}</el-descriptions-item>
            <el-descriptions-item label="折扣金额">{{ money(returnDetail.discountAmount) }}</el-descriptions-item>
            <el-descriptions-item label="退货明细条数">{{ value(returnDetail.detailCount) }}</el-descriptions-item>
            <el-descriptions-item label="订货宝创建时间">{{ time(returnDetail.sourceCreatedAt) }}</el-descriptions-item>
            <el-descriptions-item label="退货发出时间">{{ time(returnDetail.sendAt) }}</el-descriptions-item>
            <el-descriptions-item label="下单设备">{{ formatSourceDevice(returnDetail.sourceDevice) }}</el-descriptions-item>
            <el-descriptions-item label="ERP下载状态">{{ returnDetail.downloaded == null ? '-' : returnDetail.downloaded ? '已下载' : '未下载' }}</el-descriptions-item>
            <el-descriptions-item label="联系地址" :span="3">{{ value(returnDetail.contactAddress) }}</el-descriptions-item>
            <el-descriptions-item label="城市路径" :span="3">{{ value(returnDetail.cityNames.join(' / ')) }}</el-descriptions-item>
            <el-descriptions-item label="退货原因" :span="3">{{ value(returnDetail.reason) }}</el-descriptions-item>
            <el-descriptions-item label="单据备注" :span="3">{{ value(returnDetail.remark) }}</el-descriptions-item>
            <el-descriptions-item label="内部沟通" :span="3">{{ value(returnDetail.internalCommunication) }}</el-descriptions-item>
          </el-descriptions>
          <h3 class="detail-title">退货明细（{{ returnDetail.lines.length }}）</h3>
          <el-table :data="returnDetail.lines" size="small" border>
            <el-table-column prop="sourceGoodsId" label="订货宝商品ID" min-width="150" />
            <el-table-column prop="goodsCode" label="商品编码" min-width="140" />
            <el-table-column prop="goodsName" label="商品名称" min-width="190" show-overflow-tooltip />
            <el-table-column prop="optionsId" label="规格组合ID" min-width="130" />
            <el-table-column prop="optionsGoodsCode" label="规格商品编码" min-width="150" />
            <el-table-column prop="optionsSummary" label="规格" min-width="150" show-overflow-tooltip />
            <el-table-column prop="requestedQuantity" label="申请数量" width="100" />
            <el-table-column prop="confirmedQuantity" label="确认数量" width="100" />
            <el-table-column label="申请单价" width="110" align="right"><template #default="scope">{{ money(scope.row.returnPrice) }}</template></el-table-column>
            <el-table-column label="确认单价" width="110" align="right"><template #default="scope">{{ money(scope.row.confirmedPrice) }}</template></el-table-column>
            <el-table-column prop="unitCode" label="单位编码" width="100" />
            <el-table-column prop="unitName" label="单位" width="100" />
            <el-table-column prop="unitQuantity" label="申请单位数量" width="120" />
            <el-table-column prop="confirmedUnitQuantity" label="确认单位数量" width="120" />
            <el-table-column prop="conversionNumber" label="换算数量" width="100" />
            <el-table-column prop="amount" label="金额" width="110" align="right"><template #default="scope">{{ money(scope.row.amount) }}</template></el-table-column>
            <el-table-column prop="costPrice" label="成本价" width="110" align="right"><template #default="scope">{{ money(scope.row.costPrice) }}</template></el-table-column>
            <el-table-column prop="purchaseOrderNo" label="关联采购单" min-width="150" />
            <el-table-column prop="categoryName" label="分类" min-width="130" show-overflow-tooltip />
            <el-table-column prop="brandName" label="品牌" min-width="130" show-overflow-tooltip />
            <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
          </el-table>
        </template>
        <template v-else-if="warehousingDetail && page.objectType === 'WAREHOUSING_RECEIPT'">
          <el-descriptions :column="3" border>
            <el-descriptions-item label="入库单号">{{ value(warehousingDetail.number) }}</el-descriptions-item>
            <el-descriptions-item label="订货宝入库单ID">{{ value(warehousingDetail.sourceId) }}</el-descriptions-item>
            <el-descriptions-item label="订货宝仓库ID">{{ value(warehousingDetail.warehouseSourceId) }}</el-descriptions-item>
            <el-descriptions-item label="仓库名称">{{ value(warehousingDetail.warehouseName) }}</el-descriptions-item>
            <el-descriptions-item label="订货宝供应商ID">{{ value(warehousingDetail.supplierSourceId) }}</el-descriptions-item>
            <el-descriptions-item label="供应商名称">{{ value(warehousingDetail.supplierName) }}</el-descriptions-item>
            <el-descriptions-item label="入库类型">{{ formatInboundType(warehousingDetail.typeId) }}</el-descriptions-item>
            <el-descriptions-item label="入库状态">{{ warehousingStatusLabel(warehousingDetail.sourceStatus) }}</el-descriptions-item>
            <el-descriptions-item label="经办人">{{ value(warehousingDetail.staffName) }}</el-descriptions-item>
            <el-descriptions-item label="协作方">{{ value(warehousingDetail.collaboratorName || warehousingDetail.collaboratorSourceId) }}</el-descriptions-item>
            <el-descriptions-item label="物流单号">{{ value(warehousingDetail.expressNumber) }}</el-descriptions-item>
            <el-descriptions-item label="运费">{{ money(warehousingDetail.freightAmount) }}</el-descriptions-item>
            <el-descriptions-item label="入库金额">{{ money(warehousingDetail.totalAmount) }}</el-descriptions-item>
            <el-descriptions-item label="成本金额">{{ money(warehousingDetail.costAmount) }}</el-descriptions-item>
            <el-descriptions-item label="入库时间">{{ time(warehousingDetail.storageAt) }}</el-descriptions-item>
            <el-descriptions-item label="订货宝创建时间">{{ time(warehousingDetail.sourceCreatedAt) }}</el-descriptions-item>
            <el-descriptions-item label="订货宝更新时间">{{ time(warehousingDetail.sourceUpdatedAt) }}</el-descriptions-item>
            <el-descriptions-item label="单据备注" :span="3">{{ value(warehousingDetail.remark) }}</el-descriptions-item>
            <el-descriptions-item label="关联采购单" :span="3">
              {{ value(warehousingDetail.purchaseLinks.map(item => item.purchaseOrderNo).filter(Boolean).join(' / ')) }}
            </el-descriptions-item>
          </el-descriptions>
          <h3 class="detail-title">入库明细（{{ warehousingDetail.lines.length }}）</h3>
          <el-table :data="warehousingDetail.lines" size="small" border>
            <el-table-column prop="sourceGoodsId" label="订货宝商品ID" min-width="150" />
            <el-table-column prop="goodsCode" label="商品编码" min-width="140" />
            <el-table-column prop="goodsName" label="商品名称" min-width="190" show-overflow-tooltip />
            <el-table-column prop="optionsGoodsCode" label="规格商品编码" min-width="150" />
            <el-table-column prop="optionsSummary" label="规格" min-width="150" show-overflow-tooltip />
            <el-table-column prop="baseQuantity" label="基础数量" width="100" />
            <el-table-column prop="unitQuantity" label="入库数量" width="100" />
            <el-table-column prop="unitName" label="单位" width="100" />
            <el-table-column label="成本价" width="110" align="right"><template #default="scope">{{ money(scope.row.costPrice) }}</template></el-table-column>
            <el-table-column label="单位成本价" width="120" align="right"><template #default="scope">{{ money(scope.row.unitCostPrice) }}</template></el-table-column>
            <el-table-column label="采购价" width="110" align="right"><template #default="scope">{{ money(scope.row.purchasePrice) }}</template></el-table-column>
            <el-table-column label="批发价" width="110" align="right"><template #default="scope">{{ money(scope.row.wholesalePrice) }}</template></el-table-column>
            <el-table-column prop="barcode" label="条码" min-width="130" />
            <el-table-column prop="goodsModel" label="型号" min-width="130" />
            <el-table-column prop="allocation" label="货位" min-width="120" />
            <el-table-column prop="sourceRealQuantity" label="来源实存" width="110" />
            <el-table-column prop="sourceAvailableQuantity" label="来源可用" width="110" />
            <el-table-column prop="collaboratorName" label="协作方" min-width="130" show-overflow-tooltip />
            <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
          </el-table>
        </template>
        <template v-else-if="selectedRow">
          <section class="detail-section">
            <div class="section-heading">
              <h3>资料概览</h3>
              <p>列表外的完整业务字段</p>
            </div>
            <dl class="info-grid">
              <div v-for="field in localDetailFields" :key="field.label" :class="{ 'info-span-2': field.wide }">
                <dt>{{ field.label }}</dt>
                <dd>{{ field.value }}</dd>
              </div>
            </dl>
          </section>
        </template>
        <el-empty v-else description="暂无详情" />
          </div>
        </div>
      </el-drawer>

      <el-pagination class="pagination" background layout="total, sizes, prev, pager, next, jumper"
        :total="data.total" :current-page="currentPage" :page-size="pageSize"
        :page-sizes="[20, 50, 100]" @current-change="changePage" @size-change="changeSize" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import {
  getErpInventoryBalances, getErpPurchaseOrder, getErpPurchaseOrders, getErpPurchaseReturn, getErpPurchaseReturns,
  getErpSuppliers, getErpWarehouses, getErpWarehousingReceipt, getErpWarehousingReceipts, syncErpData,
  type ErpPage, type ErpPurchaseOrderDetailView, type ErpPurchaseReturnDetailView, type ErpWarehousingReceiptDetailView,
  type ErpSupplyObjectType, type ErpSupplyQuery, type ErpWarehouseView,
} from '@/api'
import { useAuthStore } from '@/stores/auth'
import { businessDictionaryLabel, loadBusinessDictionaries, sourceText } from '@/utils/business-dictionary'
import { formatInboundType, formatSourceDevice } from '@/utils/dhb-order-status'
import { createLatestRequestGuard } from '@/utils/latest-request'

type Row = Record<string, unknown>
interface Column { key: string; label: string; width: number; format?: 'money' | 'time' | 'status' | 'number' }
interface DisplayValue { title: string; code: string; meta: string }
interface DetailField { label: string; value: string; wide?: boolean }
interface Definition {
  routeKey: string; objectType: ErpSupplyObjectType; group: string; title: string
  syncLabel: string; description: string; placeholder: string; columns: Column[]
}

const definitions: Definition[] = [
  { routeKey: 'supply.erp.suppliers.profiles', objectType: 'SUPPLIER', group: '供应商', title: '供应商档案', syncLabel: '供应商',
    description: '对应订货宝供应商档案；编码、联系人、联系方式和地址分开查看。', placeholder: '输入供应商编码、名称或联系人', columns: [
      { key: 'areaName', label: '所属地区', width: 140 }, { key: 'address', label: '供应商地址', width: 220 },
      { key: 'contactName', label: '联系人', width: 120 }, { key: 'mobile', label: '手机号', width: 140 },
      { key: 'phone', label: '座机号', width: 140 }, { key: 'email', label: '邮箱', width: 200 },
      { key: 'sourceUpdatedAt', label: '订货宝更新时间', width: 170, format: 'time' },
      { key: 'syncedAt', label: '最近同步时间', width: 170, format: 'time' },
    ] },
  { routeKey: 'supply.erp.procurement.orders', objectType: 'PURCHASE_ORDER', group: '采购管理', title: '采购订单', syncLabel: '采购订单',
    description: '对应订货宝采购单；单据状态、付款状态、采购金额和采购日期分别展示。', placeholder: '输入采购单号、供应商或仓库名称', columns: [
      { key: 'supplierName', label: '供应商名称', width: 180 }, { key: 'warehouseName', label: '收货仓库', width: 150 },
      { key: 'staffName', label: '经办人', width: 120 }, { key: 'purchaseStatus', label: '单据状态', width: 130, format: 'status' },
      { key: 'paymentStatus', label: '付款状态', width: 120, format: 'status' }, { key: 'totalAmount', label: '采购金额', width: 130, format: 'money' },
      { key: 'paidAmount', label: '已付金额', width: 130, format: 'money' }, { key: 'goodsCount', label: '商品总数量', width: 110, format: 'number' },
      { key: 'deliveryAt', label: '预计交货时间', width: 170, format: 'time' }, { key: 'sourceCreatedAt', label: '采购日期', width: 170, format: 'time' },
      { key: 'syncedAt', label: '最近同步时间', width: 170, format: 'time' },
    ] },
  { routeKey: 'supply.erp.procurement.receipts', objectType: 'WAREHOUSING_RECEIPT', group: '采购管理', title: '到货与入库', syncLabel: '到货与入库',
    description: '对应订货宝入库单；到货仓库、入库类型、入库状态、金额和物流信息分开查看。', placeholder: '输入入库单号、仓库、供应商或入库类型', columns: [
      { key: 'warehouseName', label: '入库仓库', width: 160 }, { key: 'supplierName', label: '供应商名称', width: 170 },
      { key: 'staffName', label: '经办人', width: 120 }, { key: 'collaboratorName', label: '协作方', width: 140 },
      { key: 'inboundType', label: '入库类型', width: 130 }, { key: 'inboundStatus', label: '入库状态', width: 130, format: 'status' },
      { key: 'totalAmount', label: '入库金额', width: 130, format: 'money' }, { key: 'costAmount', label: '成本金额', width: 130, format: 'money' },
      { key: 'freightAmount', label: '运费', width: 110, format: 'money' }, { key: 'expressNumber', label: '物流单号', width: 160 },
      { key: 'lineCount', label: '明细条数', width: 100, format: 'number' }, { key: 'storageAt', label: '入库时间', width: 170, format: 'time' },
      { key: 'syncedAt', label: '最近同步时间', width: 170, format: 'time' },
    ] },
  { routeKey: 'supply.erp.procurement.returns', objectType: 'PURCHASE_RETURN', group: '采购管理', title: '采购退货', syncLabel: '采购退货',
    description: '对应订货宝采购退货单；退货状态、供应商、金额、原因和发出时间分开展示。', placeholder: '输入退货单号、供应商或退货原因', columns: [
      { key: 'supplierName', label: '供应商名称', width: 180 }, { key: 'warehouseName', label: '退货仓库', width: 150 },
      { key: 'staffName', label: '经办人', width: 120 }, { key: 'returnStatus', label: '退货状态', width: 130, format: 'status' },
      { key: 'returnAmount', label: '退货金额', width: 130, format: 'money' }, { key: 'discountAmount', label: '折扣金额', width: 130, format: 'money' },
      { key: 'reason', label: '退货原因', width: 200 }, { key: 'detailCount', label: '明细条数', width: 100, format: 'number' },
      { key: 'sendAt', label: '发出时间', width: 170, format: 'time' }, { key: 'syncedAt', label: '最近同步时间', width: 170, format: 'time' },
    ] },
  { routeKey: 'supply.erp.inventory.warehouses', objectType: 'WAREHOUSE', group: '仓库管理', title: '仓库信息', syncLabel: '仓库信息',
    description: '对应订货宝仓库档案；仓库状态、仓库类型、联系方式和地址分开查看。', placeholder: '输入仓库编码、名称或地址', columns: [
      { key: 'warehouseStatus', label: '仓库状态', width: 130, format: 'status' }, { key: 'warehouseType', label: '仓库类型', width: 130 },
      { key: 'acreage', label: '仓库面积', width: 110, format: 'number' }, { key: 'phone', label: '联系电话', width: 150 },
      { key: 'address', label: '仓库地址', width: 240 }, { key: 'remark', label: '仓库备注', width: 220 },
      { key: 'syncedAt', label: '最近同步时间', width: 170, format: 'time' },
    ] },
  { routeKey: 'supply.erp.inventory.inbound', objectType: 'WAREHOUSING_RECEIPT', group: '仓库管理', title: '入库单', syncLabel: '入库单',
    description: '对应 ERP 入库单；入库状态、入库类型、仓库、金额和入库时间分开展示。', placeholder: '输入入库单号、仓库、供应商或入库类型', columns: [
      { key: 'warehouseName', label: '入库仓库', width: 160 }, { key: 'supplierName', label: '供应商名称', width: 170 },
      { key: 'staffName', label: '经办人', width: 120 }, { key: 'collaboratorName', label: '协作方', width: 140 },
      { key: 'inboundType', label: '入库类型', width: 130 }, { key: 'inboundStatus', label: '入库状态', width: 130, format: 'status' },
      { key: 'totalAmount', label: '入库金额', width: 130, format: 'money' }, { key: 'costAmount', label: '成本金额', width: 130, format: 'money' },
      { key: 'freightAmount', label: '运费', width: 110, format: 'money' }, { key: 'expressNumber', label: '物流单号', width: 160 },
      { key: 'lineCount', label: '明细条数', width: 100, format: 'number' }, { key: 'storageAt', label: '入库时间', width: 170, format: 'time' },
      { key: 'syncedAt', label: '最近同步时间', width: 170, format: 'time' },
    ] },
  { routeKey: 'supply.erp.inventory.inventory', objectType: 'INVENTORY', group: '仓库管理', title: '库存', syncLabel: '库存',
    description: '对应订货宝库存余额快照；支持按商品、规格和仓库查询实际、可用、预占及在途库存。', placeholder: '输入商品编码、商品名称或规格', columns: [
      { key: 'warehouseName', label: '仓库名称', width: 160 }, { key: 'warehouseCode', label: '仓库编码', width: 140 },
      { key: 'optionSummary', label: '商品规格', width: 180 }, { key: 'inventoryStatus', label: '库存状态', width: 130, format: 'status' },
      { key: 'realQuantity', label: '实际库存', width: 110, format: 'number' }, { key: 'availableQuantity', label: '可用库存', width: 110, format: 'number' },
      { key: 'reservedQuantity', label: '预占库存', width: 110, format: 'number' }, { key: 'inTransitQuantity', label: '在途库存', width: 110, format: 'number' },
      { key: 'syncedAt', label: '最近同步时间', width: 170, format: 'time' },
    ] },
]

const route = useRoute()
const auth = useAuthStore()
const listRequest = createLatestRequestGuard()
const page = computed(() => definitions.find(item => item.routeKey === route.meta.routeKey) ?? definitions[0])
const canSync = computed(() => auth.hasPermission('erp:supply:write'))
const loading = ref(false)
const syncing = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const filters = reactive({ keyword: '', status: '', warehouseCodes: [] as string[] })
const warehouseOptions = ref<ErpWarehouseView[]>([])
const warehouseLoading = ref(false)
const warehousesLoaded = ref(false)
let warehouseLoadPromise: Promise<void> | null = null
const data = ref<ErpPage<Row>>({ total: 0, begin: 0, step: 20, items: [] })
const detailVisible = ref(false)
const selectedRow = ref<Row | null>(null)
const detailLoading = ref(false)
const detailError = ref('')
const orderDetail = ref<ErpPurchaseOrderDetailView | null>(null)
const returnDetail = ref<ErpPurchaseReturnDetailView | null>(null)
const warehousingDetail = ref<ErpWarehousingReceiptDetailView | null>(null)
const isAmountPage = computed(() => ['PURCHASE_ORDER', 'PURCHASE_RETURN', 'WAREHOUSING_RECEIPT'].includes(page.value.objectType))
const listIdentityLabel = computed(() => page.value.objectType === 'SUPPLIER' ? '供应商'
  : page.value.objectType === 'WAREHOUSE' ? '仓库'
    : page.value.objectType === 'INVENTORY' ? '商品与规格' : page.value.objectType === 'PURCHASE_ORDER' ? '采购订单' : page.value.objectType === 'PURCHASE_RETURN' ? '采购退货单' : '入库单')
const statusFilterLabel = computed(() => {
  if (page.value.objectType === 'PURCHASE_ORDER') return '单据状态'
  if (page.value.objectType === 'PURCHASE_RETURN') return '退货状态'
  if (page.value.objectType === 'WAREHOUSING_RECEIPT') return '入库状态'
  if (page.value.objectType === 'WAREHOUSE') return '仓库状态'
  return '状态'
})
const statusFilterPlaceholder = computed(() => `输入${statusFilterLabel.value}名称或编码`)
// 保留页面实例上的业务时间语义，兼容现有页面测试和外部读取；实际列表列由 definitions.columns 明确配置。
const businessTimeLabel = computed(() => page.value.objectType === 'WAREHOUSING_RECEIPT' ? '入库时间'
  : page.value.objectType === 'PURCHASE_ORDER' ? '采购日期'
    : page.value.objectType === 'PURCHASE_RETURN' ? '退货发出时间'
      : page.value.objectType === 'INVENTORY' ? '库存快照时间' : '订货宝更新时间')
const detailHero = computed(() => {
  const identity = rowIdentity(selectedRow.value ?? {})
  const status = rowStatus(selectedRow.value ?? {})
  return { title: identity.title, code: identity.code, meta: identity.meta, status: status.value }
})
const detailMetrics = computed(() => {
  const row = selectedRow.value ?? {}
  const primary = page.value.objectType === 'SUPPLIER' ? value(row.supplierCode)
    : page.value.objectType === 'WAREHOUSE' ? value(row.warehouseCode)
      : page.value.objectType === 'INVENTORY' ? value(row.availableQuantity)
        : page.value.objectType === 'PURCHASE_RETURN' ? money(row.returnAmount)
          : money(row.totalAmount)
  const secondary = page.value.objectType === 'SUPPLIER' ? value(row.name)
    : page.value.objectType === 'WAREHOUSE' ? value(row.name)
      : page.value.objectType === 'INVENTORY' ? value(row.warehouseName)
        : value(row.supplierName)
  return [
    { label: page.value.objectType === 'SUPPLIER' ? '供应商编码' : page.value.objectType === 'WAREHOUSE' ? '仓库编码' : page.value.objectType === 'INVENTORY' ? '可用库存' : page.value.objectType === 'PURCHASE_RETURN' ? '退货金额' : '采购金额', value: primary },
    { label: page.value.objectType === 'SUPPLIER' ? '供应商名称' : page.value.objectType === 'WAREHOUSE' ? '仓库名称' : page.value.objectType === 'INVENTORY' ? '仓库名称' : '供应商名称', value: secondary },
    { label: '业务状态', value: rowStatus(row).value },
    { label: '最近同步时间', value: time(row.syncedAt ?? row.sourceUpdatedAt) },
  ]
})
const localDetailFields = computed<DetailField[]>(() => {
  const row = selectedRow.value ?? {}
  if (page.value.objectType === 'SUPPLIER') return [
    field('供应商编码', row.supplierCode), field('供应商名称', row.name),
    field('所属地区', row.areaName), field('详细地址', row.address, true),
    field('联系人', row.contactName), field('手机', row.mobile), field('座机', row.phone),
    field('邮箱', row.email), field('开户名称', row.accountName), field('开户银行', row.bankName),
    field('银行账号', row.bankAccount), field('发票抬头', row.invoiceTitle),
    field('纳税人识别号', row.taxpayerNumber), field('备注', row.remark, true),
  ]
  if (page.value.objectType === 'WAREHOUSE') return [
    field('仓库编码', row.warehouseCode), field('仓库名称', row.name),
    field('仓库状态', rowWarehouseStatus(row)), field('仓库类型', rowWarehouseType(row)),
    field('仓库面积', row.acreage), field('联系电话', row.phone),
    field('仓库地址', row.address, true), field('仓库备注', row.remark, true),
  ]
  if (page.value.objectType === 'INVENTORY') return [
    field('商品编码', row.goodsCode), field('商品名称', row.goodsName),
    field('商品规格', row.optionSummary), field('仓库编码', row.warehouseCode),
    field('仓库名称', row.warehouseName), field('实际库存', row.realQuantity),
    field('可用库存', row.availableQuantity), field('预占库存', row.reservedQuantity),
    field('在途库存', row.inTransitQuantity), field('最近同步时间', time(row.syncedAt)),
  ]
  return []
})

onMounted(() => {
  void loadBusinessDictionaries([
    { moduleCode: 'ERP', code: 'DHB_PURCHASE_ORDER_STATUS' },
    { moduleCode: 'ERP', code: 'DHB_PURCHASE_PAYMENT_STATUS' },
    { moduleCode: 'ERP', code: 'DHB_PURCHASE_RETURN_STATUS' },
    { moduleCode: 'ERP', code: 'DHB_WAREHOUSING_STATUS' },
    { moduleCode: 'ERP', code: 'DHB_WAREHOUSING_TYPE' },
    { moduleCode: 'ERP', code: 'DHB_WAREHOUSE_STATUS' },
    { moduleCode: 'COMMON', code: 'DHB_UNIT' },
  ])
  void load()
})
watch(() => route.meta.routeKey, async () => { currentPage.value = 1; await reset() })

async function load() {
  const request = listRequest.begin()
  const targetPage = page.value
  loading.value = true
  if (targetPage.objectType === 'INVENTORY' && !warehousesLoaded.value) {
    await loadWarehouses().catch(reason => ElMessage.warning(message(reason, '仓库列表加载失败，暂无法按仓库筛选')))
    if (!listRequest.isCurrent(request)) return
  }
  const params: ErpSupplyQuery = { begin: (currentPage.value - 1) * pageSize.value, step: pageSize.value,
    q: filters.keyword.trim() || undefined, status: filters.status.trim() || undefined,
    warehouseCode: filters.warehouseCodes.length ? filters.warehouseCodes.join(',') : undefined }
  try {
    const result = targetPage.objectType === 'SUPPLIER' ? await getErpSuppliers(params)
      : targetPage.objectType === 'PURCHASE_ORDER' ? await getErpPurchaseOrders(params)
        : targetPage.objectType === 'PURCHASE_RETURN' ? await getErpPurchaseReturns(params)
          : targetPage.objectType === 'WAREHOUSING_RECEIPT' ? await getErpWarehousingReceipts(params)
            : targetPage.objectType === 'WAREHOUSE' ? await getErpWarehouses(params)
              : await getErpInventoryBalances(params)
    if (!listRequest.isCurrent(request)) return
    data.value = result as ErpPage<Row>
  } catch (reason) {
    if (!listRequest.isCurrent(request)) return
    data.value = { total: 0, begin: params.begin, step: params.step, items: [] }
    ElMessage.error(message(reason, `${targetPage.title}加载失败`))
  } finally {
    if (listRequest.isCurrent(request)) loading.value = false
  }
}

async function synchronize() {
  syncing.value = true
  try {
    const result = await syncErpData(page.value.objectType)
    const warning = result.unmapped > 0 ? `，字典未解析${result.unmapped}项` : ''
    ElMessage.success(`${page.value.syncLabel}同步完成：获取${result.fetched}条，新增${result.created}条，变更${result.changed}条${warning}`)
    await load()
  } catch (reason) { ElMessage.error(message(reason, `${page.value.syncLabel}同步失败`)) }
  finally { syncing.value = false }
}

async function openDetail(row: Row) {
  selectedRow.value = row
  detailVisible.value = true
  orderDetail.value = null
  returnDetail.value = null
  warehousingDetail.value = null
  if (!isAmountPage.value) {
    detailLoading.value = false
    detailError.value = ''
    return
  }
  const id = typeof row.id === 'string' ? row.id : ''
  if (!id) {
    detailLoading.value = false
    detailError.value = '缺少单据 ID，无法加载完整详情'
    ElMessage.warning(detailError.value)
    return
  }
  detailLoading.value = true
  detailError.value = ''
  try {
    if (page.value.objectType === 'PURCHASE_ORDER') orderDetail.value = await getErpPurchaseOrder(id)
    else if (page.value.objectType === 'PURCHASE_RETURN') returnDetail.value = await getErpPurchaseReturn(id)
    else if (page.value.objectType === 'WAREHOUSING_RECEIPT') warehousingDetail.value = await getErpWarehousingReceipt(id)
  } catch (reason) {
    detailError.value = message(reason, `${page.value.title}详情加载失败`)
  } finally { detailLoading.value = false }
}

async function queryData() { currentPage.value = 1; await load() }
async function reset() { filters.keyword = ''; filters.status = ''; filters.warehouseCodes = []; await queryData() }
async function changePage(value: number) { currentPage.value = value; await load() }
async function changeSize(value: number) { pageSize.value = value; currentPage.value = 1; await load() }

async function loadWarehouses() {
  if (warehousesLoaded.value) return
  if (warehouseLoadPromise) return warehouseLoadPromise
  warehouseLoading.value = true
  warehouseLoadPromise = (async () => {
    const items: ErpWarehouseView[] = []
    let begin = 0
    let total = 0
    do {
      const result = await getErpWarehouses({ begin, step: 1000 })
      items.push(...result.items)
      total = result.total
      if (result.items.length === 0) break
      begin += result.items.length
    } while (items.length < total)
    const unique = new Map<string, ErpWarehouseView>()
    items.forEach(item => { if (item.warehouseCode) unique.set(item.warehouseCode, item) })
    warehouseOptions.value = [...unique.values()]
      .sort((left, right) => left.warehouseCode.localeCompare(right.warehouseCode, 'zh-CN', { numeric: true }))
    warehousesLoaded.value = true
  })()
  try { await warehouseLoadPromise }
  finally {
    warehouseLoading.value = false
    warehouseLoadPromise = null
  }
}
function rowIdentity(row: Row): DisplayValue {
  if (page.value.objectType === 'SUPPLIER') return { title: value(row.name), code: `供应商编码 ${value(row.supplierCode)}`, meta: `订货宝供应商ID ${value(row.sourceSupplierId)}` }
  if (page.value.objectType === 'WAREHOUSE') return { title: value(row.name), code: `仓库编码 ${value(row.warehouseCode)}`, meta: `订货宝仓库ID ${value(row.sourceWarehouseId)}` }
  if (page.value.objectType === 'INVENTORY') return { title: value(row.goodsName), code: `商品编码 ${value(row.goodsCode)}`, meta: `规格 ${value(row.optionSummary)}` }
  if (page.value.objectType === 'PURCHASE_ORDER') return { title: value(row.purchaseOrderNo), code: `订货宝采购单ID ${value(row.sourceId)}`, meta: `明细条数 ${value(row.lineCount)}` }
  if (page.value.objectType === 'PURCHASE_RETURN') return { title: value(row.purchaseReturnNo), code: `订货宝退货单ID ${value(row.sourceId)}`, meta: `明细条数 ${value(row.lineCount)}` }
  return { title: value(row.warehousingNo), code: `订货宝入库单ID ${value(row.sourceId)}`, meta: `明细条数 ${value(row.lineCount)}` }
}
function rowPurchaseStatus(row: Row) {
  return purchaseStatusLabel(String(row.sourceStatus ?? ''))
}
function rowPaymentStatus(row: Row) {
  return purchasePaymentStatusLabel(String(row.paymentStatus ?? ''))
}
function rowInboundStatus(row: Row) {
  return warehousingStatusLabel(String(row.sourceStatus ?? ''))
}
function rowInboundType(row: Row) {
  return formatInboundType(String(row.typeId ?? ''))
}
function rowReturnStatus(row: Row) {
  return purchaseReturnStatusLabel(String(row.sourceStatus ?? ''))
}
function rowWarehouseStatus(row: Row) {
  return businessDictionaryLabel('ERP', 'DHB_WAREHOUSE_STATUS', String(row.sourceStatus ?? ''), '仓库状态')
}
function rowWarehouseType(row: Row) {
  return row.defaultFlag ? '默认仓库' : '普通仓库'
}
function rowInventoryStatus(row: Row) {
  return Number(row.availableQuantity ?? 0) > 0 ? '有可用库存' : '无可用库存'
}
function rowInventoryTransit(row: Row) {
  return value(row.inTransitQuantity)
}
function rowSupplierStatus(row: Row) {
  return sourceText(String(row.status ?? row.sourceStatus ?? ''))
}
function rowStatus(row: Row) {
  if (page.value.objectType === 'INVENTORY') {
    return { value: rowInventoryStatus(row), meta: `在途 ${rowInventoryTransit(row)}` }
  }
  if (page.value.objectType === 'WAREHOUSE') return { value: `仓库状态：${rowWarehouseStatus(row)}`, meta: rowWarehouseType(row) }
  if (page.value.objectType === 'SUPPLIER') return { value: `供应商状态：${rowSupplierStatus(row)}`, meta: '供应商档案' }
  if (page.value.objectType === 'PURCHASE_ORDER') return { value: `单据状态：${rowPurchaseStatus(row)}`, meta: `付款状态：${rowPaymentStatus(row)}` }
  if (page.value.objectType === 'PURCHASE_RETURN') return { value: `退货状态：${rowReturnStatus(row)}`, meta: `退货类型：${sourceText(String(row.typeName ?? row.typeId ?? ''))}` }
  return { value: `入库状态：${rowInboundStatus(row)}`, meta: `入库类型：${rowInboundType(row)}` }
}
function columnRawValue(row: Row, column: Column): unknown {
  if (column.key === 'purchaseStatus') return row.sourceStatusName || row.sourceStatus
  if (column.key === 'paymentStatus') return row.paymentStatusName || row.paymentStatus
  if (column.key === 'inboundStatus') return row.sourceStatusName || row.sourceStatus
  if (column.key === 'inboundType') return formatInboundType(String(row.typeName || row.typeId || ''))
  if (column.key === 'returnStatus') return row.sourceStatusName || row.sourceStatus
  if (column.key === 'warehouseStatus') return row.sourceStatus
  if (column.key === 'warehouseType') return rowWarehouseType(row)
  if (column.key === 'inventoryStatus') return rowInventoryStatus(row)
  return row[column.key]
}
function formatColumnValue(row: Row, column: Column): string {
  if (column.key === 'purchaseStatus') return rowPurchaseStatus(row)
  if (column.key === 'paymentStatus') return rowPaymentStatus(row)
  if (column.key === 'inboundStatus') return rowInboundStatus(row)
  if (column.key === 'returnStatus') return rowReturnStatus(row)
  if (column.key === 'warehouseStatus') return rowWarehouseStatus(row)
  const raw = columnRawValue(row, column)
  if (column.format === 'money') return money(raw)
  if (column.format === 'time') return time(raw)
  if (column.format === 'number') return value(raw)
  if (column.format === 'status') return sourceText(String(raw ?? ''))
  return value(raw)
}
function statusTagType(status: string) {
  if (['启用', '完成', '已完成', '有库存', '有可用库存', '已同步', '正常'].some(item => status.includes(item))) return 'success'
  if (['停用', '关闭', '取消', '无可用库存'].some(item => status.includes(item))) return 'info'
  return 'warning'
}
function field(label: string, item: unknown, wide = false): DetailField { return { label, value: value(item), wide } }
function value(item: unknown) { if (typeof item === 'boolean') return item ? '是' : '否'; return item == null || item === '' ? '-' : String(item) }
function money(item: unknown) { return typeof item === 'number' ? `¥${item.toFixed(2)}` : '-' }
function time(item: unknown) { if (typeof item !== 'string' || !item) return '-'; const date = new Date(item); return Number.isNaN(date.getTime()) ? item : date.toLocaleString('zh-CN', { hour12: false }) }
function message(reason: unknown, fallback: string) { return reason instanceof Error && reason.message ? reason.message : fallback }

function purchaseStatusLabel(value: string | null | undefined) {
  return businessDictionaryLabel('ERP', 'DHB_PURCHASE_ORDER_STATUS', value, '采购单状态')
}
function purchasePaymentStatusLabel(value: string | null | undefined) {
  return businessDictionaryLabel('ERP', 'DHB_PURCHASE_PAYMENT_STATUS', value, '采购付款状态')
}
function purchaseReturnStatusLabel(value: string | null | undefined) {
  return businessDictionaryLabel('ERP', 'DHB_PURCHASE_RETURN_STATUS', value, '采购退货状态')
}
function warehousingStatusLabel(value: string | null | undefined) {
  return businessDictionaryLabel('ERP', 'DHB_WAREHOUSING_STATUS', value, '入库单状态')
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
.supply-data-page { padding: 20px; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.page-header h1 { margin: 6px 0; font-size: 24px; }
.page-header p { margin: 0; color: $color-text-secondary; }
.boundary-alert { margin-bottom: 18px; }
.query-panel { margin-bottom: $spacing-lg; padding: $spacing-md $spacing-md 0; border: 1px solid $color-border-base; border-radius: $border-radius-base; background: $color-bg-base; }
.query-bar :deep(.el-form-item) { margin-bottom: $spacing-md; }
.query-bar :deep(.el-input) { width: 240px; }
.result-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: $spacing-lg; margin-bottom: $spacing-md; }
.result-heading h2 { margin: 0 0 5px; color: $color-text-primary; font-size: $font-size-lg; }
.result-heading p { margin: 0; color: $color-text-secondary; font-size: $font-size-sm; }
.business-table { overflow: hidden; border: 1px solid $color-border-base; border-radius: $border-radius-base; }
.business-table :deep(.el-table__header th) { height: 48px; background: $color-bg-muted; color: $color-text-secondary; font-weight: 600; }
.business-table :deep(.el-table__row) { cursor: pointer; transition: background-color $transition-fast; }
.business-table :deep(.el-table__row td) { padding: 12px 0; }
.business-table :deep(.el-table__row:hover > td) { background: #eff6ff !important; }
.business-table :deep(.el-table__fixed-right::before), .business-table :deep(.el-table__fixed::before) { display: none; }
.record-identity { display: flex; align-items: center; gap: 12px; min-width: 0; }
.record-avatar { display: inline-flex; flex: 0 0 46px; width: 46px; height: 46px; align-items: center; justify-content: center; border: 1px solid $color-border-base; border-radius: $border-radius-lg; background: $color-bg-muted; color: $color-primary; font-weight: 700; }
.record-identity-content { min-width: 0; }
.record-identity-content strong, .record-identity-content span, .record-identity-content small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.record-identity-content strong { color: $color-text-primary; line-height: 1.4; }
.record-identity-content span { margin-top: 4px; color: $color-text-regular; font-size: $font-size-sm; }
.record-identity-content small { margin-top: 3px; color: $color-text-placeholder; font-size: $font-size-xs; }
.stacked-cell, .metric-cell, .status-cell { display: flex; align-items: flex-start; flex-direction: column; gap: 5px; min-width: 0; }
.stacked-cell span, .stacked-cell small { overflow: hidden; max-width: 100%; text-overflow: ellipsis; white-space: nowrap; }
.stacked-cell span { color: $color-text-regular; }
.stacked-cell small, .metric-cell span, .metric-cell small, .status-cell small { color: $color-text-secondary; font-size: $font-size-xs; }
.status-text { color: $color-text-regular; font-size: $font-size-sm; line-height: 1.5; }
.metric-cell strong { color: $color-text-primary; font-size: $font-size-md; font-variant-numeric: tabular-nums; }
.metric-cell.is-amount { align-items: flex-end; }
.sync-time { color: $color-text-secondary; font-size: $font-size-sm; line-height: 1.5; }
.detail-title-row { display: flex; align-items: center; justify-content: space-between; gap: $spacing-md; margin: 20px 0 12px; }
.detail-title { margin: 20px 0 12px; font-size: 16px; }
.detail-title-row .detail-title { margin: 0; }
.detail-payment-note { display: flex; align-items: center; gap: 8px; }
.detail-payment-note small { color: $color-text-secondary; font-size: $font-size-xs; }
.detail-error { margin-bottom: 12px; }
.pagination { justify-content: flex-end; margin-top: 18px; }
:deep(.business-detail-drawer) { background: $color-bg-page; }
:deep(.business-detail-drawer .el-drawer__body) { padding: 0; }
.detail-shell { min-height: 100%; background: $color-bg-page; }
.detail-hero { position: sticky; z-index: 4; top: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: $spacing-lg; padding: $spacing-lg $spacing-xl; border-bottom: 1px solid $color-border-base; background: rgba(255, 255, 255, .96); backdrop-filter: blur(10px); }
.detail-hero span { color: $color-primary; font-size: $font-size-xs; font-weight: 600; }
.detail-hero h2 { margin: 5px 0; color: $color-text-primary; font-size: 21px; }
.detail-hero p { margin: 0 0 10px; color: $color-text-secondary; font-size: $font-size-sm; }
.detail-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; padding: $spacing-lg $spacing-xl 0; }
.detail-metric { min-width: 0; padding: $spacing-md; border: 1px solid $color-border-base; border-radius: $border-radius-lg; background: $color-bg-white; box-shadow: $shadow-sm; }
.detail-metric span { display: block; color: $color-text-secondary; font-size: $font-size-xs; }
.detail-metric strong { display: block; overflow: hidden; margin-top: 7px; color: $color-text-primary; font-size: $font-size-md; text-overflow: ellipsis; white-space: nowrap; }
.detail-content { padding: $spacing-lg $spacing-xl $spacing-xl; }
.detail-content :deep(.el-descriptions) { overflow: hidden; border: 1px solid $color-border-base; border-radius: $border-radius-lg; background: $color-bg-white; box-shadow: $shadow-sm; }
.detail-content :deep(.el-descriptions__label) { color: $color-text-secondary; font-weight: 500; }
.detail-section { padding: $spacing-lg; border: 1px solid $color-border-base; border-radius: $border-radius-lg; background: $color-bg-white; box-shadow: $shadow-sm; }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: $spacing-md; margin-bottom: $spacing-lg; }
.section-heading h3 { margin: 0; color: $color-text-primary; font-size: $font-size-md; }
.section-heading p { margin: 0; color: $color-text-secondary; font-size: $font-size-xs; }
.info-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px $spacing-lg; margin: 0; }
.info-grid > div { min-width: 0; }
.info-grid dt { margin-bottom: 6px; color: $color-text-secondary; font-size: $font-size-xs; }
.info-grid dd { overflow-wrap: anywhere; margin: 0; color: $color-text-regular; line-height: 1.5; }
.info-span-2 { grid-column: span 2; }
@media (max-width: 720px) {
  .page-header, .result-heading, .section-heading, .detail-title-row { align-items: flex-start; flex-direction: column; }
  .query-bar :deep(.el-form-item), .query-bar :deep(.el-input) { width: 100%; margin-right: 0; }
  :deep(.business-detail-drawer) { width: 100% !important; }
  .detail-hero { padding: $spacing-md; }
  .detail-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: $spacing-md $spacing-md 0; }
  .detail-content { padding: $spacing-md; }
  .info-grid { grid-template-columns: 1fr; }
  .info-span-2 { grid-column: auto; }
}
</style>
