<template>
  <t-dialog
    v-model:visible="dialogVisible"
    :header="title"
    :on-confirm="handleConfirm"
    :confirm-btn="{ loading: confirmLoading }"
    width="600px"
  >
    <t-form ref="formRef" :data="formData" :rules="rules" label-width="120px">
      <t-form-item label="集群" name="clusterId">
        <t-select
          v-model="formData.clusterId"
          placeholder="请选择集群"
          :loading="clusterLoading"
          @change="handleClusterChange"
        >
          <t-option
            v-for="cluster in clusters"
            :key="cluster.id"
            :value="cluster.id"
            :label="cluster.name"
          />
        </t-select>
      </t-form-item>
      <t-form-item label="备份名称" name="name">
        <t-input v-model="formData.name" placeholder="如: my-backup 或 app.backup (仅小写字母、数字、-和.)" />
      </t-form-item>
      <t-form-item label="命名空间" name="namespace">
        <t-select
          v-model="formData.namespace"
          placeholder="请选择命名空间"
          :loading="namespaceLoading"
          :disabled="!formData.clusterId"
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
      <t-form-item label="包含资源类型" name="included_resources">
        <t-select
          v-model="formData.included_resources"
          :multiple="true"
          :creatable="true"
          placeholder="可选,默认全部资源"
        >
          <t-option value="pods" label="Pods" />
          <t-option value="deployments" label="Deployments" />
          <t-option value="services" label="Services" />
          <t-option value="configmaps" label="ConfigMaps" />
          <t-option value="secrets" label="Secrets" />
          <t-option value="persistentvolumeclaims" label="PVCs" />
        </t-select>
      </t-form-item>
      <t-form-item label="保留时间" name="ttl">
        <t-select v-model="formData.ttl" :clearable="true" placeholder="可选,默认30天">
          <t-option value="168h" label="7天" />
          <t-option value="720h" label="30天" />
          <t-option value="2160h" label="90天" />
          <t-option value="4320h" label="180天" />
        </t-select>
      </t-form-item>
      <t-form-item label="存储位置" name="storage_location">
        <t-input v-model="formData.storage_location" placeholder="可选,使用默认存储位置" />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import type { FormInstanceFunctions, FormRule } from 'tdesign-vue-next';
import type { CreateBackupRequest } from '@/api/model/backupModel';
import { getClusterList, type Cluster } from '@/api/cluster';
import { getNamespaces } from '@/api/k8s-resources';

interface Props {
  visible: boolean;
  data?: CreateBackupRequest;
  defaultClusterId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  data: undefined,
  defaultClusterId: undefined,
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm', data: CreateBackupRequest, clusterId: string): void;
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
});

const title = computed(() => (props.data ? '编辑备份' : '创建备份'));

const formRef = ref<FormInstanceFunctions>();
const confirmLoading = ref(false);
const clusterLoading = ref(false);
const namespaceLoading = ref(false);

const clusters = ref<Cluster[]>([]);
const namespaces = ref<string[]>([]);

const formData = ref<CreateBackupRequest & { clusterId: string }>({
  clusterId: '',
  name: '',
  namespace: '',
  included_resources: [],
  ttl: '',
  storage_location: '',
});

const rules: Record<string, FormRule[]> = {
  clusterId: [{ required: true, message: '请选择集群', type: 'error' }],
  name: [
    { required: true, message: '请输入备份名称', type: 'error' },
    {
      validator: (val: string) => {
        // RFC 1123 subdomain 验证: 只能包含小写字母、数字、连字符和点
        const rfc1123Regex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
        return rfc1123Regex.test(val);
      },
      message: '备份名称只能包含小写字母、数字、连字符(-)和点(.),且必须以字母或数字开头和结尾',
      type: 'error',
    },
  ],
  namespace: [{ required: true, message: '请选择命名空间', type: 'error' }],
};

// 加载集群列表
const loadClusters = async () => {
  clusterLoading.value = true;
  try {
    const res = await getClusterList();
    clusters.value = res || [];
    
    // 如果有默认集群ID,设置它
    if (props.defaultClusterId && !formData.value.clusterId) {
      formData.value.clusterId = props.defaultClusterId;
      loadNamespaces(props.defaultClusterId);
    }
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

// 集群变化时重新加载命名空间
const handleClusterChange = (value: any) => {
  const clusterId = String(value);
  formData.value.namespace = '';
  namespaces.value = [];
  if (clusterId) {
    loadNamespaces(clusterId);
  }
};

// 监听对话框打开,加载集群列表
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      loadClusters();
    }
  },
);

// 监听 props.data 变化,更新表单数据
watch(
  () => props.data,
  (newData) => {
    if (newData) {
      formData.value = {
        clusterId: props.defaultClusterId || '',
        ...newData,
      };
    } else {
      formData.value = {
        clusterId: props.defaultClusterId || '',
        name: '',
        namespace: '',
        included_resources: [],
        ttl: '',
        storage_location: '',
      };
    }
  },
  { immediate: true },
);

const handleConfirm = async () => {
  const valid = await formRef.value?.validate();
  if (!valid) return;

  confirmLoading.value = true;
  try {
    // 清理空字段
    const submitData: CreateBackupRequest = {
      name: formData.value.name,
      namespace: formData.value.namespace,
    };
    if (formData.value.included_resources && formData.value.included_resources.length > 0) {
      submitData.included_resources = formData.value.included_resources;
    }
    if (formData.value.ttl) {
      submitData.ttl = formData.value.ttl;
    }
    if (formData.value.storage_location) {
      submitData.storage_location = formData.value.storage_location;
    }

    emit('confirm', submitData, formData.value.clusterId);
  } finally {
    confirmLoading.value = false;
  }
};
</script>
