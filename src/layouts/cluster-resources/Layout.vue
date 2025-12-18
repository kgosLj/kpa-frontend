<template>
  <div class="cluster-resource-layout">
    <!-- 选择器区域 -->
    <t-card :bordered="false" class="selector-card">
      <div class="selector-container">
        <div class="selector-item">
          <label>命名空间</label>
          <t-select
            v-model="selectedNamespaceKey"
            placeholder="请选择命名空间 (Debug)"
            :loading="loading"
            @change="handleNamespaceChange"
            style="width: 500px"
          >
            <t-option
              v-for="item in namespaceOptions"
              :key="item.value"
              :value="item.value"
            >
              <div 
                class="namespace-option"
                :style="getOptionStyle(item.envType)"
              >
                {{ item.label }}
                <!-- Debug Info -->
                <span class="debug-info" style="font-size: 12px; margin-left: 8px;">
                   [Env: {{ item.envType }}]
                </span>
                <!-- Environment Label -->
                <span v-if="item.envLabel" style="margin-left: 4px; font-weight: 600;">
                  ({{ item.envLabel }})
                </span>
              </div>
            </t-option>
          </t-select>
        </div>
      </div>
    </t-card>

    <!-- 主内容区 -->
    <div class="resource-content">
      <router-view v-if="store.hasSelectedNamespace" />
      <t-card v-else :bordered="false">
        <t-empty description="请先选择命名空间" />
      </t-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { useClusterResourceStore } from '@/store/modules/cluster-resource';
import { getClusterList, type Cluster } from '@/api/cluster';
import type { SelectOption } from 'tdesign-vue-next';

const route = useRoute();
const store = useClusterResourceStore();

const clusters = ref<Cluster[]>([]);
const loading = ref(false);

// 选中的命名空间 key（格式：clusterId|namespace）
const selectedNamespaceKey = ref<string>('');

// 归一化环境类型
const normalizeEnvironment = (env?: string): string => {
  if (!env) return 'default';
  const e = env.toLowerCase();
  if (['dev', 'development', 'develop'].includes(e)) return 'dev';
  if (['staging', 'test', 'testing', 'pre', 'pre-prod'].includes(e)) return 'staging';
  if (['prod', 'production'].includes(e)) return 'prod';
  return 'default';
};

// 获取环境标签主题色
const getEnvironmentTheme = (environment?: string): string => {
  const env = normalizeEnvironment(environment);
  switch (env) {
    case 'dev': return 'primary'; // 蓝色
    case 'staging': return 'warning'; // 橙色
    case 'prod': return 'danger'; // 红色
    default: return 'default';
  }
};

// 获取环境标签文本
const getEnvironmentLabel = (environment?: string): string => {
  const env = normalizeEnvironment(environment);
  switch (env) {
    case 'dev': return '开发';
    case 'staging': return '预发布';
    case 'prod': return '生产';
    // 如果无法识别，尝试返回原值，或者空
    default: return environment || '';
  }
};

// 命名空间选项（带环境标签）
const namespaceOptions = computed((): SelectOption[] => {
  return store.availableNamespaces.map(ns => {
    const cluster = clusters.value.find(c => c.id === ns.cluster_id);
    const clusterName = cluster?.name || ns.cluster_id;
    // 使用 normalizeEnvironment 确保一致性
    const normalizedEnv = normalizeEnvironment(ns.environment);
    const envLabel = getEnvironmentLabel(ns.environment);
    
    // Debug output
    // console.log('Namespace:', ns.namespace, 'Env:', ns.environment, 'Normalized:', normalizedEnv);

    return {
      label: `${clusterName} / ${ns.namespace}`,
      value: `${ns.cluster_id}|${ns.namespace}`,
      envLabel,
      envType: normalizedEnv, // dev, staging, prod, default
      // ensure content is not empty if slot is not used effectively? 
      // TDesign select uses content or label.
    };
  });
});

// 处理命名空间变更
const handleNamespaceChange = (value: any) => {
  const key = String(value);
  const [clusterId, namespace] = key.split('|');
  const ns = store.availableNamespaces.find(
    n => n.cluster_id === clusterId && n.namespace === namespace
  );
  
  if (ns) {
    store.setNamespace(ns);
  }
};

// 获取选项样式
const getOptionStyle = (envType?: string) => {
  const baseStyle = {
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '500',
  };

  switch (envType) {
    case 'dev':
      return {
        ...baseStyle,
        backgroundColor: '#e3f2fd',
        color: '#1976d2',
      };
    case 'staging':
      return {
        ...baseStyle,
        backgroundColor: '#fff3e0',
        color: '#f57c00',
      };
    case 'prod':
      return {
        ...baseStyle,
        backgroundColor: '#ffebee',
        color: '#c62828',
      };
    default:
      return {
        ...baseStyle,
        backgroundColor: '#f5f5f5',
        color: '#616161',
      };
  }
};

// 加载集群列表
const loadClusters = async () => {
  try {
    clusters.value = await getClusterList();
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载集群列表失败');
  }
};

// 从路由参数加载项目
const loadFromRoute = async () => {
  const projectId = route.query.projectId as string;
  if (projectId && projectId !== store.selectedProjectId) {
    loading.value = true;
    try {
      await store.setProject(projectId);
      
      // 自动选择第一个命名空间
      if (store.availableNamespaces.length > 0) {
        const firstNs = store.availableNamespaces[0];
        selectedNamespaceKey.value = `${firstNs.cluster_id}|${firstNs.namespace}`;
        store.setNamespace(firstNs);
      }
    } catch (e: any) {
      MessagePlugin.error(e.message || '加载项目信息失败');
    } finally {
      loading.value = false;
    }
  }
};

// 监听 store 中的命名空间变化，同步到本地状态
watch(() => store.selectedNamespace, (newVal) => {
  if (newVal) {
    const key = `${newVal.cluster_id}|${newVal.namespace}`;
    if (key !== selectedNamespaceKey.value) {
      selectedNamespaceKey.value = key;
    }
  }
});

// 初始化
onMounted(async () => {
  await loadClusters();
  await loadFromRoute();
});
</script>

<style lang="less" scoped>
.cluster-resource-layout {
  .selector-card {
    margin-bottom: var(--td-comp-margin-l);
  }

  .selector-container {
    display: flex;
    align-items: center;
    gap: var(--td-comp-margin-xl);

    .selector-item {
      display: flex;
      align-items: center;
      gap: var(--td-comp-margin-s);

      label {
        font-weight: 500;
        min-width: 80px;
      }
    }
  }

  .namespace-selector-header {
    padding: var(--td-comp-paddingTB-s) var(--td-comp-paddingLR-m);
    font-weight: 500;
    border-bottom: 1px solid var(--td-component-border);
  }
}

:deep(.namespace-option) {
  padding: var(--td-comp-paddingTB-s) var(--td-comp-paddingLR-m);
  border-radius: var(--td-radius-small);
  transition: all 0.2s;

  .namespace-text {
    font-size: 14px;
    font-weight: 500;

    .env-label {
      margin-left: var(--td-comp-margin-xs);
      font-weight: 600;
    }
  }

  // 开发环境 - 蓝色
  &.env-dev {
    background-color: #e3f2fd;
    color: #1976d2;

    &:hover {
      background-color: #bbdefb;
    }
  }

  // 预发布环境 - 橙色
  &.env-staging {
    background-color: #fff3e0;
    color: #f57c00;

    &:hover {
      background-color: #ffe0b2;
    }
  }

  // 生产环境 - 红色
  &.env-prod {
    background-color: #ffebee;
    color: #c62828;

    &:hover {
      background-color: #ffcdd2;
    }
  }

  // 默认环境
  &.env-default {
    background-color: #f5f5f5;
    color: #616161;

    &:hover {
      background-color: #eeeeee;
    }
  }
}
</style>

