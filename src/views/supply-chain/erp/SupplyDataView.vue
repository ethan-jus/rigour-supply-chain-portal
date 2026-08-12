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

      <el-table v-loading="loading" :data="data.items" border stripe>
        <el-table-column v-for="column in page.columns" :key="column.key"
          :label="column.label" :min-width="column.width" show-overflow-tooltip>
          <template #default="scope">
            <el-tag v-if="column.format === 'status'" effect="plain" type="info">
              {{ value(scope.row[column.key]) }}
            </el-tag>
            <span v-else-if="column.format === 'money'">{{ money(scope.row[column.key]) }}</span>
            <span v-else-if="column.format === 'time'">{{ time(scope.row[column.key]) }}</span>
            <span v-else>{{ value(scope.row[column.key]) }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="supportsDetail" label="详情" width="90" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click.stop="openDetail(scope.row)">查看</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无本地数据，可点击右上角同步当前类型" /></template>
      </el-table>

      <el-dialog v-model="detailVisible" :title="detailTitle" width="1100px" destroy-on-close>
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
          <h3 class="detail-title">采购明细（{{ orderDetail.lines.length }}）</h3>
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
            <el-descriptions-item label="订货宝单据ID">{{ value(returnDetail.sourceId) }}</el-descriptions-item>
            <el-descriptions-item label="供应商编码">{{ value(returnDetail.supplierCode) }}</el-descriptions-item>
            <el-descriptions-item label="供应商名称">{{ value(returnDetail.supplierName) }}</el-descriptions-item>
            <el-descriptions-item label="仓库编码">{{ value(returnDetail.warehouseCode) }}</el-descriptions-item>
            <el-descriptions-item label="仓库名称">{{ value(returnDetail.warehouseName) }}</el-descriptions-item>
            <el-descriptions-item label="来源状态">{{ value(returnDetail.sourceStatusName || returnDetail.sourceStatus) }}</el-descriptions-item>
            <el-descriptions-item label="经办人">{{ value(returnDetail.staffName) }}</el-descriptions-item>
            <el-descriptions-item label="联系人">{{ value(returnDetail.contactName) }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ value(returnDetail.contactPhoneMasked) }}</el-descriptions-item>
            <el-descriptions-item label="退货金额">{{ money(returnDetail.returnAmount) }}</el-descriptions-item>
            <el-descriptions-item label="折扣金额">{{ money(returnDetail.discountAmount) }}</el-descriptions-item>
            <el-descriptions-item label="来源明细数量">{{ value(returnDetail.detailCount) }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ time(returnDetail.sourceCreatedAt) }}</el-descriptions-item>
            <el-descriptions-item label="发送时间">{{ time(returnDetail.sendAt) }}</el-descriptions-item>
            <el-descriptions-item label="来源设备">{{ value(returnDetail.sourceDevice) }}</el-descriptions-item>
            <el-descriptions-item label="下载状态">{{ returnDetail.downloaded == null ? '-' : returnDetail.downloaded ? '已下载' : '未下载' }}</el-descriptions-item>
            <el-descriptions-item label="联系地址" :span="3">{{ value(returnDetail.contactAddressMasked) }}</el-descriptions-item>
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
            <el-table-column prop="purchaseOrderNo" label="关联采购单" min-width="150" />
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
            <el-table-column label="采购价" width="110" align="right"><template #default="scope">{{ money(scope.row.purchasePrice) }}</template></el-table-column>
            <el-table-column prop="barcode" label="条码" min-width="130" />
            <el-table-column prop="goodsModel" label="型号" min-width="130" />
            <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
          </el-table>
        </template>
        <el-empty v-else description="暂无详情" />
        <template #footer><el-button @click="detailVisible = false">关闭</el-button></template>
      </el-dialog>

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
    description: '采购退货列表与详情统一落库，联系人信息在 Integration 脱敏。', placeholder: '退货单号、供应商或原因', columns: [
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
      { key: 'acreage', label: '面积', width: 100 }, { key: 'phoneMasked', label: '电话', width: 140 },
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
const supportsDetail = computed(() => ['PURCHASE_ORDER', 'PURCHASE_RETURN', 'WAREHOUSING_RECEIPT'].includes(page.value.objectType))
const canSync = computed(() => auth.hasPermission('erp:supply:write'))
const loading = ref(false)
const syncing = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const filters = reactive({ keyword: '', status: '', warehouseCode: '' })
const data = ref<ErpPage<Row>>({ total: 0, begin: 0, step: 20, items: [] })
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const orderDetail = ref<ErpPurchaseOrderDetailView | null>(null)
const returnDetail = ref<ErpPurchaseReturnDetailView | null>(null)
const warehousingDetail = ref<ErpWarehousingReceiptDetailView | null>(null)
const detailTitle = computed(() => page.value.objectType === 'PURCHASE_RETURN' ? '采购退货详情'
  : page.value.objectType === 'WAREHOUSING_RECEIPT' ? '入库单详情' : '采购订单详情')

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
  const id = typeof row.id === 'string' ? row.id : ''
  if (!id) { ElMessage.warning('缺少单据ID，无法查看详情'); return }
  detailVisible.value = true
  detailLoading.value = true
  detailError.value = ''
  orderDetail.value = null
  returnDetail.value = null
  warehousingDetail.value = null
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
function value(item: unknown) { if (typeof item === 'boolean') return item ? '是' : '否'; return item == null || item === '' ? '-' : String(item) }
function money(item: unknown) { return typeof item === 'number' ? `¥${item.toFixed(2)}` : '-' }
function time(item: unknown) { if (typeof item !== 'string' || !item) return '-'; const date = new Date(item); return Number.isNaN(date.getTime()) ? item : date.toLocaleString('zh-CN', { hour12: false }) }
function message(reason: unknown, fallback: string) { return reason instanceof Error && reason.message ? reason.message : fallback }
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
.supply-data-page { padding: 20px; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.page-header h1 { margin: 6px 0; font-size: 24px; }
.page-header p { margin: 0; color: #606266; }
.boundary-alert { margin-bottom: 18px; }
.query-bar { margin-bottom: 4px; }
.detail-title { margin: 20px 0 12px; font-size: 16px; }
.detail-error { margin-bottom: 12px; }
.pagination { justify-content: flex-end; margin-top: 18px; }
</style>
