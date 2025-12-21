<template>
  <div class="resource-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <t-button theme="primary" @click="fetchData">
          <template #icon><refresh-icon /></template>
          刷新
        </t-button>
        <t-button theme="success" @click="handleCreate">
          <template #icon><add-icon /></template>
          部署 Service
        </t-button>
      </div>
      
      <t-input
        v-model="searchKeyword"
        placeholder="搜索 Service 名称"
        clearable
        style="width: 300px"
      >
        <template #prefix-icon><search-icon /></template>
      </t-input>
    </div>

    <!-- Service 列表 -->
    <t-table
      :data="filteredData"
      :columns="COLUMNS"
      :loading="loading"
      row-key="metadata.uid"
      stripe
      hover
    >
      <template #name="{ row }">
        <t-link theme="primary" @click="handleViewDetail(row)">
          {{ row.metadata.name }}
        </t-link>
      </template>
      
      <template #type="{ row }">
        <t-tag :theme="row.spec.type === 'LoadBalancer' ? 'warning' : row.spec.type === 'NodePort' ? 'success' : 'default'">
          {{ row.spec.type }}
        </t-tag>
      </template>
      
      <template #clusterIP="{ row }">
        {{ row.spec.clusterIP || '-' }}
      </template>
      
      <template #ports="{ row }">
        {{ getPorts(row) }}
      </template>
      
      <template #age="{ row }">
        {{ formatAge(row.metadata.creationTimestamp) }}
      </template>
      
      <template #op="{ row }">
        <t-link theme="primary" @click="handleViewDetail(row)">详情</t-link>
        <t-divider layout="vertical" />
        <t-link theme="primary" @click="handleEdit(row)">编辑</t-link>
        <t-divider layout="vertical" />
        <t-popconfirm
          content="确定删除该 Service 吗？此操作不可恢复。"
          @confirm="handleDelete(row)"
        >
          <t-link theme="danger">删除</t-link>
        </t-popconfirm>
      </template>
    </t-table>

    <!-- 详情对话框 -->
    <t-dialog
      v-model:visible="detailVisible"
      header="Service 详情"
      width="900px"
    >
      <pre class="yaml-content">{{ detailYaml }}</pre>
    </t-dialog>

    <!-- 创建/编辑对话框 -->
    <t-dialog
      v-model:visible="formVisible"
      :header="formMode === 'create' ? '部署 Service' : '编辑 Service'"
      width="800px"
      :footer="false"
    >
      <service-form
        ref="formRef"
        :mode="formMode"
        :initial-data="editingService"
        @success="handleFormSuccess"
        @cancel="formVisible = false"
        @preview-diff="handleFormPreviewDiff"
      />
    </t-dialog>

    <!-- Diff 对话框 -->
    <resource-diff-dialog
      v-model:visible="diffDialogVisible"
      :diff-data="diffData"
      :loading="diffLoading"
      :confirm-text="formMode === 'create' ? '确认部署' : '确认更新'"
      @confirm="onConfirmDeployAfterDiff"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { RefreshIcon, SearchIcon, AddIcon } from 'tdesign-icons-vue-next';
import { getServices, deleteService, type Service, type ResourceDiffResponse } from '@/api/k8s-resources';
import { useClusterResourceStore } from '@/store/modules/cluster-resource';
import * as yaml from 'js-yaml';
import ServiceForm from './components/ServiceForm.vue';
import ResourceDiffDialog from './components/ResourceDiffDialog.vue';

const store = useClusterResourceStore();

// 从 store 获取集群和命名空间信息
const clusterId = computed(() => store.clusterId);
const namespace = computed(() => store.namespace);

const data = ref<Service[]>([]);
const loading = ref(false);
const searchKeyword = ref('');

const COLUMNS = [
  { title: '名称', colKey: 'name', width: 200 },
  { title: '类型', colKey: 'type', width: 120 },
  { title: 'Cluster IP', colKey: 'clusterIP', width: 150 },
  { title: '端口', colKey: 'ports', ellipsis: true },
  { title: '创建时间', colKey: 'age', width: 150 },
  { title: '操作', colKey: 'op', width: 180, fixed: 'right' as const },
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

// 创建/编辑对话框
const formVisible = ref(false);
const formMode = ref<'create' | 'edit'>('create');
const formRef = ref();
const editingService = ref<Service | null>(null);

// Diff 对话框
const diffDialogVisible = ref(false);
const diffLoading = ref(false);
const diffData = ref<ResourceDiffResponse | null>(null);

// 创建
const handleCreate = () => {
  formMode.value = 'create';
  editingService.value = null;
  formVisible.value = true;
};

// 编辑
const handleEdit = (service: Service) => {
  formMode.value = 'edit';
  editingService.value = service;
  formVisible.value = true;
};

// 操作成功
const handleFormSuccess = async () => {
  formVisible.value = false;
  diffDialogVisible.value = false;
  await fetchData();
};

// 表单预览变更（不关闭表单）
const handleFormPreviewDiff = (data: ResourceDiffResponse) => {
  diffData.value = data;
  diffDialogVisible.value = true;
};

// 确认部署（在 diff 对话框中）
const onConfirmDeployAfterDiff = async () => {
  diffDialogVisible.value = false;
  if (formRef.value) {
    formRef.value.confirmDiffAndSubmit?.();
  }
};

// 获取端口列表
const getPorts = (service: Service) => {
  const ports = service.spec?.ports || [];
  return ports.map(p => {
    const protocol = p.protocol || 'TCP';
    if (p.nodePort) {
      return `${p.port}:${p.nodePort}/${protocol}`;
    }
    return `${p.port}/${protocol}`;
  });
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
const handleViewDetail = (service: Service) => {
  detailYaml.value = yaml.dump(service, { indent: 2, noRefs: true });
  detailVisible.value = true;
};

// 删除
const handleDelete = async (service: Service) => {
  try {
    await deleteService(clusterId.value, namespace.value, service.metadata.name);
    MessagePlugin.success('删除成功');
    await fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '删除失败');
  }
};

// 加载数据
const fetchData = async () => {
  if (!clusterId.value || !namespace.value) {
    data.value = [];
    return;
  }
  
  loading.value = true;
  try {
    const response = await getServices(clusterId.value, namespace.value);
    data.value = response.items || [];
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载 Service 列表失败');
    data.value = [];
  } finally {
    loading.value = false;
  }
};

watch(
  () => [clusterId.value, namespace.value],
  () => {
    fetchData();
  },
  { immediate: true },
);
</script>

<style lang="less" scoped>
.resource-container {
  padding: var(--td-comp-paddingTB-xxl) var(--td-comp-paddingLR-xxl);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--td-comp-margin-l);
}

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
</style>
