<template>
  <div class="sales-order-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">订单管理 · 销售订单</span>
        <SupplyPageTitle>销售订单</SupplyPageTitle>
        <p>维护销售订单、商品明细、提交状态和销售出库。</p>
      </div>
      <div class="heading-actions">
        <HistoryOrderReview />
        <DhbPageSyncButton scope="SALES_ORDER" label="销售订单" @completed="loadOrders" />
        <el-button v-if="can('order:create')" type="primary" @click="openCreate"
          >新增销售订单</el-button
        >
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
        <small>从订单已确认仓库出库</small>
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
          <el-input
            v-model="filters.orderNo"
            clearable
            placeholder="销售订单号"
            style="width: 180px"
          />
        </el-form-item>
        <el-form-item label="来源单号">
          <el-input
            v-model="filters.sourceOrderNo"
            clearable
            placeholder="飞书/订货宝单号"
            style="width: 180px"
          />
        </el-form-item>
        <el-form-item label="来源状态">
          <el-select
            v-model="filters.sourceStatusCode"
            clearable
            placeholder="全部来源状态"
            style="width: 150px"
          >
            <el-option
              v-for="item in sourceStatusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="客户名称">
          <el-input
            v-model="filters.customerName"
            clearable
            placeholder="客户/门店名称"
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input
            v-model="filters.contactPhone"
            clearable
            placeholder="联系人电话"
            style="width: 160px"
          />
        </el-form-item>
        <el-form-item label="归属地区">
          <el-select
            v-model="filters.regionCode"
            clearable
            filterable
            placeholder="全部地区"
            style="width: 150px"
          >
            <el-option
              v-for="item in regionOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="归属销售">
          <el-select
            v-model="filters.ownerEmployeeCode"
            clearable
            filterable
            remote
            reserve-keyword
            placeholder="搜索销售"
            :remote-method="searchSalesEmployees"
            :loading="employeeLoading"
            style="width: 160px"
          >
            <el-option
              v-for="item in employeeOptions"
              :key="item.employeeCode"
              :label="item.employeeName"
              :value="item.employeeCode"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="订单状态">
          <el-select
            v-model="filters.orderStatusCode"
            clearable
            placeholder="全部订单状态"
            style="width: 150px"
          >
            <el-option
              v-for="item in orderStatusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="数据状态">
          <el-select
            v-model="filters.dataQualityStatusCode"
            clearable
            placeholder="全部数据状态"
            style="width: 150px"
          >
            <el-option
              v-for="item in dataQualityStatusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="收款状态">
          <el-select
            v-model="filters.paymentStatusCode"
            clearable
            placeholder="全部收款状态"
            style="width: 150px"
          >
            <el-option
              v-for="item in paymentStatusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="出库状态">
          <el-select
            v-model="filters.outboundStatusCode"
            clearable
            placeholder="全部出库状态"
            style="width: 150px"
          >
            <el-option
              v-for="item in outboundStatusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期">
          <el-date-picker
            v-model="filters.orderDateFrom"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="开始日期"
          />
        </el-form-item>
        <el-form-item label="截止日期">
          <el-date-picker
            v-model="filters.orderDateTo"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="截止日期"
          />
        </el-form-item>
        <el-form-item class="filter-actions">
          <el-button type="primary" :loading="loading" native-type="submit">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-alert
      v-if="orderDrillContextText"
      class="order-drill-context"
      type="info"
      :title="orderDrillContextText"
      show-icon
      :closable="false"
    />

    <div class="result-heading">
      <div>
        <div class="result-title-line">
          <h2>销售订单列表</h2>
          <span class="result-count"
            ><strong>{{ pageData.total }}</strong> 条</span
          >
        </div>
      </div>
    </div>

    <div class="order-total-strip">
      <div v-for="item in orderTotalItems" :key="item.label" class="order-total-item">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
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
          <el-table-column
            type="index"
            label="序号"
            width="80"
            fixed="left"
            :index="tableRowIndex"
          />
          <el-table-column prop="orderNo" label="销售订单号" width="190" show-overflow-tooltip>
            <template #default="scope">
              <strong>{{ scope.row.orderNo }}</strong>
            </template>
          </el-table-column>
          <el-table-column prop="sourceOrderNo" label="来源单号" width="180" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.sourceOrderNo || '-' }}</template>
          </el-table-column>
          <!-- @vue-generic {SalesOrderSummary} -->
          <el-table-column label="制单人" width="140" show-overflow-tooltip>
            <template #default="scope">{{ sourceCreatorLabel(scope.row) }}</template>
          </el-table-column>
          <el-table-column label="来源状态" width="130">
            <template #default="scope">
              <el-tag v-if="scope.row.sourceStatusCode" effect="light">
                {{ dhbOrderStatusLabel(scope.row.sourceStatusCode) }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <!-- @vue-generic {SalesOrderSummary} -->
          <el-table-column label="数据状态" width="130">
            <template #default="scope">
              <el-tooltip
                v-if="isOrderNeedsReview(scope.row)"
                :content="scope.row.dataQualityMessage || '待业务补齐'"
                placement="top"
              >
                <el-tag type="warning" effect="light">待完善</el-tag>
              </el-tooltip>
              <el-tag v-else type="success" effect="light">完整</el-tag>
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
              <el-tag
                v-if="scope.row.shipmentStatusCode"
                :type="shipmentStatusTag(scope.row.shipmentStatusCode)"
                effect="light"
              >
                {{ salesShipmentStatusLabel(scope.row.shipmentStatusCode) }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="customerNameSnapshot"
            label="客户名称"
            min-width="220"
            show-overflow-tooltip
          />
          <el-table-column
            prop="customerCodeSnapshot"
            label="客户编号"
            width="150"
            show-overflow-tooltip
          >
            <template #default="scope">{{ scope.row.customerCodeSnapshot || '-' }}</template>
          </el-table-column>
          <el-table-column label="订单类型" width="130">
            <template #default="scope">{{ orderTypeLabel(scope.row.orderTypeCode) }}</template>
          </el-table-column>
          <el-table-column
            prop="contactPhoneSnapshot"
            label="联系电话"
            min-width="150"
            show-overflow-tooltip
          >
            <template #default="scope">{{ scope.row.contactPhoneSnapshot || '-' }}</template>
          </el-table-column>
          <el-table-column label="归属地区" width="120">
            <template #default="scope">{{
              regionLabel(scope.row.regionCode, scope.row.regionName)
            }}</template>
          </el-table-column>
          <el-table-column prop="ownerEmployeeNameSnapshot" label="归属销售人员" width="170">
            <template #default="scope">
              {{
                scope.row.ownerEmployeeNameSnapshot ||
                scope.row.ownerSalesName ||
                scope.row.ownerEmployeeCode ||
                '-'
              }}
            </template>
          </el-table-column>
          <el-table-column label="订单状态" width="120">
            <template #default="scope">
              <el-tag :type="orderStatusTag(scope.row.orderStatusCode)" effect="light">{{
                salesOrderStatusLabel(scope.row.orderStatusCode)
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="收款状态" width="120">
            <template #default="scope">
              <el-tag :type="paymentStatusTag(scope.row.paymentStatusCode)" effect="light">{{
                statusLabel(
                  paymentStatusOptions,
                  scope.row.paymentStatusCode,
                  paymentStatusFallbackLabels,
                )
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="出库状态" width="120">
            <template #default="scope">
              <el-tag :type="outboundStatusTag(scope.row.outboundStatusCode)" effect="light">{{
                statusLabel(outboundStatusOptions, scope.row.outboundStatusCode)
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="商品数量" width="110" align="right">
            <template #default="scope">{{ formatNumber(scope.row.totalQuantity) }}</template>
          </el-table-column>
          <el-table-column label="原小计" width="130" align="right">
            <template #default="scope">{{ formatMoney(scope.row.originalAmount) }}</template>
          </el-table-column>
          <!-- @vue-generic {SalesOrderSummary} -->
          <el-table-column label="优惠金额" width="130" align="right">
            <template #default="scope">{{
              formatMoney(displayDiscountAmount(scope.row))
            }}</template>
          </el-table-column>
          <el-table-column label="实际小计" width="140" align="right">
            <template #default="scope"
              ><strong>{{ formatMoney(scope.row.payableAmount) }}</strong></template
            >
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
          <!-- @vue-generic {SalesOrderSummary} -->
          <el-table-column label="操作" width="230" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openDetail(scope.row)">详情</el-button>
              <el-button
                v-if="can('order:attribution:read')"
                link
                type="primary"
                @click.stop="
                  attributionOrderId = scope.row.id;
                  attributionVisible = true
                "
                >归属复核</el-button
              >
              <el-button
                v-if="canRepairProducts(scope.row)"
                link
                type="primary"
                @click.stop="openProductRepair(scope.row.id)"
                >商品复核</el-button
              >
              <el-button
                v-if="canSubmit(scope.row)"
                link
                type="primary"
                @click.stop="submitExisting(scope.row)"
                >提交</el-button
              >
              <el-button
                v-if="canSelectWarehouse(scope.row)"
                link
                type="primary"
                @click.stop="openWarehouseSelection(scope.row)"
                >选仓</el-button
              >
              <el-button
                v-if="canStockOut(scope.row)"
                link
                type="primary"
                @click.stop="openStockOut(scope.row)"
                >出库</el-button
              >
              <el-button
                v-if="canEdit(scope.row)"
                link
                type="primary"
                @click.stop="openEdit(scope.row)"
                >编辑</el-button
              >
              <el-button
                v-if="canDelete(scope.row)"
                link
                type="danger"
                @click.stop="deleteDraft(scope.row)"
                >删除</el-button
              >
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

    <OrderAttributionReviewDialog
      v-model="attributionVisible"
      :order-id="attributionOrderId"
      @applied="loadOrders"
    />
    <OrderProductRepairDialog
      v-model="productRepairVisible"
      :order-id="productRepairOrderId"
      :source-context="productRepairSourceContext"
      @applied="productRepairApplied"
    />

    <el-drawer
      v-model="detailVisible"
      class="order-detail-drawer"
      size="min(1120px, 94vw)"
      :with-header="false"
    >
      <div v-if="detail" class="detail-shell">
        <header class="detail-hero">
          <div class="detail-hero-main">
            <span>销售订单详情</span>
            <h2>{{ detail.orderNo }}</h2>
            <p>
              {{ detail.customerNameSnapshot || '客户待补齐' }} · {{ formatTime(detail.orderDate) }}
            </p>
            <div class="detail-tags">
              <el-tag :type="orderStatusTag(detail.orderStatusCode)" effect="light">{{
                salesOrderStatusLabel(detail.orderStatusCode)
              }}</el-tag>
              <el-tooltip
                v-if="isOrderNeedsReview(detail)"
                :content="detail.dataQualityMessage || '待业务补齐'"
                placement="bottom"
              >
                <el-tag type="warning" effect="light">待完善</el-tag>
              </el-tooltip>
              <el-tag v-if="detail.sourceStatusCode" effect="light">{{
                dhbOrderStatusLabel(detail.sourceStatusCode)
              }}</el-tag>
              <el-tag :type="paymentStatusTag(detail.paymentStatusCode)" effect="light">{{
                statusLabel(
                  paymentStatusOptions,
                  detail.paymentStatusCode,
                  paymentStatusFallbackLabels,
                )
              }}</el-tag>
              <el-tag :type="outboundStatusTag(detail.outboundStatusCode)" effect="light">{{
                statusLabel(outboundStatusOptions, detail.outboundStatusCode)
              }}</el-tag>
              <el-tag
                v-if="detail.shipmentStatusCode"
                :type="shipmentStatusTag(detail.shipmentStatusCode)"
                effect="light"
              >
                {{ salesShipmentStatusLabel(detail.shipmentStatusCode) }}
              </el-tag>
            </div>
          </div>
          <div class="detail-hero-actions">
            <el-button plain @click="openPayments(detail)">回款记录</el-button>
            <el-button circle plain aria-label="关闭销售订单详情" @click="detailVisible = false"
              >×</el-button
            >
          </div>
        </header>
        <div class="detail-content order-detail-content">
          <div class="detail-summary order-detail-summary">
            <div>
              <span>原小计</span><strong>{{ formatMoney(detail.originalAmount) }}</strong>
            </div>
            <div>
              <span>实际小计</span><strong>{{ formatMoney(detail.payableAmount) }}</strong>
            </div>
            <div>
              <span>优惠金额</span><strong>{{ formatMoney(displayDiscountAmount(detail)) }}</strong>
            </div>
            <div>
              <span>已收金额</span><strong>{{ formatMoney(detail.paidAmount) }}</strong>
            </div>
            <div>
              <span>未收金额</span><strong>{{ formatMoney(detail.unpaidAmount) }}</strong>
            </div>
            <div>
              <span>商品数量</span><strong>{{ formatNumber(detail.totalQuantity) }}</strong>
            </div>
          </div>
          <section class="detail-panel">
            <div class="detail-section-heading">
              <div>
                <h3>客户与来源</h3>
                <span>{{ detail.sourceOrderNo || detail.orderNo }}</span>
              </div>
            </div>
            <div class="detail-field-grid">
              <div class="detail-field">
                <span>客户编号</span><strong>{{ detail.customerCodeSnapshot || '-' }}</strong>
              </div>
              <div class="detail-field detail-field--wide">
                <span>客户名称</span><strong>{{ detail.customerNameSnapshot || '-' }}</strong>
              </div>
              <div class="detail-field">
                <span>归属地区</span
                ><strong>{{ regionLabel(detail.regionCode, detail.regionName) }}</strong>
              </div>
              <div class="detail-field">
                <span>归属销售人员</span
                ><strong>{{
                  detail.ownerEmployeeNameSnapshot || detail.ownerSalesName || '-'
                }}</strong>
              </div>
              <div class="detail-field">
                <span>联系人</span><strong>{{ detail.contactNameSnapshot || '-' }}</strong>
              </div>
              <div class="detail-field">
                <span>联系电话</span><strong>{{ detail.contactPhoneSnapshot || '-' }}</strong>
              </div>
              <div class="detail-field">
                <span>来源系统</span
                ><strong>{{ sourceSystemLabel(detail.sourceSystemCode) }}</strong>
              </div>
              <div class="detail-field">
                <span>来源单号</span><strong>{{ detail.sourceOrderNo || '-' }}</strong>
              </div>
              <div class="detail-field">
                <span>来源状态</span
                ><strong>{{ dhbOrderStatusLabel(detail.sourceStatusCode) }}</strong>
              </div>
            </div>
          </section>

          <section class="detail-panel">
            <div class="detail-section-heading">
              <div>
                <h3>订单与履约</h3>
                <span>{{ dataQualityLabel(detail) }}</span>
              </div>
            </div>
            <div class="detail-field-grid">
              <div class="detail-field">
                <span>订单类型</span><strong>{{ orderTypeLabel(detail.orderTypeCode) }}</strong>
              </div>
              <div class="detail-field">
                <span>订单状态</span
                ><strong>{{ salesOrderStatusLabel(detail.orderStatusCode) }}</strong>
              </div>
              <div class="detail-field">
                <span>收款状态</span
                ><strong>{{
                  statusLabel(
                    paymentStatusOptions,
                    detail.paymentStatusCode,
                    paymentStatusFallbackLabels,
                  )
                }}</strong>
              </div>
              <div class="detail-field">
                <span>出库状态</span
                ><strong>{{
                  statusLabel(outboundStatusOptions, detail.outboundStatusCode)
                }}</strong>
              </div>
              <div class="detail-field">
                <span>发货状态</span
                ><strong>{{ salesShipmentStatusLabel(detail.shipmentStatusCode) }}</strong>
              </div>
              <div class="detail-field">
                <span>折扣比例</span><strong>{{ percent(detail.discountRate) }}</strong>
              </div>
              <div class="detail-field">
                <span>制单人</span><strong>{{ sourceCreatorLabel(detail) }}</strong>
              </div>
              <div class="detail-field">
                <span>付款时间</span><strong>{{ formatTime(detail.paymentTime) }}</strong>
              </div>
              <div class="detail-field">
                <span>发货时间</span><strong>{{ formatTime(detail.shipmentTime) }}</strong>
              </div>
              <div class="detail-field">
                <span>创建人</span><strong>{{ auditActorLabel(detail.createdBy) }}</strong>
              </div>
              <div class="detail-field">
                <span>创建时间</span><strong>{{ formatTime(detail.createdTime) }}</strong>
              </div>
              <div class="detail-field">
                <span>更新人</span><strong>{{ auditActorLabel(detail.updatedBy) }}</strong>
              </div>
              <div class="detail-field">
                <span>更新时间</span><strong>{{ formatTime(detail.updatedTime) }}</strong>
              </div>
              <div class="detail-field detail-field--full">
                <span>备注</span><strong>{{ detail.remark || '-' }}</strong>
              </div>
            </div>
          </section>

          <section class="detail-panel detail-payment-section">
            <div class="detail-section-heading">
              <div>
                <h3>订单付款信息</h3>
                <span>回款凭证 {{ orderPaymentAttachmentItems(detail).length }} 个</span>
              </div>
            </div>
            <div class="payment-overview">
              <div>
                <span>付款时间</span>
                <strong>{{ formatTime(detail.paymentTime) }}</strong>
              </div>
              <div>
                <span>付款方式</span>
                <strong>{{ paymentMethodLabel(detail.paymentMethodCode) }}</strong>
              </div>
              <div>
                <span>已付金额</span>
                <strong>{{ formatMoney(detail.paidAmount) }}</strong>
              </div>
              <div>
                <span>收款状态</span>
                <strong>{{
                  statusLabel(
                    paymentStatusOptions,
                    detail.paymentStatusCode,
                    paymentStatusFallbackLabels,
                  )
                }}</strong>
              </div>
            </div>
            <div v-if="orderPaymentAttachmentItems(detail).length" class="payment-attachment-panel">
              <span>回款凭证</span>
              <FundAttachmentPreviewList :attachments="orderPaymentAttachmentItems(detail)" />
            </div>
            <div v-else class="payment-attachment-empty">暂无回款凭证</div>
          </section>
          <section class="detail-panel detail-payment-section">
            <div class="detail-section-heading">
              <div>
                <h3>关联回款记录</h3>
                <span>回款记录 {{ detailPayments.length }} 条</span>
              </div>
              <el-button link type="primary" @click="openPayments(detail)">打开回款记录</el-button>
            </div>
            <el-table
              class="supply-scroll-table detail-table"
              :data="detailPayments"
              v-loading="detailPaymentsLoading"
              max-height="260"
              size="small"
            >
              <el-table-column prop="paymentNo" label="回款单号" width="150" fixed="left" />
              <el-table-column
                prop="sourceDocumentNo"
                label="来源单号"
                width="170"
                show-overflow-tooltip
              >
                <template #default="scope">{{ scope.row.sourceDocumentNo || '-' }}</template>
              </el-table-column>
              <el-table-column label="回款时间" width="170">
                <template #default="scope">{{ formatTime(scope.row.paymentTime) }}</template>
              </el-table-column>
              <el-table-column label="回款金额" width="120" align="right">
                <template #default="scope">{{ formatMoney(scope.row.paidAmount) }}</template>
              </el-table-column>
              <el-table-column label="付款方式" width="130">
                <template #default="scope">{{
                  paymentMethodLabel(scope.row.paymentMethodCode)
                }}</template>
              </el-table-column>
              <el-table-column label="回款人员" width="140" show-overflow-tooltip>
                <template #default="scope">{{
                  scope.row.collectorNameSnapshot || scope.row.collectorStaffCode || '-'
                }}</template>
              </el-table-column>
              <!-- @vue-generic {SalesPaymentDetail} -->
              <el-table-column label="回款凭证" min-width="220">
                <template #default="scope">
                  <FundAttachmentPreviewList
                    v-if="paymentAttachmentItems(scope.row).length"
                    :attachments="paymentAttachmentItems(scope.row)"
                  />
                  <span v-else class="attachment-unavailable">暂无凭证</span>
                </template>
              </el-table-column>
              <template #empty>
                <el-empty description="暂无关联回款记录" />
              </template>
            </el-table>
          </section>
          <section class="detail-panel">
            <div class="detail-section-heading">
              <div>
                <h3>商品明细</h3>
                <span>商品 {{ detail.lines.length }} 条</span>
              </div>
            </div>
            <el-table
              class="supply-scroll-table detail-table"
              :data="detail.lines"
              max-height="360"
              size="small"
            >
              <el-table-column
                prop="productNameSnapshot"
                label="商品"
                min-width="220"
                fixed="left"
              />
              <el-table-column prop="productCodeSnapshot" label="商品编码" width="150" />
              <el-table-column prop="skuCodeSnapshot" label="SKU" width="150" />
              <el-table-column prop="specificationSnapshot" label="规格" min-width="160" />
              <el-table-column label="单位" width="90">
                <template #default="scope">{{ unitLabel(scope.row.unitCode) }}</template>
              </el-table-column>
              <el-table-column label="数量" width="100" align="right"
                ><template #default="scope">{{
                  formatNumber(scope.row.quantity)
                }}</template></el-table-column
              >
              <el-table-column label="单价" width="120" align="right"
                ><template #default="scope">{{
                  formatMoney(scope.row.unitPrice)
                }}</template></el-table-column
              >
              <el-table-column label="折扣比例" width="110" align="right"
                ><template #default="scope">{{
                  percent(scope.row.discountRate)
                }}</template></el-table-column
              >
              <el-table-column label="折扣金额" width="120" align="right"
                ><template #default="scope">{{
                  formatMoney(scope.row.discountAmount)
                }}</template></el-table-column
              >
              <el-table-column label="金额" width="130" align="right"
                ><template #default="scope">{{
                  formatMoney(scope.row.lineAmount)
                }}</template></el-table-column
              >
              <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
            </el-table>
          </section>
        </div>
      </div>
      <el-skeleton v-else :rows="8" animated />
    </el-drawer>

    <el-dialog
      v-model="editorVisible"
      :title="editingId ? '编辑销售订单' : '新增销售订单'"
      width="min(1040px, 94vw)"
      destroy-on-close
    >
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
                <el-option
                  v-for="item in customerOptions"
                  :key="item.id"
                  :label="item.customerName"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="下单时间">
              <el-date-picker
                v-model="form.orderDate"
                type="datetime"
                placeholder="默认当前时间"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户名称快照">
              <el-input
                v-model="form.customerNameSnapshot"
                clearable
                placeholder="导入缺客户映射时可先保留名称"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8"
            ><el-form-item label="联系人"
              ><el-input v-model="form.contactNameSnapshot" clearable /></el-form-item
          ></el-col>
          <el-col :span="8"
            ><el-form-item label="联系电话"
              ><el-input v-model="form.contactPhoneSnapshot" clearable /></el-form-item
          ></el-col>
          <el-col :span="8">
            <el-form-item label="归属地区">
              <el-select
                v-model="form.regionCode"
                disabled
                clearable
                filterable
                placeholder="选择归属地区"
                style="width: 100%"
              >
                <el-option
                  v-for="item in regionOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="归属销售人员">
              <el-select
                v-model="form.ownerEmployeeCode"
                disabled
                clearable
                filterable
                remote
                reserve-keyword
                placeholder="搜索姓名/员工编码"
                :remote-method="searchSalesEmployees"
                :loading="employeeLoading"
                style="width: 100%"
                @change="selectOwnerEmployee"
                @clear="selectOwnerEmployee('')"
              >
                <el-option
                  v-for="item in employeeOptions"
                  :key="item.employeeCode"
                  :label="item.employeeName"
                  :value="item.employeeCode"
                >
                  <div class="employee-option">
                    <strong>{{ item.employeeName }}</strong>
                    <span>{{ item.employeeCode }}</span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="付款方式">
              <el-select
                v-model="form.paymentMethodCode"
                clearable
                placeholder="选择付款方式"
                style="width: 100%"
              >
                <el-option
                  v-for="item in paymentMethodOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24"
            ><el-form-item label="备注"
              ><el-input
                v-model="form.remark"
                type="textarea"
                :rows="2"
                maxlength="1000"
                show-word-limit /></el-form-item
          ></el-col>
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
                  <el-option
                    v-for="item in productOptions"
                    :key="item.id"
                    :label="item.productName"
                    :value="item.id"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="5">
              <el-form-item label="规格">
                <el-select
                  v-model="line.productVariantId"
                  placeholder="选择规格"
                  style="width: 100%"
                  @change="selectVariant(line)"
                >
                  <el-option
                    v-for="item in line.variants"
                    :key="item.id"
                    :label="variantLabel(item)"
                    :value="item.id"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="5">
              <el-form-item label="商品名称快照">
                <el-input
                  v-model="line.productNameSnapshot"
                  clearable
                  placeholder="飞书导入商品名"
                />
              </el-form-item>
            </el-col>
            <el-col :span="4">
              <el-form-item label="商品单位">
                <el-select v-model="line.unitCode" clearable filterable placeholder="选择单位">
                  <el-option
                    v-for="option in productUnitOptions"
                    :key="option.value"
                    :value="option.value"
                    :label="option.label"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="3"
              ><el-form-item label="数量"
                ><el-input-number
                  v-model="line.quantity"
                  :min="0.000001"
                  :precision="2"
                  style="width: 100%" /></el-form-item
            ></el-col>
            <el-col :span="3"
              ><el-form-item label="单价"
                ><el-input-number
                  v-model="line.unitPrice"
                  :min="0"
                  :precision="2"
                  style="width: 100%" /></el-form-item
            ></el-col>
            <el-col :span="3"
              ><el-form-item label="优惠"
                ><el-input-number
                  v-model="line.discountAmount"
                  :min="0"
                  :precision="2"
                  style="width: 100%" /></el-form-item
            ></el-col>
            <el-col :span="3" class="line-actions"
              ><el-button type="danger" link @click="removeLine(index)">删除</el-button></el-col
            >
          </el-row>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button :loading="saving" @click="saveOrder(false)">保存草稿</el-button>
        <el-button
          v-if="can('order:submit')"
          type="primary"
          :loading="saving"
          @click="saveOrder(true)"
          >保存并提交</el-button
        >
      </template>
    </el-dialog>

    <el-dialog
      v-model="stockOutVisible"
      :title="fulfillmentMode === 'SELECT' ? '选择订单仓库' : '确认销售出库'"
      width="520px"
      destroy-on-close
    >
      <el-alert
        class="request-hint"
        :type="warehouseRegionHint.type"
        :closable="false"
        show-icon
        :title="
          fulfillmentMode === 'SELECT'
            ? `客户归属地区：${warehouseRegionHint.regionLabel}，${warehouseRegionHint.message}`
            : '从订单已确认仓库出库；重复请求会核对既有结果，避免重复扣库。'
        "
      />
      <el-form :model="stockOutForm" label-width="100px">
        <el-form-item label="出库仓库">
          <el-select
            v-model="stockOutForm.warehouseId"
            :disabled="fulfillmentMode === 'EXECUTE'"
            filterable
            remote
            reserve-keyword
            placeholder="搜索仓库"
            :remote-method="searchWarehouses"
            :loading="warehouseLoading"
            style="width: 100%"
          >
            <el-option
              v-for="item in warehouseOptions"
              :key="item.id"
              :label="warehouseOptionLabel(item, regionLabel(item.regionCode))"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="fulfillmentMode === 'EXECUTE'" label="出库时间">
          <el-date-picker
            v-model="stockOutForm.stockOutTime"
            type="datetime"
            placeholder="默认当前时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="stockOutForm.remark"
            type="textarea"
            :rows="2"
            maxlength="1000"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="stockOutVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="stockOutLoading"
          :disabled="!stockOutForm.warehouseId"
          @click="confirmStockOut"
          >{{ fulfillmentMode === 'SELECT' ? '保存仓库' : '确认出库' }}</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { displayDateTime } from '@/utils/business-date'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import HistoryOrderReview from '@/components/supply/HistoryOrderReview.vue'
import DhbPageSyncButton from '@/components/supply/DhbPageSyncButton.vue'
import { randomId } from '@/utils/random-id'
import { computed, nextTick, onActivated, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import FundAttachmentPreviewList from '@/components/supply/FundAttachmentPreviewList.vue'
import OrderProductRepairDialog from './components/OrderProductRepairDialog.vue'
import OrderAttributionReviewDialog from './components/OrderAttributionReviewDialog.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import {
  executeOrderFulfillment,
  getOrderFulfillment,
  getOrderWarehouseOptions,
  selectOrderWarehouse,
  type OrderWarehouseOption,
  createSalesOrder,
  deleteSalesOrder,
  getSalesPayment,
  getSalesPayments,
  getSalesOrder,
  getSalesOrders,
  getSalesOrderTotals,
  submitSalesOrder,
  updateSalesOrder,
  type FundDocumentAttachment,
  type OrderPage,
  type SalesOrderCommand,
  type SalesOrderDetail,
  type SalesOrderQuery,
  type SalesOrderSummary,
  type SalesOrderTotals,
  type SalesPaymentDetail,
} from '@/api/core/order-sales'
import {
  getAllCrmCustomerAreas,
  getInternalCrmCustomers,
  type CrmDictionaryView,
  type InternalCrmCustomerSummary,
} from '@/api/core/crm'
import { getHrEmployees, type HrEmployeeRecord } from '@/api/core/hr'
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
import {
  pickRegionMatchedWarehouse,
  warehouseOptionLabel,
} from '@/utils/warehouse-region-match'
import { formatOrderStatus as formatDhbOrderStatus } from '@/utils/dhb-order-status'
import { auditActorLabel } from '@/utils/audit-actor'

const productUnitOptions = computed(() => businessDictionaryOptions('COMMON', 'PRODUCT_UNIT'))
const orderStatusOptions = computed(() => businessDictionaryOptions('ORDER', 'SALES_ORDER_STATUS'))
const { can } = useSupplyPermissions()
const attributionVisible = ref(false),
  attributionOrderId = ref<string | number | null>(null)
const productRepairVisible = ref(false)
const productRepairOrderId = ref<string | number | null>(null)
const hasRepairPermission = computed(
  () => can('order:read') && can('order:history:repair', 'order:write'),
)

function canRepairProducts(row: { sourceSystemCode?: unknown }) {
  return hasRepairPermission.value && row.sourceSystemCode === 'FEISHU'
}

function openProductRepair(id: string | number) {
  productRepairOrderId.value = id
  productRepairVisible.value = true
}

async function productRepairApplied() {
  await loadOrders()
  if (detail.value && String(detail.value.id) === String(productRepairOrderId.value)) {
    await openDetail(detail.value)
  }
}
const sourceStatusOptions = computed(() => businessDictionaryOptions('ORDER', 'DHB_ORDER_STATUS'))
const outboundStatusOptions = computed(() => businessDictionaryOptions('ORDER', 'OUTBOUND_STATUS'))
const shipmentStatusOptions = computed(() =>
  businessDictionaryOptions('ORDER', 'SALES_SHIPMENT_STATUS'),
)
const paymentStatusOptions = computed(() => businessDictionaryOptions('ORDER', 'PAYMENT_STATUS'))
const paymentMethodOptions = computed(() => businessDictionaryOptions('ORDER', 'PAYMENT_METHOD'))
const customerAreaOptions = ref<CrmDictionaryView[]>([])
const regionOptions = computed(() => {
  const options = customerAreaOptions.value.map((item) => ({
    label: areaOptionLabel(item),
    value: item.code,
  }))
  const existing = new Set(options.map((item) => item.value))
  for (const item of businessDictionaryOptions('COMMON', 'REGION')) {
    if (!existing.has(item.value)) options.push(item)
  }
  return options
})
const dataQualityStatusOptions = [
  { label: '完整', value: 'COMPLETE' },
  { label: '待完善', value: 'NEEDS_REVIEW' },
]
const salesOrderStatusFallbackLabels: Record<string, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  COMPLETED: '已完成',
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
  部分出库: '部分出库',
  已收货: '已收货',
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
const router = useRouter()
const productRepairSourceContext = computed(() => {
  const sourceNamespace = routeText(route.query.repairSourceNamespace)
  const sourceCaptureRef = routeText(route.query.repairSourceCaptureRef)
  if (!sourceNamespace || !sourceCaptureRef) return undefined
  return {
    sourceNamespace,
    sourceCaptureRef,
    sourceProductRecordId: routeText(route.query.repairSourceProductRecordId) || undefined,
    sourceProductCode: routeText(route.query.repairSourceProductCode) || undefined,
    sourceOrderNo: routeText(route.query.sourceOrderNo) || undefined,
    lineId: routeText(route.query.repairLineId) || undefined,
  }
})
watch(
  () => [route.query.repairOrderId, hasRepairPermission.value],
  () => {
    const id = routeText(route.query.repairOrderId)
    if (hasRepairPermission.value && /^\d+$/.test(id)) openProductRepair(id)
  },
  { immediate: true },
)

const loading = ref(false)
const saving = ref(false)
const detailVisible = ref(false)
const detail = ref<SalesOrderDetail | null>(null)
const detailPayments = ref<SalesPaymentDetail[]>([])
const detailPaymentsLoading = ref(false)
const editorVisible = ref(false)
const editingId = ref<string | null>(null)
const stockOutVisible = ref(false)
const fulfillmentMode = ref<'SELECT' | 'EXECUTE'>('EXECUTE')
const warehouseRegionHint = reactive({
  type: 'warning' as 'warning' | 'success' | 'info',
  regionLabel: '-',
  message: '保存订单仓库后，由有出库权限的人员确认出库。',
})
const stockOutLoading = ref(false)
const selectedStockOutOrder = ref<SalesOrderSummary | null>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const pageData = ref<OrderPage<SalesOrderSummary>>({ total: 0, begin: 0, step: 20, items: [] })
const orderTotals = ref<SalesOrderTotals>(emptyOrderTotals())

const filters = reactive({
  orderNo: '',
  sourceOrderNo: '',
  sourceStatusCode: '',
  customerName: '',
  contactPhone: '',
  regionCode: '',
  ownerEmployeeCode: '',
  orderStatusCode: '',
  dataQualityStatusCode: '',
  paymentStatusCode: '',
  outboundStatusCode: '',
  orderDateFrom: '',
  orderDateTo: '',
  productId: '',
  productVariantId: '',
  productCodeSnapshot: '',
  skuCodeSnapshot: '',
  productNameSnapshot: '',
  specificationSnapshot: '',
  drillLabel: '',
})

interface SalesOrderLineForm {
  localId: string
  productId: string | null
  productVariantId: string | null
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
  sourceSystemCode: '',
  customerId: '',
  customerCodeSnapshot: '',
  customerNameSnapshot: '',
  contactNameSnapshot: '',
  contactPhoneSnapshot: '',
  regionCode: '',
  ownerSalesUserId: '',
  ownerSalesName: '',
  ownerEmployeeCode: '',
  ownerEmployeeNameSnapshot: '',
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

const orderTotalItems = computed(() => [
  { label: '订单数', value: formatNumber(orderTotals.value.total || pageData.value.total) },
  { label: '商品数量', value: formatNumber(orderTotals.value.totalQuantity) },
  { label: '原小计', value: formatMoney(orderTotals.value.originalAmount) },
  { label: '优惠金额', value: formatMoney(orderTotals.value.discountAmount) },
  { label: '实际小计', value: formatMoney(orderTotals.value.payableAmount) },
  { label: '已收金额', value: formatMoney(orderTotals.value.paidAmount) },
  { label: '未收金额', value: formatMoney(orderTotals.value.unpaidAmount) },
])

function tableRowIndex(index: number): number {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

const customerLoading = ref(false)
const employeeLoading = ref(false)
const productLoading = ref(false)
const warehouseLoading = ref(false)
const customerOptions = ref<InternalCrmCustomerSummary[]>([])
const employeeOptions = ref<HrEmployeeRecord[]>([])
const productOptions = ref<ErpManagedProductSummary[]>([])
const warehouseOptions = ref<OrderWarehouseOption[]>([])

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
  void Promise.all([
    loadCustomerAreas(),
    loadOrders(),
    searchCustomers(''),
    searchSalesEmployees(''),
    searchProducts(''),
  ])
})

onActivated(() => {
  if (!customerAreaOptions.value.length) void loadCustomerAreas()
})

watch(
  () => route.query,
  () => {
    if (!applyRouteQuery()) return
    currentPage.value = 1
    void loadOrders()
  },
)

async function loadOrders() {
  loading.value = true
  try {
    const query = salesOrderQuery()
    const [orders, totals] = await Promise.all([getSalesOrders(query), getSalesOrderTotals(query)])
    pageData.value = orders
    orderTotals.value = totals
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '销售订单加载失败'))
  } finally {
    loading.value = false
  }
}

function salesOrderQuery(): SalesOrderQuery {
  return {
    begin: (currentPage.value - 1) * pageSize.value,
    step: pageSize.value,
    orderNo: empty(filters.orderNo),
    sourceOrderNo: empty(filters.sourceOrderNo),
    sourceStatusCode: empty(filters.sourceStatusCode),
    dataQualityStatusCode: empty(filters.dataQualityStatusCode),
    customerName: empty(filters.customerName),
    contactPhone: empty(filters.contactPhone),
    regionCode: empty(filters.regionCode),
    ownerEmployeeCode: empty(filters.ownerEmployeeCode),
    orderStatusCode: empty(filters.orderStatusCode),
    paymentStatusCode: empty(filters.paymentStatusCode),
    outboundStatusCode: empty(filters.outboundStatusCode),
    orderDateFrom: startOfDay(filters.orderDateFrom),
    orderDateTo: endOfDay(filters.orderDateTo),
    productId: empty(filters.productId),
    productVariantId: empty(filters.productVariantId),
    productCodeSnapshot: empty(filters.productCodeSnapshot),
    skuCodeSnapshot: empty(filters.skuCodeSnapshot),
    productNameSnapshot: empty(filters.productNameSnapshot),
    specificationSnapshot: empty(filters.specificationSnapshot),
  }
}

function emptyOrderTotals(): SalesOrderTotals {
  return {
    total: 0,
    totalQuantity: 0,
    originalAmount: 0,
    discountAmount: 0,
    payableAmount: 0,
    paidAmount: 0,
    unpaidAmount: 0,
  }
}

function resetFilters() {
  filters.orderNo = ''
  filters.sourceOrderNo = ''
  filters.sourceStatusCode = ''
  filters.customerName = ''
  filters.contactPhone = ''
  filters.regionCode = ''
  filters.ownerEmployeeCode = ''
  filters.orderStatusCode = ''
  filters.dataQualityStatusCode = ''
  filters.paymentStatusCode = ''
  filters.outboundStatusCode = ''
  filters.orderDateFrom = ''
  filters.orderDateTo = ''
  filters.productId = ''
  filters.productVariantId = ''
  filters.productCodeSnapshot = ''
  filters.skuCodeSnapshot = ''
  filters.productNameSnapshot = ''
  filters.specificationSnapshot = ''
  filters.drillLabel = ''
  currentPage.value = 1
  void loadOrders()
}

function applyRouteQuery() {
  let changed = false
  changed = setFilterValue('orderNo', routeText(route.query.orderNo)) || changed
  changed = setFilterValue('sourceOrderNo', routeText(route.query.sourceOrderNo)) || changed
  changed = setFilterValue('orderDateFrom', routeDate(route.query.orderDateFrom)) || changed
  changed = setFilterValue('orderDateTo', routeDate(route.query.orderDateTo)) || changed
  changed = setFilterValue('regionCode', routeText(route.query.regionCode)) || changed
  changed = setFilterValue('ownerEmployeeCode', routeText(route.query.ownerEmployeeCode)) || changed
  changed = setFilterValue('sourceStatusCode', routeText(route.query.sourceStatusCode)) || changed
  changed =
    setFilterValue('dataQualityStatusCode', routeText(route.query.dataQualityStatusCode)) || changed
  changed = setFilterValue('paymentStatusCode', routeText(route.query.paymentStatusCode)) || changed
  changed = setFilterValue('productId', routeText(route.query.productId)) || changed
  changed = setFilterValue('productVariantId', routeText(route.query.productVariantId)) || changed
  changed =
    setFilterValue('productCodeSnapshot', routeText(route.query.productCodeSnapshot)) || changed
  changed = setFilterValue('skuCodeSnapshot', routeText(route.query.skuCodeSnapshot)) || changed
  changed =
    setFilterValue('productNameSnapshot', routeText(route.query.productNameSnapshot)) || changed
  changed =
    setFilterValue('specificationSnapshot', routeText(route.query.specificationSnapshot)) || changed
  changed = setFilterValue('drillLabel', routeText(route.query.drillLabel)) || changed
  const ownerEmployeeCode = routeText(route.query.ownerEmployeeCode)
  if (ownerEmployeeCode)
    ensureEmployeeOption(
      ownerEmployeeCode,
      routeText(route.query.ownerEmployeeName) || ownerEmployeeCode,
    )
  return changed
}

const orderDrillContextText = computed(() => {
  if (filters.drillLabel) return `BI 穿透：${filters.drillLabel}`
  const productName = filters.productNameSnapshot || filters.productCodeSnapshot
  const skuName = filters.specificationSnapshot || filters.skuCodeSnapshot
  if (productName && skuName) return `BI 穿透：${productName} / ${skuName}`
  if (productName) return `BI 穿透：${productName}`
  if (skuName) return `BI 穿透：${skuName}`
  return ''
})

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
  detailPayments.value = []
  try {
    const current = await getSalesOrder(row.id)
    detail.value = current
    await loadDetailPayments(current)
    await nextTick()
    scrollDetailToTop('.order-detail-drawer')
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '销售订单详情加载失败'))
  }
}

function scrollDetailToTop(selector: string) {
  const reset = () => {
    document.querySelector(`${selector} .el-drawer__body`)?.scrollTo({ top: 0 })
  }
  reset()
  requestAnimationFrame(reset)
  window.setTimeout(reset, 0)
}

async function loadDetailPayments(order: SalesOrderDetail) {
  detailPaymentsLoading.value = true
  try {
    const result = await getSalesPayments({
      begin: 0,
      step: 50,
      salesOrderNo: order.orderNo,
    })
    detailPayments.value = await Promise.all(
      result.items.map(async (item) => {
        try {
          return await getSalesPayment(item.id)
        } catch {
          return {
            ...item,
            voucherKeys: [],
            attachments: [],
            remark: null,
            createdBy: null,
            createdTime: item.updatedTime,
            updatedBy: null,
          }
        }
      }),
    )
  } catch (reason) {
    detailPayments.value = []
    ElMessage.error(errorMessage(reason, '销售订单回款凭证加载失败'))
  } finally {
    detailPaymentsLoading.value = false
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
    form.sourceSystemCode = current.sourceSystemCode || ''
    form.customerId = idString(current.customerId)
    form.customerCodeSnapshot = current.customerCodeSnapshot || ''
    form.customerNameSnapshot = current.customerNameSnapshot || ''
    ensureCustomerOption(form.customerId, form.customerNameSnapshot, form.customerCodeSnapshot)
    form.contactNameSnapshot = current.contactNameSnapshot || ''
    form.contactPhoneSnapshot = current.contactPhoneSnapshot || ''
    form.regionCode = current.regionCode || ''
    form.ownerSalesUserId = current.ownerSalesUserId || ''
    form.ownerSalesName = current.ownerSalesName || ''
    form.ownerEmployeeCode = current.ownerEmployeeCode || ''
    form.ownerEmployeeNameSnapshot =
      current.ownerEmployeeNameSnapshot || current.ownerSalesName || ''
    ensureEmployeeOption(form.ownerEmployeeCode, form.ownerEmployeeNameSnapshot)
    form.orderDate = current.orderDate
    form.paymentMethodCode = current.paymentMethodCode || ''
    form.remark = current.remark || ''
    form.revision = current.revision
    form.lines = current.lines.map((line) => ({
      localId: randomId(),
      productId: idString(line.productId),
      productVariantId: idString(line.productVariantId),
      productCodeSnapshot: line.productCodeSnapshot,
      skuCodeSnapshot: line.skuCodeSnapshot,
      productNameSnapshot: line.productNameSnapshot || '',
      specificationSnapshot: line.specificationSnapshot,
      unitCode: line.unitCode || '',
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

function isFeishuSource(row: Pick<SalesOrderSummary, 'sourceSystemCode'>) {
  return row.sourceSystemCode === 'FEISHU'
}

function isOrderNeedsReview(row: Pick<SalesOrderSummary, 'dataQualityStatusCode'>) {
  return row.dataQualityStatusCode === 'NEEDS_REVIEW'
}

function isFeishuRepairForm() {
  return form.sourceSystemCode === 'FEISHU'
}

function canSubmit(row: SalesOrderSummary) {
  if (!can('order:submit')) return false
  if (isExternalSource(row) && !isFeishuSource(row)) return false
  if (isOrderNeedsReview(row)) return false
  return row.orderStatusCode === 'DRAFT'
}

function canEdit(row: SalesOrderSummary) {
  if (!can('order:update')) return false
  if (isExternalSource(row) && !isFeishuSource(row)) return false
  return row.orderStatusCode === 'DRAFT'
}

function canDelete(row: SalesOrderSummary) {
  return (
    can('order:delete') &&
    row.orderStatusCode === 'DRAFT' &&
    (!isExternalSource(row) || isFeishuSource(row))
  )
}

function canStockOut(row: SalesOrderSummary) {
  if (!can('order:outbound:confirm')) return false
  if (isExternalSource(row) && !isFeishuSource(row)) return false
  if (isOrderNeedsReview(row)) return false
  return row.orderStatusCode === 'SUBMITTED' && row.outboundStatusCode === 'PENDING'
}

async function deleteDraft(row: SalesOrderSummary) {
  try {
    await ElMessageBox.confirm(`确认删除草稿订单 ${row.orderNo}？`, '删除草稿订单', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteSalesOrder(row.id, row.revision)
    if (detail.value?.id === row.id) {
      detailVisible.value = false
      detail.value = null
    }
    ElMessage.success('草稿订单已删除')
    await loadOrders()
  } catch (reason) {
    if (reason === 'cancel' || reason === 'close') return
    ElMessage.error(errorMessage(reason, '草稿订单删除失败'))
  }
}

function canSelectWarehouse(row: SalesOrderSummary) {
  return (
    can('order:warehouse:select') &&
    !isExternalSource(row) &&
    ['DRAFT', 'SUBMITTED'].includes(row.orderStatusCode) &&
    row.outboundStatusCode === 'PENDING'
  )
}
async function openWarehouseSelection(row: SalesOrderSummary) {
  fulfillmentMode.value = 'SELECT'
  await openFulfillment(row)
}
async function openStockOut(row: SalesOrderSummary) {
  fulfillmentMode.value = 'EXECUTE'
  await openFulfillment(row)
}
async function openFulfillment(row: SalesOrderSummary) {
  selectedStockOutOrder.value = { ...row }
  stockOutForm.stockOutTime = new Date()
  stockOutForm.remark = ''
  try {
    const state = await getOrderFulfillment(row.id)
    selectedStockOutOrder.value.revision = state.orderRevision
    stockOutForm.warehouseId = state.warehouseId == null ? '' : String(state.warehouseId)
    if (fulfillmentMode.value === 'SELECT') {
      await searchWarehouses('')
      const regionCode = selectedStockOutOrder.value.regionCode
      const regionName = regionLabel(regionCode)
      const matched =
        state.warehouseId == null
          ? pickRegionMatchedWarehouse(warehouseOptions.value, regionCode)
          : undefined
      if (matched) {
        stockOutForm.warehouseId = String(matched.id)
        warehouseRegionHint.type = 'success'
        warehouseRegionHint.regionLabel = regionName
        warehouseRegionHint.message = `已默认选中同地区仓库「${matched.warehouseName}」，可改选其他仓库。`
      } else if (state.warehouseId != null) {
        warehouseRegionHint.type = 'info'
        warehouseRegionHint.regionLabel = regionName
        warehouseRegionHint.message = '订单已保存仓库，如需调整请直接改选。'
      } else {
        warehouseRegionHint.type = 'warning'
        warehouseRegionHint.regionLabel = regionName
        warehouseRegionHint.message = '未找到同地区仓库，请人工选择出库仓库。'
      }
    } else
      warehouseOptions.value =
        state.warehouseId == null
          ? []
          : [
              {
                id: String(state.warehouseId),
                warehouseName: `订单已确认仓库（编号 ${state.warehouseId}）`,
              },
            ]
    if (fulfillmentMode.value === 'EXECUTE' && state.warehouseId == null)
      ElMessage.warning('订单尚未选仓，请先由有选仓权限的人员保存仓库')
    stockOutVisible.value = true
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '订单仓库信息加载失败'))
  }
}

function openPayments(
  row: Pick<SalesOrderSummary, 'orderNo' | 'sourceOrderNo' | 'customerNameSnapshot'>,
) {
  detailVisible.value = false
  void router.push({
    name: 'SupplyOrderSalesPayments',
    query: {
      salesOrderNo: row.orderNo,
      sourceDocumentNo: row.sourceOrderNo || undefined,
      customerName: row.customerNameSnapshot || undefined,
    },
  })
}

function paymentAttachmentItems(row: SalesPaymentDetail) {
  const result: FundDocumentAttachment[] = [...(row.attachments || [])]
  const existing = new Set(result.map((item) => item.objectKey))
  for (const key of row.voucherKeys || []) {
    if (!key || existing.has(key)) continue
    result.push({ objectKey: key, fileName: attachmentName(key), url: null })
  }
  return result
}

function orderPaymentAttachmentItems(order: SalesOrderDetail) {
  const result: FundDocumentAttachment[] = [...(order.paymentAttachments || [])]
  const existing = new Set(result.map((item) => item.objectKey))
  for (const key of order.paymentVoucherKeys || []) {
    if (!key || existing.has(key)) continue
    result.push({ objectKey: key, fileName: attachmentName(key), url: null })
  }
  return result
}

function attachmentName(value: string) {
  const normalized = value.split('?')[0] || value
  const parts = normalized.split(/[\\/]/)
  return parts[parts.length - 1] || normalized
}

async function confirmStockOut() {
  if (!selectedStockOutOrder.value) return
  if (!stockOutForm.warehouseId) {
    ElMessage.warning('请选择出库仓库')
    return
  }
  stockOutLoading.value = true
  try {
    if (fulfillmentMode.value === 'SELECT') {
      await selectOrderWarehouse(
        selectedStockOutOrder.value.id,
        stockOutForm.warehouseId,
        selectedStockOutOrder.value.revision,
      )
      stockOutVisible.value = false
      ElMessage.success('订单仓库已保存')
      await loadOrders()
      return
    }
    const result = await executeOrderFulfillment(selectedStockOutOrder.value.id, {
      warehouseId: stockOutForm.warehouseId,
      stockOutTime: toIso(stockOutForm.stockOutTime),
      remark: empty(stockOutForm.remark),
      revision: selectedStockOutOrder.value.revision,
    })
    stockOutVisible.value = false
    if (result.status !== 'COMPLETED') throw new Error('ERP 结果待核对，可重试查询同一执行记录')
    ElMessage.success(`出库成功，ERP出库单 ${result.stockOutNo}`)
    await loadOrders()
  } catch (reason) {
    ElMessage.error(
      errorMessage(reason, '销售出库失败；如提示库存不足，请先完成采购入库或调拨后重试'),
    )
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

async function loadCustomerAreas() {
  try {
    const areas = await getAllCrmCustomerAreas()
    customerAreaOptions.value = areas.filter((item) => item.status === 'ACTIVE')
  } catch (reason) {
    customerAreaOptions.value = []
    ElMessage.warning(errorMessage(reason, '归属地区加载失败，可稍后刷新'))
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
  form.ownerEmployeeCode = customer.ownerEmployeeCode || ''
  form.ownerEmployeeNameSnapshot =
    customer.ownerEmployeeNameSnapshot || customer.ownerSalesName || ''
  ensureEmployeeOption(form.ownerEmployeeCode, form.ownerEmployeeNameSnapshot)
}

function ensureCustomerOption(customerId: string, customerName: string, customerCode: string) {
  if (!customerId || customerOptions.value.some((item) => String(item.id) === customerId)) return
  customerOptions.value = [
    {
      id: customerId,
      customerCode,
      customerName: customerName || customerId,
      contactName: null,
      contactPhone: null,
      customerTypeCode: null,
      regionCode: null,
      ownerSalesUserId: null,
      ownerSalesName: null,
      ownerEmployeeCode: null,
      ownerEmployeeNameSnapshot: null,
      settlementTypeCode: null,
      statusCode: 'ACTIVE',
      revision: 0,
      updatedTime: '',
    },
    ...customerOptions.value,
  ]
}

async function searchSalesEmployees(query: string) {
  employeeLoading.value = true
  try {
    const result = await getHrEmployees({
      begin: 0,
      step: 20,
      keyword: empty(query),
      employmentStatus: 'ACTIVE',
    })
    employeeOptions.value = result.items
  } finally {
    employeeLoading.value = false
  }
}

function selectOwnerEmployee(value: string | number) {
  const code = String(value || '')
  const selected = employeeOptions.value.find((item) => item.employeeCode === code)
  form.ownerEmployeeCode = code
  form.ownerEmployeeNameSnapshot = selected?.employeeName || ''
  form.ownerSalesUserId = ''
  form.ownerSalesName = selected?.employeeName || ''
}

function ensureEmployeeOption(employeeCode: string, employeeName: string) {
  if (!employeeCode || employeeOptions.value.some((item) => item.employeeCode === employeeCode))
    return
  employeeOptions.value = [
    {
      id: employeeCode,
      employeeCode,
      employeeName: employeeName || employeeCode,
      mobile: null,
      email: null,
      employmentStatus: 'ACTIVE',
      jobCategory: null,
      positionCode: null,
      positionName: null,
      departmentName: null,
      leaderEmployeeCode: null,
      leaderName: null,
      regionName: null,
      cityName: null,
      sourceSystem: null,
      sourceDocumentNo: null,
      sourceCreatedAt: null,
      sourceUpdatedAt: null,
      entryDate: null,
      leaveDate: null,
      remark: null,
      revision: 0,
      createdBy: null,
      createdTime: null,
      updatedBy: null,
      updatedTime: null,
    },
    ...employeeOptions.value,
  ]
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
    if (!selectedStockOutOrder.value) return
    const result = await getOrderWarehouseOptions(selectedStockOutOrder.value.id)
    const keyword = query.trim()
    warehouseOptions.value = result
      .filter(
        (w) =>
          !keyword ||
          w.warehouseName.includes(keyword) ||
          regionLabel(w.regionCode).includes(keyword),
      )
      .map((w) => ({ ...w, id: String(w.id) }))
  } finally {
    warehouseLoading.value = false
  }
}

function addLine() {
  form.lines.push({
    localId: randomId(),
    productId: null,
    productVariantId: null,
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
  const allowPartialDraft = isFeishuRepairForm() && !submit
  if (!allowPartialDraft && (!form.customerId || !form.customerNameSnapshot)) {
    ElMessage.warning('请选择客户')
    return null
  }
  const lines = form.lines.map((line) => ({
    productId: idPayload(line.productId),
    productVariantId: idPayload(line.productVariantId),
    productCodeSnapshot: line.productCodeSnapshot,
    skuCodeSnapshot: line.skuCodeSnapshot,
    productNameSnapshot: empty(line.productNameSnapshot) || null,
    specificationSnapshot: line.specificationSnapshot,
    unitCode: empty(line.unitCode) || null,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountAmount: line.discountAmount || 0,
    remark: line.remark,
  }))
  if (
    !allowPartialDraft &&
    lines.some(
      (line) =>
        !line.productId || !line.productVariantId || !line.productNameSnapshot || !line.unitCode,
    )
  ) {
    ElMessage.warning('请完善商品、规格和单位')
    return null
  }
  return {
    customerId: idPayload(form.customerId),
    customerCodeSnapshot: empty(form.customerCodeSnapshot),
    customerNameSnapshot: empty(form.customerNameSnapshot) || null,
    contactNameSnapshot: empty(form.contactNameSnapshot),
    contactPhoneSnapshot: empty(form.contactPhoneSnapshot),
    regionCode: empty(form.regionCode),
    ownerSalesUserId: empty(form.ownerSalesUserId),
    ownerSalesName: empty(form.ownerSalesName),
    ownerEmployeeCode: empty(form.ownerEmployeeCode),
    ownerEmployeeNameSnapshot: empty(form.ownerEmployeeNameSnapshot),
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
  form.sourceSystemCode = ''
  form.customerId = ''
  form.customerCodeSnapshot = ''
  form.customerNameSnapshot = ''
  form.contactNameSnapshot = ''
  form.contactPhoneSnapshot = ''
  form.regionCode = ''
  form.ownerSalesUserId = ''
  form.ownerSalesName = ''
  form.ownerEmployeeCode = ''
  form.ownerEmployeeNameSnapshot = ''
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
    ? dhbOrderStatusFallbackLabels[rawValue] ||
        dhbOrderStatusFallbackLabels[rawValue.toLowerCase()] ||
        rawValue
    : label
}

function salesShipmentStatusLabel(value: string | null | undefined) {
  const rawValue = value?.trim()
  if (!rawValue) return '-'
  return (
    salesShipmentStatusFallbackLabels[rawValue] ||
    statusLabel(shipmentStatusOptions.value, rawValue)
  )
}

function paymentMethodLabel(value: string | null | undefined) {
  return businessDictionaryLabel('ORDER', 'PAYMENT_METHOD', value, '付款方式')
}

function sourceSystemLabel(value: string | null | undefined) {
  if (value === 'DINGHUOBAO' || value === 'DHB') return '订货宝'
  if (value === 'FEISHU') return '飞书'
  return value || '-'
}

function sourceCreatorLabel(
  value: Pick<
    SalesOrderSummary,
    'sourceCreatorName' | 'sourceCreatorStaffCode' | 'sourceCreatorId'
  >,
) {
  return value.sourceCreatorName || value.sourceCreatorStaffCode || value.sourceCreatorId || '-'
}

function dataQualityLabel(
  value: Pick<SalesOrderSummary, 'dataQualityStatusCode' | 'dataQualityMessage'>,
) {
  if (value.dataQualityStatusCode === 'NEEDS_REVIEW')
    return value.dataQualityMessage || '待业务补齐'
  return '完整'
}

function orderTypeLabel(value: string | null | undefined) {
  return businessDictionaryLabel('ORDER', 'SALES_ORDER_TYPE', value, '订单类型')
}

function areaOptionLabel(item: CrmDictionaryView) {
  if (!item.parentCode) return item.name
  const parent = customerAreaOptions.value.find((row) => row.code === item.parentCode)
  return parent ? `${parent.name} / ${item.name}` : item.name
}

function regionLabel(value: string | null | undefined, displayName?: string | null) {
  const normalizedName = displayName?.trim()
  if (normalizedName) return normalizedName
  const rawValue = value?.trim()
  if (!rawValue) return '-'
  return (
    customerAreaOptions.value.find((item) => item.code === rawValue)?.name ||
    businessDictionaryLabel('COMMON', 'REGION', rawValue, '地区')
  )
}

function unitLabel(value: string | null | undefined) {
  return businessDictionaryLabel('COMMON', 'PRODUCT_UNIT', value, '单位')
}

function orderStatusTag(value: string) {
  if (value === 'SUBMITTED' || value === 'COMPLETED') return 'success'
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

function displayDiscountAmount(
  row: Pick<SalesOrderSummary, 'originalAmount' | 'discountAmount' | 'payableAmount'>,
) {
  const original = numericAmount(row.originalAmount)
  const payable = numericAmount(row.payableAmount)
  const stored = numericAmount(row.discountAmount)
  if (original !== null && payable !== null) {
    const derived = roundMoney(original - payable)
    if (derived > 0) return derived
  }
  return stored ?? 0
}

function numericAmount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function formatNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '-'
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

const formatTime = displayDateTime

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

function idString(value: string | number | null | undefined) {
  if (value === null || value === undefined) return ''
  const normalized = String(value).trim()
  return normalized === 'null' || normalized === 'undefined' ? '' : normalized
}

function idPayload(value: string | number | null | undefined) {
  const normalized = idString(value)
  return normalized || null
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

.order-drill-context {
  margin-bottom: 12px;
}

.order-total-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: 8px;
  margin: -4px 0 12px;
}

.order-total-item {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-light);

  span {
    display: block;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  strong {
    display: block;
    margin-top: 4px;
    color: var(--el-text-color-primary);
    font-size: 15px;
    font-weight: 700;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
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

.employee-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}

.order-detail-drawer :deep(.el-drawer__body) {
  padding: 0;
}

.order-detail-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-hero-main {
  min-width: 0;
}

.detail-hero-actions {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 10px;
}

.order-detail-summary {
  grid-template-columns: repeat(6, minmax(0, 1fr));
  margin-bottom: 0;

  > div {
    min-height: 76px;
  }
}

.detail-panel {
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.detail-field-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.detail-field {
  min-width: 0;
  padding: 11px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-light);

  span,
  strong {
    display: block;
    min-width: 0;
  }

  span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  strong {
    margin-top: 6px;
    color: var(--el-text-color-primary);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }
}

.detail-field--wide {
  grid-column: span 2;
}

.detail-field--full {
  grid-column: 1 / -1;
}

.detail-payment-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  h3 {
    margin: 0;
    font-size: 16px;
  }

  span {
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
}

.payment-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;

  div {
    padding: 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    background: var(--el-fill-color-light);
  }

  span {
    display: block;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  strong {
    display: block;
    margin-top: 6px;
    color: var(--el-text-color-primary);
    font-size: 15px;
  }
}

.payment-attachment-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-blank);

  > span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}

.payment-attachment-empty {
  padding: 12px;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}

.attachment-unavailable {
  color: var(--el-text-color-secondary);
}

.sales-order-form {
  max-height: min(640px, 68vh);
  overflow: auto;
  padding-right: 6px;
}

@media (max-width: 900px) {
  .order-detail-summary,
  .payment-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detail-field-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detail-field--wide {
    grid-column: span 2;
  }
}

@media (max-width: 640px) {
  .detail-hero {
    flex-direction: column;
  }

  .detail-hero-actions {
    justify-content: flex-end;
    width: 100%;
  }

  .order-detail-summary,
  .detail-field-grid,
  .payment-overview {
    grid-template-columns: 1fr;
  }

  .detail-field--wide {
    grid-column: auto;
  }
}
</style>
