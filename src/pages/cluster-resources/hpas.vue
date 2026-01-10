<template>
  <div class="resource-container">
    <div class="toolbar">
      <div class="toolbar-left">
        <t-button theme="primary" @click="loadData" :loading="loading">
          <template #icon><refresh-icon /></template>
          刷新
        </t-button>
        <t-button theme="success" @click="handleCreate">
          <template #icon><add-icon /></template>
          创建 HPA
        </t-button>
      </div>
      
      <t-input
        v-model="searchQuery"
        placeholder="搜索 HPA 名称"
        style="width: 300px"
        clearable
      >
        <template #suffixIcon><search-icon /></template>
      </t-input>
    </div>

    <t-table
      :data="filteredHPAs"
      :columns="columns"
      :loading="loading"
      row-key="metadata.uid"
      size="small"
      hover
    >
      <template #name="{ row }">
        <t-link theme="primary" @click="handleDetail(row)">{{ row.metadata.name }}</t-link>
      </template>

      <template #target="{ row }">
        <t-tag theme="primary" variant="light">
          {{ row.spec.scaleTargetRef.kind }}: {{ row.spec.scaleTargetRef.name }}
        </t-tag>
      </template>

      <template #replicas="{ row }">
        <span>{{ row.status?.currentReplicas || 0 }} / {{ row.status?.desiredReplicas || 0 }}</span>
        <span class="replica-range">({{ row.spec.minReplicas || 1 }} - {{ row.spec.maxReplicas }})</span>
      </template>

      <template #metrics="{ row }">
        <div v-for="(metric, index) in row.spec.metrics" :key="index" class="metric-item">
          <template v-if="metric.type === 'Resource'">
            <t-tag size="small" variant="outline">
              {{ metric.resource.name }}: {{ getMetricUtilization(row, metric.resource.name) }}% / {{ metric.resource.target.averageUtilization }}%
            </t-tag>
          </template>
        </div>
      </template>

      <template #creationTimestamp="{ row }">
        {{ formatTime(row.metadata.creationTimestamp) }}
      </template>

      <template #operation="{ row }">
        <t-space>
          <t-link theme="primary" @click="handleEdit(row)">表单编辑</t-link>
          <t-popconfirm content="确认删除该 HPA 吗？" @confirm="handleDelete(row)">
            <t-link theme="danger">删除</t-link>
          </t-popconfirm>
        </t-space>
      </template>
    </t-table>

    <!-- HPA 表单弹窗 -->
    <t-dialog
      v-model:visible="formVisible"
      :header="formMode === 'create' ? '新建 HPA' : '编辑 HPA'"
      width="800px"
      :footer="false"
      destroy-on-close
    >
      <hpa-form
        :mode="formMode"
        :initial-data="editingHPA"
        @cancel="formVisible = false"
        @preview-diff="handlePreviewDiff"
      />
    </t-dialog>

    <!-- Diff 预览弹窗 -->
    <resource-diff-dialog
      v-model:visible="diffVisible"
      :diff-data="diffData"
      :loading="submitting"
      @confirm="handleConfirmDeploy"
    />
    
    <!-- 详情弹窗 -->
    <t-dialog
      v-model:visible="detailVisible"
      header="HPA 详情"
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
import { ref, computed, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { RefreshIcon, AddIcon, SearchIcon } from 'tdesign-icons-vue-next';
import { getHPAs, deleteHPA, createHPA, updateHPA, type HPA, type ResourceDiffResponse } from '@/api/k8s-resources';
import { useClusterResourceStore } from '@/store/modules/cluster-resource';
import HpaForm from './components/HpaForm.vue';
import ResourceDiffDialog from './components/ResourceDiffDialog.vue';
import * as yaml from 'js-yaml';



const store = useClusterResourceStore();
const clusterId = computed(() => store.clusterId);
const namespace = computed(() => store.namespace);

const loading = ref(false);
const hpas = ref<HPA[]>([]);
const searchQuery = ref('');

// 表单状态
const formVisible = ref(false);
const formMode = ref<'create' | 'edit'>('create');
const editingHPA = ref<HPA | null>(null);

// 详情状态
const detailVisible = ref(false);
const detailYaml = ref('');

// Diff 状态
const diffVisible = ref(false);
const diffData = ref<ResourceDiffResponse | null>(null);
const submitting = ref(false);

const columns = [
  { colKey: 'name', title: '名称', minWidth: 200 },
  { colKey: 'target', title: '绑定资源', minWidth: 200 },
  { colKey: 'replicas', title: '副本状态', width: 150 },
  { colKey: 'metrics', title: '指标 (当前/目标)', minWidth: 250 },
  { colKey: 'creationTimestamp', title: '创建时间', width: 120 },
  { colKey: 'operation', title: '操作', width: 160, fixed: 'right' as const },
];

const filteredHPAs = computed(() => {
  if (!searchQuery.value) return hpas.value;
  const query = searchQuery.value.toLowerCase();
  return hpas.value.filter(hpa => hpa.metadata.name.toLowerCase().includes(query));
});

async function loadData() {
  if (!clusterId.value || !namespace.value) return;
  loading.value = true;
  try {
    const res = await getHPAs(clusterId.value, namespace.value);
    hpas.value = res.items || [];
  } catch (e: any) {
    MessagePlugin.error(`加载 HPA 失败: ${e.message}`);
  } finally {
    loading.value = false;
  }
}

function getMetricUtilization(hpa: HPA, resourceName: string): number {
  if (!hpa.status?.currentMetrics) return 0;
  const metric = hpa.status.currentMetrics.find(m => m.type === 'Resource' && m.resource?.name === resourceName);
  return metric?.resource?.current?.averageUtilization || 0;
}

function handleCreate() {
  formMode.value = 'create';
  editingHPA.value = null;
  formVisible.value = true;
}

function handleEdit(row: HPA) {
  formMode.value = 'edit';
  editingHPA.value = row;
  formVisible.value = true;
}

function handleDetail(row: HPA) {
  // 深拷贝并清理字段
  const cleanHPA = JSON.parse(JSON.stringify(row));

  // 1. 移除系统字段
  if (cleanHPA.metadata) {
    delete cleanHPA.metadata.managedFields;
    delete cleanHPA.metadata.uid;
    delete cleanHPA.metadata.resourceVersion;
    delete cleanHPA.metadata.creationTimestamp;
    delete cleanHPA.metadata.generation;
    delete cleanHPA.metadata.selfLink;
    delete cleanHPA.metadata.ownerReferences;
  }
  
  // 3. 重新构建对象
  const orderedHPA = {
    apiVersion: cleanHPA.apiVersion || 'autoscaling/v2',
    kind: cleanHPA.kind || 'HorizontalPodAutoscaler',
    metadata: cleanHPA.metadata,
    spec: cleanHPA.spec,
  };

  detailYaml.value = yaml.dump(orderedHPA, { 
    indent: 2, 
    noRefs: true,
    sortKeys: false 
  });
  detailVisible.value = true;
}

async function handleDelete(row: HPA) {
  if (!clusterId.value || !namespace.value) return;
  try {
    await deleteHPA(clusterId.value, namespace.value, row.metadata.name);
    MessagePlugin.success('删除成功');
    loadData();
  } catch (e: any) {
    MessagePlugin.error(`删除失败: ${e.message}`);
  }
}

function handlePreviewDiff(data: ResourceDiffResponse) {
  diffData.value = data;
  diffVisible.value = true;
}

async function handleConfirmDeploy() {
  if (!clusterId.value || !namespace.value || !diffData.value) return;
  
  submitting.value = true;
  try {
    const newObj = yaml.load(diffData.value.new_yaml) as HPA;
    if (diffData.value.exists) {
      await updateHPA(clusterId.value, namespace.value, newObj.metadata.name, newObj);
      MessagePlugin.success('更新成功');
    } else {
      await createHPA(clusterId.value, namespace.value, newObj);
      MessagePlugin.success('部署成功');
    }
    diffVisible.value = false;
    formVisible.value = false;
    loadData();
  } catch (e: any) {
    MessagePlugin.error(`部署失败: ${e.message}`);
  } finally {
    submitting.value = false;
  }
}

function formatTime(timestamp?: string) {
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
}

onMounted(() => {
  loadData();
});
</script>

<style lang="less" scoped>
.resource-container {
  padding: var(--td-comp-paddingTB-xxl) var(--td-comp-paddingLR-xxl);

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--td-comp-margin-l);

    .toolbar-left {
      display: flex;
      gap: var(--td-comp-margin-m);
    }
  }

  .replica-range {
    font-size: 12px;
    color: var(--td-text-color-placeholder);
    margin-left: 4px;
  }

  .metric-item {
    margin-bottom: 4px;
    &:last-child {
      margin-bottom: 0;
    }
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
}
</style>
