<template>
  <div class="hpa-form">
    <t-tabs v-model="activeTab">
      <!-- 基本信息 -->
      <t-tab-panel value="basic" label="基本信息">
        <t-form
          ref="formRef"
          :data="formData"
          :rules="formRules"
          label-align="right"
          :label-width="120"
        >
          <t-form-item label="HPA 名称" name="name">
            <t-input
              v-model="formData.name"
              placeholder="请输入 HPA 名称"
              :maxlength="253"
              :disabled="mode === 'edit'"
            />
          </t-form-item>

          <t-form-item label="绑定资源" name="targetName">
            <t-select
              v-model="formData.targetName"
              placeholder="请选择绑定的 Deployment"
              :loading="loadingRepos"
              :disabled="mode === 'edit'"
              filterable
            >
              <t-option
                v-for="item in deploymentList"
                :key="item.metadata.name"
                :value="item.metadata.name"
                :label="item.metadata.name"
              />
            </t-select>
          </t-form-item>

          <t-form-item label="最小副本数" name="minReplicas">
            <t-input-number
              v-model="formData.minReplicas"
              :min="1"
              :max="formData.maxReplicas"
              theme="normal"
            />
          </t-form-item>

          <t-form-item label="最大副本数" name="maxReplicas">
            <t-input-number
              v-model="formData.maxReplicas"
              :min="formData.minReplicas || 1"
              :max="100"
              theme="normal"
            />
          </t-form-item>
        </t-form>
      </t-tab-panel>

      <!-- 触发指标 -->
      <t-tab-panel value="metrics" label="触发指标">
        <t-form label-align="right" :label-width="120">
          <t-form-item label="CPU 平均使用率">
            <t-input-number
              v-model="formData.targetCPU"
              :min="0"
              :max="100"
              placeholder="百分比"
              suffix="%"
              theme="normal"
              style="width: 200px"
            />
            <span class="form-hint" style="margin-left: 8px;">当 Pod 平均 CPU 使用率超过此值时触发扩容 (0 表示不启用)</span>
          </t-form-item>

          <t-form-item label="内存平均使用率">
            <t-input-number
              v-model="formData.targetMemory"
              :min="0"
              :max="100"
              placeholder="百分比"
              suffix="%"
              theme="normal"
              style="width: 200px"
            />
            <span class="form-hint" style="margin-left: 8px;">当 Pod 平均内存使用率超过此值时触发扩容 (0 表示不启用)</span>
          </t-form-item>
        </t-form>
      </t-tab-panel>

      <!-- YAML 预览 -->
      <t-tab-panel value="preview" label="YAML 预览">
        <div class="yaml-preview-container">
          <div class="yaml-actions">
            <t-button variant="outline" size="small" @click="copyYaml">
              <template #icon><file-copy-icon /></template>
              复制 YAML
            </t-button>
          </div>
          <pre class="yaml-preview">{{ generatedYaml }}</pre>
        </div>
      </t-tab-panel>
    </t-tabs>

    <!-- 底部操作按钮 -->
    <div class="form-footer">
      <t-button theme="default" @click="handleCancel">取消</t-button>
      <t-button 
        theme="primary" 
        @click="handlePreviewDiff" 
        :loading="diffLoading"
      >
        预览变更
      </t-button>
      <t-alert 
        v-if="!diffConfirmed" 
        theme="info" 
        style="margin-left: 8px; padding: 8px 12px;"
      >
        请先预览变更后再提交
      </t-alert>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import * as yaml from 'js-yaml';
import { MessagePlugin } from 'tdesign-vue-next';
import { FileCopyIcon } from 'tdesign-icons-vue-next';
import { getDeployments, diffResource, type HPA, type Deployment, type ResourceDiffResponse } from '@/api/k8s-resources';
import { useClusterResourceStore } from '@/store/modules/cluster-resource';

// Props
interface Props {
  mode?: 'create' | 'edit';
  initialData?: HPA | null;
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  initialData: null,
});

// Emits
const emit = defineEmits<{
  (e: 'success'): void;
  (e: 'cancel'): void;
  (e: 'preview-diff', data: ResourceDiffResponse): void;
  (e: 'close-form'): void;
}>();

// Store
const store = useClusterResourceStore();
const clusterId = computed(() => store.clusterId);
const namespace = computed(() => store.namespace);

// State
const activeTab = ref('basic');
const diffLoading = ref(false);
const formRef = ref();
const diffConfirmed = ref(false);
const deploymentList = ref<Deployment[]>([]);
const loadingRepos = ref(false);

// 表单数据
const formData = ref({
  name: '',
  targetName: '',
  minReplicas: 1,
  maxReplicas: 5,
  targetCPU: 80,
  targetMemory: 0 as number | undefined,
});

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入 HPA 名称', trigger: 'blur' as const },
    { pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, message: '名称只能包含小写字母、数字和连字符', trigger: 'blur' as const },
  ],
  targetName: [{ required: true, message: '请选择绑定的 Deployment', trigger: 'change' as const }],
  minReplicas: [{ required: true, message: '请输入最小副本数', trigger: 'blur' as const }],
  maxReplicas: [{ required: true, message: '请输入最大副本数', trigger: 'blur' as const }],
};

// 加载 Deployment 列表
async function loadDeployments() {
  if (!clusterId.value || !namespace.value) return;
  loadingRepos.value = true;
  try {
    const res = await getDeployments(clusterId.value, namespace.value);
    deploymentList.value = res.items || [];
  } catch (e) {
    console.error('Failed to load deployments:', e);
  } finally {
    loadingRepos.value = false;
  }
}

// 自动填充 HPA 名称
watch(() => formData.value.targetName, (newName) => {
  if (props.mode === 'create' && newName && !formData.value.name) {
    formData.value.name = `${newName}-hpa`;
  }
});

// 初始化表单
function initFromHPA(hpa: HPA) {
  formData.value.name = hpa.metadata.name;
  formData.value.targetName = hpa.spec.scaleTargetRef.name;
  formData.value.minReplicas = hpa.spec.minReplicas || 1;
  formData.value.maxReplicas = hpa.spec.maxReplicas;
  
  // 解析指标
  const cpuMetric = hpa.spec.metrics?.find(m => m.type === 'Resource' && m.resource?.name === 'cpu');
  if (cpuMetric) {
    formData.value.targetCPU = cpuMetric.resource?.target.averageUtilization || 0;
  }
  
  const memoryMetric = hpa.spec.metrics?.find(m => m.type === 'Resource' && m.resource?.name === 'memory');
  if (memoryMetric) {
    formData.value.targetMemory = memoryMetric.resource?.target.averageUtilization || 0;
  }
}

watch([() => props.initialData, () => props.mode], ([newData, newMode]) => {
  if (newData && newMode === 'edit') {
    initFromHPA(newData);
    diffConfirmed.value = false;
  }
}, { immediate: true });

onMounted(() => {
  loadDeployments();
  if (props.mode === 'edit' && props.initialData) {
    initFromHPA(props.initialData);
  }
});

// 生成 YAML
const generatedYaml = computed(() => {
  const hpa: any = {
    apiVersion: 'autoscaling/v2',
    kind: 'HorizontalPodAutoscaler',
    metadata: {
      name: formData.value.name,
      namespace: namespace.value,
    },
    spec: {
      scaleTargetRef: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: formData.value.targetName,
      },
      minReplicas: formData.value.minReplicas,
      maxReplicas: formData.value.maxReplicas,
      metrics: [],
    },
  };

  if (formData.value.targetCPU > 0) {
    hpa.spec.metrics.push({
      type: 'Resource',
      resource: {
        name: 'cpu',
        target: {
          type: 'Utilization',
          averageUtilization: formData.value.targetCPU,
        },
      },
    });
  }

  if (formData.value.targetMemory && formData.value.targetMemory > 0) {
    hpa.spec.metrics.push({
      type: 'Resource',
      resource: {
        name: 'memory',
        target: {
          type: 'Utilization',
          averageUtilization: formData.value.targetMemory,
        },
      },
    });
  }

  // 如果没有指标，Kubernetes 会报错，但这里我们至少保证有一个
  if (hpa.spec.metrics.length === 0) {
    // 默认给一个 CPU 80%
    hpa.spec.metrics.push({
      type: 'Resource',
      resource: {
        name: 'cpu',
        target: {
          type: 'Utilization',
          averageUtilization: 80,
        },
      },
    });
  }

  // 如果是在编辑模式，保留原始 metadata 的其他字段（如 labels, annotations）
  if (props.mode === 'edit' && props.initialData) {
    hpa.metadata.labels = props.initialData.metadata.labels;
    // 过滤掉系统注解
    const annotations = { ...props.initialData.metadata.annotations };
    Object.keys(annotations).forEach(key => {
      if (key.startsWith('autoscaling.alpha.kubernetes.io/')) {
        delete annotations[key];
      }
    });
    hpa.metadata.annotations = annotations;
  }

  return yaml.dump(hpa);
});

// 操作方法
async function handlePreviewDiff() {
  const validateResult = await formRef.value?.validate();
  if (validateResult !== true) {
    activeTab.value = 'basic';
    return;
  }

  if (!clusterId.value) return;

  diffLoading.value = true;
  try {
    const res = await diffResource(clusterId.value, {
      namespace: namespace.value || '',
      kind: 'HorizontalPodAutoscaler',
      name: formData.value.name,
      new_yaml: generatedYaml.value,
    });
    diffConfirmed.value = true;
    emit('preview-diff', res);
  } catch (e: any) {
    MessagePlugin.error(`获取 Diff 失败: ${e.message}`);
  } finally {
    diffLoading.value = false;
  }
}

function handleCancel() {
  emit('cancel');
}

function copyYaml() {
  navigator.clipboard.writeText(generatedYaml.value);
  MessagePlugin.success('YAML 已复制到剪贴板');
}
</script>

<style lang="less" scoped>
.hpa-form {
  padding: 8px;

  .form-footer {
    margin-top: 24px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
    position: sticky;
    bottom: 0;
    background: var(--td-bg-color-container);
    padding: 16px 0;
    border-top: 1px solid var(--td-component-stroke);
    z-index: 10;
  }

  .yaml-preview-container {
    background-color: var(--td-bg-color-secondarycontainer);
    border-radius: var(--td-radius-medium);
    padding: 16px;
    position: relative;

    .yaml-actions {
      position: absolute;
      right: 16px;
      top: 16px;
      z-index: 1;
    }

    .yaml-preview {
      margin: 0;
      font-family: Monaco, Menlo, Consolas, 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: var(--td-text-color-primary);
      overflow-x: auto;
      white-space: pre-wrap;
    }
  }

  .form-hint {
    font-size: 12px;
    color: var(--td-text-color-placeholder);
  }
}
</style>
