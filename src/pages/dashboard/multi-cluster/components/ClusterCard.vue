<template>
  <t-card class="cluster-card" :bordered="false" hoverable>
    <template #header>
      <div class="card-header">
        <div class="header-left">
          <span class="cluster-name">{{ cluster.name }}</span>
          <t-tag :theme="getEnvTheme(cluster.environment)" size="small" class="env-tag">
            {{ getEnvLabel(cluster.environment) }}
          </t-tag>
        </div>
      </div>
    </template>

    <!-- 健康状态 -->
    <div class="health-section">
      <div class="health-icon" :class="`health-icon--${cluster.health_status}`">
        <component :is="getHealthIcon()" />
      </div>
      <div class="health-info">
        <div class="health-label">{{ getHealthLabel() }}</div>
        <div class="health-score">{{ cluster.health_score }}%</div>
      </div>
    </div>

    <!-- 指标统计 -->
    <div class="metrics-section">
      <div class="metric-item">
        <span class="metric-dot metric-dot--success"></span>
        <span class="metric-label">节点:</span>
        <span class="metric-value">{{ cluster.nodes_ready }}/{{ cluster.nodes_total }} Ready</span>
      </div>

      <div class="metric-item">
        <span class="metric-dot"
          :class="cluster.pods_running < cluster.pods_total ? 'metric-dot--warning' : 'metric-dot--success'"></span>
        <span class="metric-label">Pods:</span>
        <span class="metric-value">{{ cluster.pods_running }}/{{ cluster.pods_total }} Running</span>
      </div>

      <div class="metric-item metric-item--bar">
        <div class="metric-bar-label">
          <span>CPU 使用率</span>
          <span class="metric-percentage">{{ cluster.cpu_percentage.toFixed(1) }}%</span>
        </div>
        <t-progress :percentage="cluster.cpu_percentage" :theme="getUsageTheme(cluster.cpu_percentage)" :label="false"
          size="medium" />
      </div>

      <div class="metric-item metric-item--bar">
        <div class="metric-bar-label">
          <span>内存使用率</span>
          <span class="metric-percentage">{{ cluster.memory_percentage.toFixed(1) }}%</span>
        </div>
        <t-progress :percentage="cluster.memory_percentage" :theme="getUsageTheme(cluster.memory_percentage)"
          :label="false" size="medium" />
      </div>
    </div>

    <!-- 操作按钮 -->
    <template #actions>
      <div class="card-actions">
        <t-button theme="primary" variant="base" size="small" @click="handleViewDetails">
          查看详情
        </t-button>
        <t-button theme="default" variant="outline" size="small" @click="handleManageResources">
          集群资源
        </t-button>
      </div>
    </template>
  </t-card>
</template>

<script setup lang="ts">
import { CheckCircleIcon, ErrorCircleIcon, HelpCircleIcon } from 'tdesign-icons-vue-next';
import type { ClusterMetricsSummary } from '@/api/dashboard';

defineOptions({
  name: 'ClusterCard',
});

const props = defineProps<{
  cluster: ClusterMetricsSummary;
}>();

const emit = defineEmits<{
  viewDetails: [clusterId: string];
  manageResources: [clusterId: string];
}>();

// 环境标签和主题
const getEnvLabel = (env: string): string => {
  const labels: Record<string, string> = {
    prod: '生产',
    staging: '预发布',
    dev: '测试',
  };
  return labels[env] || env;
};

const getEnvTheme = (env: string): 'default' | 'primary' | 'warning' | 'danger' | 'success' => {
  const themes: Record<string, 'default' | 'primary' | 'warning' | 'danger' | 'success'> = {
    prod: 'danger',
    staging: 'warning',
    dev: 'primary',
  };
  return themes[env] || 'default';
};

// 健康状态
const getHealthIcon = () => {
  if (props.cluster.health_status === 'healthy') return CheckCircleIcon;
  if (props.cluster.health_status === 'warning') return HelpCircleIcon;
  return ErrorCircleIcon;
};

const getHealthLabel = () => {
  if (props.cluster.health_status === 'healthy') return '运行正常';
  if (props.cluster.health_status === 'warning') return '存在风险';
  return '需要关注';
};

// 使用率主题
const getUsageTheme = (percentage: number): 'success' | 'warning' | 'error' => {
  if (percentage >= 85) return 'error';
  if (percentage >= 70) return 'warning';
  return 'success';
};

// 操作事件
const handleViewDetails = () => {
  emit('viewDetails', props.cluster.id);
};

const handleManageResources = () => {
  emit('manageResources', props.cluster.id);
};
</script>

<style lang="less" scoped>
.cluster-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
  }

  :deep(.t-card__body) {
    flex: 1;
    padding: 16px;
  }

  :deep(.t-card__actions) {
    padding: 12px 16px;
    border-top: 1px solid var(--td-component-border);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cluster-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.env-tag {
  font-weight: 500;
}

.health-section {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  margin-bottom: 16px;
  border-radius: 8px;
  background: var(--td-bg-color-container);
}

.health-icon {
  font-size: 32px;

  &--healthy {
    color: #00a870;
  }

  &--warning {
    color: #e87d00;
  }

  &--critical {
    color: #d03838;
  }
}

.health-info {
  flex: 1;
}

.health-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-primary);
  margin-bottom: 2px;
}

.health-score {
  font-size: 20px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.metrics-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;

  &--bar {
    flex-direction: column;
    align-items: stretch;
  }
}

.metric-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &--success {
    background: #00a870;
  }

  &--warning {
    background: #e87d00;
  }

  &--danger {
    background: #d03838;
  }
}

.metric-label {
  color: var(--td-text-color-secondary);
  flex-shrink: 0;
}

.metric-value {
  color: var(--td-text-color-primary);
  font-weight: 500;
}

.metric-bar-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.metric-percentage {
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.card-actions {
  display: flex;
  gap: 8px;
  justify-content: stretch;

  .t-button {
    flex: 1;
  }
}
</style>
