<template>
  <div class="service-form">
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
          placeholder="请输入 Service 名称"
          :maxlength="253"
          :disabled="mode === 'edit'"
        />
      </t-form-item>

      <t-form-item label="服务类型" name="type">
        <t-select v-model="formData.type" style="width: 200px">
          <t-option value="ClusterIP" label="ClusterIP" />
          <t-option value="NodePort" label="NodePort" />
          <t-option value="LoadBalancer" label="LoadBalancer" />
        </t-select>
      </t-form-item>

      <!-- 选择器 -->
      <t-form-item label="选择器">
        <div class="selector-editor">
          <div v-for="(sel, index) in formData.selector" :key="index" class="selector-row">
            <t-input v-model="sel.key" placeholder="键" style="width: 150px" />
            <span class="separator">=</span>
            <t-input v-model="sel.value" placeholder="值" style="width: 150px" />
            <t-button
              theme="danger"
              variant="text"
              size="small"
              @click="removeSelector(index)"
              :disabled="formData.selector.length <= 1"
            >
              <template #icon><delete-icon /></template>
            </t-button>
          </div>
          <t-button variant="outline" size="small" @click="addSelector">
            <template #icon><add-icon /></template>
            添加
          </t-button>
        </div>
      </t-form-item>

      <!-- 端口配置 -->
      <t-form-item label="端口配置">
        <div class="ports-editor">
          <div v-for="(port, index) in formData.ports" :key="index" class="port-row">
            <t-input v-model="port.name" placeholder="名称" style="width: 100px" />
            <t-input-number v-model="port.port" :min="1" :max="65535" placeholder="Port" style="width: 120px" />
            <t-input v-model="port.targetPort" placeholder="TargetPort" style="width: 120px" />
            <t-select v-model="port.protocol" style="width: 80px">
              <t-option value="TCP" label="TCP" />
              <t-option value="UDP" label="UDP" />
            </t-select>
            <t-input-number
              v-if="formData.type === 'NodePort'"
              v-model="port.nodePort"
              :min="30000"
              :max="32767"
              placeholder="NodePort"
              style="width: 120px"
            />
            <t-button
              theme="danger"
              variant="text"
              size="small"
              @click="removePort(index)"
              :disabled="formData.ports.length <= 1"
            >
              <template #icon><delete-icon /></template>
            </t-button>
          </div>
          <t-button variant="outline" size="small" @click="addPort">
            <template #icon><add-icon /></template>
            添加端口
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
import { createService, updateService, diffResource, type Service, type ResourceDiffResponse } from '@/api/k8s-resources';
import { useClusterResourceStore } from '@/store/modules/cluster-resource';

interface Props {
  mode?: 'create' | 'edit';
  initialData?: Service | null;
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
  type: 'ClusterIP',
  selector: [{ key: 'app', value: '' }],
  ports: [{ name: 'http', port: 80, targetPort: '80', protocol: 'TCP', nodePort: undefined as number | undefined }],
});

const formRules = {
  name: [
    { required: true, message: '请输入 Service 名称', trigger: 'blur' as const },
  ],
};

// 从现有 Service 初始化表单
function initFromService(service: Service) {
  formData.value.name = service.metadata.name;
  formData.value.type = service.spec?.type || 'ClusterIP';
  
  // 选择器
  const selector = service.spec?.selector || {};
  formData.value.selector = Object.entries(selector).map(([key, value]) => ({ key, value }));
  if (formData.value.selector.length === 0) {
    formData.value.selector = [{ key: 'app', value: '' }];
  }
  
  // 端口
  const ports = service.spec?.ports || [];
  formData.value.ports = ports.map((p: any) => ({
    name: p.name || '',
    port: p.port,
    targetPort: String(p.targetPort || p.port),
    protocol: p.protocol || 'TCP',
    nodePort: p.nodePort,
  }));
  if (formData.value.ports.length === 0) {
    formData.value.ports = [{ name: 'http', port: 80, targetPort: '80', protocol: 'TCP', nodePort: undefined }];
  }
}

// 监听 initialData 变化
watch([() => props.initialData, () => props.mode], ([newData, newMode]) => {
  if (newData && newMode === 'edit') {
    initFromService(newData);
    diffConfirmed.value = false;
  }
}, { immediate: true });

onMounted(() => {
  if (props.mode === 'edit' && props.initialData) {
    initFromService(props.initialData);
  }
});

// 生成 YAML
const generatedYaml = computed(() => {
  const selector = Object.fromEntries(
    formData.value.selector.filter(s => s.key && s.value).map(s => [s.key, s.value])
  );

  const ports = formData.value.ports.filter(p => p.port).map(p => {
    const port: any = {
      name: p.name || 'port-' + p.port,
      port: p.port,
      targetPort: parseInt(p.targetPort, 10) || p.port,
      protocol: p.protocol,
    };
    if (formData.value.type === 'NodePort' && p.nodePort) {
      port.nodePort = p.nodePort;
    }
    return port;
  });

  // 构建 metadata，编辑模式下保留原始 annotations 和 labels
  const metadata: any = {
    name: formData.value.name || 'my-service',
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

  const service = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata,
    spec: {
      type: formData.value.type,
      selector,
      ports,
    },
  };

  return yaml.dump(service, { indent: 2, noRefs: true, sortKeys: true });
});

function addSelector() {
  formData.value.selector.push({ key: '', value: '' });
}

function removeSelector(index: number) {
  formData.value.selector.splice(index, 1);
}

function addPort() {
  formData.value.ports.push({ name: '', port: 8080, targetPort: '8080', protocol: 'TCP', nodePort: undefined });
}

function removePort(index: number) {
  formData.value.ports.splice(index, 1);
}

// 预览变更
async function handlePreviewDiff() {
  const valid = await formRef.value?.validate();
  if (valid !== true) return;

  diffLoading.value = true;
  try {
    const serviceName = props.mode === 'edit' && props.initialData 
      ? props.initialData.metadata.name 
      : formData.value.name;
      
    const response = await diffResource(clusterId.value, {
      namespace: namespace.value,
      kind: 'Service',
      name: serviceName,
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
    const serviceData = yaml.load(generatedYaml.value) as Service;
    
    if (props.mode === 'create') {
      await createService(clusterId.value, namespace.value, serviceData);
      MessagePlugin.success('Service 创建成功');
    } else {
      await updateService(clusterId.value, namespace.value, formData.value.name, serviceData);
      MessagePlugin.success('Service 更新成功');
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
.service-form {
  .selector-editor,
  .ports-editor {
    .selector-row,
    .port-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .separator {
      color: var(--td-text-color-secondary);
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
