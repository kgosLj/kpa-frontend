<template>
  <div class="pods-view">
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
        <span class="resource-usage">{{ getCPUUsage(row) }}</span>
      </template>
      <template #memory="{ row }">
        <span class="resource-usage">{{ getMemoryUsage(row) }}</span>
      </template>
      <template #age="{ row }">
        {{ formatAge(row.status?.startTime) }}
      </template>
      <template #op="{ row }">
        <t-link theme="primary" @click="handleViewDetail(row)">详情</t-link>
        <t-divider layout="vertical" />
        <t-link theme="warning" @click="handleTerminal(row)">终端</t-link>
        <t-divider layout="vertical" />
        <t-popconfirm
          content="确定删除该 Pod 吗？此操作不可恢复。"
          @confirm="handleDelete(row)"
        >
          <t-link theme="danger">删除</t-link>
        </t-popconfirm>
      </template>
    </t-table>

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

    <!-- 终端对话框 -->
    <t-dialog
      v-model:visible="terminalVisible"
      header="Pod 终端"
      width="90%"
      top="5vh"
      :footer="false"
      destroy-on-close
    >
      <div v-if="terminalVisible && currentTerminalPod" class="terminal-wrapper">
        <pod-terminal
          :cluster-id="clusterId"
          :namespace="namespace"
          :pod-name="currentTerminalPod.metadata.name"
          :container="currentTerminalContainer"
        />
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { RefreshIcon, SearchIcon } from 'tdesign-icons-vue-next';
import {
  getPods,
  deletePod,
  getPodMetrics,
  type Pod,
  type PodMetricsItem,
} from '@/api/k8s-resources';
import { useClusterResourceStore } from '@/store/modules/cluster-resource';
import PodTerminal from '@/components/Terminal/PodTerminal.vue';
import * as yaml from 'js-yaml';

const route = useRoute();
const store = useClusterResourceStore();

// 从 store 或路由获取上下文
const clusterId = computed(() => store.clusterId);
const namespace = computed(() => store.namespace);
const labelSelector = computed(() => route.query.labelSelector as string || '');

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

// 终端对话框
const terminalVisible = ref(false);
const currentTerminalPod = ref<Pod | null>(null);
const currentTerminalContainer = ref('');

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

// 获取 CPU 使用量 (当前用量/limit)
const getCPUUsage = (pod: Pod) => {
  const metrics = metricsData.value.find(m => m.name === pod.metadata.name);
  const containers = pod.spec?.containers || [];
  
  if (!metrics || containers.length === 0) return '-';
  
  // 获取当前使用量
  const currentUsage = metrics.total_cpu_usage || '0m';
  
  // 获取所有容器的 CPU limit 总和
  let totalLimit = 0;
  containers.forEach(container => {
    const limit = container.resources?.limits?.cpu;
    if (limit) {
      totalLimit += parseCPUToMillicores(limit);
    }
  });
  
  const limitStr = totalLimit > 0 ? formatCPU(totalLimit) : '-';
  return `${currentUsage} / ${limitStr}`;
};

// 获取 Memory 使用量 (当前用量/limit)
const getMemoryUsage = (pod: Pod) => {
  const metrics = metricsData.value.find(m => m.name === pod.metadata.name);
  const containers = pod.spec?.containers || [];
  
  if (!metrics || containers.length === 0) return '-';
  
  // 获取当前使用量
  const currentUsage = metrics.total_memory_usage || '0Mi';
  
  // 获取所有容器的 Memory limit 总和
  let totalLimit = 0;
  containers.forEach(container => {
    const limit = container.resources?.limits?.memory;
    if (limit) {
      totalLimit += parseMemoryToMi(limit);
    }
  });
  
  const limitStr = totalLimit > 0 ? formatMemory(totalLimit) : '-';
  return `${currentUsage} / ${limitStr}`;
};

// 解析 CPU 值到 millicores
const parseCPUToMillicores = (cpu: string): number => {
  if (!cpu) return 0;
  if (cpu.endsWith('n')) {
     return Math.round(parseInt(cpu.slice(0, -1), 10) / 1000000);
  }
  if (cpu.endsWith('u')) {
     return Math.round(parseInt(cpu.slice(0, -1), 10) / 1000);
  }
  if (cpu.endsWith('m')) {
    return parseInt(cpu.slice(0, -1), 10);
  }
  // 如果是核心数（如 "1" 或 "0.5"）
  return parseFloat(cpu) * 1000;
};

// 解析 Memory 值到 Mi
const parseMemoryToMi = (memory: string): number => {
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

// 格式化 CPU（millicores 转为可读格式）
const formatCPU = (millicores: number): string => {
  if (millicores >= 1000) {
    // 显示为核心数，保留2位小数，如 1.50
    return `${(millicores / 1000).toFixed(2)}`;
  }
  return `${millicores}m`;
};

// 格式化 Memory（Mi 转为可读格式）
const formatMemory = (mi: number): string => {
  if (mi >= 1024) {
    return `${(mi / 1024).toFixed(2)}Gi`;
  }
  return `${Math.round(mi)}Mi`;
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
  detailYaml.value = yaml.dump(pod, { indent: 2, noRefs: true });
  detailVisible.value = true;
};

// 打开终端
const handleTerminal = (pod: Pod) => {
  currentTerminalPod.value = pod;
  // 默认使用第一个容器
  currentTerminalContainer.value = pod.spec?.containers[0]?.name || '';
  terminalVisible.value = true;
};

// 删除
const handleDelete = async (pod: Pod) => {
  try {
    await deletePod(clusterId.value, namespace.value, pod.metadata.name);
    MessagePlugin.success('删除成功');
    await fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '删除失败');
  }
};

// 加载数据
const fetchData = async () => {
  if (!clusterId.value || !namespace.value) {
    return;
  }
  
  loading.value = true;
  try {
    const podsRes = await getPods(clusterId.value, namespace.value, labelSelector.value);
    data.value = podsRes.items || [];
    
    // 加载监控数据
    try {
      const metricsRes = await getPodMetrics(clusterId.value, namespace.value);
      metricsData.value = metricsRes.items || [];
    } catch (e) {
      console.warn('加载监控数据失败:', e);
      metricsData.value = [];
    }
  } catch (e: any) {
    console.error('Failed to load pods:', e);
    MessagePlugin.error(e.message || '加载数据失败');
  } finally {
    loading.value = false;
  }
};

// 监听命名空间变化，自动刷新数据
watch(() => store.selectedNamespace, () => {
  fetchData();
}, { immediate: true });

// 初始化
onMounted(async () => {
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
.pods-view {
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
}
</style>


