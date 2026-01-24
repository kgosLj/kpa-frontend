<template>
  <div class="cluster-selector">
    <t-select v-model="selectedClusterId" :options="clusterOptions" placeholder="请选择集群" :loading="loading"
      @change="handleClusterChange as any">
      <template #prefixIcon>
        <server-icon />
      </template>
    </t-select>
  </div>
</template>

<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { ServerIcon } from 'tdesign-icons-vue-next';
import { computed, onMounted, ref } from 'vue';
import { getClusterList, type Cluster } from '@/api/cluster';

const emit = defineEmits<{
  change: [clusterId: string];
}>();

const STORAGE_KEY = 'kpa_selected_cluster_id';

const loading = ref(false);
const clusters = ref<Cluster[]>([]);
const selectedClusterId = ref<string>('');

// 集群选项
const clusterOptions = computed(() => {
  return clusters.value.map((cluster) => ({
    label: `${cluster.name} (${cluster.environment})`,
    value: cluster.id,
  }));
});

// 获取集群列表
const fetchClusters = async () => {
  loading.value = true;
  try {
    const res = await getClusterList();
    clusters.value = res;

    // 尝试恢复之前保存的集群选择
    const savedClusterId = localStorage.getItem(STORAGE_KEY);
    if (savedClusterId && res.find((c) => c.id === savedClusterId)) {
      // 恢复保存的集群
      selectedClusterId.value = savedClusterId;
      emit('change', savedClusterId);
    } else if (res.length > 0 && !selectedClusterId.value) {
      // 没有保存的集群或保存的集群不存在，选择第一个
      selectedClusterId.value = res[0].id;
      localStorage.setItem(STORAGE_KEY, res[0].id);
      emit('change', res[0].id);
    }
  } catch (error) {
    MessagePlugin.error('获取集群列表失败');
    console.error('Failed to fetch clusters:', error);
  } finally {
    loading.value = false;
  }
};

// 集群切换
const handleClusterChange = (value: string) => {
  // 保存到 localStorage
  localStorage.setItem(STORAGE_KEY, value);
  emit('change', value);
};

onMounted(() => {
  fetchClusters();
});

defineExpose({
  refresh: fetchClusters,
});
</script>

<style lang="less" scoped>
.cluster-selector {
  :deep(.t-select) {
    min-width: 280px;
  }
}
</style>
