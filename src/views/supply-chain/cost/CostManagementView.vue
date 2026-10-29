<template>
  <div class="supply-page supply-page--list supply-page--filtered-list cost-page">
    <div class="page-heading">
      <div class="cost-heading-context">
        <SupplyPageTitle>{{ title }}</SupplyPageTitle>
        <SupplyFilterTabs
          v-if="category === 'logistics'"
          class="cost-transport-segments"
          :model-value="filters.typeCode"
          label="按运输环节查看运费"
          :items="transportSegments"
          @update:model-value="filterLeg"
        />
      </div>
      <div class="heading-actions">
        <el-button
          v-if="category === 'expenses' && can('hr:expense:write')"
          @click="expenseBatchVisible = true"
          >批量录入</el-button
        >
        <el-button v-if="can(permission + ':write')" type="primary" @click="edit()"
          >新增{{ title }}</el-button
        >
      </div>
    </div>
    <CostExpenseBatch
      v-if="category === 'expenses'"
      v-model="expenseBatchVisible"
      :employees="employees"
      @saved="load"
    />
    <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
    <SupplyListFilters compact :loading="loading" @search="search" @reset="reset">
      <el-form-item label="费用单号"
        ><el-input
          v-model="filters.documentNo"
          clearable
          placeholder="请输入费用单号"
          aria-label="费用单号"
      /></el-form-item>
      <el-form-item v-if="filterFields.has('title')" label="费用事项"
        ><el-input
          v-model="filters.title"
          clearable
          placeholder="请输入费用事项"
          aria-label="费用事项"
      /></el-form-item>
      <el-form-item v-if="filterFields.has('productName')" label="商品名称"
        ><el-input
          v-model="filters.productName"
          clearable
          placeholder="请输入商品名称"
          aria-label="成本商品名称"
      /></el-form-item>
      <el-form-item v-if="filterFields.has('specification')" label="规格"
        ><el-input
          v-model="filters.specification"
          clearable
          placeholder="请输入规格"
          aria-label="成本商品规格"
      /></el-form-item>
      <el-form-item
        v-if="filterFields.has('objectName')"
        :label="category === 'office-rentals' ? '办公室名称' : '仓库名称'"
        ><el-input
          v-model="filters.objectName"
          clearable
          placeholder="请输入场地名称"
          aria-label="场地名称筛选"
      /></el-form-item>
      <el-form-item v-if="filterFields.has('supplierName')" label="供应商"
        ><el-input
          v-model="filters.supplierName"
          clearable
          placeholder="请输入供应商名称"
          aria-label="供应商"
      /></el-form-item>
      <el-form-item v-if="filterFields.has('warehouseId')" label="所属仓库"
        ><el-select
          v-model="filters.warehouseId"
          filterable
          clearable
          placeholder="全部仓库"
          aria-label="所属仓库"
          ><el-option
            v-for="w in warehouses"
            :key="w.value"
            :label="w.label"
            :value="w.value" /></el-select
      ></el-form-item>
      <el-form-item v-if="filterFields.has('trackingNo')" label="运单号"
        ><el-input
          v-model="filters.trackingNo"
          clearable
          placeholder="请输入运单号"
          aria-label="运单号"
      /></el-form-item>
      <el-form-item v-if="filterFields.has('senderName')" label="发货方"
        ><el-input
          v-model="filters.senderName"
          clearable
          placeholder="请输入发货方"
          aria-label="发货方筛选"
      /></el-form-item>
      <el-form-item v-if="filterFields.has('receiverName')" label="收货方"
        ><el-input
          v-model="filters.receiverName"
          clearable
          placeholder="请输入收货方"
          aria-label="收货方筛选"
      /></el-form-item>
      <el-form-item v-if="filterFields.has('carrierName')" label="承运方"
        ><el-input
          v-model="filters.carrierName"
          clearable
          placeholder="请输入承运方"
          aria-label="承运方筛选"
      /></el-form-item>
      <el-form-item v-if="filterFields.has('contractNo')" label="合同编号"
        ><el-input
          v-model="filters.contractNo"
          clearable
          placeholder="请输入合同编号"
          aria-label="租赁合同编号"
      /></el-form-item>
      <el-form-item v-if="filterFields.has('typeCode') && category !== 'logistics'" label="费用类型"
        ><CostDictSelect
          v-model="filters.typeCode"
          :code="typeDictionary"
          clearable
          placeholder="全部费用类型"
          aria-label="费用类型"
      /></el-form-item>
      <el-form-item v-if="filterFields.has('lossReason')" label="损耗原因"
        ><el-input
          v-model="filters.lossReason"
          clearable
          placeholder="请输入损耗原因"
          aria-label="损耗原因"
      /></el-form-item>
      <el-form-item v-if="filterFields.has('landlordName')" label="出租方"
        ><el-input
          v-model="filters.landlordName"
          clearable
          placeholder="请输入出租方"
          aria-label="出租方"
      /></el-form-item>
      <el-form-item v-if="filterFields.has('payeeName')" label="收款方"
        ><el-input
          v-model="filters.payeeName"
          clearable
          placeholder="请输入收款方"
          aria-label="收款方"
      /></el-form-item>
      <el-form-item label="费用归属"
        ><CostCitySelect
          v-model="filters.cityCode"
          :action="permission + ':read'"
          clearable
          placeholder="全部费用归属"
          aria-label="费用归属"
          @loaded="rememberCities"
      /></el-form-item>
      <el-form-item :label="responsibleLabel"
        ><el-select
          v-model="filters.ownerEmployeeCode"
          filterable
          clearable
          :loading="employeeLoading"
          :placeholder="'全部' + responsibleLabel"
          :aria-label="responsibleLabel + '筛选'"
          ><el-option
            v-for="e in employees"
            :key="e.employeeCode"
            :label="employeeLabel(e)"
            :value="e.employeeCode" /></el-select
      ></el-form-item>
      <el-form-item v-if="filterFields.has('costMonth')" label="费用月份"
        ><el-date-picker
          v-model="filters.costMonth"
          type="month"
          value-format="YYYY-MM"
          aria-label="费用月份"
          placeholder="选择费用月份"
      /></el-form-item>
      <el-form-item v-if="filterFields.has('dateFrom')" :label="dateLabel + '起'"
        ><el-date-picker
          v-model="filters.dateFrom"
          type="date"
          value-format="YYYY-MM-DD"
          aria-label="费用开始日期"
          placeholder="选择开始日期"
      /></el-form-item>
      <el-form-item v-if="filterFields.has('dateTo')" :label="dateLabel + '止'"
        ><el-date-picker
          v-model="filters.dateTo"
          type="date"
          value-format="YYYY-MM-DD"
          aria-label="费用截止日期"
          placeholder="选择截止日期"
      /></el-form-item>
      <el-form-item label="付款状态"
        ><CostDictSelect
          v-model="filters.paymentStatusCode"
          code="COST_PAYMENT_STATUS"
          clearable
          placeholder="全部付款状态"
          aria-label="付款状态"
      /></el-form-item>
    </SupplyListFilters>
    <el-card shadow="never" class="list-card">
      <div class="cost-list-heading">
        <SupplyFilterTabs
          :model-value="activeStage"
          label="按处理阶段查看费用"
          :items="recordStages.map((stage) => ({ value: stage.code, label: stage.label }))"
          @update:model-value="filterStage"
        />
        <div class="supply-list-actions">
          <el-button
            :disabled="loading || !page.items.length"
            :loading="exporting"
            v-if="can(permission + (category === 'expenses' ? ':read' : ':export'))"
            @click="exportPage"
            >导出</el-button
          >
          <el-button :loading="loading" @click="load">刷新</el-button>
        </div>
      </div>
      <div class="cost-summary" v-if="!loadError" aria-label="本类成本统计">
        <div class="cost-summary-card summary-registered">
          <span
            >{{ page.missingAmountCount ? '已登记金额（已知部分）' : '已登记金额' }}
            <el-tooltip
              content="按当前筛选汇总，金额不含作废记录；待补金额不按 0 元计算。"
              placement="top"
              ><span class="cost-summary-info" tabindex="0" aria-label="金额汇总口径"
                >ⓘ</span
              ></el-tooltip
            ></span
          ><strong>{{ summaryMoney(page.registeredAmount) }}</strong>
        </div>
        <div class="cost-summary-card summary-confirmed">
          <span>已确认金额</span><strong>{{ summaryMoney(page.confirmedAmount) }}</strong>
        </div>
        <div v-if="category !== 'expenses'" class="cost-summary-card summary-pending">
          <span>待补金额记录</span>
          <div class="cost-summary-value">
            <strong>{{
              page.missingAmountCount == null ? '-' : page.missingAmountCount + ' 条'
            }}</strong
            ><el-button link type="primary" :disabled="loading" @click="filterStage('MISSING')"
              >查看待补记录</el-button
            >
          </div>
        </div>
        <div v-else class="cost-summary-card summary-confirmed">
          <span>已确认且已付款</span><strong>{{ summaryMoney(page.paidAmount) }}</strong>
        </div>
        <div class="cost-summary-card summary-pending">
          <span>待确认记录</span>
          <div class="cost-summary-value">
            <strong>{{ page.pendingCount == null ? '-' : page.pendingCount + ' 条' }}</strong
            ><el-button link type="primary" :disabled="loading" @click="filterStage('DRAFT')"
              >查看待确认记录</el-button
            >
          </div>
        </div>
      </div>
      <div class="cost-table-viewport">
        <el-table
          v-loading="loading"
          :data="page.items"
          row-key="id"
          height="100%"
          border
          class="business-table supply-scroll-table"
        >
          <template #empty
            ><el-empty
              :description="
                loadError ? '加载失败' : hasAppliedFilters ? '没有符合条件的记录' : '暂无记录'
              "
              :image-size="72"
            >
              <el-button v-if="loadError" @click="load">重试</el-button>
              <el-button v-else-if="hasAppliedFilters" @click="reset">重置筛选</el-button>
              <el-button v-else-if="can(permission + ':write')" type="primary" @click="edit()"
                >新增{{ title }}</el-button
              >
            </el-empty></template
          >
          <el-table-column label="费用单号" min-width="165" fixed="left" show-overflow-tooltip
            ><template #default="{ row }"
              ><el-button
                link
                type="primary"
                class="cost-document-link"
                @click="showDetail(row as CostRecord)"
                >{{ row.documentNo }}</el-button
              ></template
            ></el-table-column
          >
          <el-table-column
            prop="data.cityName"
            label="费用归属"
            min-width="85"
            show-overflow-tooltip
            :formatter="displayCell"
          />
          <template v-if="isGoods">
            <el-table-column
              prop="data.goods.productName"
              label="商品名称"
              min-width="150"
              show-overflow-tooltip
              :formatter="displayCell"
            />
            <el-table-column
              prop="data.goods.specification"
              label="规格"
              min-width="80"
              show-overflow-tooltip
              :formatter="displayCell"
            />
          </template>
          <template v-if="category === 'logistics'">
            <el-table-column label="运输环节" min-width="125"
              ><template #default="{ row }">{{
                costLabel('COST_LOGISTICS_LEG', row.data.logistics?.legCode || row.data.typeCode)
              }}</template></el-table-column
            >
            <el-table-column label="发货方" min-width="130" show-overflow-tooltip
              ><template #default="{ row }">{{
                logisticsRoute(row.data.logistics, row.sources, '-').senderName
              }}</template></el-table-column
            >
            <el-table-column label="收货方" min-width="130" show-overflow-tooltip
              ><template #default="{ row }">{{
                logisticsRoute(row.data.logistics, row.sources, '-').receiverName
              }}</template></el-table-column
            >
          </template>
          <template v-if="isRental">
            <el-table-column
              :label="category === 'office-rentals' ? '办公室名称' : '仓库名称'"
              min-width="170"
              show-overflow-tooltip
              ><template #default="{ row }">{{
                row.warehouseName || row.data.rental?.premisesName || '-'
              }}</template></el-table-column
            >
            <el-table-column
              prop="data.costMonth"
              label="费用月份"
              width="105"
              :formatter="displayCell"
            />
          </template>
          <template v-if="category === 'marketing' || category === 'expenses'">
            <el-table-column
              prop="data.title"
              :label="category === 'expenses' ? '报销事项' : '费用事项'"
              min-width="180"
              show-overflow-tooltip
              :formatter="displayCell"
            />
            <el-table-column label="费用类型" min-width="115"
              ><template #default="{ row }">{{
                costLabel(typeDictionary, row.data.typeCode)
              }}</template></el-table-column
            >
          </template>
          <el-table-column :label="amountLabel" width="125" align="right"
            ><template #default="{ row }">{{
              costMoney(row.data.amount)
            }}</template></el-table-column
          >
          <el-table-column :label="responsibleLabel" min-width="110" show-overflow-tooltip
            ><template #default="{ row }">{{
              responsibleName(row as CostRecord)
            }}</template></el-table-column
          >
          <el-table-column
            v-if="!isRental"
            prop="data.costDate"
            :label="dateLabel"
            width="110"
            :formatter="displayCell"
          />
          <el-table-column label="付款状态" width="95"
            ><template #default="{ row }">{{
              costLabel('COST_PAYMENT_STATUS', row.data.paymentStatusCode)
            }}</template></el-table-column
          >
          <template v-if="category === 'logistics'">
            <el-table-column
              prop="data.logistics.carrierName"
              label="承运方"
              min-width="115"
              show-overflow-tooltip
              :formatter="displayCell"
            />
          </template>
          <template v-if="isRental">
            <el-table-column
              prop="data.rental.landlordName"
              label="出租方"
              min-width="140"
              show-overflow-tooltip
              :formatter="displayCell"
            />
          </template>
          <template v-if="isGoods">
            <el-table-column
              prop="data.goods.quantity"
              :label="category === 'purchases' ? '进货数量' : '损耗数量'"
              width="100"
              align="right"
              :formatter="displayCell"
            />
            <el-table-column label="单位" width="70"
              ><template #default="{ row }">{{
                costLabel('PRODUCT_UNIT', row.data.goods?.unit)
              }}</template></el-table-column
            >
            <el-table-column
              v-if="category === 'purchases'"
              label="进货单价（元）"
              width="110"
              align="right"
              ><template #default="{ row }">{{
                costMoney(row.data.goods?.unitPrice)
              }}</template></el-table-column
            >
            <el-table-column
              v-if="category === 'purchases'"
              prop="data.goods.supplierName"
              label="供应商"
              min-width="160"
              show-overflow-tooltip
              :formatter="displayCell"
            />
            <el-table-column label="所属仓库" min-width="150" show-overflow-tooltip
              ><template #default="{ row }">{{
                row.warehouseName || '-'
              }}</template></el-table-column
            >
            <el-table-column
              v-if="category === 'losses'"
              prop="data.goods.location"
              label="发生地点"
              min-width="160"
              show-overflow-tooltip
              :formatter="displayCell"
            />
            <el-table-column
              v-if="category === 'losses'"
              prop="data.goods.lossReason"
              label="损耗原因"
              min-width="180"
              show-overflow-tooltip
              :formatter="displayCell"
            />
          </template>
          <el-table-column
            v-if="category === 'logistics'"
            prop="data.logistics.trackingNo"
            label="运单号"
            min-width="170"
            show-overflow-tooltip
            :formatter="displayCell"
          />
          <el-table-column
            v-if="isRental"
            prop="data.rental.contractNo"
            label="合同编号"
            min-width="150"
            show-overflow-tooltip
            :formatter="displayCell"
          />
          <el-table-column
            v-if="isRental"
            prop="data.rental.area"
            label="面积（㎡）"
            width="110"
            align="right"
            :formatter="displayCell"
          />
          <el-table-column
            v-if="category === 'marketing'"
            prop="data.payeeName"
            label="收款方"
            min-width="150"
            show-overflow-tooltip
            :formatter="displayCell"
          />
          <el-table-column
            v-if="category === 'expenses'"
            prop="data.costMonth"
            label="费用月份"
            width="105"
            :formatter="displayCell"
          />
          <el-table-column label="确认状态" width="100" fixed="right"
            ><template #default="{ row }"
              ><el-tag
                :type="
                  row.statusCode === 'CONFIRMED'
                    ? 'success'
                    : row.statusCode === 'VOID'
                      ? 'info'
                      : 'warning'
                "
                >{{ costLabel('COST_STATUS', row.statusCode) }}</el-tag
              ></template
            ></el-table-column
          >
          <el-table-column label="操作" fixed="right" width="230" class-name="cost-action-cell"
            ><template #default="{ row }"
              ><div class="cost-row-actions">
                <el-button link type="primary" @click="showDetail(row as CostRecord)"
                  >查看</el-button
                ><el-button
                  v-if="row.statusCode !== 'VOID' && can(permission + ':write')"
                  link
                  type="primary"
                  @click="edit(row as CostRecord)"
                  >编辑</el-button
                ><el-button
                  v-if="row.statusCode === 'DRAFT' && can(permission + ':confirm')"
                  link
                  type="primary"
                  :disabled="saving || row.data.amount == null"
                  :title="row.data.amount == null ? '补齐金额后可确认' : undefined"
                  @click="transition(row as CostRecord, 'confirm')"
                  >确认</el-button
                ><el-button
                  v-if="row.statusCode !== 'VOID' && can(permission + ':void')"
                  link
                  type="danger"
                  :disabled="saving"
                  @click="transition(row as CostRecord, 'void')"
                  >作废</el-button
                ><el-button link @click="showHistory(row as CostRecord)">记录</el-button>
              </div></template
            ></el-table-column
          >
        </el-table>
      </div>
      <div class="cost-list-footer">
        <span>金额单位：元</span>
        <el-pagination
          v-show="!loadError"
          class="supply-list-pagination"
          :current-page="currentPage"
          :page-size="pageSize"
          :total="page.total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          :disabled="loading"
          @current-change="changePage"
          @size-change="changePageSize"
        /></div
    ></el-card>
    <el-dialog
      v-model="editorVisible"
      :title="(editingId ? '编辑' : '新增') + title"
      :width="category === 'expenses' ? 'min(800px, 96vw)' : 'min(1120px, 96vw)'"
      top="5vh"
      class="cost-record-dialog"
      :close-on-click-modal="false"
      destroy-on-close
      :before-close="closeEditor"
    >
      <el-alert v-if="editorError" :title="editorError" type="error" :closable="false" />
      <el-alert
        v-if="editingConfirmed"
        title="已确认费用修改后将重新进入待确认状态，请填写变更原因。"
        type="warning"
        :closable="false"
      />
      <el-form
        label-position="top"
        class="cost-editor"
        :disabled="saving"
        :inert="saving || undefined"
      >
        <h3 v-if="form.logistics || category === 'expenses'" class="cost-section-title">
          {{ form.logistics ? '运输环节与归属' : '报销事项' }}
        </h3>
        <el-form-item v-if="category === 'expenses'" label="费用事项" required
          ><el-input v-model="form.title" maxlength="200"
        /></el-form-item>
        <div v-if="form.logistics" class="cost-field-grid">
          <el-form-item label="运输环节" required
            ><CostDictSelect
              v-model="form.logistics.legCode"
              code="COST_LOGISTICS_LEG"
              @update:model-value="clearSources"
          /></el-form-item>
          <el-form-item label="费用归属" required
            ><CostCitySelect
              v-model="form.cityCode"
              :action="permission + ':write'"
              :snapshot="form.cityName"
              aria-label="费用归属"
              @loaded="rememberCities"
              @change="selectCity"
          /></el-form-item>
        </div>
        <template v-if="form.logistics">
          <CostLogisticsRoute
            v-if="selectedSources.length"
            :logistics="form.logistics"
            :sources="selectedSources"
          />
          <h3 class="cost-section-title">运输双方与来源</h3>
          <el-form-item label="来源录入方式" required
            ><el-radio-group v-model="form.logistics.entryMode" @change="changeEntryMode"
              ><el-radio-button value="NONE">直接登记（无来源单据）</el-radio-button
              ><el-radio-button value="LINKED" :disabled="form.logistics.legCode === 'TRANSFER'"
                >选择系统单据</el-radio-button
              ><el-radio-button value="MANUAL">手工补录单据</el-radio-button
              ><el-radio-button value="MIXED" :disabled="form.logistics.legCode === 'TRANSFER'"
                >混合来源／补关联</el-radio-button
              ></el-radio-group
            ></el-form-item
          >
          <el-alert
            v-if="form.logistics.entryMode === 'LINKED'"
            title="供应商、客户及仓库由所选单据带入。需要自行选择或填写运输双方时，请切换“直接登记”或“手工补录单据”。"
            type="info"
            :closable="false"
          />
          <template v-if="form.logistics.entryMode !== 'LINKED'">
            <el-alert
              v-if="form.logistics.entryMode !== 'NONE'"
              title="请按原单填写单号、日期及运输双方信息。"
              type="info"
              :closable="false"
            />
            <CostLogisticsParties
              :key="
                form.logistics.legCode +
                ':' +
                form.cityCode +
                ':' +
                form.logistics.entryMode +
                ':' +
                form.logistics.sourceIds.join(',')
              "
              v-model="form.logistics"
              :city-code="form.cityCode"
              :suppliers="supplierOptions"
              :customers="customerOptions"
              :warehouses="warehouseOptions"
              @warehouse="chooseWarehouse"
            />
            <div
              v-for="(_doc, index) in form.logistics.externalDocuments"
              :key="index"
              class="external-document"
            >
              <h4>
                外部{{ routeRoles.document }} {{ index + 1 }}
                <el-button
                  v-if="(form.logistics.externalDocuments?.length || 0) > 1"
                  link
                  type="danger"
                  @click="form.logistics.externalDocuments?.splice(index, 1)"
                  >移除</el-button
                >
              </h4>
              <CostExternalDocumentFields
                v-model="form.logistics.externalDocuments![index]!"
                :sender-label="'单据' + routeRoles.sender"
                :receiver-label="'单据' + routeRoles.receiver"
                :addresses="form.logistics.legCode === 'DELIVERY'"
              />
              <el-form-item v-if="form.logistics.entryMode === 'MIXED'" label="补关联系统单据">
                <el-select
                  v-model="_doc.linkedId"
                  clearable
                  placeholder="保留原始来源，选择已选系统单据"
                >
                  <el-option
                    v-for="source in selectedSources"
                    :key="source.id"
                    :value="source.id"
                    :label="source.documentNo + ' · ' + source.receiverName"
                  />
                </el-select>
              </el-form-item>
            </div>
            <el-button
              v-if="form.logistics.entryMode !== 'NONE'"
              :disabled="(form.logistics.externalDocuments?.length || 0) >= 100"
              @click="
                form.logistics.externalDocuments?.push(
                  newExternalDocument(
                    form.logistics.legCode,
                    form.logistics.senderName,
                    form.logistics.receiverName,
                  ),
                )
              "
              >添加外部{{ routeRoles.document }}</el-button
            >
          </template>
          <el-form-item
            v-if="form.logistics.entryMode === 'LINKED' || form.logistics.entryMode === 'MIXED'"
            :label="'关联' + routeRoles.document"
            required
          >
            <CostDocumentSelect
              v-model="form.logistics.sourceIds"
              :sources="sources"
              :cities="cities"
              :loader="loadSourcePage"
              :reset-key="
                form.logistics.legCode + ':' + form.cityCode + ':' + form.logistics.entryMode
              "
              @sources="(rows) => (sources = rows)"
              @change="selectSources"
            />
          </el-form-item>
          <template v-if="requiresDeliveryWarehouse && form.logistics.entryMode === 'LINKED'">
            <el-alert
              title="所选销售订单尚未关联仓库，请补充本次实际发货城市仓。仅记录在费用中，不修改原订单。"
              type="info"
              :closable="false"
            />
            <el-form-item label="本次发货城市仓" required>
              <CostReferenceSelect
                v-model="form.logistics.sourceWarehouseId"
                :loader="warehouseOptions"
                :snapshot="form.logistics.senderName"
                :reset-key="form.cityCode"
                placeholder="选择本次实际发货城市仓"
                @change="(r) => chooseWarehouse('source', r)"
              />
            </el-form-item>
          </template>
          <el-form-item v-if="form.logistics.entryMode === 'NONE'" label="无单原因"
            ><el-input
              v-model="form.logistics.noSourceReason"
              type="textarea"
              maxlength="500"
              placeholder="确认前需说明本次运输没有单据的原因"
          /></el-form-item>
          <el-form-item label="对象与仓库角色说明"
            ><el-input
              v-model="form.logistics.manualPartyReason"
              maxlength="500"
              placeholder="无主档或仓库类型待核对时，说明实际对象与本次运输角色"
          /></el-form-item>
          <template v-if="form.logistics.legCode === 'DELIVERY'">
            <el-form-item
              v-for="stop in form.logistics.deliveryStops"
              :key="stop.sourceId"
              :label="stop.customerName + '收货地址'"
            >
              <el-input
                v-model="stop.address"
                maxlength="500"
                placeholder="订单未提供时补录本次实际收货地址"
              />
            </el-form-item>
          </template>
          <h3 class="cost-section-title">运输费用</h3>
          <CostRecordBasics
            v-model="form"
            :date-label="dateLabel"
            :amount-label="amountLabel"
            :action="permission + ':write'"
          />
          <div class="cost-field-grid">
            <el-form-item label="承运方"
              ><el-input v-model="form.logistics.carrierName" maxlength="120" /></el-form-item
            ><el-form-item label="运单号"
              ><el-input v-model="form.logistics.trackingNo" maxlength="100"
            /></el-form-item>
            <el-form-item label="运输方式"
              ><CostDictSelect
                v-model="form.logistics.transportMethodCode"
                code="COST_TRANSPORT_METHOD" /></el-form-item
            ><el-form-item label="费用承担方"
              ><CostDictSelect v-model="form.logistics.payerCode" code="COST_PAYER"
            /></el-form-item>
          </div>
        </template>
        <el-form-item v-if="category === 'expenses'" label="费用类型" required
          ><CostDictSelect
            v-model="form.typeCode"
            :code="typeDictionary"
            placeholder="请选择费用类型"
        /></el-form-item>
        <el-form-item v-if="category === 'expenses'" label="费用归属" required
          ><CostCitySelect
            v-model="form.cityCode"
            :action="permission + ':write'"
            :snapshot="form.cityName"
            aria-label="费用归属"
            @loaded="rememberCities"
            @change="selectCity"
        /></el-form-item>
        <el-form-item v-if="category === 'expenses'" label="报销人" required>
          <CostExpenseEmployeeSelect
            v-model="form.ownerEmployeeCode"
            :city-code="form.cityCode"
            :city-name="form.cityName"
            :cost-date="form.costDate"
            :snapshot="form.ownerName || editingEmployeeName"
            :disabled="saving"
            @picked="applyExpenseEmployee"
            @loading="expenseEmployeeLoading = $event"
          />
        </el-form-item>
        <el-form-item v-if="!['expenses', 'marketing'].includes(category)" label="费用负责人">
          <el-select
            v-model="form.ownerEmployeeCode"
            clearable
            filterable
            :loading="employeeLoading"
            placeholder="请选择实际费用负责人"
            aria-label="费用负责人"
            @change="chooseResponsibleEmployee"
          >
            <el-option
              v-if="
                form.ownerEmployeeCode &&
                !employees.some((employee) => employee.employeeCode === form.ownerEmployeeCode)
              "
              :value="form.ownerEmployeeCode"
              :label="editingEmployeeName || form.ownerName || '已选负责人'"
            />
            <el-option
              v-for="employee in employees"
              :key="employee.employeeCode"
              :value="employee.employeeCode"
              :label="employeeLabel(employee)"
            />
          </el-select>
          <p v-if="employeeError" role="alert" class="field-hint">
            {{ employeeError }} <el-button link type="primary" @click="references">重试</el-button>
          </p>
        </el-form-item>
        <CostMarketingFields
          v-if="category === 'marketing'"
          v-model="form"
          :employees="employees"
          :employee-loading="employeeLoading"
          :employee-error="employeeError"
          :action="permission + ':write'"
          @city="selectCity"
          @cities="rememberCities"
          @reload-employees="references"
        />
        <CostGoodsFields
          v-if="form.goods"
          v-model="form.goods"
          v-model:amount="form.amount"
          :category="category"
          :persisted="!!editingId"
          :city-code="form.cityCode"
          :purchase-snapshot="sources[0]?.documentNo"
          :warehouse-snapshot="editingWarehouseName"
          @city="choosePurchaseCity"
          ><template #occurrence
            ><CostRecordBasics
              v-model="form"
              :date-label="dateLabel"
              :amount-label="amountLabel"
              :hide-amount="category === 'purchases'"
              show-city
              :action="permission + ':write'"
              @city="selectCity"
              @cities="rememberCities" /></template
        ></CostGoodsFields>
        <CostAttachmentEditor
          v-if="category === 'losses'"
          v-model="pendingAttachments"
          :category="category"
          :row="editorAttachmentRow"
          :disabled="saving"
          @busy="attachmentBusy = $event"
        />
        <CostRentalFields
          v-if="form.rental"
          v-model="form.rental"
          :office="category === 'office-rentals'"
          :warehouse-snapshot="editingWarehouseName"
          :warehouses="warehouseOptions"
          ><template #city
            ><el-form-item label="费用归属" required
              ><CostCitySelect
                v-model="form.cityCode"
                :action="permission + ':write'"
                :snapshot="form.cityName"
                @loaded="rememberCities"
                @change="selectCity" /></el-form-item
          ></template>
          <template #rent
            ><CostRecordBasics
              v-model="form"
              :date-label="dateLabel"
              :amount-label="amountLabel"
              month
              :action="permission + ':write'" /></template
        ></CostRentalFields>
        <CostRecordBasics
          v-if="category === 'expenses'"
          v-model="form"
          :date-label="dateLabel"
          :amount-label="amountLabel"
          :action="permission + ':write'"
          required-amount
        />
        <CostExpenseFields v-if="category === 'expenses'" v-model="form">
          <template #evidence>
            <CostAttachmentEditor
              v-model="pendingAttachments"
              :category="category"
              :row="editorAttachmentRow"
              :disabled="saving"
              @busy="attachmentBusy = $event"
            />
          </template>
        </CostExpenseFields>
        <el-collapse v-if="category !== 'expenses'"
          ><el-collapse-item title="补充信息与凭据（可选）" name="extra">
            <el-form-item v-if="category !== 'marketing'" label="费用标题"
              ><el-input v-model="form.title" maxlength="200" placeholder="留空时根据业务对象生成"
            /></el-form-item>
            <el-form-item label="付款情况"
              ><CostDictSelect
                v-model="form.paymentStatusCode"
                code="COST_PAYMENT_STATUS"
                clearable
            /></el-form-item>
            <template v-if="isRental || category === 'marketing'">
              <div v-for="(_document, index) in form.externalDocuments" :key="index">
                <CostExternalDocumentFields v-model="form.externalDocuments![index]!" evidence />
                <el-button link type="danger" @click="form.externalDocuments!.splice(index, 1)"
                  >移除凭据</el-button
                >
              </div>
              <el-button
                :disabled="(form.externalDocuments?.length || 0) >= 20"
                @click="form.externalDocuments!.push(newExternalDocument('凭据'))"
                >添加合同／外部凭据</el-button
              >
            </template>
          </el-collapse-item></el-collapse
        >
        <el-form-item v-if="category === 'expenses'" label="付款状态" required
          ><CostDictSelect v-model="form.paymentStatusCode" code="COST_PAYMENT_STATUS"
        /></el-form-item>
        <el-form-item label="备注"
          ><el-input
            v-model="form.remark"
            type="textarea"
            maxlength="1000"
            show-word-limit /></el-form-item
        ><el-form-item :label="editingId ? '变更原因' : '补充登记说明'" :required="editingConfirmed"
          ><el-input v-model="form.reason" type="textarea" maxlength="500"
        /></el-form-item> </el-form
      ><template #footer
        ><el-button @click="closeEditor(() => (editorVisible = false))">取消</el-button
        ><el-button
          type="primary"
          :loading="saving"
          :disabled="!!form.goods?.productId && !form.goods.variantId"
          @click="save"
          >保存</el-button
        ></template
      >
    </el-dialog>
    <el-drawer
      v-model="detailVisible"
      :title="title + '详情'"
      size="min(960px, 95vw)"
      class="business-detail-panel cost-detail-panel"
      ><template v-if="detail">
        <header class="business-detail-hero">
          <div>
            <span class="business-detail-kicker">{{ title }}</span>
            <h2>
              {{
                detail.data.goods?.productName ||
                detail.data.rental?.premisesName ||
                detail.data.title ||
                '费用记录'
              }}
            </h2>
          </div>
          <el-tag
            :type="
              detail.statusCode === 'CONFIRMED'
                ? 'success'
                : detail.statusCode === 'VOID'
                  ? 'info'
                  : 'warning'
            "
            >{{ costLabel('COST_STATUS', detail.statusCode) }}</el-tag
          >
        </header>
        <dl class="business-detail-summary">
          <div>
            <dt>{{ amountLabel }}</dt>
            <dd class="business-detail-amount">{{ costMoney(detail.data.amount) }}</dd>
          </div>
          <div>
            <dt>费用归属</dt>
            <dd>{{ detail.data.cityName || '-' }}</dd>
          </div>
          <div>
            <dt>付款状态</dt>
            <dd>{{ costLabel('COST_PAYMENT_STATUS', detail.data.paymentStatusCode) }}</dd>
          </div>
          <div>
            <dt>{{ responsibleLabel }}</dt>
            <dd>{{ responsibleName(detail) }}</dd>
          </div>
        </dl>
        <CostRelatedSource v-if="detail.data.expense?.relatedCost" :data="detail.data" />
        <template v-if="detail.data.logistics">
          <h3>{{ logisticsRoles(detail.data.logistics.legCode).title }}</h3>
          <el-tag>{{ costSourceLabel(detail) }}</el-tag>
          <CostLogisticsRoute :logistics="detail.data.logistics" :sources="detail.sources" />
        </template>
        <section v-for="section in detailSections" :key="section.title" class="cost-detail-section">
          <h3>{{ section.title }}</h3>
          <dl class="business-detail-fields">
            <div
              v-for="field in section.fields"
              :key="field.label"
              :class="{
                'business-detail-field-wide': ['备注', '地址', '损耗原因', '关联系统单据'].includes(
                  field.label,
                ),
              }"
            >
              <dt>{{ field.label }}</dt>
              <dd>{{ field.value }}</dd>
            </div>
          </dl>
        </section>
        <section class="cost-detail-section">
          <CostAttachments
            :category="category"
            :row="detail"
            :editable="can(permission + ':write')"
            @changed="refreshDetail"
          />
        </section>
      </template>
      <template #footer>
        <div v-if="detail" class="heading-actions">
          <el-button
            v-if="detail.statusCode !== 'VOID' && can(permission + ':write')"
            :disabled="saving"
            @click="editDetail"
            >编辑费用</el-button
          >
          <el-button
            v-if="detail.statusCode === 'DRAFT' && can(permission + ':confirm')"
            type="primary"
            :loading="saving"
            :disabled="detail.data.amount == null"
            @click="transition(detail, 'confirm')"
            >核对并确认</el-button
          >
          <el-button
            v-if="detail.statusCode !== 'VOID' && can(permission + ':void')"
            :disabled="saving"
            @click="transition(detail, 'void')"
            >作废</el-button
          >
          <el-button @click="detailVisible = false">关闭</el-button>
        </div>
      </template>
    </el-drawer>
    <el-drawer
      v-model="historyVisible"
      title="操作记录"
      class="business-detail-panel"
      size="min(700px, 95vw)"
      ><el-alert
        v-if="historyError"
        :title="historyError"
        type="error"
        :closable="false"
      /><el-timeline v-loading="historyLoading"
        ><el-timeline-item
          v-for="(item, index) in history"
          :key="index"
          :timestamp="displayDateTime(item.occurredTime)"
          ><strong>{{ auditLabel(item.action) }}</strong>
          <p>{{ item.reason || '-' }}</p>
          <p class="field-hint">操作人：{{ auditActorLabel(item.actorId) }}</p>
          <el-collapse
            ><el-collapse-item title="查看当时记录">
              <el-descriptions :column="1" border>
                <el-descriptions-item
                  v-for="field in costSnapshotFields(
                    item.snapshot ?? parseSnapshot(item.snapshotJson),
                  )"
                  :key="field.label"
                  :label="field.label"
                  >{{ field.value }}</el-descriptions-item
                >
              </el-descriptions>
            </el-collapse-item></el-collapse
          ></el-timeline-item
        ></el-timeline
      ></el-drawer
    >
  </div>
</template>
<script setup lang="ts">
import { displayBusinessLabel as costLabel } from '@/utils/business-display'
import { displayCell, displayAmount as costMoney } from '@/utils/business-display'
import { businessPageLabels } from '@/utils/business-page-labels'
import { randomId } from '@/utils/random-id'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import SupplyListFilters from '@/components/supply/SupplyListFilters.vue'
import SupplyFilterTabs from '@/components/supply/SupplyFilterTabs.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { errorMessage } from '@/api/core/error'
import { getCostCities } from '@/api/core/cost'
import {
  changeCostStatus,
  getCostEmployees,
  getCostHistory,
  getCostSources,
  getCostWarehouses,
  getCosts,
  getCostCustomers,
  getCostReferences,
  getCost,
  exportCosts,
  saveCost,
  type CostAudit,
  type CostCategory,
  type CostCommand,
  type CostEmployee,
  type CostPage,
  type CostQuery,
  type CostRecord,
  type CostSource,
  type CostWarehouse,
} from '@/api/core/cost'
import CostAttachments from './CostAttachments.vue'
import CostAttachmentEditor from './CostAttachmentEditor.vue'
import {
  CostAttachmentSaveSession,
  usesEntryAttachments,
  type CostAttachmentDraft,
} from './cost-attachment-draft'
import CostRecordBasics from './CostRecordBasics.vue'
import CostMarketingFields from './CostMarketingFields.vue'
import CostExpenseBatch from './CostExpenseBatch.vue'
import CostExpenseFields from './CostExpenseFields.vue'
import CostExpenseEmployeeSelect from './CostExpenseEmployeeSelect.vue'
import CostGoodsFields from './CostGoodsFields.vue'
import CostRelatedSource from './CostRelatedSource.vue'
import { costConfirmationGaps, costSaveGaps } from './cost-entry-review'
import CostRentalFields from './CostRentalFields.vue'
import CostCitySelect from './CostCitySelect.vue'
import CostDocumentSelect from './CostDocumentSelect.vue'
import CostReferenceSelect, { type ReferenceOption } from './CostReferenceSelect.vue'
import CostExternalDocumentFields from './CostExternalDocumentFields.vue'
import CostLogisticsRoute from './CostLogisticsRoute.vue'
import CostLogisticsParties from './CostLogisticsParties.vue'
import { logisticsLegs, logisticsRoles, logisticsRoute } from './cost-logistics'
import { costSourceLabel } from './cost-source'
import CostDictSelect from './CostDictSelect.vue'
import { loadCostDictionaries } from './cost-dictionaries'
import { exportCostRows } from './cost-export'
import {
  auditLabel,
  parseSnapshot,
  costSnapshotFields,
  costExportHeaders,
  costExportFields,
} from './cost-audit'
import { displayRecordActor as auditActorLabel } from '@/utils/business-display'
import { displayRecordDateTime as displayDateTime } from '@/utils/business-display'
const route = useRoute(),
  { can } = useSupplyPermissions()
const category = computed<CostCategory>(() =>
  route.path.endsWith('/expenses')
    ? 'expenses'
    : route.path.endsWith('/purchases')
      ? 'purchases'
      : route.path.endsWith('/losses')
        ? 'losses'
        : route.path.endsWith('/office-rentals')
          ? 'office-rentals'
          : route.path.endsWith('/warehouse-rentals')
            ? 'warehouse-rentals'
            : route.path.endsWith('/marketing')
              ? 'marketing'
              : 'logistics',
)
const titles: Record<CostCategory, string> = {
  purchases: businessPageLabels['/supply-chain/cost/purchases']!,
  losses: businessPageLabels['/supply-chain/cost/losses']!,
  logistics: businessPageLabels['/supply-chain/cost/logistics']!,
  marketing: businessPageLabels['/supply-chain/cost/marketing']!,
  'warehouse-rentals': businessPageLabels['/supply-chain/cost/warehouse-rentals']!,
  'office-rentals': businessPageLabels['/supply-chain/cost/office-rentals']!,
  expenses: businessPageLabels['/supply-chain/hr/expenses']!,
}
const title = computed(() => titles[category.value])
const permission = computed(() =>
  category.value === 'expenses'
    ? 'hr:expense'
    : category.value === 'logistics'
      ? 'order:logistics-cost'
      : 'erp:cost:' +
        (['warehouse-rentals', 'office-rentals'].includes(category.value)
          ? 'rental'
          : category.value === 'purchases'
            ? 'purchase'
            : category.value === 'losses'
              ? 'loss'
              : 'marketing'),
)
const typeDictionary = computed(() =>
  category.value === 'logistics'
    ? 'COST_LOGISTICS_LEG'
    : category.value === 'marketing'
      ? 'MARKETING_EXPENSE_TYPE'
      : category.value === 'expenses'
        ? 'REIMBURSEMENT_EXPENSE_TYPE'
        : '',
)
const isRental = computed(() => ['warehouse-rentals', 'office-rentals'].includes(category.value))
const isGoods = computed(() => category.value === 'purchases' || category.value === 'losses')
const dateLabel = computed(() =>
  category.value === 'purchases'
    ? '进货日期'
    : category.value === 'losses'
      ? '损耗日期'
      : category.value === 'logistics'
        ? '运输日期'
        : '费用日期',
)
const amountLabel = computed(() =>
  category.value === 'purchases'
    ? '进货金额（元）'
    : category.value === 'losses'
      ? '损耗金额（元）'
      : isRental.value
        ? '租赁费用（元）'
        : category.value === 'logistics'
          ? '运费（元）'
          : '费用金额（元）',
)
const summaryMoney = (amount: number | null | undefined) =>
  amount == null ? '-' : '¥' + costMoney(amount)
const recordStages = computed(() => [
  { code: '', label: '全部记录' },
  ...(category.value === 'expenses' ? [] : [{ code: 'MISSING', label: '待补金额' }]),
  { code: 'DRAFT', label: '待确认' },
  { code: 'CONFIRMED', label: '已确认' },
  { code: 'VOID', label: '已作废' },
])
const emptyFilters = () => ({
  documentNo: '',
  title: '',
  trackingNo: '',
  missingAmount: '',
  costMonth: '',
  supplierName: '',
  lossReason: '',
  payeeName: '',
  landlordName: '',
  objectName: '',
  productName: '',
  specification: '',
  senderName: '',
  receiverName: '',
  carrierName: '',
  contractNo: '',
  dateFrom: '',
  dateTo: '',
  typeCode: '',
  cityCode: '',
  statusCode: '',
  paymentStatusCode: '',
  ownerEmployeeCode: '',
  warehouseId: '',
})
const responsibleLabel = computed(() => (category.value === 'expenses' ? '报销人' : '费用负责人'))
const responsibleName = (row: CostRecord) =>
  row.ownerEmployeeName ||
  row.data.ownerName ||
  employees.value.find((employee) => employee.employeeCode === row.data.ownerEmployeeCode)
    ?.employeeName ||
  '-'
const filterFields = computed(
  () =>
    new Set([
      'documentNo',
      'cityCode',
      'ownerEmployeeCode',
      'paymentStatusCode',
      ...(isRental.value
        ? ['objectName', 'costMonth', 'contractNo', 'landlordName']
        : ['dateFrom', 'dateTo']),
      ...(isGoods.value ? ['productName', 'specification', 'warehouseId'] : []),
      ...(category.value === 'purchases' ? ['supplierName'] : []),
      ...(category.value === 'losses' ? ['lossReason'] : []),
      ...(category.value === 'marketing' ? ['payeeName'] : []),
      ...(category.value === 'logistics'
        ? ['typeCode', 'trackingNo', 'senderName', 'receiverName', 'carrierName']
        : []),
      ...(['marketing', 'expenses'].includes(category.value) ? ['title', 'typeCode'] : []),
      ...(category.value === 'expenses' ? ['costMonth'] : []),
    ]),
)
const filters = ref(emptyFilters()),
  currentPage = ref(1),
  pageSize = ref(20)
const transportSegments = [
  { value: '', label: '全部' },
  ...logisticsLegs.map((leg) => ({ value: leg.code, label: leg.title })),
]
function filterLeg(leg: string) {
  if (filters.value.typeCode === leg) return
  filters.value.typeCode = leg
  search()
}
const activeStage = computed(() =>
  filters.value.missingAmount ? 'MISSING' : filters.value.statusCode,
)
function filterStage(stage: string) {
  filters.value.missingAmount = stage === 'MISSING' ? 'true' : ''
  filters.value.statusCode = stage === 'MISSING' ? '' : stage
  search()
}
const appliedFilters = ref<Omit<CostQuery, 'begin' | 'step'>>({})
const hasAppliedFilters = computed(() => Object.keys(appliedFilters.value).length > 0)
const page = ref<CostPage>({ total: 0, begin: 0, step: 20, items: [] }),
  loading = ref(false),
  loadError = ref(''),
  saving = ref(false)
const employees = ref<CostEmployee[]>([]),
  warehouses = ref<CostWarehouse[]>([]),
  cities = ref<{ code: string; name: string }[]>([])
const employeeLoading = ref(false),
  employeeError = ref('')
let referenceVersion = 0
const expenseBatchVisible = ref(false)
const editorVisible = ref(false),
  editorError = ref(''),
  editingId = ref<string | null>(null),
  editingConfirmed = ref(false),
  editingWarehouseName = ref('')
const editingEmployeeName = ref('')
const expenseEmployeeLoading = ref(false)
const pendingAttachments = ref<CostAttachmentDraft[]>([])
const editorAttachmentRow = ref<CostRecord | null>(null)
const attachmentBusy = ref(false)
let attachmentSession = new CostAttachmentSaveSession()
function resetAttachments(row: CostRecord | null = null) {
  pendingAttachments.value = []
  editorAttachmentRow.value = row
  attachmentBusy.value = false
  attachmentSession = new CostAttachmentSaveSession()
}
const sources = ref<CostSource[]>([])
const detailVisible = ref(false),
  detail = ref<CostRecord | null>(null),
  historyVisible = ref(false),
  historyLoading = ref(false),
  historyError = ref(''),
  history = ref<CostAudit[]>([])
const detailSections = computed(() => {
  const fields = costSnapshotFields(detail.value)
  const isSource = (label: string) =>
    label === '单据来源' || label.startsWith('关联系统单据') || label.startsWith('外部单据')
  const isAudit = (label: string) =>
    ['费用单号', '录入人', '录入时间', '修改人', '修改时间'].includes(label)
  const objectFields =
    category.value === 'purchases'
      ? ['商品名称', '规格', '单位', '数量', '进货单价', '供应商', '仓库']
      : category.value === 'losses'
        ? ['商品名称', '规格', '单位', '数量', '仓库', '发生地点', '损耗原因']
        : isRental.value
          ? [
              '场地名称',
              '场地类型',
              '地址',
              '面积（㎡）',
              '费用月份',
              '出租方',
              '合同编号',
              '租赁开始日期',
              '租赁结束日期',
              '押金',
            ]
          : category.value === 'marketing'
            ? [
                '费用类型',
                '事项',
                '费用负责人',
                '收款方',
                '投放渠道',
                '活动服务开始日期',
                '活动服务结束日期',
              ]
            : detail.value?.data.logistics
              ? [
                  logisticsRoles(detail.value.data.logistics.legCode).sender,
                  logisticsRoles(detail.value.data.logistics.legCode).receiver,
                  '物流类型',
                  '承运方',
                  '运单号',
                  '起点',
                  '终点',
                  '费用承担方',
                ]
              : []
  const business = fields.filter((field) => !isSource(field.label) && !isAudit(field.label))
  const ordered = [
    ...objectFields.map(
      (label) => business.find((field) => field.label === label) ?? { label, value: '-' },
    ),
    ...business.filter((field) => !objectFields.includes(field.label)),
  ]
  return [
    { title: '业务摘要', fields: ordered },
    { title: '来源资料', fields: fields.filter((field) => isSource(field.label)) },
    { title: '系统留痕', fields: fields.filter((field) => isAudit(field.label)) },
  ].filter((section) => section.fields.length)
})
const initialEditorValue = ref('')
const dirty = computed(
  () =>
    editorVisible.value &&
    (JSON.stringify(form.value) !== initialEditorValue.value ||
      pendingAttachments.value.some((file) => file.status !== 'uploaded')),
)
async function discardChanges(): Promise<boolean> {
  if (saving.value || attachmentBusy.value) {
    ElMessage.info('正在处理费用或附件，请稍候')
    return false
  }
  if (!dirty.value) return true
  try {
    await ElMessageBox.confirm(
      attachmentSession.savedRecord
        ? '费用已保存，离开将放弃尚未保存的修改及未上传附件，确定离开？'
        : '当前录入尚未保存，确定离开？',
      '离开费用录入',
      {
        confirmButtonText: '放弃修改',
        cancelButtonText: '继续编辑',
        type: 'warning',
      },
    )
    return true
  } catch {
    return false
  }
}
async function closeEditor(done: () => void) {
  if (!saving.value && (await discardChanges())) done()
}
onBeforeRouteLeave(discardChanges)
onBeforeRouteUpdate(discardChanges)
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || saving.value || attachmentBusy.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
function blank(): CostCommand {
  return {
    requestId: randomId(),
    revision: null,
    title: '',
    typeCode: null,
    cityCode: '',
    cityName: '',
    departmentId: null,
    ownerEmployeeCode: null,
    costMonth: null,
    ownerName: '',
    payeeName: '',
    goods: isGoods.value
      ? {
          productId: null,
          variantId: null,
          productName: '',
          specification: '',
          unit: '',
          unitPrice: null,
          quantity: null,
          supplierId: null,
          supplierName: '',
          warehouseId: null,
          location: '',
          purchaseOrderId: null,
          lossReason: '',
          amountReason: '',
        }
      : null,
    marketing:
      category.value === 'marketing'
        ? { channelName: '', serviceFrom: null, serviceTo: null }
        : null,
    externalDocuments: [],
    costDate: '',
    amount: null,
    paymentStatusCode: 'UNPAID',
    logistics:
      category.value === 'logistics'
        ? {
            entryMode: defaultLogisticsEntryMode(filters.value.typeCode || 'PURCHASE'),
            senderName: '',
            receiverName: '',
            originAddress: '',
            destinationAddress: '',
            supplierId: null,
            customerId: null,
            sourceWarehouseId: null,
            targetWarehouseId: null,
            externalDocuments:
              filters.value.typeCode === 'TRANSFER' ? [newExternalDocument('TRANSFER')] : [],
            legCode: filters.value.typeCode || 'PURCHASE',
            sourceIds: [],
            voucherIds: [],
            carrierName: '',
            trackingNo: '',
            transportMethodCode: '',
            payerCode: 'COMPANY',
          }
        : null,
    rental: isRental.value
      ? {
          premisesType: category.value === 'office-rentals' ? 'OFFICE' : 'WAREHOUSE',
          premisesName: '',
          address: '',
          landlordName: '',
          warehouseId: null,
          area: null,
          contractNo: '',
          leaseFrom: '',
          leaseTo: '',
          deposit: null,
        }
      : null,
    remark: '',
    reason: '',
  }
}
const form = ref<CostCommand>(blank())
const routeRoles = computed(() => logisticsRoles(form.value.logistics?.legCode))
const selectedSources = computed(() =>
  sources.value.filter((s) => form.value.logistics?.sourceIds.includes(s.id)),
)
const requiresDeliveryWarehouse = computed(
  () =>
    form.value.logistics?.legCode === 'DELIVERY' &&
    selectedSources.value.some((s) => !s.warehouseId),
)
let requestVersion = 0
async function load() {
  const version = ++requestVersion,
    selected = category.value
  loading.value = true
  loadError.value = ''
  try {
    const result = await getCosts(selected, {
      ...appliedFilters.value,
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
    })
    if (version === requestVersion) page.value = result
  } catch (e) {
    if (version === requestVersion) {
      page.value = {
        total: 0,
        begin: 0,
        step: pageSize.value,
        items: [],
      }
      loadError.value = errorMessage(e, '费用查询失败')
    }
  } finally {
    if (version === requestVersion) loading.value = false
  }
}
function search() {
  if (
    filters.value.dateFrom &&
    filters.value.dateTo &&
    filters.value.dateFrom > filters.value.dateTo
  ) {
    ElMessage.warning('截止日期不能早于开始日期')
    return
  }
  appliedFilters.value = Object.fromEntries(
    Object.entries(filters.value)
      .map(([key, value]) => [key, value?.trim()])
      .filter(
        ([key, value]) =>
          !!value &&
          (filterFields.value.has(key as string) ||
            ['statusCode', 'missingAmount'].includes(key as string)),
      ),
  )
  if (filters.value.missingAmount) appliedFilters.value.missingAmount = true
  currentPage.value = 1
  void load()
}
function reset() {
  filters.value = emptyFilters()
  search()
}
function changePage(value: number) {
  if (currentPage.value === value) return
  currentPage.value = value
  void load()
}
function changePageSize(value: number) {
  if (pageSize.value === value) return
  pageSize.value = value
  currentPage.value = 1
  void load()
}
async function references() {
  const selected = category.value
  const version = ++referenceVersion
  employeeLoading.value = true
  employeeError.value = ''
  const results = await Promise.allSettled([
    loadCostDictionaries(selected),
    getCostCities(permission.value + ':read'),
    getCostEmployees(selected),
    ['warehouse-rentals', 'office-rentals', 'purchases', 'losses'].includes(selected)
      ? getCostWarehouses(selected)
      : Promise.resolve([]),
  ])
  if (selected !== category.value || version !== referenceVersion) return
  employeeLoading.value = false
  const [, area, people, storage] = results
  if (area.status === 'fulfilled') rememberCities(area.value)
  if (people.status === 'fulfilled') employees.value = people.value
  else employeeError.value = errorMessage(people.reason, '员工资料加载失败，请重试')
  if (storage.status === 'fulfilled') warehouses.value = storage.value
  for (const result of results)
    if (result.status === 'rejected')
      ElMessage.error(errorMessage(result.reason, '部分业务选项加载失败，请刷新重试'))
}
function rememberCities(rows: { code: string; name: string }[]) {
  cities.value = [...new Map([...cities.value, ...rows].map((row) => [row.code, row])).values()]
  const selected = rows.find((row) => row.code === form.value.cityCode)
  if (editorVisible.value && selected && !form.value.cityName) form.value.cityName = selected.name
}
function employeeLabel(e: CostEmployee) {
  return [e.employeeName, e.departmentName].filter(Boolean).join(' · ')
}
const previousLeg = ref('PURCHASE')
function edit(row?: CostRecord) {
  resetAttachments(row || null)
  editingEmployeeName.value = row?.ownerEmployeeName || ''
  editingWarehouseName.value = row?.warehouseName || ''
  editingId.value = row?.id ?? null
  editingConfirmed.value = row?.statusCode === 'CONFIRMED'
  form.value = row
    ? { ...JSON.parse(JSON.stringify(row.data)), revision: row.revision, reason: '' }
    : blank()
  sources.value = row?.sources ? [...row.sources] : []
  editorError.value = ''
  editorVisible.value = true
  if (form.value.logistics) form.value.logistics.entryMode ??= 'LINKED'
  previousLeg.value = form.value.logistics?.legCode || 'PURCHASE'
  if (form.value.rental) {
    form.value.rental.premisesType ??= form.value.rental.warehouseId ? 'WAREHOUSE' : 'UNKNOWN'
    form.value.rental.premisesName ??= row?.warehouseName || ''
  }
  if (category.value === 'marketing')
    form.value.marketing ??= { channelName: '', serviceFrom: null, serviceTo: null }
  form.value.externalDocuments ??= []
  form.value.ownerName ??= row?.ownerEmployeeName || ''
  initialEditorValue.value = JSON.stringify(form.value)
  // 子表单会初始化月份、录入方式等默认值；这些初始化不应触发“未保存修改”。
  const openedForm = form.value
  void nextTick(() => {
    if (editorVisible.value && form.value === openedForm)
      initialEditorValue.value = JSON.stringify(form.value)
  })
  void references()
}
async function clearSources() {
  const requested = form.value.logistics?.legCode
  if (
    requested !== previousLeg.value &&
    (sources.value.length || form.value.logistics?.externalDocuments?.some((doc) => doc.documentNo))
  ) {
    try {
      await ElMessageBox.confirm(
        '切换运输环节将清除当前单据、双方及地址，请确认是否继续。',
        '切换运输环节',
      )
    } catch {
      if (form.value.logistics) form.value.logistics.legCode = previousLeg.value
      return
    }
  }
  previousLeg.value = requested || 'PURCHASE'

  if (form.value.logistics) {
    form.value.logistics.sourceIds = []
    Object.assign(form.value.logistics, {
      supplierId: null,
      customerId: null,
      sourceWarehouseId: null,
      targetWarehouseId: null,
      senderName: '',
      receiverName: '',
      originAddress: '',
      destinationAddress: '',
      deliveryStops: [],
      externalDocuments: [],
    })
    form.value.logistics.entryMode = defaultLogisticsEntryMode(form.value.logistics.legCode)
    changeEntryMode()
  }
  sources.value = []
  form.value.cityCode = ''
  form.value.cityName = ''
}
const loadSourcePage = (keyword: string, begin: number) =>
  getCostSources(form.value.logistics!.legCode, keyword, form.value.cityCode || undefined, begin)
function selectSources() {
  const logistics = form.value.logistics
  if (!logistics) return
  for (const document of logistics.externalDocuments || [])
    if (document.linkedId && !logistics.sourceIds.includes(document.linkedId))
      document.linkedId = null
  const rows = sources.value.filter((s) => logistics.sourceIds.includes(s.id))
  const first = rows[0]
  if (!first) {
    logistics.deliveryStops = []
    return
  }
  const conflict = rows.find(
    (s) =>
      s.cityCode !== first.cityCode ||
      (logistics.legCode === 'DELIVERY'
        ? !!s.warehouseId &&
          rows.some((other) => !!other.warehouseId && other.warehouseId !== s.warehouseId)
        : s.warehouseId !== first.warehouseId || s.targetWarehouseId !== first.targetWarehouseId) ||
      (logistics.legCode !== 'DELIVERY' && s.senderCode !== first.senderCode),
  )
  if (conflict) {
    logistics.sourceIds = logistics.sourceIds.filter((id) => id !== conflict.id)
    ElMessage.warning(`单据 ${conflict.documentNo} 不属于同城同仓的运输，请分别登记`)
    selectSources()
    return
  }
  form.value.cityCode = first.cityCode
  form.value.cityName = cities.value.find((c) => c.code === first.cityCode)?.name || first.cityCode
  if (logistics.entryMode === 'LINKED') {
    const knownWarehouse = rows.find((s) => s.warehouseId)
    if (requiresDeliveryWarehouse.value && knownWarehouse) {
      logistics.sourceWarehouseId = knownWarehouse.warehouseId
      logistics.senderName = knownWarehouse.senderName
    } else if (!requiresDeliveryWarehouse.value) {
      logistics.sourceWarehouseId = null
      logistics.senderName = ''
    }
  }
  if (logistics.entryMode === 'MIXED') {
    if (logistics.legCode === 'PURCHASE' && first.senderName !== logistics.senderName)
      logistics.supplierId = null
    if (first.senderName) logistics.senderName = first.senderName
    if (logistics.legCode !== 'DELIVERY') logistics.receiverName = first.receiverName
    if (first.warehouseId) logistics.sourceWarehouseId = first.warehouseId
    logistics.targetWarehouseId = logistics.legCode === 'DELIVERY' ? null : first.targetWarehouseId
    logistics.originAddress ||= first.originAddress || ''
    logistics.destinationAddress ||= first.destinationAddress || ''
  }
  if (logistics.legCode === 'DELIVERY')
    logistics.deliveryStops = rows.map((source) => ({
      sourceId: source.id,
      customerName: source.receiverName,
      address:
        logistics.deliveryStops?.find((stop) => stop.sourceId === source.id)?.address ||
        source.destinationAddress ||
        '',
    }))
}
function selectCity() {
  if (
    !!form.value.logistics &&
    selectedSources.value.some((s) => s.cityCode !== form.value.cityCode)
  ) {
    form.value.logistics!.sourceIds = []
    form.value.logistics!.deliveryStops = []
    if (form.value.logistics!.entryMode === 'LINKED') {
      form.value.logistics!.sourceWarehouseId = null
      form.value.logistics!.senderName = ''
    }
    for (const document of form.value.logistics!.externalDocuments || []) document.linkedId = null
    sources.value = []
    ElMessage.info('城市已变更，请重新关联对应城市的单据')
  }
  form.value.cityName = cities.value.find((c) => c.code === form.value.cityCode)?.name ?? ''
  if (form.value.logistics && form.value.logistics.customerId) {
    form.value.logistics.customerId = null
    form.value.logistics.receiverName = ''
  }
}
function chooseResponsibleEmployee(code: string | null) {
  applyExpenseEmployee(employees.value.find((employee) => employee.employeeCode === code) || null)
}
function applyExpenseEmployee(employee: CostEmployee | null) {
  form.value.ownerName = employee?.employeeName || ''
  form.value.departmentId = employee?.departmentId ?? null
}
async function save() {
  if (saving.value) return
  if (attachmentBusy.value || expenseEmployeeLoading.value) {
    ElMessage.info('正在读取员工或附件，请稍候再保存')
    return
  }
  const gaps = costSaveGaps(category.value, form.value)
  if (gaps.length) {
    editorError.value = '请补充：' + gaps.join('、')
    ElMessage.warning(editorError.value)
    return
  }
  if (!form.value.title.trim() && category.value !== 'marketing' && category.value !== 'expenses')
    form.value.title = form.value.goods?.productName
      ? `${title.value} · ${form.value.goods.productName}`
      : form.value.rental?.premisesName
        ? `${title.value} · ${form.value.rental.premisesName}`
        : form.value.logistics
          ? `${routeRoles.value.title}运费`
          : title.value
  saving.value = true
  editorError.value = ''
  try {
    if (
      !isRental.value &&
      !(
        category.value === 'expenses' &&
        ['OFFICE_RENT', 'NETWORK'].includes(form.value.typeCode || '')
      )
    )
      form.value.costMonth = form.value.costDate.slice(0, 7)
    if (form.value.rental) form.value.typeCode = form.value.rental.premisesType || 'WAREHOUSE'
    if (category.value === 'losses' && form.value.goods && !form.value.reason?.trim()) {
      const goods = form.value.goods
      const matches = await getCosts('losses', {
        begin: 0,
        step: 200,
        cityCode: form.value.cityCode,
        dateFrom: form.value.costDate,
        dateTo: form.value.costDate,
        objectName: goods.productName,
      })
      const duplicates = matches.items.filter(
        (row) =>
          row.id !== editingId.value &&
          row.statusCode !== 'VOID' &&
          row.data.goods?.productName === goods.productName &&
          row.data.goods?.unit === goods.unit &&
          (row.data.goods?.specification || '') === (goods.specification || '') &&
          row.data.goods?.quantity === goods.quantity &&
          row.data.amount === form.value.amount &&
          (goods.warehouseId
            ? row.data.goods?.warehouseId === goods.warehouseId
            : row.data.goods?.location === goods.location),
      )
      if (duplicates.length) {
        try {
          const response = await ElMessageBox.prompt(
            '发现疑似重复损耗：' +
              duplicates.map((row) => row.documentNo).join('、') +
              '。如为另一笔真实损耗，请填写说明。',
            '重复登记提醒',
            { inputValidator: (value) => !!value?.trim() || '请填写补充登记说明' },
          )
          form.value.reason = response.value
        } catch {
          return
        }
      }
    }
    if (form.value.rental && !form.value.reason.trim()) {
      const current = await getCosts(category.value, {
        begin: 0,
        step: 200,
        cityCode: form.value.cityCode,
        costMonth: form.value.costMonth || undefined,
        objectName: form.value.rental.premisesName,
      })
      const duplicate = current.items.some(
        (row) =>
          row.id !== editingId.value &&
          row.statusCode !== 'VOID' &&
          row.data.rental?.premisesType === form.value.rental?.premisesType &&
          (form.value.rental?.warehouseId
            ? row.data.rental?.warehouseId === form.value.rental.warehouseId
            : row.data.rental?.premisesName === form.value.rental?.premisesName),
      )
      if (duplicate) {
        try {
          const response = await ElMessageBox.prompt(
            '同场地同月份已有费用。如为分租或补差，请说明后继续。',
            '重复登记提醒',
            {
              inputValidator: (value) => !!value?.trim() || '请填写补充登记原因',
              confirmButtonText: '保存补充记录',
              cancelButtonText: '返回检查',
            },
          )
          form.value.reason = response.value.trim()
        } catch {
          return
        }
      }
    }
    const saved = usesEntryAttachments(category.value)
      ? await attachmentSession.save(
          category.value,
          editingId.value,
          form.value,
          pendingAttachments.value,
          (row) => {
            editingId.value = row.id
            editingConfirmed.value = false
            form.value.revision = row.revision
            editorAttachmentRow.value = row
            initialEditorValue.value = JSON.stringify(form.value)
          },
        )
      : await saveCost(category.value, editingId.value, form.value)
    showDetail(saved)
    editorVisible.value = false
    ElMessage.success(pendingAttachments.value.length ? '费用及附件已保存' : '费用已保存')
    await load()
  } catch (e) {
    editorError.value = errorMessage(e, '保存失败')
    ElMessage.error(editorError.value)
    if (attachmentSession.savedRecord) await load()
  } finally {
    saving.value = false
  }
}
async function transition(row: CostRecord, action: 'confirm' | 'void') {
  if (saving.value) return
  if (action === 'confirm' && row.data.amount == null) {
    ElMessage.warning('请先补齐金额再确认')
    return
  }
  const gaps = costConfirmationGaps(category.value, row.data)
  if (action === 'confirm' && gaps.length) {
    ElMessage.warning('请先编辑补齐：' + gaps.join('、'))
    return
  }
  const required = action === 'void' || Number(row.data.amount) === 0
  let reason: string
  try {
    const answer = await ElMessageBox.prompt(
      action === 'void'
        ? '作废后不再计入有效登记金额，请填写原因。'
        : `请确认费用信息：${row.documentNo}，${row.data.cityName}，${row.data.costMonth || row.data.costDate}，${costMoney(row.data.amount)} 元。`,
      action === 'void' ? '作废费用' : '确认费用',
      {
        inputPlaceholder: required ? '必填：操作原因' : '操作说明（可选）',
        inputValidator: (value) => !required || !!value?.trim() || '请填写操作原因',
        confirmButtonText: '确定',
        cancelButtonText: '取消',
      },
    )
    reason = answer.value ?? ''
  } catch {
    return
  }
  saving.value = true
  try {
    const updated = await changeCostStatus(category.value, row, action, reason)
    if (detail.value?.id === row.id) detail.value = updated
    ElMessage.success('操作成功')
    await load()
  } catch (e) {
    ElMessage.error(errorMessage(e, '操作失败'))
  } finally {
    saving.value = false
  }
}
function showDetail(row: CostRecord) {
  detail.value = row
  detailVisible.value = true
}
async function editDetail() {
  if (!detail.value) return
  await edit(detail.value)
  if (editorVisible.value) detailVisible.value = false
}
async function refreshDetail() {
  if (!detail.value) return
  detail.value = await getCost(category.value, detail.value.id)
  await load()
}
async function showHistory(row: CostRecord) {
  historyVisible.value = true
  historyLoading.value = true
  history.value = []
  historyError.value = ''
  try {
    history.value = await getCostHistory(category.value, row.id)
  } catch (e) {
    historyError.value = errorMessage(e, '操作记录加载失败')
  } finally {
    historyLoading.value = false
  }
}
const exporting = ref(false)
async function exportPage() {
  const selected = category.value,
    name = title.value,
    query = { ...appliedFilters.value }
  exporting.value = true
  try {
    const rows: CostRecord[] = []
    let begin = 0
    let expectedTotal: number | undefined
    const ids = new Set<string>()
    while (true) {
      const result = await exportCosts(selected, { ...query, begin, step: 200 })
      if (selected !== category.value) return
      if ((expectedTotal != null && expectedTotal !== result.total) || result.total > 50000)
        throw new Error('筛选结果发生变化或超过五万条，请缩小范围后重新导出')
      expectedTotal = result.total
      for (const row of result.items) {
        if (ids.has(row.id)) throw new Error('导出期间记录发生变化，请重试')
        ids.add(row.id)
      }
      rows.push(...result.items)
      begin += result.items.length
      if (begin >= result.total) break
      if (!result.items.length || begin >= 50000)
        throw new Error('导出范围过大或结果发生变化，请缩小筛选范围后重试')
    }
    if (selected !== category.value) return
    const fields = rows.map(costExportFields)
    const headers = costExportHeaders(selected)
    await exportCostRows(
      name,
      headers,
      fields.map((f) => headers.map((h) => f.find((v) => v.label === h)?.value ?? '')),
    )
  } catch (e) {
    ElMessage.error(errorMessage(e, '导出失败'))
  } finally {
    exporting.value = false
  }
}
function changeEntryMode() {
  const logistics = form.value.logistics
  if (!logistics) return
  editorError.value = ''
  if (logistics.entryMode === 'MANUAL' || logistics.entryMode === 'NONE') {
    // 解除采购单关联时保留已核实的双方快照；供应商编码不能当作供应商 ID 使用。
    const purchase = logistics.legCode === 'PURCHASE' ? selectedSources.value[0] : undefined
    if (purchase) {
      logistics.senderName = purchase.senderName
      logistics.receiverName = purchase.receiverName
      logistics.supplierId = null
      logistics.customerId = null
      logistics.sourceWarehouseId = null
      logistics.targetWarehouseId = purchase.targetWarehouseId
      logistics.originAddress ||= purchase.originAddress || ''
      logistics.destinationAddress ||= purchase.destinationAddress || ''
    }
    logistics.sourceIds = []
    sources.value = []
    logistics.deliveryStops = []
    for (const document of logistics.externalDocuments || []) document.linkedId = null
  }
  if (editingId.value && logistics.entryMode === 'LINKED' && logistics.externalDocuments?.length) {
    logistics.entryMode = 'MIXED'
    ElMessage.info('已保存的外部来源需保留，请在混合来源中补关联')
  }
  if (logistics.entryMode === 'NONE' || logistics.entryMode === 'LINKED')
    logistics.externalDocuments = []
  else if (!logistics.externalDocuments?.length)
    logistics.externalDocuments = [
      newExternalDocument(logistics.legCode, logistics.senderName, logistics.receiverName),
    ]
  if (logistics.entryMode === 'LINKED') {
    logistics.supplierId = null
    logistics.customerId = null
    logistics.sourceWarehouseId = null
    logistics.targetWarehouseId = null
  }
  if (logistics.entryMode === 'MIXED') selectSources()
}
function defaultLogisticsEntryMode(leg: string) {
  return leg === 'PURCHASE' ? 'NONE' : leg === 'TRANSFER' ? 'MANUAL' : 'LINKED'
}
function newExternalDocument(type: string, senderName = '', receiverName = '') {
  return {
    sourceSystem: 'DHB' as const,
    documentType: type,
    documentNo: '',
    documentDate: '',
    senderName,
    receiverName,
    remark: '',
  }
}
const warehouseOptions = async (keyword: string, begin: number) =>
  begin
    ? []
    : (await getCostWarehouses(category.value, keyword)).map((w) => ({
        id: w.value,
        label: [
          w.label,
          w.warehouseTypeCode ? costLabel('WAREHOUSE_TYPE', w.warehouseTypeCode) : '',
          cities.value.find((c) => c.code === w.regionCode)?.name,
        ]
          .filter(Boolean)
          .join(' · '),
        name: w.name || w.label,
        address: w.address,
        regionCode: w.regionCode,
        warehouseTypeCode: w.warehouseTypeCode,
      }))
const supplierOptions = async (keyword: string, begin: number) =>
  (await getCostReferences('logistics', 'suppliers', keyword, null, begin)).map((r) => ({
    ...r,
    label: r.name,
  }))
const customerOptions = async (keyword: string, begin: number) =>
  form.value.cityCode
    ? (await getCostCustomers(form.value.cityCode, keyword, begin)).map((r) => ({
        ...r,
        label: r.name,
      }))
    : []
function chooseWarehouse(side: 'source' | 'target', row: ReferenceOption | null) {
  const l = form.value.logistics
  if (l && row) {
    if (side === 'source') {
      l.senderName = row.name
      if (row.address && !l.originAddress) l.originAddress = String(row.address)
      l.supplierId = null
    } else {
      l.receiverName = row.name
      if (row.address && !l.destinationAddress) l.destinationAddress = String(row.address)
      l.customerId = null
      if (
        row.warehouseTypeCode === 'CITY' &&
        row.regionCode &&
        cities.value.some((city) => city.code === row.regionCode)
      )
        choosePurchaseCity(String(row.regionCode))
    }
  }
}
function choosePurchaseCity(code: string) {
  form.value.cityCode = code
  selectCity()
  if (!form.value.cityName) form.value.cityName = code
}
watch(
  () => [form.value.logistics?.senderName, form.value.logistics?.receiverName],
  ([sender, receiver], [oldSender, oldReceiver]) => {
    for (const doc of form.value.logistics?.externalDocuments || []) {
      if (editingId.value || doc.linkedId) continue
      if (!doc.senderName || doc.senderName === oldSender) doc.senderName = sender || ''
      if (!doc.receiverName || doc.receiverName === oldReceiver) doc.receiverName = receiver || ''
    }
  },
)
watch(
  category,
  () => {
    resetAttachments()
    expenseEmployeeLoading.value = false
    editorVisible.value = false
    detailVisible.value = false
    historyVisible.value = false
    employees.value = []
    warehouses.value = []
    cities.value = []
    page.value = { total: 0, begin: 0, step: pageSize.value, items: [] }
    reset()
    void references()
  },
  { immediate: true },
)
// 看板原单入口直接复用原业务详情查询，由源接口重新校验当前权限。
watch(
  () => [category.value, route.query?.sourceId] as const,
  async ([selected, sourceId], _previous, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })
    detailVisible.value = false
    detail.value = null
    if (typeof sourceId !== 'string') return
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceId)) {
      ElMessage.error('原单标识无效')
      return
    }
    try {
      const record = await getCost(selected, sourceId)
      if (active) showDetail(record)
    } catch (reason) {
      if (active) ElMessage.error(errorMessage(reason, '原单不存在或当前无访问权限'))
    }
  },
  { immediate: true },
)
</script>
<style scoped lang="scss">
.ledger-subline {
  margin-top: 5px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.cost-heading-context {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 24px;
  min-width: 0;
}
.cost-transport-segments {
  padding: 3px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
}
.source-empty {
  padding: 14px 20px;
  max-width: 520px;
  white-space: normal;
  color: var(--el-text-color-secondary);
}
.reference-error {
  color: var(--el-color-danger);
  font-size: 12px;
}
.heading-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.cost-workflow-guide {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}
.cost-workflow-guide span {
  overflow-wrap: anywhere;
}
.page-heading p,
.field-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.cost-editor :deep(.el-select),
.full-width {
  width: 100%;
}
.full-width .el-select {
  margin-top: 8px;
}
.cost-section-title {
  font-size: 15px;
  margin: 20px 0 18px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--el-border-color-light);
}
.manual-route-fields {
  margin-top: 20px;
}
.manual-route-fields .el-input {
  margin-top: 8px;
}
.external-document {
  margin: 16px 0;
  padding: 12px 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}
.external-document h4 {
  margin: 0 0 16px;
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 12px;
}
@media (max-width: 768px) {
  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>

<style lang="scss">
.cost-record-dialog {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  padding: 0;
  .el-dialog__header {
    flex: 0 0 auto;
    margin: 0;
    padding: 20px 28px;
    border-bottom: 1px solid var(--el-border-color-light);
  }
  .el-dialog__body {
    overflow-y: auto;
    padding: 8px 28px 24px;
  }
  .el-dialog__footer {
    flex: 0 0 auto;
    padding: 16px 28px;
    border-top: 1px solid var(--el-border-color-light);
    background: var(--el-fill-color-light);
  }
  .cost-section-title {
    margin: 22px 0 16px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--el-border-color-light);
    font-size: 16px;
    font-weight: 600;
  }
  .cost-field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 24px;
  }
  .cost-field-wide {
    grid-column: 1 / -1;
  }
  .el-form-item {
    min-width: 0;
    margin-bottom: 18px;
  }
  .el-form-item__label {
    color: var(--el-text-color-regular);
    font-weight: 500;
  }
  .el-select,
  .el-input-number,
  .el-date-editor.el-input,
  .full-width {
    width: 100%;
  }
  .el-input-number .el-input__inner {
    text-align: left;
  }
  .field-hint {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 1.5;
  }
  .el-collapse {
    margin: 16px 0;
  }
  @media (max-width: 700px) {
    .cost-field-grid {
      grid-template-columns: 1fr;
    }
    .el-dialog__body {
      padding: 8px 16px 20px;
    }
  }
}
.cost-list-heading {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}
.cost-page .cost-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
  padding: 10px 14px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}
.cost-page .cost-summary-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 7px 12px;
  border: 1px solid #e2e8f0;
  border-top: 3px solid #64748b;
  border-radius: 6px;
  background: #f8fafc;
}
.cost-page .cost-summary-card > span {
  color: #64748b;
  font-size: 12px;
}
.cost-page .cost-summary-card strong {
  color: #334155;
  font-size: 20px;
  line-height: 24px;
  font-weight: 600;
}
.cost-page .summary-registered {
  border-top-color: #2563eb;
  background: #f5f8ff;
}
.cost-page .summary-registered strong {
  color: #2563eb;
}
.cost-page .summary-confirmed {
  border-top-color: #059669;
  background: #f2faf7;
}
.cost-page .summary-confirmed strong {
  color: #047857;
}
.cost-page .summary-pending {
  border-top-color: #b45309;
}
.cost-summary-value {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.cost-summary-value .el-button {
  margin: 0;
  font-size: 12px;
}
.cost-table-viewport {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.cost-list-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 14px;
  border-top: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 12px;
}
.console--supply-chain .cost-page .cost-list-footer .supply-list-pagination {
  margin: 0;
  padding: 0;
  border-top: 0;
}
.cost-row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}
.cost-row-actions .el-button + .el-button {
  margin-left: 0;
}
.cost-page .cost-action-cell .cell {
  overflow: visible;
  white-space: normal;
  text-overflow: clip;
}
.console--supply-chain .cost-page {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  > .list-card {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  > .list-card .el-card__body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 0;
  }
  .supply-list-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .supply-list-filters__form {
    grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 200px));
  }
}
@media (min-width: 1101px) and (max-height: 760px) {
  .console--supply-chain .cost-page {
    height: auto;
    min-height: 100%;
    overflow: visible;
  }
  .console--supply-chain .cost-page > .list-card {
    flex: none;
  }
  .cost-page .cost-table-viewport {
    flex: none;
    height: 280px;
  }
}
@media (max-width: 1100px), (max-height: 620px) {
  .console--supply-chain .cost-page {
    height: auto;
    min-height: 100%;
    overflow: visible;
  }
  .console--supply-chain .cost-page > .list-card {
    flex: none;
  }
  .cost-page .cost-table-viewport {
    flex: none;
    height: 380px;
  }
  .cost-list-heading,
  .cost-list-footer {
    flex-wrap: wrap;
  }
  .cost-page .cost-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.cost-document-link {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cost-detail-panel .business-detail-summary {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
@media (max-width: 700px) {
  .cost-detail-panel .business-detail-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.cost-document-link {
  display: block;
  width: 100%;
  text-align: left;
}
.cost-document-link > span {
  display: block;
  width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.cost-summary-info {
  display: inline !important;
  font-size: 12px;
  color: #94a3b8;
}
.cost-page .cost-summary-card > span {
  line-height: 18px;
}
.cost-page .cost-summary-value .el-button {
  min-height: 0;
  height: 24px;
  padding: 0;
}
@media (min-width: 1101px) and (max-width: 1500px) {
  .console--supply-chain .cost-page .supply-list-filters__form {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }
}
</style>
