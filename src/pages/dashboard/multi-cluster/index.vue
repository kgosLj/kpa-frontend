<template>
  <div class="multi-cluster-dashboard">
    <!-- 全局统计面板 -->
    <global-stats-panel :stats="globalStats" :loading="statsLoading" />

    <!-- 筛选工具栏 -->
    <t-card :bordered="false" class="filter-toolbar">
      <div class="toolbar-content">
        <div class="toolbar-left">
          <t-select v-model="filterEnv" :options="envOptions" placeholder="环境筛选" style="width: 150px">
            <template #prefixIcon>
              <filter-icon />
            </template>
          </t-select>

          <t-radio-group v-model="filterHealth" variant="default-filled">
            <t-radio-button value="all">全部</t-radio-button>
            <t-radio-button value="healthy">健康</t-radio-button>
            <t-radio-button value="warning">警告</t-radio-button>
            <t-radio-button value="critical">异常</t-radio-button>
          </t-radio-group>
        </div>

        <div class="toolbar-right">
          <t-input v-model="searchKeyword" placeholder="搜索集群名称" clearable style="width: 200px">
            <template #prefixIcon>
              <search-icon />
            </template>
          </t-input>

          <t-button variant="outline" :icon="RefreshIcon" @click="refreshData">
            刷新
          </t-button>
        </div>
      </div>
    </t-card>

    <!-- 异常集群警告 -->
    <t-alert v-if="globalStats.unhealthy_clusters > 0" theme="warning"
      :message="`发现 ${globalStats.unhealthy_clusters} 个集群存在健康问题，建议尽快处理`" close class="alert-banner">
      <template #operation>
        <t-button size="small" variant="text" @click="showUnhealthyClusters">
          查看异常集群 →
        </t-button>
      </template>
    </t-alert>

    <!-- 集群卡片网格 -->
    <t-loading :loading="loading" size="large">
      <div v-if="filteredClusters.length > 0" class="clusters-grid">
        <cluster-card v-for="cluster in filteredClusters" :key="cluster.id" :cluster="cluster"
          @view-details="handleViewDetails" @manage-resources="handleManageResources" />
      </div>

      <!-- 空状态 -->
      <t-empty v-else description="暂无集群数据">
        <template #image>
          <server-icon style="font-size: 64px; color: var(--td-text-color-placeholder)" />
        </template>
      </t-empty>
    </t-loading>
  </div>
</template>

<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { FilterIcon, SearchIcon, RefreshIcon, ServerIcon } from 'tdesign-icons-vue-next';
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  getAllClustersMetrics,
  getGlobalStats,
  type ClusterMetricsSummary,
  type GlobalStats,
} from '@/api/dashboard';
import ClusterCard from './components/ClusterCard.vue';
import GlobalStatsPanel from './components/GlobalStatsPanel.vue';

defineOptions({
  name: 'MultiClusterDashboard',
});

const router = useRouter();

const loading = ref(false);
const statsLoading = ref(false);
const clusters = ref<ClusterMetricsSummary[]>([]);
const globalStats = ref<GlobalStats>({
  total_clusters: 0,
  total_nodes: 0,
  total_pods: 0,
  overall_health_score: 0,
  clusters_by_env: {},
  unhealthy_clusters: 0,
});

const filterEnv = ref('all');
const filterHealth = ref('all');
const searchKeyword = ref('');

// 环境选项
const envOptions = [
  { label: '全部环境', value: 'all' },
  { label: '生产环境', value: 'prod' },
  { label: '预发布环境', value: 'staging' },
  { label: '测试环境', value: 'dev' },
];

// 筛选后的集群列表
const filteredClusters = computed(() => {
  let result = clusters.value;

  // 环境筛选
  if (filterEnv.value !== 'all') {
    result = result.filter((c) => c.environment === filterEnv.value);
  }

  // 健康状态筛选
  if (filterHealth.value !== 'all') {
    result = result.filter((c) => c.health_status === filterHealth.value);
  }

  // 关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    result = result.filter((c) => c.name.toLowerCase().includes(keyword));
  }

  return result;
});

// 获取集群数据
const fetchClusters = async () => {
  loading.value = true;
  try {
    clusters.value = await getAllClustersMetrics();
  } catch (error) {
    MessagePlugin.error('获取集群数据失败');
    console.error('Failed to fetch clusters:', error);
  } finally {
    loading.value = false;
  }
};

// 获取全局统计
const fetchGlobalStats = async () => {
  statsLoading.value = true;
  try {
    globalStats.value = await getGlobalStats();
  } catch (error) {
    MessagePlugin.error('获取统计数据失败');
    console.error('Failed to fetch global stats:', error);
  } finally {
    statsLoading.value = false;
  }
};

// 刷新数据
const refreshData = async () => {
  await Promise.all([fetchClusters(), fetchGlobalStats()]);
  MessagePlugin.success('数据已刷新');
};

// 显示异常集群
const showUnhealthyClusters = () => {
  filterHealth.value = 'critical';
};

// 查看集群详情
const handleViewDetails = (clusterId: string) => {
  // 保存选中的集群 ID 到 localStorage
  localStorage.setItem('kpa_selected_cluster_id', clusterId);
  // 跳转到单集群详细面板
  router.push('/dashboard/base');
};

// 管理集群资源
const handleManageResources = (clusterId: string) => {
  // 保存选中的集群 ID 到 localStorage
  localStorage.setItem('kpa_selected_cluster_id', clusterId);
  // 跳转到集群资源管理页面
  router.push('/cluster-resources');
};

onMounted(() => {
  fetchClusters();
  fetchGlobalStats();

  // 设置自动刷新（30秒）
  const intervalId = setInterval(() => {
    fetchClusters();
    fetchGlobalStats();
  }, 30000);

  // 组件卸载时清除定时器
  onBeforeUnmount(() => {
    clearInterval(intervalId);
  });
});
</script>

<style lang="less" scoped>
.multi-cluster-dashboard {
  padding: var(--td-comp-paddingTB-l) var(--td-comp-paddingLR-xl);
}

.filter-toolbar {
  margin-bottom: 16px;

  :deep(.t-card__body) {
    padding: 12px 16px;
  }
}

.toolbar-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.alert-banner {
  margin-bottom: 16px;
}

.clusters-grid {
  display: grid;
  gap: 16px;

  // 大屏: 3 列
  @media (min-width: 1200px) {
    grid-template-columns: repeat(3, 1fr);
  }

  // 中屏: 2 列
  @media (min-width: 768px) and (max-width: 1199px) {
    grid-template-columns: repeat(2, 1fr);
  }

  // 小屏: 1 列
  @media (max-width: 767px) {
    grid-template-columns: 1fr;
  }
}
</style>
