<template>
  <section class="supply-page">
    <SupplyPageTitle>薪资规则维护</SupplyPageTitle
    ><el-alert
      title="工资按员工薪资档案和各项规则直接计算，无需创建薪酬方案。"
      type="info"
      :closable="false"
    />
    <p>
      <router-link to="/supply-chain/hr/employees">维护员工薪资</router-link> ·
      <router-link to="/supply-chain/hr/performance-rules">绩效规则</router-link> ·
      <router-link to="/supply-chain/hr/allowance-rules">补贴规则</router-link> ·
      <router-link to="/supply-chain/hr/commission-rules">提成规则</router-link> ·
      <router-link to="/supply-chain/hr/payroll">生成月度薪酬</router-link>
    </p>
  </section>
</template>
<script setup lang="ts">
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
</script>
