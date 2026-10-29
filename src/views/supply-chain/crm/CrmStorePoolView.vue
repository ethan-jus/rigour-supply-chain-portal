<template>
  <section class="store-workspace">
    <header class="store-heading">
      <div class="store-heading-title">
        <h1>{{ title }}</h1>
        <span class="scope-label"
          ><el-icon><Location /></el-icon>当前范围：{{ context?.scopeLabel ?? '加载中' }}</span
        >
      </div>
      <div class="heading-actions">
        <el-radio-group
          v-if="view === 'MINE' && can('crm:pool:team-read')"
          v-model="team"
          aria-label="客户归属范围"
          @change="changeTeam"
          ><el-radio-button :value="false">我的</el-radio-button
          ><el-radio-button :value="true">团队</el-radio-button></el-radio-group
        >
        <el-radio-group v-if="isList" v-model="displayMode" aria-label="门店展示方式">
          <el-radio-button value="list"
            ><el-icon><List /></el-icon>列表</el-radio-button
          >
          <el-radio-button value="map"
            ><el-icon><MapLocation /></el-icon>地图</el-radio-button
          >
        </el-radio-group>
        <el-button v-if="view === 'ALL' && can('crm:store:manage')" @click="initializePolicy"
          >启用认领规则</el-button
        >
        <el-button v-if="can('crm:lead:create')" :icon="Plus" @click="openCreate"
          >新增门店</el-button
        >
        <el-popover
          v-if="isList && displayMode === 'list'"
          placement="bottom-end"
          trigger="click"
          :width="220"
        >
          <template #reference
            ><el-button :icon="Setting" aria-label="列设置"
              ><span class="column-settings-label">列设置</span></el-button
            ></template
          >
          <el-checkbox-group v-model="columns" class="column-options"
            ><el-checkbox v-for="column in optionalColumns" :key="column.key" :value="column.key">{{
              column.label
            }}</el-checkbox></el-checkbox-group
          >
        </el-popover>
      </div>
    </header>

    <el-alert
      v-if="error"
      :title="error"
      type="error"
      show-icon
      :closable="false"
      class="page-alert"
      ><el-button link @click="reload">重新加载</el-button></el-alert
    >
    <el-alert
      v-if="context?.emptyScopeReason"
      :title="context.emptyScopeReason"
      type="warning"
      show-icon
      :closable="false"
      class="page-alert"
    />

    <OrderRegisterFilterCard
      v-if="view !== 'LEADS'"
      class="store-filters"
      :loading="loading"
      @search="search"
      @reset="resetFilters"
    >
      <template #primary>
        <el-input
          v-model="filters.keyword"
          aria-label="门店名称或地址"
          placeholder="搜索门店名称或地址"
          clearable
          :prefix-icon="Search"
          class="keyword-input"
        />
        <el-select
          v-model="filters.cooperation"
          aria-label="合作历史"
          placeholder="全部合作历史"
          clearable
          ><el-option label="未合作" value="NEVER" /><el-option label="历史合作" value="COOPERATED"
        /></el-select>
        <el-select
          v-model="filters.region"
          aria-label="大区"
          placeholder="全部区域"
          clearable
          @change="changeRegion"
          ><el-option
            v-for="code in areas.regions"
            :key="code"
            :label="GEO_REGIONS[code] ?? code"
            :value="code"
        /></el-select>
        <el-select
          v-model="filters.province"
          aria-label="省"
          placeholder="全部省份"
          filterable
          clearable
          @change="changeProvince"
          ><el-option v-for="a in areas.provinces" :key="a.code" :label="a.name" :value="a.code"
        /></el-select>
        <el-select
          v-model="filters.city"
          aria-label="市"
          placeholder="全部城市"
          filterable
          clearable
          @change="filters.county = ''"
          ><el-option v-for="a in areas.cities" :key="a.code" :label="a.name" :value="a.code"
        /></el-select>
        <el-select
          v-model="filters.county"
          aria-label="区县"
          placeholder="全部区县"
          filterable
          clearable
          ><el-option v-for="a in areas.counties" :key="a.code" :label="a.name" :value="a.code"
        /></el-select>
        <el-select v-model="filters.tier" aria-label="价值等级" placeholder="全部价值等级" clearable
          ><el-option
            v-for="level in ['A', 'B', 'C', 'UNRATED']"
            :key="level"
            :label="level === 'UNRATED' ? '未评级' : `价值 ${level}`"
            :value="level"
        /></el-select>
        <el-select
          v-model="filters.activity"
          aria-label="交易活跃度"
          placeholder="全部交易活跃度"
          clearable
          ><el-option v-for="(label, key) in activityLabels" :key="key" :label="label" :value="key"
        /></el-select>
        <el-select
          v-model="filters.potential"
          aria-label="门店潜力"
          placeholder="全部潜力"
          clearable
          ><el-option
            v-for="(label, key) in potentialLabels"
            :key="key"
            :label="label"
            :value="key"
        /></el-select>
      </template>
    </OrderRegisterFilterCard>

    <div v-if="isList" class="store-table-surface" :aria-busy="loading">
      <div v-if="displayMode === 'list'" class="store-table-viewport">
        <el-table
          v-loading="loading"
          :data="rows"
          row-key="id"
          class="store-table"
          empty-text="当前授权范围和筛选条件下暂无门店"
          height="100%"
        >
          <el-table-column
            label="门店信息"
            min-width="330"
            :fixed="compactViewport ? false : 'left'"
          >
            <template #default="{ row }">
              <div class="store-identity">
                <button class="store-name" :title="row.name" @click="openDetail(row as StoreRow)">
                  {{ row.name }}</button
                ><el-tag
                  size="small"
                  :type="row.cooperationStatus === 'COOPERATED' ? 'success' : 'info'"
                  effect="light"
                  >{{ row.cooperationStatus === 'COOPERATED' ? '历史合作' : '未合作' }}</el-tag
                ><el-tooltip :content="tierDescription(row as StoreRow)"
                  ><el-tag
                    size="small"
                    :type="['C', 'UNRATED'].includes(row.customerTier) ? 'info' : 'primary'"
                    effect="light"
                    >{{
                      row.customerTier === 'UNRATED' ? '未评级' : `价值 ${row.customerTier}`
                    }}</el-tag
                  ></el-tooltip
                >
              </div>
              <button
                v-if="storeMapUrl(row as StoreRow)"
                type="button"
                @click="locateStore(row as StoreRow)"
                class="store-address"
                :aria-label="`在地图查看${row.name}`"
              >
                <el-icon><LocationFilled /></el-icon><span>{{ row.address }}</span>
              </button>
              <span v-else class="store-address"
                ><el-icon><Location /></el-icon><span>{{ row.address }} · 位置待完善</span></span
              >
            </template>
          </el-table-column>
          <el-table-column v-if="shown('type')" label="门店类型" min-width="110"
            ><template #default="{ row }">{{
              typeName(row.storeTypeCode)
            }}</template></el-table-column
          >
          <el-table-column v-if="shown('area')" label="所属地区" min-width="145"
            ><template #default="{ row }"
              ><span class="area-line">{{ row.provinceName ?? '—' }}</span
              ><span class="area-line">{{
                [row.cityName, row.countyName].filter(Boolean).join(' / ') || '—'
              }}</span></template
            ></el-table-column
          >
          <el-table-column v-if="view !== 'PUBLIC'" label="当前归属" min-width="110"
            ><template #default="{ row }"
              ><span>{{ row.poolType === 'PUBLIC' ? '公海' : '私海' }}</span
              ><span class="secondary-line">{{ row.ownerName || '' }}</span></template
            ></el-table-column
          >
          <el-table-column v-if="view === 'MINE'" label="保护期限" min-width="160"
            ><template #default="{ row }"
              ><span>{{ phaseLabels[row.phase] ?? '—' }}</span
              ><span class="secondary-line" :class="{ urgent: nearDeadline(row.deadlineAt) }">{{
                remainingTime(row.deadlineAt, now)
              }}</span></template
            ></el-table-column
          >
          <el-table-column v-if="shown('lastVisit')" label="最近拜访" width="132"
            ><template #default="{ row }">{{ date(row.lastVisitAt) }}</template></el-table-column
          >
          <el-table-column v-if="shown('lastOrder')" label="最近成交" width="132"
            ><template #default="{ row }">{{ date(row.lastOrderAt) }}</template></el-table-column
          >
          <el-table-column
            v-if="shown('activity') || view === 'COOPERATED'"
            label="交易活跃度"
            width="120"
            ><template #default="{ row }">{{
              activityLabels[row.activityStatus] ?? '待核实'
            }}</template></el-table-column
          >
          <el-table-column v-if="shown('phone')" label="公开电话" min-width="150"
            ><template #default="{ row }">{{
              row.publicPhone || '未维护'
            }}</template></el-table-column
          >
          <el-table-column v-if="shown('poi')" label="高德 POI" min-width="155"
            ><template #default="{ row }"
              ><el-button v-if="row.primaryPoi" link @click="copy(row.primaryPoi)">{{
                row.primaryPoi
              }}</el-button
              ><span v-else>未关联</span></template
            ></el-table-column
          >
          <el-table-column v-if="shown('created')" label="创建时间 / 创建人" min-width="220"
            ><template #default="{ row }"
              >{{ dateTime(row.createdAt)
              }}<span class="secondary-line actor">{{ actor(row.createdBy) }}</span></template
            ></el-table-column
          >
          <el-table-column v-if="shown('updated')" label="修改时间 / 修改人" min-width="220"
            ><template #default="{ row }"
              >{{ dateTime(row.updatedAt)
              }}<span class="secondary-line actor">{{ actor(row.updatedBy) }}</span></template
            ></el-table-column
          >
          <el-table-column v-if="view === 'PUBLIC'" label="认领状态" min-width="130"
            ><template #default="{ row }"
              ><span>{{ row.claimBlockedReason || '可认领' }}</span
              ><span
                v-if="row.cooldownUntil && new Date(row.cooldownUntil).getTime() > now"
                class="secondary-line"
                >还需{{ remainingTime(row.cooldownUntil, now) }}</span
              ></template
            ></el-table-column
          >
          <el-table-column
            v-if="can('crm:pool:claim') && view !== 'MINE'"
            label="操作"
            width="90"
            :fixed="compactViewport ? false : 'right'"
            ><template #default="{ row }"
              ><div class="row-actions">
                <el-button
                  v-if="row.poolType === 'PUBLIC' && can('crm:pool:claim')"
                  size="small"
                  type="primary"
                  :disabled="!!row.claimBlockedReason || pendingId === row.id"
                  :loading="pendingId === row.id"
                  @click="claim(row as StoreRow)"
                  >认领</el-button
                >
              </div></template
            ></el-table-column
          >
        </el-table>
      </div>
      <CrmStoreMap
        v-else
        :rows="rows"
        :total="total"
        :loading="loading"
        :focus-id="mapFocusId"
        @select="mapFocusId = $event"
        @detail="openDetail"
      />
      <footer class="table-footer">
        <el-pagination
          :current-page="pageIndex + 1"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          :disabled="loading"
          :hide-on-single-page="false"
          layout="total, sizes, ->, prev, slot, next"
          @size-change="search"
          @current-change="changePage"
        >
          <span class="page-position" aria-live="polite"
            >{{ pageIndex + 1 }} / {{ Math.max(1, Math.ceil(total / pageSize)) }}</span
          >
        </el-pagination>
      </footer>
    </div>

    <div v-if="view === 'LEADS'" class="store-table-surface">
      <div class="lead-toolbar">
        <el-radio-group v-model="reviewMode" @change="loadLeads"
          ><el-radio-button :value="false">我的提报</el-radio-button
          ><el-radio-button v-if="can('crm:lead:review')" :value="true"
            >待我审核</el-radio-button
          ></el-radio-group
        ><span class="muted">显示最近100条；手动新增审核通过后进入公海</span>
      </div>
      <el-table v-loading="loading" :data="leads" height="100%" empty-text="暂无门店提报"
        ><el-table-column prop="name" label="门店名称" min-width="200" /><el-table-column
          prop="address"
          label="地址"
          min-width="240"
        /><el-table-column label="审核状态" width="120"
          ><template #default="{ row }">{{
            leadLabels[row.status] ?? row.status
          }}</template></el-table-column
        ><el-table-column label="提交时间" width="180"
          ><template #default="{ row }">{{ dateTime(row.submittedAt) }}</template></el-table-column
        ><el-table-column prop="reviewReason" label="审核意见" min-width="180" /><el-table-column
          v-if="reviewMode"
          label="操作"
          width="170"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="reviewLead(row as StoreLead, true)"
              >通过</el-button
            ><el-button link type="danger" @click="reviewLead(row as StoreLead, false)"
              >驳回</el-button
            ></template
          ></el-table-column
        ></el-table
      >
    </div>

    <div v-if="view === 'COVERAGE'" v-loading="loading" class="coverage-surface">
      <p>统计范围：{{ context?.scopeLabel }}。覆盖率以当前筛选范围内已入库的有效门店为分母。</p>
      <el-descriptions v-if="coverage" :column="3" border
        ><el-descriptions-item label="有效门店">{{ coverage.total }}</el-descriptions-item
        ><el-descriptions-item label="公海 / 私海"
          >{{ coverage.publicCount }} / {{ coverage.privateCount }}</el-descriptions-item
        ><el-descriptions-item label="历史合作">{{ coverage.cooperatedCount }}</el-descriptions-item
        ><el-descriptions-item label="拜访覆盖率">{{
          rate(coverage.visitedCount, coverage.total)
        }}</el-descriptions-item
        ><el-descriptions-item label="建联覆盖率">{{
          rate(coverage.connectedCount, coverage.total)
        }}</el-descriptions-item
        ><el-descriptions-item label="合作覆盖率">{{
          rate(coverage.cooperatedCount, coverage.total)
        }}</el-descriptions-item
        ><el-descriptions-item label="价值 A / B / C"
          >{{ coverage.tierA }} / {{ coverage.tierB }} / {{ coverage.tierC }}</el-descriptions-item
        ><el-descriptions-item label="未评级">{{ coverage.unratedCount }}</el-descriptions-item
        ><el-descriptions-item label="来源待核验"
          >拜访 {{ coverage.unknownVisitCount }} 家；企微
          {{ coverage.unknownWecomCount }} 家</el-descriptions-item
        ></el-descriptions
      >
      <p class="muted">
        拜访、建联、合作存在交叉，不能相加作为总客户数。未知来源不能视作确定的零。
      </p>
    </div>

    <el-drawer
      v-model="detailOpen"
      :title="selected?.name || '门店详情'"
      size="620px"
      destroy-on-close
    >
      <div v-if="selected" v-loading="detailLoading" class="store-detail">
        <div class="detail-tags">
          <el-tag>{{ selected.poolType === 'PUBLIC' ? '公海' : '私海' }}</el-tag
          ><el-tag type="success">{{
            selected.cooperationStatus === 'COOPERATED' ? '历史合作' : '未合作'
          }}</el-tag
          ><el-tag type="info">{{
            selected.customerTier === 'UNRATED' ? '未评级' : `价值 ${selected.customerTier}`
          }}</el-tag
          ><el-tag type="info">{{ activityLabels[selected.activityStatus] }}</el-tag>
        </div>
        <el-alert
          v-if="selected.holdReason"
          :title="holdLabels[selected.holdReason] ?? '归属正在核验，暂缓回收'"
          type="warning"
          :closable="false"
        />
        <el-tabs v-model="detailTab" @tab-change="loadHistory">
          <el-tab-pane label="基本资料" name="profile">
            <el-descriptions :column="1" border
              ><el-descriptions-item label="门店类型">{{
                typeName(selected.storeTypeCode)
              }}</el-descriptions-item
              ><el-descriptions-item label="所属地区">{{
                [selected.provinceName, selected.cityName, selected.countyName]
                  .filter(Boolean)
                  .join(' / ')
              }}</el-descriptions-item
              ><el-descriptions-item label="详细地址">{{ selected.address }}</el-descriptions-item
              ><el-descriptions-item label="地图位置"
                ><button
                  v-if="storeMapUrl(selected)"
                  type="button"
                  @click="locateStore(selected)"
                  class="map-link"
                >
                  <el-icon><LocationFilled /></el-icon>定位到地图</button
                ><span v-else>位置待完善</span></el-descriptions-item
              ><el-descriptions-item label="经纬度 / 坐标系"
                >{{ selected.longitude ?? '—' }}, {{ selected.latitude ?? '—' }} /
                {{ selected.coordinateSystem ?? '—' }}</el-descriptions-item
              ><el-descriptions-item label="公开电话">{{
                selected.publicPhone || '未维护'
              }}</el-descriptions-item
              ><el-descriptions-item label="高德 POI"
                ><el-button
                  v-if="selected.primaryPoi"
                  link
                  type="primary"
                  @click="copy(selected.primaryPoi)"
                  >{{ selected.primaryPoi }} · 复制</el-button
                ><span v-else>未关联</span></el-descriptions-item
              ><el-descriptions-item label="公司门店 ID">{{ selected.id }}</el-descriptions-item
              ><el-descriptions-item label="当前负责人">{{
                selected.ownerName || '无'
              }}</el-descriptions-item
              ><el-descriptions-item label="创建时间 / 创建人"
                >{{ dateTime(selected.createdAt) }}<br />{{
                  actor(selected.createdBy)
                }}</el-descriptions-item
              ><el-descriptions-item label="修改时间 / 修改人"
                >{{ dateTime(selected.updatedAt) }}<br />{{
                  actor(selected.updatedBy)
                }}</el-descriptions-item
              ></el-descriptions
            >
          </el-tab-pane>
          <el-tab-pane v-if="can('crm:store:history-read')" label="拜访记录" name="visits">
            <p class="muted">
              展示最近 100 条记录。有效拜访按门店累计编号，历任负责人的记录都会保留。
            </p>
            <el-timeline>
              <el-timeline-item
                v-for="item in storeVisits"
                :key="item.id"
                :timestamp="dateTime(item.visitedAt)"
              >
                <strong>{{
                  item.storeVisitNo
                    ? `${item.visitType === 'INITIAL' ? '初访' : '复访'} · 第 ${item.storeVisitNo} 次`
                    : (visitLabels[item.status] ?? item.status)
                }}</strong>
                <p>员工 {{ item.salespersonId }} · {{ visitLabels[item.status] ?? item.status }}</p>
                <p>{{ item.resultSummary || '尚未提交拜访结果' }}</p>
                <p v-if="item.reviewReason">核验依据：{{ visitReviewReason(item.reviewReason) }}</p>
                <CrmVisitEvidence
                  v-if="item.captureRef"
                  :capture-id="item.captureRef"
                  :permissions="context?.permissions ?? []"
                />
                <template v-if="can('crm:store:visit-review')">
                  <el-button
                    v-if="item.status === 'SUBMITTED'"
                    link
                    type="primary"
                    @click="reviewVisit(item, 'EFFECTIVE')"
                    >确认有效</el-button
                  >
                  <el-button
                    v-if="item.status === 'SUBMITTED'"
                    link
                    type="danger"
                    @click="reviewVisit(item, 'INVALID')"
                    >判定无效</el-button
                  >
                  <el-button
                    v-if="item.status === 'EFFECTIVE'"
                    link
                    type="danger"
                    @click="reviewVisit(item, 'VOID')"
                    >撤销有效性</el-button
                  >
                </template>
              </el-timeline-item>
            </el-timeline>
            <el-empty v-if="!storeVisits.length" description="暂无拜访记录" />
          </el-tab-pane>
          <el-tab-pane v-if="can('crm:store:history-read')" label="归属历史" name="ownership"
            ><p class="muted">最近100次归属；回公海不会删除历史。</p>
            <el-timeline
              ><el-timeline-item
                v-for="item in ownerships"
                :key="item.id"
                :timestamp="dateTime(item.startedAt)"
                >员工 {{ item.ownerEmployeeId }} ·
                {{ acquireLabels[item.acquireType] ?? item.acquireType }}
                <p>
                  {{
                    item.endedAt
                      ? `结束于 ${dateTime(item.endedAt)} · ${endReasonLabels[item.endReason ?? ''] ?? item.endReason}`
                      : '当前归属'
                  }}
                </p></el-timeline-item
              ></el-timeline
            ><el-empty v-if="!ownerships.length" description="暂无归属历史"
          /></el-tab-pane>
          <el-tab-pane v-if="can('crm:store:history-read')" label="资料变更" name="audit"
            ><p class="muted">最近100条变更；记录实际操作账号与修改前后内容。</p>
            <el-timeline
              ><el-timeline-item
                v-for="item in events"
                :key="item.id"
                :timestamp="dateTime(item.occurredAt)"
                ><strong>{{ eventLabels[item.type] ?? item.type }}</strong>
                <p>{{ actor(item.actorUserId) }} · {{ item.reason || '—' }}</p>
                <pre v-if="item.beforeData">修改前：{{ pretty(item.beforeData) }}</pre>
                <pre v-if="item.afterData">修改后：{{ pretty(item.afterData) }}</pre>
              </el-timeline-item></el-timeline
            ><el-empty v-if="!events.length" description="暂无变更记录"
          /></el-tab-pane>
        </el-tabs>
      </div>
      <template #footer
        ><div v-if="selected" class="drawer-actions">
          <el-button v-if="can('crm:store:manage')" @click="openEdit">编辑资料</el-button
          ><el-button
            v-if="
              selected.ownerEmployeeId === context?.employeeId &&
              selected.poolType === 'PRIVATE' &&
              can('crm:pool:release')
            "
            @click="release(selected)"
            >退回公海</el-button
          ><el-button
            v-if="selected.poolType === 'PUBLIC' && can('crm:pool:claim')"
            type="primary"
            :disabled="!!selected.claimBlockedReason"
            :loading="pendingId === selected.id"
            @click="claim(selected)"
            >认领到我的客户</el-button
          >
        </div></template
      >
    </el-drawer>

    <el-dialog
      v-model="createOpen"
      title="新增门店提报"
      width="580px"
      :close-on-click-modal="false"
    >
      <el-alert
        title="手动新增需要审核；审核通过进入公海后，可认领开展作业。"
        type="info"
        :closable="false"
      />
      <el-form label-position="top" class="store-form" @submit.prevent="submitLead"
        ><el-form-item label="门店名称" required
          ><el-input v-model="form.name" maxlength="200" /></el-form-item
        ><el-form-item label="区县 / 合法城市叶节点" required
          ><el-select v-model="form.areaCode" filterable placeholder="选择负责范围内的区县"
            ><el-option
              v-for="a in formAreas"
              :key="a.code"
              :value="a.code"
              :label="areaPath(a.code)" /></el-select></el-form-item
        ><el-form-item label="详细地址" required
          ><el-input v-model="form.address" maxlength="500"
        /></el-form-item>
        <div class="coordinate-inputs">
          <el-form-item label="经度（GCJ02）" required
            ><el-input-number
              v-model="form.longitude"
              :min="-180"
              :max="180"
              :precision="7"
              :controls="false" /></el-form-item
          ><el-form-item label="纬度（GCJ02）" required
            ><el-input-number
              v-model="form.latitude"
              :min="-90"
              :max="90"
              :precision="7"
              :controls="false"
          /></el-form-item>
        </div>
        <el-form-item label="公开门店电话"
          ><el-input v-model="form.publicPhone" maxlength="50" /></el-form-item
      ></el-form>
      <template #footer
        ><el-button @click="createOpen = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="submitLead"
          >提交审核</el-button
        ></template
      >
    </el-dialog>
    <el-dialog v-model="editOpen" title="完善门店资料" width="560px" :close-on-click-modal="false"
      ><el-form v-if="editing" label-position="top"
        ><el-form-item label="门店名称" required
          ><el-input v-model="editing.name" maxlength="200" /></el-form-item
        ><el-form-item label="详细地址" required
          ><el-input v-model="editing.address" maxlength="500" /></el-form-item
        ><el-form-item label="门店类型"
          ><el-select v-model="editing.storeTypeCode" clearable placeholder="未分类"
            ><el-option
              v-for="t in storeTypes"
              :key="t.dictionaryItemCode"
              :label="t.dictionaryItemName"
              :value="t.dictionaryItemCode" /></el-select></el-form-item
        ><el-form-item label="公开电话"
          ><el-input v-model="editing.publicPhone" maxlength="50" /></el-form-item
        ><el-form-item label="修改原因" required
          ><el-input v-model="editReason" type="textarea" maxlength="500" /></el-form-item></el-form
      ><template #footer
        ><el-button @click="editOpen = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="saveEdit"
          >保存并留痕</el-button
        ></template
      ></el-dialog
    >
  </section>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  List,
  MapLocation,
  Location,
  LocationFilled,
  Plus,
  Search,
  Setting,
} from '@element-plus/icons-vue'
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import CrmStoreMap from './CrmStoreMap.vue'
import CrmVisitEvidence from './CrmVisitEvidence.vue'
import {
  crmStoreApi,
  type StoreContext,
  type StoreCoverage,
  type StoreEvent,
  type StoreLead,
  type StoreOwnership,
  type StoreQuery,
  type StoreRow,
  type StoreView,
  type StoreVisit,
} from '@/api/core/crm-store'
import { getEffectiveBizDict, type DictItemView } from '@/api/core/business-settings'
import { GEO_REGIONS, remainingTime, storeAreaOptions, storeMapUrl } from '@/utils/crm-store'

const route = useRoute()
const view = computed<StoreView>(
  () =>
    (({
      public: 'PUBLIC',
      mine: 'MINE',
      cooperated: 'COOPERATED',
      leads: 'LEADS',
      library: 'ALL',
      analysis: 'COVERAGE',
    })[String(route.path.split('/').at(-1))] as StoreView) ?? 'PUBLIC',
)
const title = computed(
  () =>
    ({
      PUBLIC: '公海',
      MINE: '我的客户',
      TEAM: '团队客户',
      COOPERATED: '合作客户',
      ALL: '商家库管理',
      LEADS: '门店提报',
      COVERAGE: '客户经营分析',
    })[view.value],
)
const isList = computed(() => !['LEADS', 'COVERAGE'].includes(view.value))
const displayMode = ref<'list' | 'map'>('list')
const compactMedia = window.matchMedia?.('(max-width: 600px)')
const compactViewport = ref(compactMedia?.matches ?? false)
function updateViewport() {
  compactViewport.value = compactMedia?.matches ?? false
}
onMounted(() => compactMedia?.addEventListener('change', updateViewport))
onBeforeUnmount(() => compactMedia?.removeEventListener('change', updateViewport))
const mapFocusId = ref<string | null>(null)
function locateStore(row: StoreRow) {
  if (!storeMapUrl(row)) return
  detailOpen.value = false
  mapFocusId.value = row.id
  displayMode.value = 'map'
}
const context = ref<StoreContext | null>(null),
  rows = ref<StoreRow[]>([]),
  loading = ref(false),
  error = ref(''),
  total = ref(0)
const filters = reactive({
  keyword: '',
  region: '',
  province: '',
  city: '',
  county: '',
  cooperation: '',
  tier: '',
  activity: '',
  potential: '',
})
const team = ref(false),
  reviewMode = ref(false),
  pageSize = ref(20),
  nextCursor = ref<string | null>(null),
  pageIndex = ref(0),
  cursors = ref<(string | undefined)[]>([undefined])
const areas = computed(() =>
  storeAreaOptions(context.value?.areas ?? [], filters.region, filters.province, filters.city),
)
const optionalColumns = [
  { key: 'type', label: '门店类型' },
  { key: 'area', label: '所属地区' },
  { key: 'lastVisit', label: '最近拜访' },
  { key: 'lastOrder', label: '最近成交' },
  { key: 'activity', label: '交易活跃度' },
  { key: 'phone', label: '公开电话' },
  { key: 'poi', label: '高德 POI' },
  { key: 'created', label: '创建时间 / 创建人' },
  { key: 'updated', label: '修改时间 / 修改人' },
]
const columns = ref(['type', 'area', 'lastVisit', 'lastOrder']),
  shown = (key: string) => columns.value.includes(key)
const now = ref(Date.now()),
  timer = setInterval(() => {
    now.value = Date.now()
  }, 30000)
let loadGeneration = 0,
  detailGeneration = 0
onBeforeUnmount(() => {
  clearInterval(timer)
  loadGeneration++
  detailGeneration++
})
const can = (permission: string) => context.value?.permissions.includes(permission) === true
const effectiveView = computed<StoreView>(() =>
  view.value === 'MINE' && team.value ? 'TEAM' : view.value,
)
const activityLabels: Record<string, string> = {
  ACTIVE: '活跃',
  DORMANT: '沉睡',
  NEVER_ORDERED: '从未成交',
  UNKNOWN: '待核实',
}
const potentialLabels: Record<string, string> = {
  HIGH: '高潜力',
  MEDIUM: '中潜力',
  LOW: '低潜力',
  UNKNOWN: '潜力未知',
}
const phaseLabels: Record<string, string> = {
  FIRST_VISIT: '首次有效拜访',
  FOLLOW_UP: '持续有效跟进',
  COOPERATING: '合作维护',
}
const leadLabels: Record<string, string> = {
  PENDING_REVIEW: '待审核',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  WITHDRAWN: '已撤回',
}
const eventLabels: Record<string, string> = {
  PROFILE_UPDATED: '门店资料修改',
  CLAIMED: '认领到私海',
  RELEASED: '退回公海',
  AUTO_RELEASED: '到期自动回公海',
  PROTECTION_UPDATED: '保护期限更新',
  RECOVERY_HELD: '暂缓回收',
  ORDER_AUTHORIZED: '订单作业授权',
  VISIT_CHECKED_IN: '拜访签到',
  VISIT_SUBMITTED: '提交拜访',
  VISIT_CANCELLED: '取消未完成拜访',
  VISIT_EFFECTIVE: '拜访有效',
  VISIT_INVALID: '拜访无效',
  VISIT_VOID: '撤销拜访有效性',
  SUBMITTED: '提交门店',
  APPROVED: '审核通过',
  REJECTED: '审核驳回',
}
const holdLabels: Record<string, string> = {
  SOURCE_UNAVAILABLE: '拜访或订单来源暂不可用，系统将重试核验，暂缓回收',
  PENDING_REVIEW: '拜访待核验，暂缓回收',
  PENDING_ORDER: '订单正在受理，暂缓回收',
}
function visitReviewReason(reason: string) {
  const labels: Record<string, string> = {
    VISIT_TIME_INVALID: '到店、离店时间异常',
    RESULT_MISSING: '待提交拜访结果',
    CONTACT_NOT_CONFIRMED: '未确认接触负责人',
    DWELL_TOO_SHORT: '停留时长不足',
    STOREFRONT_PHOTO_MISSING: '缺少有效门头照',
    RECORDING_UNVERIFIED: '录音待核验',
    RECORDING_TOO_SHORT: '录音时长不足',
    AI_PENDING: '智能核验处理中',
    AI_REVIEW_REQUIRED: '智能核验发现异常',
    AI_LOW_CONFIDENCE: '智能核验置信度不足',
  }
  return reason
    .split(',')
    .map((code) => labels[code.trim()] ?? code)
    .join('；')
}
const visitLabels: Record<string, string> = {
  IN_PROGRESS: '拜访中',
  SUBMITTED: '待核验',
  EFFECTIVE: '有效',
  INVALID: '无效',
  VOID: '已撤销',
}
const acquireLabels: Record<string, string> = {
  CLAIM: '认领',
  ASSIGN: '分配',
  TRANSFER: '转移',
  INITIALIZATION: '初始化',
}
const endReasonLabels: Record<string, string> = {
  VOLUNTARY_RETURN: '主动退回',
  FIRST_VISIT_TIMEOUT: '24小时未首访或成交',
  FOLLOWUP_TIMEOUT: '7天未复访或成交',
  COOPERATION_TIMEOUT: '60天未拜访或复购',
}
const storeTypes = ref<DictItemView[]>([])
function typeName(code: string | null) {
  return code
    ? (storeTypes.value.find((t) => t.dictionaryItemCode === code)?.dictionaryItemName ?? code)
    : '未分类'
}
const dateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
    : '—'
const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }) : '—'
const actor = (value: string) =>
  (
    ({
      SYSTEM: '系统',
      CRM_LIFECYCLE: '归属自动任务',
      SALES_EVIDENCE: '销售证据自动核验',
    }) as Record<string, string>
  )[value] ||
  value ||
  '未知'
const nearDeadline = (value: string | null) =>
  !!value && Date.parse(value) - now.value < 24 * 3600000
const rate = (part: number, all: number) => (all ? `${((part / all) * 100).toFixed(1)}%` : '—')
const message = (e: unknown) => (e instanceof Error ? e.message : '请求失败，请稍后重试')
function tierDescription(row: StoreRow) {
  return row.customerTier === 'UNRATED'
    ? ({
        DATA_INCOMPLETE: '订单来源尚未核验完整',
        NO_COOPERATION: '从未成交，保持未评级',
        RULE_PENDING: '分层规则尚未发布',
      }[row.tierUnratedReason ?? ''] ?? '尚未完成评级')
    : '近365天净成交额：A≥3000元；1000≤B<3000元；已合作且低于1000元为C，含零成交老客户。'
}
function pretty(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}
function query(): StoreQuery {
  return {
    view: effectiveView.value,
    ...filters,
    cursor: cursors.value[pageIndex.value],
    size: pageSize.value,
  }
}
function changeRegion() {
  filters.province = ''
  filters.city = ''
  filters.county = ''
}
function changeProvince() {
  filters.city = ''
  filters.county = ''
}
function resetFilters() {
  Object.keys(filters).forEach((key) => {
    filters[key as keyof typeof filters] = ''
  })
  void search()
}
function search() {
  pageIndex.value = 0
  cursors.value = [undefined]
  return loadRows()
}
async function changeTeam() {
  await reload()
}
async function loadRows() {
  const generation = ++loadGeneration
  loading.value = true
  error.value = ''
  rows.value = []
  mapFocusId.value = null
  try {
    if (view.value === 'COVERAGE') {
      const result = await crmStoreApi.coverage(query())
      if (generation === loadGeneration) coverage.value = result
    } else {
      const result = await crmStoreApi.list(query())
      if (generation === loadGeneration) {
        rows.value = result.items
        total.value = result.total
        nextCursor.value = result.nextCursor
      }
    }
  } catch (e) {
    if (generation === loadGeneration) {
      error.value = message(e)
      total.value = 0
      nextCursor.value = null
      coverage.value = null
    }
  } finally {
    if (generation === loadGeneration) loading.value = false
  }
}
async function reload() {
  const generation = ++loadGeneration
  loading.value = true
  error.value = ''
  context.value = null
  rows.value = []
  total.value = 0
  leads.value = []
  coverage.value = null
  detailOpen.value = false
  try {
    const result = await crmStoreApi.context(effectiveView.value)
    if (generation !== loadGeneration) return
    context.value = result
    if (view.value === 'LEADS') await loadLeads()
    else await search()
    const dictionaryGeneration = loadGeneration
    void getEffectiveBizDict('CRM_STORE_TYPE')
      .then((result) => {
        if (dictionaryGeneration === loadGeneration)
          storeTypes.value = result.items.filter((i) => i.enabled !== false)
      })
      .catch(() => {
        if (dictionaryGeneration === loadGeneration) storeTypes.value = []
      })
  } catch (e) {
    if (generation === loadGeneration) error.value = message(e)
  } finally {
    if (generation === loadGeneration) loading.value = false
  }
}
function changePage(page: number) {
  if (page > pageIndex.value + 1) return nextPage()
  if (page < pageIndex.value + 1) return previousPage()
}
async function nextPage() {
  if (!nextCursor.value) return
  cursors.value[pageIndex.value + 1] = nextCursor.value
  pageIndex.value++
  await loadRows()
}
async function previousPage() {
  if (pageIndex.value === 0) return
  pageIndex.value--
  await loadRows()
}
const pendingId = ref(''),
  claimRequests = new Map<string, string>()
async function claim(row: StoreRow) {
  if (pendingId.value || row.claimBlockedReason) return
  const request = claimRequests.get(row.id) ?? crypto.randomUUID()
  claimRequests.set(row.id, request)
  pendingId.value = row.id
  try {
    await crmStoreApi.claim(row.id, row.revision, request)
    claimRequests.delete(row.id)
    ElMessage.success('已认领，可在我的客户中查看')
    detailOpen.value = false
    await search()
  } catch (e) {
    ElMessage.error(message(e))
    await loadRows()
  } finally {
    pendingId.value = ''
  }
}
const selected = ref<StoreRow | null>(null),
  detailOpen = ref(false),
  detailLoading = ref(false),
  detailTab = ref('profile'),
  ownerships = ref<StoreOwnership[]>([]),
  events = ref<StoreEvent[]>([]),
  storeVisits = ref<StoreVisit[]>([])
async function openDetail(row: StoreRow) {
  const generation = ++detailGeneration
  selected.value = row
  detailOpen.value = true
  detailLoading.value = true
  detailTab.value = 'profile'
  ownerships.value = []
  events.value = []
  storeVisits.value = []
  try {
    const result = await crmStoreApi.detail(row.id, effectiveView.value)
    if (generation === detailGeneration) selected.value = result
  } catch (e) {
    if (generation === detailGeneration) {
      selected.value = null
      detailOpen.value = false
      ElMessage.error(message(e))
    }
  } finally {
    if (generation === detailGeneration) detailLoading.value = false
  }
}
async function loadHistory() {
  const row = selected.value,
    tab = detailTab.value,
    generation = detailGeneration
  if (!row || tab === 'profile') return
  detailLoading.value = true
  try {
    if (tab === 'visits') {
      const result = await crmStoreApi.visits(row.id, effectiveView.value)
      if (generation === detailGeneration) storeVisits.value = result
    } else if (tab === 'ownership') {
      const result = await crmStoreApi.ownerships(row.id, effectiveView.value)
      if (generation === detailGeneration) ownerships.value = result
    } else {
      const result = await crmStoreApi.events(row.id, effectiveView.value)
      if (generation === detailGeneration) events.value = result
    }
  } catch (e) {
    ElMessage.error(message(e))
  } finally {
    if (generation === detailGeneration) detailLoading.value = false
  }
}
async function reviewVisit(visit: StoreVisit, decision: string) {
  if (!selected.value) return
  try {
    const { value } = await ElMessageBox.prompt(
      '请填写核验依据。有效性变化会按原签到时间重算保护期。',
      '核验拜访',
      { inputValidator: (value) => !!value?.trim() || '请填写依据' },
    )
    await crmStoreApi.reviewVisit(selected.value.id, visit, decision, value)
    selected.value = await crmStoreApi.detail(selected.value.id, effectiveView.value)
    await loadHistory()
    await search()
    ElMessage.success('拜访核验已保存')
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(message(e))
  }
}
async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    ElMessage.success('已复制')
  } catch {
    ElMessage.warning('复制失败，请手动选择复制')
  }
}
async function release(row: StoreRow) {
  try {
    const { value } = await ElMessageBox.prompt(
      '退回后本人48小时内无法重新认领，业务历史保留。请填写原因。',
      '退回公海',
      { inputValidator: (value) => !!value?.trim() || '请填写原因' },
    )
    await crmStoreApi.release(row.id, row.revision, value)
    ElMessage.success('已退回公海')
    detailOpen.value = false
    await search()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(message(e))
  }
}
const leads = ref<StoreLead[]>([]),
  coverage = ref<StoreCoverage | null>(null)
async function loadLeads() {
  const generation = ++loadGeneration
  loading.value = true
  error.value = ''
  try {
    const result = await crmStoreApi.leads(reviewMode.value)
    if (generation === loadGeneration) leads.value = result
  } catch (e) {
    if (generation === loadGeneration) error.value = message(e)
  } finally {
    if (generation === loadGeneration) loading.value = false
  }
}
async function reviewLead(row: StoreLead, approve: boolean) {
  try {
    const { value } = await ElMessageBox.prompt(
      '请填写审核依据。通过后门店进入公海，不会自动认领。',
      approve ? '审核通过' : '审核驳回',
      { inputValidator: (value) => !!value?.trim() || '请填写审核意见' },
    )
    await crmStoreApi.review(row.id, row.revision, approve, value)
    ElMessage.success('审核完成')
    await loadLeads()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(message(e))
  }
}
const createOpen = ref(false),
  saving = ref(false),
  form = reactive({
    requestId: '',
    name: '',
    address: '',
    areaCode: '',
    longitude: undefined as number | undefined,
    latitude: undefined as number | undefined,
    publicPhone: '',
  })
const formAreas = computed(() =>
  (context.value?.areas ?? []).filter(
    (a) =>
      a.level === 'COUNTY' ||
      (a.level === 'PREFECTURE' &&
        !(context.value?.areas ?? []).some((n) => n.parentCode === a.code)),
  ),
)
function areaPath(code: string) {
  const nodes = context.value?.areas ?? []
  const names: string[] = []
  const seen = new Set<string>()
  for (
    let a = nodes.find((n) => n.code === code);
    a && !seen.has(a.code);
    a = nodes.find((n) => n.code === a?.parentCode)
  ) {
    seen.add(a.code)
    names.unshift(a.name)
  }
  return names.join(' / ')
}
function openCreate() {
  Object.assign(form, {
    requestId: crypto.randomUUID(),
    name: '',
    address: '',
    areaCode: '',
    longitude: undefined,
    latitude: undefined,
    publicPhone: '',
  })
  createOpen.value = true
}
async function submitLead() {
  if (
    !form.name.trim() ||
    !form.address.trim() ||
    !form.areaCode ||
    form.longitude == null ||
    form.latitude == null
  ) {
    ElMessage.warning('请补全门店名称、地址、行政地区和位置')
    return
  }
  saving.value = true
  try {
    await crmStoreApi.submit({
      ...form,
      longitude: form.longitude,
      latitude: form.latitude,
      publicPhone: form.publicPhone || null,
    })
    ElMessage.success('已提交审核')
    createOpen.value = false
    if (view.value === 'LEADS') await loadLeads()
  } catch (e) {
    ElMessage.error(message(e))
  } finally {
    saving.value = false
  }
}
const editOpen = ref(false),
  editing = ref<StoreRow | null>(null),
  editReason = ref('')
function openEdit() {
  editing.value = selected.value ? { ...selected.value } : null
  editReason.value = ''
  editOpen.value = true
}
async function saveEdit() {
  if (!editing.value || !editReason.value.trim()) {
    ElMessage.warning('请填写修改原因')
    return
  }
  saving.value = true
  try {
    await crmStoreApi.update(editing.value, editReason.value)
    editOpen.value = false
    ElMessage.success('已保存并记录变更')
    await openDetail(editing.value)
    await loadRows()
  } catch (e) {
    ElMessage.error(message(e))
  } finally {
    saving.value = false
  }
}
async function initializePolicy() {
  try {
    await ElMessageBox.confirm(
      '启用已确认的24小时首访、7天跟进、本轮成交后60天维护及48小时冷却规则。仅用于新认领，不改变旧客户归属。',
      '启用认领规则',
    )
    await crmStoreApi.initializePolicy()
    ElMessage.success('认领规则已启用')
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(message(e))
  }
}
let activatedOnce = false
onActivated(() => {
  // 认领、退回及权限维护可能发生在其他页签，重新打开时刷新并保留当前筛选。
  if (activatedOnce) void reload()
  activatedOnce = true
})
watch(
  () => route.path,
  () => {
    team.value = false
    reviewMode.value = false
    Object.keys(filters).forEach((key) => {
      filters[key as keyof typeof filters] = ''
    })
    void reload()
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;
.store-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  gap: 12px;
  color: $color-text-primary;
}
.store-heading,
.store-heading-title,
.heading-actions,
.row-actions,
.table-footer,
.detail-tags,
.drawer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.store-heading {
  flex: none;
  justify-content: space-between;
  flex-wrap: wrap;
}
.store-heading-title,
.heading-actions {
  flex-wrap: wrap;
}
.heading-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.heading-actions :deep(.el-radio-button__inner) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.store-heading h1 {
  font-size: 20px;
  line-height: 32px;
  margin: 0;
  font-weight: 600;
}
.scope-label {
  display: flex;
  align-items: center;
  gap: 4px;
  color: $color-text-secondary;
  font-size: 13px;
}
.scope-label .el-icon {
  color: $color-primary;
}
.page-alert {
  flex: none;
}
.store-filters {
  flex: none;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  overflow: visible;
}
.store-filters :deep(.el-card__body) {
  padding: 0;
}
.store-filters :deep(.order-register-filter__fields) {
  gap: 8px;
  max-height: 35dvh;
  overflow-y: auto;
}
.store-filters :deep(.order-register-filter__fields.is-collapsed) {
  max-height: var(--order-filter-row-height, 34px);
  overflow: hidden;
}
.store-filters :deep(.order-register-filter__actions .el-button + .el-button) {
  margin-left: 0;
}
.store-filters .el-select {
  flex: 0 1 150px;
  width: 150px;
  min-width: 0;
  max-width: 100%;
}
.store-filters .keyword-input {
  flex: 0 1 260px;
  width: 260px;
  min-width: 0;
  max-width: 100%;
}
.column-options {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.store-table-surface,
.coverage-surface {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  flex: 1;
}
.store-table-surface {
  display: flex;
  flex-direction: column;
}
.store-table-viewport {
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.store-table {
  --el-table-header-bg-color: #f3f6fb;
  --el-table-border-color: #e8edf5;
  --el-table-row-hover-bg-color: #f4f8ff;
  font-size: 14px;
}
.store-table :deep(th.el-table__cell) {
  height: 40px;
  color: #243550;
  font-weight: 600;
}
.store-table :deep(td.el-table__cell) {
  padding: 10px 0;
}
.store-table :deep(.cell) {
  padding-left: 14px;
  padding-right: 14px;
}
.store-identity {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.store-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0;
  border: 0;
  background: none;
  color: #0f172a;
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
}
.store-name:hover {
  color: #2563eb;
}
.store-name:focus-visible,
.store-address:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 3px;
}
.store-identity .el-tag--success {
  --el-tag-bg-color: #ddf7e9;
  --el-tag-text-color: #168052;
}
.store-identity .el-tag {
  flex: none;
  white-space: nowrap;
  border: 0;
  border-radius: 4px;
}
.store-address {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 4px;
  color: $color-text-secondary;
  font-size: 13px;
  text-decoration: none;
  line-height: 20px;
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
}
button.store-address {
  cursor: pointer;
}
.store-address .el-icon {
  flex: none;
  margin-top: 3px;
}
button.store-address:hover {
  color: #2563eb;
}
.area-line,
.secondary-line {
  display: block;
  font-size: 13px;
  line-height: 22px;
}
.secondary-line {
  color: #8490a3;
}
.actor {
  word-break: break-all;
}
.urgent {
  color: #b45309;
}
.row-actions {
  gap: 4px;
}
.row-actions .el-button + .el-button {
  margin-left: 6px;
}
.table-footer {
  flex: none;
  padding: 8px 12px;
  min-height: 48px;
  border-top: 1px solid $color-border-base;
}
.table-footer .el-pagination {
  flex: 1;
  min-width: 0;
  gap: 8px;
  font-variant-numeric: tabular-nums;
}
.table-footer :deep(.el-pagination__sizes),
.table-footer :deep(.btn-prev) {
  margin-left: 0;
}
.page-position {
  min-width: 44px;
  text-align: center;
  color: $color-text-regular;
  font-size: 13px;
}
.muted {
  color: #64748b;
  font-size: 13px;
}
.lead-toolbar {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 12px;
  flex: none;
  flex-wrap: wrap;
}
.coverage-surface {
  overflow: auto;
  padding: 16px;
}
.detail-tags {
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.map-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #2563eb;
  border: 0;
  background: none;
  cursor: pointer;
  padding: 0;
  font: inherit;
}
.store-detail pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  background: #f8fafc;
  padding: 12px;
}
.store-form {
  margin-top: 20px;
}
.store-form .el-select {
  width: 100%;
}
.coordinate-inputs {
  display: flex;
  gap: 24px;
}
.coordinate-inputs .el-form-item {
  flex: 1;
}
.coordinate-inputs .el-input-number {
  width: 100%;
}
.drawer-actions {
  justify-content: flex-end;
}
@media (max-width: 600px) {
  .store-workspace {
    gap: 8px;
  }
  .store-heading {
    gap: 8px;
  }
  .store-heading-title {
    width: 100%;
  }
  .heading-actions {
    gap: 6px;
  }
  .heading-actions :deep(.el-button) {
    padding-inline: 10px;
  }
  .column-settings-label {
    display: none;
  }
  .heading-actions :deep(.el-button[aria-label='列设置'] > span) {
    display: none;
  }
  .store-filters :deep(.order-register-filter__line) {
    gap: 8px;
  }
  .store-filters :deep(.order-register-filter__actions) {
    gap: 4px;
  }
  .store-filters :deep(.order-register-filter__actions .el-button) {
    padding-inline: 8px;
  }
  .table-footer {
    padding: 8px;
  }
  .table-footer .el-pagination {
    gap: 4px;
    flex-wrap: wrap;
  }
  .table-footer :deep(.el-pagination__sizes .el-select) {
    width: 100px;
  }
  .coordinate-inputs {
    gap: 12px;
  }
}
</style>
