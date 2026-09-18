<template>
  <div class="erp-product-management-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">ERP · 商品中心</span>
        <SupplyPageTitle>商品管理</SupplyPageTitle>
        <p>维护商品档案、规格价格、图片和上架状态。</p>
      </div>
      <div class="heading-actions">
        <DhbPageSyncButton scope="PRODUCT_SPU" label="商品" @completed="loadRows" />
        <el-button type="primary" @click="openCreate">新增商品</el-button>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="searchRows">
        <el-form-item label="商品编码">
          <el-input
            v-model="filters.productCode"
            clearable
            placeholder="后端自动生成"
            style="width: 180px"
          />
        </el-form-item>
        <el-form-item label="商品名称">
          <el-input
            v-model="filters.productName"
            clearable
            placeholder="按商品名称查询"
            style="width: 220px"
          />
        </el-form-item>
        <el-form-item label="品牌">
          <el-select
            v-model="filters.brandId"
            clearable
            filterable
            remote
            :remote-method="searchBrands"
            :loading="brandLoading"
            placeholder="全部品牌"
            style="width: 220px"
          >
            <el-option
              v-for="item in filterBrandOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="售卖类型">
          <el-select
            v-model="filters.saleTypeCode"
            clearable
            placeholder="全部售卖类型"
            style="width: 150px"
          >
            <el-option
              v-for="item in saleTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="上架状态">
          <el-select
            v-model="filters.shelfStatusCode"
            clearable
            placeholder="全部上架状态"
            style="width: 150px"
          >
            <el-option
              v-for="item in shelfStatusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="提交状态">
          <el-select
            v-model="filters.submitStatusCode"
            clearable
            placeholder="全部提交状态"
            style="width: 150px"
          >
            <el-option
              v-for="item in submitStatusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
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
          <h2>商品列表</h2>
          <span class="result-count"
            ><strong>{{ pageData.total }}</strong> 条</span
          >
        </div>
      </div>
    </div>

    <el-card class="list-card" shadow="never">
      <div class="table-viewport">
        <el-table
          v-loading="loading"
          class="business-table product-management-table supply-scroll-table"
          height="100%"
          :data="displayRows"
          row-key="key"
          :row-class-name="tableRowClassName"
        >
          <el-table-column label="序号" width="68" fixed="left" align="center">
            <template #default="scope">
              <span v-if="scope.row.rowKind === 'product'">{{
                productRowIndex(scope.row.product)
              }}</span>
            </template>
          </el-table-column>
          <el-table-column label="商品编码" width="196" fixed="left" show-overflow-tooltip>
            <template #default="scope">
              <span v-if="scope.row.rowKind === 'product'">{{
                scope.row.product.productCode || '-'
              }}</span>
              <span v-else class="variant-code">{{ scope.row.variant?.variantCode || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="图片" width="84" align="center">
            <template #default="scope">
              <button
                v-if="scope.row.rowKind === 'product'"
                type="button"
                class="product-thumb-wrap product-thumb-wrap--list"
                :aria-label="`查看 ${scope.row.product.productName || '商品'} 详情`"
                @click="openDetail(scope.row.product)"
              >
                <el-image
                  v-if="scope.row.product.mainImageUrl"
                  class="product-thumb"
                  :src="scope.row.product.mainImageUrl"
                  fit="cover"
                />
                <span v-else class="product-thumb-placeholder">暂无</span>
              </button>
              <span v-else class="variant-branch" aria-hidden="true">└</span>
            </template>
          </el-table-column>
          <el-table-column label="商品名称" min-width="220" show-overflow-tooltip>
            <template #default="scope">
              <el-button
                v-if="scope.row.rowKind === 'product'"
                class="product-name-link"
                link
                type="primary"
                @click="openDetail(scope.row.product)"
              >
                {{ scope.row.product.productName || '-' }}
              </el-button>
            </template>
          </el-table-column>
          <!-- @vue-generic {DisplayRow} -->
          <el-table-column label="品牌" min-width="140" show-overflow-tooltip>
            <template #default="scope">{{
              productText(scope.row, scope.row.product.brandName)
            }}</template>
          </el-table-column>
          <!-- @vue-generic {DisplayRow} -->
          <el-table-column label="分类" min-width="140" show-overflow-tooltip>
            <template #default="scope">{{
              productText(scope.row, scope.row.product.categoryName)
            }}</template>
          </el-table-column>
          <el-table-column label="规格" width="132">
            <template #default="scope">
              <template v-if="scope.row.rowKind === 'product'">
                <el-button
                  v-if="isExpandable(scope.row.product)"
                  class="spec-toggle"
                  link
                  type="primary"
                  :aria-expanded="isExpanded(scope.row.product)"
                  @click.stop="toggleVariants(scope.row.product)"
                >
                  <el-icon class="spec-toggle__icon">
                    <Minus v-if="isExpanded(scope.row.product)" />
                    <Plus v-else />
                  </el-icon>
                  {{ specCount(scope.row.product) }} 种
                </el-button>
                <span v-else class="spec-static">{{ specCount(scope.row.product) }} 种</span>
                <span
                  v-if="scope.row.product.productSpecification"
                  class="spec-note"
                  :title="scope.row.product.productSpecification"
                >
                  {{ scope.row.product.productSpecification }}
                </span>
              </template>
              <span v-else class="variant-spec">
                {{ scope.row.variant?.specificationSnapshot || '-' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="单位" width="96">
            <template #default="scope">
              <span v-if="scope.row.rowKind === 'product'">{{
                unitLabel(scope.row.product.unitCode)
              }}</span>
              <span v-else>{{
                unitLabel(scope.row.variant?.unitCode || scope.row.product.unitCode)
              }}</span>
            </template>
          </el-table-column>
          <el-table-column label="订货价" width="150" align="right" header-align="right">
            <template #default="scope">
              <span v-if="scope.row.rowKind === 'product'" class="order-price">
                {{ orderPriceText(scope.row.product) }}
              </span>
              <span v-else class="variant-price">{{ money(scope.row.variant?.salePrice) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="排序" width="128" align="center">
            <template #default="scope">
              <el-input-number
                v-if="scope.row.rowKind === 'product'"
                class="ordinal-editor"
                size="small"
                :model-value="scope.row.product.ordinal ?? 0"
                :min="0"
                :max="999999"
                :step="10"
                :disabled="!canWrite || ordinalSavingId === String(scope.row.product.id)"
                controls-position="right"
                @change="(value: number | undefined) => changeOrdinal(scope.row.product, value)"
              />
            </template>
          </el-table-column>
          <el-table-column label="上架状态" width="132" align="center">
            <template #default="scope">
              <template v-if="scope.row.rowKind === 'product'">
                <el-switch
                  v-if="shelfSwitchEnabled"
                  class="shelf-switch"
                  :model-value="scope.row.product.shelfStatusCode === SHELF_ON_CODE"
                  :loading="shelfSavingId === String(scope.row.product.id)"
                  :disabled="!canWrite"
                  inline-prompt
                  :active-text="shelfOnLabel"
                  :inactive-text="shelfOffLabel"
                  :width="60"
                  @change="
                    (value: string | number | boolean) =>
                      changeShelfStatus(scope.row.product, Boolean(value))
                  "
                />
                <!-- 字典不正好是上架/下架两态时，开关承载不了多态，回退为字典下拉 -->
                <el-select
                  v-else
                  :model-value="scope.row.product.shelfStatusCode"
                  size="small"
                  :disabled="!canWrite || shelfSavingId === String(scope.row.product.id)"
                  style="width: 100%"
                  @change="
                    (value: string) => changeShelfStatusTo(scope.row.product, String(value))
                  "
                >
                  <el-option
                    v-for="item in shelfStatusOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </template>
              <el-tag v-else-if="scope.row.variant?.defaultFlag" size="small" effect="plain">
                默认规格
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="售卖类型" width="110">
            <template #default="scope">
              <el-tag
                v-if="scope.row.rowKind === 'product'"
                effect="light"
                :type="saleTypeTag(scope.row.product.saleTypeCode)"
              >
                {{ productSaleTypeLabel(scope.row.product.saleTypeCode) }}
              </el-tag>
            </template>
          </el-table-column>
          <!-- @vue-generic {DisplayRow} -->
          <el-table-column label="创建人" width="120">
            <template #default="scope">{{
              productText(scope.row, auditActorLabel(scope.row.product.createdBy))
            }}</template>
          </el-table-column>
          <!-- @vue-generic {DisplayRow} -->
          <el-table-column label="创建时间" width="170">
            <template #default="scope">{{
              productText(scope.row, formatTime(scope.row.product.createdTime))
            }}</template>
          </el-table-column>
          <el-table-column label="修改人/时间" width="200">
            <template #default="scope">
              <div v-if="scope.row.rowKind === 'product'" class="audit-cell">
                <span>{{ auditActorLabel(scope.row.product.updatedBy) }}</span>
                <span class="audit-cell__time">{{ formatTime(scope.row.product.updatedTime) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="132" fixed="right" align="center">
            <template #default="scope">
              <template v-if="scope.row.rowKind === 'product'">
                <el-button link type="primary" @click.stop="openEdit(scope.row.product)">
                  编辑
                </el-button>
                <el-button link type="danger" @click.stop="deleteProduct(scope.row.product)">
                  删除
                </el-button>
              </template>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="暂无商品，可点击右上角新增商品" />
          </template>
        </el-table>
      </div>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100]"
          :total="pageData.total"
          @current-change="loadRows"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-drawer
      v-model="detailVisible"
      class="erp-product-detail-drawer"
      size="min(980px, 92vw)"
      :with-header="false"
    >
      <div v-if="detail" class="detail-shell">
        <header class="detail-hero">
          <div class="detail-hero-main">
            <el-image
              v-if="mainDetailImageUrl"
              class="detail-cover"
              :src="mainDetailImageUrl"
              fit="cover"
              :preview-src-list="detailPreviewUrls"
              preview-teleported
            />
            <div v-else class="detail-cover detail-cover-placeholder">暂无图片</div>
            <div class="detail-title-block">
              <span class="detail-eyebrow">ERP 商品详情</span>
              <h2>{{ detail.productName }}</h2>
              <p>{{ detail.productCode || '-' }}</p>
              <div class="status-tags">
                <el-tag :type="submitStatusTag(detail.submitStatusCode)">
                  {{ productSubmitStatusLabel(detail.submitStatusCode) }}
                </el-tag>
                <el-tag effect="plain" :type="shelfStatusTag(detail.shelfStatusCode)">
                  {{ productShelfStatusLabel(detail.shelfStatusCode) }}
                </el-tag>
                <el-tag effect="plain">{{ productSaleTypeLabel(detail.saleTypeCode) }}</el-tag>
              </div>
            </div>
          </div>
          <el-button circle plain aria-label="关闭商品详情" @click="detailVisible = false">
            ×
          </el-button>
        </header>

        <div class="detail-summary detail-summary--four">
          <div>
            <span>订货价</span><strong>{{ primaryOrderPrice }}</strong>
          </div>
          <div>
            <span>市场价</span><strong>{{ primaryMarketPrice }}</strong>
          </div>
          <div>
            <span>进货价</span><strong>{{ primaryPurchasePrice }}</strong>
          </div>
          <div>
            <span>可售规格</span><strong>{{ detail.variants.length }} 种</strong>
          </div>
        </div>

        <div class="detail-business-view">
          <section class="detail-section">
            <h3>基础信息</h3>
            <div class="detail-field-grid">
              <div v-for="field in baseInfoFields" :key="field.label" class="detail-field">
                <span>{{ field.label }}</span>
                <strong>{{ field.value }}</strong>
              </div>
            </div>
          </section>

          <section class="detail-section">
            <h3>订货与库存</h3>
            <div class="detail-field-grid">
              <div v-for="field in orderInventoryFields" :key="field.label" class="detail-field">
                <span>{{ field.label }}</span>
                <strong>{{ field.value }}</strong>
              </div>
            </div>
          </section>

          <section class="detail-section">
            <h3>价格信息</h3>
            <div class="detail-price-grid">
              <div v-for="field in priceFields" :key="field.label" class="detail-price-card">
                <span>{{ field.label }}</span>
                <strong>{{ field.value }}</strong>
              </div>
            </div>
          </section>

          <section class="detail-section">
            <h3>规格价格</h3>
            <div v-if="detail.variants.length" class="variant-card-grid">
              <article
                v-for="variant in detail.variants"
                :key="variant.id || variant.variantCode"
                class="variant-card"
              >
                <header>
                  <div>
                    <h4>{{ variant.specificationSnapshot || '默认规格' }}</h4>
                    <p>{{ variant.variantCode || '-' }}</p>
                  </div>
                  <el-tag v-if="variant.defaultFlag" size="small" type="success">默认</el-tag>
                </header>
                <div class="variant-price-row">
                  <span
                    >订货价
                    <strong>{{ moneyWithUnit(variant.salePrice, detailUnit) }}</strong></span
                  >
                  <span
                    >市场价
                    <strong>{{ moneyWithUnit(variant.marketPrice, detailUnit) }}</strong></span
                  >
                  <span
                    >进货价
                    <strong>{{ moneyWithUnit(variant.purchasePrice, detailUnit) }}</strong></span
                  >
                </div>
                <div class="variant-meta-row">
                  <span>单位：{{ unitLabel(variant.unitCode || detail.unitCode) }}</span>
                  <span>起订：{{ quantityWithUnit(variant.minOrderQuantity, detailUnit) }}</span>
                  <span
                    >整倍：{{ quantityWithUnit(variant.orderMultipleQuantity, detailUnit) }}</span
                  >
                  <span>限购：{{ quantityWithUnit(variant.limitQuantity, detailUnit) }}</span>
                </div>
              </article>
            </div>
            <el-empty v-else description="暂无规格价格" :image-size="64" />
          </section>

          <section class="detail-section">
            <h3>关联商品</h3>
            <div v-if="relatedProducts.length" class="related-product-grid">
              <button
                v-for="item in relatedProducts"
                :key="item.key"
                type="button"
                class="related-product-card"
                :class="{ 'related-product-card--clickable': item.targetId }"
                :disabled="!item.targetId"
                @click="openRelatedProduct(item.targetId)"
              >
                <div class="related-product-card__image">
                  <el-image v-if="item.imageUrl" :src="item.imageUrl" fit="cover" />
                  <span v-else>暂无图片</span>
                </div>
                <h4>{{ item.name }}</h4>
                <p>{{ item.code }}</p>
                <strong>{{ item.price }}</strong>
                <span v-if="item.targetId" class="related-product-card__action">查看详情</span>
              </button>
            </div>
            <div v-else-if="detail.recommendProductIds.length" class="related-product-tags">
              <el-button
                v-for="productId in detail.recommendProductIds"
                :key="productId"
                size="small"
                @click="openRelatedProduct(productId)"
              >
                商品 ID {{ productId }}
              </el-button>
            </div>
            <el-empty v-else description="暂无关联商品" :image-size="64" />
          </section>

          <section class="detail-section">
            <h3>商品图片</h3>
            <div v-if="detail.images.length" class="product-image-gallery">
              <div class="product-image-gallery__stage">
                <el-image
                  v-if="mainDetailImage?.imageUrl"
                  class="product-image-gallery__primary"
                  :src="mainDetailImage.imageUrl"
                  fit="cover"
                  preview-teleported
                  :preview-src-list="detailPreviewUrls"
                  :initial-index="detailPreviewIndex(mainDetailImage.imageUrl)"
                />
                <div
                  v-else
                  class="product-image-gallery__primary product-image-gallery__primary--empty"
                >
                  暂无图片
                </div>
                <div v-if="mainDetailImage" class="product-image-gallery__meta">
                  <el-tag
                    size="small"
                    effect="dark"
                    :type="imageTagType(mainDetailImage.imageTypeCode)"
                  >
                    {{ imageTypeLabel(mainDetailImage.imageTypeCode) }}
                  </el-tag>
                  <span>#{{ mainDetailImage.ordinal ?? 0 }}</span>
                </div>
              </div>
              <div class="product-image-gallery__grid">
                <div
                  v-for="image in detail.images"
                  :key="image.imageKey || `${image.imageTypeCode}-${image.ordinal}`"
                  class="product-image-tile"
                >
                  <div class="product-image-tile__media">
                    <el-image
                      v-if="image.imageUrl"
                      class="product-image-tile__image"
                      :src="image.imageUrl"
                      fit="cover"
                      preview-teleported
                      :preview-src-list="detailPreviewUrls"
                      :initial-index="detailPreviewIndex(image.imageUrl)"
                    />
                    <span v-else class="product-image-tile__empty">暂无图片</span>
                  </div>
                  <el-tag
                    class="product-image-tile__type"
                    size="small"
                    :type="imageTagType(image.imageTypeCode)"
                  >
                    {{ imageTypeLabel(image.imageTypeCode) }}
                  </el-tag>
                  <span class="product-image-tile__ordinal">#{{ image.ordinal ?? 0 }}</span>
                </div>
              </div>
            </div>
            <el-empty v-else description="暂无商品图片" :image-size="64" />
          </section>

          <section class="detail-section">
            <h3>图文描述</h3>
            <div class="detail-description">{{ productDescription }}</div>
          </section>
        </div>
      </div>
      <el-skeleton v-else :rows="8" animated />
    </el-drawer>

    <el-dialog
      v-model="editorVisible"
      :title="editingId ? '编辑商品' : '新增商品'"
      width="min(1120px, 95vw)"
      destroy-on-close
    >
      <el-form :model="form" label-width="110px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="商品名称">
              <el-input v-model="form.productName" clearable placeholder="提交时必填" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商品规格">
              <el-input
                v-model="form.productSpecification"
                clearable
                placeholder="如 12桶/箱、500ml"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商品分类">
              <ProductCategorySelect
                v-model="form.categoryId"
                :categories="categoryOptions"
                :empty-value="null"
                :loading="categoryLoading"
                placeholder="搜索分类"
                style="width: 100%"
                @visible-change="handleCategoryVisibleChange"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商品品牌">
              <el-select
                v-model="form.brandId"
                filterable
                remote
                clearable
                reserve-keyword
                placeholder="搜索品牌"
                :remote-method="searchBrands"
                :loading="brandLoading"
                style="width: 100%"
              >
                <el-option
                  v-for="item in brandOptions"
                  :key="item.id"
                  :label="item.brandName"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="商品单位">
              <el-select
                v-model="form.unitCode"
                clearable
                filterable
                placeholder="选择单位"
                style="width: 100%"
              >
                <el-option
                  v-for="item in unitOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="售卖类型">
              <el-select v-model="form.saleTypeCode" placeholder="选择售卖类型" style="width: 100%">
                <el-option
                  v-for="item in saleTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="上架状态">
              <el-select
                v-model="form.shelfStatusCode"
                placeholder="选择上架状态"
                style="width: 100%"
              >
                <el-option
                  v-for="item in shelfStatusOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="排序">
              <el-input-number
                v-model="form.ordinal"
                :min="0"
                :max="999999"
                :step="10"
                controls-position="right"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="起订量">
              <el-input-number
                v-model="form.minOrderQuantity"
                :min="0"
                :precision="2"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="整倍订货">
              <el-switch v-model="form.orderMultipleFlag" active-text="是" inactive-text="否" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="整倍数量">
              <el-input-number
                v-model="form.orderMultipleQuantity"
                :disabled="!form.orderMultipleFlag"
                :min="0"
                :precision="2"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="限购量">
              <el-input-number
                v-model="form.limitQuantity"
                :min="0"
                :precision="2"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="16">
            <el-form-item label="归属仓库">
              <el-select
                v-model="form.defaultWarehouseId"
                filterable
                remote
                clearable
                reserve-keyword
                placeholder="搜索仓库"
                :remote-method="searchWarehouses"
                :loading="warehouseLoading"
                style="width: 100%"
              >
                <el-option
                  v-for="item in warehouseOptions"
                  :key="item.id"
                  :label="item.warehouseName"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="商品标签">
              <el-select
                v-model="form.tagCodes"
                multiple
                filterable
                clearable
                placeholder="选择商品标签"
                style="width: 100%"
              >
                <el-option
                  v-for="item in tagOptions"
                  :key="item.tagCode"
                  :label="item.tagName"
                  :value="item.tagCode"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input
                v-model="form.remark"
                type="textarea"
                :rows="3"
                maxlength="1000"
                show-word-limit
              />
            </el-form-item>
          </el-col>
        </el-row>

        <section class="form-section">
          <div class="form-section__header">
            <div>
              <h3>商品图片</h3>
              <p>最多维护 24 张商品图片，区分主图和详情图；上传接口接入前先录入图片标识。</p>
            </div>
            <el-button :disabled="form.images.length >= 24" @click="addImage">新增图片</el-button>
          </div>
          <div
            v-for="(image, index) in form.images"
            :key="`image-${index}`"
            class="line-editor line-editor--image"
          >
            <el-input v-model="image.imageKey" placeholder="图片标识" />
            <el-select v-model="image.imageTypeCode" placeholder="类型">
              <el-option label="主图" value="MAIN" />
              <el-option label="详情图" value="DETAIL" />
            </el-select>
            <el-input-number v-model="image.ordinal" :min="0" />
            <el-button link type="danger" @click="removeImage(index)">删除</el-button>
          </div>
          <el-empty v-if="!form.images.length" description="暂无商品图片" :image-size="64" />
        </section>

        <section class="form-section">
          <div class="form-section__header">
            <div>
              <h3>规格价格</h3>
              <p>不同规格可以设置不同售价、市场价、采购价和订货规则。</p>
            </div>
            <el-button @click="addVariant">新增规格价格</el-button>
          </div>
          <div
            v-for="(variant, index) in form.variants"
            :key="`variant-${index}`"
            class="variant-editor"
          >
            <el-row :gutter="12">
              <el-col :span="8">
                <el-form-item label="规格名称">
                  <el-input
                    v-model="variant.specificationSnapshot"
                    clearable
                    placeholder="如 原味/箱"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="4">
                <el-form-item label="单位">
                  <el-select v-model="variant.unitCode" clearable filterable placeholder="单位">
                    <el-option
                      v-for="item in unitOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="4">
                <el-form-item label="售价">
                  <el-input-number
                    v-model="variant.salePrice"
                    :min="0"
                    :precision="2"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="4">
                <el-form-item label="市场价">
                  <el-input-number
                    v-model="variant.marketPrice"
                    :min="0"
                    :precision="2"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="4">
                <el-form-item label="采购价">
                  <el-input-number
                    v-model="variant.purchasePrice"
                    :min="0"
                    :precision="2"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="4">
                <el-form-item label="起订量">
                  <el-input-number
                    v-model="variant.minOrderQuantity"
                    :min="0"
                    :precision="2"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="4">
                <el-form-item label="整倍数量">
                  <el-input-number
                    v-model="variant.orderMultipleQuantity"
                    :min="0"
                    :precision="2"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="4">
                <el-form-item label="限购量">
                  <el-input-number
                    v-model="variant.limitQuantity"
                    :min="0"
                    :precision="2"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="4">
                <el-form-item label="默认规格">
                  <el-switch v-model="variant.defaultFlag" active-text="是" inactive-text="否" />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="备注">
                  <el-input v-model="variant.remark" clearable />
                </el-form-item>
              </el-col>
              <el-col :span="2" class="variant-actions">
                <el-button link type="danger" @click="removeVariant(index)">删除</el-button>
              </el-col>
            </el-row>
          </div>
        </section>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button :loading="saving" @click="saveProduct(false)">保存草稿</el-button>
        <el-button type="primary" :loading="saving" @click="saveProduct(true)"
          >保存并提交</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { auditActorLabel } from '@/utils/audit-actor'
import { displayDateTime } from '@/utils/business-date'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import DhbPageSyncButton from '@/components/supply/DhbPageSyncButton.vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Minus, Plus } from '@element-plus/icons-vue'
import {
  createErpManagedProduct,
  deleteErpManagedProduct,
  getErpManagedProduct,
  getErpManagedProducts,
  updateErpManagedProduct,
  updateErpProductOrdinal,
  updateErpProductShelfStatus,
  type ErpManagedProductCommand,
  type ErpManagedProductDetail,
  type ErpManagedProductImage,
  type ErpManagedProductImageCommand,
  type ErpManagedProductSummary,
  type ErpManagedProductVariant,
  type ErpManagedProductVariantCommand,
  type ErpPage,
} from '@/api/core/erp-product'
import {
  getErpInventoryWarehouses,
  getErpProductBrands,
  getErpProductTags,
  type ErpInternalWarehouseView,
  type ErpProductBrandView,
  type ErpProductCategoryView,
  type ErpProductTagView,
} from '@/api/core/erp-internal'
import {
  businessDictionaryLabel,
  businessDictionaryOptions,
  loadBusinessDictionaries,
} from '@/utils/business-dictionary'
import ProductCategorySelect from '@/components/supply/ProductCategorySelect.vue'
import { loadAllErpProductCategories } from '@/utils/product-categories'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'

interface ProductFilters {
  productCode: string
  productName: string
  brandId: string
  saleTypeCode: string
  shelfStatusCode: string
  submitStatusCode: string
}

interface ImageForm {
  imageKey: string
  imageTypeCode: string
  ordinal: number | null
}

interface VariantForm {
  id: string | null
  specificationSnapshot: string
  unitCode: string
  salePrice: number | null
  marketPrice: number | null
  purchasePrice: number | null
  minOrderQuantity: number | null
  orderMultipleQuantity: number | null
  limitQuantity: number | null
  defaultFlag: boolean
  remark: string
}

interface ProductForm {
  productName: string
  categoryId: string | null
  brandId: string | null
  productSpecification: string
  unitCode: string
  minOrderQuantity: number | null
  orderMultipleFlag: boolean
  orderMultipleQuantity: number | null
  saleTypeCode: string
  shelfStatusCode: string
  ordinal: number | null
  tagCodes: string[]
  limitQuantity: number | null
  defaultWarehouseId: string | null
  images: ImageForm[]
  variants: VariantForm[]
  remark: string
  revision: number | null
}

/** 列表展示行：商品行与就地展开出的规格子行共用同一张表格。 */
interface ProductDisplayRow {
  key: string
  rowKind: 'product'
  product: ErpManagedProductSummary
  variant: null
}

interface VariantDisplayRow {
  key: string
  rowKind: 'variant'
  product: ErpManagedProductSummary
  variant: ErpManagedProductVariant
}

type DisplayRow = ProductDisplayRow | VariantDisplayRow

interface DetailField {
  label: string
  value: string
  required?: boolean
}

interface RelatedProductCard {
  key: string
  targetId?: string | number | null
  name: string
  code: string
  price: string
  imageUrl: string | null
}

type SourceRecord = Record<string, unknown>

const shelfStatusOptions = computed(() => businessDictionaryOptions('ERP', 'PRODUCT_SHELF_STATUS'))
const submitStatusOptions = computed(() =>
  businessDictionaryOptions('ERP', 'PRODUCT_SUBMIT_STATUS'),
)
const saleTypeOptions = computed(() => businessDictionaryOptions('ERP', 'PRODUCT_SALE_TYPE'))
const unitOptions = computed(() => businessDictionaryOptions('COMMON', 'PRODUCT_UNIT'))

const loading = ref(false)
const route = useRoute()
const saving = ref(false)
const detailVisible = ref(false)
const editorVisible = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const editingId = ref<string | null>(null)
const detail = ref<ErpManagedProductDetail | null>(null)
const pageData = ref<ErpPage<ErpManagedProductSummary>>({
  total: 0,
  begin: 0,
  step: 20,
  items: [],
})
const filters = reactive<ProductFilters>({
  productCode: '',
  productName: '',
  brandId: '',
  saleTypeCode: '',
  shelfStatusCode: '',
  submitStatusCode: '',
})
const form = reactive<ProductForm>(emptyForm())

const { can } = useSupplyPermissions()
const canWrite = computed(() => can('erp:product:write'))

/**
 * 上架状态在列表用开关展示，前提是字典就是"上架/下架"两态。
 *
 * <p>这里不按字典顺序猜方向：只有两个约定编码都在字典里才启用开关，
 * 否则退回字典下拉。字典改了名字或加了第三态时，页面退回成"能选对但少一点便捷"，
 * 而不是开关猜错方向把商品上下架搞反。</p>
 */
const SHELF_ON_CODE = 'ON_SHELF'
const SHELF_OFF_CODE = 'OFF_SHELF'
const shelfSwitchEnabled = computed(() => {
  const codes = shelfStatusOptions.value.map((item) => String(item.value))
  return codes.length === 2 && codes.includes(SHELF_ON_CODE) && codes.includes(SHELF_OFF_CODE)
})
const shelfOnLabel = computed(() => productShelfStatusLabel(SHELF_ON_CODE))
const shelfOffLabel = computed(() => productShelfStatusLabel(SHELF_OFF_CODE))

/** 已展开规格的商品 ID；跨分页、跨查询保留，避免翻页后又要重新点开。 */
const expandedProductIds = ref<Set<string>>(new Set())
/** 正在提交上架状态/排序的商品 ID，用于按钮 loading 与并发保护。 */
const shelfSavingId = ref<string | null>(null)
const ordinalSavingId = ref<string | null>(null)

const specCount = (product: ErpManagedProductSummary) =>
  product.variants?.length || product.variantCount || 0

/** 只有多规格商品才给展开按钮，单规格给了也是无意义点击。 */
function isExpandable(product: ErpManagedProductSummary) {
  return specCount(product) > 1
}

function isExpanded(product: ErpManagedProductSummary) {
  return expandedProductIds.value.has(String(product.id))
}

function toggleVariants(product: ErpManagedProductSummary) {
  const id = String(product.id)
  const next = new Set(expandedProductIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedProductIds.value = next
}

/** 商品行 + 展开出来的规格子行，压平后交给同一张表格渲染。 */
const displayRows = computed<DisplayRow[]>(() => {
  const rows: DisplayRow[] = []
  for (const product of pageData.value.items) {
    rows.push({ key: `product-${product.id}`, rowKind: 'product', product, variant: null })
    if (!isExpandable(product) || !expandedProductIds.value.has(String(product.id))) continue
    for (const variant of product.variants ?? []) {
      rows.push({
        key: `variant-${variant.id}`,
        rowKind: 'variant',
        product,
        variant,
      })
    }
  }
  return rows
})

const productRowIndexMap = computed(() => {
  const map = new Map<string, number>()
  pageData.value.items.forEach((product, index) => {
    map.set(String(product.id), (currentPage.value - 1) * pageSize.value + index + 1)
  })
  return map
})

function productRowIndex(product: ErpManagedProductSummary) {
  return productRowIndexMap.value.get(String(product.id)) ?? ''
}

function tableRowClassName({ row }: { row: DisplayRow }) {
  return row.rowKind === 'variant' ? 'product-variant-row' : ''
}

/** 规格子行只占少数几列，其余列留空；商品行才渲染文本。 */
function productText(row: DisplayRow, value: string | null | undefined) {
  return row.rowKind === 'product' ? value || '' : ''
}

/** 列表订货价：多规格价格不一致时给区间，避免只看到默认规格而误判。 */
function orderPriceText(product: ErpManagedProductSummary) {
  const prices = (product.variants ?? [])
    .map((variant) => variant.salePrice)
    .filter((price): price is number => price !== null && price !== undefined)
  if (!prices.length) return money(product.defaultSalePrice)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? money(min) : `${money(min)} ~ ${money(max)}`
}

function applyUpdatedProduct(product: ErpManagedProductSummary, updated: ErpManagedProductDetail) {
  product.shelfStatusCode = updated.shelfStatusCode
  product.ordinal = updated.ordinal
  product.revision = updated.revision
  product.updatedBy = updated.updatedBy
  product.updatedTime = updated.updatedTime
}

async function changeShelfStatus(product: ErpManagedProductSummary, onShelf: boolean) {
  await changeShelfStatusTo(product, onShelf ? SHELF_ON_CODE : SHELF_OFF_CODE)
}

async function changeShelfStatusTo(product: ErpManagedProductSummary, next: string) {
  if (product.shelfStatusCode === next) return
  const previous = product.shelfStatusCode
  shelfSavingId.value = String(product.id)
  product.shelfStatusCode = next
  try {
    const updated = await updateErpProductShelfStatus(
      product.id,
      next,
      Number(product.revision ?? 0),
    )
    applyUpdatedProduct(product, updated)
    ElMessage.success(`商品已${productShelfStatusLabel(next)}`)
  } catch (reason) {
    product.shelfStatusCode = previous
    ElMessage.error(errorMessage(reason, '上架状态修改失败'))
    await loadRows()
  } finally {
    shelfSavingId.value = null
  }
}

async function changeOrdinal(product: ErpManagedProductSummary, value: number | undefined) {
  const next = Number(value)
  if (!Number.isFinite(next) || next < 0 || next === product.ordinal) return
  ordinalSavingId.value = String(product.id)
  try {
    const updated = await updateErpProductOrdinal(
      product.id,
      next,
      Number(product.revision ?? 0),
    )
    applyUpdatedProduct(product, updated)
    ElMessage.success('排序已更新')
    // 排序值决定列表顺序，改完重新拉一次才能看到它落到新位置。
    await loadRows()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '排序修改失败'))
    await loadRows()
  } finally {
    ordinalSavingId.value = null
  }
}

const categoryOptions = ref<ErpProductCategoryView[]>([])
const brandOptions = ref<ErpProductBrandView[]>([])
const filterBrandOptions = computed(() => {
  const options = brandOptions.value.map((item) => ({
    value: String(item.id),
    label: item.brandName,
  }))
  const routeBrandId = routeText(route.query.brandId)
  const routeBrandName = routeText(route.query.brandName)
  if (
    routeBrandId &&
    routeBrandName &&
    filters.brandId === routeBrandId &&
    !options.some((item) => item.value === routeBrandId)
  ) {
    options.push({ value: routeBrandId, label: routeBrandName })
  }
  return options
})
const tagOptions = ref<ErpProductTagView[]>([])
const warehouseOptions = ref<ErpInternalWarehouseView[]>([])
const categoryLoading = ref(false)
const brandLoading = ref(false)
const warehouseLoading = ref(false)

const mainDetailImage = computed<ErpManagedProductImage | null>(() => {
  const images = detail.value?.images ?? []
  return (
    images.find((item) => item.imageTypeCode === 'MAIN') ??
    images.find((item) => item.imageUrl) ??
    images[0] ??
    null
  )
})
const mainDetailImageUrl = computed(() => mainDetailImage.value?.imageUrl ?? null)
const detailPreviewUrls = computed(() =>
  (detail.value?.images ?? [])
    .map((image) => image.imageUrl)
    .filter((url): url is string => Boolean(url)),
)
const sourceFields = computed<SourceRecord>(() => detail.value?.sourceFields ?? {})
const defaultDetailVariant = computed<ErpManagedProductVariant | null>(() => {
  const variants = detail.value?.variants ?? []
  return variants.find((variant) => variant.defaultFlag) ?? variants[0] ?? null
})
const detailUnit = computed(() => {
  const rawUnit = textOrEmpty(sourceValue('units', 'unit', 'unit_name', 'unitName'))
  if (rawUnit) return rawUnit
  return unitLabel(detail.value?.unitCode)
})
const primaryOrderPrice = computed(() =>
  moneyWithUnit(
    firstPresent(
      sourceValue('price1', 'orderPrice', 'whole'),
      defaultDetailVariant.value?.salePrice,
      detail.value?.defaultSalePrice,
    ),
    detailUnit.value,
  ),
)
const primaryMarketPrice = computed(() =>
  moneyWithUnit(
    firstPresent(
      sourceValue('price2', 'marketPrice', 'selling'),
      defaultDetailVariant.value?.marketPrice,
    ),
    detailUnit.value,
  ),
)
const primaryPurchasePrice = computed(() =>
  moneyWithUnit(
    firstPresent(
      sourceValue('price3', 'purchasePrice', 'purchase'),
      defaultDetailVariant.value?.purchasePrice,
    ),
    detailUnit.value,
  ),
)
const productSpecificationText = computed(() => {
  const specification =
    textOrEmpty(detail.value?.productSpecification) ||
    textOrEmpty(sourceValue('model', 'specification', 'specificationSnapshot')) ||
    textOrEmpty(defaultDetailVariant.value?.specificationSnapshot)
  return specification || '-'
})
const baseInfoFields = computed(() =>
  visibleFields([
    { label: '商品条码', value: displayValue(sourceValue('barcode')) },
    { label: '商品分类', value: displayValue(detail.value?.categoryName) },
    { label: '商品品牌', value: displayValue(detail.value?.brandName) },
    { label: '商品规格', value: productSpecificationText.value },
    { label: '商品型号', value: displayValue(sourceValue('model')) },
    {
      label: '商品标识',
      value: detail.value?.tagCodes.length
        ? detail.value.tagCodes.join('、')
        : displayValue(sourceValue('goods_tag', 'tag_name', 'tagName')),
    },
    { label: '搜索关键字', value: displayValue(sourceValue('keywords', 'keyword')) },
    { label: '默认仓库', value: displayValue(detail.value?.defaultWarehouseName) },
    {
      label: '库位号',
      value: displayValue(sourceValue('goods_allocation', 'allocation', 'location_code')),
    },
  ]),
)
const orderInventoryFields = computed(() =>
  visibleFields([
    { label: '商品单位', value: detailUnit.value, required: true },
    {
      label: '起订量',
      value: quantityWithUnit(
        firstPresent(detail.value?.minOrderQuantity, sourceValue('package')),
        minOrderUnitText.value,
      ),
      required: true,
    },
    { label: '订货限制', value: orderLimitText.value, required: true },
    {
      label: '安全库存',
      value: quantityWithUnit(sourceValue('librarysafe', 'safetyInventory'), detailUnit.value),
    },
    {
      label: '库存上限',
      value: quantityWithUnit(sourceValue('libraryup', 'inventoryUpper'), detailUnit.value),
    },
    {
      label: '库存下限',
      value: quantityWithUnit(sourceValue('librarydown', 'inventoryLower'), detailUnit.value),
    },
    { label: '中包装单位', value: displayValue(sourceValue('middle_units', 'middleUnit')) },
    {
      label: '中包装换算',
      value: quantityWithUnit(
        sourceValue('base2middle_unit_rate', 'baseToMiddleRate'),
        detailUnit.value,
      ),
    },
    { label: '大包装单位', value: displayValue(sourceValue('bigunits', 'bigUnit')) },
    {
      label: '大包装换算',
      value: quantityWithUnit(sourceValue('conversionnumber', 'baseToBigRate'), detailUnit.value),
    },
    { label: '中包装条码', value: displayValue(sourceValue('middle_barcode', 'middleBarcode')) },
    { label: '大包装条码', value: displayValue(sourceValue('big_barcode', 'bigBarcode')) },
    {
      label: '换算条码',
      value: displayValue(sourceValue('conversion_barcode', 'conversionBarcode')),
    },
    { label: '重量(kg)', value: displayValue(sourceValue('weight', 'weight_kg', 'weightKg')) },
  ]),
)
const priceFields = computed(() =>
  visibleFields([
    { label: '订货价', value: primaryOrderPrice.value, required: true },
    { label: '市场价', value: primaryMarketPrice.value, required: true },
    { label: '进货价', value: primaryPurchasePrice.value, required: true },
    {
      label: '中包装订货价',
      value: moneyWithUnit(
        sourceValue('middle_unit_whole_price', 'middleOrderPrice'),
        textOrEmpty(sourceValue('middle_units', 'middleUnit')) || detailUnit.value,
      ),
    },
    {
      label: '大包装订货价',
      value: moneyWithUnit(
        sourceValue('big_unit_whole_price', 'bigOrderPrice'),
        textOrEmpty(sourceValue('bigunits', 'bigUnit')) || detailUnit.value,
      ),
    },
  ]),
)
const minOrderUnitText = computed(
  () => textOrEmpty(sourceValue('minorder', 'minimumOrderUnit')) || detailUnit.value,
)
const orderLimitText = computed(() => {
  const rawLimit = textOrEmpty(sourceValue('order_limit', 'orderLimit', 'limit_rule'))
  if (rawLimit) return rawLimit
  if (detail.value?.orderMultipleFlag) {
    return `整倍订货：${quantityWithUnit(detail.value.orderMultipleQuantity, detailUnit.value)}`
  }
  return '正常'
})
const relatedProducts = computed<RelatedProductCard[]>(() =>
  relationRows(
    sourceValue(
      'recommend_goods',
      'recommendGoods',
      'commend_goods',
      'commendGoods',
      'related_goods',
      'relatedGoods',
      'relation_goods',
      'relationGoods',
      'goods_relation',
      'goodsRelation',
      'link_goods',
      'linkGoods',
      'associated_goods',
      'associatedGoods',
    ),
  )
    .slice(0, 12)
    .map((row, index) => relatedProductCard(row, index, detail.value?.recommendProductIds[index])),
)
const productDescription = computed(
  () =>
    textOrEmpty(
      sourceValue(
        'goods_desc',
        'goodsDesc',
        'description',
        'desc',
        'content',
        'intro',
        'introduction',
      ),
    ) ||
    textOrEmpty(detail.value?.remark) ||
    textOrEmpty(sourceValue('subtitle')) ||
    '暂无图文描述',
)

onMounted(() => {
  void loadBusinessDictionaries([
    { moduleCode: 'COMMON', code: 'PRODUCT_UNIT' },
    { moduleCode: 'ERP', code: 'PRODUCT_SUBMIT_STATUS' },
    { moduleCode: 'ERP', code: 'PRODUCT_SALE_TYPE' },
    { moduleCode: 'ERP', code: 'PRODUCT_SHELF_STATUS' },
  ])
  void loadReferenceOptions()
  applyRouteQuery()
  void loadRows()
})

watch(
  () => route.query,
  () => {
    if (!applyRouteQuery()) return
    currentPage.value = 1
    void loadRows()
  },
)

async function searchRows() {
  currentPage.value = 1
  await loadRows()
}

async function loadRows() {
  loading.value = true
  try {
    pageData.value = await getErpManagedProducts({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      productCode: empty(filters.productCode),
      productName: empty(filters.productName),
      brandId: empty(filters.brandId),
      saleTypeCode: empty(filters.saleTypeCode),
      shelfStatusCode: empty(filters.shelfStatusCode),
      submitStatusCode: empty(filters.submitStatusCode),
      withVariants: true,
    })
  } catch (reason) {
    pageData.value = { total: 0, begin: 0, step: pageSize.value, items: [] }
    ElMessage.error(errorMessage(reason, '商品列表加载失败'))
  } finally {
    loading.value = false
  }
}

async function loadReferenceOptions() {
  await Promise.all([searchCategories(''), searchBrands(''), searchTags(), searchWarehouses('')])
}

async function searchCategories(_query = '') {
  categoryLoading.value = true
  try {
    categoryOptions.value = await loadAllErpProductCategories()
  } finally {
    categoryLoading.value = false
  }
}

function handleCategoryVisibleChange(visible: boolean) {
  if (visible && !categoryOptions.value.length && !categoryLoading.value) {
    void searchCategories()
  }
}

async function searchBrands(query: string) {
  brandLoading.value = true
  try {
    brandOptions.value = (
      await getErpProductBrands({
        begin: 0,
        step: 50,
        brandName: empty(query),
      })
    ).items
  } finally {
    brandLoading.value = false
  }
}

async function searchTags() {
  tagOptions.value = (await getErpProductTags({ begin: 0, step: 100 })).items
}

async function searchWarehouses(query: string) {
  warehouseLoading.value = true
  try {
    warehouseOptions.value = (
      await getErpInventoryWarehouses({
        begin: 0,
        step: 50,
        warehouseName: empty(query),
        statusCode: 'ACTIVE',
      })
    ).items
  } finally {
    warehouseLoading.value = false
  }
}

async function resetFilters() {
  filters.productCode = ''
  filters.productName = ''
  filters.brandId = ''
  filters.saleTypeCode = ''
  filters.shelfStatusCode = ''
  filters.submitStatusCode = ''
  currentPage.value = 1
  await loadRows()
}

function applyRouteQuery() {
  let changed = false
  changed = setFilterValue('productCode', routeText(route.query.productCode)) || changed
  changed = setFilterValue('productName', routeText(route.query.productName)) || changed
  changed = setFilterValue('brandId', routeText(route.query.brandId)) || changed
  changed = setFilterValue('saleTypeCode', routeText(route.query.saleTypeCode)) || changed
  changed = setFilterValue('shelfStatusCode', routeText(route.query.shelfStatusCode)) || changed
  changed = setFilterValue('submitStatusCode', routeText(route.query.submitStatusCode)) || changed
  return changed
}

function setFilterValue(key: keyof ProductFilters, value: string) {
  if (filters[key] === value) return false
  filters[key] = value
  return true
}

function routeText(value: unknown) {
  const normalized = Array.isArray(value) ? value[0] : value
  return typeof normalized === 'string' ? normalized.trim() : ''
}

async function handleSizeChange() {
  currentPage.value = 1
  await loadRows()
}

async function openDetail(row: ErpManagedProductSummary) {
  await openDetailById(row.id)
}

async function openRelatedProduct(productId: string | number | null | undefined) {
  if (productId === null || productId === undefined || productId === '') return
  await openDetailById(productId)
}

async function openDetailById(id: string | number) {
  detailVisible.value = true
  detail.value = null
  try {
    detail.value = await getErpManagedProduct(id)
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '商品详情加载失败'))
  }
}

function openCreate() {
  editingId.value = null
  Object.assign(form, emptyForm())
  editorVisible.value = true
}

async function openEdit(row: ErpManagedProductSummary) {
  editingId.value = row.id
  editorVisible.value = true
  try {
    const product = await getErpManagedProduct(row.id)
    applyDetailToForm(product)
  } catch (reason) {
    editorVisible.value = false
    ElMessage.error(errorMessage(reason, '商品编辑资料加载失败'))
  }
}

async function saveProduct(submit: boolean) {
  saving.value = true
  try {
    const command = toCommand(submit)
    if (editingId.value) {
      await updateErpManagedProduct(editingId.value, command)
      ElMessage.success(submit ? '商品已保存并提交' : '商品草稿已保存')
    } else {
      await createErpManagedProduct(command)
      ElMessage.success(submit ? '商品已创建并提交' : '商品草稿已创建')
    }
    editorVisible.value = false
    await loadRows()
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '商品保存失败'))
  } finally {
    saving.value = false
  }
}

async function deleteProduct(row: ErpManagedProductSummary) {
  try {
    await ElMessageBox.confirm(
      `确认删除商品“${row.productName}”？删除后只做逻辑删除，历史单据不会被物理清理。`,
      '删除商品',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' },
    )
    await deleteErpManagedProduct(row.id, Number(row.revision ?? 0))
    ElMessage.success('商品已删除')
    await loadRows()
  } catch (reason) {
    if (reason === 'cancel' || reason === 'close') return
    ElMessage.error(errorMessage(reason, '商品删除失败'))
  }
}

function emptyForm(): ProductForm {
  return {
    productName: '',
    categoryId: null,
    brandId: null,
    productSpecification: '',
    unitCode: '',
    minOrderQuantity: null,
    orderMultipleFlag: false,
    orderMultipleQuantity: null,
    saleTypeCode: '',
    shelfStatusCode: '',
    ordinal: 0,
    tagCodes: [],
    limitQuantity: null,
    defaultWarehouseId: null,
    images: [],
    variants: [emptyVariant(true)],
    remark: '',
    revision: null,
  }
}

function emptyVariant(defaultFlag = false): VariantForm {
  return {
    id: null,
    specificationSnapshot: '',
    unitCode: '',
    salePrice: null,
    marketPrice: null,
    purchasePrice: null,
    minOrderQuantity: null,
    orderMultipleQuantity: null,
    limitQuantity: null,
    defaultFlag,
    remark: '',
  }
}

function applyDetailToForm(product: ErpManagedProductDetail) {
  Object.assign(form, {
    productName: product.productName ?? '',
    categoryId: product.categoryId ? String(product.categoryId) : null,
    brandId: product.brandId ? String(product.brandId) : null,
    productSpecification: product.productSpecification ?? '',
    unitCode: product.unitCode ?? '',
    minOrderQuantity: product.minOrderQuantity ?? null,
    orderMultipleFlag: Boolean(product.orderMultipleFlag),
    orderMultipleQuantity: product.orderMultipleQuantity ?? null,
    saleTypeCode: product.saleTypeCode || '',
    shelfStatusCode: product.shelfStatusCode || '',
    ordinal: product.ordinal ?? 0,
    tagCodes: [...(product.tagCodes ?? [])],
    limitQuantity: product.limitQuantity ?? null,
    defaultWarehouseId: product.defaultWarehouseId ? String(product.defaultWarehouseId) : null,
    images: normalizeImages(product.images),
    variants: normalizeVariants(product.variants),
    remark: product.remark ?? '',
    revision: product.revision ?? null,
  })
}

function normalizeImages(images: ErpManagedProductImage[]): ImageForm[] {
  return images.map((image, index) => ({
    imageKey: image.imageKey,
    imageTypeCode: image.imageTypeCode || (index === 0 ? 'MAIN' : 'DETAIL'),
    ordinal: image.ordinal ?? index + 1,
  }))
}

function normalizeVariants(variants: ErpManagedProductVariant[]): VariantForm[] {
  if (!variants.length) return [emptyVariant(true)]
  return variants.map((variant) => ({
    id: variant.id,
    specificationSnapshot: variant.specificationSnapshot ?? '',
    unitCode: variant.unitCode ?? '',
    salePrice: variant.salePrice ?? null,
    marketPrice: variant.marketPrice ?? null,
    purchasePrice: variant.purchasePrice ?? null,
    minOrderQuantity: variant.minOrderQuantity ?? null,
    orderMultipleQuantity: variant.orderMultipleQuantity ?? null,
    limitQuantity: variant.limitQuantity ?? null,
    defaultFlag: Boolean(variant.defaultFlag),
    remark: variant.remark ?? '',
  }))
}

function toCommand(submit: boolean): ErpManagedProductCommand {
  const images = form.images
    .map<ErpManagedProductImageCommand>((image, index) => ({
      imageKey: image.imageKey.trim(),
      imageTypeCode: image.imageTypeCode || (index === 0 ? 'MAIN' : 'DETAIL'),
      ordinal: image.ordinal ?? index + 1,
    }))
    .filter((image) => image.imageKey)
  const variants = form.variants
    .map<ErpManagedProductVariantCommand>((variant) => ({
      id: variant.id,
      specificationSnapshot: empty(variant.specificationSnapshot),
      unitCode: empty(variant.unitCode || form.unitCode),
      salePrice: numberOrNull(variant.salePrice),
      marketPrice: numberOrNull(variant.marketPrice),
      purchasePrice: numberOrNull(variant.purchasePrice),
      minOrderQuantity: numberOrNull(variant.minOrderQuantity),
      orderMultipleQuantity: numberOrNull(variant.orderMultipleQuantity),
      limitQuantity: numberOrNull(variant.limitQuantity),
      defaultFlag: variant.defaultFlag,
      remark: empty(variant.remark),
    }))
    .filter(
      (variant) =>
        variant.id ||
        variant.specificationSnapshot ||
        variant.salePrice != null ||
        variant.marketPrice != null ||
        variant.purchasePrice != null,
    )
  return {
    submit,
    productName: empty(form.productName),
    categoryId: form.categoryId,
    brandId: form.brandId,
    productSpecification: empty(form.productSpecification),
    unitCode: empty(form.unitCode),
    minOrderQuantity: numberOrNull(form.minOrderQuantity),
    orderMultipleFlag: form.orderMultipleFlag,
    orderMultipleQuantity: numberOrNull(form.orderMultipleQuantity),
    saleTypeCode: empty(form.saleTypeCode),
    shelfStatusCode: empty(form.shelfStatusCode),
    ordinal: form.ordinal ?? 0,
    tagCodes: [...form.tagCodes],
    limitQuantity: numberOrNull(form.limitQuantity),
    defaultWarehouseId: form.defaultWarehouseId,
    images,
    variants,
    recommendProductIds: [],
    remark: empty(form.remark),
    revision: form.revision,
  }
}

function addImage() {
  if (form.images.length >= 24) {
    ElMessage.warning('商品图片最多24张')
    return
  }
  form.images.push({
    imageKey: '',
    imageTypeCode: form.images.some((image) => image.imageTypeCode === 'MAIN') ? 'DETAIL' : 'MAIN',
    ordinal: form.images.length + 1,
  })
}

function removeImage(index: number) {
  form.images.splice(index, 1)
}

function addVariant() {
  form.variants.push(emptyVariant(!form.variants.length))
}

function removeVariant(index: number) {
  form.variants.splice(index, 1)
  if (!form.variants.length) form.variants.push(emptyVariant(true))
}

function productSubmitStatusLabel(value: string | null | undefined) {
  return dictLabel('ERP', 'PRODUCT_SUBMIT_STATUS', value, '提交状态')
}

function productShelfStatusLabel(value: string | null | undefined) {
  return dictLabel('ERP', 'PRODUCT_SHELF_STATUS', value, '上架状态')
}

function productSaleTypeLabel(value: string | null | undefined) {
  return dictLabel('ERP', 'PRODUCT_SALE_TYPE', value, '售卖类型')
}

function unitLabel(value: string | null | undefined) {
  return dictLabel('COMMON', 'PRODUCT_UNIT', value, '单位')
}

function dictLabel(
  moduleCode: string,
  dictionaryCode: string,
  value: string | null | undefined,
  subject: string,
) {
  if (!value) return '-'
  return businessDictionaryLabel(moduleCode, dictionaryCode, value, subject)
}

/*
 * 下面三个只决定标签配色，不是字典的权威映射：文案一律取字典项名称，
 * 编码认不出来就退回中性色。字典增删项不会让页面显示错误的业务含义。
 * 提交状态是领域状态机（草稿/已提交），只借字典做展示，不由字典驱动取值。
 */
function submitStatusTag(value: string | null | undefined) {
  if (value === 'SUBMITTED') return 'success'
  return 'warning'
}

function shelfStatusTag(value: string | null | undefined) {
  if (value === 'ON_SHELF') return 'success'
  if (value === 'OFF_SHELF') return 'info'
  return 'warning'
}

function saleTypeTag(value: string | null | undefined) {
  if (value === 'SPOT') return 'success'
  if (value === 'PRE_SALE') return 'warning'
  if (value === 'STOP_SALE') return 'info'
  return 'primary'
}

function imageTypeLabel(value: string | null | undefined) {
  if (value === 'MAIN') return '主图'
  if (value === 'DETAIL') return '详情图'
  return value || '-'
}

function imageTagType(value: string | null | undefined) {
  if (value === 'MAIN') return 'success'
  if (value === 'DETAIL') return 'info'
  return 'primary'
}

function detailPreviewIndex(url: string | null | undefined) {
  if (!url) return 0
  const index = detailPreviewUrls.value.indexOf(url)
  return index >= 0 ? index : 0
}

function empty(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized || undefined
}

function numberOrNull(value: number | null | undefined) {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function sourceValue(...keys: string[]): unknown {
  return recordValue(sourceFields.value, keys)
}

function recordValue(record: SourceRecord | null | undefined, keys: string[]): unknown {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (hasValue(value)) return value
  }
  return null
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (isRecord(value)) return Object.keys(value).length > 0
  return true
}

function isRecord(value: unknown): value is SourceRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function firstPresent(...values: unknown[]): unknown {
  return values.find(hasValue) ?? null
}

function textOrEmpty(value: unknown): string {
  if (!hasValue(value)) return ''
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) {
    return value.map(textOrEmpty).filter(Boolean).join('、')
  }
  return ''
}

function displayValue(value: unknown): string {
  return textOrEmpty(value) || '-'
}

function visibleFields(fields: DetailField[]) {
  return fields.filter((field) => field.required || field.value !== '-')
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/,/g, '')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function moneyWithUnit(value: unknown, unit: string | null | undefined) {
  const amount = numericValue(value)
  const text = amount === null ? displayValue(value) : `¥${amount.toFixed(2)}`
  return appendUnit(text, unit, ' /')
}

function quantityWithUnit(value: unknown, unit: string | null | undefined) {
  return appendUnit(displayValue(value), unit, '')
}

function appendUnit(value: string, unit: string | null | undefined, separator: string) {
  if (value === '-') return value
  const normalizedUnit = textOrEmpty(unit)
  if (!normalizedUnit || normalizedUnit === '-') return value
  if (value.includes(normalizedUnit) || value.includes('/')) return value
  return `${value}${separator}${normalizedUnit}`
}

function relationRows(value: unknown): SourceRecord[] {
  const parsed = parseJsonLike(value)
  if (!hasValue(parsed)) return []
  if (Array.isArray(parsed)) return parsed.flatMap(relationRows)
  if (isRecord(parsed)) {
    const nested = recordValue(parsed, ['items', 'list', 'data', 'rows', 'goods', 'products'])
    if (hasValue(nested) && nested !== parsed) return relationRows(nested)
    return [parsed]
  }
  if (typeof parsed === 'string') {
    return parsed
      .split(/[,\s，、]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((id) => ({ id }))
  }
  return [{ id: parsed }]
}

function parseJsonLike(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text || (!text.startsWith('{') && !text.startsWith('['))) return value
  try {
    return JSON.parse(text)
  } catch {
    return value
  }
}

function relatedProductCard(
  row: SourceRecord,
  index: number,
  targetId?: string | number | null,
): RelatedProductCard {
  const id = displayValue(recordValue(row, ['goods_id', 'goodsId', 'guid', 'id', 'sourceId']))
  const code = displayValue(
    recordValue(row, ['coding', 'goods_num', 'goodsNo', 'code', 'productCode']),
  )
  const unit = textOrEmpty(recordValue(row, ['units', 'unit', 'unitCode'])) || detailUnit.value
  return {
    key: `${id}-${code}-${index}`,
    targetId,
    name:
      textOrEmpty(recordValue(row, ['name', 'goods_name', 'goodsName', 'productName', 'title'])) ||
      `关联商品 ${index + 1}`,
    code: code !== '-' ? code : id,
    price: moneyWithUnit(
      recordValue(row, ['price1', 'orderPrice', 'whole', 'salePrice', 'selling', 'price']),
      unit,
    ),
    imageUrl:
      textOrEmpty(
        recordValue(row, [
          'goods_picture',
          'imageUrl',
          'image_url',
          'picture',
          'pic',
          'url',
          'img',
          'mainImageUrl',
        ]),
      ) || null,
  }
}

function money(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : `¥${Number(value).toFixed(2)}`
}

const formatTime = displayDateTime

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

.page-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $spacing-lg;
}

.heading-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.business-boundary {
  margin-bottom: 12px;
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
  display: block;
  width: 100%;
  height: 100%;
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

/* ---- 商品列表：就地展开规格 ---- */

.product-thumb-wrap--list {
  display: block;
  flex: none;
  width: 40px;
  height: 40px;
  margin: 0 auto;
  padding: 0;
  cursor: pointer;
  transition: border-color 0.2s;
}

.product-thumb-wrap--list:hover,
.product-thumb-wrap--list:focus-visible {
  border-color: $color-primary;
}

.product-name-link {
  font-weight: 600;
}

.spec-toggle {
  gap: 2px;
  font-weight: 600;
}

.spec-toggle__icon {
  margin-right: 2px;
}

.spec-static {
  color: $color-text-regular;
}

.spec-note {
  display: block;
  overflow: hidden;
  color: $color-text-placeholder;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.variant-code {
  padding-left: 14px;
  color: $color-text-regular;
}

.variant-branch {
  color: $color-text-placeholder;
}

.variant-spec {
  color: $color-text-regular;
}

.variant-price {
  color: $color-text-regular;
}

.order-price {
  font-weight: 600;
}

.ordinal-editor {
  width: 96px;
}

.audit-cell {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}

.audit-cell__time {
  color: $color-text-secondary;
  font-size: 12px;
}

:deep(.product-variant-row) {
  background: $color-bg-page;

  td {
    border-bottom-style: dashed;
  }
}

:deep(.product-variant-row:hover > td) {
  background: $color-bg-page;
}

.product-image-gallery {
  display: grid;
  grid-template-columns: minmax(200px, 260px) minmax(0, 1fr);
  gap: $spacing-lg;
  align-items: start;
}

.product-image-gallery__stage {
  position: relative;
  width: 100%;
}

.product-image-gallery__primary {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-base;
  background: $color-bg-muted;
}

.product-image-gallery__primary--empty,
.product-image-tile__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-text-placeholder;
}

.product-image-gallery__meta {
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: $border-radius-base;
  background: rgb(15 23 42 / 72%);
  color: #fff;
  font-size: $font-size-xs;
  font-variant-numeric: tabular-nums;
}

.product-image-gallery__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 132px));
  gap: 12px;
}

.product-image-tile {
  position: relative;
  min-width: 0;
}

.product-image-tile__media {
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-base;
  background: $color-bg-muted;
}

.product-image-tile__image {
  display: block;
  width: 100%;
  height: 100%;
}

.product-image-tile__type {
  position: absolute;
  top: 8px;
  left: 8px;
}

.product-image-tile__ordinal {
  position: absolute;
  right: 8px;
  bottom: 8px;
  min-width: 28px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgb(15 23 42 / 72%);
  color: #fff;
  font-size: $font-size-xs;
  line-height: 18px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.product-image-tile__empty {
  width: 100%;
  height: 100%;
  font-size: $font-size-xs;
}

.product-identity-content {
  min-width: 0;

  strong,
  small {
    display: block;
    overflow: hidden;
    max-width: 190px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: $color-text-primary;
  }

  small {
    margin-top: 5px;
    color: $color-text-secondary;
    font-variant-numeric: tabular-nums;
  }
}

.stacked-cell,
.status-tags {
  display: flex;
  min-width: 0;
}

.stacked-cell {
  flex-direction: column;
  gap: 5px;

  span,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: $color-text-secondary;
  }
}

.status-tags {
  flex-wrap: wrap;
  gap: 6px;
}

.status-tags--compact {
  margin-top: 6px;
  gap: 4px;
}

.detail-hero {
  display: flex;
  justify-content: space-between;
  gap: $spacing-lg;
  padding-bottom: $spacing-lg;
  border-bottom: 1px solid $color-border-base;
}

.detail-hero-main {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  min-width: 0;
}

.detail-cover {
  width: 96px;
  height: 96px;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-lg;
  background: $color-bg-muted;
}

.detail-cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-text-placeholder;
}

.detail-title-block {
  min-width: 0;

  h2 {
    margin: 4px 0;
    color: $color-text-primary;
    font-size: 24px;
  }

  p {
    margin: 0 0 10px;
    color: $color-text-secondary;
  }
}

.detail-summary {
  display: grid;
  gap: 12px;
  margin: 14px 0;

  > div {
    padding: 12px;
    border: 1px solid $color-border-base;
    border-radius: $border-radius-base;
    background: $color-bg-muted;
  }

  span,
  strong {
    display: block;
  }

  span {
    color: $color-text-secondary;
    font-size: $font-size-xs;
  }

  strong {
    margin-top: 6px;
    color: $color-text-primary;
  }
}

.detail-summary--four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.detail-business-view {
  display: grid;
  gap: 14px;
}

.detail-section {
  padding: 16px;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-lg;
  background: #fff;

  h3 {
    margin: 0 0 14px;
    padding-left: 10px;
    border-left: 3px solid $color-primary;
    color: $color-text-primary;
    font-size: $font-size-md;
    line-height: 1.2;
  }
}

.detail-field-grid,
.detail-price-grid {
  display: grid;
  gap: 12px;
}

.detail-field-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.detail-price-grid {
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.detail-field,
.detail-price-card {
  min-width: 0;
  padding: 12px;
  border: 1px solid $color-border-light;
  border-radius: $border-radius-base;
  background: $color-bg-muted;

  span,
  strong {
    display: block;
    min-width: 0;
  }

  span {
    color: $color-text-secondary;
    font-size: $font-size-xs;
  }

  strong {
    overflow-wrap: anywhere;
    margin-top: 6px;
    color: $color-text-primary;
    line-height: 1.45;
  }
}

.detail-price-card strong {
  color: $color-primary;
  font-size: 20px;
}

.variant-card-grid {
  display: grid;
  gap: 12px;
}

.variant-card {
  padding: 14px;
  border: 1px solid $color-border-light;
  border-radius: $border-radius-base;
  background: $color-bg-muted;

  header,
  .variant-price-row,
  .variant-meta-row {
    display: flex;
    gap: 12px;
  }

  header {
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  h4,
  p {
    margin: 0;
  }

  h4 {
    color: $color-text-primary;
    font-size: $font-size-md;
  }

  p {
    margin-top: 4px;
    color: $color-text-secondary;
    font-size: $font-size-xs;
  }
}

.variant-price-row,
.variant-meta-row {
  flex-wrap: wrap;
}

.variant-price-row span {
  min-width: 140px;
  color: $color-text-secondary;
  font-size: $font-size-sm;

  strong {
    margin-left: 4px;
    color: $color-text-primary;
  }
}

.variant-meta-row {
  margin-top: 10px;
  color: $color-text-secondary;
  font-size: $font-size-xs;
}

.related-product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 14px;
}

.related-product-card {
  min-width: 0;
  position: relative;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;

  &:disabled {
    cursor: default;
  }

  &--clickable {
    cursor: pointer;

    &:hover .related-product-card__image {
      border-color: $color-primary;
      box-shadow: 0 8px 20px rgb(37 99 235 / 12%);
    }
  }

  h4,
  p,
  strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  h4 {
    margin: 10px 0 4px;
    color: $color-text-primary;
    font-size: $font-size-sm;
  }

  p {
    margin: 0;
    color: $color-text-secondary;
    font-size: $font-size-xs;
  }

  strong {
    margin-top: 8px;
    color: #ff5a3d;
    font-size: $font-size-sm;
  }
}

.related-product-card__action {
  display: inline-flex;
  margin-top: 6px;
  color: $color-primary;
  font-size: $font-size-xs;
}

.related-product-card__image {
  display: flex;
  width: 100%;
  aspect-ratio: 1;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-base;
  background: $color-bg-muted;
  color: $color-text-placeholder;
  font-size: $font-size-xs;
}

.related-product-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-description {
  min-height: 80px;
  padding: 14px;
  border-radius: $border-radius-base;
  background: $color-bg-muted;
  color: $color-text-secondary;
  line-height: 1.7;
  white-space: pre-wrap;
}

.form-section {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-lg;
  background: $color-bg-muted;
}

.form-section__header {
  display: flex;
  justify-content: space-between;
  gap: $spacing-md;
  margin-bottom: 12px;

  h3 {
    margin: 0;
    color: $color-text-primary;
    font-size: $font-size-md;
  }

  p {
    margin: 4px 0 0;
    color: $color-text-secondary;
    font-size: $font-size-sm;
  }
}

.line-editor {
  display: grid;
  gap: 10px;
  align-items: center;
  margin-bottom: 8px;
}

.line-editor--image {
  grid-template-columns: minmax(260px, 1fr) 130px 120px 60px;
}

.variant-editor {
  margin-bottom: 10px;
  padding: 12px 12px 0;
  border: 1px solid $color-border-base;
  border-radius: $border-radius-base;
  background: #fff;
}

.variant-actions {
  display: flex;
  align-items: center;
}

@media (max-width: 720px) {
  .detail-summary--four,
  .detail-field-grid {
    grid-template-columns: 1fr;
  }

  .product-image-gallery {
    grid-template-columns: 1fr;
  }

  .product-image-gallery__stage {
    max-width: 260px;
  }

  .product-image-gallery__grid {
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  }
}
</style>
