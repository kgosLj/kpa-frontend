```
<template>
  <div class="resource-container">
    <!-- 操作栏 -->
    <div class="toolbar">
      <t-button theme="primary" @click="fetchData">
        <template #icon><refresh-icon /></template>
        刷新
      </t-button>
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
        <span class="resource-name">{{ row.metadata.name }}</span>
      </template>
      <template #dataCount="{ row }">
        {{ getDataCount(row) }}
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
        <h4 style="margin-bottom: 10px;">配置数据</h4>
        <div v-if="currentConfigMap?.data" class="data-section">
          <div v-for="(value, key) in currentConfigMap.data" :key="key" class="data-item">
            <div class="data-key">{{ key }}</div>
            <pre class="data-value">{{ value }}</pre>
          </div>
        </div>
        <t-empty v-else description="暂无配置数据" />
      </div>
    </t-dialog>

    <!-- 编辑对话框 -->
    <t-dialog
      v-model:visible="editVisible"
      header="编辑 ConfigMap"
      width="900px"
      :confirm-btn="{ content: '保存', loading: editLoading }"
      @confirm="onConfirmEdit"
    >
      <div class="edit-content">
        <t-alert theme="info" message="请以 YAML 格式编辑 ConfigMap" style="margin-bottom: 16px;" />
        <t-textarea
          v-model="editYaml"
          :autosize="{ minRows: 20, maxRows: 30 }"
          placeholder="请输入 YAML 格式的 ConfigMap"
          class="yaml-editor"
        />
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { RefreshIcon, SearchIcon } from 'tdesign-icons-vue-next';
import { getConfigMaps, deleteConfigMap, updateConfigMap, type ConfigMap } from '@/api/k8s-resources';
import { useClusterResourceStore } from '@/store/modules/cluster-resource';
import * as yaml from 'js-yaml';

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

// 详情对话框
const detailVisible = ref(false);
const currentConfigMap = ref<ConfigMap | null>(null);

// 编辑对话框
const editVisible = ref(false);
const editLoading = ref(false);
const editYaml = ref('');
const editingConfigMap = ref<ConfigMap | null>(null);

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

const formatTime = (timestamp?: string) => {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString('zh-CN');
};

// 查看详情
const handleViewDetail = (configMap: ConfigMap) => {
  currentConfigMap.value = configMap;
  detailVisible.value = true;
};

// 编辑
const handleEdit = (configMap: ConfigMap) => {
  editingConfigMap.value = configMap;
  
  // 清理 YAML，只保留必要字段
  const cleaned: any = {
    apiVersion: configMap.apiVersion || 'v1',
    kind: configMap.kind || 'ConfigMap',
    metadata: {
      name: configMap.metadata.name,
      namespace: configMap.metadata.namespace,
      labels: configMap.metadata.labels,
      annotations: configMap.metadata.annotations,
    },
    data: configMap.data,
    binaryData: configMap.binaryData,
  };
  
  editYaml.value = yaml.dump(cleaned, { indent: 2, noRefs: true, sortKeys: false });
  editVisible.value = true;
};

// 确认编辑
const onConfirmEdit = async () => {
  if (!editingConfigMap.value || !clusterId.value || !namespace.value) return;
  
  editLoading.value = true;
  try {
    const updatedConfigMap = yaml.load(editYaml.value) as ConfigMap;
    await updateConfigMap(
      clusterId.value,
      namespace.value,
      editingConfigMap.value.metadata.name,
      updatedConfigMap
    );
    MessagePlugin.success('更新成功');
    editVisible.value = false;
    await fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '更新失败');
  } finally {
    editLoading.value = false;
  }
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

.detail-content {
  .data-section {
    .data-item {
      margin-bottom: var(--td-comp-margin-m);
      border: 1px solid var(--td-border-level-1-color);
      border-radius: var(--td-radius-default);
      overflow: hidden;

      .data-key {
        padding: 8px 12px;
        background: var(--td-bg-color-container);
        font-weight: 500;
        border-bottom: 1px solid var(--td-border-level-1-color);
      }

      .data-value {
        margin: 0;
        padding: 12px;
        background: var(--td-bg-color-page);
        font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 12px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-all;
      }
    }
  }
}

.edit-content {
  :deep(.t-textarea__inner) {
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 12px;
  }
}
</style>
