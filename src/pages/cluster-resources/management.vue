<template>
  <div class="resource-management-container">
    <t-card :bordered="false">
      <!-- 选择器区域 -->
      <div class="selector-section">
        <div class="selector-item">
          <label>项目</label>
          <t-select
            v-model="selectedProjectId"
            :options="projectOptions"
            placeholder="请选择项目"
            :loading="loadingProjects"
            @change="handleProjectChange"
            style="width: 300px"
          />
        </div>
        <div class="selector-item">
          <label>命名空间</label>
          <t-select
            v-model="selectedNamespaceKey"
            :options="namespaceOptions"
            placeholder="请先选择项目"
            :loading="loadingNamespaces"
            :disabled="!selectedProjectId"
            @change="handleNamespaceChange"
            filterable
            style="width: 400px"
          />
        </div>
      </div>

      <t-divider />

      <!-- 资源类型标签页 -->
      <div v-if="store.hasSelectedNamespace" class="resource-tabs">
        <t-tabs v-model="activeTab" @change="handleTabChange">
          <t-tab-panel value="deployments" label="Deployments">
            <deployments-view />
          </t-tab-panel>
          
          <t-tab-panel value="services" label="Services">
            <services-view />
          </t-tab-panel>
          
          <t-tab-panel value="configmaps" label="ConfigMaps">
            <configmaps-view />
          </t-tab-panel>
          
          <t-tab-panel value="secrets" label="Secrets">
            <secrets-view />
          </t-tab-panel>

          <t-tab-panel value="hpas" label="HPAs">
            <hpas-view />
          </t-tab-panel>
        </t-tabs>
      </div>

      <t-empty v-else description="请选择项目和命名空间" />
    </t-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import type { SelectOption } from 'tdesign-vue-next';
import { getProjectList, getProjectNamespaces, type Project, type ProjectNamespace } from '@/api/project';
import { getClusterList, type Cluster } from '@/api/cluster';
import { useClusterResourceStore } from '@/store/modules/cluster-resource';
import DeploymentsView from './deployments.vue';
import ServicesView from './services.vue';
import ConfigmapsView from './configmaps.vue';
import SecretsView from './secrets.vue';
import HpasView from './hpas.vue';

const route = useRoute();
const store = useClusterResourceStore();

const activeTab = ref('deployments');

// 数据状态
const projects = ref<Project[]>([]);
const namespaces = ref<ProjectNamespace[]>([]);
const clusters = ref<Cluster[]>([]);
const loadingProjects = ref(false);
const loadingNamespaces = ref(false);

// 选中状态
const selectedProjectId = ref<string>('');
const selectedNamespaceKey = ref<string>('');

// 项目选项
const projectOptions = computed((): SelectOption[] => {
  return projects.value.map(p => ({
    label: p.name,
    value: p.id,
    disabled: p.status !== 1,
  }));
});

// 命名空间选项
const namespaceOptions = computed((): SelectOption[] => {
  // 先排序：生产 > 预发布 > 开发 > 其他
  const sorted = [...namespaces.value].sort((a, b) => {
    const getEnvPriority = (env?: string) => {
      if (!env) return 999;
      const e = env.toLowerCase();
      if (['prod', 'production'].includes(e)) return 1;
      if (['staging', 'test', 'testing', 'pre', 'pre-prod'].includes(e)) return 2;
      if (['dev', 'development', 'develop'].includes(e)) return 3;
      return 4;
    };
    return getEnvPriority(a.environment) - getEnvPriority(b.environment);
  });

  return sorted.map(ns => {
    const envLabel = getEnvironmentLabel(ns.environment);
    
    return {
      label: `${ns.namespace} / ${envLabel}`,
      value: ns.id,
    };
  });
});

// 获取环境标签主题色
const getEnvironmentTheme = (environment?: string): 'primary' | 'warning' | 'danger' | 'default' => {
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
      return '';
  }
};

// 处理项目变更
const handleProjectChange = async (value: any) => {
  const projectId = String(value);
  selectedNamespaceKey.value = '';
  store.reset();
  
  if (!projectId) {
    namespaces.value = [];
    return;
  }
  
  loadingNamespaces.value = true;
  try {
    namespaces.value = await getProjectNamespaces(projectId);
    store.selectedProjectId = projectId;
    store.availableNamespaces = namespaces.value;
    
    // 如果只有一个命名空间，自动选中
    if (namespaces.value.length === 1) {
      const ns = namespaces.value[0];
      selectedNamespaceKey.value = `${ns.cluster_id}|${ns.namespace}`;
      store.setNamespace(ns);
    }
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载命名空间失败');
  } finally {
    loadingNamespaces.value = false;
  }
};

// 处理命名空间变更
const handleNamespaceChange = (value: any) => {
  const namespaceId = String(value);
  const selected = namespaces.value.find(ns => String(ns.id) === namespaceId);
  
  if (!selected) {
    MessagePlugin.warning('未找到选中的命名空间');
    return;
  }

  // 更新 store - 传入完整的 namespace 对象
  store.setNamespace(selected);
  
  MessagePlugin.success(`已切换到命名空间: ${selected.namespace}`);
};

// 处理标签页切换
const handleTabChange = (value: string | number) => {
  console.log('切换到:', value);
};

// 加载项目列表
const loadProjects = async () => {
  loadingProjects.value = true;
  try {
    projects.value = await getProjectList();
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载项目列表失败');
  } finally {
    loadingProjects.value = false;
  }
};

// 加载集群列表
const loadClusters = async () => {
  try {
    clusters.value = await getClusterList();
  } catch (e: any) {
    console.error('加载集群列表失败:', e);
  }
};

// 从路由参数初始化
const initFromRoute = async () => {
  const projectId = route.query.projectId as string;
  if (projectId) {
    selectedProjectId.value = projectId;
    await handleProjectChange(projectId);
  }
};

onMounted(async () => {
  await Promise.all([loadProjects(), loadClusters()]);
  await initFromRoute();
});
</script>

<style lang="less" scoped>
.resource-management-container {
  .selector-section {
    display: flex;
    align-items: center;
    gap: var(--td-comp-margin-xxl);
    margin-bottom: var(--td-comp-margin-l);

    .selector-item {
      display: flex;
      align-items: center;
      gap: var(--td-comp-margin-m);

      label {
        font-weight: 500;
        min-width: 60px;
        color: var(--td-text-color-primary);
      }
    }
  }

  .resource-tabs {
    margin-top: var(--td-comp-margin-l);
  }
}

// 命名空间选项样式
:deep(.namespace-option-full) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  margin: -8px -12px;
  border-radius: 3px;
  transition: all 0.2s;

  .namespace-label {
    flex: 1;
    font-size: 14px;
    color: white;
    font-weight: 500;
  }

  .env-badge {
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 12px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.3);
    color: white;
  }

  // 开发环境 - 蓝色
  &.env-dev {
    background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);

    &:hover {
      background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
    }
  }

  // 预发布环境 - 橙色
  &.env-staging {
    background: linear-gradient(135deg, #f57c00 0%, #ef6c00 100%);

    &:hover {
      background: linear-gradient(135deg, #ef6c00 0%, #e65100 100%);
    }
  }

  // 生产环境 - 红色
  &.env-prod {
    background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%);

    &:hover {
      background: linear-gradient(135deg, #c62828 0%, #b71c1c 100%);
    }
  }

  // 默认环境
  &.env-default {
    background: linear-gradient(135deg, #757575 0%, #616161 100%);

    &:hover {
      background: linear-gradient(135deg, #616161 0%, #424242 100%);
    }
  }
}
</style>


