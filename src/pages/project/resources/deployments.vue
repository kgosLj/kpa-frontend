<template>
  <div class="resource-container">
    <t-card :bordered="false">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="breadcrumb">
          <t-breadcrumb>
            <t-breadcrumb-item @click="goToProjectList">项目列表</t-breadcrumb-item>
            <t-breadcrumb-item @click="goToProjectDetail">{{ projectName }}</t-breadcrumb-item>
            <t-breadcrumb-item>Deployments</t-breadcrumb-item>
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
          placeholder="搜索 Deployment 名称"
          clearable
          style="width: 300px"
        >
          <template #suffix-icon>
            <search-icon />
          </template>
        </t-input>
      </div>

      <!-- Deployment 列表 -->
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
        <template #replicas="{ row }">
          <span>{{ row.status?.readyReplicas || 0 }} / {{ row.spec?.replicas || 0 }}</span>
        </template>
        <template #images="{ row }">
          <div class="image-list">
            <t-tag
              v-for="(image, idx) in getImages(row)"
              :key="idx"
              theme="default"
              variant="outline"
              size="small"
            >
              {{ image }}
            </t-tag>
          </div>
        </template>
        <template #status="{ row }">
          <t-tag :theme="getStatusTheme(row)">{{ getStatus(row) }}</t-tag>
        </template>
        <template #age="{ row }">
          {{ formatAge(row.metadata.creationTimestamp) }}
        </template>
        <template #op="{ row }">
          <t-link theme="primary" @click="handleViewDetail(row)">详情</t-link>
          <t-divider layout="vertical" />
          <t-link theme="primary" @click="handleScale(row)">扩缩容</t-link>
          <t-divider layout="vertical" />
          <t-popconfirm
            content="确定删除该 Deployment 吗？此操作不可恢复。"
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
      header="Deployment 详情"
      width="800px"
      :footer="false"
    >
      <div class="detail-content">
        <pre class="yaml-content">{{ detailYaml }}</pre>
      </div>
    </t-dialog>

    <!-- 扩缩容对话框 -->
    <t-dialog
      v-model:visible="scaleVisible"
      header="扩缩容"
      :confirm-btn="{ content: '确定', loading: scaleLoading }"
      @confirm="onConfirmScale"
    >
      <t-form :data="scaleForm" label-align="right" :label-width="100">
        <t-form-item label="当前副本数">
          <span>{{ scaleForm.currentReplicas }}</span>
        </t-form-item>
        <t-form-item label="目标副本数" name="replicas">
          <t-input-number
            v-model="scaleForm.replicas"
            :min="0"
            :max="100"
            placeholder="请输入目标副本数"
          />
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { RefreshIcon, SearchIcon } from 'tdesign-icons-vue-next';
import {
  getDeployments,
  deleteDeployment,
  scaleDeployment,
  type Deployment,
} from '@/api/k8s-resources';
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
const data = ref<Deployment[]>([]);
const loading = ref(false);
const searchKeyword = ref('');

const COLUMNS = [
  { title: '名称', colKey: 'name', width: 250 },
  { title: '副本数', colKey: 'replicas', width: 120 },
  { title: '镜像', colKey: 'images', ellipsis: true },
  { title: '状态', colKey: 'status', width: 120 },
  { title: '创建时间', colKey: 'age', width: 150 },
  { title: '操作', colKey: 'op', width: 200, fixed: 'right' as const },
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

// 扩缩容对话框
const scaleVisible = ref(false);
const scaleLoading = ref(false);
const scaleForm = ref({
  name: '',
  currentReplicas: 0,
  replicas: 0,
});

// 获取镜像列表
const getImages = (deployment: Deployment) => {
  const containers = deployment.spec?.template?.spec?.containers || [];
  return containers.map(c => c.image);
};

// 获取状态
const getStatus = (deployment: Deployment) => {
  const replicas = deployment.spec?.replicas || 0;
  const readyReplicas = deployment.status?.readyReplicas || 0;
  
  if (readyReplicas === replicas) return '运行中';
  if (readyReplicas === 0) return '未就绪';
  return '部分就绪';
};

// 获取状态主题
const getStatusTheme = (deployment: Deployment) => {
  const replicas = deployment.spec?.replicas || 0;
  const readyReplicas = deployment.status?.readyReplicas || 0;
  
  if (readyReplicas === replicas) return 'success';
  if (readyReplicas === 0) return 'danger';
  return 'warning';
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
const handleViewDetail = (deployment: Deployment) => {
  detailYaml.value = yaml.dump(deployment, { indent: 2 });
  detailVisible.value = true;
};

// 扩缩容
const handleScale = (deployment: Deployment) => {
  scaleForm.value = {
    name: deployment.metadata.name,
    currentReplicas: deployment.spec?.replicas || 0,
    replicas: deployment.spec?.replicas || 0,
  };
  scaleVisible.value = true;
};

// 确认扩缩容
const onConfirmScale = async () => {
  scaleLoading.value = true;
  try {
    await scaleDeployment(
      clusterId,
      namespace,
      scaleForm.value.name,
      scaleForm.value.replicas
    );
    MessagePlugin.success('扩缩容成功');
    scaleVisible.value = false;
    await fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '扩缩容失败');
  } finally {
    scaleLoading.value = false;
  }
};

// 删除
const handleDelete = async (deployment: Deployment) => {
  try {
    await deleteDeployment(clusterId, namespace, deployment.metadata.name);
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
    const res = await getDeployments(clusterId, namespace);
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
  // 加载项目和集群信息
  try {
    const project = await getProject(projectId);
    projectName.value = project.name;
    
    const clusters = await getClusterList();
    const cluster = clusters.find(c => c.id === clusterId);
    clusterName.value = cluster?.name || clusterId;
  } catch (e: any) {
    console.error('加载项目信息失败:', e);
  }
  
  // 加载 Deployment 列表
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

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
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
</style>
