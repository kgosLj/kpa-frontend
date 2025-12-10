<template>
  <t-dialog
    v-model:visible="dialogVisible"
    header="创建定时备份"
    :on-confirm="handleConfirm"
    :confirm-btn="{ loading: confirmLoading }"
    width="700px"
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
      <t-form-item label="调度名称" name="name">
        <t-input v-model="formData.name" placeholder="如: daily-backup (仅小写字母、数字、-和.)" />
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
      <t-form-item label="Cron 表达式" name="schedule">
        <t-input v-model="formData.schedule" placeholder="如: 0 2 * * * (每天凌晨2点)" />
        <template #tips>
          <div style="margin-top: 4px">
            <div>常用示例:</div>
            <div>• 每天凌晨2点: <t-link @click="setCron('0 2 * * *')">0 2 * * *</t-link></div>
            <div>• 每周日凌晨3点: <t-link @click="setCron('0 3 * * 0')">0 3 * * 0</t-link></div>
            <div>• 每月1号凌晨4点: <t-link @click="setCron('0 4 1 * *')">0 4 1 * *</t-link></div>
          </div>
        </template>
      </t-form-item>
      <t-form-item label="是否暂停" name="paused">
        <t-switch v-model="formData.paused" />
      </t-form-item>

      <t-divider>备份模板配置</t-divider>

      <t-form-item label="备份名称前缀" name="template.name">
        <t-input v-model="formData.template.name" placeholder="如: app-backup (仅小写字母、数字、-和.)" />
      </t-form-item>
      <t-form-item label="包含资源类型" name="template.included_resources">
        <t-select
          v-model="formData.template.included_resources"
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
      <t-form-item label="保留时间" name="template.ttl">
        <t-select v-model="formData.template.ttl" :clearable="true" placeholder="可选,默认30天">
          <t-option value="168h" label="7天" />
          <t-option value="720h" label="30天" />
          <t-option value="2160h" label="90天" />
          <t-option value="4320h" label="180天" />
        </t-select>
      </t-form-item>
      <t-form-item label="存储位置" name="template.storage_location">
        <t-input v-model="formData.template.storage_location" placeholder="可选,使用默认存储位置" />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { FormInstanceFunctions, FormRule } from 'tdesign-vue-next';
import type { CreateScheduleRequest } from '@/api/model/backupModel';
import { getClusterList, type Cluster } from '@/api/cluster';
import { getNamespaces } from '@/api/k8s-resources';

interface Props {
  visible: boolean;
  data?: CreateScheduleRequest;
  defaultClusterId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  data: undefined,
  defaultClusterId: undefined,
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm', data: CreateScheduleRequest, clusterId: string): void;
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
});

const formRef = ref<FormInstanceFunctions>();
const confirmLoading = ref(false);
const clusterLoading = ref(false);
const namespaceLoading = ref(false);

const clusters = ref<Cluster[]>([]);
const namespaces = ref<string[]>([]);

const formData = ref<CreateScheduleRequest & { clusterId: string }>({
  clusterId: '',
  name: '',
  namespace: '',
  schedule: '',
  template: {
    name: '',
    namespace: '',
    included_resources: [],
    ttl: '',
    storage_location: '',
  },
  paused: false,
});

const rules: Record<string, FormRule[]> = {
  clusterId: [{ required: true, message: '请选择集群', type: 'error' }],
  name: [
    { required: true, message: '请输入调度名称', type: 'error' },
    {
      validator: (val: string) => {
        // RFC 1123 subdomain 验证
        const rfc1123Regex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
        return rfc1123Regex.test(val);
      },
      message: '调度名称只能包含小写字母、数字、连字符(-)和点(.),且必须以字母或数字开头和结尾',
      type: 'error',
    },
  ],
  namespace: [{ required: true, message: '请选择命名空间', type: 'error' }],
  schedule: [{ required: true, message: '请输入 Cron 表达式', type: 'error' }],
  'template.name': [
    { required: true, message: '请输入备份名称前缀', type: 'error' },
    {
      validator: (val: string) => {
        // RFC 1123 subdomain 验证
        const rfc1123Regex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
        return rfc1123Regex.test(val);
      },
      message: '备份名称前缀只能包含小写字母、数字、连字符(-)和点(.),且必须以字母或数字开头和结尾',
      type: 'error',
    },
  ],
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
        schedule: '',
        template: {
          name: '',
          namespace: '',
          included_resources: [],
          ttl: '',
          storage_location: '',
        },
        paused: false,
      };
    }
  },
  { immediate: true },
);

const setCron = (cron: string) => {
  formData.value.schedule = cron;
};

const handleConfirm = async () => {
  const valid = await formRef.value?.validate();
  if (!valid) return;

  confirmLoading.value = true;
  try {
    // 备份模板的命名空间应该与调度的命名空间一致
    formData.value.template.namespace = formData.value.namespace;

    // 清理空字段
    const submitData: CreateScheduleRequest = {
      name: formData.value.name,
      namespace: formData.value.namespace,
      schedule: formData.value.schedule,
      template: {
        name: formData.value.template.name,
        namespace: formData.value.template.namespace,
      },
      paused: formData.value.paused,
    };

    if (formData.value.template.included_resources && formData.value.template.included_resources.length > 0) {
      submitData.template.included_resources = formData.value.template.included_resources;
    }
    if (formData.value.template.ttl) {
      submitData.template.ttl = formData.value.template.ttl;
    }
    if (formData.value.template.storage_location) {
      submitData.template.storage_location = formData.value.template.storage_location;
    }

    emit('confirm', submitData, formData.value.clusterId);
  } finally {
    confirmLoading.value = false;
  }
};
</script>
