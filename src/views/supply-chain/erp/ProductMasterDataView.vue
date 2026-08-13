<template>
  <div class="master-data-page">
    <el-card shadow="never">
      <template #header>
        <div class="page-header">
          <div>
            <span>ERP · 商品与主数据</span>
            <h1>{{ page.title }}</h1>
            <p>{{ page.description }}</p>
          </div>
          <el-button v-if="canSync" type="primary" :loading="syncing" @click="synchronize">
            同步{{ page.syncLabel }}
          </el-button>
        </div>
      </template>

      <el-alert
        class="boundary-alert"
        type="info"
        :closable="false"
        show-icon
        title="数据均来自 ERP 本地库；点击“同步商品”可从订货宝刷新，Portal 不保存订货宝凭据。"
      />

      <div class="query-panel">
        <el-form class="query-bar" inline @submit.prevent="query">
          <el-form-item label="关键词">
            <el-input
              v-model="filters.keyword"
              clearable
              :placeholder="`搜索${page.codeLabel}或名称`"
              @keyup.enter="query"
            />
          </el-form-item>
          <el-form-item label="内部状态">
            <el-select v-model="filters.status" clearable placeholder="全部" style="width: 130px">
              <el-option label="启用" value="ACTIVE" />
              <el-option label="停用" value="INACTIVE" />
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="page.viewType === 'PRODUCT' || page.viewType === 'SKU'"
            label="来源上架"
          >
            <el-select
              v-model="filters.sourcePutaway"
              clearable
              placeholder="全部"
              style="width: 130px"
            >
              <el-option label="已上架" value="T" />
              <el-option label="已下架" value="F" />
              <el-option label="全部" value="A" />
            </el-select>
          </el-form-item>
          <el-form-item class="query-actions">
            <el-button type="primary" :loading="loading" @click="query">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <div class="result-heading">
        <div>
          <h2>{{ resultTitle }}</h2>
          <p v-if="page.viewType === 'PRODUCT'">
            共 {{ data.total }} 个商品，本页 {{ data.items.length }} 个；点击商品行可查看完整资料与
            SKU。
          </p>
          <p v-else-if="page.viewType === 'CATEGORY'">
            共 {{ categoryMatchCount }} 个匹配分类，当前展示 {{ categoryVisibleCount }} 个层级节点；展开父级可查看子分类。
          </p>
          <p v-else>
            共 {{ data.total }} 条数据，本页 {{ data.items.length }} 条；点击数据行可查看完整资料。
          </p>
        </div>
        <div v-if="page.viewType === 'PRODUCT'" class="page-status-summary">
          <span><i class="status-dot is-online" />本页上架 {{ productPageStats.putaway }}</span>
          <span><i class="status-dot is-offline" />本页下架 {{ productPageStats.offShelf }}</span>
        </div>
        <div v-else-if="page.viewType === 'CATEGORY'" class="page-status-summary">
          <span><i class="status-dot is-online" />根分类 {{ categoryRootCount }}</span>
          <span><i class="status-dot" />最深 {{ categoryMaxLevel }} 级</span>
        </div>
      </div>

      <el-table
        v-if="page.viewType === 'PRODUCT'"
        v-loading="loading"
        class="product-table"
        :data="data.items"
        row-key="id"
        @row-click="openProductDetail"
      >
        <el-table-column label="商品信息" width="280" fixed="left">
          <template #default="scope">
            <div class="product-identity">
              <div class="product-thumb-wrap" @click.stop>
                <el-image
                  v-if="scope.row.product?.images?.[0]?.url"
                  class="product-thumb"
                  :src="scope.row.product.images[0].url"
                  fit="cover"
                  :preview-src-list="
                    scope.row.product.images.map((image) => image.url).filter(Boolean)
                  "
                  preview-teleported
                />
                <span v-else class="product-thumb-placeholder">暂无图片</span>
              </div>
              <div class="product-identity-content">
                <div class="product-name" :title="scope.row.name">{{ scope.row.name }}</div>
                <div class="product-code">SPU {{ valueOrDash(scope.row.code) }}</div>
                <div class="product-meta-line">
                  <span>来源 {{ valueOrDash(scope.row.sourceId) }}</span>
                  <span v-if="scope.row.product?.model">型号 {{ scope.row.product.model }}</span>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="品牌" min-width="200">
          <template #default="scope">
            <span class="hierarchy-primary" :title="valueOrDash(scope.row.product?.brandName)">
              {{ valueOrDash(scope.row.product?.brandName) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="分类" min-width="130">
          <template #default="scope">
            <span class="hierarchy-secondary" :title="valueOrDash(scope.row.product?.categoryName)">
              {{ valueOrDash(scope.row.product?.categoryName) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="SKU 与包装" min-width="180">
          <template #default="scope">
            <div class="sku-package-cell">
              <span class="sku-count">{{ scope.row.product?.skuCount ?? 0 }} 个 SKU</span>
              <span>基础单位：{{ valueOrDash(scope.row.product?.unit) }}</span>
              <span class="cell-secondary compact-line">{{
                packageSummary(scope.row.product)
              }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="核心价格" min-width="160" align="right" header-align="right">
          <template #default="scope">
            <div class="price-cell">
              <strong>{{ money(scope.row.product?.orderPrice) }}</strong>
              <span>订货价</span>
              <small>市场 {{ money(scope.row.product?.marketPrice) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="订货规则" min-width="165">
          <template #default="scope">
            <div class="ordering-cell">
              <span>起订 {{ minimumOrderSummary(scope.row.product) }}</span>
              <small>安全库存 {{ quantity(scope.row.product?.safetyInventory) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="112">
          <template #default="scope">
            <div class="status-cell">
              <el-tag
                :type="putawayTagType(scope.row.product?.sourcePutaway)"
                effect="light"
                size="small"
              >
                {{ putawayLabel(scope.row.product?.sourcePutaway) }}
              </el-tag>
              <span :class="['internal-status', scope.row.status === 'ACTIVE' ? 'is-active' : '']">
                {{ statusLabel(scope.row.status) }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="最后同步" width="150">
          <template #default="scope">
            <span class="sync-time">{{ formatTime(scope.row.syncedAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="96" fixed="right" align="center">
          <template #default="scope">
            <el-button link type="primary" @click.stop="openProductDetail(scope.row)"
              >详情</el-button
            >
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无本地商品，可点击右上角同步商品" />
        </template>
      </el-table>

      <el-table
        v-else
        v-loading="loading"
        class="product-table master-table"
        :data="data.items"
        row-key="id"
        :tree-props="{ children: 'children' }"
        :expand-row-keys="page.viewType === 'CATEGORY' ? categoryDefaultExpandedKeys : undefined"
        @row-click="openMasterDetail"
      >
        <el-table-column :label="masterIdentityLabel" width="280" fixed="left">
          <template #default="scope">
            <div class="master-identity">
              <span class="master-avatar">{{ scope.row.name.slice(0, 1) || '?' }}</span>
              <div class="master-identity-content">
                <div class="product-name" :title="scope.row.name">{{ scope.row.name }}</div>
                <div class="product-code">{{ page.codeLabel }} {{ valueOrDash(scope.row.code) }}</div>
                <div class="product-meta-line">来源 {{ valueOrDash(scope.row.sourceId) }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="page.viewType === 'CATEGORY'"
          label="层级路径"
          min-width="300"
          show-overflow-tooltip
        >
          <template #default="scope">
            <div class="hierarchy-cell">
              <span>{{ scope.row.path }}</span>
              <small v-if="scope.row.isFilterContext">匹配项的上级分类</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column v-else-if="page.viewType === 'SKU'" label="所属商品 / 规格" min-width="260">
          <template #default="scope">
            <div class="stacked-cell">
              <span>{{ valueOrDash(scope.row.sku?.productName) }}</span>
              <small>SPU {{ valueOrDash(scope.row.sku?.spuCode) }} · {{ valueOrDash(scope.row.attribute) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column v-else :label="page.attributeLabel" min-width="220">
          <template #default="scope">
            <div class="stacked-cell">
              <span>{{ valueOrDash(scope.row.attribute) }}</span>
              <small>{{ valueOrDash(scope.row.detail) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column v-if="page.viewType === 'SKU'" label="单位与条码" min-width="175">
          <template #default="scope">
            <div class="stacked-cell">
              <span>单位 {{ valueOrDash(scope.row.sku?.unit) }}</span>
              <small>{{ valueOrDash(scope.row.sku?.barcode) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column v-if="page.viewType === 'SKU'" label="核心价格" min-width="160" align="right" header-align="right">
          <template #default="scope">
            <div class="price-cell">
              <strong>{{ money(scope.row.sku?.orderPrice) }}</strong>
              <span>订货价</span>
              <small>市场 {{ money(scope.row.sku?.marketPrice) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column v-if="page.viewType === 'CATEGORY'" label="层级关系" width="150">
          <template #default="scope">
            <div class="stacked-cell">
              <el-tag size="small" effect="plain">第 {{ scope.row.level }} 级</el-tag>
              <small>{{ scope.row.childCount }} 个直接子分类</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column v-if="page.viewType === 'SPECIFICATION'" label="规格值" min-width="240">
          <template #default="scope">
            <div class="value-tags">
              <el-tag
                v-for="value in scope.row.specification?.values.slice(0, 4)"
                :key="value.id"
                size="small"
                effect="plain"
              >{{ value.valueName }}</el-tag>
              <span v-if="(scope.row.specification?.values.length ?? 0) > 4">+{{ (scope.row.specification?.values.length ?? 0) - 4 }}</span>
              <span v-if="!scope.row.specification?.values.length" class="cell-secondary">暂无规格值</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column v-if="page.viewType === 'TAG'" label="关联商品" width="120">
          <template #default="scope"><strong>{{ scope.row.tag?.sourceRelationCount ?? 0 }}</strong> 个</template>
        </el-table-column>
        <el-table-column v-if="page.viewType === 'BRAND'" label="来源排序" width="120">
          <template #default="scope">{{ valueOrDash(scope.row.brand?.sourceSortOrder) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="132">
          <template #default="scope">
            <div class="status-cell">
              <el-tag :type="scope.row.status === 'ACTIVE' ? 'success' : 'info'" effect="light" size="small">
                {{ statusLabel(scope.row.status) }}
              </el-tag>
              <span class="ownership-text">{{ ownershipLabel(scope.row.ownershipState) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="最后同步" width="150">
          <template #default="scope"><span class="sync-time">{{ formatTime(scope.row.syncedAt) }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="96" fixed="right" align="center">
          <template #default="scope">
            <el-button link type="primary" @click.stop="openMasterDetail(scope.row)">详情</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无本地数据，可点击右上角按当前类型同步" />
        </template>
      </el-table>

      <el-pagination
        v-if="page.viewType !== 'CATEGORY'"
        class="pagination"
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="data.total"
        :current-page="currentPage"
        :page-size="pageSize"
        :page-sizes="[20, 50, 100]"
        @current-change="changeCurrentPage"
        @size-change="changePageSize"
      />
    </el-card>

    <el-drawer
      v-model="productDrawerVisible"
      class="product-detail-drawer"
      size="min(1080px, 92vw)"
      :with-header="false"
    >
      <div v-if="selectedProduct?.product" class="product-detail">
        <header class="detail-hero">
          <div class="detail-hero-main">
            <el-image
              v-if="selectedProduct.product.images?.[0]?.url"
              class="detail-cover"
              :src="selectedProduct.product.images[0].url"
              fit="cover"
              :preview-src-list="
                selectedProduct.product.images.map((image) => image.url).filter(Boolean)
              "
              preview-teleported
            />
            <div v-else class="detail-cover detail-cover-placeholder">暂无图片</div>
            <div class="detail-title-block">
              <span class="detail-eyebrow">商品详情</span>
              <h2>{{ selectedProduct.name }}</h2>
              <p>
                SPU {{ valueOrDash(selectedProduct.code) }} · 来源
                {{ valueOrDash(selectedProduct.sourceId) }}
              </p>
              <div class="detail-tags">
                <el-tag
                  :type="putawayTagType(selectedProduct.product.sourcePutaway)"
                  effect="light"
                >
                  {{ putawayLabel(selectedProduct.product.sourcePutaway) }}
                </el-tag>
                <el-tag
                  :type="selectedProduct.status === 'ACTIVE' ? 'success' : 'info'"
                  effect="plain"
                >
                  内部{{ statusLabel(selectedProduct.status) }}
                </el-tag>
                <el-tag effect="plain">{{ selectedProduct.product.skuCount }} 个 SKU</el-tag>
              </div>
            </div>
          </div>
          <el-button
            class="detail-close"
            circle
            plain
            aria-label="关闭商品详情"
            @click="productDrawerVisible = false"
            >×</el-button
          >
        </header>

        <div class="detail-metrics">
          <div class="metric-card">
            <span>基础订货价</span>
            <strong>{{ money(selectedProduct.product.orderPrice) }}</strong>
          </div>
          <div class="metric-card">
            <span>最低订量</span>
            <strong>{{ minimumOrderSummary(selectedProduct.product) }}</strong>
          </div>
          <div class="metric-card">
            <span>基础单位</span>
            <strong>{{ valueOrDash(selectedProduct.product.unit) }}</strong>
          </div>
          <div class="metric-card">
            <span>最后同步</span>
            <strong class="metric-time">{{ formatTime(selectedProduct.syncedAt) }}</strong>
          </div>
        </div>

        <el-tabs v-model="detailTab" class="detail-tabs">
          <el-tab-pane label="商品概览" name="overview">
            <section class="detail-section">
              <div class="section-heading">
                <h3>基础资料</h3>
                <p>商品识别、归属和运营信息</p>
              </div>
              <dl class="info-grid">
                <div>
                  <dt>品牌</dt>
                  <dd>{{ valueOrDash(selectedProduct.product.brandName) }}</dd>
                </div>
                <div>
                  <dt>分类</dt>
                  <dd>{{ valueOrDash(selectedProduct.product.categoryName) }}</dd>
                </div>
                <div>
                  <dt>型号</dt>
                  <dd>{{ valueOrDash(selectedProduct.product.model) }}</dd>
                </div>
                <div>
                  <dt>货位</dt>
                  <dd>{{ valueOrDash(selectedProduct.product.goodsAllocation) }}</dd>
                </div>
                <div>
                  <dt>基础条码</dt>
                  <dd>{{ valueOrDash(selectedProduct.product.barcode) }}</dd>
                </div>
                <div>
                  <dt>换算条码</dt>
                  <dd>{{ valueOrDash(selectedProduct.product.conversionBarcode) }}</dd>
                </div>
                <div class="info-span-2">
                  <dt>副标题</dt>
                  <dd>{{ valueOrDash(selectedProduct.product.subtitle) }}</dd>
                </div>
                <div>
                  <dt>关键词</dt>
                  <dd>{{ valueOrDash(selectedProduct.product.keywords) }}</dd>
                </div>
                <div>
                  <dt>规格维度</dt>
                  <dd>{{ valueOrDash(selectedProduct.product.sourceMultiId) }}</dd>
                </div>
              </dl>
            </section>

            <section class="detail-section">
              <div class="section-heading">
                <h3>价格体系</h3>
                <p>不同业务口径和包装层级价格</p>
              </div>
              <div class="price-grid">
                <div
                  v-for="price in productPrices(selectedProduct.product)"
                  :key="price.label"
                  class="price-card"
                >
                  <span>{{ price.label }}</span>
                  <strong>{{ price.value }}</strong>
                </div>
              </div>
            </section>

            <section class="detail-section">
              <div class="section-heading">
                <h3>包装与库存</h3>
                <p>单位换算、条码和库存控制值</p>
              </div>
              <div class="package-grid">
                <article class="package-card is-base">
                  <span>基础单位</span>
                  <strong>{{ valueOrDash(selectedProduct.product.unit) }}</strong>
                  <small>条码 {{ valueOrDash(selectedProduct.product.barcode) }}</small>
                </article>
                <article class="package-card">
                  <span>中包装</span>
                  <strong>{{ packageConversion(selectedProduct.product, 'middle') }}</strong>
                  <small>条码 {{ valueOrDash(selectedProduct.product.middleBarcode) }}</small>
                </article>
                <article class="package-card">
                  <span>大包装</span>
                  <strong>{{ packageConversion(selectedProduct.product, 'big') }}</strong>
                  <small>条码 {{ valueOrDash(selectedProduct.product.bigBarcode) }}</small>
                </article>
              </div>
              <dl class="inventory-grid">
                <div>
                  <dt>库存下限</dt>
                  <dd>{{ quantity(selectedProduct.product.inventoryLower) }}</dd>
                </div>
                <div>
                  <dt>安全库存</dt>
                  <dd>{{ quantity(selectedProduct.product.safetyInventory) }}</dd>
                </div>
                <div>
                  <dt>库存上限</dt>
                  <dd>{{ quantity(selectedProduct.product.inventoryUpper) }}</dd>
                </div>
              </dl>
            </section>

            <section
              v-if="selectedProduct.product.images?.some((image) => image.url)"
              class="detail-section"
            >
              <div class="section-heading">
                <h3>商品图片</h3>
                <p>
                  共 {{ selectedProduct.product.images.filter((image) => image.url).length }} 张
                </p>
              </div>
              <div class="product-images">
                <div
                  v-for="image in selectedProduct.product.images.filter((item) => item.url)"
                  :key="image.id"
                  class="product-image-card"
                >
                  <el-image
                    class="product-image"
                    :src="image.url || undefined"
                    :alt="image.originalName || image.sourceFileName || undefined"
                    fit="cover"
                    :preview-src-list="
                      selectedProduct.product.images.map((item) => item.url).filter(Boolean)
                    "
                    preview-teleported
                  />
                  <small>{{ valueOrDash(image.originalName || image.sourceFileName) }}</small>
                </div>
              </div>
            </section>
          </el-tab-pane>

          <el-tab-pane :label="`SKU 明细 (${skuItems.length})`" name="skus">
            <section class="detail-section detail-section-table">
              <div class="section-heading">
                <h3>SKU 明细</h3>
                <p>规格、条码及对应价格</p>
              </div>
              <el-table v-loading="skuLoading" :data="skuItems" class="sku-table">
                <el-table-column label="SKU" min-width="190">
                  <template #default="scope">
                    <strong class="sku-code">{{ valueOrDash(scope.row.skuCode) }}</strong>
                    <small class="cell-secondary"
                      >来源 {{ valueOrDash(scope.row.sourceSkuId) }}</small
                    >
                  </template>
                </el-table-column>
                <el-table-column label="规格" min-width="180">
                  <template #default="scope">
                    <span>{{ valueOrDash(scope.row.specificationSummary) }}</span>
                    <small class="cell-secondary"
                      >组合 {{ valueOrDash(scope.row.optionsId) }}</small
                    >
                  </template>
                </el-table-column>
                <el-table-column label="单位与条码" min-width="180">
                  <template #default="scope">
                    <span>{{ valueOrDash(scope.row.unit) }}</span>
                    <small class="cell-secondary">{{ valueOrDash(scope.row.barcode) }}</small>
                  </template>
                </el-table-column>
                <el-table-column label="价格" min-width="170" align="right" header-align="right">
                  <template #default="scope">
                    <strong>{{ money(scope.row.orderPrice) }}</strong>
                    <small class="cell-secondary"
                      >市场 {{ money(scope.row.marketPrice) }} · 采购
                      {{ money(scope.row.purchasePrice) }}</small
                    >
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="100" align="center">
                  <template #default="scope">
                    <el-tag
                      :type="scope.row.internalStatus === 'ACTIVE' ? 'success' : 'info'"
                      effect="plain"
                      size="small"
                    >
                      {{ statusLabel(scope.row.internalStatus) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <template #empty>
                  <el-empty description="该 SPU 暂无已落库 SKU" />
                </template>
              </el-table>
            </section>
          </el-tab-pane>

          <el-tab-pane label="来源信息" name="source">
            <section class="detail-section">
              <div class="section-heading">
                <h3>订货宝来源关系</h3>
                <p>用于追溯同步数据，不作为日常列表信息</p>
              </div>
              <dl class="info-grid">
                <div>
                  <dt>商品来源 ID</dt>
                  <dd>{{ valueOrDash(selectedProduct.sourceId) }}</dd>
                </div>
                <div>
                  <dt>来源规格维度</dt>
                  <dd>{{ valueOrDash(selectedProduct.product.sourceMultiId) }}</dd>
                </div>
                <div>
                  <dt>来源分类 ID</dt>
                  <dd>{{ valueOrDash(selectedProduct.product.sourceCategoryId) }}</dd>
                </div>
                <div>
                  <dt>来源品牌 ID</dt>
                  <dd>{{ valueOrDash(selectedProduct.product.sourceBrandId) }}</dd>
                </div>
                <div>
                  <dt>来源上下架</dt>
                  <dd>{{ putawayLabel(selectedProduct.product.sourcePutaway) }}</dd>
                </div>
                <div>
                  <dt>主数据主权</dt>
                  <dd>{{ ownershipLabel(selectedProduct.ownershipState) }}</dd>
                </div>
              </dl>
            </section>

            <section class="detail-section">
              <div class="section-heading">
                <h3>订货宝自定义字段</h3>
                <p>完整保留接口返回的非标准字段</p>
              </div>
              <dl
                v-if="customFieldEntries(selectedProduct.product).length"
                class="source-field-grid"
              >
                <div v-for="field in customFieldEntries(selectedProduct.product)" :key="field.key">
                  <dt>{{ field.key }}</dt>
                  <dd>{{ field.value }}</dd>
                </div>
              </dl>
              <el-empty v-else description="暂无自定义来源字段" :image-size="72" />
            </section>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-drawer>

    <el-drawer
      v-model="masterDrawerVisible"
      class="product-detail-drawer"
      size="min(960px, 92vw)"
      :with-header="false"
    >
      <div v-if="selectedMaster" class="product-detail master-detail">
        <header class="detail-hero">
          <div class="detail-hero-main">
            <span class="detail-master-avatar">{{ selectedMaster.name.slice(0, 1) || '?' }}</span>
            <div class="detail-title-block">
              <span class="detail-eyebrow">{{ page.title }}详情</span>
              <h2>{{ selectedMaster.name }}</h2>
              <p>
                {{ page.codeLabel }} {{ valueOrDash(selectedMaster.code) }} · 来源
                {{ valueOrDash(selectedMaster.sourceId) }}
              </p>
              <div class="detail-tags">
                <el-tag
                  :type="selectedMaster.status === 'ACTIVE' ? 'success' : 'info'"
                  effect="light"
                >
                  {{ statusLabel(selectedMaster.status) }}
                </el-tag>
                <el-tag effect="plain">{{ ownershipLabel(selectedMaster.ownershipState) }}</el-tag>
                <el-tag v-if="selectedMaster.category" effect="plain">
                  第 {{ selectedMaster.level }} 级
                </el-tag>
              </div>
            </div>
          </div>
          <el-button
            class="detail-close"
            circle
            plain
            :aria-label="`关闭${page.title}详情`"
            @click="masterDrawerVisible = false"
            >×</el-button
          >
        </header>

        <div class="detail-metrics">
          <div v-for="metric in masterMetrics" :key="metric.label" class="metric-card">
            <span>{{ metric.label }}</span>
            <strong :class="{ 'metric-time': metric.time }">{{ metric.value }}</strong>
          </div>
        </div>

        <el-tabs v-model="masterDetailTab" class="detail-tabs">
          <el-tab-pane label="资料概览" name="overview">
            <section class="detail-section">
              <div class="section-heading">
                <h3>{{ page.title }}资料</h3>
                <p>日常识别和业务使用所需的核心信息</p>
              </div>
              <dl class="info-grid">
                <div
                  v-for="field in masterOverviewFields"
                  :key="field.label"
                  :class="{ 'info-span-2': field.wide }"
                >
                  <dt>{{ field.label }}</dt>
                  <dd>{{ field.value }}</dd>
                </div>
              </dl>
            </section>

            <section
              v-if="selectedMaster.specification"
              class="detail-section detail-section-table"
            >
              <div class="section-heading">
                <h3>规格值</h3>
                <p>共 {{ selectedMaster.specification.valueCount }} 个已落库规格值</p>
              </div>
              <el-table :data="selectedMaster.specification.values" class="sku-table">
                <el-table-column prop="valueName" label="规格值" min-width="180" />
                <el-table-column prop="valueCode" label="编码" min-width="150">
                  <template #default="scope">{{ valueOrDash(scope.row.valueCode) }}</template>
                </el-table-column>
                <el-table-column
                  prop="sourceSpecificationValueId"
                  label="订货宝来源 ID"
                  min-width="180"
                >
                  <template #default="scope">
                    {{ valueOrDash(scope.row.sourceSpecificationValueId) }}
                  </template>
                </el-table-column>
                <el-table-column label="排序" width="90">
                  <template #default="scope">{{ valueOrDash(scope.row.sortOrder) }}</template>
                </el-table-column>
              </el-table>
            </section>
          </el-tab-pane>

          <el-tab-pane label="来源信息" name="source">
            <section class="detail-section">
              <div class="section-heading">
                <h3>订货宝来源关系</h3>
                <p>用于同步追溯，不占用日常列表宽度</p>
              </div>
              <dl class="info-grid">
                <div
                  v-for="field in masterSourceFields"
                  :key="field.label"
                  :class="{ 'info-span-2': field.wide }"
                >
                  <dt>{{ field.label }}</dt>
                  <dd>{{ field.value }}</dd>
                </div>
              </dl>
            </section>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import {
  getErpBrands,
  getErpCategories,
  getErpProducts,
  getErpSkus,
  getErpSpecifications,
  getErpTags,
  syncErpData,
  type ErpBrandView,
  type ErpCategoryView,
  type ErpMasterDataObjectType,
  type ErpPage,
  type ErpProductView,
  type ErpSkuView,
  type ErpSpecificationView,
  type ErpTagView,
} from '@/api'
import { useAuthStore } from '@/stores/auth'

interface PageDefinition {
  routeKey: string
  viewType: 'PRODUCT' | 'SKU' | 'CATEGORY' | 'BRAND' | 'SPECIFICATION' | 'TAG'
  objectType: ErpMasterDataObjectType
  title: string
  syncLabel: string
  description: string
  codeLabel: string
  attributeLabel: string
  detailLabel: string
}

interface DisplayRow {
  id: string
  sourceId: string | null
  code: string | null
  name: string
  attribute: string | null
  detail: string | null
  status: string
  ownershipState: string
  syncedAt: string | null
  product?: ErpProductView
  sku?: ErpSkuView
  category?: ErpCategoryView
  brand?: ErpBrandView
  specification?: ErpSpecificationView
  tag?: ErpTagView
  children?: DisplayRow[]
  path?: string
  level?: number
  childCount?: number
  isFilterContext?: boolean
}

interface DetailField {
  label: string
  value: string
  wide?: boolean
}

const pageDefinitions: PageDefinition[] = [
  {
    routeKey: 'supply.erp.master-data.products',
    viewType: 'PRODUCT',
    objectType: 'PRODUCT_SPU',
    title: '商品/SPU',
    syncLabel: '商品',
    description: '管理 ERP 本地商品模型及订货宝来源关系。',
    codeLabel: 'SPU 编码',
    attributeLabel: '品牌 / 分类',
    detailLabel: '条码 / 单位 / SKU',
  },
  {
    routeKey: 'supply.erp.master-data.skus',
    viewType: 'SKU',
    objectType: 'PRODUCT_SPU',
    title: 'SKU',
    syncLabel: '商品与SKU',
    description: '查询随商品主数据同步落库的 SKU；页面只查询 ERP 本地数据。',
    codeLabel: 'SKU 编码',
    attributeLabel: '规格组合',
    detailLabel: '条码 / 单位 / 规格组合ID',
  },
  {
    routeKey: 'supply.erp.master-data.attributes.categories',
    viewType: 'CATEGORY',
    objectType: 'CATEGORY',
    title: '分类',
    syncLabel: '分类',
    description: '管理商品分类档案；订货宝 getSite 结果作为一期来源。',
    codeLabel: '分类编码',
    attributeLabel: '层级',
    detailLabel: '父分类 ID',
  },
  {
    routeKey: 'supply.erp.master-data.attributes.brands',
    viewType: 'BRAND',
    objectType: 'BRAND',
    title: '品牌',
    syncLabel: '品牌',
    description: '管理 ERP 品牌档案与订货宝品牌来源绑定。',
    codeLabel: '品牌编码',
    attributeLabel: '数据来源',
    detailLabel: '备注',
  },
  {
    routeKey: 'supply.erp.master-data.attributes.specifications',
    viewType: 'SPECIFICATION',
    objectType: 'SPECIFICATION',
    title: '规格与包装',
    syncLabel: '规格与包装',
    description: '管理规格项与规格值；一期由 getMultiOptionsList 同步落库。',
    codeLabel: '规格编码',
    attributeLabel: '规格值数',
    detailLabel: '数据来源',
  },
  {
    routeKey: 'supply.erp.master-data.attributes.tags',
    viewType: 'TAG',
    objectType: 'TAG',
    title: '商品标签',
    syncLabel: '标签',
    description: '管理商品标签；一期由 getGoodsTag 同步落库。',
    codeLabel: '标签编码',
    attributeLabel: '颜色',
    detailLabel: '数据来源',
  },
]

const route = useRoute()
const auth = useAuthStore()
const page = computed(
  () => pageDefinitions.find((item) => item.routeKey === route.meta.routeKey) ?? pageDefinitions[0],
)
const canSync = computed(() => auth.hasPermission('erp:product:write'))
const loading = ref(false)
const syncing = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const filters = reactive({ keyword: '', status: '', sourcePutaway: '' })
const data = ref<ErpPage<DisplayRow>>({ total: 0, begin: 0, step: 20, items: [] })
const productDrawerVisible = ref(false)
const skuLoading = ref(false)
const skuItems = ref<ErpSkuView[]>([])
const selectedProduct = ref<DisplayRow | null>(null)
const detailTab = ref('overview')
const masterDrawerVisible = ref(false)
const selectedMaster = ref<DisplayRow | null>(null)
const masterDetailTab = ref('overview')
const categoryMatchCount = ref(0)
const categoryVisibleCount = ref(0)
const categoryRootCount = ref(0)
const categoryMaxLevel = ref(0)
const categoryDefaultExpandedKeys = ref<string[]>([])
const resultTitle = computed(() => `${page.value.title}列表`)
const masterIdentityLabel = computed(() => {
  if (page.value.viewType === 'CATEGORY') return '分类信息'
  if (page.value.viewType === 'BRAND') return '品牌信息'
  if (page.value.viewType === 'SPECIFICATION') return '规格信息'
  if (page.value.viewType === 'TAG') return '标签信息'
  return 'SKU 信息'
})
const productPageStats = computed(() => ({
  putaway: data.value.items.filter((item) => item.product?.sourcePutaway === 'T').length,
  offShelf: data.value.items.filter((item) => item.product?.sourcePutaway === 'F').length,
}))
const masterMetrics = computed(() => {
  const row = selectedMaster.value
  if (!row) return []
  if (row.sku) {
    return [
      { label: '基础订货价', value: money(row.sku.orderPrice) },
      { label: '所属 SPU', value: valueOrDash(row.sku.spuCode) },
      { label: '基础单位', value: valueOrDash(row.sku.unit) },
      { label: '最后同步', value: formatTime(row.syncedAt), time: true },
    ]
  }
  if (row.category) {
    return [
      { label: '分类层级', value: `第 ${row.level ?? row.category.categoryLevel} 级` },
      { label: '直接子分类', value: `${row.childCount ?? 0} 个` },
      { label: '默认分类', value: row.category.sourceDefaultFlag ? '是' : '否' },
      { label: '最后同步', value: formatTime(row.syncedAt), time: true },
    ]
  }
  if (row.specification) {
    return [
      { label: '规格值', value: `${row.specification.valueCount} 个` },
      { label: '内部状态', value: statusLabel(row.status) },
      { label: '数据主权', value: ownershipLabel(row.ownershipState) },
      { label: '最后同步', value: formatTime(row.syncedAt), time: true },
    ]
  }
  if (row.tag) {
    return [
      { label: '所属分组', value: valueOrDash(row.tag.sourceGroupName) },
      { label: '关联商品', value: `${row.tag.sourceRelationCount ?? 0} 个` },
      { label: '来源排序', value: valueOrDash(row.tag.sourceSortOrder) },
      { label: '最后同步', value: formatTime(row.syncedAt), time: true },
    ]
  }
  return [
    { label: '来源排序', value: valueOrDash(row.brand?.sourceSortOrder) },
    { label: '内部状态', value: statusLabel(row.status) },
    { label: '数据主权', value: ownershipLabel(row.ownershipState) },
    { label: '最后同步', value: formatTime(row.syncedAt), time: true },
  ]
})
const masterOverviewFields = computed<DetailField[]>(() => {
  const row = selectedMaster.value
  if (!row) return []
  if (row.sku) {
    return [
      detailField('所属商品', row.sku.productName, true),
      detailField('所属 SPU', row.sku.spuCode),
      detailField('规格组合', row.sku.specificationSummary),
      detailField('规格组合 ID', row.sku.optionsId),
      detailField('基础单位', row.sku.unit),
      detailField('基础条码', row.sku.barcode),
      detailField('中包装条码', row.sku.middleBarcode),
      detailField('大包装条码', row.sku.bigBarcode),
      detailField('基础订货价', money(row.sku.orderPrice)),
      detailField('市场价', money(row.sku.marketPrice)),
      detailField('采购价', money(row.sku.purchasePrice)),
      detailField('中包装价', money(row.sku.middleOrderPrice)),
      detailField('大包装价', money(row.sku.bigOrderPrice)),
      detailField('来源上下架', putawayLabel(row.sku.sourcePutaway)),
    ]
  }
  if (row.category) {
    return [
      detailField('完整路径', row.path, true),
      detailField('分类层级', `第 ${row.level ?? row.category.categoryLevel} 级`),
      detailField('父分类', categoryParentName(row)),
      detailField('直接子分类', `${row.childCount ?? 0} 个`),
      detailField('默认分类', row.category.sourceDefaultFlag ? '是' : '否'),
      detailField('分类编码', row.category.categoryCode),
    ]
  }
  if (row.brand) {
    return [
      detailField('品牌名称', row.brand.name),
      detailField('品牌编码', row.brand.brandCode),
      detailField('来源排序', row.brand.sourceSortOrder),
      detailField('品牌说明', row.brand.sourceDescription, true),
    ]
  }
  if (row.specification) {
    return [
      detailField('规格名称', row.specification.name),
      detailField('规格编码', row.specification.specificationCode),
      detailField('规格值数', `${row.specification.valueCount} 个`),
    ]
  }
  if (row.tag) {
    return [
      detailField('标签名称', row.tag.name),
      detailField('标签编码', row.tag.tagCode),
      detailField('标签分组', row.tag.sourceGroupName),
      detailField('颜色标识', row.tag.color),
      detailField('来源排序', row.tag.sourceSortOrder),
      detailField('关联商品', `${row.tag.sourceRelationCount ?? 0} 个`),
    ]
  }
  return []
})
const masterSourceFields = computed<DetailField[]>(() => {
  const row = selectedMaster.value
  if (!row) return []
  const common = [
    detailField('订货宝来源 ID', row.sourceId),
    detailField('本地记录 ID', row.id),
    detailField('数据主权', ownershipLabel(row.ownershipState)),
    detailField('内部状态', statusLabel(row.status)),
    detailField('最后同步', formatTime(row.syncedAt)),
  ]
  if (row.sku) {
    return [
      ...common,
      detailField('第一规格值来源 ID', row.sku.firstSpecificationValueSourceId),
      detailField('第二规格值来源 ID', row.sku.secondSpecificationValueSourceId),
    ]
  }
  if (row.category) {
    return [
      ...common,
      detailField('来源父分类 ID', row.category.sourceParentId),
      detailField('本地父分类 ID', row.category.parentId),
      detailField('来源分类编号', row.category.sourceCategoryNumber),
      detailField('外部引用 ID', row.category.externalReferenceId),
    ]
  }
  if (row.brand) {
    return [
      ...common,
      detailField('来源品牌编号', row.brand.sourceBrandNumber),
      detailField('外部引用 ID', row.brand.externalReferenceId),
    ]
  }
  if (row.specification) {
    return [...common, detailField('来源父级 ID', row.specification.sourceParentId)]
  }
  if (row.tag) {
    return [
      ...common,
      detailField('来源分组 ID', row.tag.sourceGroupId),
      detailField('来源创建时间', formatTime(row.tag.sourceCreatedAt)),
      detailField('来源更新时间', formatTime(row.tag.sourceUpdatedAt)),
    ]
  }
  return common
})

onMounted(load)
watch(
  () => route.meta.routeKey,
  async () => {
    currentPage.value = 1
    filters.keyword = ''
    filters.status = ''
    filters.sourcePutaway = ''
    productDrawerVisible.value = false
    masterDrawerVisible.value = false
    await load()
  },
)

async function load() {
  loading.value = true
  if (page.value.viewType === 'CATEGORY') {
    categoryMatchCount.value = 0
    categoryVisibleCount.value = 0
    categoryRootCount.value = 0
    categoryMaxLevel.value = 0
    categoryDefaultExpandedKeys.value = []
  }
  const params = {
    begin: (currentPage.value - 1) * pageSize.value,
    step: pageSize.value,
    q: filters.keyword.trim() || undefined,
    status: filters.status || undefined,
  }
  try {
    if (page.value.viewType === 'PRODUCT') {
      const result = await getErpProducts({
        ...params,
        internalStatus: params.status,
        status: undefined,
        sourcePutaway:
          filters.sourcePutaway && filters.sourcePutaway !== 'A'
            ? filters.sourcePutaway
            : undefined,
      })
      data.value = mapPage(result, mapProduct)
    } else if (page.value.viewType === 'SKU') {
      const result = await getErpSkus({
        ...params,
        sourcePutaway:
          filters.sourcePutaway && filters.sourcePutaway !== 'A'
            ? filters.sourcePutaway
            : undefined,
      })
      data.value = mapPage(result, mapSku)
    } else if (page.value.viewType === 'CATEGORY') {
      data.value = await loadCategoryTree()
    } else if (page.value.viewType === 'BRAND') {
      data.value = mapPage(await getErpBrands(params), mapBrand)
    } else if (page.value.viewType === 'SPECIFICATION') {
      data.value = mapPage(await getErpSpecifications(params), mapSpecification)
    } else {
      data.value = mapPage(await getErpTags(params), mapTag)
    }
  } catch (reason) {
    data.value = { total: 0, begin: params.begin, step: params.step, items: [] }
    ElMessage.error(errorMessage(reason, `${page.value.title}加载失败`))
  } finally {
    loading.value = false
  }
}

async function openProductDetail(product: DisplayRow) {
  selectedProduct.value = product
  skuItems.value = []
  detailTab.value = 'overview'
  productDrawerVisible.value = true
  if (!product.code) {
    ElMessage.warning('当前商品缺少 SPU 编码，无法查询 SKU')
    return
  }

  skuLoading.value = true
  try {
    const result = await getErpSkus({ begin: 0, step: 1000, q: product.code })
    skuItems.value = result.items.filter((item) => item.spuCode === product.code)
  } catch (reason) {
    ElMessage.error(errorMessage(reason, 'SKU 明细加载失败'))
  } finally {
    skuLoading.value = false
  }
}

function openMasterDetail(row: DisplayRow) {
  selectedMaster.value = row
  masterDetailTab.value = 'overview'
  masterDrawerVisible.value = true
}

async function loadCategoryTree(): Promise<ErpPage<DisplayRow>> {
  const batchSize = 500
  let begin = 0
  let total = 0
  const categories: ErpCategoryView[] = []
  do {
    const result = await getErpCategories({ begin, step: batchSize })
    total = result.total
    categories.push(...result.items)
    begin += result.items.length
    if (!result.items.length) break
  } while (begin < total)

  const allRows = categories.map(mapCategory)
  const byId = new Map(allRows.map((row) => [row.id, row]))
  const bySourceId = new Map(
    allRows.filter((row) => row.sourceId).map((row) => [row.sourceId as string, row]),
  )
  const roots: DisplayRow[] = []
  for (const row of allRows) {
    const category = row.category
    const parent = category?.parentId
      ? byId.get(category.parentId)
      : category?.sourceParentId
        ? bySourceId.get(category.sourceParentId)
        : undefined
    if (parent && parent.id !== row.id && !wouldCreateCategoryCycle(parent, row, byId, bySourceId)) {
      parent.children ??= []
      parent.children.push(row)
    } else {
      roots.push(row)
    }
  }

  const assignHierarchy = (row: DisplayRow, parentPath: string[], level: number) => {
    row.level = level
    row.path = [...parentPath, row.name].join(' / ')
    row.childCount = row.children?.length ?? 0
    row.children?.sort(compareMasterRows)
    row.children?.forEach((child) => assignHierarchy(child, [...parentPath, row.name], level + 1))
  }
  roots.sort(compareMasterRows)
  roots.forEach((row) => assignHierarchy(row, [], 1))

  const keyword = filters.keyword.trim().toLocaleLowerCase()
  const status = filters.status
  const matches = (row: DisplayRow) => {
    const keywordMatches =
      !keyword ||
      [row.name, row.code, row.sourceId, row.path].some((value) =>
        String(value ?? '')
          .toLocaleLowerCase()
          .includes(keyword),
      )
    return keywordMatches && (!status || row.status === status)
  }
  categoryMatchCount.value = allRows.filter(matches).length
  const filterTree = (row: DisplayRow): DisplayRow | null => {
    const children = (row.children ?? [])
      .map(filterTree)
      .filter((child): child is DisplayRow => child !== null)
    const selfMatches = matches(row)
    if (!selfMatches && !children.length) return null
    return { ...row, children, isFilterContext: !selfMatches }
  }
  const filteredRoots = roots
    .map(filterTree)
    .filter((row): row is DisplayRow => row !== null)
  categoryVisibleCount.value = countCategoryRows(filteredRoots)
  categoryRootCount.value = roots.length
  categoryMaxLevel.value = allRows.reduce((max, row) => Math.max(max, row.level ?? 1), 0)
  categoryDefaultExpandedKeys.value = filteredRoots.map((row) => row.id)
  return { total: categoryMatchCount.value, begin: 0, step: categories.length, items: filteredRoots }
}

async function synchronize() {
  syncing.value = true
  try {
    const result = await syncErpData(page.value.objectType)
    ElMessage.success(
      `${page.value.syncLabel}同步完成：获取${result.fetched}条，新增${result.created}条，变更${result.changed}条`,
    )
    await load()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, `${page.value.syncLabel}同步失败`))
  } finally {
    syncing.value = false
  }
}

async function query() {
  currentPage.value = 1
  await load()
}

async function resetFilters() {
  filters.keyword = ''
  filters.status = ''
  filters.sourcePutaway = ''
  await query()
}

async function changeCurrentPage(value: number) {
  currentPage.value = value
  await load()
}

async function changePageSize(value: number) {
  pageSize.value = value
  currentPage.value = 1
  await load()
}

function mapPage<T>(source: ErpPage<T>, mapper: (item: T) => DisplayRow): ErpPage<DisplayRow> {
  return { ...source, items: source.items.map(mapper) }
}

function mapProduct(item: ErpProductView): DisplayRow {
  return {
    id: item.id,
    sourceId: item.sourceProductId,
    code: item.spuCode,
    name: item.name,
    attribute: [item.brandName, item.categoryName].filter(Boolean).join(' / ') || null,
    detail: [item.barcode, item.unit, item.conversionBarcode, `SKU ${item.skuCount}`]
      .filter(Boolean)
      .join(' / '),
    status: item.internalStatus,
    ownershipState: item.ownershipState,
    syncedAt: item.syncedAt,
    product: item,
  }
}

function customFieldEntries(product: ErpProductView) {
  return Object.entries(product.customFields ?? {}).map(([key, value]) => ({ key, value }))
}

function mapSku(item: ErpSkuView): DisplayRow {
  return {
    id: item.id,
    sourceId: item.sourceSkuId,
    code: item.skuCode,
    name: item.productName,
    attribute: item.specificationSummary || null,
    detail: [item.barcode, item.unit, item.optionsId].filter(Boolean).join(' / ') || null,
    status: item.internalStatus,
    ownershipState: item.ownershipState,
    syncedAt: item.syncedAt,
    sku: item,
  }
}

function mapCategory(item: ErpCategoryView): DisplayRow {
  return {
    id: item.id,
    sourceId: item.sourceCategoryId,
    code: item.categoryCode,
    name: item.name,
    attribute: `第 ${item.categoryLevel} 级${item.sourceDefaultFlag ? ' / 默认' : ''}`,
    detail:
      [item.parentId, item.sourceCategoryNumber, item.externalReferenceId]
        .filter(Boolean)
        .join(' / ') || null,
    status: item.status,
    ownershipState: item.ownershipState,
    syncedAt: item.syncedAt,
    category: item,
    children: [],
    level: item.categoryLevel,
    childCount: 0,
  }
}

function mapBrand(item: ErpBrandView): DisplayRow {
  return {
    id: item.id,
    sourceId: item.sourceBrandId,
    code: item.brandCode,
    name: item.name,
    attribute:
      [item.sourceBrandNumber, item.externalReferenceId].filter(Boolean).join(' / ') || '订货宝',
    detail: item.sourceDescription || null,
    status: item.status,
    ownershipState: item.ownershipState,
    syncedAt: item.syncedAt,
    brand: item,
  }
}

function mapSpecification(item: ErpSpecificationView): DisplayRow {
  return {
    id: item.id,
    sourceId: item.sourceSpecificationId,
    code: item.specificationCode,
    name: item.name,
    attribute: `${item.valueCount} 个规格值`,
    detail:
      [item.sourceParentId, item.values.map((value) => value.valueName).join('、')]
        .filter(Boolean)
        .join(' / ') || '订货宝',
    status: item.status,
    ownershipState: item.ownershipState,
    syncedAt: item.syncedAt,
    specification: item,
  }
}

function mapTag(item: ErpTagView): DisplayRow {
  return {
    id: item.id,
    sourceId: item.sourceTagId,
    code: item.tagCode,
    name: item.name,
    attribute: item.sourceGroupName || item.color,
    detail: item.sourceRelationCount == null ? '订货宝' : `关联 ${item.sourceRelationCount}`,
    status: item.status,
    ownershipState: item.ownershipState,
    syncedAt: item.syncedAt,
    tag: item,
  }
}

function compareMasterRows(left: DisplayRow, right: DisplayRow) {
  const leftSort = left.brand?.sourceSortOrder ?? left.tag?.sourceSortOrder
  const rightSort = right.brand?.sourceSortOrder ?? right.tag?.sourceSortOrder
  if (leftSort != null || rightSort != null) {
    return (leftSort ?? Number.MAX_SAFE_INTEGER) - (rightSort ?? Number.MAX_SAFE_INTEGER)
  }
  return left.name.localeCompare(right.name, 'zh-CN')
}

function wouldCreateCategoryCycle(
  parent: DisplayRow,
  child: DisplayRow,
  byId: Map<string, DisplayRow>,
  bySourceId: Map<string, DisplayRow>,
) {
  let current: DisplayRow | undefined = parent
  const visited = new Set<string>()
  while (current) {
    if (current.id === child.id || visited.has(current.id)) return true
    visited.add(current.id)
    const category = current.category
    current = category?.parentId
      ? byId.get(category.parentId)
      : category?.sourceParentId
        ? bySourceId.get(category.sourceParentId)
        : undefined
  }
  return false
}

function countCategoryRows(rows: DisplayRow[]): number {
  return rows.reduce(
    (count, row) => count + 1 + countCategoryRows(row.children ?? []),
    0,
  )
}

function categoryParentName(row: DisplayRow) {
  const names = row.path?.split(' / ') ?? []
  return names.length > 1 ? names[names.length - 2] : '根分类'
}

function detailField(label: string, value: unknown, wide = false): DetailField {
  return { label, value: valueOrDash(value), wide }
}

function statusLabel(status: string) {
  if (status === 'ACTIVE') return '启用'
  if (status === 'INACTIVE') return '停用'
  return status || '-'
}

function ownershipLabel(value: string) {
  if (value === 'EXTERNAL_PRIMARY') return '外部主数据'
  if (value === 'INTERNAL_PRIMARY') return '内部主数据'
  if (value === 'INTERNAL_OVERRIDDEN') return '本地已覆盖'
  return valueOrDash(value)
}

function valueOrDash(value: unknown) {
  return value === null || value === undefined || value === '' ? '-' : String(value)
}

function money(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : `¥${Number(value).toFixed(2)}`
}

function quantity(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toString() : String(value)
}

function minimumOrderUnitLabel(value: string | null | undefined) {
  if (value === 'base_units') return '基础单位'
  if (value === 'middle_units') return '中包装'
  if (value === 'container_units') return '大包装'
  return valueOrDash(value)
}

function minimumOrderSummary(product: ErpProductView | undefined) {
  if (!product || product.minimumOrder == null) return '-'
  const unit =
    product.minimumOrderUnit === 'base_units'
      ? product.unit || '基础单位'
      : product.minimumOrderUnit === 'middle_units'
        ? product.middleUnit || '中包装'
        : product.minimumOrderUnit === 'container_units'
          ? product.bigUnit || '大包装'
          : minimumOrderUnitLabel(product.minimumOrderUnit)
  return `${quantity(product.minimumOrder)} ${unit}`
}

function packageSummary(product: ErpProductView | undefined) {
  if (!product) return '暂无包装换算'
  const units = [product.middleUnit, product.bigUnit].filter(Boolean)
  return units.length ? `包装：${units.join(' / ')}` : '暂无包装换算'
}

function packageConversion(product: ErpProductView, level: 'middle' | 'big') {
  const unit = level === 'middle' ? product.middleUnit : product.bigUnit
  const rate = level === 'middle' ? product.baseToMiddleRate : product.baseToBigRate
  if (!unit && rate == null) return '-'
  if (!unit) return `单位未配置（换算 ${quantity(rate)}${valueOrDash(product.unit)}）`
  return `1${valueOrDash(unit)} = ${quantity(rate)}${valueOrDash(product.unit)}`
}

function productPrices(product: ErpProductView) {
  return [
    { label: '基础订货价', value: money(product.orderPrice) },
    { label: '市场价', value: money(product.marketPrice) },
    { label: '采购价', value: money(product.purchasePrice) },
    { label: '其他价', value: money(product.price4) },
    { label: '中包装价', value: money(product.middleOrderPrice) },
    { label: '大包装价', value: money(product.bigOrderPrice) },
  ]
}

function putawayLabel(value: string | null | undefined) {
  if (value === 'T') return '上架'
  if (value === 'F') return '下架'
  return valueOrDash(value)
}

function putawayTagType(value: string | null | undefined) {
  if (value === 'T') return 'success'
  if (value === 'F') return 'info'
  return 'warning'
}

function formatTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function errorMessage(reason: unknown, fallback: string) {
  if (typeof reason === 'object' && reason !== null && 'message' in reason) {
    const message = (reason as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.master-data-page {
  padding-bottom: $spacing-lg;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $spacing-lg;

  span {
    color: $color-text-secondary;
    font-size: $font-size-sm;
  }
  h1 {
    margin: 5px 0;
    font-size: $font-size-xl;
    color: $color-text-primary;
  }
  p {
    margin: 0;
    color: $color-text-secondary;
  }
}

.boundary-alert {
  margin-bottom: $spacing-md;
}

.query-panel {
  margin-bottom: $spacing-lg;
  padding: $spacing-md $spacing-md 0;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-base;
  background: $color-bg-base;
}

.query-bar {
  :deep(.el-form-item) {
    margin-bottom: $spacing-md;
  }
  :deep(.el-input) {
    width: 240px;
  }
}

.result-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: $spacing-lg;
  margin-bottom: $spacing-md;

  h2 {
    margin: 0 0 5px;
    color: $color-text-primary;
    font-size: $font-size-lg;
  }
  p {
    margin: 0;
    color: $color-text-secondary;
    font-size: $font-size-sm;
  }
}

.page-status-summary {
  display: flex;
  gap: $spacing-md;
  color: $color-text-secondary;
  font-size: $font-size-sm;

  span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: $color-text-placeholder;

  &.is-online {
    background: $color-success;
  }
  &.is-offline {
    background: $color-info;
  }
}

.product-table {
  border: 1px solid $color-border-base;
  border-radius: $border-radius-base;
  overflow: hidden;

  :deep(.el-table__header th) {
    height: 48px;
    background: $color-bg-muted;
    color: $color-text-secondary;
    font-weight: 600;
  }

  :deep(.el-table__row) {
    cursor: pointer;
    transition: background-color $transition-fast;
  }

  :deep(.el-table__row td) {
    padding: 12px 0;
  }
  :deep(.el-table__row:hover > td) {
    background: #eff6ff !important;
  }
  :deep(.el-table__fixed-right::before),
  :deep(.el-table__fixed::before) {
    display: none;
  }
}

.product-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.product-thumb-wrap {
  flex: 0 0 58px;
  width: 58px;
  height: 58px;
  overflow: hidden;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-base;
  background: $color-bg-base;
}

.product-thumb {
  width: 100%;
  height: 100%;
  display: block;
}

.product-thumb-placeholder {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: $color-text-placeholder;
  font-size: 10px;
}

.product-identity-content {
  min-width: 0;
}
.master-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.master-avatar,
.detail-master-avatar {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-lg;
  background: $color-bg-muted;
  color: $color-primary;
  font-weight: 700;
}
.master-avatar {
  width: 46px;
  height: 46px;
  font-size: $font-size-md;
}
.detail-master-avatar {
  width: 78px;
  height: 78px;
  font-size: 28px;
}
.master-identity-content {
  min-width: 0;
}
.stacked-cell,
.hierarchy-cell {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 5px;
  min-width: 0;

  > span:not(.el-tag) {
    overflow: hidden;
    max-width: 100%;
    color: $color-text-regular;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  small {
    overflow: hidden;
    max-width: 100%;
    color: $color-text-secondary;
    font-size: $font-size-xs;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.hierarchy-cell small {
  color: $color-primary;
}
.value-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  color: $color-text-secondary;
  font-size: $font-size-xs;
}
.ownership-text {
  color: $color-text-secondary;
  font-size: $font-size-xs;
}
.product-name {
  overflow: hidden;
  color: $color-text-primary;
  font-weight: 600;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.product-code {
  margin-top: 4px;
  color: $color-text-regular;
  font-size: $font-size-sm;
  font-variant-numeric: tabular-nums;
}
.product-meta-line {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 3px;
  color: $color-text-placeholder;
  font-size: $font-size-xs;
}

.sku-package-cell,
.ordering-cell,
.status-cell,
.price-cell {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.hierarchy-primary {
  display: block;
  overflow: hidden;
  color: $color-text-regular;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hierarchy-secondary {
  display: block;
  overflow: hidden;
  color: $color-text-secondary;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ordering-cell small {
  color: $color-text-secondary;
  font-size: $font-size-sm;
}
.sku-count {
  width: fit-content;
  color: $color-primary;
  font-weight: 600;
}
.sku-package-cell > span:not(.sku-count) {
  color: $color-text-regular;
  font-size: $font-size-sm;
}
.compact-line {
  margin-top: 0 !important;
}
.price-cell {
  align-items: flex-end;
}
.price-cell strong {
  color: $color-text-primary;
  font-size: 17px;
  font-variant-numeric: tabular-nums;
}
.price-cell span,
.price-cell small {
  color: $color-text-secondary;
  font-size: $font-size-xs;
}
.ordering-cell > span {
  color: $color-text-regular;
  font-weight: 500;
}
.status-cell {
  align-items: flex-start;
}
.internal-status {
  color: $color-text-secondary;
  font-size: $font-size-xs;
}
.internal-status::before {
  content: '●';
  margin-right: 5px;
  color: $color-text-placeholder;
}
.internal-status.is-active::before {
  color: $color-success;
}
.sync-time {
  color: $color-text-secondary;
  font-size: $font-size-sm;
  line-height: 1.5;
}
.cell-secondary {
  display: block;
  margin-top: 3px;
  color: $color-text-secondary;
  line-height: 1.35;
}
.pagination {
  justify-content: flex-end;
  margin-top: $spacing-lg;
}

:deep(.product-detail-drawer) {
  background: $color-bg-page;
}
:deep(.product-detail-drawer .el-drawer__body) {
  padding: 0;
}

.product-detail {
  min-height: 100%;
  background: $color-bg-page;
}

.detail-hero {
  position: sticky;
  z-index: 4;
  top: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $spacing-lg;
  padding: $spacing-lg $spacing-xl;
  border-bottom: 1px solid $color-border-base;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(10px);
}

.detail-hero-main {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  min-width: 0;
}
.detail-cover {
  flex: 0 0 78px;
  width: 78px;
  height: 78px;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-lg;
  background: $color-bg-base;
}
.detail-cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-text-placeholder;
  font-size: $font-size-xs;
}
.detail-title-block {
  min-width: 0;
}
.detail-eyebrow {
  color: $color-primary;
  font-size: $font-size-xs;
  font-weight: 600;
}
.detail-title-block h2 {
  overflow: hidden;
  margin: 5px 0;
  color: $color-text-primary;
  font-size: 21px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.detail-title-block p {
  margin: 0;
  color: $color-text-secondary;
  font-size: $font-size-sm;
}
.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  margin-top: 10px;
}
.detail-close {
  flex: 0 0 auto;
  font-size: 20px;
}

.detail-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: $spacing-lg $spacing-xl 0;
}
.metric-card {
  min-width: 0;
  padding: $spacing-md;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-lg;
  background: $color-bg-white;
  box-shadow: $shadow-sm;

  span {
    display: block;
    color: $color-text-secondary;
    font-size: $font-size-xs;
  }
  strong {
    display: block;
    overflow: hidden;
    margin-top: 7px;
    color: $color-text-primary;
    font-size: $font-size-lg;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .metric-time {
    font-size: $font-size-sm;
    line-height: 25px;
  }
}

.detail-tabs {
  padding: 10px $spacing-xl $spacing-xl;

  :deep(.el-tabs__header) {
    margin-bottom: $spacing-lg;
  }
  :deep(.el-tabs__item) {
    height: 48px;
    padding: 0 $spacing-lg;
    font-weight: 500;
  }
}

.detail-section {
  margin-bottom: $spacing-md;
  padding: $spacing-lg;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-lg;
  background: $color-bg-white;
  box-shadow: $shadow-sm;
}
.detail-section-table {
  padding-bottom: 0;
  overflow: hidden;
}
.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: $spacing-md;
  margin-bottom: $spacing-lg;

  h3 {
    margin: 0;
    color: $color-text-primary;
    font-size: $font-size-md;
  }
  p {
    margin: 0;
    color: $color-text-secondary;
    font-size: $font-size-xs;
  }
}

.info-grid,
.inventory-grid,
.source-field-grid {
  display: grid;
  margin: 0;
}
.info-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px $spacing-lg;
}
.info-grid > div,
.source-field-grid > div {
  min-width: 0;
}
.info-grid dt,
.source-field-grid dt {
  margin-bottom: 6px;
  color: $color-text-secondary;
  font-size: $font-size-xs;
}
.info-grid dd,
.source-field-grid dd {
  overflow-wrap: anywhere;
  margin: 0;
  color: $color-text-regular;
  line-height: 1.5;
}
.info-span-2 {
  grid-column: span 2;
}

.price-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.price-card {
  padding: 14px $spacing-md;
  border-radius: $border-radius-base;
  background: $color-bg-base;

  span {
    color: $color-text-secondary;
    font-size: $font-size-xs;
  }
  strong {
    display: block;
    margin-top: 7px;
    color: $color-text-primary;
    font-size: 17px;
    font-variant-numeric: tabular-nums;
  }
}

.package-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.package-card {
  padding: $spacing-md;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-base;

  > span {
    color: $color-text-secondary;
    font-size: $font-size-xs;
  }
  > strong {
    display: block;
    margin: 7px 0;
    color: $color-text-primary;
  }
  > small {
    display: block;
    overflow: hidden;
    color: $color-text-secondary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &.is-base {
    border-color: #bfdbfe;
    background: #eff6ff;
  }
}
.inventory-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: $spacing-md;
  border-top: 1px solid $color-border-lighter;
}
.inventory-grid > div {
  padding: $spacing-md $spacing-md 0 0;
}
.inventory-grid dt {
  color: $color-text-secondary;
  font-size: $font-size-xs;
}
.inventory-grid dd {
  margin: 5px 0 0;
  color: $color-text-primary;
  font-size: $font-size-md;
  font-weight: 600;
}

.product-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(116px, 1fr));
  gap: 12px;
}
.product-image-card {
  min-width: 0;
  padding: $spacing-sm;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-base;

  small {
    display: block;
    overflow: hidden;
    margin-top: 6px;
    color: $color-text-secondary;
    font-size: $font-size-xs;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.product-image {
  width: 100%;
  aspect-ratio: 1;
  border-radius: $border-radius-sm;
}
.sku-table {
  margin: 0 (-$spacing-lg);
  width: calc(100% + #{$spacing-lg * 2});
}
.sku-code {
  color: $color-text-primary;
  font-size: $font-size-sm;
}

.source-field-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-base;
  overflow: hidden;
}
.source-field-grid > div {
  padding: 12px $spacing-md;
  border-right: 1px solid $color-border-base;
  border-bottom: 1px solid $color-border-base;
}
.source-field-grid > div:nth-child(even) {
  border-right: 0;
}

@media (max-width: 720px) {
  .page-header {
    flex-direction: column;
  }
  .result-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .page-status-summary {
    flex-wrap: wrap;
  }
  .query-bar :deep(.el-form-item) {
    width: 100%;
    margin-right: 0;
  }
  .query-bar :deep(.el-input),
  .query-bar :deep(.el-select) {
    width: 100% !important;
  }
  :deep(.product-detail-drawer) {
    width: 100% !important;
  }
  .detail-hero {
    padding: $spacing-md;
  }
  .detail-cover {
    flex-basis: 64px;
    width: 64px;
    height: 64px;
  }
  .detail-title-block h2 {
    font-size: $font-size-lg;
  }
  .detail-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: $spacing-md $spacing-md 0;
  }
  .detail-tabs {
    padding: 8px $spacing-md $spacing-md;
  }
  .detail-section {
    padding: $spacing-md;
  }
  .section-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
  .info-grid,
  .price-grid,
  .package-grid {
    grid-template-columns: 1fr;
  }
  .info-span-2 {
    grid-column: auto;
  }
  .source-field-grid {
    grid-template-columns: 1fr;
  }
  .source-field-grid > div {
    border-right: 0;
  }
}
</style>
