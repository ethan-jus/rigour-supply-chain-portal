<template>
  <div class="cost-field-grid">
    <el-form-item label="单据来源" required
      ><el-select v-model="document.sourceSystem" :disabled="!!document.linkedId"
        ><el-option label="订货宝" value="DHB" /><el-option
          label="其他系统"
          value="OTHER" /><el-option label="纸质或人工单据" value="MANUAL" /></el-select
    ></el-form-item>
    <el-form-item v-if="document.sourceSystem === 'OTHER'" label="系统名称" required
      ><el-input v-model="document.sourceSystemName" maxlength="120"
    /></el-form-item>
    <el-form-item v-if="evidence" label="凭据类型" required
      ><el-input v-model="document.documentType" maxlength="64" placeholder="例如合同、费用凭据"
    /></el-form-item>
    <el-form-item label="外部单号" required
      ><el-input
        v-model="document.documentNo"
        :disabled="!!document.linkedId"
        maxlength="100"
        placeholder="填写订货宝等来源中的实际单号"
    /></el-form-item>
    <el-form-item label="单据日期" required
      ><el-date-picker v-model="document.documentDate" value-format="YYYY-MM-DD"
    /></el-form-item>
    <el-form-item
      :label="senderLabel || (evidence ? '凭据对方' : '单据发货方')"
      :required="!evidence"
      ><el-input v-model="document.senderName" maxlength="200"
    /></el-form-item>
    <el-form-item
      :label="receiverLabel || (evidence ? '凭据我方' : '单据收货方')"
      :required="!evidence"
      ><el-input v-model="document.receiverName" maxlength="200"
    /></el-form-item>
    <el-form-item v-if="addresses" label="单据收货地址"
      ><el-input v-model="document.destinationAddress" maxlength="500"
    /></el-form-item>
    <el-form-item v-if="document.linkedId" label="补关联差异说明"
      ><el-input
        v-model="document.differenceReason"
        maxlength="500"
        placeholder="双方或单号不同，请说明原因"
    /></el-form-item>
    <el-form-item label="单据备注"
      ><el-input v-model="document.remark" maxlength="500"
    /></el-form-item>
  </div>
</template>
<script setup lang="ts">
import type { CostExternalDocument } from '@/api/core/cost'
defineProps<{
  senderLabel?: string
  receiverLabel?: string
  evidence?: boolean
  addresses?: boolean
}>()
const document = defineModel<CostExternalDocument>({ required: true })
</script>
