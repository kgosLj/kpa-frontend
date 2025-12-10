<template>
  <div class="project-detail-container">
    <t-card :bordered="false">
      <!-- 项目基本信息 -->
      <div class="project-header">
        <div class="project-info">
          <h2>{{ project?.name }}</h2>
          <p class="description">{{ project?.description || '暂无描述' }}</p>
          <div class="meta-info">
            <t-tag theme="primary">{{ project?.status === 1 ? '启用' : '禁用' }}</t-tag>
            <span class="meta-item">创建时间: {{ formatTime(project?.create_time) }}</span>
          </div>
        </div>
        <div class="actions">
          <t-button theme="default" @click="goBack">返回</t-button>
        </div>
      </div>

      <t-divider />

      <!-- 命名空间列表 -->
      <div class="namespace-section">
        <h3>项目命名空间</h3>
        <t-table
          :data="namespaces"
          :columns="NAMESPACE_COLUMNS"
          :loading="loading"
          row-key="id"
          :hover="true"
        >
          <template #cluster_name="{ row }">
            {{ getClusterName(row.cluster_id) }}
          </template>
          <template #environment="{ row }">
            <t-tag v-if="row.environment === 'prod'" theme="success">生产</t-tag>
            <t-tag v-else-if="row.environment === 'staging'" theme="warning">预发布</t-tag>
            <t-tag v-else-if="row.environment === 'dev'" theme="primary">开发</t-tag>
            <t-tag v-else>{{ row.environment }}</t-tag>
          </template>
          <template #resources="{ row }">
            <t-dropdown :options="getResourceOptions(row)">
              <t-button theme="primary" variant="outline" size="small">
                管理资源
                <template #suffix>
                  <chevron-down-icon />
                </template>
              </t-button>
            </t-dropdown>
          </template>
        </t-table>
      </div>
    </t-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { ChevronDownIcon } from 'tdesign-icons-vue-next';
import { getProject, getProjectNamespaces, type Project, type ProjectNamespace } from '@/api/project';
import { getClusterList, type Cluster } from '@/api/cluster';
import type { DropdownOption } from 'tdesign-vue-next';

const route = useRoute();
const router = useRouter();

const projectId = route.params.id as string;
const project = ref<Project | null>(null);
const namespaces = ref<ProjectNamespace[]>([]);
const clusters = ref<Cluster[]>([]);
const loading = ref(false);

const NAMESPACE_COLUMNS = [
  { title: '集群', colKey: 'cluster_name', width: 200 },
  { title: '命名空间', colKey: 'namespace', width: 200 },
  { title: '环境', colKey: 'environment', width: 120 },
  { title: '绑定时间', colKey: 'create_time', width: 180 },
  { title: '操作', colKey: 'resources', width: 150, fixed: 'right' as const },
];

// 获取集群名称
const getClusterName = (clusterId: string) => {
  const cluster = clusters.value.find(c => c.id === clusterId);
  return cluster?.name || clusterId;
};

// 格式化时间
const formatTime = (time?: string) => {
  if (!time) return '-';
  return new Date(time).toLocaleString('zh-CN');
};

// 获取资源管理选项
const getResourceOptions = (namespace: ProjectNamespace): DropdownOption[] => {
  return [
    {
      content: 'Deployments',
      value: 'deployments',
      onClick: () => navigateToResource(namespace, 'deployments'),
    },
    {
      content: 'Services',
      value: 'services',
      onClick: () => navigateToResource(namespace, 'services'),
    },
    {
      content: 'ConfigMaps',
      value: 'configmaps',
      onClick: () => navigateToResource(namespace, 'configmaps'),
    },
    {
      content: 'Secrets',
      value: 'secrets',
      onClick: () => navigateToResource(namespace, 'secrets'),
    },
  ];
};

// 导航到资源管理页面
const navigateToResource = (namespace: ProjectNamespace, resourceType: string) => {
  router.push({
    name: `ProjectResource${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}`,
    params: {
      id: projectId,
    },
    query: {
      clusterId: namespace.cluster_id,
      namespace: namespace.namespace,
    },
  });
};

// 返回项目列表
const goBack = () => {
  router.push({ name: 'ProjectList' });
};

// 加载项目信息
const fetchProject = async () => {
  try {
    project.value = await getProject(projectId);
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载项目信息失败');
  }
};

// 加载命名空间列表
const fetchNamespaces = async () => {
  loading.value = true;
  try {
    namespaces.value = await getProjectNamespaces(projectId);
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载命名空间列表失败');
  } finally {
    loading.value = false;
  }
};

// 加载集群列表
const fetchClusters = async () => {
  try {
    clusters.value = await getClusterList();
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载集群列表失败');
  }
};

onMounted(async () => {
  await Promise.all([
    fetchProject(),
    fetchNamespaces(),
    fetchClusters(),
  ]);
});
</script>

<style lang="less" scoped>
.project-detail-container {
  padding: var(--td-comp-paddingTB-xxl) var(--td-comp-paddingLR-xxl);
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--td-comp-margin-xl);

  .project-info {
    flex: 1;

    h2 {
      margin: 0 0 var(--td-comp-margin-s) 0;
      font-size: 24px;
      font-weight: 600;
    }

    .description {
      margin: 0 0 var(--td-comp-margin-m) 0;
      color: var(--td-text-color-secondary);
    }

    .meta-info {
      display: flex;
      align-items: center;
      gap: var(--td-comp-margin-m);

      .meta-item {
        color: var(--td-text-color-placeholder);
        font-size: 14px;
      }
    }
  }

  .actions {
    display: flex;
    gap: var(--td-comp-margin-s);
  }
}

.namespace-section {
  h3 {
    margin: 0 0 var(--td-comp-margin-l) 0;
    font-size: 18px;
    font-weight: 500;
  }
}
</style>
