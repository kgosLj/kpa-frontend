<template>
  <t-card title="节点资源使用情况" :bordered="false">
    <t-table
      :data="nodeData"
      :columns="columns"
      :loading="loading"
      row-key="name"
      stripe
      size="medium"
    >
      <template #cpu_percentage="{ row }">
        <t-progress
          :percentage="row.cpu_percentage"
          :theme="getProgressTheme(row.cpu_percentage) as any"
          :label="false"
        />
        <span style="margin-left: 8px">{{ row.cpu_percentage.toFixed(1) }}%</span>
      </template>
      
      <template #memory_percentage="{ row }">
        <t-progress
          :percentage="row.memory_percentage"
          :theme="getProgressTheme(row.memory_percentage) as any"
          :label="false"
        />
        <span style="margin-left: 8px">{{ row.memory_percentage.toFixed(1) }}%</span>
      </template>
      
      <template #status="{ row }">
        <t-tag :theme="row.status === 'Ready' ? 'success' : 'danger'" variant="light">
          {{ row.status }}
        </t-tag>
      </template>
    </t-table>
  </t-card>
</template>

<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import type { PrimaryTableCol } from 'tdesign-vue-next';
import { ref, watch } from 'vue';
import { getNodeMetrics, type NodeMetricsItem } from '@/api/dashboard';

const props = defineProps<{
  clusterId: string;
}>();

const loading = ref(false);
const nodeData = ref<NodeMetricsItem[]>([]);

// 表格列定义
const columns: PrimaryTableCol[] = [
  {
    colKey: 'name',
    title: '节点名称',
    width: 200,
    ellipsis: true,
  },
  {
    colKey: 'status',
    title: '状态',
    width: 100,
    align: 'center',
  },
  {
    colKey: 'ip',
    title: 'IP 地址',
    width: 150,
  },
  {
    colKey: 'cpu_usage',
    title: 'CPU 使用',
    width: 150,
    cell: (_h, { row }: any) => `${row.cpu_usage} / ${row.cpu_capacity}`,
  },
  {
    colKey: 'cpu_percentage',
    title: 'CPU 使用率',
    width: 200,
  },
  {
    colKey: 'memory_usage',
    title: '内存使用',
    width: 180,
    cell: (_h, { row }: any) => `${row.memory_usage} / ${row.memory_capacity}`,
  },
  {
    colKey: 'memory_percentage',
    title: '内存使用率',
    width: 200,
  },
];

// 根据使用率获取进度条主题
const getProgressTheme = (percentage: number) => {
  if (percentage >= 90) return 'danger';
  if (percentage >= 75) return 'warning';
  return 'success';
};

// 获取节点监控数据
const fetchNodeMetrics = async () => {
  if (!props.clusterId) return;
  
  loading.value = true;
  try {
    const res = await getNodeMetrics(props.clusterId);
    nodeData.value = res.items || [];
  } catch (error) {
    MessagePlugin.error('获取节点监控数据失败');
    console.error('Failed to fetch node metrics:', error);
  } finally {
    loading.value = false;
  }
};

// 监听集群变化
watch(
  () => props.clusterId,
  () => {
    fetchNodeMetrics();
  },
  { immediate: true }
);

defineExpose({
  refresh: fetchNodeMetrics,
});
</script>

<style lang="less" scoped>
:deep(.t-card__header) {
  padding: var(--td-comp-paddingTB-l) var(--td-comp-paddingLR-xl);
}

:deep(.t-card__body) {
  padding: 0;
}
</style>
