<template>
  <el-card class="supply-page supply-page--static supply-placeholder" shadow="never">
    <template #header>
      <div class="placeholder-heading">
        <div>
          <span>供应链业务工作台</span>
          <h1>{{ title }}</h1>
          <p>{{ description }}</p>
        </div>
        <el-tag type="info" effect="plain">能力建设中</el-tag>
      </div>
    </template>
    <div class="placeholder-body">
      <el-empty description="页面入口已就绪，待业务接口可用后接入真实数据。">
        <template #image><div class="module-mark">{{ title.slice(0, 2) }}</div></template>
      </el-empty>
      <el-alert
        v-if="note"
        type="info"
        :closable="false"
        show-icon
        :title="note"
      />
    </div>
  </el-card>
</template>

<script setup lang="ts">
defineProps<{ title: string; description: string; note?: string }>()
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.supply-placeholder {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.supply-placeholder :deep(.el-card__header) {
  background: linear-gradient(115deg, #fff 0%, #f8fbff 100%);
}

.supply-placeholder :deep(.el-card__body) {
  display: flex;
  min-height: 0;
  flex: 1;
  padding: 0;
}

.placeholder-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $spacing-lg;
}

.placeholder-heading span {
  color: $color-primary;
  font-size: $font-size-xs;
  font-weight: 700;
  letter-spacing: .08em;
}

.placeholder-heading h1 {
  margin: 5px 0;
  color: $color-text-primary;
  font-size: 24px;
}

.placeholder-heading p {
  max-width: 820px;
  margin: 0;
  color: $color-text-secondary;
  line-height: 1.65;
}

.placeholder-body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  padding: $spacing-lg;
  background:
    radial-gradient(circle at 15% 10%, rgba(37, 99, 235, .08), transparent 32%),
    linear-gradient(180deg, #fff 0%, #f8fafc 100%);
}

.placeholder-body > .el-empty {
  flex: 1;
}

.module-mark {
  display: grid;
  width: 76px;
  height: 76px;
  color: $color-primary;
  border: 1px solid #bfdbfe;
  border-radius: 22px;
  background: #eff6ff;
  font-size: $font-size-lg;
  font-weight: 750;
  box-shadow: 0 12px 24px rgba(37, 99, 235, .12);
  place-items: center;
}

@media (max-width: 720px) {
  .placeholder-heading {
    flex-direction: column;
  }
}
</style>
