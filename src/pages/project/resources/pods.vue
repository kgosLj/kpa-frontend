<template>
  <div class="resource-container">
    <t-card :bordered="false">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="breadcrumb">
          <t-breadcrumb>
            <t-breadcrumb-item @click="goToProjectList">项目列表</t-breadcrumb-item>
            <t-breadcrumb-item @click="goToProjectDetail">{{ projectName }}</t-breadcrumb-item>
            <t-breadcrumb-item @click="goToDeployments">Deployments</t-breadcrumb-item>
            <t-breadcrumb-item>Pods</t-breadcrumb-item>
          </t-breadcrumb>
        </div>
        <div class="context-info">
          <t-tag theme="primary">{{ clusterName }}</t-tag>
          <t-tag theme="success">{{ namespace }}</t-tag>
          <t-tag theme="warning" v-if="deploymentName">{{ deploymentName }}</t-tag>
        </div>
      </div>

      <t-divider />

      <!-- 操作栏 -->
      <div class="toolbar">
        <t-button theme="primary" @click="fetchData">
          <template #icon><refresh-icon /></template>
          刷新
        </t-button>
        <t-input
          v-model="searchKeyword"
          placeholder="搜索 Pod 名称"
          clearable
          style="width: 300px"
        >
          <template #suffix-icon>
            <search-icon />
          </template>
        </t-input>
      </div>

      <!-- Pod 列表 -->
      <t-table
        :data="filteredData"
        :columns="COLUMNS"
        :loading="loading"
        row-key="metadata.name"
        :hover="true"
      >
        <template #name="{ row }">
          <span class="resource-name">{{ row.metadata.name }}</span>
        </template>
        <template #status="{ row }">
          <t-tag :theme="getStatusTheme(row)">{{ getStatus(row) }}</t-tag>
        </template>
        <template #restarts="{ row }">
          {{ getRestartCount(row) }}
        </template>
        <template #cpu="{ row }">
          <div class="metrics-cell">
            <span class="metrics-value">{{ getCPUUsage(row) }}</span>
            <mini-chart :data="getCPUHistory(row)" color="#0052d9" />
          </div>
        </template>
        <template #memory="{ row }">
          <div class="metrics-cell">
            <span class="metrics-value">{{ getMemoryUsage(row) }}</span>
            <mini-chart :data="getMemoryHistory(row)" color="#029cd4" />
          </div>
        </template>
        <template #age="{ row }">
          {{ formatAge(row.status?.startTime) }}
        </template>
        <template #op="{ row }">
          <t-link theme="primary" @click="handleViewDetail(row)">详情</t-link>
          <t-divider layout="vertical" />
          <t-popconfirm
            content="确定删除该 Pod 吗？此操作不可恢复。"
            @confirm="handleDelete(row)"
          >
            <t-link theme="danger">删除</t-link>
          </t-popconfirm>
        </template>
      </t-table>
    </t-card>

    <!-- 详情对话框 -->
    <t-dialog
      v-model:visible="detailVisible"
      header="Pod 详情"
      width="800px"
      :footer="false"
    >
      <div class="detail-content">
        <pre class="yaml-content">{{ detailYaml }}</pre>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { RefreshIcon, SearchIcon } from 'tdesign-icons-vue-next';
import {
  getPods,
  deletePod,
  getPodMetrics,
  type Pod,
  type PodMetricsItem,
} from '@/api/k8s-resources';
import { getProject } from '@/api/project';
import { getClusterList } from '@/api/cluster';
import * as yaml from 'js-yaml';
import MiniChart from './components/MiniChart.vue';

const route = useRoute();
const router = useRouter();

const projectId = route.params.id as string;
const clusterId = route.query.clusterId as string;
const namespace = route.query.namespace as string;
const deploymentName = route.query.deployment as string;
const labelSelector = route.query.labelSelector as string;

const projectName = ref('');
const clusterName = ref('');
const data = ref<Pod[]>([]);
const metricsData = ref<PodMetricsItem[]>([]);
const loading = ref(false);
const searchKeyword = ref('');
const refreshTimer = ref<number | null>(null);

const COLUMNS = [
  { title: '名称', colKey: 'name', width: 250 },
  { title: '状态', colKey: 'status', width: 100 },
  { title: '重启次数', colKey: 'restarts', width: 100 },
  { title: 'CPU', colKey: 'cpu', width: 180 },
  { title: 'Memory', colKey: 'memory', width: 180 },
  { title: '创建时间', colKey: 'age', width: 120 },
  { title: '操作', colKey: 'op', width: 150, fixed: 'right' as const },
];

// 过滤数据
const filteredData = computed(() => {
  if (!searchKeyword.value) return data.value;
  return data.value.filter(item =>
    item.metadata.name.toLowerCase().includes(searchKeyword.value.toLowerCase())
  );
});

// 详情对话框
const detailVisible = ref(false);
const detailYaml = ref('');

// 获取状态
const getStatus = (pod: Pod) => {
  return pod.status?.phase || 'Unknown';
};

// 获取状态主题
const getStatusTheme = (pod: Pod) => {
  const phase = pod.status?.phase;
  switch (phase) {
    case 'Running':
      return 'success';
    case 'Pending':
      return 'warning';
    case 'Succeeded':
      return 'success';
    case 'Failed':
      return 'danger';
    default:
      return 'default';
  }
};

// 获取重启次数
const getRestartCount = (pod: Pod) => {
  const statuses = pod.status?.containerStatuses || [];
  return statuses.reduce((sum, s) => sum + (s.restartCount || 0), 0);
};

// 获取 CPU 使用量
const getCPUUsage = (pod: Pod) => {
  const metrics = metricsData.value.find(m => m.name === pod.metadata.name);
  if (!metrics) return '-';
  return metrics.total_cpu_usage;
};

// 获取 Memory 使用量
const getMemoryUsage = (pod: Pod) => {
  const metrics = metricsData.value.find(m => m.name === pod.metadata.name);
  if (!metrics) return '-';
  return metrics.total_memory_usage;
};

// 获取 CPU 历史数据（模拟）
const getCPUHistory = (pod: Pod) => {
  const metrics = metricsData.value.find(m => m.name === pod.metadata.name);
  if (!metrics) return [];
  
  // 解析 CPU 使用量（例如 "150m" -> 150）
  const currentValue = parseCPU(metrics.total_cpu_usage);
  
  // 生成模拟的历史数据（10个点）
  return generateMockHistory(currentValue, 10);
};

// 获取 Memory 历史数据（模拟）
const getMemoryHistory = (pod: Pod) => {
  const metrics = metricsData.value.find(m => m.name === pod.metadata.name);
  if (!metrics) return [];
  
  // 解析 Memory 使用量（例如 "256Mi" -> 256）
  const currentValue = parseMemory(metrics.total_memory_usage);
  
  // 生成模拟的历史数据（10个点）
  return generateMockHistory(currentValue, 10);
};

// 解析 CPU 值（milli cores）
const parseCPU = (cpu: string): number => {
  if (!cpu) return 0;
  if (cpu.endsWith('m')) {
    return parseInt(cpu.slice(0, -1), 10);
  }
  return parseFloat(cpu) * 1000;
};

// 解析 Memory 值（转换为 Mi）
const parseMemory = (memory: string): number => {
  if (!memory) return 0;
  if (memory.endsWith('Ki')) {
    return parseInt(memory.slice(0, -2), 10) / 1024;
  }
  if (memory.endsWith('Mi')) {
    return parseInt(memory.slice(0, -2), 10);
  }
  if (memory.endsWith('Gi')) {
    return parseInt(memory.slice(0, -2), 10) * 1024;
  }
  // 假设是字节
  return parseInt(memory, 10) / (1024 * 1024);
};

// 生成模拟历史数据
const generateMockHistory = (currentValue: number, points: number): number[] => {
  const history: number[] = [];
  const variance = currentValue * 0.2; // 20% 波动
  
  for (let i = 0; i < points; i++) {
    const randomOffset = (Math.random() - 0.5) * variance;
    const value = Math.max(0, currentValue + randomOffset);
    history.push(value);
  }
  
  // 最后一个点是当前值
  history[points - 1] = currentValue;
  
  return history;
};

// 格式化时间
const formatAge = (timestamp?: string) => {
  if (!timestamp) return '-';
  const now = new Date().getTime();
  const created = new Date(timestamp).getTime();
  const diff = now - created;
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}天`;
  if (hours > 0) return `${hours}小时`;
  return `${minutes}分钟`;
};

// 查看详情
const handleViewDetail = (pod: Pod) => {
  detailYaml.value = yaml.dump(pod, { indent: 2 });
  detailVisible.value = true;
};

// 删除
const handleDelete = async (pod: Pod) => {
  try {
    await deletePod(clusterId, namespace, pod.metadata.name);
    MessagePlugin.success('删除成功');
    await fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '删除失败');
  }
};

// 加载数据
const fetchData = async () => {
  loading.value = true;
  try {
    // 加载 Pod 列表
    const podsRes = await getPods(clusterId, namespace, labelSelector);
    data.value = podsRes.items || [];
    
    // 加载监控数据
    try {
      const metricsRes = await getPodMetrics(clusterId, namespace);
      metricsData.value = metricsRes.items || [];
    } catch (e) {
      console.warn('加载监控数据失败:', e);
      metricsData.value = [];
    }
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载数据失败');
  } finally {
    loading.value = false;
  }
};

// 导航
const goToProjectList = () => {
  router.push({ name: 'ProjectList' });
};

const goToProjectDetail = () => {
  router.push({ name: 'ProjectDetail', params: { id: projectId } });
};

const goToDeployments = () => {
  router.push({
    name: 'ProjectResourceDeployments',
    params: { id: projectId },
    query: { clusterId, namespace },
  });
};

// 初始化
onMounted(async () => {
  // 加载项目和集群信息
  try {
    const project = await getProject(projectId);
    projectName.value = project.name;
    
    const clusters = await getClusterList();
    const cluster = clusters.find(c => c.id === clusterId);
    clusterName.value = cluster?.name || clusterId;
  } catch (e: any) {
    console.error('加载项目信息失败:', e);
  }
  
  // 加载 Pod 列表
  await fetchData();
  
  // 设置定时刷新（每30秒）
  refreshTimer.value = window.setInterval(() => {
    fetchData();
  }, 30000);
});

// 清理定时器
onUnmounted(() => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value);
  }
});
</script>

<style lang="less" scoped>
.resource-container {
  padding: var(--td-comp-paddingTB-xxl) var(--td-comp-paddingLR-xxl);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--td-comp-margin-l);

  .breadcrumb {
    flex: 1;
  }

  .context-info {
    display: flex;
    gap: var(--td-comp-margin-s);
  }
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--td-comp-margin-l);
}

.resource-name {
  font-weight: 500;
}

.metrics-cell {
  display: flex;
  align-items: center;
  gap: 8px;

  .metrics-value {
    min-width: 60px;
    font-size: 12px;
    color: var(--td-text-color-secondary);
  }
}

.detail-content {
  max-height: 600px;
  overflow-y: auto;

  .yaml-content {
    background: var(--td-bg-color-container);
    padding: var(--td-comp-paddingTB-m) var(--td-comp-paddingLR-m);
    border-radius: var(--td-radius-default);
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
