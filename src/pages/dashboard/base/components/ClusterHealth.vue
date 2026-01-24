<template>
  <t-card title="集群健康状态" :bordered="false" class="health-card">
    <t-loading :loading="loading" size="small">
      <div class="health-content">
        <!-- 总体健康状态 -->
        <div class="health-overall">
          <div class="health-status" :class="`health-status--${overallHealth}`">
            <component :is="getHealthIcon()" class="health-icon" />
            <div class="health-text">
              <div class="health-label">{{ getHealthLabel() }}</div>
              <div class="health-score">健康度: {{ healthScore }}%</div>
            </div>
          </div>
        </div>

        <!-- Pod 状态分布 -->
        <div v-if="podDistribution.length > 0" class="pod-distribution">
          <div class="distribution-title">Pod 状态分布</div>
          <div class="distribution-bars">
            <div v-for="stat in podDistribution" :key="stat.status" class="distribution-bar">
              <div class="distribution-label">
                <span :class="`distribution-dot distribution-dot--${stat.color}`"></span>
                <span>{{ stat.status }}</span>
                <span class="distribution-count">({{ stat.count }})</span>
              </div>
              <t-progress :percentage="stat.percentage" :theme="stat.color as any" :label="false" size="medium" />
            </div>
          </div>
        </div>

        <!-- 健康提示 -->
        <div class="health-tips">
          <div v-if="cpuUsage >= 80" class="health-tip health-tip--warning">
            <error-circle-filled-icon />
            <span>CPU 使用率较高 ({{ cpuUsage.toFixed(1) }}%)，建议关注</span>
          </div>
          <div v-if="memoryUsage >= 80" class="health-tip health-tip--warning">
            <error-circle-filled-icon />
            <span>内存使用率较高 ({{ memoryUsage.toFixed(1) }}%)，建议关注</span>
          </div>
          <div v-if="podsRunning < podsTotal" class="health-tip health-tip--info">
            <info-circle-icon />
            <span>有 {{ podsTotal - podsRunning }} 个 Pod 未处于 Running 状态</span>
          </div>
        </div>
      </div>
    </t-loading>
  </t-card>
</template>

<script setup lang="ts">
import {
  CheckCircleIcon,
  ErrorCircleIcon,
  HelpCircleIcon,
  ErrorCircleFilledIcon,
  InfoCircleIcon
} from 'tdesign-icons-vue-next';
import { computed } from 'vue';
import type { ClusterMetricsResponse, ClusterResourceStats } from '@/api/dashboard';

defineOptions({
  name: 'ClusterHealth',
});

const props = defineProps<{
  clusterId: string;
  clusterMetrics: ClusterMetricsResponse | null;
  resourceStats: ClusterResourceStats | null;
  loading?: boolean;
}>();

// 节点统计
const nodesTotal = computed(() => props.clusterMetrics?.nodes_count || 0);
const nodesReady = computed(() => nodesTotal.value);

// Pod 统计
const podsTotal = computed(() => props.resourceStats?.pod_count || 0);
const podsRunning = computed(() => props.resourceStats?.pod_running || 0);

// CPU 和内存使用率
const cpuUsage = computed(() => props.clusterMetrics?.cpu_percentage || 0);
const memoryUsage = computed(() => props.clusterMetrics?.memory_percentage || 0);

// Pod 状态分布
const podDistribution = computed(() => {
  if (!props.resourceStats) return [];

  const total = podsTotal.value;
  const running = podsRunning.value;
  const others = total - running;

  const distribution = [];

  if (running > 0) {
    distribution.push({
      status: 'Running',
      count: running,
      percentage: (running / total) * 100,
      color: 'success',
    });
  }

  if (others > 0) {
    distribution.push({
      status: 'Other',
      count: others,
      percentage: (others / total) * 100,
      color: 'warning',
    });
  }

  return distribution;
});

// 计算健康分数 (0-100)
const healthScore = computed(() => {
  if (!props.clusterMetrics || !props.resourceStats) return 0;

  let score = 100;

  // Pod 运行率影响 (40%)
  const podRunningRate = podsTotal.value > 0 ? (podsRunning.value / podsTotal.value) : 1;
  score -= (1 - podRunningRate) * 40;

  // CPU 使用率影响 (30%)
  if (cpuUsage.value > 90) {
    score -= 30;
  } else if (cpuUsage.value > 80) {
    score -= 20;
  } else if (cpuUsage.value > 70) {
    score -= 10;
  }

  // 内存使用率影响 (30%)
  if (memoryUsage.value > 90) {
    score -= 30;
  } else if (memoryUsage.value > 80) {
    score -= 20;
  } else if (memoryUsage.value > 70) {
    score -= 10;
  }

  return Math.max(0, Math.round(score));
});

// 总体健康状态
const overallHealth = computed(() => {
  const score = healthScore.value;
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'warning';
  return 'critical';
});

// 获取健康状态图标
const getHealthIcon = () => {
  const health = overallHealth.value;
  if (health === 'healthy') return CheckCircleIcon;
  if (health === 'warning') return HelpCircleIcon;
  return ErrorCircleIcon;
};

// 获取健康状态文本
const getHealthLabel = () => {
  const health = overallHealth.value;
  if (health === 'healthy') return '集群运行正常';
  if (health === 'warning') return '集群存在风险';
  return '集群需要关注';
};
</script>

<style lang="less" scoped>
.health-card {
  height: 100%;
}

.health-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.health-overall {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

.health-status {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  border-radius: 12px;

  &--healthy {
    background: rgba(0, 168, 112, 0.1);

    .health-icon {
      color: #00a870;
      font-size: 48px;
    }

    .health-label {
      color: #00a870;
    }
  }

  &--warning {
    background: rgba(232, 125, 0, 0.1);

    .health-icon {
      color: #e87d00;
      font-size: 48px;
    }

    .health-label {
      color: #e87d00;
    }
  }

  &--critical {
    background: rgba(208, 56, 56, 0.1);

    .health-icon {
      color: #d03838;
      font-size: 48px;
    }

    .health-label {
      color: #d03838;
    }
  }
}

.health-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.health-label {
  font-size: 18px;
  font-weight: 600;
}

.health-score {
  font-size: 14px;
  color: var(--td-text-color-secondary);
}

.pod-distribution {
  padding-top: 16px;
  border-top: 1px solid var(--td-component-border);
}

.distribution-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-secondary);
  margin-bottom: 12px;
}

.distribution-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.distribution-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.distribution-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.distribution-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;

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

.distribution-count {
  color: var(--td-text-color-placeholder);
}

.health-tips {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.health-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;

  &--warning {
    background: rgba(232, 125, 0, 0.1);
    color: #e87d00;
  }

  &--info {
    background: rgba(0, 82, 217, 0.1);
    color: #0052d9;
  }
}
</style>
