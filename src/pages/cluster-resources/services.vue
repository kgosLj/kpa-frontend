<template>
  <div class="resource-container">
    <t-card :bordered="false">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="breadcrumb">
          <t-breadcrumb>
            <t-breadcrumb-item @click="goToProjectList">项目列表</t-breadcrumb-item>
            <t-breadcrumb-item @click="goToProjectDetail">{{ projectName }}</t-breadcrumb-item>
            <t-breadcrumb-item>Services</t-breadcrumb-item>
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
          placeholder="搜索 Service 名称"
          clearable
          style="width: 300px"
        >
          <template #suffix-icon>
            <search-icon />
          </template>
        </t-input>
      </div>

      <!-- Service 列表 -->
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
          <t-tag theme="default">{{ row.spec?.type || 'ClusterIP' }}</t-tag>
        </template>
        <template #clusterIP="{ row }">
          {{ row.spec?.clusterIP || '-' }}
        </template>
        <template #ports="{ row }">
          <div class="port-list">
            <t-tag
              v-for="(port, idx) in getPorts(row)"
              :key="idx"
              theme="default"
              variant="outline"
              size="small"
            >
              {{ port }}
            </t-tag>
          </div>
        </template>
        <template #age="{ row }">
          {{ formatAge(row.metadata.creationTimestamp) }}
        </template>
        <template #op="{ row }">
          <t-link theme="primary" @click="handleViewDetail(row)">详情</t-link>
          <t-divider layout="vertical" />
          <t-popconfirm
            content="确定删除该 Service 吗？此操作不可恢复。"
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
      header="Service 详情"
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
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { RefreshIcon, SearchIcon } from 'tdesign-icons-vue-next';
import { getServices, deleteService, type Service } from '@/api/k8s-resources';
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
const data = ref<Service[]>([]);
const loading = ref(false);
const searchKeyword = ref('');

const COLUMNS = [
  { title: '名称', colKey: 'name', width: 200 },
  { title: '类型', colKey: 'type', width: 120 },
  { title: 'Cluster IP', colKey: 'clusterIP', width: 150 },
  { title: '端口', colKey: 'ports', ellipsis: true },
  { title: '创建时间', colKey: 'age', width: 150 },
  { title: '操作', colKey: 'op', width: 150, fixed: 'right' as const },
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
  detailYaml.value = yaml.dump(service, { indent: 2 });
  detailVisible.value = true;
};

// 删除
const handleDelete = async (service: Service) => {
  try {
    await deleteService(clusterId, namespace, service.metadata.name);
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
    const res = await getServices(clusterId, namespace);
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

.port-list {
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
