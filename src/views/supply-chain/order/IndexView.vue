<template>
  <div class="dhb-order-page">
    <template v-if="isOrderQueryPage">
      <div class="page-heading">
        <div>
          <h1>{{ pageTitle }}</h1>
          <p>查询订单中心的本地投影；订货宝认证、分页和同步由 Integration 统一负责。</p>
        </div>
        <div v-if="!isPendingOrderPage && !isExceptionOrderPage" class="heading-actions">
          <el-button type="primary" :loading="syncLoading" @click="syncCurrentPage">同步</el-button>
        </div>
      </div>
      <el-alert
        v-if="orderScopeHint"
        class="request-hint"
        type="info"
        :closable="false"
        show-icon
        :title="orderScopeHint"
      />

      <el-card class="filter-card" shadow="never">
        <el-form :model="filters" inline @submit.prevent="handleQuery">
          <el-form-item label="关键词">
            <el-input v-model="filters.keyword" clearable placeholder="订单号/客户/收货人/电话/备注" style="width: 260px" />
          </el-form-item>
          <el-form-item v-if="!isExceptionOrderPage" label="订单状态">
            <el-select
              v-model="filters.orderStatus"
              clearable
              :disabled="isOrderStatusFilterLocked"
              :placeholder="isOrderStatusFilterLocked ? '异常订单固定筛选' : isPendingOrderPage ? '全部待处理状态' : '全部状态'"
              style="width: 180px"
            >
              <el-option v-for="item in availableOrderStatuses" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="开始日期">
            <el-date-picker v-model="filters.startDate" type="date" value-format="YYYY-MM-DD" placeholder="开始日期" />
          </el-form-item>
          <el-form-item label="截止日期">
            <el-date-picker v-model="filters.endDate" type="date" value-format="YYYY-MM-DD" placeholder="截止日期" />
          </el-form-item>
          <el-form-item v-if="!isExceptionOrderPage" label="收款状态">
            <el-select v-model="filters.payStatus" clearable placeholder="全部状态" style="width: 150px">
              <el-option v-for="item in payStatuses" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="接口状态">
            <el-select v-model="filters.apiStatus" style="width: 130px">
              <el-option label="未下载" value="F" />
              <el-option label="已下载" value="T" />
              <el-option label="全部" value="all" />
            </el-select>
          </el-form-item>
          <el-form-item class="filter-actions">
            <el-button type="primary" :loading="loading" native-type="submit">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-alert
        v-if="requestError"
        class="request-error"
        type="error"
        :closable="false"
        show-icon
        :title="requestError"
      />

      <div class="result-heading">
        <div>
          <h2>{{ pageTitle }}列表</h2>
          <p>共 {{ pageData.total }} 条订单，本页 {{ pageData.items.length }} 条；点击订单行可查看客户、收货、商品和发货信息。</p>
        </div>
        <span class="summary-note">同步任务由 Integration 负责</span>
      </div>

      <el-card class="list-card" shadow="never">
        <el-table class="business-table" v-loading="loading" :data="pageData.items" row-key="orderSn" @row-click="openDetail">
          <el-table-column label="订单信息" width="280" fixed="left">
            <template #default="scope">
              <div class="record-identity">
                <span class="record-avatar">单</span>
                <div class="record-identity-content">
                  <strong>{{ scope.row.orderSn }}</strong>
                  <small>订货宝更新时间 {{ formatTime(scope.row.orderUpdateDate) }}</small>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="下单时间" width="170">
            <template #default="scope"><span class="sync-time">{{ formatTime(scope.row.orderDate) }}</span></template>
          </el-table-column>
          <el-table-column label="客户" min-width="220">
            <template #default="scope">
              <div class="stacked-cell">
                <span>{{ scope.row.clientName || '-' }}</span>
                <small>客户编号 {{ scope.row.clientNo || '-' }}</small>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="归属地区" min-width="140">
            <template #default="scope">{{ scope.row.customerArea || '-' }}</template>
          </el-table-column>
          <el-table-column label="订单业务员" min-width="150">
            <template #default="scope">{{ scope.row.salesPerson || '-' }}</template>
          </el-table-column>
          <el-table-column label="订单金额" min-width="150" align="right" header-align="right">
            <template #default="scope">
              <div class="amount-cell"><strong>{{ formatMoney(scope.row.orderTotal) }}</strong><small>订单总额</small></div>
            </template>
          </el-table-column>
          <el-table-column label="运费" width="110" align="right" header-align="right">
            <template #default="scope">{{ formatMoney(scope.row.freightAmount) }}</template>
          </el-table-column>
          <el-table-column label="收货信息" min-width="230">
            <template #default="scope">
              <div class="stacked-cell">
                <span>{{ scope.row.receiveCompany || scope.row.receiveName || '-' }}</span>
                <small>{{ [scope.row.receiveName, scope.row.receivePhone].filter(Boolean).join(' · ') || '暂无联系人' }}</small>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="订单状态" width="125">
            <template #default="scope">
              <div class="status-cell">
                <el-tag :type="orderStatusTagType(scope.row.orderStatus)" effect="light" size="small">{{ formatOrderStatus(scope.row.orderStatus) }}</el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="收款状态" width="125">
            <template #default="scope">
              <div class="status-cell">
                <el-tag :type="documentStatusTagType(scope.row.payStatus)" effect="light" size="small">{{ formatPaymentStatus(scope.row.payStatus) }}</el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="同步状态" width="150">
            <template #default="scope">
              <div class="status-cell">
                <el-tag :type="documentStatusTagType(scope.row.orderApi)" effect="light" size="small">{{ formatApiStatus(scope.row.orderApi) }}</el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="同步异常" width="120">
            <template #default="scope">
              <span class="status-text">{{ formatExceptionStatus(scope.row.orderException) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="订单类型" width="125">
            <template #default="scope">{{ formatOrderType(scope.row.orderType) }}</template>
          </el-table-column>
          <el-table-column label="下单来源" width="125">
            <template #default="scope">{{ formatAdminOrder(scope.row.isAdminOrder) }}</template>
          </el-table-column>
          <el-table-column label="下单端" width="125">
            <template #default="scope">{{ formatSourceDevice(scope.row.sourceDevice) }}</template>
          </el-table-column>
          <el-table-column label="结算方式" width="125">
            <template #default="scope">
              {{ formatSettlementMethod(scope.row.settlementMethod) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="96" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openDetail(scope.row)">详情</el-button>
            </template>
          </el-table-column>
          <template #empty><el-empty description="暂无本地订单投影" /></template>
        </el-table>
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

      <el-drawer
        v-model="detailVisible"
        class="order-detail-drawer"
        size="min(1080px, 92vw)"
        :with-header="false"
      >
        <div class="detail-shell">
          <header class="detail-hero">
            <div>
              <span>订单详情</span>
              <h2>{{ selectedOrder?.orderSn || '-' }}</h2>
              <p>{{ selectedOrder?.clientName || '暂无客户名称' }} · 下单 {{ formatTime(selectedOrder?.orderDate || null) }}</p>
              <div class="detail-tags">
                <el-tag :type="orderStatusTagType(selectedOrder?.orderStatus || null)" effect="light">{{ formatOrderStatus(selectedOrder?.orderStatus || null) }}</el-tag>
                <el-tag effect="plain">{{ formatPaymentStatus(selectedOrder?.payStatus || null) }}</el-tag>
              </div>
            </div>
            <el-button circle plain aria-label="关闭订单详情" @click="detailVisible = false">×</el-button>
          </header>
          <div class="detail-content">
        <el-skeleton v-if="detailLoading" :rows="8" animated />
        <template v-else-if="detail">
          <div class="detail-summary">
            <div><span>订单编号</span><strong>{{ detail.order.orderSn }}</strong></div>
            <div><span>客户名称</span><strong>{{ detail.order.clientName || '-' }}</strong></div>
            <div><span>订单金额</span><strong>{{ formatMoney(detail.order.orderTotal) }}</strong></div>
            <div><span>同步状态</span><strong>{{ detail.synchronizedFromProvider ? '已落库' : '本地投影' }}</strong></div>
          </div>
          <el-descriptions :column="3" border>
            <el-descriptions-item label="下单时间">{{ formatTime(detail.order.orderDate) }}</el-descriptions-item>
            <el-descriptions-item label="订货宝更新时间">{{ formatTime(detail.order.orderUpdateDate) }}</el-descriptions-item>
            <el-descriptions-item label="订货宝更新时间原值">{{ detail.order.orderUpdateTime || '-' }}</el-descriptions-item>
            <el-descriptions-item label="配送日期">{{ formatDeliveryDate(detail.order.deliveryDate) }}</el-descriptions-item>
            <el-descriptions-item label="订单状态">{{ formatOrderStatus(detail.order.orderStatus) }}</el-descriptions-item>
            <el-descriptions-item label="收款状态">{{ formatPaymentStatus(detail.order.payStatus) }}</el-descriptions-item>
            <el-descriptions-item label="同步状态">{{ formatApiStatus(detail.order.orderApi) }}</el-descriptions-item>
            <el-descriptions-item label="同步异常">{{ formatExceptionStatus(detail.order.orderException) }}</el-descriptions-item>
            <el-descriptions-item label="订单类型">{{ formatOrderType(detail.order.orderType) }}</el-descriptions-item>
            <el-descriptions-item label="发货方式">{{ formatSendType(detail.order.orderSendType) }}</el-descriptions-item>
            <el-descriptions-item label="拆单类型">{{ formatSplitType(detail.order.splitTypeName, detail.order.splitType) }}</el-descriptions-item>
            <el-descriptions-item label="下单来源">{{ formatAdminOrder(detail.order.isAdminOrder) }}</el-descriptions-item>
            <el-descriptions-item label="下单端">{{ formatSourceDevice(detail.order.sourceDevice) }}</el-descriptions-item>
            <el-descriptions-item label="客户最近下单时间">{{ detail.order.lastOrderAt || '-' }}</el-descriptions-item>
            <el-descriptions-item label="客户类型">{{ formatCustomerType(detail.order.customerType) }}</el-descriptions-item>
            <el-descriptions-item label="客户标签">{{ detail.order.customerTag || '-' }}</el-descriptions-item>
            <el-descriptions-item label="客户区域">{{ detail.order.customerArea || '-' }}</el-descriptions-item>
            <el-descriptions-item label="结算方式">{{ formatSettlementMethod(detail.order.settlementMethod) }}</el-descriptions-item>
            <el-descriptions-item label="管理员">{{ detail.order.adminUser || '-' }}</el-descriptions-item>
            <el-descriptions-item label="操作人">{{ detail.order.operationName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="业务员">{{ detail.order.salesPerson || '-' }}</el-descriptions-item>
            <el-descriptions-item label="业务员电话">{{ detail.order.salesPersonMobile || '-' }}</el-descriptions-item>
            <el-descriptions-item label="辅助业务员">{{ detail.order.assistantSalesPersons || '-' }}</el-descriptions-item>
            <el-descriptions-item label="审核时间">{{ detail.order.auditAt || '-' }}</el-descriptions-item>
            <el-descriptions-item label="客户编号">{{ detail.order.clientNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="客户 GUID">{{ detail.order.clientGuid || '-' }}</el-descriptions-item>
            <el-descriptions-item label="收货单位">{{ detail.order.receiveCompany || '-' }}</el-descriptions-item>
            <el-descriptions-item label="收货人">{{ detail.order.receiveName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ detail.order.receivePhone || '-' }}</el-descriptions-item>
            <el-descriptions-item label="省 / 市 / 区" :span="3">
              {{ [detail.order.province, detail.order.city, detail.order.district].filter(Boolean).join(' / ') || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="收货地址" :span="3">{{ detail.order.receiveAddress || '-' }}</el-descriptions-item>
            <el-descriptions-item label="订单备注" :span="3">{{ detail.order.orderRemark || '-' }}</el-descriptions-item>
            <el-descriptions-item label="客户留言" :span="3">{{ detail.order.customerRemark || '-' }}</el-descriptions-item>
            <el-descriptions-item label="内部沟通" :span="3">{{ detail.order.internalComment || '-' }}</el-descriptions-item>
          </el-descriptions>
          <div class="detail-summary detail-summary-finance">
            <div><span>商品重量</span><strong>{{ formatNumber(detail.order.goodsWeight, 'kg') }}</strong></div>
            <div><span>税费</span><strong>{{ formatMoney(detail.order.taxAmount) }}</strong></div>
            <div><span>运费</span><strong>{{ formatMoney(detail.order.freightAmount) }}</strong></div>
            <div><span>特批优惠价</span><strong>{{ formatMoney(detail.order.discountPrice) }}</strong></div>
            <div><span>结算价</span><strong>{{ formatMoney(detail.order.discountTotal) }}</strong></div>
            <div><span>申请优惠合计</span><strong>{{ formatMoney(detail.order.applyTotal) }}</strong></div>
            <div><span>优惠券优惠</span><strong>{{ formatMoney(detail.order.couponDiscountedAmount) }}</strong></div>
          </div>
          <h3 class="detail-title">发票信息</h3>
          <el-descriptions :column="3" border>
            <el-descriptions-item label="发票类型">{{ formatInvoiceType(detail.order.invoiceType) }}</el-descriptions-item>
            <el-descriptions-item label="发票抬头">{{ detail.order.invoiceTitle || '-' }}</el-descriptions-item>
            <el-descriptions-item label="发票内容">{{ detail.order.invoiceContent || '-' }}</el-descriptions-item>
            <el-descriptions-item label="纳税人识别号">{{ detail.order.taxpayerNumber || '-' }}</el-descriptions-item>
            <el-descriptions-item label="开户行">{{ detail.order.invoiceBank || '-' }}</el-descriptions-item>
            <el-descriptions-item label="银行账号" :span="2">{{ detail.order.invoiceBankAccount || '-' }}</el-descriptions-item>
          </el-descriptions>
          <h3 class="detail-title">商品明细</h3>
          <el-table :data="detail.lines" size="small">
            <el-table-column prop="productName" label="商品名称" min-width="220" />
            <el-table-column prop="skuNo" label="SKU" min-width="150" />
            <el-table-column prop="quantity" label="数量" width="100" />
            <el-table-column prop="unit" label="单位" width="90" />
            <el-table-column label="单价" width="110" align="right">
              <template #default="scope">{{ formatMoney(scope.row.unitPrice) }}</template>
            </el-table-column>
            <el-table-column label="明细金额" width="120" align="right">
              <template #default="scope">{{ formatMoney(scope.row.lineAmount) }}</template>
            </el-table-column>
            <el-table-column label="商品属性" width="150">
              <template #default="scope">{{ formatPreSale(scope.row.preSale) }} · {{ formatContentType(scope.row.contentType) }}</template>
            </el-table-column>
            <el-table-column label="进货价" width="110" align="right">
              <template #default="scope">{{ formatMoney(scope.row.purchasePrice) }}</template>
            </el-table-column>
            <el-table-column label="换算关系" width="110" align="right">
              <template #default="scope">{{ formatNumber(scope.row.conversionNumber) }}</template>
            </el-table-column>
            <el-table-column label="折扣比例" width="110" align="right">
              <template #default="scope">{{ formatNumber(scope.row.contentPercent) }}</template>
            </el-table-column>
            <el-table-column label="发票税率" width="110" align="right">
              <template #default="scope">{{ scope.row.invoiceTax || '-' }}</template>
            </el-table-column>
            <el-table-column label="整箱优惠" width="110" align="right">
              <template #default="scope">{{ formatMoney(scope.row.offerPrice) }}</template>
            </el-table-column>
            <el-table-column label="折后金额" width="120" align="right">
              <template #default="scope">{{ formatMoney(scope.row.actualAmount ?? scope.row.lineAmount) }}</template>
            </el-table-column>
            <el-table-column label="重量" width="100" align="right">
              <template #default="scope">{{ formatNumber(scope.row.goodsWeight, 'kg') }}</template>
            </el-table-column>
            <el-table-column prop="optionsBarcode" label="条码" min-width="140" />
            <el-table-column prop="multiName" label="规格" min-width="150" show-overflow-tooltip />
            <el-table-column prop="remark" label="明细备注" min-width="150" show-overflow-tooltip />
          </el-table>
          <h3 class="detail-title">发货单信息</h3>
          <el-table :data="detail.shipments" size="small">
            <el-table-column prop="shipmentNo" label="发货单号" min-width="180" />
            <el-table-column label="发货状态" width="120">
              <template #default="scope">{{ statusLabel(shipmentStatuses, scope.row.status) }}</template>
            </el-table-column>
            <el-table-column prop="shipmentDate" label="发货时间" min-width="180" />
            <el-table-column prop="stockUpTime" label="备货时间" min-width="180" />
          </el-table>
          <h3 class="detail-title">发货物流明细</h3>
          <el-table v-if="orderLogisticsDetail" :data="orderLogisticsDetail.lines" size="small">
            <el-table-column label="明细类型" width="110"><template #default="scope">{{ formatShipmentLineType(scope.row.lineType) }}</template></el-table-column>
            <el-table-column prop="productName" label="商品名称" min-width="190" />
            <el-table-column prop="skuNo" label="SKU" min-width="130" />
            <el-table-column prop="warehouseName" label="仓库" min-width="130" />
            <el-table-column prop="quantity" label="已出库数量" width="110" />
            <el-table-column prop="orderedQuantity" label="订购数量" width="100" />
            <el-table-column prop="stockedQuantity" label="已出库" width="100" />
            <el-table-column prop="realStock" label="实际库存" width="100" />
            <el-table-column prop="waitQuantity" label="待出库" width="100" />
            <el-table-column prop="remark" label="商品备注" min-width="150" show-overflow-tooltip />
          </el-table>
          <el-empty v-else description="暂无已落库的出库/物流快照" />
          <h3 class="detail-title">收付款记录</h3>
          <div class="detail-summary detail-summary-finance">
            <div><span>关联收付款单</span><strong>{{ detail.financialDocuments?.length || 0 }}</strong></div>
            <div><span>已确认收款</span><strong>{{ formatMoney(financialSummary.received) }}</strong></div>
            <div><span>待确认收款</span><strong>{{ formatMoney(financialSummary.pending) }}</strong></div>
            <div><span>已取消收款</span><strong>{{ formatMoney(financialSummary.canceled) }}</strong></div>
            <div><span>付款金额</span><strong>{{ formatMoney(financialSummary.paid) }}</strong></div>
          </div>
          <el-table :data="detail.financialDocuments || []" size="small">
            <el-table-column label="单据类型" width="100"><template #default="scope">{{ scope.row.documentType === 'RECEIPT' ? '收款单' : '付款单' }}</template></el-table-column>
            <el-table-column prop="documentNo" label="单号" min-width="170" />
            <el-table-column label="业务类型" min-width="140"><template #default="scope">{{ formatFinancialBusinessType(scope.row.businessType, scope.row.documentType) }}</template></el-table-column>
            <el-table-column label="支付方式" min-width="180"><template #default="scope">{{ formatPaymentMethod(scope.row.paymentMethod) }}</template></el-table-column>
            <el-table-column prop="serialNumber" label="流水号" min-width="190" />
            <el-table-column label="金额" width="140" align="right"><template #default="scope"><div class="amount-cell"><strong>{{ formatMoney(scope.row.amount) }}</strong><small>{{ scope.row.documentType === 'RECEIPT' ? '收款金额' : '付款金额' }}</small></div></template></el-table-column>
            <el-table-column prop="accountName" label="结算账户" min-width="150" />
            <el-table-column label="单据状态" width="120"><template #default="scope">{{ statusLabel(financialStatuses, scope.row.status) }}</template></el-table-column>
            <el-table-column prop="transactionAt" label="交易时间" min-width="170" />
            <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
          </el-table>
        </template>
        <el-empty v-else description="暂无详情" />
          </div>
        </div>
      </el-drawer>
    </template>

    <template v-else-if="isShipmentPage">
      <div class="page-heading">
        <div><h1>{{ pageTitle }}</h1><p>查询订单中心已落库的订货宝{{ pageTitle }}；本页面不实时访问供应商。</p></div>
        <div class="heading-actions">
          <el-button type="primary" :loading="syncLoading" @click="syncCurrentPage">同步</el-button>
        </div>
      </div>
      <el-card class="filter-card" shadow="never">
        <el-form :model="documentFilters" inline @submit.prevent="queryDocuments">
          <el-form-item :label="isOutboundPage ? '发货状态' : '物流状态'">
            <el-select v-model="documentFilters.status" clearable placeholder="全部状态" style="width: 170px">
              <el-option v-for="item in shipmentStatuses" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="isOutboundPage" label="出库类型">
            <el-select v-model="documentFilters.typeId" clearable placeholder="全部类型" style="width: 170px">
              <el-option v-for="item in shipmentTypes" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="订单编号"><el-input v-model="documentFilters.orderNo" clearable placeholder="精确查询" /></el-form-item>
          <el-form-item label="开始日期"><el-date-picker v-model="documentFilters.from" type="date" value-format="YYYY-MM-DD" /></el-form-item>
          <el-form-item label="截止日期"><el-date-picker v-model="documentFilters.to" type="date" value-format="YYYY-MM-DD" /></el-form-item>
          <el-form-item><el-button type="primary" native-type="submit" :loading="documentLoading">查询</el-button><el-button @click="resetDocumentFilters">重置</el-button></el-form-item>
        </el-form>
      </el-card>
      <el-alert v-if="documentError" class="request-error" type="error" :closable="false" show-icon :title="documentError" />
      <div class="result-heading"><div><h2>{{ pageTitle }}列表</h2><p>共 {{ shipmentTotal }} 条，本页 {{ shipmentRows.length }} 条；点击行查看单据与商品明细。</p></div></div>
      <el-card class="list-card" shadow="never">
        <el-table class="business-table" v-loading="documentLoading" :data="shipmentRows" :row-key="isOutboundPage ? 'shipmentNo' : 'orderNo'" @row-click="openShipmentDetail">
          <el-table-column :label="isOutboundPage ? '发货单信息' : '物流信息'" width="280" fixed="left">
            <template #default="scope"><div class="record-identity"><span class="record-avatar">发</span><div class="record-identity-content"><strong>{{ scope.row.shipmentNo || scope.row.orderNo || '-' }}</strong><span>订单 {{ scope.row.orderNo || '-' }}</span><small>{{ formatTime(isOutboundPage ? scope.row.shipmentAt : scope.row.syncedAt) }}</small></div></div></template>
          </el-table-column>
          <el-table-column label="客户" min-width="180"><template #default="scope">{{ scope.row.customerName || '-' }}</template></el-table-column>
          <el-table-column label="仓库" min-width="150"><template #default="scope">{{ scope.row.warehouseName || '-' }}</template></el-table-column>
          <el-table-column label="物流公司" min-width="180"><template #default="scope">{{ scope.row.logisticsName || '-' }}</template></el-table-column>
          <el-table-column label="物流单号" min-width="180"><template #default="scope">{{ scope.row.trackingNo || '-' }}</template></el-table-column>
          <el-table-column v-if="isOutboundPage" label="出库类型" width="130"><template #default="scope">{{ formatShipmentType(scope.row.typeName) }}</template></el-table-column>
          <el-table-column :label="isOutboundPage ? '发货状态' : '物流状态'" width="140"><template #default="scope"><div class="status-cell"><el-tag effect="light" size="small" :type="documentStatusTagType(scope.row.status)">{{ statusLabel(shipmentStatuses, scope.row.status) }}</el-tag></div></template></el-table-column>
          <el-table-column :label="isOutboundPage ? '发货时间' : '同步时间'" width="165"><template #default="scope"><span class="sync-time">{{ formatTime(isOutboundPage ? scope.row.shipmentAt : scope.row.syncedAt) }}</span></template></el-table-column>
          <el-table-column label="操作" width="96" fixed="right" align="center"><template #default="scope"><el-button link type="primary" @click.stop="openShipmentDetail(scope.row)">详情</el-button></template></el-table-column>
          <template #empty><el-empty :description="isOutboundPage ? '暂无本地发货单' : '暂无本地物流快照'" /></template>
        </el-table>
        <div class="pagination-row"><el-pagination v-model:current-page="documentPage" v-model:page-size="documentPageSize" layout="total, sizes, prev, pager, next" :page-sizes="[20, 50, 100]" :total="shipmentTotal" @current-change="loadDocumentPage" @size-change="changeDocumentPageSize" /></div>
      </el-card>
      <el-drawer v-model="shipmentDetailVisible" class="order-detail-drawer" size="min(960px, 92vw)" :with-header="false">
        <div class="detail-shell">
          <header class="detail-hero"><div><span>{{ isOutboundPage ? '发货单详情' : '物流详情' }}</span><h2>{{ selectedShipment?.shipmentNo || selectedShipment?.orderNo || '-' }}</h2><p>关联订单 {{ selectedShipment?.orderNo || '-' }} · {{ selectedShipment?.warehouseName || '暂无仓库' }}</p><div class="detail-tags"><el-tag :type="documentStatusTagType(selectedShipment?.status || null)" effect="light">{{ statusLabel(shipmentStatuses, selectedShipment?.status || null) }}</el-tag></div></div><el-button circle plain aria-label="关闭详情" @click="shipmentDetailVisible = false">×</el-button></header>
          <div class="detail-content">
        <el-skeleton v-if="detailLoading" :rows="7" animated />
        <template v-else-if="displayShipmentDetail">
          <el-descriptions :column="3" border>
            <el-descriptions-item :label="isOutboundPage ? '发货单号' : '物流快照单号'">{{ displayShipmentDetail.shipment.shipmentNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="订单编号">{{ displayShipmentDetail.shipment.orderNo || '-' }}</el-descriptions-item>
            <el-descriptions-item :label="isOutboundPage ? '发货状态' : '物流状态'">{{ statusLabel(shipmentStatuses, displayShipmentDetail.shipment.status) }}</el-descriptions-item>
            <el-descriptions-item label="出库类型">{{ formatShipmentType(displayShipmentDetail.shipment.typeName) }}</el-descriptions-item>
            <el-descriptions-item label="客户">{{ displayShipmentDetail.shipment.customerName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="仓库">{{ displayShipmentDetail.shipment.warehouseName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="发货时间">{{ formatTime(displayShipmentDetail.shipment.shipmentAt) }}</el-descriptions-item>
            <el-descriptions-item label="物流公司">{{ displayShipmentDetail.shipment.logisticsName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="物流单号">{{ displayShipmentDetail.shipment.trackingNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="3">{{ displayShipmentDetail.shipment.remark || '-' }}</el-descriptions-item>
          </el-descriptions>
          <h3 class="detail-title">商品明细</h3>
          <el-table :data="displayShipmentDetail.lines" size="small">
            <el-table-column v-if="!isOutboundPage" label="明细类型" width="110"><template #default="scope">{{ formatShipmentLineType(scope.row.lineType) }}</template></el-table-column>
            <el-table-column prop="productName" label="商品名称" min-width="200" />
            <el-table-column prop="skuNo" label="SKU" min-width="130" />
            <el-table-column prop="quantity" :label="isOutboundPage ? '发货数量' : '数量'" width="100" />
            <el-table-column v-if="!isOutboundPage" prop="orderedQuantity" label="订购数量" width="100" />
            <el-table-column v-if="!isOutboundPage" prop="stockedQuantity" label="已出库" width="100" />
            <el-table-column v-if="!isOutboundPage" prop="realStock" label="实际库存" width="100" />
            <el-table-column v-if="!isOutboundPage" prop="waitQuantity" label="待出库" width="100" />
            <el-table-column prop="unit" label="单位" width="80" />
            <el-table-column v-if="isOutboundPage" label="单价" width="110"><template #default="scope">{{ formatMoney(scope.row.unitPrice) }}</template></el-table-column>
            <el-table-column v-if="isOutboundPage" label="金额" width="110"><template #default="scope">{{ formatMoney(scope.row.amount) }}</template></el-table-column>
          </el-table>
        </template>
          </div>
        </div>
      </el-drawer>
    </template>

    <template v-else-if="isReturnPage">
      <div class="page-heading">
        <div><h1>退货单</h1><p>查询订单中心已落库的订货宝退货单和商品明细。</p></div>
        <div class="heading-actions">
          <el-button type="primary" :loading="syncLoading" @click="syncCurrentPage">同步</el-button>
        </div>
      </div>
      <el-card class="filter-card" shadow="never">
        <el-form :model="documentFilters" inline @submit.prevent="queryDocuments">
          <el-form-item label="退货状态"><el-select v-model="documentFilters.status" clearable placeholder="全部状态" style="width: 180px"><el-option v-for="item in returnStatuses" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item>
          <el-form-item label="订单编号"><el-input v-model="documentFilters.orderNo" clearable placeholder="精确查询" /></el-form-item>
          <el-form-item label="开始日期"><el-date-picker v-model="documentFilters.from" type="date" value-format="YYYY-MM-DD" /></el-form-item>
          <el-form-item label="截止日期"><el-date-picker v-model="documentFilters.to" type="date" value-format="YYYY-MM-DD" /></el-form-item>
          <el-form-item><el-button type="primary" native-type="submit" :loading="documentLoading">查询</el-button><el-button @click="resetDocumentFilters">重置</el-button></el-form-item>
        </el-form>
      </el-card>
      <el-alert v-if="documentError" class="request-error" type="error" :closable="false" show-icon :title="documentError" />
      <div class="result-heading"><div><h2>退货单列表</h2><p>共 {{ returnPage.total }} 条，本页 {{ returnPage.items.length }} 条；点击行查看退货原因和商品明细。</p></div></div>
      <el-card class="list-card" shadow="never">
        <el-table class="business-table" v-loading="documentLoading" :data="returnPage.items" row-key="returnNo" @row-click="openReturnDetail">
          <el-table-column label="退货单信息" width="280" fixed="left"><template #default="scope"><div class="record-identity"><span class="record-avatar">退</span><div class="record-identity-content"><strong>{{ scope.row.returnNo }}</strong><span>订单 {{ scope.row.orderNo || '-' }}</span><small>{{ formatTime(scope.row.returnedAt) }}</small></div></div></template></el-table-column>
          <el-table-column label="退货原因" min-width="220"><template #default="scope">{{ scope.row.reason || '-' }}</template></el-table-column>
          <el-table-column label="物流单号" min-width="170"><template #default="scope">{{ scope.row.logisticsNo || '-' }}</template></el-table-column>
          <el-table-column label="退货金额" min-width="140" align="right" header-align="right"><template #default="scope">{{ formatMoney(scope.row.returnAmount) }}</template></el-table-column>
          <el-table-column label="结算金额" min-width="140" align="right" header-align="right"><template #default="scope">{{ formatMoney(scope.row.settlementAmount) }}</template></el-table-column>
          <el-table-column label="退货状态" width="140"><template #default="scope"><div class="status-cell"><el-tag :type="documentStatusTagType(scope.row.status)" effect="light" size="small">{{ statusLabel(returnStatuses, scope.row.status) }}</el-tag><small>退货业务</small></div></template></el-table-column>
          <el-table-column label="退货日期" width="165"><template #default="scope"><span class="sync-time">{{ formatTime(scope.row.returnedAt) }}</span></template></el-table-column>
          <el-table-column label="操作" width="96" fixed="right" align="center"><template #default="scope"><el-button link type="primary" @click.stop="openReturnDetail(scope.row)">详情</el-button></template></el-table-column>
          <template #empty><el-empty description="暂无本地退货单" /></template>
        </el-table>
        <div class="pagination-row"><el-pagination v-model:current-page="documentPage" v-model:page-size="documentPageSize" layout="total, sizes, prev, pager, next" :page-sizes="[20, 50, 100]" :total="returnPage.total" @current-change="loadDocumentPage" @size-change="changeDocumentPageSize" /></div>
      </el-card>
      <el-drawer v-model="returnDetailVisible" class="order-detail-drawer" size="min(960px, 92vw)" :with-header="false">
        <div class="detail-shell">
          <header class="detail-hero"><div><span>退货单详情</span><h2>{{ selectedReturn?.returnNo || '-' }}</h2><p>关联订单 {{ selectedReturn?.orderNo || '-' }} · {{ formatTime(selectedReturn?.returnedAt || null) }}</p><div class="detail-tags"><el-tag :type="documentStatusTagType(selectedReturn?.status || null)" effect="light">{{ statusLabel(returnStatuses, selectedReturn?.status || null) }}</el-tag></div></div><el-button circle plain aria-label="关闭退货详情" @click="returnDetailVisible = false">×</el-button></header>
          <div class="detail-content">
        <el-skeleton v-if="detailLoading" :rows="7" animated />
        <template v-else-if="returnDetail">
          <el-descriptions :column="3" border>
            <el-descriptions-item label="退货单号">{{ returnDetail.returnDocument.returnNo }}</el-descriptions-item>
            <el-descriptions-item label="订单编号">{{ returnDetail.returnDocument.orderNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="退货状态">{{ statusLabel(returnStatuses, returnDetail.returnDocument.status) }}</el-descriptions-item>
            <el-descriptions-item label="经办人">{{ returnDetail.returnDocument.staffName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="退货金额">{{ formatMoney(returnDetail.returnDocument.returnAmount) }}</el-descriptions-item>
            <el-descriptions-item label="结算金额">{{ formatMoney(returnDetail.returnDocument.settlementAmount) }}</el-descriptions-item>
            <el-descriptions-item label="退货日期">{{ formatTime(returnDetail.returnDocument.returnedAt) }}</el-descriptions-item>
            <el-descriptions-item label="客户编号">{{ returnDetail.returnDocument.customerNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="退货类型">{{ formatReturnType(returnDetail.returnDocument.returnType) }}</el-descriptions-item>
            <el-descriptions-item label="配送方式">{{ formatDeliveryMode(returnDetail.returnDocument.deliveryMode) }}</el-descriptions-item>
            <el-descriptions-item label="退货原因" :span="3">{{ returnDetail.returnDocument.reason || '-' }}</el-descriptions-item>
            <el-descriptions-item label="收货人">{{ returnDetail.returnDocument.consignee || '-' }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ returnDetail.returnDocument.phone || '-' }}</el-descriptions-item>
            <el-descriptions-item label="退货地址" :span="2">{{ returnDetail.returnDocument.address || '-' }}</el-descriptions-item>
            <el-descriptions-item label="物流公司">{{ returnDetail.returnDocument.logisticsCompany || '-' }}</el-descriptions-item>
            <el-descriptions-item label="物流单号">{{ returnDetail.returnDocument.logisticsNo || '-' }}</el-descriptions-item>
          </el-descriptions>
          <h3 class="detail-title">商品明细</h3>
          <el-table :data="returnDetail.lines" size="small">
            <el-table-column prop="productName" label="商品名称" min-width="190" />
            <el-table-column prop="skuNo" label="SKU" min-width="130" />
            <el-table-column prop="quantity" label="申请数量" width="100" />
            <el-table-column prop="confirmedQuantity" label="确认数量" width="100" />
            <el-table-column label="申请单价" width="110"><template #default="scope">{{ formatMoney(scope.row.unitPrice) }}</template></el-table-column>
            <el-table-column label="确认单价" width="110"><template #default="scope">{{ formatMoney(scope.row.confirmedPrice) }}</template></el-table-column>
            <el-table-column prop="warehouseName" label="退货仓库" min-width="130" />
          </el-table>
        </template>
          </div>
        </div>
      </el-drawer>
    </template>

    <template v-else-if="isFinancePage">
      <div class="page-heading">
        <div><h1>订单结算管理</h1><p>统一查看应收依据、财务对账、收付记录和对账差异；当前已接入收款单、付款单只读查询。</p></div>
        <div v-if="isFinancialQueryPage" class="heading-actions">
          <el-button type="primary" :loading="syncLoading" @click="syncCurrentPage">同步</el-button>
        </div>
      </div>
      <el-card shadow="never">
        <template v-if="settlementTab === 'receivable'">
          <div class="settlement-placeholder">
            <el-empty description="暂未接入应收依据查询接口" />
            <el-alert
              type="info"
              :closable="false"
              show-icon
              title="应收依据说明：记录订单为什么形成应收、应收金额由哪些订单和结算事实构成，用于财务追溯、账龄分析和后续对账。本期暂不在前端计算应收金额。"
            />
          </div>
        </template>

        <template v-else-if="settlementTab === 'collections'">
          <div class="section-heading">
            <div><h2>{{ financialType === 'RECEIPT' ? '收款单' : '付款单' }}</h2><p>查询订单中心已落库的订货宝{{ financialType === 'RECEIPT' ? '收款单' : '付款单' }}。</p></div>
          </div>
          <el-alert class="request-hint" type="info" :closable="false" show-icon title="支付方式按订货宝 TypeId 转换为中文；收款类型/付款类型按 IncexpId 展示，接口未返回的字段显示为“-”。" />
          <el-card class="filter-card" shadow="never">
            <el-form :model="documentFilters" inline @submit.prevent="queryDocuments">
              <el-form-item label="订单编号"><el-input v-model="documentFilters.orderNo" clearable placeholder="精确查询" /></el-form-item>
              <el-form-item label="开始日期"><el-date-picker v-model="documentFilters.from" type="date" value-format="YYYY-MM-DD" /></el-form-item>
              <el-form-item label="截止日期"><el-date-picker v-model="documentFilters.to" type="date" value-format="YYYY-MM-DD" /></el-form-item>
              <el-form-item><el-button type="primary" :loading="documentLoading" @click="queryDocuments">查询</el-button><el-button @click="resetDocumentFilters">重置</el-button></el-form-item>
            </el-form>
          </el-card>
          <el-alert v-if="documentError" class="request-error" type="error" :closable="false" show-icon :title="documentError" />
          <el-table class="business-table" v-loading="documentLoading" :data="financialPage.items" row-key="documentNo" @row-click="openFinancialDetail">
            <el-table-column :label="financialType === 'RECEIPT' ? '收款单信息' : '付款单信息'" width="280" fixed="left"><template #default="scope"><div class="record-identity"><span class="record-avatar">{{ financialType === 'RECEIPT' ? '收' : '付' }}</span><div class="record-identity-content"><strong>{{ scope.row.documentNo }}</strong><span>订单 {{ scope.row.orderNo || '-' }}</span><small>关联单号 {{ scope.row.relatedDocumentNo || '-' }}</small></div></div></template></el-table-column>
            <el-table-column label="客户编号" width="140"><template #default="scope">{{ scope.row.customerNo || '-' }}</template></el-table-column>
            <el-table-column :label="financialType === 'RECEIPT' ? '收款类型' : '付款类型'" min-width="150"><template #default="scope">{{ formatFinancialBusinessType(scope.row.businessType, scope.row.documentType) }}</template></el-table-column>
            <el-table-column label="支付方式" min-width="190"><template #default="scope">{{ formatPaymentMethod(scope.row.paymentMethod) }}</template></el-table-column>
            <el-table-column :label="financialType === 'RECEIPT' ? '收款流水号' : '付款流水号'" min-width="190"><template #default="scope">{{ scope.row.serialNumber || '-' }}</template></el-table-column>
            <el-table-column label="金额" min-width="150" align="right" header-align="right"><template #default="scope"><div class="amount-cell"><strong>{{ formatMoney(scope.row.amount) }}</strong><small>{{ financialType === 'RECEIPT' ? '收款金额' : '付款金额' }}</small></div></template></el-table-column>
            <el-table-column label="结算账户" min-width="210"><template #default="scope"><div class="stacked-cell"><span>{{ scope.row.accountName || '-' }}</span><small>{{ scope.row.bankName || '暂无开户行' }}</small></div></template></el-table-column>
            <el-table-column label="单据状态" width="130"><template #default="scope"><div class="status-cell"><el-tag :type="documentStatusTagType(scope.row.status)" effect="light" size="small">{{ statusLabel(financialStatuses, scope.row.status) }}</el-tag><small>{{ financialType === 'RECEIPT' ? '收款单' : '付款单' }}</small></div></template></el-table-column>
            <el-table-column label="交易日期" width="165"><template #default="scope"><span class="sync-time">{{ formatTime(scope.row.transactionAt) }}</span></template></el-table-column>
            <el-table-column label="操作" width="96" fixed="right" align="center"><template #default="scope"><el-button link type="primary" @click.stop="openFinancialDetail(scope.row)">详情</el-button></template></el-table-column>
            <template #empty><el-empty :description="`暂无本地${financialType === 'RECEIPT' ? '收款单' : '付款单'}`" /></template>
          </el-table>
          <div class="pagination-row"><el-pagination v-model:current-page="documentPage" v-model:page-size="documentPageSize" layout="total, sizes, prev, pager, next" :page-sizes="[20, 50, 100]" :total="financialPage.total" @current-change="loadDocumentPage" @size-change="changeDocumentPageSize" /></div>
          <el-drawer v-model="financialDetailVisible" class="order-detail-drawer" size="min(820px, 92vw)" :with-header="false">
            <div v-if="selectedFinancial" class="detail-shell">
              <header class="detail-hero"><div><span>{{ financialType === 'RECEIPT' ? '收款单详情' : '付款单详情' }}</span><h2>{{ selectedFinancial.documentNo }}</h2><p>关联订单 {{ selectedFinancial.orderNo || '-' }} · {{ formatTime(selectedFinancial.transactionAt) }}</p><div class="detail-tags"><el-tag :type="documentStatusTagType(selectedFinancial.status)" effect="light">{{ statusLabel(financialStatuses, selectedFinancial.status) }}</el-tag></div></div><el-button circle plain aria-label="关闭收付详情" @click="financialDetailVisible = false">×</el-button></header>
              <div class="detail-content"><div class="detail-summary"><div><span>{{ financialType === 'RECEIPT' ? '收款金额' : '付款金额' }}</span><strong>{{ formatMoney(selectedFinancial.amount) }}</strong></div><div><span>支付方式</span><strong>{{ formatPaymentMethod(selectedFinancial.paymentMethod) }}</strong></div><div><span>{{ financialType === 'RECEIPT' ? '收款类型' : '付款类型' }}</span><strong>{{ formatFinancialBusinessType(selectedFinancial.businessType, selectedFinancial.documentType) }}</strong></div><div><span>交易时间</span><strong>{{ formatTime(selectedFinancial.transactionAt) }}</strong></div></div><el-descriptions :column="2" border><el-descriptions-item :label="financialType === 'RECEIPT' ? '收款单号' : '付款单号'">{{ selectedFinancial.documentNo }}</el-descriptions-item><el-descriptions-item label="单据状态">{{ statusLabel(financialStatuses, selectedFinancial.status) }}</el-descriptions-item><el-descriptions-item label="关联订单号">{{ selectedFinancial.orderNo || '-' }}</el-descriptions-item><el-descriptions-item label="关联收付款单号">{{ selectedFinancial.relatedDocumentNo || '-' }}</el-descriptions-item><el-descriptions-item label="客户编号">{{ selectedFinancial.customerNo || '-' }}</el-descriptions-item><el-descriptions-item label="客户ERP外码">{{ selectedFinancial.customerGuid || '-' }}</el-descriptions-item><el-descriptions-item label="交易流水号">{{ selectedFinancial.serialNumber || '-' }}</el-descriptions-item><el-descriptions-item label="录入时间">{{ formatTime(selectedFinancial.sourceCreatedAt) }}</el-descriptions-item><el-descriptions-item label="来源更新时间">{{ formatTime(selectedFinancial.sourceUpdatedAt) }}</el-descriptions-item><el-descriptions-item label="结算账户">{{ selectedFinancial.accountName || '-' }}</el-descriptions-item><el-descriptions-item label="开户行">{{ selectedFinancial.bankName || '-' }}</el-descriptions-item><el-descriptions-item label="账号">{{ selectedFinancial.accountNumber || '-' }}</el-descriptions-item><el-descriptions-item label="备注" :span="2">{{ selectedFinancial.remark || '-' }}</el-descriptions-item></el-descriptions></div>
            </div>
          </el-drawer>
        </template>

        <template v-else-if="settlementTab === 'reconciliation'">
          <div class="settlement-placeholder">
            <el-empty description="财务对账功能暂未实现" />
            <el-alert
              type="info"
              :closable="false"
              show-icon
              title="财务对账页面暂作为菜单入口保留，本期不接入财务系统，也不实现人工核对、通过或标记异常。"
            />
          </div>
        </template>

        <template v-else>
          <div class="settlement-placeholder">
            <el-empty description="对账差异功能暂未实现" />
            <el-alert
              type="info"
              :closable="false"
              show-icon
              title="对账差异用于展示财务人工核对后标记的异常订单；当前财务对账功能尚未实现，因此暂不会产生差异数据。"
            />
          </div>
        </template>
      </el-card>
    </template>

    <el-card v-else shadow="never" class="placeholder-card">
      <template #header><strong>{{ pageTitle }}</strong></template>
      <el-empty description="当前页面为订单域能力入口，已接入能力使用订单中心本地投影；其他能力按领域逐步接入。" />
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="订货宝仅作为过渡期数据来源；订单主数据统一落入订单中心，不在菜单层复制第三方系统。当前已覆盖订单、发货单、退货单、收款单和付款单查询。"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import {
  getDinghuobaoPayments,
  getDinghuobaoReceipts,
  getDinghuobaoReturnDetail,
  getDinghuobaoReturns,
  getDinghuobaoShipmentDetail,
  getDinghuobaoShipmentLogistics,
  getDinghuobaoShipmentLogisticsDetail,
  getDinghuobaoShipments,
  type DhbDocumentPage,
  type DhbDocumentQuery,
  type DhbFinancialDocument,
  syncDhbOrders,
  type DhbOrderSyncScope,
  getDhbOrderDetail,
  getDhbOrders,
  type DhbOrder,
  type DhbOrderDetail,
  type DhbOrderPage,
  type DhbReturnDetail,
  type DhbReturnDocument,
  type DhbShipmentDetail,
  type DhbShipmentDocument,
  type DhbShipmentLogistics,
  type DhbShipmentLogisticsDetail,
} from '@/api'
import { buildDhbOrderQuery, type DhbOrderPageKey } from '@/utils/dhb-order-query'
import { businessDictionaryOptions, loadBusinessDictionaries } from '@/utils/business-dictionary'
import { createLatestRequestGuard } from '@/utils/latest-request'
import {
  formatAdminOrder,
  formatApiStatus,
  formatBusinessType,
  formatFinancialBusinessType,
  formatCustomerType,
  formatExceptionStatus,
  formatInvoiceType,
  formatOrderStatus,
  formatOrderType,
  formatPaymentMethod,
  formatPaymentStatus,
  formatSendType,
  formatPreSale,
  formatContentType,
  formatDeliveryMode,
  formatSettlementMethod,
  formatShipmentType,
  formatSplitType,
  formatSourceDevice,
  formatReturnType,
  formatShipmentLineType,
  pendingOrderStatusValues,
  statusLabel,
} from '@/utils/dhb-order-status'

const route = useRoute()
const pageKey = computed(() => String(route.meta.pageKey || 'order'))
const orderListRequest = createLatestRequestGuard()
const documentListRequest = createLatestRequestGuard()
const pageTitle = computed(() => ({
  order: '订单工作台',
  'order-all': '全部订单',
  'order-pending': '待处理订单',
  'order-exceptions': '异常订单',
  'order-backstage': '后台代客下单',
  'order-source-exceptions': '来源异常',
  'fulfillment-ownership': '履约归属',
  'fulfillment-inventory': '库存与仓库协同',
  'fulfillment-exceptions': '履约异常',
  'after-sales-exchanges': '换货与补发',
  'after-sales-approvals': '售后审批',
  'settlement-receivable': '应收依据',
  'settlement-collections': '收付记录',
  'settlement-receipts': '收款单',
  'settlement-payments': '付款单',
  'settlement-reconciliation': '财务对账',
  'settlement-differences': '对账差异',
  'order-list': '订货宝订单',
  'stock-up': '出库/发货',
  shipments: '物流跟踪',
  returns: '退货单',
  finance: '订单结算管理',
  'delivery-partners': '配送伙伴',
  'stats-goods': '订单商品统计',
  'stats-pending-stock': '待出库统计',
  'stats-shipped': '已出库统计',
  'stats-pending-delivery': '待发货统计',
  'stats-returns': '退单商品统计',
}[pageKey.value] || String(route.meta.title || '订单管理')))
// 一期订单域页面均查询订单中心本地投影；页面不直连订货宝。
const orderQueryPageKeys = new Set(['order-list', 'order-all', 'order-pending', 'order-exceptions', 'order-source-exceptions'])
const isOrderQueryPage = computed(() => orderQueryPageKeys.has(pageKey.value))
const isPendingOrderPage = computed(() => pageKey.value === 'order-pending')
const isExceptionOrderPage = computed(() => ['order-exceptions', 'order-source-exceptions'].includes(pageKey.value))
const isOrderStatusFilterLocked = computed(() => isExceptionOrderPage.value)
const isOutboundPage = computed(() => pageKey.value === 'stock-up')
const isShipmentPage = computed(() => pageKey.value === 'stock-up' || pageKey.value === 'shipments')
const isReturnPage = computed(() => pageKey.value === 'returns')
type SettlementTab = 'receivable' | 'collections' | 'reconciliation' | 'differences'

function settlementTabForPage(value: string): SettlementTab {
  if (value === 'settlement-receivable') return 'receivable'
  if (value === 'settlement-reconciliation') return 'reconciliation'
  if (value === 'settlement-differences') return 'differences'
  return 'collections'
}

const settlementPageKeys = new Set(['finance', 'settlement-receivable', 'settlement-collections', 'settlement-receipts', 'settlement-payments', 'settlement-reconciliation', 'settlement-differences'])
const isFinancePage = computed(() => settlementPageKeys.has(pageKey.value))
const settlementTab = ref<SettlementTab>(settlementTabForPage(pageKey.value))
const isFinancialQueryPage = computed(() => isFinancePage.value && settlementTab.value === 'collections')

const orderScopeHint = computed(() => {
  if (pageKey.value === 'order-all') return '全部订单使用订单中心本地投影查询，包含正常订单和来源异常订单。'
  return ''
})

const orderStatuses = computed(() => businessDictionaryOptions('ORDER', 'DHB_ORDER_STATUS'))
const payStatuses = computed(() => businessDictionaryOptions('ORDER', 'DHB_ORDER_PAYMENT_STATUS'))
const shipmentStatuses = computed(() => businessDictionaryOptions('ORDER', 'DHB_SHIPMENT_STATUS'))
const shipmentTypes = computed(() => businessDictionaryOptions('ORDER', 'DHB_SHIPMENT_TYPE'))
const returnStatuses = computed(() => businessDictionaryOptions('ORDER', 'DHB_RETURN_STATUS'))
const financialStatuses = computed(() => businessDictionaryOptions('ORDER', 'DHB_FINANCIAL_STATUS'))
const availableOrderStatuses = computed(() => isPendingOrderPage.value
  ? orderStatuses.value.filter((item) => pendingOrderStatusValues.has(item.value))
  : orderStatuses.value)
const filters = reactive({ keyword: '', orderStatus: '', startDate: '', endDate: '', payStatus: '', apiStatus: 'all' })
const loading = ref(false)
const requestError = ref<string | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<DhbOrderPage>({ total: 0, providerTotal: 0, synchronizedCount: 0, items: [] })
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<DhbOrderDetail | null>(null)
const orderLogisticsDetail = ref<DhbShipmentLogisticsDetail | null>(null)
const selectedOrder = ref<DhbOrder | null>(null)
const documentFilters = reactive({ status: '', typeId: '', orderNo: '', from: '', to: '' })
const documentLoading = ref(false)
const documentError = ref<string | null>(null)
const documentPage = ref(1)
const documentPageSize = ref(20)
const shipmentPage = ref<DhbDocumentPage<DhbShipmentDocument>>({ total: 0, items: [] })
const logisticsPage = ref<DhbDocumentPage<DhbShipmentLogistics>>({ total: 0, items: [] })
const returnPage = ref<DhbDocumentPage<DhbReturnDocument>>({ total: 0, items: [] })
const financialPage = ref<DhbDocumentPage<DhbFinancialDocument>>({ total: 0, items: [] })
const shipmentDetailVisible = ref(false)
const shipmentDetail = ref<DhbShipmentDetail | null>(null)
const logisticsDetail = ref<DhbShipmentLogisticsDetail | null>(null)
const selectedShipment = ref<DhbShipmentDocument | DhbShipmentLogistics | null>(null)
const returnDetailVisible = ref(false)
const returnDetail = ref<DhbReturnDetail | null>(null)
const selectedReturn = ref<DhbReturnDocument | null>(null)
const financialDetailVisible = ref(false)
const selectedFinancial = ref<DhbFinancialDocument | null>(null)
function financialTypeForPage(value: string): 'RECEIPT' | 'PAYMENT' {
  return value === 'settlement-payments' ? 'PAYMENT' : 'RECEIPT'
}

const financialType = ref<'RECEIPT' | 'PAYMENT'>(financialTypeForPage(pageKey.value))
const syncLoading = ref(false)

const financialSummary = computed(() => {
  const documents = detail.value?.financialDocuments || []
  const sum = (predicate: (document: DhbFinancialDocument) => boolean) => documents
    .filter(predicate)
    .reduce((total, document) => total + Number(document.amount || 0), 0)
  return {
    received: sum(document => document.documentType === 'RECEIPT' && document.status === 'pend_receipted'),
    pending: sum(document => document.documentType === 'RECEIPT' && document.status === 'pend_receipt'),
    canceled: sum(document => document.documentType === 'RECEIPT' && document.status === 'canceled'),
    paid: sum(document => document.documentType === 'PAYMENT'),
  }
})

const shipmentRows = computed(() => isOutboundPage.value ? shipmentPage.value.items : logisticsPage.value.items)
const shipmentTotal = computed(() => isOutboundPage.value ? shipmentPage.value.total : logisticsPage.value.total)
const displayShipmentDetail = computed<DhbShipmentDetail | null>(() => {
  if (isOutboundPage.value) return shipmentDetail.value
  const value = logisticsDetail.value
  if (!value) return null
  const logistics = value.logistics
  return {
    shipment: {
      shipmentNo: logistics.shipmentNo || logistics.orderNo,
      orderNo: logistics.orderNo,
      status: logistics.status,
      statusName: null,
      typeId: null,
      typeName: null,
      customerNo: null,
      customerName: null,
      warehouseNo: logistics.warehouseNo,
      warehouseName: logistics.warehouseName,
      shipmentAt: logistics.shipmentAt || logistics.stockUpAt,
      logisticsName: logistics.logisticsName,
      trackingNo: logistics.trackingNo,
      remark: null,
      detailAvailable: true,
      syncedAt: logistics.syncedAt,
    },
    lines: value.lines.map((line) => ({
      lineId: line.sourceLineId,
      productGuid: line.productId,
      skuNo: line.skuNo,
      productCode: line.productCode,
      productName: line.productName,
      quantity: line.lineType === 'SHIPPED' ? line.quantity : line.waitQuantity,
      lineType: line.lineType,
      orderLineId: line.orderLineId,
      orderedQuantity: line.orderedQuantity,
      stockedQuantity: line.stockedQuantity,
      realStock: line.realStock,
      waitQuantity: line.waitQuantity,
      unitPrice: null,
      amount: null,
      unit: line.unit,
      warehouseNo: line.warehouseNo,
      remark: line.remark,
    })),
  }
})

async function loadOrders() {
  if (!isOrderQueryPage.value) return
  const request = orderListRequest.begin()
  const targetPageKey = pageKey.value as DhbOrderPageKey
  const targetPageTitle = pageTitle.value
  loading.value = true
  requestError.value = null
  pageData.value = { total: 0, providerTotal: 0, synchronizedCount: 0, items: [] }
  try {
    const result = await getDhbOrders(buildDhbOrderQuery({
      pageKey: targetPageKey,
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      orderStatus: filters.orderStatus,
      startDate: filters.startDate,
      endDate: filters.endDate,
      payStatus: filters.payStatus,
      apiStatus: filters.apiStatus,
      keyword: filters.keyword,
    }))
    if (!orderListRequest.isCurrent(request)) return
    pageData.value = result
  }
  catch (reason) {
    if (!orderListRequest.isCurrent(request)) return
    requestError.value = errorMessage(reason, `${targetPageTitle}查询失败`)
    ElMessage.error(requestError.value)
  }
  finally {
    if (orderListRequest.isCurrent(request)) loading.value = false
  }
}

async function handleQuery() { currentPage.value = 1; await loadOrders() }

async function openDetail(order: DhbOrder) {
  selectedOrder.value = order
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  orderLogisticsDetail.value = null
  try { detail.value = await getDhbOrderDetail(order.orderSn) }
  catch (reason) { ElMessage.error(errorMessage(reason, '订单详情加载失败')) }
  try { orderLogisticsDetail.value = await getDinghuobaoShipmentLogisticsDetail(order.orderSn) }
  catch { /* 没有物流快照时仍展示订单详情 */ }
  finally { detailLoading.value = false }
}

async function syncCurrentPage() {
  syncLoading.value = true
  try {
    const scope = currentSyncScope()
    const result = await syncDhbOrders({ includeDetails: true, maxPages: 100, scope })
    const message = syncSuccessMessage(scope, result)
    ElMessage.success(message)
    await reloadCurrentPage()
  }
  catch (reason) { ElMessage.error(errorMessage(reason, '同步任务执行失败')) }
  finally { syncLoading.value = false }
}

/** 页面同步范围由页面类型决定；不把连接器选择暴露给使用者。 */
function currentSyncScope(): DhbOrderSyncScope {
  if (isOutboundPage.value) return 'SHIPMENT'
  if (pageKey.value === 'shipments') return 'SHIPMENT_LOGISTICS'
  if (isFinancialQueryPage.value) return financialType.value === 'RECEIPT' ? 'RECEIPT' : 'PAYMENT'
  if (isReturnPage.value) return 'RETURN'
  if (isOrderQueryPage.value) return 'ORDER'
  return 'ALL'
}

function syncSuccessMessage(scope: DhbOrderSyncScope, result: { ordersChanged: number; shipmentsChanged: number; shipmentLogisticsChanged: number; returnsChanged: number; financialDocumentsChanged: number; unmapped: number }): string {
  const warning = result.unmapped > 0 ? `，字典未解析${result.unmapped}项` : ''
  if (scope === 'ORDER') return `订货单同步完成：订单${result.ordersChanged}${warning}`
  if (scope === 'RETURN') return `退货单同步完成：退货单${result.returnsChanged}${warning}`
  if (scope === 'SHIPMENT') return `出库/发货同步完成：单据${result.shipmentsChanged}${warning}`
  if (scope === 'SHIPMENT_LOGISTICS') return `物流同步完成：物流${result.shipmentLogisticsChanged}${warning}`
  if (scope === 'RECEIPT') return `收款单同步完成：收款单${result.financialDocumentsChanged}${warning}`
  if (scope === 'PAYMENT') return `付款单同步完成：付款单${result.financialDocumentsChanged}${warning}`
  return `同步完成：订单${result.ordersChanged}，出库/发货${result.shipmentsChanged}，物流${result.shipmentLogisticsChanged}，退货${result.returnsChanged}，收付款${result.financialDocumentsChanged}${warning}`
}

async function reloadCurrentPage() {
  if (isOrderQueryPage.value) await loadOrders()
  else if (isShipmentPage.value || isReturnPage.value || isFinancialQueryPage.value) await loadDocumentPage()
}

/** 生成本地单据分页参数；截止日期扩展到当天23:59:59，避免遗漏当天记录。 */
function buildDocumentQuery(outbound = isOutboundPage.value): DhbDocumentQuery {
  const query: DhbDocumentQuery = {
    begin: (documentPage.value - 1) * documentPageSize.value,
    step: documentPageSize.value,
  }
  if (documentFilters.status) query.status = documentFilters.status
  if (outbound && documentFilters.typeId) query.typeId = documentFilters.typeId
  if (documentFilters.orderNo.trim()) query.orderNo = documentFilters.orderNo.trim()
  if (documentFilters.from) query.from = `${documentFilters.from} 00:00:00`
  if (documentFilters.to) query.to = `${documentFilters.to} 23:59:59`
  return query
}

/** 根据当前菜单查询发货、退货或收付款本地投影。 */
async function loadDocumentPage() {
  if (!isShipmentPage.value && !isReturnPage.value && !isFinancialQueryPage.value) return
  const request = documentListRequest.begin()
  const targetPageKey = pageKey.value
  const targetPageTitle = pageTitle.value
  const targetOutbound = targetPageKey === 'stock-up'
  const targetShipment = targetOutbound || targetPageKey === 'shipments'
  const targetReturn = targetPageKey === 'returns'
  const targetFinancial = isFinancialQueryPage.value
  const targetFinancialType = financialType.value
  documentLoading.value = true
  documentError.value = null
  try {
    const query = buildDocumentQuery(targetOutbound)
    let result: DhbDocumentPage<DhbShipmentDocument> | DhbDocumentPage<DhbShipmentLogistics>
      | DhbDocumentPage<DhbReturnDocument> | DhbDocumentPage<DhbFinancialDocument>
    if (targetShipment) {
      result = targetOutbound
        ? await getDinghuobaoShipments(query)
        : await getDinghuobaoShipmentLogistics(query)
    }
    else if (targetReturn) result = await getDinghuobaoReturns(query)
    else if (targetFinancial) result = targetFinancialType === 'RECEIPT'
      ? await getDinghuobaoReceipts(query) : await getDinghuobaoPayments(query)
    else return
    if (!documentListRequest.isCurrent(request)) return
    if (targetShipment && targetOutbound) shipmentPage.value = result as DhbDocumentPage<DhbShipmentDocument>
    else if (targetShipment) logisticsPage.value = result as DhbDocumentPage<DhbShipmentLogistics>
    else if (targetReturn) returnPage.value = result as DhbDocumentPage<DhbReturnDocument>
    else financialPage.value = result as DhbDocumentPage<DhbFinancialDocument>
  } catch (reason) {
    if (!documentListRequest.isCurrent(request)) return
    documentError.value = errorMessage(reason, `${targetPageTitle}查询失败`)
    ElMessage.error(documentError.value)
  } finally {
    if (documentListRequest.isCurrent(request)) documentLoading.value = false
  }
}

async function queryDocuments() { documentPage.value = 1; await loadDocumentPage() }

function resetDocumentFilters() {
  Object.assign(documentFilters, { status: '', typeId: '', orderNo: '', from: '', to: '' })
  void queryDocuments()
}

function changeDocumentPageSize(size: number) {
  documentPageSize.value = size
  documentPage.value = 1
  void loadDocumentPage()
}

async function openShipmentDetail(row: DhbShipmentDocument | DhbShipmentLogistics) {
  selectedShipment.value = row
  shipmentDetailVisible.value = true
  detailLoading.value = true
  shipmentDetail.value = null
  logisticsDetail.value = null
  try {
    if (isOutboundPage.value) shipmentDetail.value = await getDinghuobaoShipmentDetail(row.shipmentNo)
    else logisticsDetail.value = await getDinghuobaoShipmentLogisticsDetail(row.orderNo)
  }
  catch (reason) { ElMessage.error(errorMessage(reason, '发货物流详情加载失败')) }
  finally { detailLoading.value = false }
}

async function openReturnDetail(row: DhbReturnDocument) {
  selectedReturn.value = row
  returnDetailVisible.value = true
  detailLoading.value = true
  returnDetail.value = null
  try { returnDetail.value = await getDinghuobaoReturnDetail(row.returnNo) }
  catch (reason) { ElMessage.error(errorMessage(reason, '退货单详情加载失败')) }
  finally { detailLoading.value = false }
}

function openFinancialDetail(row: DhbFinancialDocument) {
  selectedFinancial.value = row
  financialDetailVisible.value = true
}

function handleSizeChange(size: number) { pageSize.value = size; currentPage.value = 1; void loadOrders() }

function resetFilters() {
  Object.assign(filters, { keyword: '', orderStatus: '', startDate: '', endDate: '', payStatus: '', apiStatus: 'all' })
  void handleQuery()
}

function formatTime(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function formatMoney(value: number | null): string { return value == null ? '-' : `¥${Number(value).toFixed(2)}` }

function formatNumber(value: number | null, suffix = ''): string {
  return value == null ? '-' : `${Number(value).toFixed(4).replace(/\.0000$/, '')}${suffix}`
}

function formatDeliveryDate(value: string | null): string {
  return !value || value.startsWith('1970-01-01') ? '-' : value
}

function orderStatusTagType(value: string | null) {
  if (['finished', 'forcedone', 'received'].includes(value || '')) return 'success'
  if (['cancelled'].includes(value || '')) return 'info'
  if (['pricing', 'pending'].includes(value || '')) return 'warning'
  return 'primary'
}

function documentStatusTagType(value: string | null) {
  if (['finished', 'received', 'pend_receipted'].includes(value || '')) return 'success'
  if (['cancelled', 'canceled'].includes(value || '')) return 'info'
  return 'warning'
}

function errorMessage(reason: unknown, fallback: string): string {
  if (reason && typeof reason === 'object' && 'message' in reason && typeof reason.message === 'string') return reason.message
  return fallback
}

watch(pageKey, () => {
  currentPage.value = 1
  documentPage.value = 1
  Object.assign(documentFilters, { status: '', typeId: '', orderNo: '', from: '', to: '' })
  if (isOrderQueryPage.value) {
    Object.assign(filters, { orderStatus: '', startDate: '', endDate: '', payStatus: '', apiStatus: 'all' })
    void loadOrders()
  }
  else if (isFinancePage.value) {
    settlementTab.value = settlementTabForPage(pageKey.value)
    financialType.value = financialTypeForPage(pageKey.value)
    if (isFinancialQueryPage.value) void loadDocumentPage()
  }
  else if (isShipmentPage.value || isReturnPage.value) void loadDocumentPage()
})
onMounted(() => {
  void loadBusinessDictionaries([
    'DHB_ORDER_STATUS', 'DHB_ORDER_PAYMENT_STATUS', 'DHB_ORDER_TYPE', 'DHB_ORDER_API_STATUS',
    'DHB_ORDER_EXCEPTION_STATUS', 'DHB_ORDER_ADMIN_FLAG', 'DHB_ORDER_SPLIT_TYPE',
    'DHB_SETTLEMENT_METHOD', 'DHB_INVOICE_TYPE', 'DHB_ORDER_LINE_TYPE', 'DHB_GOODS_LIST_TYPE',
    'DHB_SHIPMENT_STATUS', 'DHB_SHIPMENT_TYPE', 'DHB_RETURN_STATUS', 'DHB_RETURN_TYPE',
    'DHB_FINANCIAL_DOCUMENT_TYPE', 'DHB_FINANCIAL_BUSINESS_TYPE', 'DHB_PAYMENT_METHOD',
    'DHB_FINANCIAL_STATUS',
  ].map((code) => ({ moduleCode: 'ORDER', code })))
  if (isOrderQueryPage.value) void loadOrders()
  else if (isShipmentPage.value || isReturnPage.value || isFinancePage.value) void loadDocumentPage()
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
.dhb-order-page { min-width: 0; }
.page-heading { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.heading-actions { display: flex; align-items: center; gap: 10px; }
.page-heading h1 { margin: 0 0 8px; color: #172033; font-size: 24px; }
.page-heading p { margin: 0; color: #8a94a6; font-size: 13px; }
.section-heading { margin-bottom: 16px; }
.section-heading h2 { margin: 0 0 6px; color: #172033; font-size: 18px; }
.section-heading p { margin: 0; color: #8a94a6; font-size: 13px; }
.filter-card { margin-bottom: 16px; }
.settlement-placeholder { min-height: 320px; padding: 36px 0; }
.request-hint { margin-bottom: 16px; }
.request-error { margin-bottom: 16px; }
.filter-card :deep(.el-form-item) { margin-bottom: 10px; }
.filter-actions { margin-right: 0; }
.summary-bar { display: flex; align-items: center; gap: 24px; min-height: 48px; color: #6f7b8f; font-size: 13px; }
.summary-bar strong { color: #172033; font-size: 16px; }
.summary-note { margin-left: auto; color: #8a94a6; }
.result-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: $spacing-lg; margin: $spacing-md 0; }
.result-heading h2 { margin: 0 0 5px; color: $color-text-primary; font-size: $font-size-lg; }
.result-heading p { margin: 0; color: $color-text-secondary; font-size: $font-size-sm; }
.list-card :deep(.el-card__body) { padding: 0; }
.business-table { overflow: hidden; border: 1px solid $color-border-base; border-radius: $border-radius-base; }
.list-card .business-table { border: 0; border-radius: 0; }
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
.stacked-cell, .amount-cell, .status-cell { display: flex; align-items: flex-start; flex-direction: column; gap: 5px; min-width: 0; }
.stacked-cell span, .stacked-cell small { overflow: hidden; max-width: 100%; text-overflow: ellipsis; white-space: nowrap; }
.stacked-cell span { color: $color-text-regular; }
.stacked-cell small, .amount-cell small, .status-cell small { color: $color-text-secondary; font-size: $font-size-xs; }
.amount-cell { align-items: flex-end; }
.amount-cell strong { color: $color-text-primary; font-size: 17px; font-variant-numeric: tabular-nums; }
.sync-time { color: $color-text-secondary; font-size: $font-size-sm; line-height: 1.5; }
.pagination-row { display: flex; justify-content: flex-end; padding-top: 18px; }
.list-card .pagination-row { padding: 18px; }
.detail-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; padding: 14px; background: #f7f9fc; border-radius: 6px; }
.detail-summary div { display: flex; flex-direction: column; gap: 6px; }
.detail-summary span { color: #8a94a6; font-size: 12px; }
.detail-summary strong { color: #172033; font-size: 14px; }
.detail-title { margin: 22px 0 10px; color: #172033; font-size: 15px; }
:deep(.order-detail-drawer) { background: $color-bg-page; }
:deep(.order-detail-drawer .el-drawer__body) { padding: 0; }
.detail-shell { min-height: 100%; background: $color-bg-page; }
.detail-hero { position: sticky; z-index: 4; top: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: $spacing-lg; padding: $spacing-lg $spacing-xl; border-bottom: 1px solid $color-border-base; background: rgba(255, 255, 255, .96); backdrop-filter: blur(10px); }
.detail-hero > div { min-width: 0; }
.detail-hero span { color: $color-primary; font-size: $font-size-xs; font-weight: 600; }
.detail-hero h2 { overflow: hidden; margin: 5px 0; color: $color-text-primary; font-size: 21px; text-overflow: ellipsis; white-space: nowrap; }
.detail-hero p { margin: 0; color: $color-text-secondary; font-size: $font-size-sm; }
.detail-tags { display: flex; flex-wrap: wrap; gap: $spacing-sm; margin-top: 10px; }
.detail-content { padding: $spacing-lg $spacing-xl $spacing-xl; }
.detail-content :deep(.el-descriptions) { overflow: hidden; border: 1px solid $color-border-base; border-radius: $border-radius-lg; background: $color-bg-white; box-shadow: $shadow-sm; }
.detail-content :deep(.el-descriptions__label) { color: $color-text-secondary; font-weight: 500; }
.detail-content > .el-table, .detail-content > :deep(.el-table) { overflow: hidden; border: 1px solid $color-border-base; border-radius: $border-radius-base; }
.placeholder-card { min-height: 420px; }
@media (max-width: 1000px) {
  .summary-bar { flex-wrap: wrap; padding: 10px 0; }
  .summary-note { margin-left: 0; }
  .detail-summary { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 720px) {
  .page-heading, .result-heading { align-items: flex-start; flex-direction: column; }
  .summary-note { margin-left: 0; }
  :deep(.order-detail-drawer) { width: 100% !important; }
  .detail-hero, .detail-content { padding: $spacing-md; }
}
</style>
