<template>
  <div class="resource-container">
    <t-card :bordered="false">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="breadcrumb">
          <t-breadcrumb>
            <t-breadcrumb-item @click="goToProjectList">项目列表</t-breadcrumb-item>
            <t-breadcrumb-item @click="goToProjectDetail">{{ projectName }}</t-breadcrumb-item>
            <t-breadcrumb-item>Secrets</t-breadcrumb-item>
          </t-breadcrumb>
        </div>
        <div class="context-info">
          <t-tag theme="primary">{{ clusterName }}</t-tag>
          <t-tag theme="success">{{ namespace }}</t-tag>
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
          placeholder="搜索 Secret 名称"
          clearable
          style="width: 300px"
        >
          <template #suffix-icon>
            <search-icon />
          </template>
        </t-input>
      </div>

      <!-- Secret 列表 -->
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
        <template #type="{ row }">
          <t-tag theme="default" variant="outline">{{ row.type }}</t-tag>
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
            content="确定删除该 Secret 吗？此操作不可恢复。"
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
      header="Secret 详情"
      width="800px"
      :footer="false"
    >
      <div class="detail-content">
        <t-descriptions bordered>
          <t-descriptions-item label="名称">{{ currentSecret?.metadata.name }}</t-descriptions-item>
          <t-descriptions-item label="命名空间">{{ currentSecret?.metadata.namespace }}</t-descriptions-item>
          <t-descriptions-item label="类型">{{ currentSecret?.type }}</t-descriptions-item>
          <t-descriptions-item label="创建时间">
            {{ formatTime(currentSecret?.metadata.creationTimestamp) }}
          </t-descriptions-item>
        </t-descriptions>
        <h4 style="margin-top: 20px; margin-bottom: 10px;">敏感数据</h4>
        <t-alert theme="warning" message="Secret 包含敏感信息，请谨慎查看和分享" style="margin-bottom: 16px;" />
        <div v-if="currentSecret?.data" class="data-section">
          <div v-for="(value, key) in currentSecret.data" :key="key" class="data-item">
            <div class="data-header">
              <span class="data-key">{{ key }}</span>
              <t-button
                v-if="!visibleKeys.has(key)"
                theme="default"
                size="small"
                variant="outline"
                @click="toggleVisibility(key)"
              >
                <template #icon><browse-icon /></template>
                显示
              </t-button>
              <t-button
                v-else
                theme="default"
                size="small"
                variant="outline"
                @click="toggleVisibility(key)"
              >
                <template #icon><browse-off-icon /></template>
                隐藏
              </t-button>
            </div>
            <pre v-if="visibleKeys.has(key)" class="data-value">{{ decodeBase64(value) }}</pre>
            <div v-else class="data-value-hidden">••••••••</div>
          </div>
        </div>
        <t-empty v-else description="暂无数据" />
      </div>
    </t-dialog>

    <!-- 编辑对话框 -->
    <t-dialog
      v-model:visible="editVisible"
      header="编辑 Secret"
      width="800px"
      :confirm-btn="{ content: '保存', loading: editLoading }"
      @confirm="onConfirmEdit"
    >
      <div class="edit-content">
        <t-alert theme="warning" message="请以 YAML 格式编辑 Secret，注意保护敏感信息" style="margin-bottom: 16px;" />
        <t-textarea
          v-model="editYaml"
          :autosize="{ minRows: 20, maxRows: 30 }"
          placeholder="请输入 YAML 格式的 Secret"
        />
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { RefreshIcon, SearchIcon, BrowseIcon, BrowseOffIcon } from 'tdesign-icons-vue-next';
import { getSecrets, deleteSecret, updateSecret, type Secret } from '@/api/k8s-resources';
import { getProject } from '@/api/project';
import { getClusterList } from '@/api/cluster';
import * as yaml from 'js-yaml';

const route = useRoute();
const router = useRouter();

const projectId = route.params.id as string;
const clusterId = route.query.clusterId as string;
const namespace = route.query.namespace as string;

const projectName = ref('');
const clusterName = ref('');
const data = ref<Secret[]>([]);
const loading = ref(false);
const searchKeyword = ref('');

const COLUMNS = [
  { title: '名称', colKey: 'name', width: 250 },
  { title: '类型', colKey: 'type', width: 200 },
  { title: '数据项数量', colKey: 'dataCount', width: 150 },
  { title: '创建时间', colKey: 'age', width: 150 },
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
const currentSecret = ref<Secret | null>(null);
const visibleKeys = ref<Set<string | number>>(new Set());

// 编辑对话框
const editVisible = ref(false);
const editLoading = ref(false);
const editYaml = ref('');
const editingSecret = ref<Secret | null>(null);

// 获取数据项数量
const getDataCount = (secret: Secret) => {
  return Object.keys(secret.data || {}).length;
};

// Base64 解码
const decodeBase64 = (encoded: string) => {
  try {
    return atob(encoded);
  } catch (e) {
    return encoded;
  }
};

// 切换可见性
const toggleVisibility = (key: string | number) => {
  if (visibleKeys.value.has(key)) {
    visibleKeys.value.delete(key);
  } else {
    visibleKeys.value.add(key);
  }
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
const handleViewDetail = (secret: Secret) => {
  currentSecret.value = secret;
  visibleKeys.value.clear();
  detailVisible.value = true;
};

// 编辑
const handleEdit = (secret: Secret) => {
  editingSecret.value = secret;
  editYaml.value = yaml.dump(secret, { indent: 2 });
  editVisible.value = true;
};

// 确认编辑
const onConfirmEdit = async () => {
  if (!editingSecret.value) return;
  
  editLoading.value = true;
  try {
    const updatedSecret = yaml.load(editYaml.value) as Secret;
    await updateSecret(
      clusterId,
      namespace,
      editingSecret.value.metadata.name,
      updatedSecret
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
const handleDelete = async (secret: Secret) => {
  try {
    await deleteSecret(clusterId, namespace, secret.metadata.name);
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
    const res = await getSecrets(clusterId, namespace);
    data.value = res.items || [];
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

// 初始化
onMounted(async () => {
  try {
    const project = await getProject(projectId);
    projectName.value = project.name;
    
    const clusters = await getClusterList();
    const cluster = clusters.find(c => c.id === clusterId);
    clusterName.value = cluster?.name || clusterId;
  } catch (e: any) {
    console.error('加载项目信息失败:', e);
  }
  
  await fetchData();
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

.detail-content {
  .data-section {
    .data-item {
      margin-bottom: var(--td-comp-margin-m);
      border: 1px solid var(--td-border-level-1-color);
      border-radius: var(--td-radius-default);
      overflow: hidden;

      .data-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: var(--td-bg-color-container);
        border-bottom: 1px solid var(--td-border-level-1-color);

        .data-key {
          font-weight: 500;
        }
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

      .data-value-hidden {
        padding: 12px;
        background: var(--td-bg-color-page);
        color: var(--td-text-color-placeholder);
        text-align: center;
        font-size: 20px;
        letter-spacing: 4px;
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
