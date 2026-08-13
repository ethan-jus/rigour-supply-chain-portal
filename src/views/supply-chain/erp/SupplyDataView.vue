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
          <el-form-item label="关键词">
            <el-input v-model="filters.keyword" clearable :placeholder="page.placeholder" @keyup.enter="queryData" />
          </el-form-item>
          <el-form-item v-if="page.objectType !== 'INVENTORY'" label="状态">
            <el-input v-model="filters.status" clearable placeholder="来源或内部状态" @keyup.enter="queryData" />
          </el-form-item>
          <el-form-item v-else label="仓库编码">
            <el-input v-model="filters.warehouseCode" clearable placeholder="全部仓库" @keyup.enter="queryData" />
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
          <p>共 {{ data.total }} 条数据，本页 {{ data.items.length }} 条；点击数据行可查看完整资料。</p>
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
        <el-table-column :label="listContextLabel" min-width="235">
          <template #default="scope">
            <div class="stacked-cell">
              <span>{{ rowContext(scope.row).title }}</span>
              <small>{{ rowContext(scope.row).meta }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="listMetricLabel" min-width="165" :align="isAmountPage ? 'right' : 'left'" :header-align="isAmountPage ? 'right' : 'left'">
          <template #default="scope">
            <div :class="['metric-cell', { 'is-amount': isAmountPage }]">
              <strong>{{ rowMetric(scope.row).value }}</strong>
              <span>{{ rowMetric(scope.row).label }}</span>
              <small>{{ rowMetric(scope.row).meta }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="135">
          <template #default="scope">
            <div class="status-cell">
              <el-tag :type="statusTagType(rowStatus(scope.row).value)" effect="light" size="small">
                {{ rowStatus(scope.row).value }}
              </el-tag>
              <small>{{ rowStatus(scope.row).meta }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="businessTimeLabel" width="165">
          <template #default="scope"><span class="sync-time">{{ rowBusinessTime(scope.row) }}</span></template>
        </el-table-column>
        <el-table-column label="最后同步" width="165">
          <template #default="scope"><span class="sync-time">{{ time(scope.row.syncedAt ?? scope.row.sourceUpdatedAt) }}</span></template>
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
            <el-descriptions-item label="订货宝单据ID">{{ value(orderDetail.sourceId) }}</el-descriptions-item>
            <el-descriptions-item label="供应商编码">{{ value(orderDetail.supplierCode) }}</el-descriptions-item>
            <el-descriptions-item label="供应商名称">{{ value(orderDetail.supplierName) }}</el-descriptions-item>
            <el-descriptions-item label="仓库编码">{{ value(orderDetail.warehouseCode) }}</el-descriptions-item>
            <el-descriptions-item label="仓库名称">{{ value(orderDetail.warehouseName) }}</el-descriptions-item>
            <el-descriptions-item label="来源状态">{{ value(orderDetail.sourceStatusName || orderDetail.sourceStatus) }}</el-descriptions-item>
            <el-descriptions-item label="付款状态">{{ value(orderDetail.paymentStatusName || orderDetail.paymentStatus) }}</el-descriptions-item>
            <el-descriptions-item label="经办人">{{ value(orderDetail.staffName) }}</el-descriptions-item>
            <el-descriptions-item label="采购金额">{{ money(orderDetail.totalAmount) }}</el-descriptions-item>
            <el-descriptions-item label="已付金额">{{ money(orderDetail.paidAmount) }}</el-descriptions-item>
            <el-descriptions-item label="商品总数量">{{ value(orderDetail.goodsCount) }}</el-descriptions-item>
            <el-descriptions-item label="预计交货">{{ time(orderDetail.deliveryAt) }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ time(orderDetail.sourceCreatedAt) }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ time(orderDetail.sourceUpdatedAt) }}</el-descriptions-item>
            <el-descriptions-item label="下载状态">{{ orderDetail.downloaded == null ? '-' : orderDetail.downloaded ? '已下载' : '未下载' }}</el-descriptions-item>
            <el-descriptions-item label="单据备注" :span="3">{{ value(orderDetail.remark) }}</el-descriptions-item>
            <el-descriptions-item label="内部沟通" :span="3">{{ value(orderDetail.internalCommunication) }}</el-descriptions-item>
          </el-descriptions>
          <el-collapse class="source-fields">
            <el-collapse-item title="订货宝原始单据字段" name="purchase-order-source">
              <pre>{{ sourceJson(orderDetail.sourceFields) }}</pre>
            </el-collapse-item>
          </el-collapse>
          <h3 class="detail-title">采购明细（{{ orderDetail.lines.length }}）</h3>
          <el-table :data="orderDetail.lines" size="small" border>
            <el-table-column type="expand" width="48">
              <template #default="scope"><pre class="line-source-fields">{{ sourceJson(scope.row.sourceFields) }}</pre></template>
            </el-table-column>
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
            <el-descriptions-item label="订货宝单据ID">{{ value(returnDetail.sourceId) }}</el-descriptions-item>
            <el-descriptions-item label="供应商编码">{{ value(returnDetail.supplierCode) }}</el-descriptions-item>
            <el-descriptions-item label="供应商名称">{{ value(returnDetail.supplierName) }}</el-descriptions-item>
            <el-descriptions-item label="仓库编码">{{ value(returnDetail.warehouseCode) }}</el-descriptions-item>
            <el-descriptions-item label="仓库名称">{{ value(returnDetail.warehouseName) }}</el-descriptions-item>
            <el-descriptions-item label="来源状态">{{ value(returnDetail.sourceStatusName || returnDetail.sourceStatus) }}</el-descriptions-item>
            <el-descriptions-item label="经办人">{{ value(returnDetail.staffName) }}</el-descriptions-item>
            <el-descriptions-item label="联系人">{{ value(returnDetail.contactName) }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ value(returnDetail.contactPhone) }}</el-descriptions-item>
            <el-descriptions-item label="退货金额">{{ money(returnDetail.returnAmount) }}</el-descriptions-item>
            <el-descriptions-item label="折扣金额">{{ money(returnDetail.discountAmount) }}</el-descriptions-item>
            <el-descriptions-item label="来源明细数量">{{ value(returnDetail.detailCount) }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ time(returnDetail.sourceCreatedAt) }}</el-descriptions-item>
            <el-descriptions-item label="发送时间">{{ time(returnDetail.sendAt) }}</el-descriptions-item>
            <el-descriptions-item label="来源设备">{{ value(returnDetail.sourceDevice) }}</el-descriptions-item>
            <el-descriptions-item label="下载状态">{{ returnDetail.downloaded == null ? '-' : returnDetail.downloaded ? '已下载' : '未下载' }}</el-descriptions-item>
            <el-descriptions-item label="联系地址" :span="3">{{ value(returnDetail.contactAddress) }}</el-descriptions-item>
            <el-descriptions-item label="城市路径" :span="3">{{ value(returnDetail.cityNames.join(' / ')) }}</el-descriptions-item>
            <el-descriptions-item label="退货原因" :span="3">{{ value(returnDetail.reason) }}</el-descriptions-item>
            <el-descriptions-item label="单据备注" :span="3">{{ value(returnDetail.remark) }}</el-descriptions-item>
            <el-descriptions-item label="内部沟通" :span="3">{{ value(returnDetail.internalCommunication) }}</el-descriptions-item>
          </el-descriptions>
          <el-collapse class="source-fields">
            <el-collapse-item title="订货宝原始单据字段" name="purchase-return-source">
              <pre>{{ sourceJson(returnDetail.sourceFields) }}</pre>
            </el-collapse-item>
          </el-collapse>
          <h3 class="detail-title">退货明细（{{ returnDetail.lines.length }}）</h3>
          <el-table :data="returnDetail.lines" size="small" border>
            <el-table-column type="expand" width="48">
              <template #default="scope"><pre class="line-source-fields">{{ sourceJson(scope.row.sourceFields) }}</pre></template>
            </el-table-column>
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
            <el-descriptions-item label="订货宝单据ID">{{ value(warehousingDetail.sourceId) }}</el-descriptions-item>
            <el-descriptions-item label="仓库来源ID">{{ value(warehousingDetail.warehouseSourceId) }}</el-descriptions-item>
            <el-descriptions-item label="仓库名称">{{ value(warehousingDetail.warehouseName) }}</el-descriptions-item>
            <el-descriptions-item label="供应商来源ID">{{ value(warehousingDetail.supplierSourceId) }}</el-descriptions-item>
            <el-descriptions-item label="供应商名称">{{ value(warehousingDetail.supplierName) }}</el-descriptions-item>
            <el-descriptions-item label="入库类型">{{ value(warehousingDetail.typeName || warehousingDetail.typeId) }}</el-descriptions-item>
            <el-descriptions-item label="来源状态">{{ value(warehousingDetail.sourceStatusName || warehousingDetail.sourceStatus) }}</el-descriptions-item>
            <el-descriptions-item label="经办人">{{ value(warehousingDetail.staffName) }}</el-descriptions-item>
            <el-descriptions-item label="协作方">{{ value(warehousingDetail.collaboratorName || warehousingDetail.collaboratorSourceId) }}</el-descriptions-item>
            <el-descriptions-item label="物流单号">{{ value(warehousingDetail.expressNumber) }}</el-descriptions-item>
            <el-descriptions-item label="运费">{{ money(warehousingDetail.freightAmount) }}</el-descriptions-item>
            <el-descriptions-item label="入库金额">{{ money(warehousingDetail.totalAmount) }}</el-descriptions-item>
            <el-descriptions-item label="成本金额">{{ money(warehousingDetail.costAmount) }}</el-descriptions-item>
            <el-descriptions-item label="入库时间">{{ time(warehousingDetail.storageAt) }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ time(warehousingDetail.sourceCreatedAt) }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ time(warehousingDetail.sourceUpdatedAt) }}</el-descriptions-item>
            <el-descriptions-item label="单据备注" :span="3">{{ value(warehousingDetail.remark) }}</el-descriptions-item>
            <el-descriptions-item label="关联采购单" :span="3">
              {{ value(warehousingDetail.purchaseLinks.map(item => item.purchaseOrderNo).filter(Boolean).join(' / ')) }}
            </el-descriptions-item>
          </el-descriptions>
          <el-collapse class="source-fields">
            <el-collapse-item title="订货宝原始单据字段" name="warehousing-source">
              <pre>{{ sourceJson(warehousingDetail.sourceFields) }}</pre>
            </el-collapse-item>
          </el-collapse>
          <h3 class="detail-title">入库明细（{{ warehousingDetail.lines.length }}）</h3>
          <el-table :data="warehousingDetail.lines" size="small" border>
            <el-table-column type="expand" width="48">
              <template #default="scope"><pre class="line-source-fields">{{ sourceJson(scope.row.sourceFields) }}</pre></template>
            </el-table-column>
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
  type ErpSupplyObjectType, type ErpSupplyQuery,
} from '@/api'
import { useAuthStore } from '@/stores/auth'

type Row = Record<string, unknown>
interface Column { key: string; label: string; width: number; format?: 'money' | 'time' | 'status' }
interface DisplayValue { title: string; code: string; meta: string }
interface DetailField { label: string; value: string; wide?: boolean }
interface Definition {
  routeKey: string; objectType: ErpSupplyObjectType; group: string; title: string
  syncLabel: string; description: string; placeholder: string; columns: Column[]
}

const definitions: Definition[] = [
  { routeKey: 'supply.erp.suppliers.profiles', objectType: 'SUPPLIER', group: '供应商', title: '供应商档案', syncLabel: '供应商',
    description: '查询 ERP 供应商规范档案，地址、联系方式、税号和银行账号展示完整值。', placeholder: '供应商编码、名称或联系人', columns: [
      { key: 'supplierCode', label: '供应商编码', width: 150 }, { key: 'name', label: '供应商名称', width: 200 },
      { key: 'areaName', label: '地区', width: 130 }, { key: 'address', label: '地址', width: 240 },
      { key: 'remark', label: '备注', width: 200 }, { key: 'contactName', label: '联系人', width: 120 },
      { key: 'mobile', label: '手机', width: 140 }, { key: 'phone', label: '座机', width: 140 },
      { key: 'email', label: '邮箱', width: 220 }, { key: 'accountName', label: '开户名称', width: 180 },
      { key: 'bankName', label: '开户银行', width: 160 }, { key: 'bankAccount', label: '银行账号', width: 220 },
      { key: 'invoiceTitle', label: '发票抬头', width: 180 }, { key: 'taxpayerNumber', label: '纳税人识别号', width: 200 },
      { key: 'sourceUpdatedAt', label: '来源更新时间', width: 170, format: 'time' },
    ] },
  { routeKey: 'supply.erp.procurement.orders', objectType: 'PURCHASE_ORDER', group: '采购管理', title: '采购订单', syncLabel: '采购订单',
    description: '采购单由列表与逐单详情合并落库，明细数量来自 ERP 本地表。', placeholder: '采购单号、供应商或仓库', columns: [
      { key: 'purchaseOrderNo', label: '采购单号', width: 170 }, { key: 'supplierName', label: '供应商', width: 180 },
      { key: 'warehouseName', label: '仓库', width: 150 }, { key: 'staffName', label: '经办人', width: 120 }, { key: 'sourceStatusName', label: '来源状态', width: 120, format: 'status' },
      { key: 'paymentStatusName', label: '付款状态', width: 110 }, { key: 'totalAmount', label: '采购金额', width: 120, format: 'money' },
      { key: 'paidAmount', label: '已付金额', width: 120, format: 'money' }, { key: 'lineCount', label: '明细数', width: 90 },
      { key: 'sourceCreatedAt', label: '创建时间', width: 170, format: 'time' }, { key: 'syncedAt', label: '最后同步', width: 170, format: 'time' },
    ] },
  { routeKey: 'supply.erp.procurement.receipts', objectType: 'WAREHOUSING_RECEIPT', group: '采购管理', title: '到货与入库', syncLabel: '到货与入库',
    description: '展示订货宝到货与入库数据；当前复用 ERP 入库单本地投影。', placeholder: '入库单号、仓库、供应商或类型', columns: [
      { key: 'warehousingNo', label: '入库单号', width: 170 }, { key: 'warehouseName', label: '仓库', width: 160 },
      { key: 'supplierName', label: '供应商', width: 170 }, { key: 'staffName', label: '经办人', width: 120 }, { key: 'collaboratorName', label: '协作方', width: 140 }, { key: 'typeName', label: '入库类型', width: 130 },
      { key: 'sourceStatusName', label: '来源状态', width: 120, format: 'status' }, { key: 'totalAmount', label: '总金额', width: 120, format: 'money' },
      { key: 'costAmount', label: '成本金额', width: 120, format: 'money' }, { key: 'freightAmount', label: '运费', width: 110 }, { key: 'expressNumber', label: '物流单号', width: 150 }, { key: 'lineCount', label: '明细数', width: 90 },
      { key: 'storageAt', label: '入库时间', width: 170, format: 'time' }, { key: 'syncedAt', label: '最后同步', width: 170, format: 'time' },
    ] },
  { routeKey: 'supply.erp.procurement.returns', objectType: 'PURCHASE_RETURN', group: '采购管理', title: '采购退货', syncLabel: '采购退货',
    description: '采购退货列表与详情统一落库，当前按原始联系信息展示。', placeholder: '退货单号、供应商或原因', columns: [
      { key: 'purchaseReturnNo', label: '退货单号', width: 170 }, { key: 'supplierName', label: '供应商', width: 180 },
      { key: 'warehouseName', label: '仓库', width: 150 }, { key: 'staffName', label: '经办人', width: 120 }, { key: 'sourceStatusName', label: '来源状态', width: 120, format: 'status' },
      { key: 'returnAmount', label: '退货金额', width: 120, format: 'money' }, { key: 'discountAmount', label: '折扣金额', width: 120, format: 'money' },
      { key: 'reason', label: '退货原因', width: 180 }, { key: 'lineCount', label: '明细数', width: 90 },
      { key: 'sendAt', label: '发出时间', width: 170, format: 'time' }, { key: 'syncedAt', label: '最后同步', width: 170, format: 'time' },
    ] },
  { routeKey: 'supply.erp.warehouse.locations', objectType: 'WAREHOUSE', group: '仓库作业', title: '仓库与库位', syncLabel: '仓库',
    description: '管理 ERP 仓库档案及订货宝来源状态。', placeholder: '仓库编码、名称或地址', columns: [
      { key: 'warehouseCode', label: '仓库编码', width: 150 }, { key: 'name', label: '仓库名称', width: 180 },
      { key: 'sourceStatus', label: '来源状态', width: 110, format: 'status' }, { key: 'defaultFlag', label: '默认仓', width: 90 },
      { key: 'acreage', label: '面积', width: 100 }, { key: 'phone', label: '电话', width: 140 },
      { key: 'address', label: '地址', width: 220 }, { key: 'remark', label: '备注', width: 220 },
      { key: 'syncedAt', label: '最后同步', width: 170, format: 'time' },
    ] },
  { routeKey: 'supply.erp.warehouse.inbound', objectType: 'WAREHOUSING_RECEIPT', group: '仓库作业', title: '入库作业', syncLabel: '入库作业',
    description: '入库单由列表与详情合并落库，并保留采购单关联。', placeholder: '入库单号、仓库、供应商或类型', columns: [
      { key: 'warehousingNo', label: '入库单号', width: 170 }, { key: 'warehouseName', label: '仓库', width: 160 },
      { key: 'supplierName', label: '供应商', width: 170 }, { key: 'staffName', label: '经办人', width: 120 }, { key: 'collaboratorName', label: '协作方', width: 140 }, { key: 'typeName', label: '入库类型', width: 130 },
      { key: 'sourceStatusName', label: '来源状态', width: 120, format: 'status' }, { key: 'totalAmount', label: '总金额', width: 120, format: 'money' },
      { key: 'costAmount', label: '成本金额', width: 120, format: 'money' }, { key: 'freightAmount', label: '运费', width: 110, format: 'money' }, { key: 'expressNumber', label: '物流单号', width: 150 }, { key: 'lineCount', label: '明细数', width: 90 },
      { key: 'storageAt', label: '入库时间', width: 170, format: 'time' }, { key: 'syncedAt', label: '最后同步', width: 170, format: 'time' },
    ] },
  { routeKey: 'supply.erp.inventory.overview', objectType: 'INVENTORY', group: '库存管理', title: '库存总览', syncLabel: '库存',
    description: '按仓库、商品和规格组合展示 batchGetStock 的余额快照。', placeholder: '商品编码、名称或规格', columns: [
      { key: 'warehouseCode', label: '仓库编码', width: 140 }, { key: 'warehouseName', label: '仓库', width: 160 },
      { key: 'goodsCode', label: '商品编码', width: 150 }, { key: 'goodsName', label: '商品名称', width: 200 },
      { key: 'optionSummary', label: '规格组合', width: 170 }, { key: 'realQuantity', label: '实际库存', width: 110 },
      { key: 'availableQuantity', label: '可用库存', width: 110 }, { key: 'reservedQuantity', label: '预占', width: 90 },
      { key: 'inTransitQuantity', label: '在途', width: 90 }, { key: 'syncedAt', label: '最后同步', width: 170, format: 'time' },
    ] },
]

const route = useRoute()
const auth = useAuthStore()
const page = computed(() => definitions.find(item => item.routeKey === route.meta.routeKey) ?? definitions[0])
const canSync = computed(() => auth.hasPermission('erp:supply:write'))
const loading = ref(false)
const syncing = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const filters = reactive({ keyword: '', status: '', warehouseCode: '' })
const data = ref<ErpPage<Row>>({ total: 0, begin: 0, step: 20, items: [] })
const detailVisible = ref(false)
const selectedRow = ref<Row | null>(null)
const detailLoading = ref(false)
const detailError = ref('')
const orderDetail = ref<ErpPurchaseOrderDetailView | null>(null)
const returnDetail = ref<ErpPurchaseReturnDetailView | null>(null)
const warehousingDetail = ref<ErpWarehousingReceiptDetailView | null>(null)
const isAmountPage = computed(() => ['PURCHASE_ORDER', 'PURCHASE_RETURN', 'WAREHOUSING_RECEIPT'].includes(page.value.objectType))
const listIdentityLabel = computed(() => page.value.objectType === 'SUPPLIER' ? '供应商信息'
  : page.value.objectType === 'WAREHOUSE' ? '仓库信息'
    : page.value.objectType === 'INVENTORY' ? '商品信息' : '单据信息')
const listContextLabel = computed(() => page.value.objectType === 'SUPPLIER' ? '地区与地址'
  : page.value.objectType === 'WAREHOUSE' ? '地址与联系'
    : page.value.objectType === 'INVENTORY' ? '仓库与规格' : '业务对象')
const listMetricLabel = computed(() => page.value.objectType === 'SUPPLIER' ? '联系方式'
  : page.value.objectType === 'WAREHOUSE' ? '仓库属性'
    : page.value.objectType === 'INVENTORY' ? '库存余额' : '核心金额')
const businessTimeLabel = computed(() => page.value.objectType === 'SUPPLIER' ? '来源更新时间'
  : page.value.objectType === 'WAREHOUSE' ? '来源更新时间'
    : page.value.objectType === 'INVENTORY' ? '快照时间'
      : page.value.objectType === 'WAREHOUSING_RECEIPT' ? '入库时间' : '业务时间')
const detailHero = computed(() => {
  const identity = rowIdentity(selectedRow.value ?? {})
  const status = rowStatus(selectedRow.value ?? {})
  return { title: identity.title, code: identity.code, meta: identity.meta, status: status.value }
})
const detailMetrics = computed(() => {
  const row = selectedRow.value ?? {}
  const metric = rowMetric(row)
  const context = rowContext(row)
  return [
    { label: listMetricLabel.value, value: metric.value },
    { label: listContextLabel.value, value: context.title },
    { label: '业务状态', value: rowStatus(row).value },
    { label: '最后同步', value: time(row.syncedAt ?? row.sourceUpdatedAt) },
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
    field('来源状态', row.sourceStatus), field('默认仓', value(row.defaultFlag)),
    field('面积', row.acreage), field('联系电话', row.phone),
    field('详细地址', row.address, true), field('备注', row.remark, true),
  ]
  if (page.value.objectType === 'INVENTORY') return [
    field('商品编码', row.goodsCode), field('商品名称', row.goodsName),
    field('规格组合', row.optionSummary), field('仓库编码', row.warehouseCode),
    field('仓库名称', row.warehouseName), field('实际库存', row.realQuantity),
    field('可用库存', row.availableQuantity), field('预占库存', row.reservedQuantity),
    field('在途库存', row.inTransitQuantity), field('最后同步', time(row.syncedAt)),
  ]
  return []
})

onMounted(load)
watch(() => route.meta.routeKey, async () => { currentPage.value = 1; await reset() })

async function load() {
  loading.value = true
  const params: ErpSupplyQuery = { begin: (currentPage.value - 1) * pageSize.value, step: pageSize.value,
    q: filters.keyword.trim() || undefined, status: filters.status.trim() || undefined,
    warehouseCode: filters.warehouseCode.trim() || undefined }
  try {
    const result = page.value.objectType === 'SUPPLIER' ? await getErpSuppliers(params)
      : page.value.objectType === 'PURCHASE_ORDER' ? await getErpPurchaseOrders(params)
        : page.value.objectType === 'PURCHASE_RETURN' ? await getErpPurchaseReturns(params)
          : page.value.objectType === 'WAREHOUSING_RECEIPT' ? await getErpWarehousingReceipts(params)
            : page.value.objectType === 'WAREHOUSE' ? await getErpWarehouses(params)
              : await getErpInventoryBalances(params)
    data.value = result as ErpPage<Row>
  } catch (reason) {
    data.value = { total: 0, begin: params.begin, step: params.step, items: [] }
    ElMessage.error(message(reason, `${page.value.title}加载失败`))
  } finally { loading.value = false }
}

async function synchronize() {
  syncing.value = true
  try {
    const result = await syncErpData(page.value.objectType)
    ElMessage.success(`${page.value.syncLabel}同步完成：获取${result.fetched}条，新增${result.created}条，变更${result.changed}条`)
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
async function reset() { filters.keyword = ''; filters.status = ''; filters.warehouseCode = ''; await queryData() }
async function changePage(value: number) { currentPage.value = value; await load() }
async function changeSize(value: number) { pageSize.value = value; currentPage.value = 1; await load() }
function rowIdentity(row: Row): DisplayValue {
  if (page.value.objectType === 'SUPPLIER') return { title: value(row.name), code: `供应商 ${value(row.supplierCode)}`, meta: `联系人 ${value(row.contactName)}` }
  if (page.value.objectType === 'WAREHOUSE') return { title: value(row.name), code: `仓库 ${value(row.warehouseCode)}`, meta: value(row.address) }
  if (page.value.objectType === 'INVENTORY') return { title: value(row.goodsName), code: `商品 ${value(row.goodsCode)}`, meta: value(row.optionSummary) }
  if (page.value.objectType === 'PURCHASE_ORDER') return { title: value(row.purchaseOrderNo), code: `来源 ${value(row.sourceId)}`, meta: `${value(row.lineCount)} 条明细` }
  if (page.value.objectType === 'PURCHASE_RETURN') return { title: value(row.purchaseReturnNo), code: `来源 ${value(row.sourceId)}`, meta: `${value(row.lineCount)} 条明细` }
  return { title: value(row.warehousingNo), code: `来源 ${value(row.sourceId)}`, meta: `${value(row.lineCount)} 条明细` }
}
function rowContext(row: Row) {
  if (page.value.objectType === 'SUPPLIER') return { title: value(row.areaName), meta: value(row.address) }
  if (page.value.objectType === 'WAREHOUSE') return { title: value(row.address), meta: `电话 ${value(row.phone)}` }
  if (page.value.objectType === 'INVENTORY') return { title: value(row.warehouseName), meta: `仓库 ${value(row.warehouseCode)} · ${value(row.optionSummary)}` }
  return { title: value(row.supplierName), meta: `${value(row.warehouseName)} · 经办人 ${value(row.staffName)}` }
}
function rowMetric(row: Row) {
  if (page.value.objectType === 'SUPPLIER') return { value: value(row.mobile || row.phone), label: '主要电话', meta: value(row.email) }
  if (page.value.objectType === 'WAREHOUSE') return { value: row.defaultFlag ? '默认仓' : '普通仓', label: '仓库类型', meta: `面积 ${value(row.acreage)}` }
  if (page.value.objectType === 'INVENTORY') return { value: value(row.availableQuantity), label: '可用库存', meta: `实存 ${value(row.realQuantity)} · 预占 ${value(row.reservedQuantity)}` }
  if (page.value.objectType === 'PURCHASE_RETURN') return { value: money(row.returnAmount), label: '退货金额', meta: `折扣 ${money(row.discountAmount)}` }
  return { value: money(row.totalAmount), label: page.value.objectType === 'PURCHASE_ORDER' ? '采购金额' : '入库金额', meta: page.value.objectType === 'PURCHASE_ORDER' ? `已付 ${money(row.paidAmount)}` : `成本 ${money(row.costAmount)}` }
}
function rowStatus(row: Row) {
  if (page.value.objectType === 'INVENTORY') {
    const available = Number(row.availableQuantity ?? 0)
    return { value: available > 0 ? '有库存' : '无可用库存', meta: `在途 ${value(row.inTransitQuantity)}` }
  }
  if (page.value.objectType === 'WAREHOUSE') return { value: value(row.sourceStatus), meta: row.defaultFlag ? '默认仓库' : '普通仓库' }
  if (page.value.objectType === 'SUPPLIER') return { value: value(row.status ?? row.sourceStatus ?? '已同步'), meta: '供应商档案' }
  return { value: value(row.sourceStatusName || row.sourceStatus), meta: page.value.objectType === 'PURCHASE_ORDER' ? `付款 ${value(row.paymentStatusName || row.paymentStatus)}` : value(row.typeName) }
}
function rowBusinessTime(row: Row) {
  if (page.value.objectType === 'WAREHOUSING_RECEIPT') return time(row.storageAt)
  if (page.value.objectType === 'PURCHASE_RETURN') return time(row.sendAt)
  return time(row.sourceCreatedAt ?? row.sourceUpdatedAt ?? row.syncedAt)
}
function statusTagType(status: string) {
  if (['启用', '完成', '已完成', '有库存', '已同步', '正常'].some(item => status.includes(item))) return 'success'
  if (['停用', '关闭', '取消', '无可用库存'].some(item => status.includes(item))) return 'info'
  return 'warning'
}
function field(label: string, item: unknown, wide = false): DetailField { return { label, value: value(item), wide } }
function value(item: unknown) { if (typeof item === 'boolean') return item ? '是' : '否'; return item == null || item === '' ? '-' : String(item) }
function money(item: unknown) { return typeof item === 'number' ? `¥${item.toFixed(2)}` : '-' }
function time(item: unknown) { if (typeof item !== 'string' || !item) return '-'; const date = new Date(item); return Number.isNaN(date.getTime()) ? item : date.toLocaleString('zh-CN', { hour12: false }) }
function sourceJson(item: Record<string, unknown> | null | undefined) { return JSON.stringify(item ?? {}, null, 2) }
function message(reason: unknown, fallback: string) { return reason instanceof Error && reason.message ? reason.message : fallback }
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
.metric-cell strong { color: $color-text-primary; font-size: $font-size-md; font-variant-numeric: tabular-nums; }
.metric-cell.is-amount { align-items: flex-end; }
.sync-time { color: $color-text-secondary; font-size: $font-size-sm; line-height: 1.5; }
.detail-title { margin: 20px 0 12px; font-size: 16px; }
.detail-error { margin-bottom: 12px; }
.source-fields { margin-top: 16px; }
.source-fields pre, .line-source-fields { max-height: 360px; margin: 0; padding: 12px; overflow: auto; border-radius: 6px; background: $color-bg-base; color: $color-text-regular; font-size: 12px; line-height: 1.55; white-space: pre-wrap; word-break: break-all; }
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
  .page-header, .result-heading, .section-heading { align-items: flex-start; flex-direction: column; }
  .query-bar :deep(.el-form-item), .query-bar :deep(.el-input) { width: 100%; margin-right: 0; }
  :deep(.business-detail-drawer) { width: 100% !important; }
  .detail-hero { padding: $spacing-md; }
  .detail-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: $spacing-md $spacing-md 0; }
  .detail-content { padding: $spacing-md; }
  .info-grid { grid-template-columns: 1fr; }
  .info-span-2 { grid-column: auto; }
}
</style>
