<template>
  <t-dialog
    v-model:visible="dialogVisible"
    header="恢复备份"
    :on-confirm="handleConfirm"
    :confirm-btn="{ loading: confirmLoading }"
    width="600px"
  >
    <t-alert theme="info" message="恢复操作将从备份中恢复资源到指定命名空间，支持跨集群恢复" style="margin-bottom: 16px" />
    <t-form ref="formRef" :data="formData" :rules="rules" label-width="120px">
      <t-form-item label="备份名称">
        <t-input :value="backupName" disabled />
      </t-form-item>
      
      <t-form-item label="恢复模式" name="restore_mode">
        <t-radio-group v-model="restoreMode" @change="handleRestoreModeChange">
          <t-radio value="same">同集群恢复</t-radio>
          <t-radio value="cross">跨集群恢复</t-radio>
        </t-radio-group>
      </t-form-item>

      <t-form-item label="源集群">
        <t-input :value="sourceClusterName" disabled />
      </t-form-item>

      <t-form-item label="目标集群" name="target_cluster_id" v-if="restoreMode === 'cross'">
        <t-select
          v-model="formData.target_cluster_id"
          placeholder="请选择目标集群"
          :loading="clusterLoading"
          @change="handleTargetClusterChange"
        >
          <t-option
            v-for="cluster in availableClusters"
            :key="cluster.id"
            :value="cluster.id"
            :label="cluster.name"
          />
        </t-select>
      </t-form-item>

      <t-form-item label="目标命名空间" name="target_namespace">
        <t-select
          v-model="formData.target_namespace"
          placeholder="可选，默认恢复到原命名空间"
          :loading="namespaceLoading"
          filterable
          creatable
        >
          <t-option
            v-for="ns in namespaces"
            :key="ns"
            :value="ns"
            :label="ns"
          />
        </t-select>
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import type { FormInstanceFunctions, FormRule } from 'tdesign-vue-next';
import type { RestoreRequest } from '@/api/model/backupModel';
import { getClusterList, type Cluster } from '@/api/cluster';
import { getNamespaces } from '@/api/k8s-resources';

interface Props {
  visible: boolean;
  backupName: string;
  sourceClusterId: string;      // 备份来源集群 ID
  sourceClusterName: string;    // 备份来源集群名称
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  backupName: '',
  sourceClusterId: '',
  sourceClusterName: '',
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm', data: RestoreRequest): void;
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
});

const formRef = ref<FormInstanceFunctions>();
const confirmLoading = ref(false);
const clusterLoading = ref(false);
const namespaceLoading = ref(false);

const restoreMode = ref<'same' | 'cross'>('same');
const clusters = ref<Cluster[]>([]);
const namespaces = ref<string[]>([]);

const formData = ref<RestoreRequest>({
  source_cluster_id: '',
  target_cluster_id: '',
  target_namespace: '',
});

// 可用的目标集群（排除源集群）
const availableClusters = computed(() => {
  return clusters.value.filter(c => c.id !== props.sourceClusterId);
});

const rules: Record<string, FormRule[]> = {
  target_cluster_id: [
    { 
      required: true, 
      message: '请选择目标集群', 
      type: 'error',
      trigger: 'change',
    },
  ],
};

// 加载集群列表
const loadClusters = async () => {
  clusterLoading.value = true;
  try {
    const res = await getClusterList();
    clusters.value = res || [];
  } catch (e) {
    console.error('加载集群列表失败:', e);
  } finally {
    clusterLoading.value = false;
  }
};

// 加载命名空间列表
const loadNamespaces = async (clusterId: string) => {
  if (!clusterId) return;
  
  namespaceLoading.value = true;
  try {
    const res = await getNamespaces(clusterId);
    namespaces.value = res.items?.map((item: any) => item.metadata?.name).filter(Boolean) || [];
  } catch (e) {
    console.error('加载命名空间列表失败:', e);
    namespaces.value = [];
  } finally {
    namespaceLoading.value = false;
  }
};

// 恢复模式变化
const handleRestoreModeChange = (value: string | number | boolean) => {
  const mode = value as 'same' | 'cross';
  if (mode === 'same') {
    formData.value.target_cluster_id = '';
    formData.value.target_namespace = '';
    namespaces.value = [];
    // 加载源集群的命名空间
    loadNamespaces(props.sourceClusterId);
  } else {
    formData.value.target_cluster_id = '';
    formData.value.target_namespace = '';
    namespaces.value = [];
  }
};

// 目标集群变化
const handleTargetClusterChange = (value: any) => {
  const clusterId = String(value);
  formData.value.target_namespace = '';
  namespaces.value = [];
  if (clusterId) {
    loadNamespaces(clusterId);
  }
};

// 监听对话框打开
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      // 重置表单
      restoreMode.value = 'same';
      formData.value = {
        source_cluster_id: props.sourceClusterId,
        target_cluster_id: '',
        target_namespace: '',
      };
      
      // 加载集群列表和源集群的命名空间
      loadClusters();
      loadNamespaces(props.sourceClusterId);
    }
  },
);

const handleConfirm = async () => {
  const valid = await formRef.value?.validate();
  if (!valid) return;

  confirmLoading.value = true;
  try {
    const submitData: RestoreRequest = {
      source_cluster_id: props.sourceClusterId,
    };
    
    // 跨集群恢复时需要指定目标集群
    if (restoreMode.value === 'cross') {
      submitData.target_cluster_id = formData.value.target_cluster_id;
    }
    
    // 目标命名空间（可选）
    if (formData.value.target_namespace) {
      submitData.target_namespace = formData.value.target_namespace;
    }
    
    emit('confirm', submitData);
  } finally {
    confirmLoading.value = false;
  }
};
</script>
