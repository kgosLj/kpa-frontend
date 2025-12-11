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
            v-model="filterParams.namespace"
            placeholder="筛选命名空间"
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
        <t-button @click="handleCreate">创建备份</t-button>
      </t-row>

      <!-- 备份列表表格 -->
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
        <template #start_timestamp="{ row }">
          {{ formatTime(row.start_timestamp) }}
        </template>
        <template #completion_timestamp="{ row }">
          {{ formatTime(row.completion_timestamp) }}
        </template>
        <template #errors_warnings="{ row }">
          <t-space>
            <t-tag v-if="row.errors > 0" theme="danger" variant="light">错误: {{ row.errors }}</t-tag>
            <t-tag v-if="row.warnings > 0" theme="warning" variant="light">警告: {{ row.warnings }}</t-tag>
            <span v-if="row.errors === 0 && row.warnings === 0">-</span>
          </t-space>
        </template>
        <template #op="{ row }">
          <t-space>
            <t-link theme="primary" @click="handleRestore(row)">恢复</t-link>
            <t-popconfirm content="确认删除该备份吗？" @confirm="handleDelete(row)">
              <t-link theme="danger">删除</t-link>
            </t-popconfirm>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <!-- 创建备份对话框 -->
    <BackupDialog
      v-model:visible="backupDialogVisible"
      @confirm="onBackupConfirm"
    />

    <!-- 恢复备份对话框 -->
    <RestoreDialog
      v-model:visible="restoreDialogVisible"
      :backup-name="currentBackupName"
      :source-cluster-id="selectedClusterId"
      :source-cluster-name="selectedClusterName"
      @confirm="onRestoreConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import type { PrimaryTableCol, TableRowData, PaginationProps } from 'tdesign-vue-next';
import { ref, onMounted, computed, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { useRoute } from 'vue-router';
import { getBackupList, createBackup, deleteBackup, restoreBackup } from '@/api/backup';
import type { BackupResponse, CreateBackupRequest, RestoreRequest } from '@/api/model/backupModel';
import { getClusterList, type Cluster } from '@/api/cluster';
import BackupDialog from './components/BackupDialog.vue';
import RestoreDialog from './components/RestoreDialog.vue';

const route = useRoute();

// 集群相关状态
const clusters = ref<Cluster[]>([]);
const clusterLoading = ref(false);
const selectedClusterId = ref<string>('');

// 从路由参数获取初始集群 ID
const initialClusterId = (route.params.clusterId as string) || (route.query.clusterId as string);

const COLUMNS: PrimaryTableCol<TableRowData>[] = [
  { title: '备份名称', colKey: 'name', width: 200, fixed: 'left' },
  { title: '命名空间', colKey: 'namespace', width: 150 },
  { title: '状态', colKey: 'status', width: 120 },
  { title: 'Velero 阶段', colKey: 'phase', width: 150 },
  { title: '开始时间', colKey: 'start_timestamp', width: 180 },
  { title: '完成时间', colKey: 'completion_timestamp', width: 180 },
  { title: '错误/警告', colKey: 'errors_warnings', width: 150 },
  { title: '操作', colKey: 'op', width: 150, fixed: 'right' },
];

const data = ref<BackupResponse[]>([]);
const dataLoading = ref(false);
const backupDialogVisible = ref(false);
const restoreDialogVisible = ref(false);
const currentBackupName = ref('');

const filterParams = ref({
  namespace: '',
  status: '',
});

const pagination = ref<PaginationProps>({
  current: 1,
  pageSize: 10,
  total: 0,
});

// 当前选中的集群名称
const selectedClusterName = computed(() => {
  const cluster = clusters.value.find(c => c.id === selectedClusterId.value);
  return cluster?.name || '';
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
      namespace: filterParams.value.namespace || undefined,
      status: filterParams.value.status || undefined,
    };
    const res = await getBackupList(selectedClusterId.value, params);
    data.value = res.items || [];
    pagination.value.total = res.total || 0;
  } catch (e: any) {
    console.error(e);
    MessagePlugin.error(e.message || '获取备份列表失败');
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

const handleCreate = () => {
  backupDialogVisible.value = true;
};

const handleRestore = (row: BackupResponse) => {
  currentBackupName.value = row.name;
  restoreDialogVisible.value = true;
};

const handleDelete = async (row: BackupResponse) => {
  try {
    await deleteBackup(selectedClusterId.value, row.name);
    MessagePlugin.success('删除成功');
    fetchData();
  } catch (e: any) {
    console.error(e);
    MessagePlugin.error(e.message || '删除失败');
  }
};

const onBackupConfirm = async (formData: CreateBackupRequest, createdClusterId: string) => {
  try {
    await createBackup(createdClusterId, formData);
    MessagePlugin.success('创建成功');
    backupDialogVisible.value = false;
    // 如果创建的备份在当前选中的集群,刷新列表
    if (createdClusterId === selectedClusterId.value) {
      fetchData();
    } else {
      MessagePlugin.info(`备份已在其他集群中创建,请切换到对应集群查看`);
    }
  } catch (e: any) {
    MessagePlugin.error(e.message || '创建失败');
    console.error(e);
  }
};

const onRestoreConfirm = async (formData: RestoreRequest) => {
  try {
    await restoreBackup(selectedClusterId.value, currentBackupName.value, formData);
    MessagePlugin.success('恢复任务已创建');
    restoreDialogVisible.value = false;
  } catch (e: any) {
    MessagePlugin.error(e.message || '恢复失败');
    console.error(e);
  }
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
