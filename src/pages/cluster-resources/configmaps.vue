<template>
  <div class="resource-container">
    <!-- 操作栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <t-button theme="primary" @click="fetchData">
          <template #icon><refresh-icon /></template>
          刷新
        </t-button>
        <t-button theme="success" @click="handleCreate">
          <template #icon><add-icon /></template>
          部署 ConfigMap
        </t-button>
      </div>
      <t-input
        v-model="searchKeyword"
        placeholder="搜索 ConfigMap 名称"
        clearable
        style="width: 300px"
      >
        <template #prefix-icon>
          <search-icon />
        </template>
      </t-input>
    </div>

    <!-- ConfigMap 列表 -->
    <t-table
      :data="filteredData"
      :columns="COLUMNS"
      :loading="loading"
      row-key="metadata.name"
      stripe
      hover
    >
      <template #name="{ row }">
        <t-link theme="primary" @click="handleViewDetail(row)">
          {{ row.metadata.name }}
        </t-link>
      </template>
      <template #dataCount="{ row }">
        {{ getDataCount(row) }}
      </template>
      <template #age="{ row }">
        {{ formatAge(row.metadata.creationTimestamp) }}
      </template>
      <template #op="{ row }">
        <t-link theme="primary" @click="handleEdit(row)">编辑</t-link>
        <t-divider layout="vertical" />
        <t-link theme="warning" @click="handleRollback(row)">回滚</t-link>
        <t-divider layout="vertical" />
        <t-popconfirm
          content="确定删除该 ConfigMap 吗？此操作不可恢复。"
          @confirm="handleDelete(row)"
        >
          <t-link theme="danger">删除</t-link>
        </t-popconfirm>
      </template>
    </t-table>

    <!-- 详情对话框 -->
    <t-dialog
      v-model:visible="detailVisible"
      header="ConfigMap 详情"
      width="900px"
      :footer="false"
    >
      <div class="detail-content">
        <pre class="yaml-content">{{ detailYaml }}</pre>
      </div>
    </t-dialog>

    <!-- 创建/编辑对话框 -->
    <t-dialog
      v-model:visible="formVisible"
      :header="formMode === 'create' ? '部署 ConfigMap' : '编辑 ConfigMap'"
      width="800px"
      :footer="false"
    >
      <config-map-form
        ref="formRef"
        :mode="formMode"
        :initial-data="editingConfigMap"
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

    <!-- 回滚对话框 -->
    <rollback-dialog
      v-model:visible="rollbackDialogVisible"
      :versions="rollbackVersions"
      :loading="rollbackLoading"
      :cluster-id="clusterId"
      :namespace="namespace"
      :name="currentRollbackResource?.name || ''"
      kind="ConfigMap"
      @confirm="handleConfirmRollback"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { RefreshIcon, SearchIcon, AddIcon } from 'tdesign-icons-vue-next';
import { getConfigMaps, deleteConfigMap, type ConfigMap, type ResourceDiffResponse } from '@/api/k8s-resources';
import { getHistoryVersions, rollbackToVersion, type HistoryVersion } from '@/api/rollback';
import { useClusterResourceStore } from '@/store/modules/cluster-resource';
import * as yaml from 'js-yaml';
import ConfigMapForm from './components/ConfigMapForm.vue';
import ResourceDiffDialog from './components/ResourceDiffDialog.vue';
import RollbackDialog from './components/RollbackDialog.vue';

const store = useClusterResourceStore();

// 从 store 获取集群和命名空间信息
const clusterId = computed(() => store.clusterId);
const namespace = computed(() => store.namespace);

const data = ref<ConfigMap[]>([]);
const loading = ref(false);
const searchKeyword = ref('');

const COLUMNS = [
  { title: '名称', colKey: 'name', minWidth: 200 },
  { title: '数据项数量', colKey: 'dataCount', width: 150 },
  { title: '创建时间', colKey: 'age' },
  { title: '操作', colKey: 'op', width: 220, fixed: 'right' as const },
];

// 过滤数据
const filteredData = computed(() => {
  if (!searchKeyword.value) return data.value;
  return data.value.filter(item =>
    item.metadata.name.toLowerCase().includes(searchKeyword.value.toLowerCase())
  );
});

// 详情对话框（变量声明已移至 handleViewDetail 附近）

// 创建/编辑对话框
const formVisible = ref(false);
const formMode = ref<'create' | 'edit'>('create');
const formRef = ref();
const editingConfigMap = ref<ConfigMap | null>(null);

// Diff 对话框
const diffDialogVisible = ref(false);
const diffLoading = ref(false);
const diffData = ref<ResourceDiffResponse | null>(null);

// 回滚对话框状态
const rollbackDialogVisible = ref(false);
const rollbackVersions = ref<HistoryVersion[]>([]);
const rollbackLoading = ref(false);
const currentRollbackResource = ref<{ name: string; kind: string } | null>(null);

// 创建
const handleCreate = () => {
  formMode.value = 'create';
  editingConfigMap.value = null;
  formVisible.value = true;
};

// 编辑
const handleEdit = (configMap: ConfigMap) => {
  formMode.value = 'edit';
  editingConfigMap.value = configMap;
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

// 获取数据项数量
const getDataCount = (configMap: ConfigMap) => {
  const dataCount = Object.keys(configMap.data || {}).length;
  const binaryDataCount = Object.keys(configMap.binaryData || {}).length;
  return dataCount + binaryDataCount;
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
// 查看详情
const detailVisible = ref(false);
const detailYaml = ref('');
const currentConfigMap = ref<ConfigMap | null>(null);

const handleViewDetail = (configMap: ConfigMap) => {
  // 深拷贝并清理字段
  const cleanConfigMap = JSON.parse(JSON.stringify(configMap));

  // 1. 移除系统字段
  if (cleanConfigMap.metadata) {
    delete cleanConfigMap.metadata.managedFields;
    delete cleanConfigMap.metadata.uid;
    delete cleanConfigMap.metadata.resourceVersion;
    delete cleanConfigMap.metadata.creationTimestamp;
    delete cleanConfigMap.metadata.generation;
    delete cleanConfigMap.metadata.selfLink;
    delete cleanConfigMap.metadata.ownerReferences;
  }
  
  // 3. 重新构建对象
  const orderedConfigMap = {
    apiVersion: cleanConfigMap.apiVersion || 'v1',
    kind: cleanConfigMap.kind || 'ConfigMap',
    metadata: cleanConfigMap.metadata,
    data: cleanConfigMap.data,
    binaryData: cleanConfigMap.binaryData,
  };

  detailYaml.value = yaml.dump(orderedConfigMap, { 
    indent: 2, 
    noRefs: true,
    sortKeys: false 
  });
  detailVisible.value = true;
};

// 删除
const handleDelete = async (configMap: ConfigMap) => {
  if (!clusterId.value || !namespace.value) return;
  try {
    await deleteConfigMap(clusterId.value, namespace.value, configMap.metadata.name);
    MessagePlugin.success('删除成功');
    await fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '删除失败');
  }
};

// 回滚
const handleRollback = async (configMap: ConfigMap) => {
  currentRollbackResource.value = {
    name: configMap.metadata.name,
    kind: 'ConfigMap',
  };
  rollbackDialogVisible.value = true;
  rollbackLoading.value = true;
  rollbackVersions.value = [];
  
  try {
    const versions = await getHistoryVersions(clusterId.value, {
      namespace: namespace.value,
      name: configMap.metadata.name,
      kind: 'ConfigMap',
    });
    rollbackVersions.value = versions;
  } catch (e: any) {
    MessagePlugin.error(e.message || '获取历史版本失败');
  } finally {
    rollbackLoading.value = false;
  }
};

// 确认回滚
const handleConfirmRollback = async (version: number) => {
  if (!currentRollbackResource.value) return;
  
  rollbackLoading.value = true;
  try {
    await rollbackToVersion(clusterId.value, {
      namespace: namespace.value,
      name: currentRollbackResource.value.name,
      kind: 'ConfigMap',
      version: version,
    });
    
    MessagePlugin.success(`成功回滚到版本 ${version}`);
    rollbackDialogVisible.value = false;
    await fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '回滚失败');
  } finally {
    rollbackLoading.value = false;
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
    const res = await getConfigMaps(clusterId.value, namespace.value);
    data.value = res.items || [];
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载 ConfigMap 列表失败');
    data.value = [];
  } finally {
    loading.value = false;
  }
};

// 监听 store 变化
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

.resource-name {
  font-weight: 500;
}

.detail-content {
  .yaml-content {
    background: var(--td-bg-color-secondarycontainer);
    padding: 16px;
    border-radius: var(--td-radius-default);
    font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--td-text-color-primary);
  }
}
</style>
