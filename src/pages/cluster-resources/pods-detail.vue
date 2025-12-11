<template>
  <div class="pods-detail-container">
    <t-card :bordered="false">
      <!-- 顶部导航 -->
      <div class="page-header">
        <t-button theme="default" @click="goBack">
          <template #icon><chevron-left-icon /></template>
          返回 Deployments
        </t-button>
        <div class="header-info">
          <h3>{{ deploymentName }} - Pods</h3>
        </div>
      </div>

      <t-divider />

      <!-- Pods 列表 -->
      <pods-view />
    </t-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ChevronLeftIcon } from 'tdesign-icons-vue-next';
import PodsView from './pods.vue';

const route = useRoute();
const router = useRouter();

const deploymentName = computed(() => route.query.deployment as string || 'Unknown');

const goBack = () => {
  router.back();
};
</script>

<style lang="less" scoped>
.pods-detail-container {
  .page-header {
    display: flex;
    align-items: center;
    gap: var(--td-comp-margin-l);

    .header-info {
      flex: 1;

      h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 500;
      }
    }
  }
}
</style>
