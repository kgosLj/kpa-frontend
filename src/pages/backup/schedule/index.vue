<template>
  <div>
    <t-card class="list-card-container" :bordered="false">
      <!-- 操作区域 -->
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
        </t-space>
        <t-button @click="handleCreate">创建定时备份</t-button>
      </t-row>

      <!-- 定时备份列表表格 -->
      <t-table
        :data="data"
        :columns="COLUMNS"
        :row-key="rowKey"
        vertical-align="top"
        :hover="true"
        :loading="dataLoading"
      >
        <template #schedule="{ row }">
          <t-tag theme="primary" variant="outline">{{ row.schedule }}</t-tag>
        </template>
        <template #paused="{ row }">
          <t-tag v-if="row.paused" theme="warning" variant="light">已暂停</t-tag>
          <t-tag v-else theme="success" variant="light">运行中</t-tag>
        </template>
        <template #last_backup_time="{ row }">
          {{ formatTime(row.last_backup_time) }}
        </template>
        <template #next_schedule_time="{ row }">
          {{ formatTime(row.next_schedule_time) }}
        </template>
        <template #template="{ row }">
          <t-space direction="vertical" size="small">
            <div><strong>名称:</strong> {{ row.template.name }}</div>
            <div v-if="row.template.ttl"><strong>TTL:</strong> {{ row.template.ttl }}</div>
            <div v-if="row.template.included_resources && row.template.included_resources.length > 0">
              <strong>资源:</strong> {{ row.template.included_resources.join(', ') }}
            </div>
          </t-space>
        </template>
        <template #op="{ row }">
          <t-space>
            <t-popconfirm content="确认删除该定时备份吗？" @confirm="handleDelete(row)">
              <t-link theme="danger">删除</t-link>
            </t-popconfirm>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <!-- 创建定时备份对话框 -->
    <ScheduleDialog
      v-model:visible="scheduleDialogVisible"
      @confirm="onScheduleConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import type { PrimaryTableCol, TableRowData } from 'tdesign-vue-next';
import { ref, onMounted, computed, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { useRoute } from 'vue-router';
import { getScheduleList, createSchedule, deleteSchedule } from '@/api/backup';
import type { ScheduleResponse, CreateScheduleRequest } from '@/api/model/backupModel';
import { getClusterList, type Cluster } from '@/api/cluster';
import ScheduleDialog from './components/ScheduleDialog.vue';

const route = useRoute();

// 集群相关状态
const clusters = ref<Cluster[]>([]);
const clusterLoading = ref(false);
const selectedClusterId = ref<string>('');

// 从路由参数获取初始集群 ID
const initialClusterId = (route.params.clusterId as string) || (route.query.clusterId as string);

const COLUMNS: PrimaryTableCol<TableRowData>[] = [
  { title: '调度名称', colKey: 'name', width: 200, fixed: 'left' },
  { title: '命名空间', colKey: 'namespace', width: 150 },
  { title: 'Cron 表达式', colKey: 'schedule', width: 150 },
  { title: '状态', colKey: 'paused', width: 120 },
  { title: '上次备份时间', colKey: 'last_backup_time', width: 180 },
  { title: '下次调度时间', colKey: 'next_schedule_time', width: 180 },
  { title: '备份模板', colKey: 'template', width: 300 },
  { title: '操作', colKey: 'op', width: 120, fixed: 'right' },
];

const data = ref<ScheduleResponse[]>([]);
const dataLoading = ref(false);
const scheduleDialogVisible = ref(false);

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
    const res = await getScheduleList(selectedClusterId.value);
    data.value = res || [];
  } catch (e: any) {
    console.error(e);
    MessagePlugin.error(e.message || '获取定时备份列表失败');
  } finally {
    dataLoading.value = false;
  }
};

// 监听集群选择变化
watch(selectedClusterId, () => {
  fetchData();
});

onMounted(() => {
  loadClusters();
});

const handleClusterChange = () => {
  fetchData();
};

const handleCreate = () => {
  scheduleDialogVisible.value = true;
};

const handleDelete = async (row: ScheduleResponse) => {
  try {
    await deleteSchedule(selectedClusterId.value, row.name);
    MessagePlugin.success('删除成功');
    fetchData();
  } catch (e: any) {
    console.error(e);
    MessagePlugin.error(e.message || '删除失败');
  }
};

const onScheduleConfirm = async (formData: CreateScheduleRequest, createdClusterId: string) => {
  try {
    await createSchedule(createdClusterId, formData);
    MessagePlugin.success('创建成功');
    scheduleDialogVisible.value = false;
    // 如果创建的定时备份在当前选中的集群,刷新列表
    if (createdClusterId === selectedClusterId.value) {
      fetchData();
    } else {
      MessagePlugin.info(`定时备份已在其他集群中创建,请切换到对应集群查看`);
    }
  } catch (e: any) {
    MessagePlugin.error(e.message || '创建失败');
    console.error(e);
  }
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
