<template>
  <div class="dashboard-container">
    <!-- 集群选择器 -->
    <div class="cluster-selector-wrapper">
      <cluster-selector @change="handleClusterChange" />
    </div>

    <!-- 顶部监控卡片 -->
    <top-panel v-if="currentClusterId" :cluster-id="currentClusterId" :cluster-metrics="clusterMetrics"
      :resource-stats="resourceStats" :loading="metricsLoading" class="row-container" />

    <!-- 监控趋势图表和最近活动 -->
    <t-row v-if="currentClusterId" :gutter="[16, 16]" class="row-container">
      <t-col :xs="24" :md="12" :lg="12">
        <metrics-chart :cluster-id="currentClusterId" />
      </t-col>
      <t-col :xs="24" :md="12" :lg="12">
        <recent-activity :cluster-id="currentClusterId" :limit="8" />
      </t-col>
    </t-row>

    <!-- 节点资源使用情况 -->
    <resource-panel v-if="currentClusterId" :cluster-id="currentClusterId" class="row-container" />
  </div>
</template>

<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { onMounted, ref } from 'vue';
import {
  getClusterMetrics,
  getClusterResourceStats,
  type ClusterMetricsResponse,
  type ClusterResourceStats
} from '@/api/dashboard';
import ClusterSelector from './components/ClusterSelector.vue';
import ResourcePanel from './components/ResourcePanel.vue';
import TopPanel from './components/TopPanel.vue';
import RecentActivity from './components/RecentActivity.vue';
import MetricsChart from './components/MetricsChart.vue';

defineOptions({
  name: 'DashboardBase',
});

const currentClusterId = ref<string>('');
const clusterMetrics = ref<ClusterMetricsResponse | null>(null);
const resourceStats = ref<ClusterResourceStats | null>(null);
const metricsLoading = ref(false);

// 获取集群监控数据
const fetchClusterMetrics = async (clusterId: string) => {
  if (!clusterId) return;

  metricsLoading.value = true;
  try {
    const [metricsRes, statsRes] = await Promise.all([
      getClusterMetrics(clusterId),
      getClusterResourceStats(clusterId),
    ]);
    clusterMetrics.value = metricsRes;
    resourceStats.value = statsRes;
  } catch (error) {
    MessagePlugin.error('获取集群监控数据失败');
    console.error('Failed to fetch cluster metrics:', error);
  } finally {
    metricsLoading.value = false;
  }
};

// 处理集群切换
const handleClusterChange = (clusterId: string) => {
  currentClusterId.value = clusterId;
  fetchClusterMetrics(clusterId);
};

onMounted(() => {
  // 初始加载会由 ClusterSelector 触发
});
</script>

<style lang="less" scoped>
.dashboard-container {
  padding: var(--td-comp-paddingTB-l) var(--td-comp-paddingLR-xl);
}

.cluster-selector-wrapper {
  margin-bottom: var(--td-comp-margin-xxl);
}

.row-container:not(:last-child) {
  margin-bottom: 16px;
}
</style>
