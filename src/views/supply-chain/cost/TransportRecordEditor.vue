<template>
  <el-dialog
    v-model="visible"
    :title="readonly ? '运输记录详情' : detail ? '编辑运输记录' : '新增运输记录'"
    width="min(1360px, 96vw)"
    top="3vh"
    class="transport-dialog"
    :close-on-click-modal="false"
    :before-close="close"
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
        <div v-if="readonly && actionsEnabled !== false" class="heading-actions">
          <TransportRecordActions
            :record="detail.record"
            detail
            @edit="emit('edit', '')"
            @action="(action) => emit('action', action)"
          /><el-button v-if="platform && can('integration:huolala:sync')" @click="emit('sync')"
            >同步此单</el-button
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
                platform ? '货拉拉同步' : shipmentSources.length ? '订货宝同步' : '手动录入'
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
                >原记录未登记具体时间，可编辑补齐</span
              >
            </el-form-item>
            <el-form-item
              label="配送方式"
              :required="!readonly && !shippingLocked"
              :error="fieldErrors.deliveryModeCode"
            >
              <span v-if="readonly || shippingLocked">{{
                costLabel('COST_DELIVERY_MODE', form.deliveryModeCode) !== '-'
                  ? costLabel('COST_DELIVERY_MODE', form.deliveryModeCode)
                  : shipmentSources[0]?.latest.deliveryModeName || '-'
              }}</span>
              <el-select v-else v-model="form.deliveryModeCode" placeholder="请选择配送方式">
                <el-option
                  v-for="o in deliveryModes"
                  :key="o.value"
                  :label="o.label"
                  :value="o.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item
              label="物流公司"
              :required="!readonly && !shippingLocked && form.deliveryModeCode !== 'SELF'"
              :error="fieldErrors.carrierCode"
              ><span v-if="platform">货拉拉</span
              ><span v-else-if="readonly || shippingLocked">{{
                form.carrierCode
                  ? costLabel('COST_CARRIER', form.carrierCode)
                  : shipmentSources[0]?.latest.carrierName ||
                    detail?.record.data.logistics?.carrierName ||
                    '-'
              }}</span
              ><el-select v-else v-model="form.carrierCode" placeholder="请选择物流公司"
                ><el-option
                  v-for="o in carriers"
                  :key="o.value"
                  :label="o.label"
                  :value="o.value" /></el-select
            ></el-form-item>
            <el-form-item
              label="快递单号"
              :required="!readonly && !shippingLocked && form.deliveryModeCode !== 'SELF'"
              :error="fieldErrors.platformOrderNo"
              ><span v-if="readonly || shippingLocked">{{
                shipmentSources.length
                  ? shipmentSources.flatMap((s) => s.latest.trackingNumbers).join('、') || '-'
                  : form.platformOrderNo || '-'
              }}</span
              ><el-input
                v-else
                v-model="form.platformOrderNo"
                maxlength="80"
                placeholder="填写快递单号"
            /></el-form-item>
            <Info label="车型" :value="vehicleOf(platform)" />
            <Info v-if="platform" label="下单时间" :value="order?.raw['下单时间']" />
          </div>
        </section>
        <section class="transport-section">
          <div ref="ordersSection" class="section-heading">
            <h3>关联业务订单</h3>
            <el-button
              v-if="
                readonly &&
                actionsEnabled !== false &&
                detail?.record.statusCode === 'ACTIVE' &&
                can('order:logistics-cost:write')
              "
              link
              type="primary"
              @click="emit('edit', 'orders')"
              >{{ selected.length ? '更改关联' : '关联订单' }}</el-button
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
          <el-table :data="selected" border empty-text="暂未关联业务订单"
            ><el-table-column prop="documentNo" label="业务单号" min-width="205" /><el-table-column
              label="客户／收货仓库"
              min-width="180"
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
            ><el-table-column label="单据日期" width="125"
              ><template #default="{ row }">{{
                row.documentDate || '-'
              }}</template></el-table-column
            ><el-table-column label="业务订单金额（元）" align="right" min-width="160"
              ><template #default="{ row }">{{
                money(row.documentAmount)
              }}</template></el-table-column
            ><el-table-column label="关联时间" min-width="180"
              ><template #default="{ row }">{{
                row.linkedAt ? displayRecordDateTime(row.linkedAt) : '-'
              }}</template></el-table-column
            ><el-table-column
              v-if="!readonly && !advanced && !salesOrderId && !shipmentSources.length"
              label="操作"
              width="80"
              ><template #default="{ row }"
                ><el-button link type="danger" @click="removeOrder(row.documentNo)"
                  >移除</el-button
                ></template
              ></el-table-column
            ></el-table
          >
        </section>
        <section class="transport-section">
          <h3>费用信息</h3>
          <el-button
            v-if="advanced && !readonly"
            class="advanced-button"
            @click="advancedOpen = true"
            >维护费用与分摊明细</el-button
          >
          <div class="form-grid" :class="{ 'manual-bill-summary': !platform }">
            <el-form-item label="运输费用（元）" :error="fieldErrors.amount"
              ><span v-if="readonly || advanced || form.manualBillItems?.length" class="amount">{{
                money(form.amount)
              }}</span
              ><el-input-number
                v-else
                v-model="form.amount"
                :precision="2"
                :min="0"
                :max="999999999999"
                :controls="false"
                placeholder="填写本次运输费用"
              /><span v-if="!readonly && !platform" class="optional-label"
                >金额、订单归属及凭证补齐后，计入成本看板统计</span
              ></el-form-item
            ><el-form-item label="费用负责人"
              ><span v-if="readonly">{{ ownerName }}</span
              ><el-select
                v-else
                v-model="form.ownerEmployeeCode"
                clearable
                filterable
                placeholder="请选择费用负责人"
                ><el-option
                  v-for="e in employees"
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
            ><el-form-item label="计入运输成本（元）"
              ><strong>{{
                detail?.record.statusCode !== 'VOID' &&
                detail?.record.businessStatusCode === 'COMPLETE'
                  ? money(detail.record.data.amount)
                  : '-'
              }}</strong></el-form-item
            ><el-form-item label="费用归属城市"
              ><span v-if="readonly">{{
                detail?.record.data.cityName || form.cityCode || '-'
              }}</span
              ><CostCitySelect
                v-else
                v-model="form.cityCode"
                :disabled="false"
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
                v-if="!readonly && !advanced"
                link
                type="primary"
                :disabled="(form.manualBillItems?.length || 0) >= 100"
                @click="addBillItem"
                >添加费用项目</el-button
              >
            </div>
            <el-table v-if="form.manualBillItems?.length" :data="form.manualBillItems" border>
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
                  <span v-if="readonly || advanced">{{ money(row.amount) }}</span>
                  <el-input-number
                    v-else
                    v-model="row.amount"
                    :precision="2"
                    :min="-999999999999"
                    :max="999999999999"
                    :controls="false"
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
          <el-table v-if="allocations.length" :data="allocations" border
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
            view="bill"
            :record-id="detail!.record.id"
            :platform="platform"
            :confirmed="detail!.record.statusCode === 'ACTIVE'"
            :confirmed-amount="detail!.record.data.amount"
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
            <el-form-item label="本系统发货仓库"
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
        <section class="transport-section" aria-label="凭证与运输影像">
          <h3>凭证与运输影像</h3>
          <TransportPlatformBill
            v-if="platform"
            view="evidence"
            :record-id="detail!.record.id"
            :platform="platform"
            :confirmed="detail!.record.statusCode === 'ACTIVE'"
            :confirmed-amount="detail!.record.data.amount"
          />
          <TransportEvidence
            embedded
            v-model="attachmentDrafts"
            :row="detail?.record || null"
            :readonly="readonly"
            :disabled="saving"
            :required="!platform"
            hide-empty
            @busy="attachmentBusy = $event"
            @count="attachmentCount = $event"
          />
        </section>
        <section class="transport-section">
          <h3>备注</h3>
          <span v-if="readonly" class="remark">{{ form.remark || '-' }}</span
          ><el-input
            v-else
            v-model="form.remark"
            type="textarea"
            :rows="3"
            maxlength="1000"
            show-word-limit
            placeholder="填写本次运输的业务备注"
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
      <TransportShipmentSources v-if="shipmentSources.length" :sources="shipmentSources" />
      <TransportPlatformDetails
        v-if="platform"
        :platform="platform"
        :employees="employees"
        @associate-employee="emit('associate-employee')"
      />
      <section v-if="detail" class="transport-section">
        <h3>操作记录</h3>
        <el-table :data="businessHistory" border empty-text="暂无操作记录"
          ><el-table-column label="时间" min-width="190"
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
  transportTypes,
  money,
  typeName,
  statusName,
  manualBillTotal,
  frozenTransportSources,
  frozenTransportReceivers,
  vehicleOf,
  transportTimeOf,
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
import TransportPlatformBill from './TransportPlatformBill.vue'
import TransportPlatformDetails from './TransportPlatformDetails.vue'
import TransportRecordActions from './TransportRecordActions.vue'
import TransportRouteSummary from './TransportRouteSummary.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import CostLedgerEditor from './CostLedgerEditor.vue'
import { totalFees } from './cost-ledger'
import TransportEvidence from './TransportEvidence.vue'
import TransportShipmentSources from './TransportShipmentSources.vue'
import { TransportEvidenceSaveSession } from './transport-evidence'
import { type CostAttachmentDraft } from './cost-attachment-draft'
import { validateManualTransport, type TransportErrors } from './transport-validation'
import { costOptions, costLabel } from './cost-dictionaries'
import { errorMessage } from '@/api/core/error'
import { auditLabel } from './cost-audit'
import { displayRecordActor, displayRecordDateTime } from '@/utils/business-display'
const props = withDefaults(
  defineProps<{
    detail: TransportDetail | null
    readonly: boolean
    initialSection?: string
    actionsEnabled?: boolean
    salesOrderId?: string | number | null
    salesSource?: CostSource | null
    initialCarrierCode?: string | null
    initialDeliveryMode?: string
  }>(),
  { actionsEnabled: true },
)
const { can } = useSupplyPermissions()
const ordersSection = ref<HTMLElement>()
const visible = defineModel<boolean>({ required: true })
const emit = defineEmits<{
  saved: []
  edit: [section: string]
  action: [action: 'void' | 'delete']
  sync: []
  'associate-employee': []
}>()
const detail = ref(props.detail),
  platform = computed(() => detail.value?.platform)
const shipmentSources = computed(() => detail.value?.shipments || [])
const shippingLocked = computed(() => !!platform.value || !!shipmentSources.value.length)
const order = computed(() => (platform.value ? currentSource(platform.value.source) : null))
const form = ref(transportDraft(detail.value?.record, platform.value))
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
  form.value.manualBillItems.push({ name: '', amount: null })
}
watch(
  () => form.value.manualBillItems,
  (items) => {
    if (!props.readonly && !platform.value && !advanced.value && items?.length)
      form.value.amount = manualBillTotal(items)
  },
  { deep: true },
)
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
const ownerName = computed(
  () =>
    employees.value.find((e) => e.employeeCode === form.value.ownerEmployeeCode)?.employeeName ||
    detail.value?.record.ownerEmployeeName ||
    '-',
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
function typeChanged() {
  selected.value = []
  form.value.orderCodes = []
  form.value.receivingPoints = []
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
    cityCode: form.value.cityCode || w.cityCode || '',
  })
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
  if (advanced.value && !props.readonly)
    void getCostCities()
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
  if (props.initialSection === 'orders' && !props.readonly && !props.salesOrderId) {
    ordersSection.value?.scrollIntoView?.({ block: 'start' })
    picker.value = true
  }
})
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
.heading-label {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-bottom: 5px;
}
.record-heading > div:first-child {
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
  max-height: calc(88vh - 120px);
  overflow: auto;
  background: var(--el-fill-color-lighter);
  padding: 18px;
}
.record-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 4px 18px;
}
.record-heading strong {
  font-size: 20px;
  overflow-wrap: anywhere;
}
.transport-section {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 22px;
  margin-bottom: 16px;
}
.bill-heading {
  margin-top: 18px;
}
.optional-label {
  color: var(--el-text-color-secondary);
  font-weight: normal;
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
.wide {
  grid-column: 1/-1;
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
}
.change-reason {
  margin-top: 20px;
}
.amount {
  font-size: 20px;
  font-weight: 600;
}
@media (max-width: 1000px) {
  .form-grid,
  .manual-bill-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .form-grid,
  .manual-bill-summary {
    grid-template-columns: 1fr;
  }
  .transport-content {
    padding: 8px;
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
  align-items: center;
  gap: 16px;
  margin: 16px 0 8px;
}
.allocation-total {
  text-align: right;
  margin: 8px 0;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 600px) {
  .receiver-grid,
  .receiver-grid .form-grid {
    grid-template-columns: 1fr;
  }
  .overview-route {
    grid-template-columns: 1fr;
  }
}
</style>
