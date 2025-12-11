<template>
  <div class="cluster-resource-selector">
    <t-card :bordered="false" class="selector-card">
      <div class="selector-container">
        <div class="selector-item">
          <label>项目</label>
          <t-select
            v-model="selectedProjectId"
            :options="projectOptions"
            placeholder="请选择项目"
            :loading="projectLoading"
            @change="handleProjectChange"
            style="width: 250px"
          />
        </div>
        
        <div class="selector-item">
          <label>命名空间</label>
          <t-select
            v-model="selectedNamespaceKey"
            :options="namespaceOptions"
            placeholder="请选择命名空间"
            :loading="store.loading"
            :disabled="!store.selectedProjectId"
            @change="handleNamespaceChange"
            style="width: 300px"
          />
        </div>

        <div class="selector-info" v-if="store.hasSelectedNamespace">
          <t-tag theme="primary">{{ clusterName }}</t-tag>
          <t-tag theme="success">{{ store.namespace }}</t-tag>
        </div>
      </div>
    </t-card>

    <!-- 主内容区 -->
    <div class="resource-content">
      <router-view v-if="store.hasSelectedNamespace" />
      <t-card v-else :bordered="false">
        <t-empty description="请先选择项目和命名空间" />
      </t-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { useClusterResourceStore } from '@/store/modules/cluster-resource';
import { getProjectList, type Project } from '@/api/project';
import { getClusterList, type Cluster } from '@/api/cluster';

const route = useRoute();
const store = useClusterResourceStore();

const projects = ref<Project[]>([]);
const clusters = ref<Cluster[]>([]);
const projectLoading = ref(false);

// 选中的项目 ID
const selectedProjectId = ref<string>('');

// 选中的命名空间 key（格式：clusterId|namespace）
const selectedNamespaceKey = ref<string>('');

// 项目选项
const projectOptions = computed(() => {
  return projects.value.map(p => ({
    label: p.name,
    value: p.id,
  }));
});

// 命名空间选项
const namespaceOptions = computed(() => {
  return store.availableNamespaces.map(ns => {
    const cluster = clusters.value.find(c => c.id === ns.cluster_id);
    const clusterName = cluster?.name || ns.cluster_id;
    return {
      label: `${clusterName} / ${ns.namespace}`,
      value: `${ns.cluster_id}|${ns.namespace}`,
    };
  });
});

// 当前集群名称
const clusterName = computed(() => {
  if (!store.selectedNamespace) return '';
  const cluster = clusters.value.find(c => c.id === store.selectedNamespace?.cluster_id);
  return cluster?.name || store.selectedNamespace.cluster_id;
});

// 处理项目变更
const handleProjectChange = async (value: string) => {
  await store.setProject(value);
  
  // 自动选择第一个命名空间
  if (store.availableNamespaces.length > 0) {
    const firstNs = store.availableNamespaces[0];
    selectedNamespaceKey.value = `${firstNs.cluster_id}|${firstNs.namespace}`;
  } else {
    selectedNamespaceKey.value = '';
    MessagePlugin.warning('该项目没有绑定任何命名空间');
  }
};

// 处理命名空间变更
const handleNamespaceChange = (value: string) => {
  const [clusterId, namespace] = value.split('|');
  const ns = store.availableNamespaces.find(
    n => n.cluster_id === clusterId && n.namespace === namespace
  );
  
  if (ns) {
    store.setNamespace(ns);
  }
};

// 加载项目列表
const loadProjects = async () => {
  projectLoading.value = true;
  try {
    projects.value = await getProjectList();
    
    // 自动选择第一个项目
    if (projects.value.length > 0 && !store.selectedProjectId) {
      selectedProjectId.value = projects.value[0].id;
      await handleProjectChange(selectedProjectId.value);
    }
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载项目列表失败');
  } finally {
    projectLoading.value = false;
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

// 监听 store 中的项目变化，同步到本地状态
watch(() => store.selectedProjectId, (newVal) => {
  if (newVal && newVal !== selectedProjectId.value) {
    selectedProjectId.value = newVal;
  }
});

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
  await Promise.all([loadProjects(), loadClusters()]);
});
</script>

<style lang="less" scoped>
.cluster-resource-selector {
  padding: var(--td-comp-paddingTB-l) var(--td-comp-paddingLR-xxl);

  .selector-card {
    margin-bottom: var(--td-comp-margin-l);
  }

  .selector-container {
    display: flex;
    align-items: center;
    gap: var(--td-comp-margin-xl);
    flex-wrap: wrap;

    .selector-item {
      display: flex;
      align-items: center;
      gap: var(--td-comp-margin-s);

      label {
        font-weight: 500;
        min-width: 60px;
      }
    }

    .selector-info {
      display: flex;
      align-items: center;
      gap: var(--td-comp-margin-s);
      margin-left: auto;
    }
  }

  .resource-content {
    // 内容区域样式
  }
}
</style>
