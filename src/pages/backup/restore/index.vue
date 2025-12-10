<template>
  <div>
    <t-card class="list-card-container" :bordered="false">
      <!-- 筛选和操作区域 -->
      <t-row justify="space-between" style="margin-bottom: 16px">
        <t-space>
          <t-select
            v-model="selectedClusterId"
            placeholder="选择集群"
            style="width: 200px"
            :loading="clusterLoading"
            @change="handleClusterChange"
          >
            <t-option
              v-for="cluster in clusters"
              :key="cluster.id"
              :value="cluster.id"
              :label="cluster.name"
            />
          </t-select>
          <t-input
            v-model="filterParams.backup_name"
            placeholder="筛选备份名称"
            clearable
            style="width: 200px"
            @change="handleFilterChange"
          />
          <t-select
            v-model="filterParams.status"
            placeholder="筛选状态"
            clearable
            style="width: 150px"
            @change="handleFilterChange"
          >
            <t-option value="New" label="新建" />
            <t-option value="InProgress" label="进行中" />
            <t-option value="Completed" label="已完成" />
            <t-option value="Failed" label="失败" />
          </t-select>
        </t-space>
      </t-row>

      <!-- 恢复任务列表表格 -->
      <t-table
        :data="data"
        :columns="COLUMNS"
        :row-key="rowKey"
        vertical-align="top"
        :hover="true"
        :loading="dataLoading"
        :pagination="pagination"
        @page-change="onPageChange"
      >
        <template #status="{ row }">
          <t-tag v-if="row.status === 'Completed'" theme="success" variant="light">已完成</t-tag>
          <t-tag v-else-if="row.status === 'InProgress'" theme="warning" variant="light">进行中</t-tag>
          <t-tag v-else-if="row.status === 'Failed'" theme="danger" variant="light">失败</t-tag>
          <t-tag v-else theme="default" variant="light">{{ row.status }}</t-tag>
        </template>
        <template #phase="{ row }">
          <t-tag theme="primary" variant="outline">{{ row.phase || '-' }}</t-tag>
        </template>
        <template #errors_warnings="{ row }">
          <t-space>
            <t-tag v-if="row.errors > 0" theme="danger" variant="light">错误: {{ row.errors }}</t-tag>
            <t-tag v-if="row.warnings > 0" theme="warning" variant="light">警告: {{ row.warnings }}</t-tag>
            <span v-if="row.errors === 0 && row.warnings === 0">-</span>
          </t-space>
        </template>
        <template #created_at="{ row }">
          {{ formatTime(row.created_at) }}
        </template>
        <template #completed_at="{ row }">
          {{ formatTime(row.completed_at) }}
        </template>
      </t-table>
    </t-card>
  </div>
</template>

<script setup lang="ts">
import type { PrimaryTableCol, TableRowData, PaginationProps } from 'tdesign-vue-next';
import { ref, onMounted, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { useRoute } from 'vue-router';
import { getRestoreList } from '@/api/backup';
import type { RestoreResponse } from '@/api/model/backupModel';
import { getClusterList, type Cluster } from '@/api/cluster';

const route = useRoute();

// 集群相关状态
const clusters = ref<Cluster[]>([]);
const clusterLoading = ref(false);
const selectedClusterId = ref<string>('');

// 从路由参数获取初始集群 ID 和备份名称
const initialClusterId = (route.params.clusterId as string) || (route.query.clusterId as string);
const initialBackupName = route.query.backupName as string;

const COLUMNS: PrimaryTableCol<TableRowData>[] = [
  { title: '恢复ID', colKey: 'id', width: 280, ellipsis: true },
  { title: '源备份', colKey: 'backup_name', width: 200 },
  { title: '目标命名空间', colKey: 'target_namespace', width: 150 },
  { title: '状态', colKey: 'status', width: 120 },
  { title: 'Velero 阶段', colKey: 'phase', width: 150 },
  { title: '错误/警告', colKey: 'errors_warnings', width: 150 },
  { title: '创建时间', colKey: 'created_at', width: 180 },
  { title: '完成时间', colKey: 'completed_at', width: 180 },
];

const data = ref<RestoreResponse[]>([]);
const dataLoading = ref(false);

const filterParams = ref({
  backup_name: initialBackupName || '',
  status: '',
});

const pagination = ref<PaginationProps>({
  current: 1,
  pageSize: 10,
  total: 0,
});

// 加载集群列表
const loadClusters = async () => {
  clusterLoading.value = true;
  try {
    const res = await getClusterList();
    clusters.value = res || [];
    
    // 设置初始选中的集群
    if (initialClusterId && clusters.value.some(c => c.id === initialClusterId)) {
      selectedClusterId.value = initialClusterId;
    } else if (clusters.value.length > 0) {
      selectedClusterId.value = clusters.value[0].id;
    }
  } catch (e: any) {
    console.error(e);
    MessagePlugin.error('加载集群列表失败');
  } finally {
    clusterLoading.value = false;
  }
};

const fetchData = async () => {
  if (!selectedClusterId.value) return;
  
  dataLoading.value = true;
  try {
    const params = {
      page: pagination.value.current,
      page_size: pagination.value.pageSize,
      backup_name: filterParams.value.backup_name || undefined,
      status: filterParams.value.status || undefined,
    };
    const res = await getRestoreList(selectedClusterId.value, params);
    data.value = res.items || [];
    pagination.value.total = res.total || 0;
  } catch (e: any) {
    console.error(e);
    MessagePlugin.error(e.message || '获取恢复任务列表失败');
  } finally {
    dataLoading.value = false;
  }
};

// 监听集群选择变化
watch(selectedClusterId, () => {
  pagination.value.current = 1;
  fetchData();
});

onMounted(() => {
  loadClusters();
});

const handleClusterChange = () => {
  fetchData();
};

const handleFilterChange = () => {
  pagination.value.current = 1;
  fetchData();
};

const onPageChange = (pageInfo: PaginationProps) => {
  pagination.value.current = pageInfo.current || 1;
  pagination.value.pageSize = pageInfo.pageSize || 10;
  fetchData();
};

const formatTime = (time?: string) => {
  if (!time) return '-';
  return new Date(time).toLocaleString('zh-CN');
};

const rowKey = 'id';
</script>

<style lang="less" scoped>
.list-card-container {
  padding: var(--td-comp-paddingTB-xxl) var(--td-comp-paddingLR-xxl);
}
</style>
