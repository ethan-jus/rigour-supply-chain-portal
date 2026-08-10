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

      <div class="summary-bar">
        <span>本地订单 <strong>{{ pageData.total }}</strong> 条</span>
        <span class="summary-note">同步任务由 Integration 负责</span>
      </div>

      <el-card shadow="never">
        <el-table v-loading="loading" :data="pageData.items" row-key="orderSn" @row-click="openDetail">
          <el-table-column prop="orderSn" label="订单编号" min-width="190" fixed="left" />
          <el-table-column label="下单时间" min-width="165">
            <template #default="scope">{{ formatTime(scope.row.orderDate) }}</template>
          </el-table-column>
          <el-table-column prop="clientName" label="客户名称" min-width="150" show-overflow-tooltip />
          <el-table-column prop="receiveCompany" label="收货单位" min-width="150" show-overflow-tooltip />
          <el-table-column prop="receiveName" label="收货人" width="110" />
          <el-table-column prop="receivePhone" label="联系电话" width="140" />
          <el-table-column label="订单金额" width="120" align="right">
            <template #default="scope">{{ formatMoney(scope.row.orderTotal) }}</template>
          </el-table-column>
          <el-table-column label="订单状态" width="110">
            <template #default="scope">{{ formatStatus(scope.row.orderStatus) }}</template>
          </el-table-column>
          <el-table-column label="收款状态" width="110">
            <template #default="scope">{{ formatPayStatus(scope.row.payStatus) }}</template>
          </el-table-column>
          <el-table-column label="明细" width="90" fixed="right">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openDetail(scope.row)">查看</el-button>
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

      <el-dialog v-model="detailVisible" title="订单详情" width="920px">
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
            <el-descriptions-item label="订单状态">{{ formatStatus(detail.order.orderStatus) }}</el-descriptions-item>
            <el-descriptions-item label="收款状态">{{ formatPayStatus(detail.order.payStatus) }}</el-descriptions-item>
            <el-descriptions-item label="收货单位">{{ detail.order.receiveCompany || '-' }}</el-descriptions-item>
            <el-descriptions-item label="收货人">{{ detail.order.receiveName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="联系电话">{{ detail.order.receivePhone || '-' }}</el-descriptions-item>
            <el-descriptions-item label="收货地址" :span="3">{{ detail.order.receiveAddress || '-' }}</el-descriptions-item>
            <el-descriptions-item label="订单备注" :span="3">{{ detail.order.orderRemark || '-' }}</el-descriptions-item>
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
          </el-table>
          <h3 class="detail-title">发货信息</h3>
          <el-table :data="detail.shipments" size="small">
            <el-table-column prop="shipmentNo" label="发货单号" min-width="180" />
            <el-table-column prop="status" label="状态" width="120" />
            <el-table-column prop="shipmentDate" label="发货时间" min-width="180" />
            <el-table-column prop="stockUpTime" label="备货时间" min-width="180" />
          </el-table>
        </template>
        <el-empty v-else description="暂无详情" />
        <template #footer>
          <el-button @click="detailVisible = false">关闭</el-button>
        </template>
      </el-dialog>
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
          <el-form-item :label="isOutboundPage ? '出库/发货状态' : '物流状态'">
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
      <el-card shadow="never">
        <el-table v-loading="documentLoading" :data="shipmentRows" :row-key="isOutboundPage ? 'shipmentNo' : 'orderNo'" @row-click="openShipmentDetail">
          <el-table-column :label="isOutboundPage ? '出库/发货单号' : '出库/发货物流单号'" min-width="200" fixed="left"><template #default="scope">{{ scope.row.shipmentNo || scope.row.orderNo || '-' }}</template></el-table-column>
          <el-table-column prop="orderNo" label="订单编号" min-width="180" />
          <el-table-column v-if="isOutboundPage" prop="customerName" label="客户" min-width="150" show-overflow-tooltip />
          <el-table-column label="状态" width="110"><template #default="scope">{{ statusLabel(shipmentStatuses, scope.row.status) }}</template></el-table-column>
          <el-table-column v-if="isOutboundPage" prop="typeName" label="出库类型" min-width="130" />
          <el-table-column prop="warehouseName" label="出库仓库" min-width="140" />
          <el-table-column :label="isOutboundPage ? '出库/发货时间' : '物流同步时间'" min-width="170"><template #default="scope">{{ formatTime(isOutboundPage ? scope.row.shipmentAt : scope.row.syncedAt) }}</template></el-table-column>
          <el-table-column prop="logisticsName" label="物流公司" min-width="130" />
          <el-table-column prop="trackingNo" label="物流单号" min-width="160" />
          <el-table-column label="明细" width="90" fixed="right"><template #default="scope"><el-button link type="primary" @click.stop="openShipmentDetail(scope.row)">查看</el-button></template></el-table-column>
          <template #empty><el-empty :description="isOutboundPage ? '暂无本地出库/发货单' : '暂无本地出库/发货物流'" /></template>
        </el-table>
        <div class="pagination-row"><el-pagination v-model:current-page="documentPage" v-model:page-size="documentPageSize" layout="total, sizes, prev, pager, next" :page-sizes="[20, 50, 100]" :total="shipmentTotal" @current-change="loadDocumentPage" @size-change="changeDocumentPageSize" /></div>
      </el-card>
      <el-dialog v-model="shipmentDetailVisible" :title="isOutboundPage ? '出库/发货详情' : '出库/发货物流详情'" width="900px">
        <el-skeleton v-if="detailLoading" :rows="7" animated />
        <template v-else-if="displayShipmentDetail">
          <el-descriptions :column="3" border>
            <el-descriptions-item :label="isOutboundPage ? '出库/发货单号' : '出库/发货物流单号'">{{ displayShipmentDetail.shipment.shipmentNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="订单编号">{{ displayShipmentDetail.shipment.orderNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ statusLabel(shipmentStatuses, displayShipmentDetail.shipment.status) }}</el-descriptions-item>
            <el-descriptions-item label="出库类型">{{ displayShipmentDetail.shipment.typeName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="客户">{{ displayShipmentDetail.shipment.customerName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="仓库">{{ displayShipmentDetail.shipment.warehouseName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="发货时间">{{ formatTime(displayShipmentDetail.shipment.shipmentAt) }}</el-descriptions-item>
            <el-descriptions-item label="物流信息" :span="3">{{ [displayShipmentDetail.shipment.logisticsName, displayShipmentDetail.shipment.trackingNo].filter(Boolean).join(' / ') || '-' }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="3">{{ displayShipmentDetail.shipment.remark || '-' }}</el-descriptions-item>
          </el-descriptions>
          <h3 class="detail-title">商品明细</h3>
          <el-table :data="displayShipmentDetail.lines" size="small">
            <el-table-column v-if="!isOutboundPage" prop="lineType" label="明细类型" width="110" />
            <el-table-column prop="productName" label="商品名称" min-width="200" />
            <el-table-column prop="skuNo" label="SKU" min-width="130" />
            <el-table-column prop="quantity" :label="isOutboundPage ? '发货数量' : '数量'" width="100" />
            <el-table-column prop="unit" label="单位" width="80" />
            <el-table-column v-if="isOutboundPage" label="单价" width="110"><template #default="scope">{{ formatMoney(scope.row.unitPrice) }}</template></el-table-column>
            <el-table-column v-if="isOutboundPage" label="金额" width="110"><template #default="scope">{{ formatMoney(scope.row.amount) }}</template></el-table-column>
          </el-table>
        </template>
      </el-dialog>
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
      <el-card shadow="never">
        <el-table v-loading="documentLoading" :data="returnPage.items" row-key="returnNo" @row-click="openReturnDetail">
          <el-table-column prop="returnNo" label="退货单号" min-width="180" fixed="left" />
          <el-table-column prop="orderNo" label="订单编号" min-width="180" />
          <el-table-column label="状态" width="120"><template #default="scope">{{ statusLabel(returnStatuses, scope.row.status) }}</template></el-table-column>
          <el-table-column label="退货日期" min-width="170"><template #default="scope">{{ formatTime(scope.row.returnedAt) }}</template></el-table-column>
          <el-table-column label="退货金额" width="120"><template #default="scope">{{ formatMoney(scope.row.returnAmount) }}</template></el-table-column>
          <el-table-column label="结算金额" width="120"><template #default="scope">{{ formatMoney(scope.row.settlementAmount) }}</template></el-table-column>
          <el-table-column prop="reason" label="退货原因" min-width="180" show-overflow-tooltip />
          <el-table-column prop="logisticsNo" label="退货物流单号" min-width="170" />
          <el-table-column label="明细" width="90" fixed="right"><template #default="scope"><el-button link type="primary" @click.stop="openReturnDetail(scope.row)">查看</el-button></template></el-table-column>
          <template #empty><el-empty description="暂无本地退货单" /></template>
        </el-table>
        <div class="pagination-row"><el-pagination v-model:current-page="documentPage" v-model:page-size="documentPageSize" layout="total, sizes, prev, pager, next" :page-sizes="[20, 50, 100]" :total="returnPage.total" @current-change="loadDocumentPage" @size-change="changeDocumentPageSize" /></div>
      </el-card>
      <el-dialog v-model="returnDetailVisible" title="退货单详情" width="900px">
        <el-skeleton v-if="detailLoading" :rows="7" animated />
        <template v-else-if="returnDetail">
          <el-descriptions :column="3" border>
            <el-descriptions-item label="退货单号">{{ returnDetail.returnDocument.returnNo }}</el-descriptions-item>
            <el-descriptions-item label="订单编号">{{ returnDetail.returnDocument.orderNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ statusLabel(returnStatuses, returnDetail.returnDocument.status) }}</el-descriptions-item>
            <el-descriptions-item label="退货金额">{{ formatMoney(returnDetail.returnDocument.returnAmount) }}</el-descriptions-item>
            <el-descriptions-item label="结算金额">{{ formatMoney(returnDetail.returnDocument.settlementAmount) }}</el-descriptions-item>
            <el-descriptions-item label="退货日期">{{ formatTime(returnDetail.returnDocument.returnedAt) }}</el-descriptions-item>
            <el-descriptions-item label="退货原因" :span="3">{{ returnDetail.returnDocument.reason || '-' }}</el-descriptions-item>
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
      </el-dialog>
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
          <el-alert class="request-error" type="info" :closable="false" show-icon title="这里展示订货宝已同步的收款单或付款单原始记录；它不是订单主表上的收款状态，状态字段缺失时显示为“-”。" />
          <el-card class="filter-card" shadow="never">
            <el-form :model="documentFilters" inline @submit.prevent="queryDocuments">
              <el-form-item label="订单编号"><el-input v-model="documentFilters.orderNo" clearable placeholder="精确查询" /></el-form-item>
              <el-form-item label="开始日期"><el-date-picker v-model="documentFilters.from" type="date" value-format="YYYY-MM-DD" /></el-form-item>
              <el-form-item label="截止日期"><el-date-picker v-model="documentFilters.to" type="date" value-format="YYYY-MM-DD" /></el-form-item>
              <el-form-item><el-button type="primary" :loading="documentLoading" @click="queryDocuments">查询</el-button><el-button @click="resetDocumentFilters">重置</el-button></el-form-item>
            </el-form>
          </el-card>
          <el-alert v-if="documentError" class="request-error" type="error" :closable="false" show-icon :title="documentError" />
          <el-table v-loading="documentLoading" :data="financialPage.items" row-key="documentNo">
            <el-table-column prop="documentNo" :label="financialType === 'RECEIPT' ? '收款单号' : '付款单号'" min-width="180" fixed="left" />
            <el-table-column prop="orderNo" label="订单编号" min-width="180" />
            <el-table-column prop="relatedDocumentNo" label="关联单号" min-width="150" />
            <el-table-column label="状态" width="110"><template #default="scope">{{ statusLabel(financialStatuses, scope.row.status) }}</template></el-table-column>
            <el-table-column label="金额" width="130" align="right"><template #default="scope">{{ formatMoney(scope.row.amount) }}</template></el-table-column>
            <el-table-column prop="businessType" label="业务类型" min-width="120" />
            <el-table-column prop="paymentMethod" label="支付方式" min-width="120" />
            <el-table-column label="交易日期" min-width="170"><template #default="scope">{{ formatTime(scope.row.transactionAt) }}</template></el-table-column>
            <el-table-column prop="serialNumber" label="流水号" min-width="160" />
            <el-table-column prop="accountName" label="账户名称" min-width="140" />
            <el-table-column prop="bankName" label="开户行" min-width="150" />
            <template #empty><el-empty :description="`暂无本地${financialType === 'RECEIPT' ? '收款单' : '付款单'}`" /></template>
          </el-table>
          <div class="pagination-row"><el-pagination v-model:current-page="documentPage" v-model:page-size="documentPageSize" layout="total, sizes, prev, pager, next" :page-sizes="[20, 50, 100]" :total="financialPage.total" @current-change="loadDocumentPage" @size-change="changeDocumentPageSize" /></div>
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

const route = useRoute()
const pageKey = computed(() => String(route.meta.pageKey || 'order'))
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

const orderStatuses = [
  { label: '待核价', value: 'pricing' }, { label: '待审核', value: 'pending' },
  { label: '待出库', value: 'stock_up' }, { label: '待发货', value: 'shipped' },
  { label: '待收货', value: 'received' }, { label: '已完成', value: 'finished' },
  { label: '强制完成', value: 'forcedone' }, { label: '已取消', value: 'cancelled' },
]
const pendingOrderStatusValues = new Set(['pricing', 'pending', 'stock_up', 'shipped', 'received'])
const availableOrderStatuses = computed(() => isPendingOrderPage.value
  ? orderStatuses.filter((item) => pendingOrderStatusValues.has(item.value))
  : orderStatuses)
const payStatuses = [
  { label: '待收款', value: 'oblig' }, { label: '部分收款', value: 'uncollect' },
  { label: '已收款', value: 'paided' }, { label: '已取消', value: 'cancelled' },
  { label: '待确认', value: 'wait' }, { label: '部分确认', value: 'part' },
  { label: '待确认付款（详情）', value: 'unoblig' },
]
const shipmentStatuses = [
  { label: '待发货', value: 'shipped' }, { label: '待收货', value: 'receivedin' },
  { label: '已收货', value: 'received' }, { label: '已取消', value: 'cancelled' },
]
const shipmentTypes = [
  { label: '采购退货', value: '-2' }, { label: '销售出库', value: '10' },
  { label: '盘亏出库', value: '11' }, { label: '其他出库', value: '17' },
  { label: '调拨出库', value: '18' }, { label: '联营出库', value: '19' },
]
const returnStatuses = [
  { label: '待审核', value: 'return_audit' }, { label: '待客户发货', value: 'shipp_cust' },
  { label: '待收货', value: 'shipped' }, { label: '待退款', value: 'refunded' },
  { label: '已完成', value: 'finished' }, { label: '已取消', value: 'cancelled' },
]
const financialStatuses = [
  { label: '待确认', value: 'pend_receipt' }, { label: '已确认', value: 'pend_receipted' },
  { label: '已取消', value: 'canceled' },
]
const filters = reactive({ orderStatus: '', startDate: '', endDate: '', payStatus: '', apiStatus: 'all' })
const loading = ref(false)
const requestError = ref<string | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<DhbOrderPage>({ total: 0, providerTotal: 0, synchronizedCount: 0, items: [] })
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<DhbOrderDetail | null>(null)
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
const returnDetailVisible = ref(false)
const returnDetail = ref<DhbReturnDetail | null>(null)
function financialTypeForPage(value: string): 'RECEIPT' | 'PAYMENT' {
  return value === 'settlement-payments' ? 'PAYMENT' : 'RECEIPT'
}

const financialType = ref<'RECEIPT' | 'PAYMENT'>(financialTypeForPage(pageKey.value))
const syncLoading = ref(false)

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
  loading.value = true
  requestError.value = null
  pageData.value = { total: 0, providerTotal: 0, synchronizedCount: 0, items: [] }
  try {
    pageData.value = await getDhbOrders(buildDhbOrderQuery({
      pageKey: pageKey.value as DhbOrderPageKey,
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      orderStatus: filters.orderStatus,
      startDate: filters.startDate,
      endDate: filters.endDate,
      payStatus: filters.payStatus,
      apiStatus: filters.apiStatus,
    }))
  }
  catch (reason) {
    requestError.value = errorMessage(reason, `${pageTitle.value}查询失败`)
    ElMessage.error(requestError.value)
  }
  finally { loading.value = false }
}

async function handleQuery() { currentPage.value = 1; await loadOrders() }

async function openDetail(order: DhbOrder) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try { detail.value = await getDhbOrderDetail(order.orderSn) }
  catch (reason) { ElMessage.error(errorMessage(reason, '订单详情加载失败')) }
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

function syncSuccessMessage(scope: DhbOrderSyncScope, result: { ordersChanged: number; shipmentsChanged: number; shipmentLogisticsChanged: number; returnsChanged: number; financialDocumentsChanged: number }): string {
  if (scope === 'ORDER') return `订货单同步完成：订单${result.ordersChanged}`
  if (scope === 'RETURN') return `退货单同步完成：退货单${result.returnsChanged}`
  if (scope === 'SHIPMENT') return `出库/发货同步完成：单据${result.shipmentsChanged}`
  if (scope === 'SHIPMENT_LOGISTICS') return `物流同步完成：物流${result.shipmentLogisticsChanged}`
  if (scope === 'RECEIPT') return `收款单同步完成：收款单${result.financialDocumentsChanged}`
  if (scope === 'PAYMENT') return `付款单同步完成：付款单${result.financialDocumentsChanged}`
  return `同步完成：订单${result.ordersChanged}，出库/发货${result.shipmentsChanged}，物流${result.shipmentLogisticsChanged}，退货${result.returnsChanged}，收付款${result.financialDocumentsChanged}`
}

async function reloadCurrentPage() {
  if (isOrderQueryPage.value) await loadOrders()
  else if (isShipmentPage.value || isReturnPage.value || isFinancialQueryPage.value) await loadDocumentPage()
}

/** 生成本地单据分页参数；截止日期扩展到当天23:59:59，避免遗漏当天记录。 */
function buildDocumentQuery(): DhbDocumentQuery {
  const query: DhbDocumentQuery = {
    begin: (documentPage.value - 1) * documentPageSize.value,
    step: documentPageSize.value,
  }
  if (documentFilters.status) query.status = documentFilters.status
  if (isOutboundPage.value && documentFilters.typeId) query.typeId = documentFilters.typeId
  if (documentFilters.orderNo.trim()) query.orderNo = documentFilters.orderNo.trim()
  if (documentFilters.from) query.from = `${documentFilters.from} 00:00:00`
  if (documentFilters.to) query.to = `${documentFilters.to} 23:59:59`
  return query
}

/** 根据当前菜单查询发货、退货或收付款本地投影。 */
async function loadDocumentPage() {
  if (!isShipmentPage.value && !isReturnPage.value && !isFinancialQueryPage.value) return
  documentLoading.value = true
  documentError.value = null
  try {
    const query = buildDocumentQuery()
    if (isShipmentPage.value) {
      if (isOutboundPage.value) shipmentPage.value = await getDinghuobaoShipments(query)
      else logisticsPage.value = await getDinghuobaoShipmentLogistics(query)
    }
    else if (isReturnPage.value) returnPage.value = await getDinghuobaoReturns(query)
    else if (isFinancialQueryPage.value) financialPage.value = financialType.value === 'RECEIPT'
      ? await getDinghuobaoReceipts(query) : await getDinghuobaoPayments(query)
  } catch (reason) {
    documentError.value = errorMessage(reason, `${pageTitle.value}查询失败`)
    ElMessage.error(documentError.value)
  } finally { documentLoading.value = false }
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
  shipmentDetailVisible.value = true
  detailLoading.value = true
  shipmentDetail.value = null
  logisticsDetail.value = null
  try {
    if (isOutboundPage.value) shipmentDetail.value = await getDinghuobaoShipmentDetail(row.shipmentNo)
    else logisticsDetail.value = await getDinghuobaoShipmentLogisticsDetail(row.orderNo)
  }
  catch (reason) { ElMessage.error(errorMessage(reason, '出库/发货物流详情加载失败')) }
  finally { detailLoading.value = false }
}

async function openReturnDetail(row: DhbReturnDocument) {
  returnDetailVisible.value = true
  detailLoading.value = true
  returnDetail.value = null
  try { returnDetail.value = await getDinghuobaoReturnDetail(row.returnNo) }
  catch (reason) { ElMessage.error(errorMessage(reason, '退货单详情加载失败')) }
  finally { detailLoading.value = false }
}

function handleSizeChange(size: number) { pageSize.value = size; currentPage.value = 1; void loadOrders() }

function resetFilters() {
  Object.assign(filters, { orderStatus: '', startDate: '', endDate: '', payStatus: '', apiStatus: 'all' })
  void handleQuery()
}

function formatTime(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function formatMoney(value: number | null): string { return value == null ? '-' : `¥${Number(value).toFixed(2)}` }

function formatStatus(value: string | null): string {
  if (value === 'stock_up' || value === 'stockup') return '待出库'
  return orderStatuses.find((item) => item.value === value)?.label || value || '-'
}

function formatPayStatus(value: string | null): string {
  return payStatuses.find((item) => item.value === value)?.label || value || '-'
}

function statusLabel(options: { label: string; value: string }[], value: string | null): string {
  return options.find((item) => item.value === value)?.label || value || '-'
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
  if (isOrderQueryPage.value) void loadOrders()
  else if (isShipmentPage.value || isReturnPage.value || isFinancePage.value) void loadDocumentPage()
})
</script>

<style scoped lang="scss">
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
.pagination-row { display: flex; justify-content: flex-end; padding-top: 18px; }
.detail-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; padding: 14px; background: #f7f9fc; border-radius: 6px; }
.detail-summary div { display: flex; flex-direction: column; gap: 6px; }
.detail-summary span { color: #8a94a6; font-size: 12px; }
.detail-summary strong { color: #172033; font-size: 14px; }
.detail-title { margin: 22px 0 10px; color: #172033; font-size: 15px; }
.placeholder-card { min-height: 420px; }
@media (max-width: 1000px) {
  .summary-bar { flex-wrap: wrap; padding: 10px 0; }
  .summary-note { margin-left: 0; }
  .detail-summary { grid-template-columns: repeat(2, 1fr); }
}
</style>
