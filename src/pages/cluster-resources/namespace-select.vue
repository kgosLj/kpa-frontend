<template>
  <div class="namespace-selection-container">
    <div class="selection-header">
      <div class="header-content">
        <t-button 
          theme="default" 
          variant="outline"
          class="back-button"
          @click="goBack"
        >
          <template #icon><chevron-left-icon /></template>
          返回
        </t-button>
        <div class="header-info">
          <h1>{{ projectName }}</h1>
          <p class="description">请选择要管理的命名空间</p>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <t-loading size="large" text="加载命名空间列表..." />
    </div>

    <div v-else-if="namespaces.length === 0" class="empty-container">
      <t-empty description="该项目没有绑定任何命名空间">
        <template #image>
          <folder-open-icon size="64px" />
        </template>
      </t-empty>
    </div>

    <div v-else class="namespace-grid">
      <div
        v-for="ns in namespaces"
        :key="`${ns.cluster_id}-${ns.namespace}`"
        class="namespace-card"
        :class="`env-${ns.environment || 'default'}`"
        @click="handleSelectNamespace(ns)"
      >
        <div class="card-glow" :class="`glow-${ns.environment || 'default'}`"></div>
        <div class="card-content">
          <div class="card-header">
            <div class="namespace-icon" :class="`icon-${ns.environment || 'default'}`">
              <server-icon size="24px" />
            </div>
            <t-tag 
              :theme="getEnvironmentTheme(ns.environment)" 
              size="medium"
              class="env-tag"
            >
              {{ getEnvironmentLabel(ns.environment) }}
            </t-tag>
          </div>
          
          <div class="card-body">
            <h3 class="namespace-name">{{ ns.namespace }}</h3>
            <div class="cluster-info">
              <cloud-icon size="16px" />
              <span>{{ getClusterName(ns.cluster_id) }}</span>
            </div>
          </div>
          
          <div class="card-footer">
            <div class="action-hint">点击进入资源管理</div>
            <chevron-right-icon size="20px" class="arrow-icon" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { ChevronLeftIcon, ServerIcon, CloudIcon, ChevronRightIcon, FolderOpenIcon } from 'tdesign-icons-vue-next';
import { getProject, getProjectNamespaces, type ProjectNamespace } from '@/api/project';
import { getClusterList, type Cluster } from '@/api/cluster';
import { useClusterResourceStore } from '@/store/modules/cluster-resource';

const route = useRoute();
const router = useRouter();
const store = useClusterResourceStore();

const projectId = route.query.projectId as string;
const projectName = ref('');
const namespaces = ref<ProjectNamespace[]>([]);
const clusters = ref<Cluster[]>([]);
const loading = ref(false);

// 获取环境标签主题色
const getEnvironmentTheme = (environment?: string): string => {
  switch (environment) {
    case 'dev':
      return 'primary';
    case 'staging':
      return 'warning';
    case 'prod':
      return 'danger';
    default:
      return 'default';
  }
};

// 获取环境标签文本
const getEnvironmentLabel = (environment?: string): string => {
  switch (environment) {
    case 'dev':
      return '开发';
    case 'staging':
      return '预发布';
    case 'prod':
      return '生产';
    default:
      return '未知';
  }
};

// 获取集群名称
const getClusterName = (clusterId: string): string => {
  const cluster = clusters.value.find(c => c.id === clusterId);
  return cluster?.name || clusterId;
};

// 处理命名空间选择
const handleSelectNamespace = async (namespace: ProjectNamespace) => {
  try {
    // 设置 store 中的项目和命名空间
    await store.setProjectAndNamespace(projectId, namespace);
    
    // 跳转到资源管理页面
    router.push({ 
      name: 'ClusterResourceManagement',
      query: {
        projectId,
        clusterId: namespace.cluster_id,
        namespace: namespace.namespace,
      },
    });
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载失败');
  }
};

// 返回项目选择
const goBack = () => {
  router.push({ name: 'ClusterResourceSelect' });
};

// 加载数据
const loadData = async () => {
  loading.value = true;
  try {
    const [project, clusterList, nsList] = await Promise.all([
      getProject(projectId),
      getClusterList(),
      getProjectNamespaces(projectId),
    ]);
    
    projectName.value = project.name;
    clusters.value = clusterList;
    namespaces.value = nsList;
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载数据失败');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (!projectId) {
    MessagePlugin.error('缺少项目 ID');
    router.push({ name: 'ClusterResourceSelect' });
    return;
  }
  loadData();
});
</script>

<style lang="less" scoped>
.namespace-selection-container {
  padding: var(--td-comp-paddingTB-xxl) var(--td-comp-paddingLR-xxl);

  .selection-header {
    text-align: center;
    margin-bottom: var(--td-comp-margin-l);

    h2 {
      margin: var(--td-comp-margin-m) 0 var(--td-comp-margin-s) 0;
      font-size: 24px;
      font-weight: 600;
    }

    .description {
      margin: 0;
      color: var(--td-text-color-secondary);
      font-size: 14px;
    }
  }

  .namespace-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--td-comp-margin-l);
    margin-top: var(--td-comp-margin-l);

    .namespace-card {
      cursor: pointer;
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(-4px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      // 开发环境
      &.env-dev {
        border-left: 4px solid #1976d2;
        
        &:hover {
          border-left-color: #1565c0;
        }
      }

      // 预发布环境
      &.env-staging {
        border-left: 4px solid #f57c00;
        
        &:hover {
          border-left-color: #ef6c00;
        }
      }

      // 生产环境
      &.env-prod {
        border-left: 4px solid #c62828;
        
        &:hover {
          border-left-color: #b71c1c;
        }
      }

      .namespace-card-content {
        .namespace-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--td-comp-margin-m);

          h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 500;
          }
        }

        .namespace-meta {
          .cluster-name {
            color: var(--td-text-color-secondary);
            font-size: 14px;
          }
        }
      }
    }
  }

  .loading-container {
    display: flex;
    justify-content: center;
    padding: var(--td-comp-paddingTB-xxl) 0;
  }
}
</style>
