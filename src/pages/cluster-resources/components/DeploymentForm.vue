<template>
  <div class="deployment-form">
    <t-tabs v-model="activeTab">
      <!-- 基本信息 -->
      <t-tab-panel value="basic" label="基本信息">
        <t-form
          ref="basicFormRef"
          :data="formData"
          :rules="basicRules"
          label-align="right"
          :label-width="120"
        >
          <t-form-item label="名称" name="name">
            <t-input
              v-model="formData.name"
              placeholder="请输入 Deployment 名称"
              :maxlength="253"
              :disabled="mode === 'edit'"
            />
          </t-form-item>

          <t-form-item label="副本数" name="replicas">
            <t-input-number
              v-model="formData.replicas"
              :min="0"
              :max="100"
              theme="normal"
            />
          </t-form-item>

          <t-form-item label="标签">
            <div class="labels-editor">
              <div
                v-for="(label, index) in formData.labels"
                :key="index"
                class="label-row"
              >
                <t-input
                  v-model="label.key"
                  placeholder="键"
                  style="width: 150px"
                />
                <span class="label-separator">=</span>
                <t-input
                  v-model="label.value"
                  placeholder="值"
                  style="width: 150px"
                />
                <t-button
                  theme="danger"
                  variant="text"
                  size="small"
                  @click="removeLabel(index)"
                  :disabled="formData.labels.length <= 1"
                >
                  <template #icon><delete-icon /></template>
                </t-button>
              </div>
              <t-button variant="outline" size="small" @click="addLabel">
                <template #icon><add-icon /></template>
                添加标签
              </t-button>
            </div>
          </t-form-item>
        </t-form>
      </t-tab-panel>

      <!-- 容器配置 -->
      <t-tab-panel value="container" label="容器配置">
        <div v-for="(container, cIdx) in formData.containers" :key="cIdx" class="container-section">
          <t-divider v-if="cIdx > 0" />
          <div class="container-header">
            <h4>容器 {{ cIdx + 1 }}</h4>
            <t-button
              v-if="formData.containers.length > 1"
              theme="danger"
              variant="text"
              size="small"
              @click="removeContainer(cIdx)"
            >
              删除容器
            </t-button>
          </div>

          <t-form :data="container" label-align="right" :label-width="120">
            <t-form-item label="容器名称">
              <t-input v-model="container.name" placeholder="请输入容器名称" />
            </t-form-item>

            <t-form-item label="镜像">
              <t-input v-model="container.image" placeholder="例如: nginx:1.21" />
            </t-form-item>

            <t-form-item label="拉取策略">
              <t-select v-model="container.imagePullPolicy" style="width: 200px">
                <t-option value="IfNotPresent" label="IfNotPresent" />
                <t-option value="Always" label="Always" />
                <t-option value="Never" label="Never" />
              </t-select>
            </t-form-item>

            <!-- 端口配置 -->
            <t-form-item label="端口">
              <div class="ports-editor">
                <div v-for="(port, pIdx) in container.ports" :key="pIdx" class="port-row">
                  <t-input-number
                    v-model="port.containerPort"
                    :min="1"
                    :max="65535"
                    placeholder="端口"
                    style="width: 120px"
                  />
                  <t-select v-model="port.protocol" style="width: 100px">
                    <t-option value="TCP" label="TCP" />
                    <t-option value="UDP" label="UDP" />
                  </t-select>
                  <t-button
                    theme="danger"
                    variant="text"
                    size="small"
                    @click="removePort(cIdx, pIdx)"
                  >
                    <template #icon><delete-icon /></template>
                  </t-button>
                </div>
                <t-button variant="outline" size="small" @click="addPort(cIdx)">
                  <template #icon><add-icon /></template>
                  添加端口
                </t-button>
              </div>
            </t-form-item>

            <!-- 环境变量 -->
            <t-form-item label="环境变量">
              <div class="env-editor">
                <div v-for="(env, eIdx) in container.env" :key="eIdx" class="env-row">
                  <t-input v-model="env.name" placeholder="变量名" style="width: 150px" />
                  <span class="env-separator">=</span>
                  <t-input v-model="env.value" placeholder="值" style="width: 200px" />
                  <t-button
                    theme="danger"
                    variant="text"
                    size="small"
                    @click="removeEnv(cIdx, eIdx)"
                  >
                    <template #icon><delete-icon /></template>
                  </t-button>
                </div>
                <t-button variant="outline" size="small" @click="addEnv(cIdx)">
                  <template #icon><add-icon /></template>
                  添加环境变量
                </t-button>
              </div>
            </t-form-item>

            <!-- envFrom: 从 ConfigMap 注入所有环境变量 -->
            <t-form-item label="ConfigMap 环境变量">
              <div class="envfrom-editor">
                <div v-for="(ef, efIdx) in container.envFrom" :key="efIdx" class="envfrom-row">
                  <t-select 
                    v-model="ef.configMapName" 
                    placeholder="选择 ConfigMap（注入所有 Key）" 
                    style="width: 300px"
                  >
                    <t-option 
                      v-for="cm in configMapList" 
                      :key="cm.metadata.name" 
                      :value="cm.metadata.name" 
                      :label="cm.metadata.name" 
                    />
                  </t-select>
                  <t-button
                    theme="danger"
                    variant="text"
                    size="small"
                    @click="removeEnvFrom(cIdx, efIdx)"
                  >
                    <template #icon><delete-icon /></template>
                  </t-button>
                </div>
                <t-button variant="outline" size="small" @click="addEnvFrom(cIdx)">
                  <template #icon><add-icon /></template>
                  从 ConfigMap 注入
                </t-button>
                <span class="form-hint" style="margin-left: 8px;">ConfigMap 的所有 Key 将作为环境变量注入</span>
              </div>
            </t-form-item>

            <!-- ConfigMap 卷挂载 -->
            <t-form-item label="ConfigMap 卷挂载">
              <div class="volume-editor">
                <div v-for="(mount, mIdx) in container.volumeMounts" :key="mIdx" class="volume-row">
                  <t-select 
                    v-model="mount.configMapName" 
                    placeholder="选择 ConfigMap" 
                    style="width: 200px"
                  >
                    <t-option 
                      v-for="cm in configMapList" 
                      :key="cm.metadata.name" 
                      :value="cm.metadata.name" 
                      :label="cm.metadata.name" 
                    />
                  </t-select>
                  <t-input v-model="mount.mountPath" placeholder="挂载路径 (如: /etc/config)" style="width: 200px" />
                  <t-button
                    theme="danger"
                    variant="text"
                    size="small"
                    @click="removeVolumeMount(cIdx, mIdx)"
                  >
                    <template #icon><delete-icon /></template>
                  </t-button>
                </div>
                <t-button variant="outline" size="small" @click="addVolumeMount(cIdx)">
                  <template #icon><add-icon /></template>
                  添加卷挂载
                </t-button>
                <span class="form-hint" style="margin-left: 8px;">将 ConfigMap 挂载为目录</span>
              </div>
            </t-form-item>


            <!-- 资源配额 -->
            <t-form-item label="CPU Request">
              <t-input v-model="container.resources.requests.cpu" placeholder="例如: 100m" style="width: 150px" />
            </t-form-item>
            <t-form-item label="CPU Limit">
              <t-input v-model="container.resources.limits.cpu" placeholder="例如: 500m" style="width: 150px" />
            </t-form-item>
            <t-form-item label="Memory Request">
              <t-input v-model="container.resources.requests.memory" placeholder="例如: 128Mi" style="width: 150px" />
            </t-form-item>
            <t-form-item label="Memory Limit">
              <t-input v-model="container.resources.limits.memory" placeholder="例如: 512Mi" style="width: 150px" />
            </t-form-item>
          </t-form>
        </div>

        <t-button variant="dashed" block @click="addContainer" style="margin-top: 16px">
          <template #icon><add-icon /></template>
          添加容器
        </t-button>
      </t-tab-panel>

      <!-- 健康检查 -->
      <t-tab-panel value="health" label="健康检查">
        <t-collapse>
          <!-- Liveness Probe -->
          <t-collapse-panel header="存活探针 (Liveness Probe)" value="liveness">
            <t-form :data="formData.livenessProbe" label-align="right" :label-width="120">
              <t-form-item label="启用">
                <t-switch v-model="formData.livenessProbe.enabled" />
              </t-form-item>
              <template v-if="formData.livenessProbe.enabled">
                <t-form-item label="探测类型">
                  <t-radio-group v-model="formData.livenessProbe.type">
                    <t-radio-button value="httpGet">HTTP</t-radio-button>
                    <t-radio-button value="tcpSocket">TCP</t-radio-button>
                    <t-radio-button value="exec">Exec</t-radio-button>
                  </t-radio-group>
                </t-form-item>
                <template v-if="formData.livenessProbe.type === 'httpGet'">
                  <t-form-item label="路径">
                    <t-input v-model="formData.livenessProbe.httpGet.path" placeholder="/" />
                  </t-form-item>
                  <t-form-item label="端口">
                    <t-input-number v-model="formData.livenessProbe.httpGet.port" :min="1" :max="65535" />
                  </t-form-item>
                </template>
                <template v-if="formData.livenessProbe.type === 'tcpSocket'">
                  <t-form-item label="端口">
                    <t-input-number v-model="formData.livenessProbe.tcpSocket.port" :min="1" :max="65535" />
                  </t-form-item>
                </template>
                <template v-if="formData.livenessProbe.type === 'exec'">
                  <t-form-item label="命令">
                    <t-input v-model="formData.livenessProbe.exec.command" placeholder="例如: cat /tmp/healthy" />
                  </t-form-item>
                </template>
                <t-form-item label="初始延迟 (秒)">
                  <t-input-number v-model="formData.livenessProbe.initialDelaySeconds" :min="0" />
                </t-form-item>
                <t-form-item label="检查周期 (秒)">
                  <t-input-number v-model="formData.livenessProbe.periodSeconds" :min="1" />
                </t-form-item>
              </template>
            </t-form>
          </t-collapse-panel>

          <!-- Readiness Probe -->
          <t-collapse-panel header="就绪探针 (Readiness Probe)" value="readiness">
            <t-form :data="formData.readinessProbe" label-align="right" :label-width="120">
              <t-form-item label="启用">
                <t-switch v-model="formData.readinessProbe.enabled" />
              </t-form-item>
              <template v-if="formData.readinessProbe.enabled">
                <t-form-item label="探测类型">
                  <t-radio-group v-model="formData.readinessProbe.type">
                    <t-radio-button value="httpGet">HTTP</t-radio-button>
                    <t-radio-button value="tcpSocket">TCP</t-radio-button>
                    <t-radio-button value="exec">Exec</t-radio-button>
                  </t-radio-group>
                </t-form-item>
                <template v-if="formData.readinessProbe.type === 'httpGet'">
                  <t-form-item label="路径">
                    <t-input v-model="formData.readinessProbe.httpGet.path" placeholder="/" />
                  </t-form-item>
                  <t-form-item label="端口">
                    <t-input-number v-model="formData.readinessProbe.httpGet.port" :min="1" :max="65535" />
                  </t-form-item>
                </template>
                <template v-if="formData.readinessProbe.type === 'tcpSocket'">
                  <t-form-item label="端口">
                    <t-input-number v-model="formData.readinessProbe.tcpSocket.port" :min="1" :max="65535" />
                  </t-form-item>
                </template>
                <template v-if="formData.readinessProbe.type === 'exec'">
                  <t-form-item label="命令">
                    <t-input v-model="formData.readinessProbe.exec.command" placeholder="例如: cat /tmp/ready" />
                  </t-form-item>
                </template>
                <t-form-item label="初始延迟 (秒)">
                  <t-input-number v-model="formData.readinessProbe.initialDelaySeconds" :min="0" />
                </t-form-item>
                <t-form-item label="检查周期 (秒)">
                  <t-input-number v-model="formData.readinessProbe.periodSeconds" :min="1" />
                </t-form-item>
              </template>
            </t-form>
          </t-collapse-panel>
        </t-collapse>
      </t-tab-panel>

      <!-- 高级配置 -->
      <t-tab-panel value="advanced" label="高级配置">
        <t-form :data="formData.strategy" label-align="right" :label-width="120">
          <t-form-item label="更新策略">
            <t-select v-model="formData.strategy.type" style="width: 200px">
              <t-option value="RollingUpdate" label="滚动更新 (RollingUpdate)" />
              <t-option value="Recreate" label="重建 (Recreate)" />
            </t-select>
          </t-form-item>

          <template v-if="formData.strategy.type === 'RollingUpdate'">
            <t-form-item label="maxSurge">
              <t-input v-model="formData.strategy.rollingUpdate.maxSurge" placeholder="1 或 25%" style="width: 150px" />
              <span class="form-hint">超出期望副本数的最大数量</span>
            </t-form-item>
            <t-form-item label="maxUnavailable">
              <t-input v-model="formData.strategy.rollingUpdate.maxUnavailable" placeholder="0 或 25%" style="width: 150px" />
              <span class="form-hint">更新过程中不可用副本的最大数量</span>
            </t-form-item>
          </template>
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
import { DeleteIcon, AddIcon, FileCopyIcon } from 'tdesign-icons-vue-next';
import { createDeployment, updateDeployment, diffResource, getConfigMaps, type Deployment, type ResourceDiffResponse, type ConfigMap } from '@/api/k8s-resources';
import { useClusterResourceStore } from '@/store/modules/cluster-resource';

// Props
interface Props {
  mode?: 'create' | 'edit';
  initialData?: Deployment | null;
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
const submitting = ref(false);
const diffLoading = ref(false);
const basicFormRef = ref();
const diffConfirmed = ref(false);

// ConfigMap 列表
const configMapList = ref<ConfigMap[]>([]);

// 加载 ConfigMap 列表
async function loadConfigMaps() {
  if (!clusterId.value || !namespace.value) return;
  try {
    const res = await getConfigMaps(clusterId.value, namespace.value);
    configMapList.value = res.items || [];
  } catch (e) {
    console.error('Failed to load ConfigMaps:', e);
  }
}

// 容器类型定义
interface ContainerFormData {
  name: string;
  image: string;
  imagePullPolicy: string;
  ports: Array<{ containerPort: number; protocol: string }>;
  env: Array<{ name: string; value: string }>;
  envFrom: Array<{ configMapName: string }>;
  volumeMounts: Array<{ configMapName: string; mountPath: string }>;
  resources: {
    requests: { cpu: string; memory: string };
    limits: { cpu: string; memory: string };
  };
}

// 创建空容器
function createEmptyContainer(): ContainerFormData {
  return {
    name: '',
    image: '',
    imagePullPolicy: 'IfNotPresent',
    ports: [{ containerPort: 80, protocol: 'TCP' }],
    env: [],
    envFrom: [],
    volumeMounts: [],
    resources: {
      requests: { cpu: '100m', memory: '128Mi' },
      limits: { cpu: '500m', memory: '512Mi' },
    },
  };
}

// 表单数据
const formData = ref({
  name: '',
  replicas: 1,
  labels: [{ key: 'app', value: '' }],
  containers: [createEmptyContainer()],
  livenessProbe: {
    enabled: false,
    type: 'httpGet',
    httpGet: { path: '/', port: 80 },
    tcpSocket: { port: 80 },
    exec: { command: '' },
    initialDelaySeconds: 10,
    periodSeconds: 10,
  },
  readinessProbe: {
    enabled: false,
    type: 'httpGet',
    httpGet: { path: '/', port: 80 },
    tcpSocket: { port: 80 },
    exec: { command: '' },
    initialDelaySeconds: 5,
    periodSeconds: 10,
  },
  strategy: {
    type: 'RollingUpdate',
    rollingUpdate: {
      maxSurge: '1',
      maxUnavailable: '0',
    },
  },
});

// 表单验证规则
const basicRules = {
  name: [
    { required: true, message: '请输入 Deployment 名称', trigger: 'blur' as const },
    { pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, message: '名称只能包含小写字母、数字和连字符', trigger: 'blur' as const },
  ],
};

// 自动填充容器名和 app 标签
watch(() => formData.value.name, (newName) => {
  if (props.mode === 'create' && newName && formData.value.containers[0]) {
    if (!formData.value.containers[0].name) {
      formData.value.containers[0].name = newName;
    }
    const appLabel = formData.value.labels.find(l => l.key === 'app');
    if (appLabel && !appLabel.value) {
      appLabel.value = newName;
    }
  }
});

// 从现有 Deployment 初始化表单
function initFromDeployment(deployment: Deployment) {
  formData.value.name = deployment.metadata.name;
  formData.value.replicas = deployment.spec?.replicas || 1;
  
  // 标签
  const labels = deployment.metadata.labels || {};
  formData.value.labels = Object.entries(labels).map(([key, value]) => ({ key, value }));
  if (formData.value.labels.length === 0) {
    formData.value.labels = [{ key: 'app', value: '' }];
  }
  
  // 容器
  const containers = deployment.spec?.template?.spec?.containers || [];
  formData.value.containers = containers.map((c: any) => ({
    name: c.name || '',
    image: c.image || '',
    imagePullPolicy: c.imagePullPolicy || 'IfNotPresent',
    ports: (c.ports || []).map((p: any) => ({
      containerPort: p.containerPort || 80,
      protocol: p.protocol || 'TCP',
    })),
    // 只保留直接值的环境变量
    env: (c.env || []).filter((e: any) => !e.valueFrom).map((e: any) => ({
      name: e.name || '',
      value: e.value || '',
    })),
    // 解析 envFrom（从 ConfigMap 注入）
    envFrom: (c.envFrom || []).filter((ef: any) => ef.configMapRef).map((ef: any) => ({
      configMapName: ef.configMapRef?.name || '',
    })),
    volumeMounts: (c.volumeMounts || []).filter((vm: any) => {
      // 只保留 ConfigMap 卷挂载
      const volume = deployment.spec?.template?.spec?.volumes?.find((v: any) => v.name === vm.name);
      return volume?.configMap;
    }).map((vm: any) => {
      const volume = deployment.spec?.template?.spec?.volumes?.find((v: any) => v.name === vm.name);
      return {
        configMapName: volume?.configMap?.name || '',
        mountPath: vm.mountPath || '',
      };
    }),
    resources: {
      requests: {
        cpu: c.resources?.requests?.cpu || '100m',
        memory: c.resources?.requests?.memory || '128Mi',
      },
      limits: {
        cpu: c.resources?.limits?.cpu || '500m',
        memory: c.resources?.limits?.memory || '512Mi',
      },
    },
  }));
  if (formData.value.containers.length === 0) {
    formData.value.containers = [createEmptyContainer()];
  }
  
  // Liveness Probe
  const firstContainer = containers[0];
  if (firstContainer?.livenessProbe) {
    const lp = firstContainer.livenessProbe;
    formData.value.livenessProbe.enabled = true;
    if (lp.httpGet) {
      formData.value.livenessProbe.type = 'httpGet';
      formData.value.livenessProbe.httpGet.path = lp.httpGet.path || '/';
      formData.value.livenessProbe.httpGet.port = lp.httpGet.port || 80;
    } else if (lp.tcpSocket) {
      formData.value.livenessProbe.type = 'tcpSocket';
      formData.value.livenessProbe.tcpSocket.port = lp.tcpSocket.port || 80;
    } else if (lp.exec) {
      formData.value.livenessProbe.type = 'exec';
      formData.value.livenessProbe.exec.command = (lp.exec.command || []).join(' ');
    }
    formData.value.livenessProbe.initialDelaySeconds = lp.initialDelaySeconds || 10;
    formData.value.livenessProbe.periodSeconds = lp.periodSeconds || 10;
  }
  
  // Readiness Probe
  if (firstContainer?.readinessProbe) {
    const rp = firstContainer.readinessProbe;
    formData.value.readinessProbe.enabled = true;
    if (rp.httpGet) {
      formData.value.readinessProbe.type = 'httpGet';
      formData.value.readinessProbe.httpGet.path = rp.httpGet.path || '/';
      formData.value.readinessProbe.httpGet.port = rp.httpGet.port || 80;
    } else if (rp.tcpSocket) {
      formData.value.readinessProbe.type = 'tcpSocket';
      formData.value.readinessProbe.tcpSocket.port = rp.tcpSocket.port || 80;
    } else if (rp.exec) {
      formData.value.readinessProbe.type = 'exec';
      formData.value.readinessProbe.exec.command = (rp.exec.command || []).join(' ');
    }
    formData.value.readinessProbe.initialDelaySeconds = rp.initialDelaySeconds || 5;
    formData.value.readinessProbe.periodSeconds = rp.periodSeconds || 10;
  }
  
  // 更新策略
  const strategy = deployment.spec?.strategy;
  if (strategy) {
    formData.value.strategy.type = strategy.type || 'RollingUpdate';
    if (strategy.rollingUpdate) {
      formData.value.strategy.rollingUpdate.maxSurge = String(strategy.rollingUpdate.maxSurge || '1');
      formData.value.strategy.rollingUpdate.maxUnavailable = String(strategy.rollingUpdate.maxUnavailable || '0');
    }
  }
}

// 监听 initialData 和 mode 变化
watch([() => props.initialData, () => props.mode], ([newData, newMode]) => {
  if (newData && newMode === 'edit') {
    initFromDeployment(newData);
    diffConfirmed.value = false;
  }
}, { immediate: true });

// 组件挂载时确保初始化
onMounted(() => {
  loadConfigMaps();
  if (props.mode === 'edit' && props.initialData) {
    initFromDeployment(props.initialData);
  }
});

// 生成 YAML
const generatedYaml = computed(() => {
  // 编辑模式：基于原始数据修改
  if (props.mode === 'edit' && props.initialData) {
    return generateEditYaml();
  }
  // 创建模式：完全新建
  return generateCreateYaml();
});

// 编辑模式：基于原始数据修改，保留所有原始字段，确保字段顺序与后端一致
function generateEditYaml(): string {
  if (!props.initialData) return '';
  
  const original: any = props.initialData;
  
  // 按 K8s 标准字段顺序构建对象
  // 顺序: apiVersion, kind, metadata, spec
  
  // 标签
  const labels = Object.fromEntries(
    formData.value.labels.filter(l => l.key && l.value).map(l => [l.key, l.value])
  );
  
  // 清理 metadata：保留原始字段但移除系统字段
  const cleanedMetadata: any = {
    name: original.metadata.name,
    namespace: original.metadata.namespace,
  };
  
  // 添加标签
  cleanedMetadata.labels = labels;
  
  // 保留 annotations（但清理系统注解）
  if (original.metadata.annotations) {
    const annotations: any = {};
    for (const [key, value] of Object.entries(original.metadata.annotations)) {
      if (!key.startsWith('deployment.kubernetes.io/') && 
          !key.startsWith('kubectl.kubernetes.io/')) {
        annotations[key] = value;
      }
    }
    if (Object.keys(annotations).length > 0) {
      cleanedMetadata.annotations = annotations;
    }
  }
  
  // 构建容器配置
  const originalContainers = original.spec?.template?.spec?.containers || [];
  const containers = originalContainers.map((c: any, idx: number) => {
    const formContainer = formData.value.containers[idx];
    if (!formContainer) return c;
    
    // 按照原始容器的字段顺序构建
    const container: any = {
      name: formContainer.name || c.name,
      image: formContainer.image || c.image,
    };
    
    // 保留原始命令
    if (c.command) container.command = c.command;
    if (c.args) container.args = c.args;
    if (c.workingDir) container.workingDir = c.workingDir;
    
    // 端口：完全由表单决定
    const allPorts = formContainer.ports.filter(p => p.containerPort).map(p => ({
      containerPort: p.containerPort,
      protocol: p.protocol,
    }));
    // 保留非表单管理的端口 (如果有的话，目前表单接管了所有端口配置)
    if (allPorts.length > 0) {
      container.ports = allPorts;
    } else if (c.ports) {
      // 如果表单为空，且原始有数据，检查是否需要保留（这里简单处理，如果表单清空了就清空）
      // 如果业务上需要保留非表单支持的字段，则需要更细粒度的过滤
      container.ports = []; 
    }
    
    // 环境变量：完全由表单决定（针对直接键值对类型）
    const formEnv = (formContainer.env || []).filter(e => e.name).map(e => ({
      name: e.name,
      value: e.value,
    }));
    // 过滤掉原始数据中属于表单管理范围的 env（即非 valueFrom 的）
    const origOtherEnv = (c.env || []).filter((e: any) => e.valueFrom);
    const allEnv = [...origOtherEnv, ...formEnv];
    if (allEnv.length > 0) {
      container.env = allEnv;
    } else if (c.env) {
      container.env = [];
    }
    
    // envFrom（从 ConfigMap 注入所有环境变量）：完全由表单决定
    const formEnvFrom = (formContainer.envFrom || []).filter(ef => ef.configMapName).map(ef => ({
      configMapRef: {
        name: ef.configMapName
      }
    }));
    // 过滤掉原始数据中的 ConfigMapRef，保留 SecretRef 等其他类型
    const origOtherEnvFrom = (c.envFrom || []).filter((ef: any) => !ef.configMapRef);
    const allEnvFrom = [...origOtherEnvFrom, ...formEnvFrom];
    if (allEnvFrom.length > 0) {
      container.envFrom = allEnvFrom;
    } else if (c.envFrom) {
      container.envFrom = [];
    }
    
    // 资源
    container.resources = {
      limits: {
        cpu: formContainer.resources.limits.cpu || c.resources?.limits?.cpu,
        memory: formContainer.resources.limits.memory || c.resources?.limits?.memory,
      },
      requests: {
        cpu: formContainer.resources.requests.cpu || c.resources?.requests?.cpu,
        memory: formContainer.resources.requests.memory || c.resources?.requests?.memory,
      },
    };
    
    // 健康检查 - 在编辑模式下保留原始完整配置
    if (c.livenessProbe) {
      // 原本有探针，保留完整配置并更新用户编辑的字段
      container.livenessProbe = { ...c.livenessProbe };
      if (formData.value.livenessProbe.enabled) {
        // 只更新用户在表单中可编辑的字段
        container.livenessProbe.initialDelaySeconds = formData.value.livenessProbe.initialDelaySeconds;
        container.livenessProbe.periodSeconds = formData.value.livenessProbe.periodSeconds;
        if (formData.value.livenessProbe.type === 'httpGet') {
          container.livenessProbe.httpGet = {
            ...container.livenessProbe.httpGet,
            path: formData.value.livenessProbe.httpGet.path,
            port: formData.value.livenessProbe.httpGet.port,
          };
        }
      }
    } else if (formData.value.livenessProbe.enabled) {
      // 原本没有探针，用户新增
      container.livenessProbe = buildProbe(formData.value.livenessProbe);
    }
    
    if (c.readinessProbe) {
      // 原本有探针，保留完整配置
      container.readinessProbe = { ...c.readinessProbe };
      if (formData.value.readinessProbe.enabled) {
        container.readinessProbe.initialDelaySeconds = formData.value.readinessProbe.initialDelaySeconds;
        container.readinessProbe.periodSeconds = formData.value.readinessProbe.periodSeconds;
        if (formData.value.readinessProbe.type === 'httpGet') {
          container.readinessProbe.httpGet = {
            ...container.readinessProbe.httpGet,
            path: formData.value.readinessProbe.httpGet.path,
            port: formData.value.readinessProbe.httpGet.port,
          };
        }
      }
    } else if (formData.value.readinessProbe.enabled) {
      // 原本没有探针，用户新增
      container.readinessProbe = buildProbe(formData.value.readinessProbe);
    }
    
    // 保留其他原始字段
    if (c.imagePullPolicy) container.imagePullPolicy = formContainer.imagePullPolicy || c.imagePullPolicy;
    if (c.terminationMessagePath) container.terminationMessagePath = c.terminationMessagePath;
    if (c.terminationMessagePolicy) container.terminationMessagePolicy = c.terminationMessagePolicy;
    
    // 处理 volumeMounts：完全由表单决定 ConfigMap 类型的挂载
    const origVolumeMounts = c.volumeMounts || [];
    const formVolumeMounts = (formContainer.volumeMounts || []).filter(vm => vm.configMapName && vm.mountPath).map(vm => ({
      name: `configmap-${vm.configMapName}`,
      mountPath: vm.mountPath,
    }));
    
    // 过滤掉所有原始中的 ConfigMap 挂载，因为它们已经由表单接管
    const filteredOrigMounts = origVolumeMounts.filter((vm: any) => {
      // 检查该挂载对应的卷是否是 ConfigMap 类型
      const volume = original.spec?.template?.spec?.volumes?.find((v: any) => v.name === vm.name);
      return !volume?.configMap; // 仅保留非 ConfigMap 的挂载
    });
    
    const allVolumeMounts = [...filteredOrigMounts, ...formVolumeMounts];
    if (allVolumeMounts.length > 0) {
      container.volumeMounts = allVolumeMounts;
    }
    
    if (c.securityContext) container.securityContext = c.securityContext;
    
    return container;
  });
  
  // 构建 spec.template.spec
  const templateSpec: any = {
    containers,
  };
  
  // 保留原始 template.spec 的其他字段
  const origTemplateSpec = original.spec?.template?.spec || {};
  if (origTemplateSpec.restartPolicy) templateSpec.restartPolicy = origTemplateSpec.restartPolicy;
  if (origTemplateSpec.terminationGracePeriodSeconds !== undefined) {
    templateSpec.terminationGracePeriodSeconds = origTemplateSpec.terminationGracePeriodSeconds;
  }
  if (origTemplateSpec.dnsPolicy) templateSpec.dnsPolicy = origTemplateSpec.dnsPolicy;
  if (origTemplateSpec.serviceAccountName) templateSpec.serviceAccountName = origTemplateSpec.serviceAccountName;
  if (origTemplateSpec.serviceAccount) templateSpec.serviceAccount = origTemplateSpec.serviceAccount;
  if (origTemplateSpec.securityContext) templateSpec.securityContext = origTemplateSpec.securityContext;
  if (origTemplateSpec.schedulerName) templateSpec.schedulerName = origTemplateSpec.schedulerName;
  // 处理 volumes：合并原始 volumes 和表单中的 ConfigMap volumes
  const origVolumes = origTemplateSpec.volumes || [];
  const formConfigMapNames = new Set<string>();
  formData.value.containers.forEach(c => {
    (c.volumeMounts || []).forEach(vm => {
      if (vm.configMapName) {
        formConfigMapNames.add(vm.configMapName);
      }
    });
  });
  // 过滤掉已被表单替换的 ConfigMap volumes，保留其他类型 volumes
  const filteredOrigVolumes = origVolumes.filter((v: any) => {
    if (v.configMap?.name) {
      // 原始的 ConfigMap volume，检查是否仍在表单中
      return formConfigMapNames.has(v.configMap.name);
    }
    return true; // 保留非 ConfigMap 的 volume
  });
  // 生成新的 ConfigMap volumes
  const newConfigMapVolumes = Array.from(formConfigMapNames)
    .filter(cmName => !filteredOrigVolumes.some((v: any) => v.configMap?.name === cmName))
    .map(cmName => ({
      name: `configmap-${cmName}`,
      configMap: { name: cmName },
    }));
  const allVolumes = [...filteredOrigVolumes, ...newConfigMapVolumes];
  if (allVolumes.length > 0) {
    templateSpec.volumes = allVolumes;
  }
  
  // 构建 spec.template.metadata
  const templateMetadata: any = {
    labels,
  };
  if (original.spec?.template?.metadata?.annotations) {
    templateMetadata.annotations = original.spec.template.metadata.annotations;
  }
  
  // 构建 spec
  const spec: any = {
    replicas: formData.value.replicas,
    selector: {
      matchLabels: labels,
    },
  };
  
  // 添加 template
  spec.template = {
    metadata: templateMetadata,
    spec: templateSpec,
  };
  
  // 添加策略
  if (formData.value.strategy.type === 'RollingUpdate') {
    spec.strategy = {
      type: 'RollingUpdate',
      rollingUpdate: {
        maxSurge: parseStrategyValue(formData.value.strategy.rollingUpdate.maxSurge),
        maxUnavailable: parseStrategyValue(formData.value.strategy.rollingUpdate.maxUnavailable),
      },
    };
  } else {
    spec.strategy = { type: 'Recreate' };
  }
  
  // 保留原始 spec 的其他字段
  if (original.spec?.revisionHistoryLimit !== undefined) {
    spec.revisionHistoryLimit = original.spec.revisionHistoryLimit;
  }
  if (original.spec?.progressDeadlineSeconds !== undefined) {
    spec.progressDeadlineSeconds = original.spec.progressDeadlineSeconds;
  }
  
  // 最终按标准顺序构建 Deployment 对象
  const deployment = {
    apiVersion: original.apiVersion || 'apps/v1',
    kind: original.kind || 'Deployment',
    metadata: cleanedMetadata,
    spec,
  };
  
  return yaml.dump(deployment, { indent: 2, sortKeys: true, noRefs: true });
}

// 创建模式：完全新建
function generateCreateYaml(): string {
  const labels = Object.fromEntries(
    formData.value.labels.filter(l => l.key && l.value).map(l => [l.key, l.value])
  );

  const containers = formData.value.containers.map(c => {
    const container: any = {
      name: c.name || 'container',
      image: c.image || 'nginx:latest',
      imagePullPolicy: c.imagePullPolicy,
    };

    if (c.ports.length > 0) {
      container.ports = c.ports.filter(p => p.containerPort).map(p => ({
        containerPort: p.containerPort,
        protocol: p.protocol,
      }));
    }

    // 环境变量（普通 key=value）
    const envVars = c.env.filter((e: any) => e.name).map((e: any) => ({
      name: e.name,
      value: e.value,
    }));
    if (envVars.length > 0) {
      container.env = envVars;
    }

    // envFrom（从 ConfigMap 注入所有环境变量）
    const envFromList = (c.envFrom || []).filter((ef: any) => ef.configMapName).map((ef: any) => ({
      configMapRef: {
        name: ef.configMapName
      }
    }));
    if (envFromList.length > 0) {
      container.envFrom = envFromList;
    }

    const resources: any = { requests: {}, limits: {} };
    if (c.resources.requests.cpu) resources.requests.cpu = c.resources.requests.cpu;
    if (c.resources.requests.memory) resources.requests.memory = c.resources.requests.memory;
    if (c.resources.limits.cpu) resources.limits.cpu = c.resources.limits.cpu;
    if (c.resources.limits.memory) resources.limits.memory = c.resources.limits.memory;
    if (Object.keys(resources.requests).length > 0 || Object.keys(resources.limits).length > 0) {
      container.resources = resources;
    }

    if (formData.value.livenessProbe.enabled) {
      container.livenessProbe = buildProbe(formData.value.livenessProbe);
    }

    if (formData.value.readinessProbe.enabled) {
      container.readinessProbe = buildProbe(formData.value.readinessProbe);
    }

    // Volume 挂载
    if (c.volumeMounts && c.volumeMounts.length > 0) {
      container.volumeMounts = c.volumeMounts.filter(vm => vm.configMapName && vm.mountPath).map(vm => ({
        name: `configmap-${vm.configMapName}`,
        mountPath: vm.mountPath,
      }));
    }

    return container;
  });

  // 收集所有 ConfigMap volumes
  const volumeSet = new Set<string>();
  formData.value.containers.forEach(c => {
    (c.volumeMounts || []).forEach(vm => {
      if (vm.configMapName) {
        volumeSet.add(vm.configMapName);
      }
    });
  });
  const volumes = Array.from(volumeSet).map(configMapName => ({
    name: `configmap-${configMapName}`,
    configMap: {
      name: configMapName,
    },
  }));

  const templateSpec: any = { containers };
  if (volumes.length > 0) {
    templateSpec.volumes = volumes;
  }

  const deployment: any = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: formData.value.name || 'my-deployment',
      namespace: namespace.value,
      labels,
    },
    spec: {
      replicas: formData.value.replicas,
      selector: {
        matchLabels: labels,
      },
      template: {
        metadata: { labels },
        spec: templateSpec,
      },
    },
  };

  if (formData.value.strategy.type === 'RollingUpdate') {
    deployment.spec.strategy = {
      type: 'RollingUpdate',
      rollingUpdate: {
        maxSurge: parseStrategyValue(formData.value.strategy.rollingUpdate.maxSurge),
        maxUnavailable: parseStrategyValue(formData.value.strategy.rollingUpdate.maxUnavailable),
      },
    };
  } else {
    deployment.spec.strategy = { type: 'Recreate' };
  }

  return yaml.dump(deployment, { indent: 2, sortKeys: false, noRefs: true });
}

// 构建探针配置
function buildProbe(probe: any) {
  const result: any = {
    initialDelaySeconds: probe.initialDelaySeconds,
    periodSeconds: probe.periodSeconds,
  };

  if (probe.type === 'httpGet') {
    result.httpGet = {
      path: probe.httpGet.path,
      port: probe.httpGet.port,
    };
  } else if (probe.type === 'tcpSocket') {
    result.tcpSocket = {
      port: probe.tcpSocket.port,
    };
  } else if (probe.type === 'exec') {
    result.exec = {
      command: probe.exec.command.split(' '),
    };
  }

  return result;
}

// 解析策略值
function parseStrategyValue(value: string): number | string {
  if (value.endsWith('%')) return value;
  const num = parseInt(value, 10);
  return isNaN(num) ? 1 : num;
}

// 标签操作
function addLabel() {
  formData.value.labels.push({ key: '', value: '' });
}

function removeLabel(index: number) {
  formData.value.labels.splice(index, 1);
}

// 容器操作
function addContainer() {
  formData.value.containers.push(createEmptyContainer());
}

function removeContainer(index: number) {
  formData.value.containers.splice(index, 1);
}

// 端口操作
function addPort(containerIndex: number) {
  formData.value.containers[containerIndex].ports.push({
    containerPort: 8080,
    protocol: 'TCP',
  });
}

function removePort(containerIndex: number, portIndex: number) {
  formData.value.containers[containerIndex].ports.splice(portIndex, 1);
}

// 环境变量操作（普通 key=value）
function addEnv(containerIndex: number) {
  formData.value.containers[containerIndex].env.push({ 
    name: '', 
    value: ''
  });
}

function removeEnv(containerIndex: number, envIndex: number) {
  formData.value.containers[containerIndex].env.splice(envIndex, 1);
}

// envFrom 操作（从 ConfigMap 注入所有环境变量）
function addEnvFrom(containerIndex: number) {
  formData.value.containers[containerIndex].envFrom.push({
    configMapName: ''
  });
}

function removeEnvFrom(containerIndex: number, efIndex: number) {
  formData.value.containers[containerIndex].envFrom.splice(efIndex, 1);
}

// Volume 挂载操作
function addVolumeMount(containerIndex: number) {
  formData.value.containers[containerIndex].volumeMounts.push({
    configMapName: '',
    mountPath: '',
  });
}

function removeVolumeMount(containerIndex: number, mountIndex: number) {
  formData.value.containers[containerIndex].volumeMounts.splice(mountIndex, 1);
}

// 复制 YAML
async function copyYaml() {
  try {
    await navigator.clipboard.writeText(generatedYaml.value);
    MessagePlugin.success('YAML 已复制到剪贴板');
  } catch (e) {
    MessagePlugin.error('复制失败');
  }
}

// 预览变更
async function handlePreviewDiff() {
  // 先验证表单
  const valid = await basicFormRef.value?.validate();
  if (valid !== true) {
    activeTab.value = 'basic';
    return;
  }
  
  // 验证容器配置
  const hasValidContainer = formData.value.containers.some(c => c.name && c.image);
  if (!hasValidContainer) {
    MessagePlugin.warning('请至少配置一个容器的名称和镜像');
    activeTab.value = 'container';
    return;
  }
  
  diffLoading.value = true;
  try {
    // 在编辑模式下使用原始数据的名称，创建模式下使用表单名称
    const deploymentName = props.mode === 'edit' && props.initialData 
      ? props.initialData.metadata.name 
      : formData.value.name;
      
    const response = await diffResource(clusterId.value, {
      namespace: namespace.value,
      kind: 'Deployment',
      name: deploymentName,
      new_yaml: generatedYaml.value,
    });
    emit('preview-diff', response);
    // 关闭表单对话框
    emit('close-form');
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

// 提交表单
async function handleSubmit() {
  if (!diffConfirmed.value) {
    MessagePlugin.warning('请先预览变更并确认');
    return;
  }

  submitting.value = true;
  try {
    const deploymentData = yaml.load(generatedYaml.value) as Deployment;

    if (props.mode === 'create') {
      await createDeployment(clusterId.value, namespace.value, deploymentData);
      MessagePlugin.success('Deployment 创建成功');
    } else {
      await updateDeployment(clusterId.value, namespace.value, formData.value.name, deploymentData);
      MessagePlugin.success('Deployment 更新成功');
    }

    emit('success');
  } catch (e: any) {
    MessagePlugin.error(e.message || '操作失败');
  } finally {
    submitting.value = false;
  }
}

// 取消
function handleCancel() {
  emit('cancel');
}

// 导出方法给父组件调用
defineExpose({
  confirmDiffAndSubmit,
});
</script>

<style lang="less" scoped>
.deployment-form {
  .labels-editor,
  .ports-editor,
  .env-editor,
  .envfrom-editor,
  .volume-editor {
    .label-row,
    .port-row,
    .env-row,
    .envfrom-row,
    .volume-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .label-separator,
    .env-separator {
      color: var(--td-text-color-secondary);
    }
  }

  .container-section {
    .container-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
      }
    }
  }

  .yaml-preview-container {
    .yaml-actions {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 8px;
    }

    .yaml-preview {
      background: var(--td-bg-color-page);
      border: 1px solid var(--td-border-level-1-color);
      border-radius: var(--td-radius-default);
      padding: 16px;
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 12px;
      line-height: 1.6;
      max-height: 500px;
      overflow: auto;
      white-space: pre;
      margin: 0;
    }
  }

  .form-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--td-border-level-1-color);
  }

  .form-hint {
    margin-left: 8px;
    color: var(--td-text-color-placeholder);
    font-size: 12px;
  }
}
</style>
