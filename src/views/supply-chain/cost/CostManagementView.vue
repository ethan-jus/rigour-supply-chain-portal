<template>
  <div class="supply-page supply-page--list supply-page--filtered-list cost-page">
    <div class="page-heading">
      <div>
        <SupplyPageTitle>{{ title }}</SupplyPageTitle>
        <p>{{ description }}</p>
      </div>
      <div class="heading-actions">
        <el-button :aria-expanded="advancedFilters" @click="advancedFilters = !advancedFilters">{{
          advancedFilters ? '收起筛选' : '更多筛选'
        }}</el-button>
        <el-button v-if="can(permission + ':write')" type="primary" @click="edit()"
          >新增{{ title }}</el-button
        >
      </div>
    </div>
    <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
    <div v-if="category === 'logistics'" class="logistics-segments" aria-label="按运输环节筛选">
      <button
        type="button"
        :class="{ active: !filters.typeCode }"
        :aria-pressed="!filters.typeCode"
        @click="filterLeg('')"
      >
        全部运输
      </button>
      <button
        v-for="leg in logisticsLegs"
        :key="leg.code"
        type="button"
        :class="{ active: filters.typeCode === leg.code }"
        :aria-pressed="filters.typeCode === leg.code"
        @click="filterLeg(leg.code)"
      >
        {{ leg.title }}
      </button>
    </div>
    <div v-if="category === 'marketing'" class="logistics-segments" aria-label="按营销类型筛选">
      <button
        type="button"
        :class="{ active: !filters.typeCode }"
        :aria-pressed="!filters.typeCode"
        @click="filterLeg('')"
      >
        全部费用
      </button>
      <button
        v-for="item in marketingTypes"
        :key="item.value"
        type="button"
        :class="{ active: filters.typeCode === item.value }"
        :aria-pressed="filters.typeCode === item.value"
        @click="filterLeg(item.value)"
      >
        {{ item.label }}
      </button>
    </div>
    <SupplyListFilters :loading="loading" @search="search" @reset="reset">
      <el-form-item v-if="advancedFilters" label="费用单号">
        <el-input
          v-model="filters.documentNo"
          clearable
          maxlength="100"
          placeholder="请输入费用单号"
          aria-label="费用单号"
        />
      </el-form-item>
      <el-form-item v-if="advancedFilters || category === 'marketing'" label="费用事项">
        <el-input
          v-model="filters.title"
          clearable
          maxlength="200"
          placeholder="请输入费用事项"
          aria-label="费用事项"
        />
      </el-form-item>
      <el-form-item v-if="advancedFilters" label="备注">
        <el-input
          v-model="filters.remark"
          clearable
          maxlength="1000"
          placeholder="请输入备注内容"
          aria-label="备注"
        />
      </el-form-item>
      <el-form-item v-if="typeDictionary && category !== 'logistics'" label="费用类型">
        <CostDictSelect
          v-model="filters.typeCode"
          :code="typeDictionary"
          clearable
          placeholder="全部类型"
          aria-label="费用类型"
        />
      </el-form-item>
      <el-form-item label="归属城市">
        <CostCitySelect
          v-model="filters.cityCode"
          :action="permission + ':read'"
          clearable
          placeholder="全部城市"
          aria-label="归属城市"
          @loaded="rememberCities"
        />
      </el-form-item>
      <el-form-item
        v-if="hasEmployee && (advancedFilters || category === 'expenses')"
        :label="category === 'marketing' ? '经办员工' : '费用归属人'"
      >
        <el-select
          v-model="filters.ownerEmployeeCode"
          filterable
          clearable
          placeholder="全部归属人"
          aria-label="费用归属人"
        >
          <el-option
            v-for="e in employees"
            :key="e.employeeCode"
            :label="employeeLabel(e)"
            :value="e.employeeCode"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        v-if="
          category === 'warehouse-rentals' ||
          category === 'losses' ||
          (category === 'purchases' && advancedFilters)
        "
        label="所属仓库"
      >
        <el-select
          v-model="filters.warehouseId"
          filterable
          clearable
          placeholder="全部仓库"
          aria-label="所属仓库"
        >
          <el-option v-for="w in warehouses" :key="w.value" :label="w.label" :value="w.value" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="isRental && advancedFilters" label="租赁合同号">
        <el-input
          v-model="filters.contractNo"
          clearable
          maxlength="100"
          placeholder="请输入租赁合同号"
          aria-label="租赁合同号"
        />
      </el-form-item>
      <el-form-item v-if="category === 'purchases'" label="供应商"
        ><el-input
          v-model="filters.supplierName"
          clearable
          placeholder="供应商名称"
          aria-label="供应商"
      /></el-form-item>
      <el-form-item v-if="category === 'losses' && advancedFilters" label="损耗原因"
        ><el-input
          v-model="filters.lossReason"
          clearable
          placeholder="原因关键词"
          aria-label="损耗原因"
      /></el-form-item>
      <el-form-item v-if="category === 'marketing' && advancedFilters" label="手填经办人"
        ><el-input
          v-model="filters.ownerName"
          clearable
          placeholder="手填经办人姓名"
          aria-label="手填经办人"
      /></el-form-item>
      <el-form-item v-if="category === 'marketing' && advancedFilters" label="收款方"
        ><el-input
          v-model="filters.payeeName"
          clearable
          placeholder="公司或个人名称"
          aria-label="收款方"
      /></el-form-item>
      <el-form-item v-if="isRental && advancedFilters" label="出租方"
        ><el-input
          v-model="filters.landlordName"
          clearable
          placeholder="出租方名称"
          aria-label="出租方"
      /></el-form-item>
      <el-form-item v-if="category === 'logistics' && advancedFilters" label="运单号">
        <el-input
          v-model="filters.trackingNo"
          clearable
          maxlength="100"
          placeholder="请输入运单号"
          aria-label="运单号"
        />
      </el-form-item>
      <el-form-item v-if="category !== 'expenses' && advancedFilters" label="来源单号">
        <el-input
          v-model="filters.sourceDocumentNo"
          clearable
          maxlength="100"
          placeholder="请输入来源单号"
          aria-label="来源单号"
        />
      </el-form-item>
      <el-form-item label="确认状态">
        <CostDictSelect
          v-model="filters.statusCode"
          code="COST_STATUS"
          clearable
          placeholder="全部确认状态"
          aria-label="确认状态"
        />
      </el-form-item>
      <el-form-item v-if="advancedFilters" label="付款状态">
        <CostDictSelect
          v-model="filters.paymentStatusCode"
          code="COST_PAYMENT_STATUS"
          clearable
          placeholder="全部付款状态"
          aria-label="付款状态"
        />
      </el-form-item>
      <el-form-item v-if="!isRental || advancedFilters" label="费用开始日期">
        <el-date-picker
          v-model="filters.dateFrom"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择开始日期"
          aria-label="费用开始日期"
        />
      </el-form-item>
      <el-form-item v-if="!isRental || advancedFilters" label="费用截止日期">
        <el-date-picker
          v-model="filters.dateTo"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择截止日期"
          aria-label="费用截止日期"
        />
      </el-form-item>
      <el-form-item v-if="isRental" label="费用月份"
        ><el-date-picker v-model="filters.costMonth" type="month" value-format="YYYY-MM"
      /></el-form-item>
      <el-form-item
        v-if="category !== 'expenses' && category !== 'marketing'"
        :label="objectFilterLabel"
        ><el-input
          v-model="filters.objectName"
          clearable
          maxlength="200"
          :placeholder="
            category === 'logistics'
              ? '单号、双方名称、承运方或运单号'
              : isRental
                ? '场地名称'
                : '商品名称或规格'
          "
      /></el-form-item>
      <el-form-item
        v-if="category !== 'expenses' && (category === 'purchases' || advancedFilters)"
        label="来源系统"
        ><el-select v-model="filters.sourceSystem" clearable placeholder="全部来源">
          <el-option label="本系统" value="SYSTEM" /><el-option
            label="订货宝"
            value="DHB"
          /><el-option label="混合来源" value="MIXED" />
          <el-option label="纸质或人工单据" value="MANUAL" /><el-option
            label="其他系统"
            value="OTHER"
          /><el-option label="无来源单据" value="NONE" /><el-option
            label="历史来源待核对"
            value="UNKNOWN"
          /> </el-select
      ></el-form-item>
      <el-form-item v-if="category === 'logistics' && advancedFilters" label="费用承担方"
        ><CostDictSelect v-model="filters.payerCode" code="COST_PAYER" clearable
      /></el-form-item>
      <el-form-item v-if="category !== 'expenses' && advancedFilters" label="金额状态"
        ><el-select v-model="filters.missingAmount" clearable
          ><el-option label="待补金额" value="true" /></el-select
      ></el-form-item>
      <el-form-item v-if="category === 'warehouse-rentals' && advancedFilters" label="历史类型"
        ><el-select v-model="filters.typeCode" clearable placeholder="仓储费用"
          ><el-option label="仓储费用" value="WAREHOUSE" /><el-option
            label="类型待核对"
            value="UNKNOWN" /></el-select
      ></el-form-item>
    </SupplyListFilters>
    <div
      class="cost-summary"
      v-if="!loadError && category !== 'expenses'"
      aria-label="本类成本统计"
    >
      <div>
        <span>已登记金额</span><strong>{{ summaryMoney(page.registeredAmount) }}</strong>
      </div>
      <div>
        <span>已确认金额</span><strong>{{ summaryMoney(page.confirmedAmount) }}</strong>
      </div>
      <div>
        <span>待补金额</span
        ><strong>{{
          page.missingAmountCount == null ? '—' : page.missingAmountCount + ' 条'
        }}</strong>
      </div>
      <div>
        <span>待确认</span
        ><strong>{{ page.pendingCount == null ? '—' : page.pendingCount + ' 条' }}</strong>
      </div>
    </div>
    <el-card shadow="never" class="list-card">
      <div class="supply-list-toolbar">
        <span
          >共 {{ page.total }} 条记录<template
            v-if="category === 'expenses' && page.confirmedAmount != null"
          >
            · 已确认金额 ¥{{ costMoney(page.confirmedAmount) }} · 待确认
            {{ page.pendingCount }} 条</template
          ></span
        >
        <div class="supply-list-actions">
          <el-switch v-model="showExtraColumns" active-text="显示补充列" aria-label="显示补充列" />
          <el-button
            :disabled="loading || !page.items.length"
            :loading="exporting"
            v-if="can(permission + (category === 'expenses' ? ':read' : ':export'))"
            @click="exportPage"
            >导出筛选结果</el-button
          ><el-button :loading="loading" @click="load">刷新</el-button>
        </div>
      </div>
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
        <el-table-column label="费用单号" width="200" fixed="left"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="showDetail(row as CostRecord)">{{
              row.documentNo
            }}</el-button></template
          ></el-table-column
        >
        <el-table-column v-if="isRental" prop="data.costMonth" label="费用月份" width="110" />
        <el-table-column v-else prop="data.costDate" :label="dateLabel" width="115" />
        <el-table-column
          v-if="category !== 'logistics'"
          prop="data.cityName"
          label="归属城市"
          width="120"
        />
        <el-table-column
          v-if="typeDictionary"
          :label="category === 'logistics' ? '运输环节' : '类型'"
          width="180"
          ><template #default="{ row }">{{
            costLabel(typeDictionary, row.data.logistics?.legCode || row.data.typeCode)
          }}</template></el-table-column
        >
        <el-table-column
          v-if="category === 'logistics'"
          label="运输路线（供应商／仓库／客户）"
          min-width="340"
          ><template #default="{ row }"
            ><CostLogisticsRoute
              :logistics="row.data.logistics ?? null"
              :sources="row.sources"
              compact /></template
        ></el-table-column>
        <el-table-column
          v-if="category === 'logistics'"
          prop="data.cityName"
          label="归属城市"
          width="120"
        />
        <template v-if="isGoods">
          <el-table-column
            prop="data.goods.productName"
            label="商品"
            min-width="160"
            show-overflow-tooltip
          />
          <el-table-column
            prop="data.goods.specification"
            label="规格"
            min-width="120"
            show-overflow-tooltip
          />
          <el-table-column prop="data.goods.unit" label="单位" width="80" />
          <el-table-column
            v-if="category === 'purchases'"
            prop="data.goods.unitPrice"
            label="进货单价（元）"
            width="140"
            align="right"
          />
          <el-table-column label="数量" width="110"
            ><template #default="{ row }">{{
              row.data.goods?.quantity ?? '待补数量'
            }}</template></el-table-column
          >
        </template>
        <template v-if="isRental">
          <el-table-column
            :label="category === 'office-rentals' ? '办公室名称' : '仓库名称'"
            min-width="180"
            ><template #default="{ row }">{{
              row.data.rental?.premisesName || row.warehouseName || '待补录'
            }}</template></el-table-column
          >
          <el-table-column prop="data.rental.area" label="面积（㎡）" width="110" />
        </template>
        <el-table-column
          v-if="category === 'marketing' || category === 'expenses' || showExtraColumns"
          prop="data.title"
          label="费用事项"
          min-width="190"
          show-overflow-tooltip
        />
        <el-table-column
          v-if="category !== 'logistics'"
          :label="amountLabel"
          width="135"
          align="right"
          ><template #default="{ row }">{{ costMoney(row.data.amount) }}</template></el-table-column
        >
        <el-table-column
          v-if="category === 'purchases'"
          prop="data.goods.supplierName"
          label="供应商"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column
          v-if="category === 'losses' || (isGoods && showExtraColumns)"
          label="仓库／发生地点"
          min-width="170"
          ><template #default="{ row }">{{
            row.warehouseName || row.data.goods?.location || '待补录'
          }}</template></el-table-column
        >
        <el-table-column
          v-if="category === 'losses'"
          prop="data.goods.lossReason"
          label="损耗原因"
          min-width="180"
        />
        <template v-if="category === 'marketing'">
          <el-table-column label="经办人" width="120"
            ><template #default="{ row }">{{
              row.ownerEmployeeName || row.data.ownerName || '待补录'
            }}</template></el-table-column
          >
          <el-table-column prop="data.payeeName" label="收款方／合作方" min-width="180" />
        </template>
        <el-table-column
          v-if="
            category !== 'expenses' && ((!isRental && category !== 'marketing') || showExtraColumns)
          "
          label="单据来源"
          width="180"
          ><template #default="{ row }"
            ><el-tag :type="row.sources?.length ? 'success' : 'info'">{{
              costSourceLabel(row as CostRecord)
            }}</el-tag>
            <div class="source-numbers">{{ costSourceNumbers(row as CostRecord) }}</div></template
          ></el-table-column
        >
        <template v-if="category === 'logistics'">
          <el-table-column prop="data.logistics.carrierName" label="承运方" min-width="150" />
          <el-table-column prop="data.logistics.trackingNo" label="运单号" min-width="160" />
          <el-table-column label="运费（元）" width="135" align="right"
            ><template #default="{ row }">{{
              costMoney(row.data.amount)
            }}</template></el-table-column
          >
          <el-table-column v-if="showExtraColumns" label="承担方" width="100"
            ><template #default="{ row }">{{
              costLabel('COST_PAYER', row.data.logistics?.payerCode)
            }}</template></el-table-column
          >
        </template>
        <el-table-column v-if="isRental" prop="data.costDate" label="费用日期" width="115" />
        <el-table-column
          v-if="isRental && showExtraColumns"
          prop="data.rental.landlordName"
          label="出租方"
          min-width="150"
        />
        <el-table-column
          v-if="category === 'expenses'"
          prop="ownerEmployeeName"
          label="归属人"
          width="120"
        />
        <el-table-column
          v-if="showExtraColumns || category === 'expenses'"
          label="付款状态"
          width="100"
          ><template #default="{ row }">{{
            costLabel('COST_PAYMENT_STATUS', row.data.paymentStatusCode)
          }}</template></el-table-column
        >
        <el-table-column label="确认状态" width="100"
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
        <el-table-column label="操作" fixed="right" width="205"
          ><template #default="{ row }"
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
              :disabled="saving"
              @click="transition(row as CostRecord, 'confirm')"
              >确认</el-button
            ><el-button
              v-if="row.statusCode !== 'VOID' && can(permission + ':void')"
              link
              type="danger"
              :disabled="saving"
              @click="transition(row as CostRecord, 'void')"
              >作废</el-button
            ><el-button link @click="showHistory(row as CostRecord)">记录</el-button></template
          ></el-table-column
        >
      </el-table>
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
    /></el-card>
    <el-dialog
      v-model="editorVisible"
      :title="(editingId ? '编辑' : '新增') + title"
      :width="category === 'expenses' ? '800px' : 'min(1120px, 96vw)'"
      top="5vh"
      :class="{ 'cost-record-dialog': category !== 'expenses' }"
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
      <p v-if="category !== 'expenses'">保存后可在详情上传图片或票据附件。</p>
      <el-form
        :label-position="category === 'expenses' ? 'left' : 'top'"
        :label-width="category === 'expenses' ? '130px' : undefined"
        class="cost-editor"
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
          <el-form-item label="归属城市" required
            ><CostCitySelect
              v-model="form.cityCode"
              :action="permission + ':write'"
              :snapshot="form.cityName"
              aria-label="费用归属城市"
              @loaded="rememberCities"
              @change="selectCity"
          /></el-form-item>
        </div>
        <template v-if="form.logistics">
          <CostLogisticsRoute :logistics="form.logistics" :sources="selectedSources" />
          <h3 class="cost-section-title">运输双方与来源</h3>
          <el-form-item label="来源录入方式" required
            ><el-radio-group v-model="form.logistics.entryMode" @change="changeEntryMode"
              ><el-radio-button value="LINKED" :disabled="form.logistics.legCode === 'TRANSFER'"
                >选择系统单据</el-radio-button
              ><el-radio-button value="MANUAL">手工补录单据</el-radio-button
              ><el-radio-button value="MIXED" :disabled="form.logistics.legCode === 'TRANSFER'"
                >混合来源／补关联</el-radio-button
              ><el-radio-button value="NONE">无来源单据</el-radio-button></el-radio-group
            ></el-form-item
          >
          <template v-if="form.logistics.entryMode !== 'LINKED'">
            <el-alert
              v-if="form.logistics.entryMode !== 'NONE'"
              title="用于补录订货宝已有、但尚未同步到本系统的单据。只保存来源信息，不生成采购、销售或库存业务。"
              type="info"
              :closable="false"
            />
            <div class="manual-route-fields cost-field-grid">
              <el-form-item :label="routeRoles.sender" required>
                <div class="full-width">
                  <CostReferenceSelect
                    v-if="form.logistics.legCode === 'PURCHASE'"
                    v-model="form.logistics.supplierId"
                    :loader="supplierOptions"
                    :snapshot="form.logistics.senderName"
                    placeholder="搜索已有供应商；未收录可在下方手填"
                    @change="
                      (r) => {
                        if (r) form.logistics!.senderName = r.name
                      }
                    "
                  />
                  <CostReferenceSelect
                    v-else
                    v-model="form.logistics.sourceWarehouseId"
                    :loader="warehouseOptions"
                    :snapshot="form.logistics.senderName"
                    :placeholder="'搜索' + routeRoles.sender + '；未收录可在下方手填'"
                    @change="(r) => chooseWarehouse('source', r)"
                  />
                  <el-input
                    v-if="!form.logistics.supplierId && !form.logistics.sourceWarehouseId"
                    v-model="form.logistics.senderName"
                    :placeholder="'手动填写' + routeRoles.sender + '名称'"
                    maxlength="200"
                  />
                </div>
              </el-form-item>
              <el-form-item :label="routeRoles.receiver" required>
                <div class="full-width">
                  <CostReferenceSelect
                    v-if="form.logistics.legCode === 'DELIVERY'"
                    v-model="form.logistics.customerId"
                    :loader="customerOptions"
                    :snapshot="form.logistics.receiverName"
                    :reset-key="form.cityCode"
                    placeholder="搜索本城市客户；未收录可在下方手填"
                    @change="
                      (r) => {
                        if (r) form.logistics!.receiverName = r.name
                      }
                    "
                  />
                  <CostReferenceSelect
                    v-else
                    v-model="form.logistics.targetWarehouseId"
                    :loader="warehouseOptions"
                    :snapshot="form.logistics.receiverName"
                    :placeholder="'搜索' + routeRoles.receiver + '；未收录可在下方手填'"
                    @change="(r) => chooseWarehouse('target', r)"
                  />
                  <el-input
                    v-if="!form.logistics.customerId && !form.logistics.targetWarehouseId"
                    v-model="form.logistics.receiverName"
                    :placeholder="'手动填写' + routeRoles.receiver + '名称'"
                    maxlength="200"
                  />
                </div>
              </el-form-item>
              <el-form-item label="发货地址"
                ><el-input
                  v-model="form.logistics.originAddress"
                  maxlength="500"
                  :placeholder="routeRoles.sender + '的发货地址'"
              /></el-form-item>
              <el-form-item label="收货地址"
                ><el-input
                  v-model="form.logistics.destinationAddress"
                  maxlength="500"
                  :placeholder="routeRoles.receiver + '的收货地址'"
              /></el-form-item>
            </div>
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
          ><CostDictSelect v-model="form.typeCode" :code="typeDictionary"
        /></el-form-item>
        <el-form-item v-if="category === 'expenses'" label="归属城市" required
          ><CostCitySelect
            v-model="form.cityCode"
            :action="permission + ':write'"
            :snapshot="form.cityName"
            aria-label="费用归属城市"
            @loaded="rememberCities"
            @change="selectCity"
        /></el-form-item>
        <el-form-item v-if="category === 'expenses'" label="关联员工" required
          ><el-select v-model="form.ownerEmployeeCode" filterable clearable @change="selectEmployee"
            ><el-option
              v-for="e in employees"
              :key="e.employeeCode"
              :label="employeeLabel(e)"
              :value="e.employeeCode" /></el-select
        ></el-form-item>
        <CostMarketingFields
          v-if="category === 'marketing'"
          v-model="form"
          :employees="employees"
          :action="permission + ':write'"
          @city="selectCity"
          @cities="rememberCities"
          @employee="selectEmployee"
        />
        <CostGoodsFields
          v-if="form.goods"
          v-model="form.goods"
          :category="category"
          :persisted="!!editingId"
          :city-code="form.cityCode"
          :purchase-snapshot="sources[0]?.documentNo"
          :warehouse-snapshot="editingWarehouseName"
          @city="choosePurchaseCity"
          @suggest-amount="(amount) => (form.amount = amount)"
          ><template #occurrence
            ><CostRecordBasics
              v-model="form"
              :date-label="dateLabel"
              :amount-label="amountLabel"
              show-city
              :action="permission + ':write'"
              @city="selectCity"
              @cities="rememberCities" /></template
        ></CostGoodsFields>
        <CostRentalFields
          v-if="form.rental"
          v-model="form.rental"
          :office="category === 'office-rentals'"
          :warehouse-snapshot="editingWarehouseName"
          :warehouses="warehouseOptions"
          ><template #city
            ><el-form-item label="归属城市" required
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
        <el-collapse v-if="category !== 'expenses'"
          ><el-collapse-item title="补充信息与凭据（可选）" name="extra">
            <template v-if="form.marketing">
              <el-form-item label="投放渠道／平台"
                ><el-input v-model="form.marketing.channelName" maxlength="200"
              /></el-form-item>
              <el-form-item label="服务期间开始"
                ><el-date-picker v-model="form.marketing.serviceFrom" value-format="YYYY-MM-DD"
              /></el-form-item>
              <el-form-item label="服务期间截止"
                ><el-date-picker v-model="form.marketing.serviceTo" value-format="YYYY-MM-DD"
              /></el-form-item>
            </template>
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
        ><el-button type="primary" :loading="saving" @click="save">保存</el-button></template
      >
    </el-dialog>
    <el-drawer v-model="detailVisible" :title="detail?.documentNo" size="min(900px, 95vw)"
      ><template v-if="detail">
        <template v-if="detail.data.logistics">
          <h3>{{ logisticsRoles(detail.data.logistics.legCode).title }}</h3>
          <el-tag>{{ costSourceLabel(detail) }}</el-tag>
          <CostLogisticsRoute :logistics="detail.data.logistics" :sources="detail.sources" />
        </template>
        <section v-for="section in detailSections" :key="section.title" class="cost-detail-section">
          <h3>{{ section.title }}</h3>
          <el-descriptions :column="2" border>
            <el-descriptions-item
              v-for="field in section.fields"
              :key="field.label"
              :label="field.label"
              >{{ field.value }}</el-descriptions-item
            >
          </el-descriptions>
        </section>
        <CostAttachments
          v-if="category !== 'expenses'"
          :category="category"
          :row="detail"
          :editable="can(permission + ':write')"
          @changed="refreshDetail"
        /> </template
    ></el-drawer>
    <el-drawer v-model="historyVisible" title="操作记录" size="min(700px, 95vw)"
      ><el-alert
        v-if="historyError"
        :title="historyError"
        type="error"
        :closable="false"
      /><el-timeline v-loading="historyLoading"
        ><el-timeline-item
          v-for="(item, index) in history"
          :key="index"
          :timestamp="item.occurredTime"
          ><strong>{{ auditLabel(item.action) }}</strong>
          <p>{{ item.reason || '—' }}</p>
          <p class="field-hint">操作人：{{ item.actorId }}</p>
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
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import SupplyListFilters from '@/components/supply/SupplyListFilters.vue'
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
import CostRecordBasics from './CostRecordBasics.vue'
import CostMarketingFields from './CostMarketingFields.vue'
import CostGoodsFields from './CostGoodsFields.vue'
import CostRentalFields from './CostRentalFields.vue'
import CostCitySelect from './CostCitySelect.vue'
import CostDocumentSelect from './CostDocumentSelect.vue'
import CostReferenceSelect, { type ReferenceOption } from './CostReferenceSelect.vue'
import CostExternalDocumentFields from './CostExternalDocumentFields.vue'
import CostLogisticsRoute from './CostLogisticsRoute.vue'
import { logisticsLegs, logisticsRoles } from './cost-logistics'
import { costSourceLabel, costSourceNumbers } from './cost-source'
import CostDictSelect from './CostDictSelect.vue'
import { costLabel, costMoney, costOptions, loadCostDictionaries } from './cost-dictionaries'
import { exportCostRows } from './cost-export'
import { auditLabel, parseSnapshot, costSnapshotFields } from './cost-audit'
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
  purchases: '进货记录',
  losses: '损耗记录',
  logistics: '运费',
  marketing: '营销费用',
  'warehouse-rentals': '仓储费用',
  'office-rentals': '办公室费用',
  expenses: '报销费用',
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
const hasEmployee = computed(() => category.value === 'marketing' || category.value === 'expenses')
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
const showExtraColumns = ref(false)
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
    ? '登记金额（元）'
    : category.value === 'losses'
      ? '损耗金额（元）'
      : isRental.value
        ? '租赁费用（元）'
        : category.value === 'logistics'
          ? '运费（元）'
          : '费用金额（元）',
)
const objectFilterLabel = computed(() =>
  category.value === 'logistics'
    ? '运输关键词'
    : isRental.value
      ? category.value === 'office-rentals'
        ? '办公室名称'
        : '仓库名称'
      : category.value === 'marketing'
        ? '经办人／收款方'
        : '商品关键词',
)
const marketingTypes = computed(() =>
  costOptions('MARKETING_EXPENSE_TYPE').filter((item) =>
    ['PROMOTION', 'ADVERTISING', 'ENDORSEMENT'].includes(item.value),
  ),
)
const summaryMoney = (amount: number | null | undefined) =>
  amount == null ? '—' : '¥' + costMoney(amount)
const description = computed(() =>
  category.value === 'logistics'
    ? '选择本系统单据，或手工补录订货宝单据，再登记运费。确认表示记录已核对。'
    : isGoods.value
      ? '手工记录进货或损耗；已有商品和采购单可关联，确认不改变库存。'
      : isRental.value
        ? '按场地与费用月份登记租赁费，押金单列，不自动分摊。'
        : '手工登记、核对并保留记录。',
)
const emptyFilters = () => ({
  documentNo: '',
  title: '',
  remark: '',
  trackingNo: '',
  sourceDocumentNo: '',
  sourceSystem: '',
  payerCode: '',
  missingAmount: '',
  costMonth: '',
  supplierName: '',
  lossReason: '',
  ownerName: '',
  payeeName: '',
  landlordName: '',
  objectName: '',
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
const advancedFilters = ref(false)
const filters = ref(emptyFilters()),
  currentPage = ref(1),
  pageSize = ref(20)
const appliedFilters = ref<Omit<CostQuery, 'begin' | 'step'>>({})
const hasAppliedFilters = computed(() => Object.keys(appliedFilters.value).length > 0)
const page = ref<CostPage>({ total: 0, begin: 0, step: 20, items: [] }),
  loading = ref(false),
  loadError = ref(''),
  saving = ref(false)
const employees = ref<CostEmployee[]>([]),
  warehouses = ref<CostWarehouse[]>([]),
  cities = ref<{ code: string; name: string }[]>([])
const editorVisible = ref(false),
  editorError = ref(''),
  editingId = ref<string | null>(null),
  editingConfirmed = ref(false),
  editingWarehouseName = ref('')
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
    label === '单据来源' || label === '关联系统单据' || label.startsWith('外部单据')
  const isAudit = (label: string) =>
    ['费用单号', '录入人', '录入时间', '修改人', '修改时间'].includes(label)
  const objectFields = isGoods.value
    ? ['商品名称', '规格', '单位', '供应商', '仓库', '发生地点', '损耗原因', '进货单价', '数量']
    : isRental.value
      ? ['场地名称', '场地类型', '地址', '面积（㎡）', '费用月份']
      : category.value === 'marketing'
        ? ['费用类型', '事项', '经办人', '收款方']
        : detail.value?.data.logistics
          ? [
              logisticsRoles(detail.value.data.logistics.legCode).sender,
              logisticsRoles(detail.value.data.logistics.legCode).receiver,
              '物流类型',
              '承运方',
              '运单号',
            ]
          : []
  const business = fields.filter((field) => !isSource(field.label) && !isAudit(field.label))
  const ordered = [
    ...objectFields.flatMap((label) => business.filter((field) => field.label === label)),
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
  () => editorVisible.value && JSON.stringify(form.value) !== initialEditorValue.value,
)
async function discardChanges(): Promise<boolean> {
  if (!dirty.value) return true
  try {
    await ElMessageBox.confirm('当前录入尚未保存，确定离开？', '未保存的成本记录', {
      confirmButtonText: '放弃修改',
      cancelButtonText: '继续编辑',
      type: 'warning',
    })
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
  if (dirty.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
function blank(): CostCommand {
  return {
    requestId: crypto.randomUUID(),
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
            entryMode: filters.value.typeCode === 'TRANSFER' ? 'MANUAL' : 'LINKED',
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
function filterLeg(code: string) {
  filters.value.typeCode = code
  search()
}
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
        ...page.value,
        items: [],
        confirmedAmount: undefined,
        paidAmount: undefined,
        pendingCount: undefined,
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
      .filter(([, value]) => !!value),
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
  const results = await Promise.allSettled([
    loadCostDictionaries(selected),
    getCostCities(permission.value + ':read'),
    selected === 'marketing' || selected === 'expenses'
      ? getCostEmployees(selected)
      : Promise.resolve([]),
    ['warehouse-rentals', 'office-rentals', 'purchases', 'losses'].includes(selected)
      ? getCostWarehouses(selected)
      : Promise.resolve([]),
  ])
  if (selected !== category.value) return
  const [, area, people, storage] = results
  if (area.status === 'fulfilled') rememberCities(area.value)
  if (people.status === 'fulfilled') employees.value = people.value
  if (storage.status === 'fulfilled') warehouses.value = storage.value
  for (const result of results)
    if (result.status === 'rejected')
      ElMessage.error(errorMessage(result.reason, '部分业务选项加载失败，请刷新重试'))
}
function rememberCities(rows: { code: string; name: string }[]) {
  cities.value = [...new Map([...cities.value, ...rows].map((row) => [row.code, row])).values()]
  const selected = rows.find((row) => row.code === form.value.cityCode)
  if (editorVisible.value && selected) form.value.cityName = selected.name
}
function employeeLabel(e: CostEmployee) {
  return (
    e.employeeName + ' · ' + e.employeeCode + (e.departmentName ? ' · ' + e.departmentName : '')
  )
}
const previousLeg = ref('PURCHASE')
function edit(row?: CostRecord) {
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
    form.value.logistics.entryMode =
      form.value.logistics.legCode === 'TRANSFER' ? 'MANUAL' : 'LINKED'
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
function selectEmployee() {
  form.value.ownerEmployeeCode ||= null
  form.value.ownerName =
    employees.value.find((e) => e.employeeCode === form.value.ownerEmployeeCode)?.employeeName ||
    form.value.ownerName
  form.value.departmentId =
    employees.value.find((e) => e.employeeCode === form.value.ownerEmployeeCode)?.departmentId ??
    null
}
async function save() {
  if (saving.value) return
  if (!form.value.title.trim() && category.value !== 'marketing' && category.value !== 'expenses')
    form.value.title = form.value.goods?.productName
      ? `${title.value} · ${form.value.goods.productName}`
      : form.value.rental?.premisesName
        ? `${title.value} · ${form.value.rental.premisesName}`
        : form.value.logistics
          ? `${routeRoles.value.title}运费`
          : title.value
  if (
    !form.value.title.trim() ||
    !form.value.cityCode ||
    !form.value.costDate ||
    (category.value === 'expenses' && (!form.value.ownerEmployeeCode || form.value.amount == null))
  ) {
    editorError.value = '请填写费用事项、归属城市、日期、金额及归属人等必填信息'
    return
  }
  saving.value = true
  editorError.value = ''
  try {
    if (!isRental.value) form.value.costMonth = form.value.costDate.slice(0, 7)
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
    const saved = await saveCost(category.value, editingId.value, form.value)
    if (category.value !== 'expenses') showDetail(saved)
    editorVisible.value = false
    ElMessage.success('费用已保存')
    await load()
  } catch (e) {
    editorError.value = errorMessage(e, '保存失败')
  } finally {
    saving.value = false
  }
}
async function transition(row: CostRecord, action: 'confirm' | 'void') {
  if (action === 'confirm' && row.data.amount == null) {
    ElMessage.warning('请先补齐金额再确认')
    return
  }
  const required = action === 'void' || Number(row.data.amount) === 0
  let reason: string
  try {
    const answer = await ElMessageBox.prompt(
      action === 'void'
        ? '作废后不再计入有效登记金额，请填写原因。'
        : '请核对本条记录，确认不会执行库存或付款操作。0 元费用需填写说明。',
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
    await changeCostStatus(category.value, row, action, reason)
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
    const fields = rows.map((r) => [
      ...costSnapshotFields(r).map((field) =>
        field.label === '金额' ? { ...field, value: r.data.amount ?? '' } : field,
      ),
      { label: '金额状态', value: r.data.amount == null ? '待补金额' : '已登记' },
      { label: '记录ID', value: r.id },
      { label: '版本', value: String(r.revision) },
      { label: '单据来源', value: costSourceLabel(r) },
    ])
    const headers = Array.from(new Set(fields.flatMap((f) => f.map((v) => v.label))))
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
          cities.value.find((c) => c.code === w.regionCode)?.name || w.regionCode,
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
    label: r.name + ' · ' + r.code,
  }))
const customerOptions = async (keyword: string, begin: number) =>
  form.value.cityCode
    ? (await getCostCustomers(form.value.cityCode, keyword, begin)).map((r) => ({
        ...r,
        label: r.name + ' · ' + r.code,
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
    advancedFilters.value = false
    showExtraColumns.value = false
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
</script>
<style scoped lang="scss">
.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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
.logistics-segments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 12px;
}
.logistics-segments button {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 9px 16px;
  cursor: pointer;
  color: var(--el-text-color-regular);
  font: inherit;
}
.logistics-segments button.active {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
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
.cost-page .cost-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 0 0 16px;
  > div {
    padding: 16px 20px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
  }
  span {
    display: block;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    margin-bottom: 8px;
  }
  strong {
    color: var(--el-text-color-primary);
    font-size: 22px;
    font-weight: 600;
  }
  @media (max-width: 700px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
