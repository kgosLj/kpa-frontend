<template>
  <t-card title="全局统计" :bordered="false" class="global-stats-card">
    <t-loading :loading="loading" size="small">
      <div class="stats-grid">
        <!-- 总集群数 -->
        <div class="stat-item">
          <div class="stat-icon">
            <server-icon />
          </div>
          <div class="stat-content">
            <div class="stat-label">总集群数</div>
            <div class="stat-value">{{ stats.total_clusters }}</div>
            <div v-if="stats.clusters_by_env" class="stat-detail">
              <span v-for="(count, env) in stats.clusters_by_env" :key="env" class="env-badge">
                {{ getEnvLabel(env) }}: {{ count }}
              </span>
            </div>
          </div>
        </div>

        <!-- 总节点数 -->
        <div class="stat-item">
          <div class="stat-icon">
            <dashboard-icon />
          </div>
          <div class="stat-content">
            <div class="stat-label">总节点数</div>
            <div class="stat-value">{{ stats.total_nodes }}</div>
          </div>
        </div>

        <!-- 总 Pod 数 -->
        <div class="stat-item">
          <div class="stat-icon">
            <layers-icon />
          </div>
          <div class="stat-content">
            <div class="stat-label">总 Pod 数</div>
            <div class="stat-value">{{ stats.total_pods }}</div>
          </div>
        </div>

        <!-- 整体健康度 -->
        <div class="stat-item">
          <div class="stat-icon" :class="`health-icon--${getOverallHealthStatus()}`">
            <component :is="getHealthIcon()" />
          </div>
          <div class="stat-content">
            <div class="stat-label">整体健康度</div>
            <div class="stat-value">{{ stats.overall_health_score }}%</div>
            <t-progress :percentage="stats.overall_health_score" :theme="getHealthTheme(stats.overall_health_score)"
              :label="false" size="small" class="stat-progress" />
          </div>
        </div>

        <!-- 异常集群 -->
        <div v-if="stats.unhealthy_clusters > 0" class="stat-item stat-item--alert">
          <div class="stat-icon">
            <error-circle-icon />
          </div>
          <div class="stat-content">
            <div class="stat-label">异常集群</div>
            <div class="stat-value stat-value--alert">{{ stats.unhealthy_clusters }}</div>
          </div>
        </div>
      </div>
    </t-loading>
  </t-card>
</template>

<script setup lang="ts">
import { ServerIcon, DashboardIcon, LayersIcon, CheckCircleIcon, ErrorCircleIcon, HelpCircleIcon } from 'tdesign-icons-vue-next';
import { computed } from 'vue';
import type { GlobalStats } from '@/api/dashboard';

defineOptions({
  name: 'GlobalStatsPanel',
});

const props = defineProps<{
  stats: GlobalStats;
  loading?: boolean;
}>();

// 环境标签映射
const getEnvLabel = (env: string): string => {
  const labels: Record<string, string> = {
    prod: '生产',
    staging: '预发布',
    dev: '测试',
  };
  return labels[env] || env;
};

// 获取整体健康状态
const getOverallHealthStatus = () => {
  const score = props.stats.overall_health_score;
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'warning';
  return 'critical';
};

// 获取健康图标
const getHealthIcon = () => {
  const status = getOverallHealthStatus();
  if (status === 'healthy') return CheckCircleIcon;
  if (status === 'warning') return HelpCircleIcon;
  return ErrorCircleIcon;
};

// 获取健康度主题
const getHealthTheme = (score: number): 'success' | 'warning' | 'error' => {
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'error';
};
</script>

<style lang="less" scoped>
.global-stats-card {
  margin-bottom: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 8px;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-border);
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  &--alert {
    background: rgba(208, 56, 56, 0.05);
    border-color: #d03838;
  }
}

.stat-icon {
  font-size: 32px;
  color: var(--td-brand-color);

  &.health-icon--healthy {
    color: #00a870;
  }

  &.health-icon--warning {
    color: #e87d00;
  }

  &.health-icon--critical {
    color: #d03838;
  }
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--td-text-color-primary);

  &--alert {
    color: #d03838;
  }
}

.stat-detail {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.env-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  background: var(--td-bg-color-component);
  color: var(--td-text-color-secondary);
}

.stat-progress {
  margin-top: 8px;
}
</style>
