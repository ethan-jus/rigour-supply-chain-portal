<template>
  <el-dialog
    v-model="visible"
    :title="readonly ? '运输记录详情' : detail ? '编辑运输记录' : '新增运输记录'"
    width="min(1360px, 96vw)"
    top="3vh"
    class="transport-dialog"
    :close-on-click-modal="false"
    :before-close="close"
    @opened="focusInitialSection"
  >
    <div v-loading="loading" class="transport-content">
      <div v-if="detail" class="record-heading">
        <div>
          <span class="heading-label">费用单号</span><strong>{{ detail.record.documentNo }}</strong
          ><el-tag
            :type="
              detail.record.businessStatusCode === 'COMPLETE'
                ? 'success'
                : detail.record.statusCode === 'VOID'
                  ? 'info'
                  : 'warning'
            "
            >{{ statusName(detail.record.statusCode, detail.record.businessStatusCode) }}</el-tag
          >
        </div>
      </div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-alert
        v-if="platform && order?.raw['详情状态'] === 'LIST'"
        title="详细信息暂未同步，请重新同步此单"
        type="warning"
        :closable="false"
      />
      <el-form label-position="top" :model="form" @submit.prevent>
        <section class="transport-section">
          <h3>基本信息</h3>
          <div class="form-grid">
            <el-form-item label="数据来源"
              ><span>{{
                transportSourceLabel(platform, shipmentSources)
              }}</span></el-form-item
            >
            <el-form-item
              label="运输类型"
              :required="!readonly && !shippingLocked"
              :error="fieldErrors.transportType"
              ><span v-if="readonly || salesOrderId || shipmentSources.length">{{
                typeName(form.transportType)
              }}</span
              ><el-select
                v-else
                v-model="form.transportType"
                placeholder="请选择运输类型"
                @change="typeChanged"
                ><el-option
                  v-for="t in transportTypes"
                  :key="t.value"
                  :label="t.label"
                  :value="t.value" /></el-select
            ></el-form-item>
            <el-form-item label="订单类型"
              ><span>{{ type?.orderLabel || '-' }}</span></el-form-item
            >
            <el-form-item
              :label="platform ? '下单时间' : '发货时间'"
              :required="!readonly && !shippingLocked"
              :error="fieldErrors.date"
              ><span v-if="readonly || shippingLocked">{{
                detail ? transportTimeOf(detail.record, platform, shipmentSources) : '-'
              }}</span
              ><el-date-picker
                v-else
                v-model="form.shippingTime"
                type="datetime"
                value-format="YYYY-MM-DDTHH:mm:ss"
                format="YYYY-MM-DD HH:mm:ss"
                placeholder="请选择发货时间"
                @update:model-value="form.date = form.shippingTime?.slice(0, 10) || ''"
              />
              <span
                v-if="detail && !shippingLocked && !detail.record.data.ledger?.shippingTime"
                class="legacy-time-note"
                >{{ readonly ? '原记录未登记具体时间' : '原记录未登记具体时间，可编辑补齐' }}</span
              >
            </el-form-item>
            <el-form-item
              label="配送方式"
              :required="!readonly && !shippingLocked"
              :error="fieldErrors.deliveryModeCode"
            >
              <span v-if="readonly || shippingLocked">{{ deliveryModeName }}</span>
              <el-select
                v-else
                v-model="form.deliveryModeCode"
                placeholder="请选择配送方式"
                @change="deliveryModeChanged"
              >
                <el-option
                  v-for="o in deliveryModes"
                  :key="o.value"
                  :label="o.label"
                  :value="o.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item v-if="!platform && shipmentSources.length" label="订货宝发货方式">
              <span>{{ shipmentDeliveryModeName }}</span>
            </el-form-item>
            <el-form-item v-else label="收货方式">
              <span v-if="readonly || shippingLocked">{{ receivingMethodName }}</span>
              <el-select
                v-else
                v-model="form.receivingMethodCode"
                aria-label="收货方式"
                placeholder="请选择收货方式"
              >
                <el-option
                  v-for="option in receivingMethods"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item v-if="transportChannel" label="运输渠道">
              <span>{{ transportChannelName }}</span>
            </el-form-item>
            <el-form-item
              v-if="!selfDelivery || shipmentCarriers"
              label="物流公司"
              :required="!readonly && !shippingLocked && form.deliveryModeCode !== 'SELF'"
              :error="fieldErrors.carrierCode"
              ><span v-if="selfDelivery">{{ shipmentCarriers }}</span
              ><span v-else-if="platform">货拉拉</span
              ><span v-else-if="readonly || shippingLocked">{{
                form.carrierCode
                  ? costLabel('COST_CARRIER', form.carrierCode)
                  : shipmentCarriers || detail?.record.data.logistics?.carrierName || '-'
              }}</span
              ><el-select v-else v-model="form.carrierCode" placeholder="请选择物流公司"
                ><el-option
                  v-for="o in carriers"
                  :key="o.value"
                  :label="o.label"
                  :value="o.value" /></el-select
            ></el-form-item>
            <el-form-item
              v-if="!selfDelivery || shipmentTrackingNumbers"
              label="快递单号"
              :required="!readonly && !shippingLocked && form.deliveryModeCode !== 'SELF'"
              :error="fieldErrors.platformOrderNo"
              ><span v-if="readonly || shippingLocked">{{
                order?.orderNo ||
                  (shipmentSources.length ? shipmentTrackingNumbers : form.platformOrderNo) ||
                  '-'
              }}</span
              ><el-input
                v-else
                v-model="form.platformOrderNo"
                maxlength="80"
                placeholder="填写快递单号"
            /></el-form-item>
            <Info v-if="platform" label="车型" :value="vehicleOf(platform)" />
          </div>
        </section>
        <section class="transport-section">
          <div ref="ordersSection" class="section-heading">
            <h3>关联业务订单</h3>
            <el-button
              v-if="readonly && allowShipmentReconciliation && shipmentReconciliationAvailable(detail)"
              type="primary"
              plain
              :loading="reconcilingShipmentOrders"
              @click="emit('reconcile-shipment-orders')"
              >补齐发货关联</el-button
            >
            <el-button
              v-if="!readonly && !advanced && !salesOrderId && !shipmentSources.length"
              type="primary"
              plain
              :disabled="!form.transportType"
              @click="picker = true"
              >选择{{ type?.orderLabel || '业务订单' }}</el-button
            >
          </div>
          <el-table :data="displayedOrders" border scrollbar-always-on empty-text="暂未关联业务订单"
            ><el-table-column
              prop="documentNo"
              label="业务单号"
              min-width="245"
              fixed="left"
            >
              <template #default="{ row }">
                <span>{{ row.documentNo }}</span>
                <el-tag v-if="row.sourceOnly" type="info" size="small" class="shipment-source-tag"
                  >来源销售单·待匹配</el-tag
                >
              </template>
            </el-table-column><el-table-column label="客户／收货仓库" min-width="180"
              ><template #default="{ row }">{{
                row.receiverName || '-'
              }}</template></el-table-column
            ><el-table-column label="业务员" width="110"
              ><template #default="{ row }">{{
                row.employeeName || '-'
              }}</template></el-table-column
            ><el-table-column label="部门" min-width="130"
              ><template #default="{ row }">{{
                row.departmentName || '-'
              }}</template></el-table-column
            ><el-table-column label="业务单据日期" min-width="125"
              ><template #default="{ row }">{{
                row.documentDate || '-'
              }}</template></el-table-column
            ><el-table-column label="业务订单金额（元）" align="right" min-width="160"
              ><template #default="{ row }">{{
                money(row.documentAmount)
              }}</template></el-table-column
            ><el-table-column label="订单关联时间" min-width="185"
              ><template #default="{ row }">{{
                row.linkedAt ? displayRecordDateTime(row.linkedAt) : '-'
              }}</template>
              <template #header>
                <span title="这笔运输记录与该业务订单在系统中建立关联的时间">订单关联时间</span>
              </template> </el-table-column
            ><el-table-column
              v-if="!readonly && !advanced && !salesOrderId && !shipmentSources.length"
              label="操作"
              width="80"
              fixed="right"
              ><template #default="{ row }"
                ><el-button link type="danger" @click="removeOrder(row.documentNo)"
                  >移除</el-button
                ></template
              ></el-table-column
            ></el-table
          >
        </section>
        <section ref="feesSection" class="transport-section">
          <h3>费用信息</h3>
          <el-button
            v-if="advanced && !readonly"
            class="advanced-button"
            @click="advancedOpen = true"
            >维护费用与分摊明细</el-button
          >
          <TransportBillSummary :items="billMetrics">
            <template #total>
              <el-form-item class="bill-total-input" :error="fieldErrors.amount"
                ><span v-if="readonly || advanced" class="amount">{{ money(form.amount) }}</span
                ><el-input-number
                  v-else
                  v-model="amountInput"
                  @change="changeAmount"
                  :precision="2"
                  :min="form.amount != null && form.amount < 0 ? undefined : 0"
                  :max="999999999999"
                  :controls="false"
                  aria-label="运输费用总额"
                  placeholder="填写本次运输费用"
                /><span
                  v-if="!readonly && !advanced && form.manualBillItems?.length"
                  class="optional-label"
                  >全部费用减去优惠后的合计；修改总额将调整基础运费</span
                ></el-form-item
              >
            </template>
          </TransportBillSummary>
          <div class="form-grid">
            <el-form-item label="费用负责人"
              ><span v-if="readonly">{{ ownerName }}</span
              ><el-select
                v-else
                v-model="form.ownerEmployeeCode"
                clearable
                filterable
                placeholder="请选择费用负责人"
                ><el-option
                  v-for="e in ownerOptions"
                  :key="e.employeeCode"
                  :label="e.employeeName + (e.departmentName ? `（${e.departmentName}）` : '')"
                  :value="e.employeeCode" /></el-select></el-form-item
            ><el-form-item label="付款状态">
              <span v-if="readonly || platform">{{ paymentName }}</span>
              <el-select v-else v-model="form.paymentStatusCode" placeholder="请选择付款状态">
                <el-option
                  v-for="o in paymentStatuses"
                  :key="o.value"
                  :label="o.label"
                  :value="o.value"
                />
              </el-select> </el-form-item
            ><el-form-item label="费用归属城市"
              ><span v-if="readonly || orderBasedCity">{{ expenseCityName }}</span
              ><CostCitySelect
                v-else
                v-model="form.cityCode"
                action="order:logistics-cost:write" /></el-form-item
            ><el-form-item
              v-if="form.amount === 0"
              class="wide"
              label="零元原因"
              :required="!readonly"
              ><span v-if="readonly">{{ form.zeroReason || '-' }}</span
              ><el-input
                v-else
                v-model="form.zeroReason"
                maxlength="500"
                placeholder="填写包邮或无需我方支付的原因"
            /></el-form-item>
          </div>
          <template v-if="!platform">
            <div class="section-heading bill-heading">
              <h4>
                账单明细<span v-if="!readonly && !advanced" class="optional-label">（选填）</span>
              </h4>
              <el-button
                v-if="!readonly && !advanced && form.manualBillItems?.length"
                link
                @click="useTotalOnly"
                >改为只填总额</el-button
              >
              <el-button
                v-if="!readonly && !advanced"
                link
                type="primary"
                :disabled="(form.manualBillItems?.length || 0) >= 100"
                @click="addBillItem"
                >添加费用项目</el-button
              >
            </div>
            <template v-if="form.manualBillItems?.length">
              <el-table :data="form.manualBillItems" border scrollbar-always-on>
                <el-table-column label="费用项目" min-width="180"
                  ><template #default="{ row }">
                    <span v-if="readonly || advanced">{{ row.name }}</span>
                    <el-select
                      v-else
                      v-model="row.name"
                      filterable
                      allow-create
                      default-first-option
                      placeholder="选择或填写费用项目"
                      maxlength="100"
                    >
                      <el-option
                        v-for="o in feeTypes"
                        :key="o.value"
                        :label="o.label"
                        :value="o.label"
                      />
                      <el-option label="优惠" value="优惠" />
                    </el-select> </template
                ></el-table-column>
                <el-table-column :label="'金额（元）'" min-width="230" align="right"
                  ><template #default="{ row }">
                    <span v-if="readonly || advanced">{{ money(manualBillAmount(row)) }}</span>
                    <el-input-number
                      v-else
                      v-model="row.amount"
                      :precision="2"
                      :min="-999999999999"
                      :max="999999999999"
                      :controls="false"
                      :aria-label="`${row.name || '费用项目'}金额`"
                      placeholder="填写金额"
                    /> </template
                ></el-table-column>
                <el-table-column v-if="!readonly && !advanced" label="操作" width="80"
                  ><template #default="{ $index }"
                    ><el-button link type="danger" @click="form.manualBillItems?.splice($index, 1)"
                      >移除</el-button
                    ></template
                  ></el-table-column
                >
              </el-table>
              <p
                v-if="!readonly && !advanced && form.manualBillItems?.length"
                class="optional-label bill-hint"
              >
                费用逐项合计，优惠金额自动扣减；直接修改总额时调整基础运费，其余项目保留。
              </p>
            </template>
            <template
              v-else-if="
                advanced &&
                advancedData?.ledger?.manualBillItems == null &&
                advancedData?.ledger?.feeItems.length
              "
            >
              <el-table :data="advancedData!.ledger!.feeItems" border>
                <el-table-column label="费用项目"
                  ><template #default="{ row }">{{
                    costLabel('COST_LOGISTICS_FEE_TYPE', row.feeTypeCode)
                  }}</template></el-table-column
                >
                <el-table-column label="金额（元）" align="right"
                  ><template #default="{ row }">{{
                    money(row.feeAmount)
                  }}</template></el-table-column
                >
              </el-table>
            </template>
            <span v-else class="optional-label">未登记费用明细</span>
          </template>
          <div v-if="allocations.length > 1 && !readonly && !advanced" class="allocation-tools">
            <span>订单分摊</span>
            <el-button
              link
              type="primary"
              :disabled="!weightedAvailable || form.amount == null"
              @click="reallocate('AMOUNT')"
              >按销售金额分摊</el-button
            >
            <el-button
              link
              type="primary"
              :disabled="form.amount == null"
              @click="reallocate('EQUAL')"
              >均分</el-button
            >
          </div>
          <p v-if="shipmentOnlyOrders.length" class="optional-label">
            {{ shipmentOnlyOrders.length }} 笔订单通过发货关联展示。
            {{ allocations.length ? '费用分摊以已保存的明细为准。' : '暂无已保存的订单分摊。' }}
          </p>
          <el-table v-if="allocations.length" :data="allocations" border scrollbar-always-on
            ><el-table-column prop="code" label="业务单号" min-width="170" />
            <el-table-column v-if="allocations.length > 1" label="业务单金额（元）" align="right"
              ><template #default="{ row }">{{
                money(row.source?.documentAmount)
              }}</template></el-table-column
            >
            <el-table-column v-if="allocations.length > 1" label="业务员／部门" min-width="150"
              ><template #default="{ row }"
                >{{ row.source?.employeeName || '-' }}／{{
                  row.source?.departmentName || '-'
                }}</template
              ></el-table-column
            >
            <el-table-column
              v-if="expenseCityCodes.length > 1"
              label="费用归属城市"
              min-width="140"
            >
              <template #default="{ row }">{{ cityLabel(row.source?.cityCode) || '-' }}</template>
            </el-table-column>
            <el-table-column label="分摊运输费用（元）" align="right" min-width="180"
              ><template #default="{ row }"
                ><el-input-number
                  v-if="!readonly && !advanced && allocations.length > 1"
                  :model-value="row.amount"
                  :min="0"
                  :precision="2"
                  :controls="false"
                  :aria-label="`${row.code}分摊金额`"
                  @update:model-value="setAllocation(row.code, $event ?? null)"
                /><span v-else>{{ money(row.amount) }}</span></template
              ></el-table-column
            ></el-table
          >
          <div v-if="allocations.length > 1" class="allocation-total">
            分摊合计 {{ money(allocationTotal) }} 元／运输费用 {{ money(form.amount) }} 元
          </div>
          <el-alert
            v-if="allocationProblem && !readonly && !advanced"
            :title="allocationProblem"
            type="error"
            :closable="false"
          />
          <TransportPlatformBill
            v-if="platform"
            :record-id="detail!.record.id"
            :platform="platform"
            :confirmed-amount="detail!.record.data.amount"
            hide-summary
            hide-payment-status
          />
        </section>
        <section class="transport-section">
          <h3>发货信息</h3>
          <template v-if="platform"
            ><div v-for="(p, i) in platformSenders" :key="i" class="address-card">
              <strong>{{ p.name || '-' }}</strong>
              <div class="form-grid">
                <Info label="发货联系人" :value="p.contactName" /><Info
                  label="发货联系电话"
                  :value="p.contactPhone"
                /><Info class="wide" label="发货地址" :value="p.address" />
              </div>
            </div>
            <p v-if="!platformSenders.length" class="empty-text">暂无发货信息</p>
            <el-form-item label="发货仓库"
              ><span v-if="readonly">{{ warehouseName }}</span
              ><CostLedgerPartySelect
                v-else
                :name="warehouseName === '-' ? undefined : warehouseName"
                v-model="form.warehouseCode"
                logistics
                kind="WAREHOUSE"
                placeholder="按实际运输补选仓库"
            /></el-form-item>
          </template>
          <div v-else class="form-grid">
            <el-form-item label="发货仓库"
              ><span v-if="readonly || shippingLocked">{{ warehouseName }}</span
              ><CostLedgerPartySelect
                v-else
                v-model="form.warehouseCode"
                logistics
                kind="WAREHOUSE"
                :name="form.senderName"
                placeholder="搜索并选择发货仓库"
                @selected="selectWarehouse" /></el-form-item
            ><el-form-item
              label="发货方"
              :required="!readonly && !shippingLocked"
              :error="fieldErrors.senderName"
              ><span v-if="readonly || shippingLocked">{{ form.senderName || '-' }}</span
              ><el-input
                v-else
                v-model="form.senderName"
                maxlength="100"
                placeholder="填写实际发货方"
                @input="senderTouched = true" /></el-form-item
            ><el-form-item label="发货联系人"
              ><span v-if="readonly || shippingLocked">{{ form.senderContact || '-' }}</span
              ><el-input
                v-else
                v-model="form.senderContact"
                maxlength="100"
                @input="senderTouched = true" /></el-form-item
            ><el-form-item label="发货联系电话" :error="fieldErrors.senderPhone"
              ><span v-if="readonly || shippingLocked">{{ form.senderPhone || '-' }}</span
              ><el-input
                v-else
                v-model="form.senderPhone"
                maxlength="50"
                @input="senderTouched = true" /></el-form-item
            ><el-form-item
              class="wide"
              label="发货地址"
              :required="!readonly && !shippingLocked"
              :error="fieldErrors.senderAddress"
              ><span v-if="readonly || shippingLocked">{{ form.senderAddress || '-' }}</span
              ><el-input
                v-else
                v-model="form.senderAddress"
                maxlength="500"
                placeholder="填写本次运输的发货地址"
                @input="senderTouched = true"
            /></el-form-item>
          </div>
        </section>
        <section class="transport-section">
          <div class="section-heading">
            <h3>收货信息与行驶路段</h3>
            <span class="optional-label">{{
              receivers.length ? `${receivers.length} 个收货点` : '-'
            }}</span>
          </div>
          <div class="overview-route" aria-label="行驶路段">
            <span>行驶路段</span><TransportRouteSummary :route="route" />
          </div>
          <div class="receiver-grid">
            <div v-for="(p, i) in visibleReceivers" :key="i" class="address-card">
              <h4>{{ receivers.length > 1 ? `收货点 ${i + 1}` : '收货点' }}</h4>
              <div class="form-grid">
                <el-form-item
                  label="收货单位"
                  :required="!readonly && !shippingLocked"
                  :error="fieldErrors[`receivingPoints.${i}.manualName`]"
                >
                  <span v-if="readonly || shippingLocked">{{ p.name || '-' }}</span>
                  <el-input v-else v-model="form.receivingPoints![i]!.manualName" maxlength="100" />
                </el-form-item>
                <el-form-item
                  label="收货联系人"
                  :required="!readonly && !shippingLocked"
                  :error="fieldErrors[`receivingPoints.${i}.contactName`]"
                >
                  <span v-if="readonly || shippingLocked">{{ p.contactName || '-' }}</span>
                  <el-input
                    v-else
                    v-model="form.receivingPoints![i]!.contactName"
                    maxlength="100"
                  />
                </el-form-item>
                <el-form-item
                  label="收货联系电话"
                  :required="!readonly && !shippingLocked"
                  :error="fieldErrors[`receivingPoints.${i}.phone`]"
                >
                  <span v-if="readonly || shippingLocked">{{ p.contactPhone || '-' }}</span>
                  <el-input v-else v-model="form.receivingPoints![i]!.phone" maxlength="50" />
                </el-form-item>
                <el-form-item
                  class="wide"
                  label="收货地址"
                  :required="!readonly && !shippingLocked"
                  :error="fieldErrors[`receivingPoints.${i}.address`]"
                >
                  <span v-if="readonly || shippingLocked">{{ p.address || '-' }}</span>
                  <el-input v-else v-model="form.receivingPoints![i]!.address" maxlength="500" />
                </el-form-item>
              </div>
            </div>
          </div>
          <el-button
            v-if="receivers.length > 2"
            link
            type="primary"
            class="receivers-toggle"
            :aria-expanded="allReceivers"
            @click="allReceivers = !allReceivers"
          >
            {{ allReceivers ? '收起收货点' : `展开全部 ${receivers.length} 个收货点` }}
          </el-button>
          <p v-if="!receivers.length" class="empty-text">
            {{ platform || readonly ? '暂无收货信息' : '选择业务订单后显示收货信息' }}
          </p>
        </section>
        <section ref="evidenceSection" class="transport-section" aria-label="凭证与运输影像">
          <h3>凭证与运输影像</h3>
          <TransportEvidence
            embedded
            v-model="attachmentDrafts"
            :row="detail?.record || null"
            :platform="platform"
            :readonly="readonly"
            :disabled="saving"
            :required="!platform"
            hide-empty
            @busy="attachmentBusy = $event"
            @count="attachmentCount = $event"
          />
          <p
            v-if="readonly && !platform && !attachmentBusy && attachmentCount === 0"
            class="empty-text"
          >
            暂无凭证与运输影像
          </p>
        </section>
        <section class="transport-section" aria-label="运输备注">
          <h3>备注</h3>
          <div v-if="shippingLocked" class="platform-remark">
            <div class="section-heading">
              <h4>物流订单备注</h4>
              <el-tag type="info" size="small">只读</el-tag>
            </div>
            <p v-for="note in sourceRemarks" :key="note.id" class="remark">
              <strong v-if="sourceRemarks.length > 1">{{ note.documentNo }} · </strong>{{
                note.text
              }}
            </p>
            <p v-if="!sourceRemarks.length" class="remark">-</p>
          </div>
          <h4 v-if="shippingLocked">补充备注</h4>
          <span v-if="readonly" class="remark">{{ displayValue(form.remark) }}</span
          ><el-input
            v-else
            v-model="form.remark"
            type="textarea"
            :aria-label="shippingLocked ? '补充备注' : '备注'"
            :rows="3"
            maxlength="1000"
            show-word-limit
            placeholder="填写备注"
          /><el-form-item
            v-if="!readonly && detail && hadLinks"
            label="变更原因"
            class="change-reason"
            ><el-input
              v-model="form.reason"
              maxlength="500"
              placeholder="更改或解除已有订单关联时填写原因"
          /></el-form-item>
        </section>
      </el-form>
      <TransportShipmentSources
        v-if="shipmentSources.length"
        :sources="shipmentSources"
        :huolala-order-no="order?.orderNo"
        @open-mapping="visible = false"
      />
      <TransportPlatformDetails
        v-if="platform"
        :platform="platform"
        :employees="employees"
        :readonly="readonly"
        @associate-employee="emit('associate-employee')"
      />
      <section v-if="detail" class="transport-section">
        <h3>操作记录</h3>
        <el-table :data="businessHistory" border empty-text="暂无操作记录"
          ><el-table-column label="操作时间" min-width="190"
            ><template #default="{ row }">{{
              displayRecordDateTime(row.occurredTime)
            }}</template></el-table-column
          ><el-table-column label="操作" width="120"
            ><template #default="{ row }">{{ auditLabel(row.action) }}</template></el-table-column
          ><el-table-column label="操作人" min-width="120"
            ><template #default="{ row }">{{
              displayRecordActor(row.actorId)
            }}</template></el-table-column
          ><el-table-column label="说明" min-width="240"
            ><template #default="{ row }">{{
              row.action.startsWith('ATTACHMENT_') ? '—' : row.reason || '—'
            }}</template></el-table-column
          ></el-table
        >
      </section>
    </div>
    <template #footer
      ><el-button :disabled="saving" @click="close()">{{ readonly ? '关闭' : '取消' }}</el-button
      ><el-button
        v-if="!readonly"
        type="primary"
        :loading="saving"
        :disabled="loading || attachmentBusy"
        @click="save"
        >{{ salesOrderId ? '保存并关联销售订单' : '保存运输记录' }}</el-button
      ></template
    >
    <el-dialog
      v-model="advancedOpen"
      class="transport-allocation-dialog"
      top="3vh"
      title="费用与分摊明细"
      width="min(1250px, 94vw)"
      append-to-body
      :close-on-click-modal="false"
      ><CostLedgerEditor
        v-if="advancedData && advancedOpen"
        v-model="advancedData"
        logistics
        :fees-only="!!platform"
        :carrier-locked="!!platform"
        :cities="cities"
        :employees="employees"
        :readonly="readonly"
      /><template #footer
        ><el-button type="primary" @click="applyAdvanced">完成</el-button></template
      ></el-dialog
    >
    <CostLedgerSourcePicker
      v-model="picker"
      :selected-keys="form.orderCodes.map((c) => `${type?.orderType}:${c}`)"
      :order-type-code="type?.orderType"
      :allow-incomplete="!!platform"
      :suggested-date="form.date"
      :suggested-receiver="order?.raw['收货人信息']"
      @selected="addOrders"
    />
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref, watch, toRaw, type PropType } from 'vue'
import { ElMessage } from 'element-plus'
import type { CostEmployee, CostSource, CostAudit, CostCommand } from '@/api/core/cost'
import { getCostEmployees, getCostHistory, getCostCities } from '@/api/core/cost'
import { getLedgerParties, type LedgerPartyReference } from '@/api/core/cost-ledger'
import { type TransportDetail } from '@/api/core/transport-records'
import { currentSource, platformPaymentStatus } from './huolala-source'
import {
  transportDraft,
  transportReceivingMethod,
  shipmentCarrierNames,
  shipmentOrders,
  shipmentReconciliationAvailable,
  shipmentRemark,
  receivingMethods,
  transportTypes,
  money,
  typeName,
  statusName,
  manualBillTotal,
  manualBillAmount,
  adjustManualBillTotal,
  frozenTransportSources,
  frozenTransportReceivers,
  vehicleOf,
  transportTimeOf,
  transportSourceLabel,
} from './transport-records'
import {
  allocationError,
  canWeightSales,
  complexTransportLedger,
  savedTransportAllocations,
  transportAllocations,
} from './transport-allocation'
import CostLedgerPartySelect from './CostLedgerPartySelect.vue'
import CostLedgerSourcePicker, { type PickedLedgerSource } from './CostLedgerSourcePicker.vue'
import CostCitySelect from './CostCitySelect.vue'
import TransportBillSummary from './TransportBillSummary.vue'
import TransportPlatformBill from './TransportPlatformBill.vue'
import TransportPlatformDetails from './TransportPlatformDetails.vue'
import TransportRouteSummary from './TransportRouteSummary.vue'
import CostLedgerEditor from './CostLedgerEditor.vue'
import { totalFees } from './cost-ledger'
import TransportEvidence from './TransportEvidence.vue'
import TransportShipmentSources from './TransportShipmentSources.vue'
import { TransportEvidenceSaveSession } from './transport-evidence'
import { type CostAttachmentDraft } from './cost-attachment-draft'
import { validateManualTransport, type TransportErrors } from './transport-validation'
import { costOptions, costLabel, loadCostDictionaryCodes } from './cost-dictionaries'
import { errorMessage } from '@/api/core/error'
import { auditLabel } from './cost-audit'
import { displayRecordActor, displayRecordDateTime, displayValue } from '@/utils/business-display'
const props = defineProps<{
  detail: TransportDetail | null
  readonly: boolean
  initialSection?: string
  salesOrderId?: string | number | null
  salesSource?: CostSource | null
  initialCarrierCode?: string | null
  initialDeliveryMode?: string
  allowShipmentReconciliation?: boolean
  reconcilingShipmentOrders?: boolean
}>()
const ordersSection = ref<HTMLElement>()
const feesSection = ref<HTMLElement>()
const evidenceSection = ref<HTMLElement>()
const visible = defineModel<boolean>({ required: true })
const emit = defineEmits<{
  saved: []
  'associate-employee': []
  'reconcile-shipment-orders': []
}>()
const detail = ref(props.detail),
  platform = computed(() => detail.value?.platform)
const shipmentSources = computed(() => detail.value?.shipments || [])
const shipmentDeliveryModeName = computed(
  () =>
    [
      ...new Set(
        shipmentSources.value.map(({ latest }) => latest.deliveryModeName?.trim()).filter(Boolean),
      ),
    ].join('、') || '-',
)
const shipmentCarriers = computed(() => shipmentCarrierNames(shipmentSources.value))
const shipmentTrackingNumbers = computed(() =>
  [...new Set(shipmentSources.value.flatMap(({ latest }) => latest.trackingNumbers))].join('、'),
)
const transportChannel = computed(
  () => (shipmentSources.value.length ? null : detail.value?.record.data.ledger?.transportMethodCode),
)
const transportChannelName = computed(() => costLabel('COST_TRANSPORT_KIND', transportChannel.value))
const shippingLocked = computed(() => !!platform.value || !!shipmentSources.value.length)
const order = computed(() => (platform.value ? currentSource(platform.value.source) : null))
const sourceRemarks = computed(() => {
  const remarks = shipmentSources.value.flatMap(({ id, latest }) => {
    const text = shipmentRemark(latest.sourceFields)
    return text.trim() ? [{ id, documentNo: latest.shipmentNo, text }] : []
  })
  const platformOrder = order.value
  const text = platformOrder?.raw['订单备注']
  if (platformOrder && text?.trim())
    remarks.unshift({ id: 'platform', documentNo: platformOrder.orderNo, text })
  return remarks
})
const form = ref(transportDraft(detail.value?.record, platform.value))
const selfDelivery = computed(() => form.value.deliveryModeCode === 'SELF')
const receivingMethodName = computed(() =>
  transportReceivingMethod(form.value.receivingMethodCode, platform.value),
)
const deliveryModeName = computed(() => {
  if (!shipmentSources.value.length || platform.value)
    return costLabel('COST_DELIVERY_MODE', form.value.deliveryModeCode)
  const stored = detail.value?.record.data.ledger?.deliveryModeCode
  if (stored) return costLabel('COST_DELIVERY_MODE', stored)
  const codes = new Set(shipmentSources.value.map(({ latest }) => latest.deliveryModeCode))
  return codes.size === 1 && !codes.has(null)
    ? costLabel('COST_DELIVERY_MODE', shipmentSources.value[0]?.latest.deliveryModeCode)
    : '待核对'
})
const amountInput = ref(form.value.amount)
watch(
  () => form.value.amount,
  (amount) => (amountInput.value = amount),
)
if (props.salesSource && !detail.value)
  Object.assign(form.value, {
    transportType: 'DELIVERY',
    orderCodes: [props.salesSource.documentNo],
    carrierCode: props.initialCarrierCode || null,
    deliveryModeCode: props.initialDeliveryMode || 'THIRD_PARTY',
    cityCode: props.salesSource.cityCode || '',
    ownerEmployeeCode: props.salesSource.employeeCode || null,
  })
const deliveryModes = computed(() => costOptions('COST_DELIVERY_MODE'))
const carriers = computed(() => costOptions('COST_CARRIER'))
const paymentStatuses = computed(() => costOptions('COST_PAYMENT_STATUS'))
const feeTypes = computed(() => costOptions('COST_LOGISTICS_FEE_TYPE'))
const fieldErrors = ref<TransportErrors>({})
const advancedData = ref<CostCommand | null>(
  detail.value ? structuredClone(toRaw(detail.value.record.data)) : null,
)
const advanced = computed(() => complexTransportLedger(advancedData.value?.ledger))
const advancedOpen = ref(false),
  cities = ref<{ code: string; name: string }[]>([])
function applyAdvanced() {
  if (!advancedData.value?.ledger) return
  form.value.amount = totalFees(advancedData.value.ledger.feeItems)
  advancedOpen.value = false
}

const type = computed(() => transportTypes.find((t) => t.value === form.value.transportType))
const selected = ref<CostSource[]>([]),
  employees = ref<CostEmployee[]>([]),
  history = ref<CostAudit[]>([])
const shipmentOnlyOrders = computed(() =>
  props.readonly
    ? shipmentOrders(shipmentSources.value).filter(
        ({ documentNo }) => !selected.value.some((source) => source.documentNo === documentNo),
      )
    : [],
)
const displayedOrders = computed(() => [...selected.value, ...shipmentOnlyOrders.value])
const orderBasedCity = computed(
  () => form.value.transportType === 'DELIVERY' || form.value.transportType === 'TRANSFER',
)
const expenseCityCodes = computed(() => [
  ...new Set(selected.value.flatMap((source) => (source.cityCode ? [source.cityCode] : []))),
])
function cityLabel(code: string | null | undefined) {
  if (!code) return ''
  return (
    cities.value.find((city) => city.code === code)?.name ||
    (code === detail.value?.record.data.cityCode ? detail.value.record.data.cityName || '' : '')
  )
}
const expenseCityName = computed(() => {
  if (expenseCityCodes.value.length > 1) return '按关联单据分摊'
  if (props.readonly) return detail.value?.record.data.cityName || '-'
  const code = expenseCityCodes.value[0]
  return (
    cityLabel(code) ||
    (code
      ? '按关联单据带出'
      : form.value.transportType === 'TRANSFER'
        ? '关联调拨单后带出'
        : '关联销售订单后带出')
  )
})
const businessHistory = computed(() =>
  history.value.filter((row) => row.action !== 'STATE_UPGRADE'),
)
const picker = ref(false),
  loading = ref(false),
  saving = ref(false),
  error = ref(''),
  senderTouched = ref(!!detail.value)
function addBillItem() {
  form.value.manualBillItems ||= []
  const first = form.value.manualBillItems.length === 0
  form.value.manualBillItems.push({
    name: first && form.value.amount != null ? '基础运费' : '',
    amount: first ? form.value.amount : null,
  })
}
function changeAmount(value: number | null | undefined) {
  try {
    if (form.value.manualBillItems?.length)
      form.value.manualBillItems = adjustManualBillTotal(form.value.manualBillItems, value ?? null)
    form.value.amount = value ?? null
    error.value = ''
  } catch (e) {
    amountInput.value = form.value.amount
    error.value = e instanceof Error ? e.message : '请核对费用明细'
  }
}
function useTotalOnly() {
  form.value.manualBillItems = []
}
const billSummary = computed(() => {
  const items = form.value.manualBillItems || []
  const total = manualBillTotal(items)
  if (total == null) return { charges: null, deductions: null, total }
  const charges = items.reduce(
    (sum, item) => sum + Math.max(0, Math.round(manualBillAmount(item)! * 100)),
    0,
  )
  const deductions = items.reduce(
    (sum, item) => sum + Math.min(0, Math.round(manualBillAmount(item)! * 100)),
    0,
  )
  return { charges: charges / 100, deductions: deductions / 100, total }
})
watch(
  () => form.value.manualBillItems,
  (items) => {
    if (!props.readonly && !platform.value && !advanced.value && items?.length)
      form.value.amount = manualBillTotal(items)
  },
  { deep: true },
)
const billMetrics = computed(() => [
  { label: '运输费用总额（元）', value: form.value.amount },
  ...(platform.value
    ? [
        { label: '已支付（元）', value: order.value?.paidAmount },
        { label: '未支付（元）', value: order.value?.facts?.unpaidAmount },
        { label: '退款（元）', value: order.value?.facts?.refundAmount },
      ]
    : [
        {
          label: '费用小计（元）',
          value: form.value.manualBillItems?.length ? billSummary.value.charges : form.value.amount,
        },
        {
          label: '优惠及减免（元）',
          value: form.value.manualBillItems?.length
            ? Math.abs(billSummary.value.deductions ?? 0)
            : 0,
        },
      ]),
])
const hadLinks = !!form.value.orderCodes.length
const attachmentDrafts = ref<CostAttachmentDraft[]>([])
const attachmentBusy = ref(false),
  attachmentCount = ref(0)
const evidenceSession = new TransportEvidenceSaveSession()
const allocations = computed(() => {
  const sources = advanced.value
    ? advancedData.value?.ledger?.sources
    : detail.value?.record.data.ledger?.sources
  let rows
  if (props.readonly && detail.value) rows = savedTransportAllocations(detail.value, selected.value)
  else if (advanced.value && sources?.length)
    rows = sources
      .filter((s) => s.orderCode)
      .map((s) => ({
        code: s.orderCode!,
        amount:
          form.value.amount == null
            ? null
            : s.allocations.reduce((sum, a) => sum + Number(a.amount), 0),
      }))
  else
    rows = transportAllocations(
      form.value.amount,
      form.value.orderCodes,
      selected.value,
      form.value.orderAllocations,
    )
  return rows.map((row) => ({
    ...row,
    source: selected.value.find((s) => s.documentNo === row.code),
  }))
})
const weightedAvailable = computed(() => canWeightSales(form.value.orderCodes, selected.value))
const allocationProblem = computed(() =>
  allocationError(form.value.amount, form.value.orderCodes, form.value.orderAllocations),
)
const allocationTotal = computed(() =>
  allocations.value.some((r) => r.amount == null)
    ? null
    : allocations.value.reduce((sum, r) => sum + Math.round(r.amount! * 100), 0) / 100,
)
function setAllocation(code: string, amount: number | null) {
  form.value.orderAllocations = {
    ...Object.fromEntries(allocations.value.map((r) => [r.code, r.amount])),
    [code]: amount,
  }
}
function reallocate(mode: 'AMOUNT' | 'EQUAL') {
  form.value.orderAllocations = Object.fromEntries(
    transportAllocations(
      form.value.amount,
      form.value.orderCodes,
      mode === 'AMOUNT' ? selected.value : [],
    ).map((r) => [r.code, r.amount]),
  )
}
watch(
  () => form.value.orderCodes.join('|'),
  () => {
    if (!props.readonly) form.value.orderAllocations = null
  },
)
watch(
  () => form.value.amount,
  (amount) => {
    if (
      !props.readonly &&
      !advanced.value &&
      form.value.orderCodes.length === 1 &&
      form.value.orderAllocations
    )
      form.value.orderAllocations = { [form.value.orderCodes[0]!]: amount }
  },
)
const warehouseName = computed(
  () =>
    detail.value?.record.warehouseName ||
    (form.value.warehouseCode ? form.value.senderName || form.value.warehouseCode : '-'),
)
const platformSenders = computed(() => order.value?.facts?.stops.slice(0, 1) || [])
const receivers = computed(() =>
  platform.value
    ? order.value?.facts?.stops.slice(1) || []
    : (props.readonly || shippingLocked.value) && detail.value
      ? frozenTransportReceivers(detail.value.record)
      : (form.value.receivingPoints || []).map((p) => ({
          name: p.manualName || p.displayName,
          contactName: p.contactName,
          contactPhone: p.phone,
          address: p.address,
        })),
)
const allReceivers = ref(false)
const visibleReceivers = computed(() =>
  !allReceivers.value ? receivers.value.slice(0, 2) : receivers.value,
)
const route = computed(() => ({
  origin: platform.value
    ? platformSenders.value[0]
      ? {
          name: platformSenders.value[0].name || platformSenders.value[0].address || '-',
          address: platformSenders.value[0].address,
        }
      : null
    : form.value.senderName || form.value.senderAddress
      ? {
          name: form.value.senderName || form.value.senderAddress || '-',
          address: form.value.senderAddress || '',
        }
      : null,
  receivers: receivers.value.map((p) => ({
    name: p.name || p.address || '-',
    address: p.address || '',
  })),
}))
const paymentName = computed(() =>
  order.value
    ? platformPaymentStatus(order.value)
    : costLabel('COST_PAYMENT_STATUS', form.value.paymentStatusCode),
)
const ownerOptions = computed<CostEmployee[]>(() => {
  const code = form.value.ownerEmployeeCode
  if (!code || employees.value.some((employee) => employee.employeeCode === code))
    return employees.value
  const source = selected.value.find((item) => item.employeeCode === code)
  const savedName =
    detail.value?.record.data.ownerEmployeeCode === code
      ? detail.value.record.ownerEmployeeName
      : null
  return [
    ...employees.value,
    {
      employeeCode: code,
      employeeName: savedName || source?.employeeName || '负责人待核对',
      departmentId: null,
      departmentName: source?.departmentName || null,
    },
  ]
})
const ownerName = computed(
  () =>
    ownerOptions.value.find((employee) => employee.employeeCode === form.value.ownerEmployeeCode)
      ?.employeeName || '-',
)
const Info = defineComponent({
  props: {
    label: String,
    value: { type: [String, Number] as PropType<string | number | null>, default: null },
  },
  setup(p) {
    return () =>
      h('div', { class: 'info-field' }, [
        h('span', p.label),
        h('div', p.value == null || p.value === '' ? '-' : String(p.value)),
      ])
  },
})
function close(done?: () => void) {
  if (saving.value) return
  if (done) done()
  else visible.value = false
}
function deliveryModeChanged(value: string) {
  if (value !== 'SELF') return
  form.value.carrierCode = null
  form.value.trackingNo = null
  form.value.platformOrderNo = null
  delete fieldErrors.value.carrierCode
  delete fieldErrors.value.platformOrderNo
}
function typeChanged() {
  selected.value = []
  form.value.orderCodes = []
  form.value.receivingPoints = []
  form.value.cityCode = ''
}
function removeOrder(code: string) {
  const snapshot = receiverSnapshot()
  selected.value = selected.value.filter((s) => s.documentNo !== code)
  form.value.orderCodes = form.value.orderCodes.filter((c) => c !== code)
  updateReceiverDrafts(snapshot)
}
function receiverSnapshot() {
  return new Map(
    form.value.orderCodes.map((code, index) => [
      code,
      form.value.receivingPoints?.find((p) => p.pointCode === `TO${index}`),
    ]),
  )
}
function updateReceiverDrafts(snapshot = receiverSnapshot()) {
  selected.value.sort((a, b) => a.documentNo.localeCompare(b.documentNo))
  form.value.orderCodes = selected.value.map((source) => source.documentNo)
  if (orderBasedCity.value) form.value.cityCode = selected.value[0]?.cityCode || ''
  form.value.receivingPoints = selected.value.map((source, index) => {
    const saved = snapshot.get(source.documentNo)
    return {
      pointCode: `TO${index}`,
      partyTypeCode:
        source.sourceType === 'TRANSFER_ORDER'
          ? 'WAREHOUSE'
          : source.sourceType === 'SALES_ORDER'
            ? 'CUSTOMER'
            : 'OTHER',
      partyCode: source.receiverCode || null,
      manualName: saved?.manualName ?? saved?.displayName ?? source.receiverName,
      displayName: saved?.displayName ?? source.receiverName,
      contactName: saved?.contactName ?? source.contactName ?? '',
      phone: saved?.phone ?? source.contactPhone ?? '',
      address: saved?.address ?? source.destinationAddress ?? '',
      cityCode: source.cityCode || '',
    }
  })
}
async function selectWarehouse(w: LedgerPartyReference | null) {
  senderTouched.value = true
  if (!w) return
  Object.assign(form.value, {
    warehouseCode: w.code,
    senderName: w.name,
    senderContact: w.contactName || '',
    senderPhone: w.phone || '',
    senderAddress: w.address || '',
  })
  if (!orderBasedCity.value && !form.value.cityCode) form.value.cityCode = w.cityCode || ''
}
async function addOrders(rows: PickedLedgerSource[]) {
  const snapshot = receiverSnapshot()
  selected.value.push(...rows.filter((r) => !form.value.orderCodes.includes(r.documentNo)))
  form.value.orderCodes = selected.value.map((r) => r.documentNo)
  updateReceiverDrafts(snapshot)
  if (!form.value.cityCode) form.value.cityCode = selected.value[0]?.cityCode || ''
  if (!platform.value && !senderTouched.value) {
    const codes = new Set(selected.value.map((s) => s.senderCode))
    if (codes.size === 1 && selected.value.every((s) => !!s.senderCode)) {
      const code = selected.value[0]!.senderCode
      const found = await getLedgerParties(true, 'WAREHOUSE', { code })
      if (found[0]) {
        await selectWarehouse(found[0])
        senderTouched.value = false
      }
    }
  }
}
onMounted(async () => {
  const dictionaries = ['COST_DELIVERY_MODE', 'COST_CARRIER']
  if (!platform.value) {
    dictionaries.push('COST_PAYMENT_STATUS')
    if (!props.readonly || (advanced.value && advancedData.value?.ledger?.feeItems.length))
      dictionaries.push('COST_LOGISTICS_FEE_TYPE')
  }
  if (transportChannel.value) dictionaries.push('COST_TRANSPORT_KIND')
  void loadCostDictionaryCodes(dictionaries, false, 'inline')
  const frozen = detail.value ? frozenTransportSources(detail.value.record) : []
  selected.value = props.salesSource && !detail.value ? [props.salesSource] : frozen
  if (!props.readonly && !shippingLocked.value) updateReceiverDrafts()
  if (!props.readonly || form.value.ownerEmployeeCode || order.value?.facts?.mappedEmployeeCode)
    void getCostEmployees('logistics')
      .then((rows) => {
        employees.value = rows
      })
      .catch(() => {
        error.value = '费用负责人加载失败，请稍后重试'
      })
  if (!props.readonly || expenseCityCodes.value.length > 1)
    void getCostCities(props.readonly ? 'order:logistics-cost:read' : 'order:logistics-cost:write')
      .then((rows) => {
        cities.value = rows
      })
      .catch(() => {
        error.value = '城市资料加载失败，请稍后重试'
      })
  if (detail.value)
    void getCostHistory('logistics', detail.value.record.id)
      .then((rows) => {
        history.value = rows
      })
      .catch(() => {
        error.value = '操作记录加载失败，请稍后重试'
      })
  if (props.salesSource && !detail.value && props.salesSource.senderCode) {
    loading.value = true
    try {
      const rows = await getLedgerParties(true, 'WAREHOUSE', { code: props.salesSource.senderCode })
      if (rows[0]) await selectWarehouse(rows[0])
    } catch (e) {
      error.value = errorMessage(e, '发货仓库加载失败，请选择实际发货仓库')
    } finally {
      loading.value = false
    }
  }
})
function focusInitialSection() {
  const section = props.initialSection
  const sections = { orders: ordersSection, fees: feesSection, evidence: evidenceSection }
  if (section === 'orders' || section === 'fees' || section === 'evidence')
    sections[section].value?.scrollIntoView?.({ block: 'start' })
  if (props.initialSection === 'orders' && !props.readonly && !props.salesOrderId)
    picker.value = true
}
async function save() {
  if (saving.value || loading.value || attachmentBusy.value) return
  error.value = ''
  fieldErrors.value =
    !shippingLocked.value && !advanced.value ? validateManualTransport(form.value) : {}
  if (Object.keys(fieldErrors.value).length) {
    error.value = Object.values(fieldErrors.value)[0]!
    if (Object.keys(fieldErrors.value).some((key) => key.startsWith('receivingPoints.')))
      allReceivers.value = true
    return
  }
  if (!advanced.value && allocationProblem.value) {
    error.value = allocationProblem.value
    return
  }
  if (!form.value.transportType && !platform.value) {
    error.value = '请选择运输类型'
    return
  }
  if (
    !form.value.date ||
    (!platform.value &&
      !shipmentSources.value.length &&
      form.value.deliveryModeCode !== 'SELF' &&
      !form.value.carrierCode)
  ) {
    error.value = '请选择运输日期和物流公司'
    return
  }
  if (!platform.value && !form.value.orderCodes.length) {
    error.value = '请选择关联业务订单'
    return
  }
  if (
    !platform.value &&
    form.value.manualBillItems?.length &&
    (form.value.manualBillItems.some((item) => !item.name.trim() || item.name.length > 100) ||
      manualBillTotal(form.value.manualBillItems) == null ||
      manualBillTotal(form.value.manualBillItems)! < 0)
  ) {
    error.value = '请填写每项费用名称和金额，优惠后合计不能小于0'
    return
  }
  if (form.value.amount === 0 && !form.value.zeroReason.trim()) {
    error.value = '请填写零元原因'
    return
  }
  if (!platform.value && attachmentCount.value < 1) {
    error.value = '手工运输记录至少上传一份业务凭证'
    return
  }
  saving.value = true
  try {
    const advancedCommand =
      advanced.value && advancedData.value
        ? {
            ...advancedData.value,
            revision: detail.value!.record.revision,
            costDate: form.value.date,
            ownerEmployeeCode: form.value.ownerEmployeeCode,
            paymentStatusCode: form.value.paymentStatusCode || 'UNKNOWN',
            ledger: advancedData.value.ledger
              ? {
                  ...advancedData.value.ledger,
                  carrierCode: form.value.carrierCode,
                  trackingNo: form.value.trackingNo || '',
                  platformOrderNo: form.value.platformOrderNo || null,
                  shippingTime: form.value.shippingTime,
                  ...(shippingLocked.value
                    ? {}
                    : {
                        receivingMethodCode: form.value.receivingMethodCode,
                        deliveryModeCode:
                          form.value.deliveryModeCode || advancedData.value.ledger.deliveryModeCode,
                      }),
                }
              : null,
            remark: form.value.remark,
            reason: form.value.reason,
            amount: advancedData.value.ledger!.feeItems.some((f) => f.ourAmount == null)
              ? null
              : advancedData.value.ledger!.feeItems.reduce(
                  (sum, f) => sum + Number(f.ourAmount),
                  0,
                ),
          }
        : null
    const result = await evidenceSession.save(
      detail.value?.record.id || null,
      {
        ...form.value,
        manualBillItems: form.value.manualBillItems?.map((item) => ({
          ...item,
          amount: manualBillAmount(item),
        })),
        revision: detail.value?.record.revision ?? null,
      },
      advancedCommand,
      attachmentDrafts.value,
      props.salesOrderId,
    )
    detail.value = result
    form.value.revision = result.record.revision
    ElMessage.success('运输记录已保存')
    emit('saved')
    visible.value = false
  } catch (e) {
    error.value = errorMessage(e, '保存失败，请核对后重试')
  } finally {
    saving.value = false
  }
}
</script>
<style scoped>
:global(.transport-dialog.el-dialog),
:global(.transport-allocation-dialog.el-dialog) {
  display: flex;
  flex-direction: column;
  max-height: 94dvh;
  overflow: hidden;
}
:global(.transport-dialog > .el-dialog__body) {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
:global(.transport-allocation-dialog > .el-dialog__body) {
  min-height: 0;
  overflow: auto;
}
:global(.transport-dialog > .el-dialog__header),
:global(.transport-dialog > .el-dialog__footer),
:global(.transport-allocation-dialog > .el-dialog__header),
:global(.transport-allocation-dialog > .el-dialog__footer) {
  flex-shrink: 0;
}

.heading-label {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-bottom: 5px;
}
.record-heading > div:first-child {
  min-width: 0;
  display: grid;
  justify-items: start;
  gap: 5px;
}
.heading-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.transport-content {
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  container: transport-record / inline-size;
  background: var(--el-fill-color-lighter);
  padding: 16px;
}
.record-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: space-between;
  align-items: center;
  padding: 0 4px 18px;
}
.record-heading strong {
  font-size: 20px;
  overflow-wrap: anywhere;
}
.transport-section {
  min-width: 0;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
}
.bill-heading {
  margin-top: 18px;
}
.optional-label {
  color: var(--el-text-color-secondary);
  font-weight: normal;
}
.shipment-source-tag {
  margin-inline-start: 6px;
}
h3 {
  margin: 0 0 22px;
  font-size: 16px;
}
h4 {
  margin: 20px 0 16px;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}
.section-heading h3 {
  margin: 0;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 24px;
}
.manual-bill-summary {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.bill-summary {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 12px 28px;
  padding: 16px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-top: 0;
}
.bill-summary > span {
  white-space: nowrap;
}
.bill-hint {
  margin: 10px 0 0;
}
.form-grid :deep(.el-form-item__content) > .optional-label {
  flex-basis: 100%;
}
.wide {
  grid-column: 1/-1;
}
.form-grid > *,
.form-grid :deep(.el-form-item__content) {
  min-width: 0;
}
.form-grid :deep(.el-select),
.form-grid :deep(.el-input-number),
.form-grid :deep(.el-date-editor) {
  width: 100%;
}
.address-card {
  padding: 16px 0;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}
.address-card:last-of-type {
  border-bottom: 0;
}
.address-card > .form-grid {
  margin-top: 18px;
}
:deep(.info-field) > span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-bottom: 8px;
}
:deep(.el-form-item__content) > span,
:deep(.el-form-item__content) > strong {
  overflow-wrap: anywhere;
  line-height: 1.7;
}
:deep(.info-field) > div {
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.empty-text {
  color: var(--el-text-color-secondary);
}
.remark {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.platform-remark {
  padding: 16px;
  margin-bottom: 18px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}
.platform-remark h4,
.platform-remark p {
  margin: 0;
}
.platform-remark p {
  margin-top: 12px;
}
.platform-remark .section-heading {
  justify-content: flex-start;
}
.change-reason {
  margin-top: 20px;
}
.amount {
  font-size: 20px;
  font-weight: 600;
}
@container transport-record (max-width: 1000px) {
  .form-grid,
  .manual-bill-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container transport-record (max-width: 600px) {
  .form-grid,
  .manual-bill-summary {
    grid-template-columns: 1fr;
  }
  .transport-section {
    padding: 16px;
  }
}

.overview-route {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 18px;
  border-top: 1px solid var(--el-border-color-extra-light);
  padding-top: 20px;
  margin-top: 20px;
  align-items: start;
}
.overview-route > span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.overview-route :deep(.route-stop) {
  -webkit-line-clamp: 1;
}
.receiver-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.receiver-grid .address-card {
  padding: 16px;
  border: 1px solid var(--el-border-color-extra-light);
  border-radius: 6px;
  min-width: 0;
}
.receiver-grid .form-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.receivers-toggle {
  margin-top: 16px;
}
.allocation-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin: 16px 0 8px;
}
.allocation-total {
  text-align: right;
  margin: 8px 0;
  font-variant-numeric: tabular-nums;
}
@container transport-record (max-width: 900px) {
  .receiver-grid {
    grid-template-columns: 1fr;
  }
}
@container transport-record (max-width: 600px) {
  .receiver-grid,
  .receiver-grid .form-grid {
    grid-template-columns: 1fr;
  }
  .overview-route {
    grid-template-columns: 1fr;
  }
}
</style>
