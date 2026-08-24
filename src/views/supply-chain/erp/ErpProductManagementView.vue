<template>
  <div class="erp-product-management-page supply-page supply-page--business-main">
    <div class="page-heading">
      <div>
        <span class="supply-page__eyebrow">ERP · 商品中心</span>
        <h1>商品管理</h1>
        <p>维护商品档案、规格价格、图片和上架状态。</p>
      </div>
      <div class="heading-actions">
        <el-button type="primary" @click="openCreate">新增商品</el-button>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline @submit.prevent="loadRows">
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
          <span class="result-count"><strong>{{ pageData.total }}</strong> 条</span>
        </div>
      </div>
    </div>

    <el-card class="list-card" shadow="never">
      <div class="table-viewport">
        <el-table
          v-loading="loading"
          class="business-table product-management-table supply-scroll-table"
          height="100%"
          :data="pageData.items"
          row-key="id"
          @row-click="openDetail"
        >
          <el-table-column type="index" label="序号" width="80" fixed="left" :index="tableRowIndex" />
          <el-table-column prop="productCode" label="商品编码" width="150" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.productCode || '-' }}</template>
          </el-table-column>
          <el-table-column label="商品图片" width="104" align="center">
            <template #default="scope">
              <div class="product-thumb-wrap product-thumb-wrap--standalone" @click.stop>
                <el-image
                  v-if="scope.row.mainImageUrl"
                  class="product-thumb"
                  :src="scope.row.mainImageUrl"
                  fit="cover"
                  preview-teleported
                  :preview-src-list="[scope.row.mainImageUrl]"
                />
                <span v-else class="product-thumb-placeholder">暂无图片</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="商品名称" min-width="260">
            <template #default="scope">
              <div class="product-identity">
                <div class="product-identity-content">
                  <strong :title="scope.row.productName">{{ scope.row.productName }}</strong>
                  <div class="status-tags status-tags--compact">
                    <el-tag effect="plain" :type="saleTypeTag(scope.row.saleTypeCode)">
                      {{ productSaleTypeLabel(scope.row.saleTypeCode) }}
                    </el-tag>
                    <el-tag effect="plain" :type="shelfStatusTag(scope.row.shelfStatusCode)">
                      {{ productShelfStatusLabel(scope.row.shelfStatusCode) }}
                    </el-tag>
                  </div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="brandName" label="商品品牌" min-width="180" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.brandName || '-' }}</template>
          </el-table-column>
          <el-table-column prop="categoryName" label="商品分类" min-width="180" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.categoryName || '-' }}</template>
          </el-table-column>
          <el-table-column label="规格数" width="110" align="center">
            <template #default="scope">{{ scope.row.variantCount || 0 }} 种</template>
          </el-table-column>
          <el-table-column label="基础单位" width="110">
            <template #default="scope">{{ unitLabel(scope.row.unitCode) }}</template>
          </el-table-column>
          <el-table-column label="默认售价" width="130" align="right" header-align="right" sortable>
            <template #default="scope">{{ money(scope.row.defaultSalePrice) }}</template>
          </el-table-column>
          <el-table-column label="归属仓库" min-width="180">
            <template #default="scope">{{ scope.row.defaultWarehouseName || '-' }}</template>
          </el-table-column>
          <el-table-column label="售卖类型" width="120">
            <template #default="scope">{{ productSaleTypeLabel(scope.row.saleTypeCode) }}</template>
          </el-table-column>
          <el-table-column label="上架状态" width="120">
            <template #default="scope">
              <el-tag effect="light" :type="shelfStatusTag(scope.row.shelfStatusCode)">
                {{ productShelfStatusLabel(scope.row.shelfStatusCode) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="提交状态" width="120">
            <template #default="scope">
              <el-tag effect="light" :type="submitStatusTag(scope.row.submitStatusCode)">
                {{ productSubmitStatusLabel(scope.row.submitStatusCode) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="更新时间" width="170">
            <template #default="scope">{{ formatTime(scope.row.updatedTime) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="190" fixed="right" align="center">
            <template #default="scope">
              <el-button link type="primary" @click.stop="openDetail(scope.row)">详情</el-button>
              <el-button link type="primary" @click.stop="openEdit(scope.row)">编辑</el-button>
              <el-button link type="danger" @click.stop="deleteProduct(scope.row)">删除</el-button>
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
          <el-button
            circle
            plain
            aria-label="关闭商品详情"
            @click="detailVisible = false"
          >
            ×
          </el-button>
        </header>

        <div class="detail-summary detail-summary--four">
          <div><span>默认售价</span><strong>{{ money(detail.defaultSalePrice) }}</strong></div>
          <div><span>规格数量</span><strong>{{ detail.variants.length }}</strong></div>
          <div><span>基础单位</span><strong>{{ unitLabel(detail.unitCode) }}</strong></div>
          <div><span>归属仓库</span><strong>{{ detail.defaultWarehouseName || '-' }}</strong></div>
        </div>

        <el-tabs class="detail-tabs">
          <el-tab-pane label="基础资料">
            <el-descriptions :column="3" border>
              <el-descriptions-item label="商品名称">{{ detail.productName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="商品编码">{{ detail.productCode || '-' }}</el-descriptions-item>
              <el-descriptions-item label="商品规格">{{ detail.productSpecification || '-' }}</el-descriptions-item>
              <el-descriptions-item label="分类">{{ detail.categoryName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="品牌">{{ detail.brandName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="单位">{{ unitLabel(detail.unitCode) }}</el-descriptions-item>
              <el-descriptions-item label="起订量">{{ quantity(detail.minOrderQuantity) }}</el-descriptions-item>
              <el-descriptions-item label="整倍订货">
                {{ detail.orderMultipleFlag ? `是，${quantity(detail.orderMultipleQuantity)}` : '否' }}
              </el-descriptions-item>
              <el-descriptions-item label="限购量">{{ quantity(detail.limitQuantity) }}</el-descriptions-item>
              <el-descriptions-item label="商品标签" :span="3">
                {{ detail.tagCodes.length ? detail.tagCodes.join('、') : '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="推荐商品" :span="3">
                {{ detail.recommendProductIds.length ? detail.recommendProductIds.join('、') : '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="备注" :span="3">{{ detail.remark || '-' }}</el-descriptions-item>
              <el-descriptions-item label="创建人">{{ detail.createdBy || '-' }}</el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ formatTime(detail.createdTime) }}</el-descriptions-item>
              <el-descriptions-item label="更新人">{{ detail.updatedBy || '-' }}</el-descriptions-item>
              <el-descriptions-item label="更新时间">{{ formatTime(detail.updatedTime) }}</el-descriptions-item>
            </el-descriptions>
          </el-tab-pane>
          <el-tab-pane label="规格价格">
            <el-table class="supply-scroll-table detail-table" :data="detail.variants" max-height="360" size="small">
              <el-table-column label="规格" min-width="180" fixed="left">
                <template #default="scope">{{ scope.row.specificationSnapshot || '-' }}</template>
              </el-table-column>
              <el-table-column prop="variantCode" label="规格编码" width="150" />
              <el-table-column label="单位" width="90">
                <template #default="scope">{{ unitLabel(scope.row.unitCode) }}</template>
              </el-table-column>
              <el-table-column label="售价" width="120" align="right">
                <template #default="scope">{{ money(scope.row.salePrice) }}</template>
              </el-table-column>
              <el-table-column label="市场价" width="120" align="right">
                <template #default="scope">{{ money(scope.row.marketPrice) }}</template>
              </el-table-column>
              <el-table-column label="采购价" width="120" align="right">
                <template #default="scope">{{ money(scope.row.purchasePrice) }}</template>
              </el-table-column>
              <el-table-column label="起订量" width="110" align="right">
                <template #default="scope">{{ quantity(scope.row.minOrderQuantity) }}</template>
              </el-table-column>
              <el-table-column label="整倍订货量" width="120" align="right">
                <template #default="scope">{{ quantity(scope.row.orderMultipleQuantity) }}</template>
              </el-table-column>
              <el-table-column label="限购量" width="110" align="right">
                <template #default="scope">{{ quantity(scope.row.limitQuantity) }}</template>
              </el-table-column>
              <el-table-column label="默认" width="80">
                <template #default="scope">{{ scope.row.defaultFlag ? '是' : '否' }}</template>
              </el-table-column>
              <el-table-column label="更新时间" width="170">
                <template #default="scope">{{ formatTime(scope.row.updatedTime) }}</template>
              </el-table-column>
              <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
            </el-table>
          </el-tab-pane>
          <el-tab-pane label="商品图片">
            <el-table class="supply-scroll-table detail-table" :data="detail.images" max-height="320" size="small">
              <el-table-column label="图片" width="96">
                <template #default="scope">
                  <el-image
                    v-if="scope.row.imageUrl"
                    class="product-thumb"
                    :src="scope.row.imageUrl"
                    fit="cover"
                    preview-teleported
                    :preview-src-list="[scope.row.imageUrl]"
                  />
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column prop="imageKey" label="图片标识" min-width="360" show-overflow-tooltip />
              <el-table-column label="图片类型" width="120">
                <template #default="scope">{{ imageTypeLabel(scope.row.imageTypeCode) }}</template>
              </el-table-column>
              <el-table-column prop="ordinal" label="排序" width="90" />
            </el-table>
          </el-tab-pane>
        </el-tabs>
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
              <el-input v-model="form.productSpecification" clearable placeholder="如 12桶/箱、500ml" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商品分类">
              <el-select
                v-model="form.categoryId"
                filterable
                remote
                clearable
                reserve-keyword
                placeholder="搜索分类"
                :remote-method="searchCategories"
                :loading="categoryLoading"
                style="width: 100%"
              >
                <el-option
                  v-for="item in categoryOptions"
                  :key="item.id"
                  :label="item.categoryName"
                  :value="item.id"
                />
              </el-select>
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
              <el-select v-model="form.unitCode" clearable filterable placeholder="选择单位" style="width: 100%">
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
              <el-select v-model="form.shelfStatusCode" placeholder="选择上架状态" style="width: 100%">
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
            <el-form-item label="起订量">
              <el-input-number v-model="form.minOrderQuantity" :min="0" :precision="2" style="width: 100%" />
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
              <el-input-number v-model="form.limitQuantity" :min="0" :precision="2" style="width: 100%" />
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
              <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="1000" show-word-limit />
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
                  <el-input v-model="variant.specificationSnapshot" clearable placeholder="如 原味/箱" />
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
                  <el-input-number v-model="variant.salePrice" :min="0" :precision="2" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="4">
                <el-form-item label="市场价">
                  <el-input-number v-model="variant.marketPrice" :min="0" :precision="2" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="4">
                <el-form-item label="采购价">
                  <el-input-number v-model="variant.purchasePrice" :min="0" :precision="2" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="4">
                <el-form-item label="起订量">
                  <el-input-number v-model="variant.minOrderQuantity" :min="0" :precision="2" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="4">
                <el-form-item label="整倍数量">
                  <el-input-number v-model="variant.orderMultipleQuantity" :min="0" :precision="2" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="4">
                <el-form-item label="限购量">
                  <el-input-number v-model="variant.limitQuantity" :min="0" :precision="2" style="width: 100%" />
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
        <el-button type="primary" :loading="saving" @click="saveProduct(true)">保存并提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createErpManagedProduct,
  deleteErpManagedProduct,
  getErpManagedProduct,
  getErpManagedProducts,
  updateErpManagedProduct,
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
  getErpProductCategories,
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

interface ProductFilters {
  productCode: string
  productName: string
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
  tagCodes: string[]
  limitQuantity: number | null
  defaultWarehouseId: string | null
  images: ImageForm[]
  variants: VariantForm[]
  remark: string
  revision: number | null
}

const shelfStatusOptions = computed(() => businessDictionaryOptions('ERP', 'PRODUCT_SHELF_STATUS'))
const submitStatusOptions = computed(() => businessDictionaryOptions('ERP', 'PRODUCT_SUBMIT_STATUS'))
const saleTypeOptions = computed(() => businessDictionaryOptions('ERP', 'PRODUCT_SALE_TYPE'))
const unitOptions = computed(() => businessDictionaryOptions('COMMON', 'PRODUCT_UNIT'))

const loading = ref(false)
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
  shelfStatusCode: '',
  submitStatusCode: '',
})
const form = reactive<ProductForm>(emptyForm())

const categoryOptions = ref<ErpProductCategoryView[]>([])
const brandOptions = ref<ErpProductBrandView[]>([])
const tagOptions = ref<ErpProductTagView[]>([])
const warehouseOptions = ref<ErpInternalWarehouseView[]>([])
const categoryLoading = ref(false)
const brandLoading = ref(false)
const warehouseLoading = ref(false)

const mainDetailImageUrl = computed(() => {
  const images = detail.value?.images ?? []
  return images.find((item) => item.imageTypeCode === 'MAIN')?.imageUrl
    ?? images.find((item) => item.imageUrl)?.imageUrl
    ?? null
})
const detailPreviewUrls = computed(() => (
  (detail.value?.images ?? [])
    .map((image) => image.imageUrl)
    .filter((url): url is string => Boolean(url))
))

function tableRowIndex(index: number): number {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

onMounted(() => {
  void loadBusinessDictionaries([
    { moduleCode: 'COMMON', code: 'PRODUCT_UNIT' },
    { moduleCode: 'ERP', code: 'PRODUCT_SUBMIT_STATUS' },
    { moduleCode: 'ERP', code: 'PRODUCT_SALE_TYPE' },
    { moduleCode: 'ERP', code: 'PRODUCT_SHELF_STATUS' },
  ])
  void loadReferenceOptions()
  void loadRows()
})

async function loadRows() {
  loading.value = true
  try {
    pageData.value = await getErpManagedProducts({
      begin: (currentPage.value - 1) * pageSize.value,
      step: pageSize.value,
      productCode: empty(filters.productCode),
      productName: empty(filters.productName),
      shelfStatusCode: empty(filters.shelfStatusCode),
      submitStatusCode: empty(filters.submitStatusCode),
    })
  } catch (reason) {
    pageData.value = { total: 0, begin: 0, step: pageSize.value, items: [] }
    ElMessage.error(errorMessage(reason, '商品列表加载失败'))
  } finally {
    loading.value = false
  }
}

async function loadReferenceOptions() {
  await Promise.all([
    searchCategories(''),
    searchBrands(''),
    searchTags(),
    searchWarehouses(''),
  ])
}

async function searchCategories(query: string) {
  categoryLoading.value = true
  try {
    categoryOptions.value = (await getErpProductCategories({
      begin: 0,
      step: 50,
      categoryName: empty(query),
    })).items
  } finally {
    categoryLoading.value = false
  }
}

async function searchBrands(query: string) {
  brandLoading.value = true
  try {
    brandOptions.value = (await getErpProductBrands({
      begin: 0,
      step: 50,
      brandName: empty(query),
    })).items
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
    warehouseOptions.value = (await getErpInventoryWarehouses({
      begin: 0,
      step: 50,
      warehouseName: empty(query),
      statusCode: 'ACTIVE',
    })).items
  } finally {
    warehouseLoading.value = false
  }
}

async function resetFilters() {
  filters.productCode = ''
  filters.productName = ''
  filters.shelfStatusCode = ''
  filters.submitStatusCode = ''
  currentPage.value = 1
  await loadRows()
}

async function handleSizeChange() {
  currentPage.value = 1
  await loadRows()
}

async function openDetail(row: ErpManagedProductSummary) {
  detailVisible.value = true
  detail.value = null
  try {
    detail.value = await getErpManagedProduct(row.id)
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
    .filter((variant) => (
      variant.id
      || variant.specificationSnapshot
      || variant.salePrice != null
      || variant.marketPrice != null
      || variant.purchasePrice != null
    ))
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

function empty(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized || undefined
}

function numberOrNull(value: number | null | undefined) {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function money(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : `¥${Number(value).toFixed(2)}`
}

function quantity(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return Number(value).toString()
}

function formatTime(value: string | null | undefined) {
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
</style>
