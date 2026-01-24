<template>
  <t-row :gutter="[16, 16]">
    <t-col v-for="(item, index) in panelData" :key="item.title" :xs="12" :sm="8" :md="6" :lg="4" :xl="4">
      <t-card
        :bordered="false"
        class="dashboard-card"
        :class="[`dashboard-card--${item.color}`]"
        hover-shadow
      >
        <div class="card-content">
          <div class="card-icon-wrapper">
            <div class="card-icon" :class="[`card-icon--${item.color}`]">
              <component :is="item.icon" />
            </div>
          </div>
          <div class="card-info">
            <div class="card-subtitle">{{ item.title }}</div>
            <t-skeleton v-if="loading" :loading="true" />
            <div v-else class="card-value">{{ item.value }}</div>
            <div v-if="item.desc && !loading" class="card-desc">{{ item.desc }}</div>
          </div>
        </div>
      </t-card>
    </t-col>
  </t-row>
</template>

<script setup lang="ts">
import { 
  ServerIcon, 
  LayersIcon, 
  ViewModuleIcon,
  ControlPlatformIcon,
  CloudIcon,
  DashboardIcon
} from 'tdesign-icons-vue-next';
import { computed } from 'vue';
import type { ClusterMetricsResponse, ClusterResourceStats } from '@/api/dashboard';

defineOptions({
  name: 'TopPanel',
});

const props = defineProps<{
  clusterId: string;
  clusterMetrics: ClusterMetricsResponse | null;
  resourceStats: ClusterResourceStats | null;
  loading?: boolean;
}>();

// 面板数据
const panelData = computed(() => {
  const metrics = props.clusterMetrics;
  const stats = props.resourceStats;
  
  if (!metrics || !stats) {
    return [
      { title: 'CPU 使用率', value: '-', desc: '正在加载...', icon: ControlPlatformIcon, color: 'blue' },
      { title: '内存使用率', value: '-', desc: '正在加载...', icon: DashboardIcon, color: 'green' },
      { title: '节点总数', value: '-', desc: '正在加载...', icon: ServerIcon, color: 'orange' },
      { title: 'Pod 总数', value: '-', desc: '正在加载...', icon: LayersIcon, color: 'purple' },
      { title: '命名空间', value: '-', desc: '正在加载...', icon: ViewModuleIcon, color: 'cyan' },
      { title: 'Deployment', value: '-', desc: '正在加载...', icon: CloudIcon, color: 'pink' },
    ];
  }

  return [
    {
      title: 'CPU 使用率',
      value: `${metrics.cpu_percentage.toFixed(1)}%`,
      desc: `${metrics.cpu_usage} / ${metrics.cpu_total}`,
      icon: ControlPlatformIcon,
      color: 'blue',
    },
    {
      title: '内存使用率',
      value: `${metrics.memory_percentage.toFixed(1)}%`,
      desc: `${metrics.memory_usage} / ${metrics.memory_total}`,
      icon: DashboardIcon,
      color: 'green',
    },
    {
      title: '节点总数',
      value: metrics.nodes_count.toString(),
      desc: '集群节点数',
      icon: ServerIcon,
      color: 'orange',
    },
    {
      title: 'Pod 总数',
      value: stats.pod_count.toString(),
      desc: `运行中: ${stats.pod_running}`,
      icon: LayersIcon,
      color: 'purple',
    },
    {
      title: '命名空间',
      value: stats.namespace_count.toString(),
      desc: '命名空间数量',
      icon: ViewModuleIcon,
      color: 'cyan',
    },
    {
      title: 'Deployment',
      value: stats.deployment_count.toString(),
      desc: `Service: ${stats.service_count}`,
      icon: CloudIcon,
      color: 'pink',
    },
  ];
});
</script>

<style lang="less" scoped>
.dashboard-card {
  height: 100%;
  transition: all 0.3s ease;
  border: 1px solid var(--td-component-border);

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--td-shadow-3);
  }

  :deep(.t-card__body) {
    padding: var(--td-comp-paddingTB-xl) var(--td-comp-paddingLR-xl);
  }

  .card-content {
    display: flex;
    align-items: flex-start;
    gap: 16px;
  }

  .card-icon-wrapper {
    flex-shrink: 0;
  }

  .card-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    transition: all 0.3s ease;

    &--blue {
      background: rgba(0, 82, 217, 0.1);
      color: #0052d9;
    }

    &--green {
      background: rgba(0, 168, 112, 0.1);
      color: #00a870;
    }

    &--orange {
      background: rgba(232, 125, 0, 0.1);
      color: #e87d00;
    }

    &--purple {
      background: rgba(121, 70, 249, 0.1);
      color: #7946f9;
    }

    &--cyan {
      background: rgba(0, 191, 180, 0.1);
      color: #00bfb4;
    }

    &--pink {
      background: rgba(232, 70, 132, 0.1);
      color: #e84684;
    }
  }

  .card-info {
    flex: 1;
    min-width: 0;
  }

  .card-subtitle {
    font-size: 14px;
    color: var(--td-text-color-secondary);
    margin-bottom: 12px;
    font-weight: 500;
  }

  .card-value {
    font-size: 28px;
    font-weight: 600;
    color: var(--td-text-color-primary);
    line-height: 1.2;
    margin-bottom: 8px;
  }

  .card-desc {
    font-size: 12px;
    color: var(--td-text-color-placeholder);
    line-height: 1.5;
  }

  // 悬停时图标放大
  &:hover .card-icon {
    transform: scale(1.1);
  }
}
</style>
