<template>
  <div class="resource-container">
    <t-card :bordered="false">
      <!-- 页面头部 -->
      <div class="page-header">
        <h3>Deployments</h3>
      </div>

      <t-divider />

      <!-- 操作栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <t-button theme="primary" @click="fetchData">
            <template #icon><refresh-icon /></template>
            刷新
          </t-button>
          <t-button theme="success" @click="handleFormCreate">
            <template #icon><add-icon /></template>
            Deployment部署
          </t-button>
          <t-button theme="default" @click="handleDeploy">
            <template #icon><add-icon /></template>
            YAML 部署
          </t-button>
        </div>
        <t-input
          v-model="searchKeyword"
          placeholder="搜索 Deployment 名称"
          clearable
          style="width: 300px"
        >
          <template #suffix-icon>
            <search-icon />
          </template>
        </t-input>
      </div>

      <!-- Deployment 列表 -->
      <t-table
        :data="filteredData"
        :columns="COLUMNS"
        :loading="loading"
        row-key="metadata.name"
        :hover="true"
      >
        <template #name="{ row }">
          <t-link theme="primary" @click="handleViewPods(row)">{{ row.metadata.name }}</t-link>
        </template>
        <template #replicas="{ row }">
          <span>{{ row.status?.readyReplicas || 0 }} / {{ row.spec?.replicas || 0 }}</span>
        </template>
        <template #images="{ row }">
          <div class="image-list">
            <t-tag
              v-for="(image, idx) in getImages(row)"
              :key="idx"
              theme="default"
              variant="outline"
              size="small"
            >
              {{ image }}
            </t-tag>
          </div>
        </template>
        <template #resources="{ row }">
          <div class="resources-info">
            <div class="resource-item" v-for="(res, idx) in getResources(row)" :key="idx">
              <div class="resource-label">{{ res.container }}</div>
              <div class="resource-values">
                <span class="resource-request" v-if="res.request">
                  <small>Request:</small> {{ res.request }}
                </span>
                <span class="resource-limit" v-if="res.limit">
                  <small>Limit:</small> {{ res.limit }}
                </span>
              </div>
            </div>
          </div>
        </template>
        <template #status="{ row }">
          <t-tag :theme="getStatusTheme(row)">{{ getStatus(row) }}</t-tag>
        </template>
        <template #age="{ row }">
          {{ formatAge(row.metadata.creationTimestamp) }}
        </template>
        <template #op="{ row }">
          <t-link theme="primary" @click="handleViewDetail(row)">详情</t-link>
          <t-divider layout="vertical" />
          <t-link theme="primary" @click="handleViewLogs(row)">查看日志</t-link>
          <t-divider layout="vertical" />
          <t-link theme="primary" @click="handleFormEdit(row)">表单编辑</t-link>
          <t-divider layout="vertical" />
          <t-link theme="primary" @click="handleEditYaml(row)">编辑YAML</t-link>
          <t-divider layout="vertical" />
          <t-link theme="primary" @click="handleScale(row)">扩缩容</t-link>
          <t-divider layout="vertical" />
          <t-link theme="success" @click="handleRedeploy(row)">重新部署</t-link>
          <t-divider layout="vertical" />
          <t-popconfirm
            content="确定删除该 Deployment 吗？此操作不可恢复。"
            @confirm="handleDelete(row)"
          >
            <t-link theme="danger">删除</t-link>
          </t-popconfirm>
        </template>
      </t-table>
    </t-card>

    <!-- 详情对话框 -->
    <t-dialog
      v-model:visible="detailVisible"
      header="Deployment 详情"
      width="800px"
      :footer="false"
    >
      <div class="detail-content">
        <pre class="yaml-content">{{ detailYaml }}</pre>
      </div>
    </t-dialog>

    <!-- 扩缩容对话框 -->
    <t-dialog
      v-model:visible="scaleVisible"
      header="扩缩容"
      :confirm-btn="{ content: '确定', loading: scaleLoading }"
      @confirm="onConfirmScale"
    >
      <t-form :data="scaleForm" label-align="right" :label-width="100">
        <t-form-item label="当前副本数">
          <span>{{ scaleForm.currentReplicas }}</span>
        </t-form-item>
        <t-form-item label="目标副本数" name="replicas">
          <t-input-number
            v-model="scaleForm.replicas"
            :min="0"
            :max="100"
            placeholder="请输入目标副本数"
          />
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- 编辑 YAML 对话框 -->
    <t-dialog
      v-model:visible="editYamlVisible"
      header="编辑 Deployment YAML"
      width="900px"
      :confirm-btn="{ content: '保存', loading: editYamlLoading }"
      @confirm="onConfirmEditYaml"
    >
      <t-textarea
        v-model="editYamlContent"
        :autosize="{ minRows: 20, maxRows: 30 }"
        placeholder="请输入 YAML 内容"
        class="yaml-editor"
      />
    </t-dialog>

    <!-- 部署应用对话框 -->
    <t-dialog
      v-model:visible="deployVisible"
      header="部署应用"
      width="900px"
      :footer="false"
    >
      <t-textarea
        v-model="deployYamlContent"
        :autosize="{ minRows: 20, maxRows: 30 }"
        placeholder="请输入 Deployment YAML 配置"
        class="yaml-editor"
      />
      <div class="deploy-hint">
        <t-alert theme="info" message="提示：请输入完整的 Deployment YAML 配置，系统会自动部署到当前命名空间" />
      </div>
      <div class="dialog-footer">
        <t-button theme="default" @click="deployVisible = false">取消</t-button>
        <t-button theme="primary" variant="outline" @click="handlePreviewDeploy" :loading="diffLoading">
          预览变更
        </t-button>
        <t-button theme="success" @click="onConfirmDeploy" :loading="deployLoading">
          直接部署
        </t-button>
      </div>
    </t-dialog>

    <!-- Diff 对话框 -->
    <resource-diff-dialog
      v-model:visible="diffDialogVisible"
      :diff-data="diffData"
      :loading="diffLoading"
      confirm-text="确认部署"
      @confirm="onConfirmDeployAfterDiff"
    />

    <!-- 表单创建对话框 -->
    <t-dialog
      v-model:visible="formCreateVisible"
      header="创建 Deployment"
      width="1000px"
      :footer="false"
    >
      <deployment-form
        ref="createFormRef"
        mode="create"
        @success="handleFormSuccess"
        @cancel="formCreateVisible = false"
        @preview-diff="handleFormPreviewDiff"
        @close-form="formCreateVisible = false"
      />
    </t-dialog>

    <!-- 表单编辑对话框 -->
    <t-dialog
      v-model:visible="formEditVisible"
      :header="`编辑 Deployment: ${editingDeployment?.metadata?.name || ''}`"
      width="1000px"
      :footer="false"
    >
      <deployment-form
        ref="editFormRef"
        mode="edit"
        :initial-data="editingDeployment"
        @success="handleFormEditSuccess"
        @cancel="formEditVisible = false"
        @preview-diff="handleFormEditPreviewDiff"
        @close-form="formEditVisible = false"
      />
    </t-dialog>

    <!-- 日志查看器对话框 -->
    <t-dialog
      v-model:visible="logViewerVisible"
      header="查看日志"
      width="1200px"
      :footer="false"
    >
      <div class="log-viewer">
        <div class="log-controls">
          <div class="control-group">
            <label>选择 Pod：</label>
            <t-select
              v-model="selectedPod"
              placeholder="请选择 Pod"
              style="width: 300px"
              @change="onPodChange"
            >
              <t-option
                v-for="pod in availablePods"
                :key="pod.metadata.name"
                :value="pod.metadata.name"
                :label="pod.metadata.name"
              />
            </t-select>
          </div>
          
          <div class="control-group">
            <label>Tail 行数：</label>
            <t-select
              v-model="tailLines"
              style="width: 120px"
              @change="fetchLogs"
            >
              <t-option :value="50" label="50" />
              <t-option :value="100" label="100" />
              <t-option :value="1000" label="1000" />
              <t-option :value="2000" label="2000" />
            </t-select>
          </div>
          
          <div class="control-group">
            <t-checkbox v-model="followLogs" @change="toggleFollow">
              实时输出
            </t-checkbox>
          </div>
          
          <div class="control-group">
            <t-button theme="primary" @click="fetchLogs" :loading="logLoading">
              刷新日志
            </t-button>
          </div>
        </div>
        
        <div class="log-content" ref="logContentRef">
          <pre v-if="logContent">{{ logContent }}</pre>
          <div v-else-if="logLoading" class="log-loading">
            <t-loading />
            <span>加载中...</span>
          </div>
          <div v-else class="log-empty">
            <span>请选择 Pod 查看日志</span>
          </div>
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { RefreshIcon, SearchIcon, AddIcon } from 'tdesign-icons-vue-next';
import {
  getDeployments,
  deleteDeployment,
  scaleDeployment,
  getPods,
  getPodLogs,
  type Deployment,
  type Pod,
  restartDeployment,
  diffResource,
  createDeployment,
  updateDeployment,
  type ResourceDiffResponse,
} from '@/api/k8s-resources';
import { useClusterResourceStore } from '@/store/modules/cluster-resource';
import * as yaml from 'js-yaml';
import ResourceDiffDialog from './components/ResourceDiffDialog.vue';
import DeploymentForm from './components/DeploymentForm.vue';

const router = useRouter();
const store = useClusterResourceStore();

// 从 store 获取上下文
const clusterId = computed(() => store.clusterId);
const namespace = computed(() => store.namespace);

const data = ref<Deployment[]>([]);
const loading = ref(false);
const searchKeyword = ref('');

const COLUMNS = [
  { title: '名称', colKey: 'name', width: 200 },
  { title: '副本数', colKey: 'replicas', width: 100 },
  { title: '镜像', colKey: 'images', ellipsis: true, width: 250 },
  { title: '资源配置', colKey: 'resources', width: 250 },
  { title: '状态', colKey: 'status', width: 100 },
  { title: '创建时间', colKey: 'age', width: 120 },
  { title: '操作', colKey: 'op', width: 220, fixed: 'right' as const },
];

// 过滤数据
const filteredData = computed(() => {
  if (!searchKeyword.value) return data.value;
  return data.value.filter(item =>
    item.metadata.name.toLowerCase().includes(searchKeyword.value.toLowerCase())
  );
});

// 详情对话框
const detailVisible = ref(false);
const detailYaml = ref('');

// 扩缩容对话框
const scaleVisible = ref(false);
const scaleLoading = ref(false);
const scaleForm = ref({
  name: '',
  currentReplicas: 0,
  replicas: 0,
});

// 编辑 YAML 对话框
const editYamlVisible = ref(false);
const editYamlLoading = ref(false);
const editYamlContent = ref('');
const currentEditingDeployment = ref<Deployment | null>(null);

// 部署应用对话框
const deployVisible = ref(false);
const deployLoading = ref(false);
const deployYamlContent = ref(`apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  labels:
    app: my-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: my-app
        image: nginx:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
`);

// Diff 对话框
const diffDialogVisible = ref(false);
const diffLoading = ref(false);
const diffData = ref<ResourceDiffResponse | null>(null);

// 表单创建对话框
const formCreateVisible = ref(false);
const createFormRef = ref();

// 表单编辑对话框
const formEditVisible = ref(false);
const editFormRef = ref();
const editingDeployment = ref<Deployment | null>(null);
const formDiffSource = ref<'create' | 'edit'>('create');

// 日志查看器状态
const logViewerVisible = ref(false);
const logLoading = ref(false);
const logContent = ref('');
const selectedPod = ref('');
const availablePods = ref<Pod[]>([]);
const tailLines = ref(100);
const followLogs = ref(false);
const logContentRef = ref<HTMLElement | null>(null);
const logTimer = ref<number | null>(null);
const currentDeployment = ref<Deployment | null>(null);

// 获取镜像列表
const getImages = (deployment: Deployment) => {
  const containers = deployment.spec?.template?.spec?.containers || [];
  return containers.map(c => c.image);
};

// 获取资源配置
const getResources = (deployment: Deployment) => {
  const containers = deployment.spec?.template?.spec?.containers || [];
  return containers.map(container => {
    const resources = container.resources || {};
    const requests = resources.requests || {};
    const limits = resources.limits || {};
    
    const requestStr = [
      requests.cpu ? `CPU: ${requests.cpu}` : '',
      requests.memory ? `Mem: ${requests.memory}` : '',
    ].filter(Boolean).join(', ');
    
    const limitStr = [
      limits.cpu ? `CPU: ${limits.cpu}` : '',
      limits.memory ? `Mem: ${limits.memory}` : '',
    ].filter(Boolean).join(', ');
    
    return {
      container: container.name,
      request: requestStr || '-',
      limit: limitStr || '-',
    };
  });
};

// 获取状态
const getStatus = (deployment: Deployment) => {
  const replicas = deployment.spec?.replicas || 0;
  const readyReplicas = deployment.status?.readyReplicas || 0;
  
  if (readyReplicas === replicas) return '运行中';
  if (readyReplicas === 0) return '未就绪';
  return '部分就绪';
};

// 获取状态主题
const getStatusTheme = (deployment: Deployment) => {
  const replicas = deployment.spec?.replicas || 0;
  const readyReplicas = deployment.status?.readyReplicas || 0;
  
  if (readyReplicas === replicas) return 'success';
  if (readyReplicas === 0) return 'danger';
  return 'warning';
};

// 格式化时间
const formatAge = (timestamp?: string) => {
  if (!timestamp) return '-';
  const now = new Date().getTime();
  const created = new Date(timestamp).getTime();
  const diff = now - created;
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}天`;
  if (hours > 0) return `${hours}小时`;
  return `${minutes}分钟`;
};

// 查看详情
const handleViewDetail = (deployment: Deployment) => {
  detailYaml.value = yaml.dump(deployment, { indent: 2, noRefs: true });
  detailVisible.value = true;
};

// 扩缩容
const handleScale = (deployment: Deployment) => {
  scaleForm.value = {
    name: deployment.metadata.name,
    currentReplicas: deployment.spec?.replicas || 0,
    replicas: deployment.spec?.replicas || 0,
  };
  scaleVisible.value = true;
};

// 确认扩缩容
const onConfirmScale = async () => {
  scaleLoading.value = true;
  try {
    await scaleDeployment(
      clusterId.value,
      namespace.value,
      scaleForm.value.name,
      scaleForm.value.replicas
    );
    MessagePlugin.success('扩缩容成功');
    scaleVisible.value = false;
    await fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '扩缩容失败');
  } finally {
    scaleLoading.value = false;
  }
};

// 编辑 YAML
const handleEditYaml = (deployment: Deployment) => {
  currentEditingDeployment.value = deployment;
  
  // 清理 YAML，只保留用户需要编辑的字段
  // 注意：对象属性的顺序很重要，apiVersion 和 kind 必须在最前面
  const cleanedDeployment: any = {};
  
  // 首先添加 apiVersion 和 kind - 使用默认值（因为后端可能不返回这些字段）
  cleanedDeployment.apiVersion = deployment.apiVersion || 'apps/v1';
  cleanedDeployment.kind = deployment.kind || 'Deployment';
  
  // 然后添加 metadata
  cleanedDeployment.metadata = {
    name: deployment.metadata.name,
    namespace: deployment.metadata.namespace,
  };
  
  // 添加 labels（如果存在）
  if (deployment.metadata.labels && Object.keys(deployment.metadata.labels).length > 0) {
    cleanedDeployment.metadata.labels = deployment.metadata.labels;
  }
  
  // 添加过滤后的 annotations（如果存在）
  if (deployment.metadata.annotations) {
    const filteredAnnotations = Object.fromEntries(
      Object.entries(deployment.metadata.annotations).filter(
        ([key]) => !key.startsWith('deployment.kubernetes.io/')
      )
    );
    if (Object.keys(filteredAnnotations).length > 0) {
      cleanedDeployment.metadata.annotations = filteredAnnotations;
    }
  }
  
  // 最后添加 spec
  cleanedDeployment.spec = deployment.spec;
  
  // 使用 noRefs 和 sortKeys: false 来保持字段顺序
  editYamlContent.value = yaml.dump(cleanedDeployment, { 
    indent: 2, 
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  });
  editYamlVisible.value = true;
};

// 确认编辑 YAML
const onConfirmEditYaml = async () => {
  if (!currentEditingDeployment.value) return;
  
  editYamlLoading.value = true;
  try {
    // 解析 YAML
    const updatedDeployment = yaml.load(editYamlContent.value) as Deployment;
    
    // 这里需要调用更新 API（假设有 updateDeployment 函数）
    // await updateDeployment(clusterId.value, namespace.value, updatedDeployment.metadata.name, updatedDeployment);
    
    MessagePlugin.success('YAML 更新成功（需要后端 API 支持）');
    editYamlVisible.value = false;
    await fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || 'YAML 格式错误或更新失败');
  } finally {
    editYamlLoading.value = false;
  }
};

// 重新部署
// 重新部署
const handleRedeploy = async (deployment: Deployment) => {
  let msgInstance;
  try {
    msgInstance = MessagePlugin.loading('正在重新部署...', 0);
    
    await restartDeployment(clusterId.value, namespace.value, deployment.metadata.name);
    
    MessagePlugin.close(msgInstance);
    MessagePlugin.success('已触发重新部署');
    await fetchData();
  } catch (e: any) {
    if (msgInstance) {
      MessagePlugin.close(msgInstance);
    }
    MessagePlugin.error(e.message || '重新部署失败');
  }
};

// 部署应用
const handleDeploy = () => {
  deployVisible.value = true;
};

// 表单创建
const handleFormCreate = () => {
  formCreateVisible.value = true;
};

// 表单创建成功
const handleFormSuccess = async () => {
  formCreateVisible.value = false;
  await fetchData();
};

// 表单预览变更
const handleFormPreviewDiff = (data: ResourceDiffResponse) => {
  formDiffSource.value = 'create';
  diffData.value = data;
  diffDialogVisible.value = true;
};

// 表单编辑
const handleFormEdit = (deployment: Deployment) => {
  editingDeployment.value = deployment;
  formEditVisible.value = true;
};

// 表单编辑成功
const handleFormEditSuccess = async () => {
  formEditVisible.value = false;
  await fetchData();
};

// 表单编辑预览变更
const handleFormEditPreviewDiff = (data: ResourceDiffResponse) => {
  formDiffSource.value = 'edit';
  diffData.value = data;
  diffDialogVisible.value = true;
};

// 预览变更
const handlePreviewDeploy = async () => {
  diffLoading.value = true;
  try {
    // 解析 YAML 获取资源名称
    const deployment = yaml.load(deployYamlContent.value) as Deployment;
    
    // 验证是否是 Deployment
    if (deployment.kind !== 'Deployment') {
      throw new Error('请输入 Deployment 类型的 YAML 配置');
    }

    // 调用 diff API
    const response = await diffResource(clusterId.value, {
      namespace: namespace.value,
      kind: 'Deployment',
      name: deployment.metadata.name,
      new_yaml: deployYamlContent.value,
    });

    diffData.value = response;
    diffDialogVisible.value = true;
  } catch (e: any) {
    MessagePlugin.error(e.message || '预览变更失败');
  } finally {
    diffLoading.value = false;
  }
};

// 确认部署（在 diff 对话框中）
const onConfirmDeployAfterDiff = async () => {
  // 如果是表单创建/编辑，调用表单组件的提交方法
  if (formDiffSource.value === 'create' && createFormRef.value) {
    createFormRef.value.confirmDiffAndSubmit?.();
    diffDialogVisible.value = false;
    return;
  }
  if (formDiffSource.value === 'edit' && editFormRef.value) {
    editFormRef.value.confirmDiffAndSubmit?.();
    diffDialogVisible.value = false;
    return;
  }
  
  // YAML 部署逻辑
  deployLoading.value = true;
  try {
    const deployment = yaml.load(deployYamlContent.value) as Deployment;
    
    // 根据 diffData 判断是创建还是更新
    if (diffData.value && !diffData.value.exists) {
      // 创建新资源
      await createDeployment(clusterId.value, namespace.value, deployment);
      MessagePlugin.success('Deployment 创建成功');
    } else {
      // 更新现有资源
      await updateDeployment(clusterId.value, namespace.value, deployment.metadata.name, deployment);
      MessagePlugin.success('Deployment 更新成功');
    }
    
    diffDialogVisible.value = false;
    deployVisible.value = false;
    await fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '部署失败');
  } finally {
    deployLoading.value = false;
  }
};

// 确认部署（直接部署）
const onConfirmDeploy = async () => {
  deployLoading.value = true;
  try {
    // 解析 YAML
    const deployment = yaml.load(deployYamlContent.value) as Deployment;
    
    // 验证是否是 Deployment
    if (deployment.kind !== 'Deployment') {
      throw new Error('请输入 Deployment 类型的 YAML 配置');
    }
    
    // 这里需要调用创建 API（假设有 createDeployment 函数）
    // await createDeployment(clusterId.value, namespace.value, deployment);
    
    MessagePlugin.success('部署成功（需要后端 API 支持）');
    deployVisible.value = false;
    await fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || 'YAML 格式错误或部署失败');
  } finally {
    deployLoading.value = false;
  }
};

// 查看日志
const handleViewLogs = async (deployment: Deployment) => {
  currentDeployment.value = deployment;
  logViewerVisible.value = true;
  logContent.value = '';
  selectedPod.value = '';
  
  // 获取该 Deployment 的所有 Pods
  try {
    const labelSelector = Object.entries(deployment.spec.selector.matchLabels)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    
    const res = await getPods(clusterId.value, namespace.value, labelSelector);
    availablePods.value = res.items || [];
    
    // 自动选择第一个 Pod
    if (availablePods.value.length > 0) {
      selectedPod.value = availablePods.value[0].metadata.name;
      await fetchLogs();
    }
  } catch (e: any) {
    MessagePlugin.error(e.message || '获取 Pod 列表失败');
  }
};

// 获取日志
const fetchLogs = async () => {
  if (!selectedPod.value) {
    return;
  }
  
  logLoading.value = true;
  try {
    const res = await getPodLogs(clusterId.value, namespace.value, selectedPod.value, {
      tailLines: tailLines.value,
      follow: false, // 首次加载不使用 follow
    });
    
    // res 已经是字符串了（因为 requestOptions.isTransformResponse: false）
    logContent.value = typeof res === 'string' ? res : (res as any).logs || '暂无日志';
    
    // 滚动到底部
    setTimeout(() => {
      if (logContentRef.value) {
        logContentRef.value.scrollTop = logContentRef.value.scrollHeight;
      }
    }, 100);
  } catch (e: any) {
    MessagePlugin.error(e.message || '获取日志失败');
    logContent.value = '获取日志失败';
  } finally {
    logLoading.value = false;
  }
};

// Pod 变化
const onPodChange = () => {
  fetchLogs();
};

// 切换实时输出
const toggleFollow = () => {
  if (followLogs.value) {
    // 开启实时输出
    startLogStreaming();
  } else {
    // 停止实时输出
    stopLogStreaming();
  }
};

// 开始日志流
const startLogStreaming = () => {
  stopLogStreaming(); // 先停止之前的
  
  logTimer.value = window.setInterval(async () => {
    if (!selectedPod.value) return;
    
    try {
      const res = await getPodLogs(clusterId.value, namespace.value, selectedPod.value, {
        tailLines: tailLines.value,
        follow: false,
      });
      
      logContent.value = typeof res === 'string' ? res : (res as any).logs || '暂无日志';
      
      // 滚动到底部
      if (logContentRef.value) {
        logContentRef.value.scrollTop = logContentRef.value.scrollHeight;
      }
    } catch (e) {
      console.error('获取日志失败:', e);
    }
  }, 2000); // 每2秒刷新一次
};

// 停止日志流
const stopLogStreaming = () => {
  if (logTimer.value) {
    clearInterval(logTimer.value);
    logTimer.value = null;
  }
};

// 删除
const handleDelete = async (deployment: Deployment) => {
  try {
    await deleteDeployment(clusterId.value, namespace.value, deployment.metadata.name);
    MessagePlugin.success('删除成功');
    await fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '删除失败');
  }
};

// 加载数据
const fetchData = async () => {
  if (!clusterId.value || !namespace.value) {
    return;
  }
  
  loading.value = true;
  try {
    const res = await getDeployments(clusterId.value, namespace.value);
    data.value = res.items || [];
  } catch (e: any) {
    console.error('Failed to load deployments:', e);
    MessagePlugin.error(e.message || '加载数据失败');
  } finally {
    loading.value = false;
  }
};

// 查看 Pods
const handleViewPods = (deployment: Deployment) => {
  // 构建 label selector，用于过滤该 deployment 的 pods
  const labels = deployment.spec?.selector?.matchLabels || {};
  const labelSelector = Object.entries(labels)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
  
  router.push({
    name: 'ClusterResourcePods',
    query: {
      deployment: deployment.metadata.name,
      labelSelector,
    },
  });
};

// 监听命名空间变化，自动刷新数据
watch(() => store.selectedNamespace, () => {
  fetchData();
}, { immediate: true });

// 初始化
onMounted(async () => {
  await fetchData();
});
</script>

<style lang="less" scoped>
.resource-container {
  padding: var(--td-comp-paddingTB-xxl) var(--td-comp-paddingLR-xxl);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--td-comp-margin-l);

  .breadcrumb {
    flex: 1;
  }

  .context-info {
    display: flex;
    gap: var(--td-comp-margin-s);
  }
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--td-comp-margin-l);

  .toolbar-left {
    display: flex;
    gap: var(--td-comp-margin-s);
  }
}

.resource-name {
  font-weight: 500;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.resources-info {
  .resource-item {
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }

    .resource-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--td-text-color-primary);
      margin-bottom: 4px;
    }

    .resource-values {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 11px;

      small {
        color: var(--td-text-color-placeholder);
        margin-right: 4px;
      }

      .resource-request {
        color: var(--td-success-color);
      }

      .resource-limit {
        color: var(--td-warning-color);
      }
    }
  }
}

.detail-content {
  max-height: 600px;
  overflow-y: auto;

  .yaml-content {
    background: var(--td-bg-color-container);
    padding: var(--td-comp-paddingTB-m) var(--td-comp-paddingLR-m);
    border-radius: var(--td-radius-default);
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
  }
}

.yaml-editor {
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
}

.deploy-hint {
  margin-top: var(--td-comp-margin-m);
}

.log-viewer {
  display: flex;
  flex-direction: column;
  height: 600px;
  
  .log-controls {
    display: flex;
    gap: var(--td-comp-margin-l);
    align-items: center;
    margin-bottom: var(--td-comp-margin-m);
    padding-bottom: var(--td-comp-margin-m);
    border-bottom: 1px solid var(--td-component-stroke);
    
    .control-group {
      display: flex;
      align-items: center;
      gap: var(--td-comp-margin-s);
      
      label {
        font-size: 13px;
        color: var(--td-text-color-primary);
      }
    }
  }
  
  .log-content {
    flex: 1;
    background: #1e1e1e;
    color: #d4d4d4;
    padding: var(--td-comp-paddingTB-m) var(--td-comp-paddingLR-m);
    border-radius: var(--td-radius-default);
    overflow-y: auto;
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.5;
    
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
    }
    
    .log-loading {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--td-comp-margin-m);
      color: var(--td-text-color-secondary);
    }
    
    .log-empty {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--td-text-color-placeholder);
    }
  }
}
</style>



