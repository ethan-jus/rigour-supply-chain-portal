<template>
  <div class="sales-order-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">订单管理 · 销售订单</span>
        <h1>销售订单</h1>
        <p>维护销售订单、商品明细、提交状态和销售出库。</p>
      </div>
      <div class="heading-actions">
        <el-button type="primary" @click="openCreate">新增销售订单</el-button>
      </div>
    </div>

    <div class="workflow-strip" aria-label="销售订单业务流程">
      <div class="workflow-step is-active">
        <span>1</span>
        <strong>新增销售订单</strong>
        <small>选择客户和商品</small>
      </div>
      <div class="workflow-step">
        <span>2</span>
        <strong>提交订单</strong>
        <small>进入可出库状态</small>
      </div>
      <div class="workflow-step">
        <span>3</span>
        <strong>确认销售出库</strong>
        <small>选择出库仓库</small>
      </div>
      <div class="workflow-step">
        <span>4</span>
        <strong>生成出库单</strong>
        <small>ERP扣减库存</small>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="loadOrders">
        <el-form-item label="订单号">
          <el-input v-model="filters.orderNo" clearable placeholder="销售订单号" style="width: 180px" />
        </el-form-item>
        <el-form-item label="来源单号">
          <el-input v-model="filters.sourceOrderNo" clearable placeholder="订货宝订单号" style="width: 180px" />
        </el-form-item>
        <el-form-item label="订货宝状态">
          <el-select v-model="filters.sourceStatusCode" clearable placeholder="全部来源状态" style="width: 150px">
            <el-option v-for="item in sourceStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="客户名称">
          <el-input v-model="filters.customerName" clearable placeholder="客户/门店名称" style="width: 200px" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="filters.contactPhone" clearable placeholder="联系人电话" style="width: 160px" />
        </el-form-item>
        <el-form-item label="归属地区">
          <el-select v-model="filters.regionCode" clearable filterable placeholder="全部地区" style="width: 150px">
            <el-option v-for="item in regionOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="归属销售">
          <el-select
            v-model="filters.ownerStaffCode"
            clearable
            filterable
            remote
            reserve-keyword
            placeholder="搜索销售"
            :remote-method="searchSalesStaff"
            :loading="staffLoading"
            style="width: 160px"
          >
            <el-option v-for="item in staffOptions" :key="item.staffCode" :label="item.staffName" :value="item.staffCode" />
          </el-select>
        </el-form-item>
        <el-form-item label="订单状态">
          <el-select v-model="filters.orderStatusCode" clearable placeholder="全部订单状态" style="width: 150px">
            <el-option v-for="item in orderStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="收款状态">
          <el-select v-model="filters.paymentStatusCode" clearable placeholder="全部收款状态" style="width: 150px">
            <el-option v-for="item in paymentStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="出库状态">
          <el-select v-model="filters.outboundStatusCode" clearable placeholder="全部出库状态" style="width: 150px">
            <el-option v-for="item in outboundStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期">
          <el-date-picker v-model="filters.orderDateFrom" type="date" value-format="YYYY-MM-DD" placeholder="开始日期" />
        </el-form-item>
        <el-form-item label="截止日期">
          <el-date-picker v-model="filters.orderDateTo" type="date" value-format="YYYY-MM-DD" placeholder="截止日期" />
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
          <h2>销售订单列表</h2>
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
          <el-table-column prop="orderNo" label="销售订单号" width="190" show-overflow-tooltip>
            <template #default="scope">
              <strong>{{ scope.row.orderNo }}</strong>
            </template>
          </el-table-column>
          <el-table-column prop="sourceOrderNo" label="订货宝单号" width="180" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.sourceOrderNo || '-' }}</template>
          </el-table-column>
          <el-table-column label="制单人" width="140" show-overflow-tooltip>
            <template #default="scope">{{ sourceCreatorLabel(scope.row) }}</template>
          </el-table-column>
          <el-table-column label="订货宝状态" width="130">
            <template #default="scope">
              <el-tag v-if="scope.row.sourceStatusCode" effect="light">
                {{ dhbOrderStatusLabel(scope.row.sourceStatusCode) }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="下单时间" width="170">
            <template #default="scope">{{ formatTime(scope.row.orderDate) }}</template>
          </el-table-column>
          <el-table-column label="付款时间" width="170">
            <template #default="scope">{{ formatTime(scope.row.paymentTime) }}</template>
          </el-table-column>
          <el-table-column label="发货时间" width="170">
            <template #default="scope">{{ formatTime(scope.row.shipmentTime) }}</template>
          </el-table-column>
          <el-table-column label="发货状态" width="120">
            <template #default="scope">
              <el-tag v-if="scope.row.shipmentStatusCode" :type="shipmentStatusTag(scope.row.shipmentStatusCode)" effect="light">
                {{ salesShipmentStatusLabel(scope.row.shipmentStatusCode) }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="customerNameSnapshot" label="客户名称" min-width="220" show-overflow-tooltip />
          <el-table-column prop="contactPhoneSnapshot" label="联系电话" min-width="150" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.contactPhoneSnapshot || '-' }}</template>
          </el-table-column>
          <el-table-column label="归属地区" width="120">
            <template #default="scope">{{ regionLabel(scope.row.regionCode) }}</template>
          </el-table-column>
          <el-table-column prop="ownerStaffNameSnapshot" label="归属销售人员" width="170">
            <template #default="scope">
              {{ scope.row.ownerStaffNameSnapshot || scope.row.ownerSalesName || scope.row.ownerStaffCode || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="订单状态" width="120">
            <template #default="scope">
              <el-tag :type="orderStatusTag(scope.row.orderStatusCode)" effect="light">{{ salesOrderStatusLabel(scope.row.orderStatusCode) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="收款状态" width="120">
            <template #default="scope">
              <el-tag :type="paymentStatusTag(scope.row.paymentStatusCode)" effect="light">{{ statusLabel(paymentStatusOptions, scope.row.paymentStatusCode, paymentStatusFallbackLabels) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="出库状态" width="120">
            <template #default="scope">
              <el-tag :type="outboundStatusTag(scope.row.outboundStatusCode)" effect="light">{{ statusLabel(outboundStatusOptions, scope.row.outboundStatusCode) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="商品数量" width="110" align="right">
            <template #default="scope">{{ formatNumber(scope.row.totalQuantity) }}</template>
          </el-table-column>
          <el-table-column label="应收金额" width="140" align="right">
            <template #default="scope"><strong>{{ formatMoney(scope.row.payableAmount) }}</strong></template>
          </el-table-column>
          <el-table-column label="已收金额" width="140" align="right">
            <template #default="scope">{{ formatMoney(scope.row.paidAmount) }}</template>
          </el-table-column>
          <el-table-column label="未收金额" width="140" align="right">
            <template #default="scope">{{ formatMoney(scope.row.unpaidAmount) }}</template>
          </el-table-column>
          <el-table-column label="更新时间" width="170">
            <template #default="scope">{{ formatTime(scope.row.updatedTime) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openDetail(scope.row)">详情</el-button>
              <el-button v-if="canSubmit(scope.row)" link type="primary" @click.stop="submitExisting(scope.row)">提交</el-button>
              <el-button v-if="canStockOut(scope.row)" link type="primary" @click.stop="openStockOut(scope.row)">出库</el-button>
              <el-button v-if="canEdit(scope.row)" link type="primary" @click.stop="openEdit(scope.row)">编辑</el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty description="暂无销售订单" /></template>
        </el-table>
      </div>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100]"
          :total="pageData.total"
          @current-change="loadOrders"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-drawer v-model="detailVisible" class="order-detail-drawer" size="min(980px, 92vw)" :with-header="false">
      <div v-if="detail" class="detail-shell">
        <header class="detail-hero">
          <div>
            <span>销售订单详情</span>
            <h2>{{ detail.orderNo }}</h2>
            <p>{{ detail.customerNameSnapshot }} · {{ formatTime(detail.orderDate) }}</p>
            <div class="detail-tags">
              <el-tag :type="orderStatusTag(detail.orderStatusCode)" effect="light">{{ salesOrderStatusLabel(detail.orderStatusCode) }}</el-tag>
              <el-tag v-if="detail.sourceStatusCode" effect="light">{{ dhbOrderStatusLabel(detail.sourceStatusCode) }}</el-tag>
              <el-tag :type="paymentStatusTag(detail.paymentStatusCode)" effect="light">{{ statusLabel(paymentStatusOptions, detail.paymentStatusCode, paymentStatusFallbackLabels) }}</el-tag>
              <el-tag :type="outboundStatusTag(detail.outboundStatusCode)" effect="light">{{ statusLabel(outboundStatusOptions, detail.outboundStatusCode) }}</el-tag>
              <el-tag v-if="detail.shipmentStatusCode" :type="shipmentStatusTag(detail.shipmentStatusCode)" effect="light">
                {{ salesShipmentStatusLabel(detail.shipmentStatusCode) }}
              </el-tag>
            </div>
          </div>
          <el-button circle plain aria-label="关闭销售订单详情" @click="detailVisible = false">×</el-button>
        </header>
        <div class="detail-content">
          <div class="detail-summary detail-summary--three">
            <div><span>原始金额</span><strong>{{ formatMoney(detail.originalAmount) }}</strong></div>
            <div><span>应收金额</span><strong>{{ formatMoney(detail.payableAmount) }}</strong></div>
            <div><span>折扣金额</span><strong>{{ formatMoney(detail.discountAmount) }}</strong></div>
            <div><span>已收金额</span><strong>{{ formatMoney(detail.paidAmount) }}</strong></div>
            <div><span>未收金额</span><strong>{{ formatMoney(detail.unpaidAmount) }}</strong></div>
            <div><span>商品数量</span><strong>{{ formatNumber(detail.totalQuantity) }}</strong></div>
          </div>
          <el-descriptions :column="3" border>
            <el-descriptions-item label="客户编号">{{ detail.customerCodeSnapshot || '-' }}</el-descriptions-item>
            <el-descriptions-item label="客户">{{ detail.customerNameSnapshot }}</el-descriptions-item>
            <el-descriptions-item label="联系人">{{ detail.contactNameSnapshot || '-' }}</el-descriptions-item>
            <el-descriptions-item label="电话">{{ detail.contactPhoneSnapshot || '-' }}</el-descriptions-item>
            <el-descriptions-item label="地区">{{ regionLabel(detail.regionCode) }}</el-descriptions-item>
            <el-descriptions-item label="归属销售人员">
              {{ detail.ownerStaffNameSnapshot || detail.ownerSalesName || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="订单类型">{{ orderTypeLabel(detail.orderTypeCode) }}</el-descriptions-item>
            <el-descriptions-item label="付款方式">{{ paymentMethodLabel(detail.paymentMethodCode) }}</el-descriptions-item>
            <el-descriptions-item label="收款状态">{{ statusLabel(paymentStatusOptions, detail.paymentStatusCode, paymentStatusFallbackLabels) }}</el-descriptions-item>
            <el-descriptions-item label="来源系统">{{ sourceSystemLabel(detail.sourceSystemCode) }}</el-descriptions-item>
            <el-descriptions-item label="来源单号">{{ detail.sourceOrderNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="订货宝状态">{{ dhbOrderStatusLabel(detail.sourceStatusCode) }}</el-descriptions-item>
            <el-descriptions-item label="制单人">{{ sourceCreatorLabel(detail) }}</el-descriptions-item>
            <el-descriptions-item label="付款时间">{{ formatTime(detail.paymentTime) }}</el-descriptions-item>
            <el-descriptions-item label="发货时间">{{ formatTime(detail.shipmentTime) }}</el-descriptions-item>
            <el-descriptions-item label="发货状态">{{ salesShipmentStatusLabel(detail.shipmentStatusCode) }}</el-descriptions-item>
            <el-descriptions-item label="折扣比例">{{ percent(detail.discountRate) }}</el-descriptions-item>
            <el-descriptions-item label="创建人">{{ auditActorLabel(detail.createdBy) }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatTime(detail.createdTime) }}</el-descriptions-item>
            <el-descriptions-item label="更新人">{{ auditActorLabel(detail.updatedBy) }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ formatTime(detail.updatedTime) }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="3">{{ detail.remark || '-' }}</el-descriptions-item>
          </el-descriptions>
          <h3 class="detail-title">商品明细</h3>
          <el-table class="supply-scroll-table detail-table" :data="detail.lines" max-height="360" size="small">
            <el-table-column prop="productNameSnapshot" label="商品" min-width="220" fixed="left" />
            <el-table-column prop="productCodeSnapshot" label="商品编码" width="150" />
            <el-table-column prop="skuCodeSnapshot" label="SKU" width="150" />
            <el-table-column prop="specificationSnapshot" label="规格" min-width="160" />
            <el-table-column label="单位" width="90">
              <template #default="scope">{{ unitLabel(scope.row.unitCode) }}</template>
            </el-table-column>
            <el-table-column label="数量" width="100" align="right"><template #default="scope">{{ formatNumber(scope.row.quantity) }}</template></el-table-column>
            <el-table-column label="单价" width="120" align="right"><template #default="scope">{{ formatMoney(scope.row.unitPrice) }}</template></el-table-column>
            <el-table-column label="折扣比例" width="110" align="right"><template #default="scope">{{ percent(scope.row.discountRate) }}</template></el-table-column>
            <el-table-column label="折扣金额" width="120" align="right"><template #default="scope">{{ formatMoney(scope.row.discountAmount) }}</template></el-table-column>
            <el-table-column label="金额" width="130" align="right"><template #default="scope">{{ formatMoney(scope.row.lineAmount) }}</template></el-table-column>
            <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
          </el-table>
        </div>
      </div>
      <el-skeleton v-else :rows="8" animated />
    </el-drawer>

    <el-dialog v-model="editorVisible" :title="editingId ? '编辑销售订单' : '新增销售订单'" width="min(1040px, 94vw)" destroy-on-close>
      <el-form :model="form" label-width="110px" class="sales-order-form">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="客户">
              <el-select
                v-model="form.customerId"
                filterable
                remote
                reserve-keyword
                placeholder="搜索客户/门店"
                :remote-method="searchCustomers"
                :loading="customerLoading"
                style="width: 100%"
                @change="selectCustomer"
              >
                <el-option v-for="item in customerOptions" :key="item.id" :label="item.customerName" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="下单时间">
              <el-date-picker v-model="form.orderDate" type="datetime" placeholder="默认当前时间" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8"><el-form-item label="联系人"><el-input v-model="form.contactNameSnapshot" clearable /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="联系电话"><el-input v-model="form.contactPhoneSnapshot" clearable /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="归属地区"><el-input v-model="form.regionCode" clearable placeholder="地区编码" /></el-form-item></el-col>
          <el-col :span="8">
            <el-form-item label="归属销售人员">
              <el-select
                v-model="form.ownerStaffCode"
                clearable
                filterable
                remote
                reserve-keyword
                placeholder="搜索姓名/员工编码"
                :remote-method="searchSalesStaff"
                :loading="staffLoading"
                style="width: 100%"
                @change="selectOwnerStaff"
                @clear="selectOwnerStaff('')"
              >
                <el-option
                  v-for="item in staffOptions"
                  :key="item.staffCode"
                  :label="item.staffName"
                  :value="item.staffCode"
                >
                  <div class="staff-option">
                    <strong>{{ item.staffName }}</strong>
                    <span>{{ item.staffCode }}</span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="付款方式">
              <el-select v-model="form.paymentMethodCode" clearable placeholder="选择付款方式" style="width: 100%">
                <el-option
                  v-for="item in paymentMethodOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24"><el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" maxlength="1000" show-word-limit /></el-form-item></el-col>
        </el-row>

        <div class="form-section-title">
          <h3>商品明细</h3>
          <el-button @click="addLine">添加商品</el-button>
        </div>
        <div v-for="(line, index) in form.lines" :key="line.localId" class="line-editor">
          <el-row :gutter="12">
            <el-col :span="7">
              <el-form-item :label="`商品${index + 1}`">
                <el-select
                  v-model="line.productId"
                  filterable
                  remote
                  reserve-keyword
                  placeholder="搜索商品"
                  :remote-method="searchProducts"
                  :loading="productLoading"
                  style="width: 100%"
                  @change="selectProduct(line)"
                >
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
            <el-col :span="3"><el-form-item label="数量"><el-input-number v-model="line.quantity" :min="0.000001" :precision="2" style="width: 100%" /></el-form-item></el-col>
            <el-col :span="3"><el-form-item label="单价"><el-input-number v-model="line.unitPrice" :min="0" :precision="2" style="width: 100%" /></el-form-item></el-col>
            <el-col :span="3"><el-form-item label="优惠"><el-input-number v-model="line.discountAmount" :min="0" :precision="2" style="width: 100%" /></el-form-item></el-col>
            <el-col :span="3" class="line-actions"><el-button type="danger" link @click="removeLine(index)">删除</el-button></el-col>
          </el-row>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button :loading="saving" @click="saveOrder(false)">保存草稿</el-button>
        <el-button type="primary" :loading="saving" @click="saveOrder(true)">保存并提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="stockOutVisible" title="确认销售出库" width="520px" destroy-on-close>
      <el-alert
        class="request-hint"
        type="warning"
        :closable="false"
        show-icon
        title="确认后 ERP 会生成销售出库单并扣减所选仓库库存；库存不足时不会修改订单状态。"
      />
      <el-form :model="stockOutForm" label-width="100px">
        <el-form-item label="出库仓库">
          <el-select
            v-model="stockOutForm.warehouseId"
            filterable
            remote
            reserve-keyword
            placeholder="搜索仓库"
            :remote-method="searchWarehouses"
            :loading="warehouseLoading"
            style="width: 100%"
          >
            <el-option v-for="item in warehouseOptions" :key="item.id" :label="item.warehouseName" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="出库时间">
          <el-date-picker v-model="stockOutForm.stockOutTime" type="datetime" placeholder="默认当前时间" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="stockOutForm.remark" type="textarea" :rows="2" maxlength="1000" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="stockOutVisible = false">取消</el-button>
        <el-button type="primary" :loading="stockOutLoading" @click="confirmStockOut">确认出库</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { apiClient } from '@/api'
import {
  confirmSalesOrderStockOut,
  createSalesOrder,
  getSalesOrder,
  getSalesOrders,
  submitSalesOrder,
  updateSalesOrder,
  type OrderPage,
  type SalesOrderCommand,
  type SalesOrderDetail,
  type SalesOrderSummary,
} from '@/api/core/order-sales'
import {
  getInternalCrmCustomers,
  type InternalCrmCustomerSummary,
} from '@/api/core/crm'
import {
  getErpManagedProduct,
  getErpManagedProducts,
  type ErpManagedProductSummary,
  type ErpManagedProductVariant,
} from '@/api/core/erp-product'
import {
  getErpInventoryWarehouses,
  type ErpInternalWarehouseView,
} from '@/api/core/erp-internal'
import {
  businessDictionaryLabel,
  businessDictionaryOptions,
  loadBusinessDictionaries,
} from '@/utils/business-dictionary'
import { formatOrderStatus as formatDhbOrderStatus } from '@/utils/dhb-order-status'
import { auditActorLabel } from '@/utils/audit-actor'
import type { StaffRecord } from '@/types/management'

const orderStatusOptions = computed(() => businessDictionaryOptions('ORDER', 'SALES_ORDER_STATUS'))
const sourceStatusOptions = computed(() => businessDictionaryOptions('ORDER', 'DHB_ORDER_STATUS'))
const outboundStatusOptions = computed(() => businessDictionaryOptions('ORDER', 'OUTBOUND_STATUS'))
const shipmentStatusOptions = computed(() => businessDictionaryOptions('ORDER', 'SALES_SHIPMENT_STATUS'))
const paymentStatusOptions = computed(() => businessDictionaryOptions('ORDER', 'PAYMENT_STATUS'))
const paymentMethodOptions = computed(() => businessDictionaryOptions('ORDER', 'PAYMENT_METHOD'))
const regionOptions = computed(() => businessDictionaryOptions('COMMON', 'REGION'))
const salesOrderStatusFallbackLabels: Record<string, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  CANCELLED: '已取消',
}
const dhbOrderStatusFallbackLabels: Record<string, string> = {
  pricing: '待核价',
  pending: '待审核',
  stock_up: '待出库',
  stockup: '待出库',
  shipped: '待发货',
  received: '待收货',
  finished: '已完成',
  forcedone: '强制完成',
  cancelled: '已取消',
  canceled: '已取消',
  '部分出库': '部分出库',
  '已收货': '已收货',
}
const salesShipmentStatusFallbackLabels: Record<string, string> = {
  CREATED: '待发货',
  SHIPPED: '已发货',
  SIGNED: '已收货',
  CANCELLED: '已取消',
}
const paymentStatusFallbackLabels: Record<string, string> = {
  UNPAID: '未收款',
  PARTIAL_PAID: '部分收款',
  PAID: '已收款',
  CANCELLED: '已取消',
}
const route = useRoute()

const loading = ref(false)
const saving = ref(false)
const detailVisible = ref(false)
const detail = ref<SalesOrderDetail | null>(null)
const editorVisible = ref(false)
const editingId = ref<string | null>(null)
const stockOutVisible = ref(false)
const stockOutLoading = ref(false)
const selectedStockOutOrder = ref<SalesOrderSummary | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<OrderPage<SalesOrderSummary>>({ total: 0, begin: 0, step: 20, items: [] })

const filters = reactive({
  orderNo: '',
  sourceOrderNo: '',
  sourceStatusCode: '',
  customerName: '',
  contactPhone: '',
  regionCode: '',
  ownerStaffCode: '',
  orderStatusCode: '',
  paymentStatusCode: '',
  outboundStatusCode: '',
  orderDateFrom: '',
  orderDateTo: '',
})

interface SalesOrderLineForm {
  localId: string
  productId: string
  productVariantId: string
  productCodeSnapshot: string | null
  skuCodeSnapshot: string | null
  productNameSnapshot: string
  specificationSnapshot: string | null
  unitCode: string
  quantity: number
  unitPrice: number
  discountAmount: number
  remark: string | null
  variants: ErpManagedProductVariant[]
}

const form = reactive({
  customerId: '',
  customerCodeSnapshot: '',
  customerNameSnapshot: '',
  contactNameSnapshot: '',
  contactPhoneSnapshot: '',
  regionCode: '',
  ownerSalesUserId: '',
  ownerSalesName: '',
  ownerStaffCode: '',
  ownerStaffNameSnapshot: '',
  orderDate: null as Date | string | null,
  paymentMethodCode: '',
  remark: '',
  revision: null as number | null,
  lines: [] as SalesOrderLineForm[],
})

const stockOutForm = reactive({
  warehouseId: '',
  stockOutTime: null as Date | string | null,
  remark: '',
})

function tableRowIndex(index: number): number {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

const customerLoading = ref(false)
const staffLoading = ref(false)
const productLoading = ref(false)
const warehouseLoading = ref(false)
const customerOptions = ref<InternalCrmCustomerSummary[]>([])
const staffOptions = ref<StaffRecord[]>([])
const productOptions = ref<ErpManagedProductSummary[]>([])
const warehouseOptions = ref<ErpInternalWarehouseView[]>([])

onMounted(() => {
  void loadBusinessDictionaries([
    { moduleCode: 'COMMON', code: 'REGION' },
    { moduleCode: 'COMMON', code: 'PRODUCT_UNIT' },
    { moduleCode: 'ORDER', code: 'SALES_ORDER_STATUS' },
    { moduleCode: 'ORDER', code: 'DHB_ORDER_STATUS' },
    { moduleCode: 'ORDER', code: 'PAYMENT_STATUS' },
    { moduleCode: 'ORDER', code: 'OUTBOUND_STATUS' },
    { moduleCode: 'ORDER', code: 'SALES_SHIPMENT_STATUS' },
    { moduleCode: 'ORDER', code: 'SALES_ORDER_TYPE' },
    { moduleCode: 'ORDER', code: 'PAYMENT_METHOD' },
  ])
  applyRouteQuery()
  void Promise.all([loadOrders(), searchCustomers(''), searchSalesStaff(''), searchProducts(''), searchWarehouses('')])
})

watch(() => route.query, () => {
  if (!applyRouteQuery()) return
  currentPage.value = 1
  void loadOrders()
})

async function loadOrders() {
  loading.value = true
  try {
    pageData.value = await getSalesOrders({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      orderNo: empty(filters.orderNo),
      sourceOrderNo: empty(filters.sourceOrderNo),
      sourceStatusCode: empty(filters.sourceStatusCode),
      customerName: empty(filters.customerName),
      contactPhone: empty(filters.contactPhone),
      regionCode: empty(filters.regionCode),
      ownerStaffCode: empty(filters.ownerStaffCode),
      orderStatusCode: empty(filters.orderStatusCode),
      paymentStatusCode: empty(filters.paymentStatusCode),
      outboundStatusCode: empty(filters.outboundStatusCode),
      orderDateFrom: startOfDay(filters.orderDateFrom),
      orderDateTo: endOfDay(filters.orderDateTo),
    })
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '销售订单加载失败'))
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.orderNo = ''
  filters.sourceOrderNo = ''
  filters.sourceStatusCode = ''
  filters.customerName = ''
  filters.contactPhone = ''
  filters.regionCode = ''
  filters.ownerStaffCode = ''
  filters.orderStatusCode = ''
  filters.paymentStatusCode = ''
  filters.outboundStatusCode = ''
  filters.orderDateFrom = ''
  filters.orderDateTo = ''
  currentPage.value = 1
  void loadOrders()
}

function applyRouteQuery() {
  let changed = false
  changed = setFilterValue('orderDateFrom', routeDate(route.query.orderDateFrom)) || changed
  changed = setFilterValue('orderDateTo', routeDate(route.query.orderDateTo)) || changed
  changed = setFilterValue('regionCode', routeText(route.query.regionCode)) || changed
  changed = setFilterValue('ownerStaffCode', routeText(route.query.ownerStaffCode)) || changed
  changed = setFilterValue('sourceStatusCode', routeText(route.query.sourceStatusCode)) || changed
  changed = setFilterValue('paymentStatusCode', routeText(route.query.paymentStatusCode)) || changed
  const ownerStaffCode = routeText(route.query.ownerStaffCode)
  if (ownerStaffCode) ensureStaffOption(ownerStaffCode, routeText(route.query.ownerStaffName) || ownerStaffCode)
  return changed
}

function setFilterValue(key: keyof typeof filters, value: string) {
  if (filters[key] === value) return false
  filters[key] = value
  return true
}

function routeText(value: unknown) {
  const normalized = Array.isArray(value) ? value[0] : value
  return typeof normalized === 'string' ? normalized.trim() : ''
}

function routeDate(value: unknown) {
  const text = routeText(value)
  return text ? text.slice(0, 10) : ''
}

function handleSizeChange() {
  currentPage.value = 1
  void loadOrders()
}

async function openDetail(row: SalesOrderSummary) {
  detailVisible.value = true
  detail.value = null
  try {
    detail.value = await getSalesOrder(row.id)
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '销售订单详情加载失败'))
  }
}

function openCreate() {
  editingId.value = null
  resetForm()
  addLine()
  editorVisible.value = true
}

async function openEdit(row: SalesOrderSummary) {
  try {
    const current = await getSalesOrder(row.id)
    editingId.value = row.id
    resetForm()
    form.customerId = String(current.customerId)
    form.customerCodeSnapshot = current.customerCodeSnapshot || ''
    form.customerNameSnapshot = current.customerNameSnapshot
    form.contactNameSnapshot = current.contactNameSnapshot || ''
    form.contactPhoneSnapshot = current.contactPhoneSnapshot || ''
    form.regionCode = current.regionCode || ''
    form.ownerSalesUserId = current.ownerSalesUserId || ''
    form.ownerSalesName = current.ownerSalesName || ''
    form.ownerStaffCode = current.ownerStaffCode || ''
    form.ownerStaffNameSnapshot = current.ownerStaffNameSnapshot || current.ownerSalesName || ''
    ensureStaffOption(form.ownerStaffCode, form.ownerStaffNameSnapshot)
    form.orderDate = current.orderDate
    form.paymentMethodCode = current.paymentMethodCode || ''
    form.remark = current.remark || ''
    form.revision = current.revision
    form.lines = current.lines.map((line) => ({
      localId: crypto.randomUUID(),
      productId: String(line.productId),
      productVariantId: String(line.productVariantId),
      productCodeSnapshot: line.productCodeSnapshot,
      skuCodeSnapshot: line.skuCodeSnapshot,
      productNameSnapshot: line.productNameSnapshot,
      specificationSnapshot: line.specificationSnapshot,
      unitCode: line.unitCode,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      discountAmount: Number(line.discountAmount || 0),
      remark: line.remark,
      variants: [],
    }))
    editorVisible.value = true
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '销售订单加载失败'))
  }
}

async function saveOrder(submit: boolean) {
  const command = buildCommand(submit)
  if (!command) return
  saving.value = true
  try {
    if (editingId.value) {
      await updateSalesOrder(editingId.value, command)
      ElMessage.success(submit ? '销售订单已保存并提交' : '销售订单已保存')
    } else {
      await createSalesOrder(command)
      ElMessage.success(submit ? '销售订单已创建并提交' : '销售订单草稿已创建')
    }
    editorVisible.value = false
    await loadOrders()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '销售订单保存失败'))
  } finally {
    saving.value = false
  }
}

async function submitExisting(row: SalesOrderSummary) {
  try {
    await submitSalesOrder(row.id, row.revision)
    ElMessage.success('销售订单已提交')
    await loadOrders()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '销售订单提交失败'))
  }
}

function isExternalSource(row: Pick<SalesOrderSummary, 'sourceSystemCode'>) {
  return Boolean(row.sourceSystemCode && row.sourceSystemCode.trim())
}

function canSubmit(row: SalesOrderSummary) {
  if (isExternalSource(row)) return false
  return row.orderStatusCode === 'DRAFT'
}

function canEdit(row: SalesOrderSummary) {
  if (isExternalSource(row)) return false
  return row.orderStatusCode === 'DRAFT'
}

function canStockOut(row: SalesOrderSummary) {
  if (isExternalSource(row)) return false
  return row.orderStatusCode === 'SUBMITTED' && row.outboundStatusCode === 'PENDING'
}

function openStockOut(row: SalesOrderSummary) {
  selectedStockOutOrder.value = row
  stockOutForm.warehouseId = ''
  stockOutForm.stockOutTime = new Date()
  stockOutForm.remark = ''
  stockOutVisible.value = true
}

async function confirmStockOut() {
  if (!selectedStockOutOrder.value) return
  if (!stockOutForm.warehouseId) {
    ElMessage.warning('请选择出库仓库')
    return
  }
  stockOutLoading.value = true
  try {
    const result = await confirmSalesOrderStockOut(selectedStockOutOrder.value.id, {
      warehouseId: stockOutForm.warehouseId,
      stockOutTime: toIso(stockOutForm.stockOutTime),
      remark: empty(stockOutForm.remark),
      revision: selectedStockOutOrder.value.revision,
    })
    stockOutVisible.value = false
    ElMessage.success(`出库成功，ERP出库单 ${result.stockOutNo}`)
    await loadOrders()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '销售出库失败；如提示库存不足，请先完成采购入库或调拨后重试'))
  } finally {
    stockOutLoading.value = false
  }
}

async function searchCustomers(query: string) {
  customerLoading.value = true
  try {
    const result = await getInternalCrmCustomers({
      begin: 0,
      step: 20,
      customerName: empty(query),
      statusCode: 'ACTIVE',
    })
    customerOptions.value = result.items
  } finally {
    customerLoading.value = false
  }
}

function selectCustomer(value: string | number) {
  const customer = customerOptions.value.find((item) => String(item.id) === String(value))
  if (!customer) return
  form.customerCodeSnapshot = customer.customerCode || ''
  form.customerNameSnapshot = customer.customerName
  form.contactNameSnapshot = customer.contactName || ''
  form.contactPhoneSnapshot = customer.contactPhone || ''
  form.regionCode = customer.regionCode || ''
  form.ownerStaffCode = customer.ownerStaffCode || ''
  form.ownerStaffNameSnapshot = customer.ownerStaffNameSnapshot || customer.ownerSalesName || ''
  ensureStaffOption(form.ownerStaffCode, form.ownerStaffNameSnapshot)
}

async function searchSalesStaff(query: string) {
  staffLoading.value = true
  try {
    const params = new URLSearchParams()
    params.set('status', 'ACTIVE')
    if (query.trim()) params.set('keyword', query.trim())
    staffOptions.value = await apiClient.get(`/management/tenant/staff?${params.toString()}`) as StaffRecord[]
  } finally {
    staffLoading.value = false
  }
}

function selectOwnerStaff(value: string | number) {
  const code = String(value || '')
  const selected = staffOptions.value.find((item) => item.staffCode === code)
  form.ownerStaffCode = code
  form.ownerStaffNameSnapshot = selected?.staffName || ''
  form.ownerSalesUserId = ''
  form.ownerSalesName = selected?.staffName || ''
}

function ensureStaffOption(staffCode: string, staffName: string) {
  if (!staffCode || staffOptions.value.some((item) => item.staffCode === staffCode)) return
  staffOptions.value = [{
    id: staffCode,
    staffCode,
    staffName: staffName || staffCode,
    mobile: null,
    email: null,
    employmentStatus: 'ACTIVE',
    primaryOrganizationId: null,
    primaryOrganizationName: null,
    primaryPositionId: null,
    primaryPositionName: null,
    userId: null,
    username: null,
    userDisplayName: null,
    recordOrigin: 'IMPORTED',
    remark: null,
    sourceSystem: null,
    sourceStaffId: null,
    sourceStaffType: null,
    sourceAccountName: null,
    sourceTitle: null,
    sourceBranchName: null,
    sourceRole: null,
    sourceStatus: null,
    sourcePresence: null,
    lastSeenAt: null,
    version: 0,
  }, ...staffOptions.value]
}

async function searchProducts(query: string) {
  productLoading.value = true
  try {
    const result = await getErpManagedProducts({
      begin: 0,
      step: 20,
      productName: empty(query),
      shelfStatusCode: 'ON_SHELF',
      submitStatusCode: 'SUBMITTED',
    })
    productOptions.value = result.items
  } finally {
    productLoading.value = false
  }
}

async function selectProduct(line: SalesOrderLineForm) {
  if (!line.productId) return
  try {
    const product = await getErpManagedProduct(line.productId)
    line.productCodeSnapshot = product.productCode
    line.productNameSnapshot = product.productName
    line.unitCode = product.unitCode || ''
    line.variants = product.variants
    const variant = product.variants.find((item) => item.defaultFlag) || product.variants[0]
    if (variant) {
      line.productVariantId = variant.id
      applyVariant(line, variant)
    }
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '商品详情加载失败'))
  }
}

function selectVariant(line: SalesOrderLineForm) {
  const variant = line.variants.find((item) => String(item.id) === String(line.productVariantId))
  if (variant) applyVariant(line, variant)
}

function applyVariant(line: SalesOrderLineForm, variant: ErpManagedProductVariant) {
  line.skuCodeSnapshot = variant.variantCode
  line.specificationSnapshot = variant.specificationSnapshot
  line.unitCode = variant.unitCode || line.unitCode
  line.unitPrice = Number(variant.salePrice || 0)
}

async function searchWarehouses(query: string) {
  warehouseLoading.value = true
  try {
    const result = await getErpInventoryWarehouses({
      begin: 0,
      step: 20,
      warehouseName: empty(query),
      statusCode: 'ACTIVE',
    })
    warehouseOptions.value = result.items
  } finally {
    warehouseLoading.value = false
  }
}

function addLine() {
  form.lines.push({
    localId: crypto.randomUUID(),
    productId: '',
    productVariantId: '',
    productCodeSnapshot: null,
    skuCodeSnapshot: null,
    productNameSnapshot: '',
    specificationSnapshot: null,
    unitCode: '',
    quantity: 1,
    unitPrice: 0,
    discountAmount: 0,
    remark: null,
    variants: [],
  })
}

function removeLine(index: number) {
  if (form.lines.length === 1) {
    ElMessage.warning('销售订单至少需要一条商品明细')
    return
  }
  form.lines.splice(index, 1)
}

function buildCommand(submit: boolean): SalesOrderCommand | null {
  if (!form.customerId || !form.customerNameSnapshot) {
    ElMessage.warning('请选择客户')
    return null
  }
  const lines = form.lines.map((line) => ({
    productId: line.productId,
    productVariantId: line.productVariantId,
    productCodeSnapshot: line.productCodeSnapshot,
    skuCodeSnapshot: line.skuCodeSnapshot,
    productNameSnapshot: line.productNameSnapshot,
    specificationSnapshot: line.specificationSnapshot,
    unitCode: line.unitCode,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountAmount: line.discountAmount || 0,
    remark: line.remark,
  }))
  if (lines.some((line) => !line.productId || !line.productVariantId || !line.productNameSnapshot || !line.unitCode)) {
    ElMessage.warning('请完善商品、规格和单位')
    return null
  }
  return {
    customerId: form.customerId,
    customerCodeSnapshot: empty(form.customerCodeSnapshot),
    customerNameSnapshot: form.customerNameSnapshot,
    contactNameSnapshot: empty(form.contactNameSnapshot),
    contactPhoneSnapshot: empty(form.contactPhoneSnapshot),
    regionCode: empty(form.regionCode),
    ownerSalesUserId: empty(form.ownerSalesUserId),
    ownerSalesName: empty(form.ownerSalesName),
    ownerStaffCode: empty(form.ownerStaffCode),
    ownerStaffNameSnapshot: empty(form.ownerStaffNameSnapshot),
    orderDate: toIso(form.orderDate),
    paymentMethodCode: empty(form.paymentMethodCode),
    discountAmount: 0,
    remark: empty(form.remark),
    lines,
    submit,
    revision: editingId.value ? form.revision : null,
  }
}

function resetForm() {
  form.customerId = ''
  form.customerCodeSnapshot = ''
  form.customerNameSnapshot = ''
  form.contactNameSnapshot = ''
  form.contactPhoneSnapshot = ''
  form.regionCode = ''
  form.ownerSalesUserId = ''
  form.ownerSalesName = ''
  form.ownerStaffCode = ''
  form.ownerStaffNameSnapshot = ''
  form.orderDate = new Date()
  form.paymentMethodCode = ''
  form.remark = ''
  form.revision = null
  form.lines = []
}

function statusLabel(
  options: Array<{ label: string; value: string }>,
  value: string | null | undefined,
  fallback: Record<string, string> = {},
) {
  const rawValue = value?.trim()
  if (!rawValue) return '-'
  return options.find((item) => item.value === rawValue)?.label || fallback[rawValue] || rawValue
}

function salesOrderStatusLabel(value: string | null | undefined) {
  return statusLabel(orderStatusOptions.value, value, salesOrderStatusFallbackLabels)
}

function dhbOrderStatusLabel(value: string | null | undefined) {
  const rawValue = value?.trim()
  if (!rawValue) return '-'
  const label = formatDhbOrderStatus(rawValue)
  return label === rawValue
    ? dhbOrderStatusFallbackLabels[rawValue] || dhbOrderStatusFallbackLabels[rawValue.toLowerCase()] || rawValue
    : label
}

function salesShipmentStatusLabel(value: string | null | undefined) {
  const rawValue = value?.trim()
  if (!rawValue) return '-'
  return salesShipmentStatusFallbackLabels[rawValue] || statusLabel(shipmentStatusOptions.value, rawValue)
}

function paymentMethodLabel(value: string | null | undefined) {
  return businessDictionaryLabel('ORDER', 'PAYMENT_METHOD', value, '付款方式')
}

function sourceSystemLabel(value: string | null | undefined) {
  if (value === 'DINGHUOBAO' || value === 'DHB') return '订货宝'
  return value || '-'
}

function sourceCreatorLabel(value: Pick<SalesOrderSummary, 'sourceCreatorName' | 'sourceCreatorStaffCode' | 'sourceCreatorId'>) {
  return value.sourceCreatorName || value.sourceCreatorStaffCode || value.sourceCreatorId || '-'
}

function orderTypeLabel(value: string | null | undefined) {
  return businessDictionaryLabel('ORDER', 'SALES_ORDER_TYPE', value, '订单类型')
}

function regionLabel(value: string | null | undefined) {
  return businessDictionaryLabel('COMMON', 'REGION', value, '地区')
}

function unitLabel(value: string | null | undefined) {
  return businessDictionaryLabel('COMMON', 'PRODUCT_UNIT', value, '单位')
}

function orderStatusTag(value: string) {
  if (value === 'SUBMITTED') return 'success'
  if (value === 'CANCELLED') return 'info'
  return 'warning'
}

function outboundStatusTag(value: string) {
  if (value === 'OUT_CONFIRMED') return 'success'
  if (value === 'PARTIAL_OUT') return 'warning'
  return 'info'
}

function shipmentStatusTag(value: string) {
  if (value === 'SIGNED') return 'success'
  if (value === 'SHIPPED') return 'warning'
  if (value === 'CANCELLED') return 'info'
  return 'primary'
}

function paymentStatusTag(value: string) {
  if (value === 'PAID') return 'success'
  if (value === 'PARTIAL_PAID') return 'warning'
  if (value === 'CANCELLED' || value === 'REFUNDED') return 'info'
  return 'danger'
}

function percent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}%`
}

function variantLabel(value: ErpManagedProductVariant) {
  return [value.variantCode, value.specificationSnapshot].filter(Boolean).join(' · ') || value.id
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
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

function startOfDay(value: string) {
  return value ? new Date(`${value}T00:00:00+08:00`).toISOString() : undefined
}

function endOfDay(value: string) {
  return value ? new Date(`${value}T23:59:59+08:00`).toISOString() : undefined
}

function toIso(value: Date | string | null) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
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
.sales-order-page {
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

.staff-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}

.sales-order-form {
  max-height: min(640px, 68vh);
  overflow: auto;
  padding-right: 6px;
}
</style>
