<template>
  <div class="configmap-form">
    <t-form
      ref="formRef"
      :data="formData"
      :rules="formRules"
      label-align="right"
      :label-width="120"
    >
      <!-- 基本信息 -->
      <t-form-item label="名称" name="name">
        <t-input
          v-model="formData.name"
          placeholder="请输入 ConfigMap 名称"
          :maxlength="253"
          :disabled="mode === 'edit'"
        />
      </t-form-item>

      <!-- 数据 -->
      <t-form-item label="数据项">
        <div class="data-editor">
          <div v-for="(item, index) in formData.data" :key="index" class="data-row">
            <t-input v-model="item.key" placeholder="键" style="width: 200px" />
            <t-textarea
              v-model="item.value"
              placeholder="值"
              :autosize="{ minRows: 1, maxRows: 5 }"
              style="flex: 1"
            />
            <t-button
              theme="danger"
              variant="text"
              size="small"
              @click="removeData(index)"
            >
              <template #icon><delete-icon /></template>
            </t-button>
          </div>
          <t-button variant="outline" size="small" @click="addData">
            <template #icon><add-icon /></template>
            添加数据项
          </t-button>
        </div>
      </t-form-item>

      <!-- YAML 预览 -->
      <t-form-item label="YAML 预览">
        <pre class="yaml-preview">{{ generatedYaml }}</pre>
      </t-form-item>
    </t-form>

    <!-- 底部操作 -->
    <div class="form-footer">
      <t-button theme="default" @click="handleCancel">取消</t-button>
      <t-button theme="primary" @click="handlePreviewDiff" :loading="diffLoading">
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
import { DeleteIcon, AddIcon } from 'tdesign-icons-vue-next';
import { createConfigMap, updateConfigMap, diffResource, type ConfigMap, type ResourceDiffResponse } from '@/api/k8s-resources';
import { useClusterResourceStore } from '@/store/modules/cluster-resource';

interface Props {
  mode?: 'create' | 'edit';
  initialData?: ConfigMap | null;
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  initialData: null,
});

const emit = defineEmits<{
  (e: 'success'): void;
  (e: 'cancel'): void;
  (e: 'preview-diff', data: ResourceDiffResponse): void;
  (e: 'close-form'): void;
}>();

const store = useClusterResourceStore();
const clusterId = computed(() => store.clusterId);
const namespace = computed(() => store.namespace);

const formRef = ref();
const submitting = ref(false);
const diffLoading = ref(false);
const diffConfirmed = ref(false);

const formData = ref({
  name: '',
  data: [{ key: '', value: '' }],
});

const formRules = {
  name: [
    { required: true, message: '请输入 ConfigMap 名称', trigger: 'blur' as const },
  ],
};

// 从现有 ConfigMap 初始化表单
function initFromConfigMap(configMap: ConfigMap) {
  formData.value.name = configMap.metadata.name;
  
  const data = configMap.data || {};
  formData.value.data = Object.entries(data).map(([key, value]) => ({ key, value }));
  if (formData.value.data.length === 0) {
    formData.value.data = [{ key: '', value: '' }];
  }
}

// 监听 initialData 变化
watch([() => props.initialData, () => props.mode], ([newData, newMode]) => {
  if (newData && newMode === 'edit') {
    initFromConfigMap(newData);
    diffConfirmed.value = false;
  }
}, { immediate: true });

onMounted(() => {
  if (props.mode === 'edit' && props.initialData) {
    initFromConfigMap(props.initialData);
  }
});

// 生成 YAML
const generatedYaml = computed(() => {
  const data = Object.fromEntries(
    formData.value.data.filter(d => d.key).map(d => [d.key, d.value])
  );

  // 构建 metadata，编辑模式下保留原始 annotations
  const metadata: any = {
    name: formData.value.name || 'my-configmap',
    namespace: namespace.value,
  };

  // 编辑模式：保留原始 annotations（后端会自动更新 kpa.io/* 注解）
  if (props.mode === 'edit' && props.initialData?.metadata?.annotations) {
    metadata.annotations = { ...props.initialData.metadata.annotations };
  }

  // 编辑模式：保留原始 labels
  if (props.mode === 'edit' && props.initialData?.metadata?.labels) {
    metadata.labels = { ...props.initialData.metadata.labels };
  }

  const configMap = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata,
    data: Object.keys(data).length > 0 ? data : undefined,
  };

  return yaml.dump(configMap, { indent: 2, noRefs: true, sortKeys: true });
});

function addData() {
  formData.value.data.push({ key: '', value: '' });
}

function removeData(index: number) {
  formData.value.data.splice(index, 1);
}

// 预览变更
async function handlePreviewDiff() {
  const valid = await formRef.value?.validate();
  if (valid !== true) return;

  diffLoading.value = true;
  try {
    const configMapName = props.mode === 'edit' && props.initialData 
      ? props.initialData.metadata.name 
      : formData.value.name;
      
    const response = await diffResource(clusterId.value, {
      namespace: namespace.value,
      kind: 'ConfigMap',
      name: configMapName,
      new_yaml: generatedYaml.value,
    });
    emit('preview-diff', response);
  } catch (e: any) {
    MessagePlugin.error(e.message || '预览变更失败');
  } finally {
    diffLoading.value = false;
  }
}

// 确认 Diff 并提交
function confirmDiffAndSubmit() {
  diffConfirmed.value = true;
  handleSubmit();
}

async function handleSubmit() {
  if (!diffConfirmed.value) {
    MessagePlugin.warning('请先预览变更并确认');
    return;
  }

  submitting.value = true;
  try {
    const configMapData = yaml.load(generatedYaml.value) as ConfigMap;
    
    if (props.mode === 'create') {
      await createConfigMap(clusterId.value, namespace.value, configMapData);
      MessagePlugin.success('ConfigMap 创建成功');
    } else {
      await updateConfigMap(clusterId.value, namespace.value, formData.value.name, configMapData);
      MessagePlugin.success('ConfigMap 更新成功');
    }
    
    emit('success');
  } catch (e: any) {
    MessagePlugin.error(e.message || '操作失败');
  } finally {
    submitting.value = false;
  }
}

function handleCancel() {
  emit('cancel');
}

// 导出方法给父组件调用
defineExpose({
  confirmDiffAndSubmit,
});
</script>

<style lang="less" scoped>
.configmap-form {
  .data-editor {
    width: 100%;

    .data-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 8px;
    }
  }

  .yaml-preview {
    width: 100%;
    max-height: 200px;
    overflow: auto;
    padding: 12px;
    background: var(--td-bg-color-page);
    border: 1px solid var(--td-border-level-1-color);
    border-radius: var(--td-radius-default);
    font-family: monospace;
    font-size: 12px;
    margin: 0;
  }

  .form-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--td-border-level-1-color);
  }
}
</style>
