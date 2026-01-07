<template>
  <div>
    <t-card class="list-card-container" :bordered="false">
      <t-row justify="space-between">
        <div class="left-operation-container">
          <t-button @click="handleAdd">添加集群</t-button>
          <t-button theme="default" :loading="dataLoading" @click="fetchData">
            <template #icon><refresh-icon /></template>
            刷新
          </t-button>
        </div>
        <div class="search-input">
          <t-input v-model="searchName" placeholder="请输入集群名称搜索" clearable @enter="handleSearch" style="width: 250px">
            <template #suffix-icon>
              <search-icon />
            </template>
          </t-input>
        </div>
      </t-row>
      <t-table
        :data="filteredData"
        :columns="COLUMNS"
        :row-key="rowKey"
        vertical-align="top"
        :hover="true"
        :loading="dataLoading"
      >
        <template #status="{ row }">
          <t-tag v-if="row.status === 1" theme="success">正常</t-tag>
          <t-tag v-else-if="row.status === 0" theme="warning">未验证</t-tag>
          <t-tag v-else theme="danger">异常</t-tag>
        </template>
        <template #environment="{ row }">
          <t-tag v-if="row.environment === 'prod'" theme="danger">生产</t-tag>
          <t-tag v-else-if="row.environment === 'staging'" theme="warning">预发布</t-tag>
          <t-tag v-else-if="row.environment === 'dev'" theme="primary">开发</t-tag>
          <t-tag v-else>{{ row.environment }}</t-tag>
        </template>
        <template #resources="{ row }">
          <div v-if="row.resources" class="resources-info">
            <div class="resources-row">
              <t-tag theme="default" size="small">
                节点: {{ row.resources.node_ready }}/{{ row.resources.node_count }}
              </t-tag>
              <t-tag theme="default" size="small" style="margin-left: 4px">
                Pod: {{ row.resources.pod_running }}/{{ row.resources.pod_count }}
              </t-tag>
            </div>
            <div class="resources-row" style="margin-top: 4px; font-size: 12px; color: var(--td-text-color-secondary);">
              <span>CPU: {{ row.resources.cpu_capacity }}</span>
              <span style="margin: 0 8px">|</span>
              <span>内存: {{ row.resources.memory_capacity }}</span>
            </div>
          </div>
          <div v-else-if="row.status === 2" class="resources-error">
            <t-icon name="error-circle" /> 连接异常，无法获取资源信息
          </div>
          <div v-else class="resources-empty">
            <t-icon name="info-circle" /> 资源信息加载中或不可用
          </div>
        </template>
        <template #op="{ row }">
          <t-link theme="primary" @click="handleEdit(row)">编辑</t-link>
          <t-divider layout="vertical" />
          <t-popconfirm content="确定删除该集群吗？删除后将无法恢复。" @confirm="handleDelete(row)">
            <t-link theme="danger">删除</t-link>
          </t-popconfirm>
        </template>
      </t-table>
    </t-card>

    <!-- 创建/编辑集群对话框 -->
    <t-dialog
      v-model:visible="clusterDialogVisible"
      :header="isEdit ? '编辑集群' : '添加集群'"
      :confirm-btn="{ content: '提交', loading: submitLoading }"
      @confirm="onSubmitCluster"
      width="600px"
    >
      <t-form ref="formRef" :data="clusterFormData" :rules="CLUSTER_FORM_RULES" label-align="right" :label-width="100">
        <t-form-item label="集群名称" name="name">
          <t-input v-model="clusterFormData.name" placeholder="请输入集群名称" />
        </t-form-item>
        <t-form-item label="提供商" name="provider">
          <t-select v-model="clusterFormData.provider" placeholder="请选择云提供商">
            <t-option value="aliyun" label="阿里云 (Aliyun)" />
            <t-option value="aws" label="AWS" />
            <t-option value="gcp" label="Google Cloud (GCP)" />
            <t-option value="azure" label="Microsoft Azure" />
            <t-option value="huawei" label="华为云" />
            <t-option value="tencent" label="腾讯云" />
            <t-option value="self-hosted" label="自建集群" />
          </t-select>
        </t-form-item>
        <t-form-item label="环境" name="environment">
          <t-select v-model="clusterFormData.environment" placeholder="请选择环境">
            <t-option value="dev" label="开发 (Dev)" />
            <t-option value="staging" label="预发布 (Staging)" />
            <t-option value="prod" label="生产 (Prod)" />
          </t-select>
        </t-form-item>
        <t-form-item label="地域" name="region">
          <t-input v-model="clusterFormData.region" placeholder="请输入地域，如 cn-hangzhou" />
        </t-form-item>
        <t-form-item label="Kubeconfig" name="kubeconfig">
          <t-textarea
            v-model="clusterFormData.kubeconfig"
            placeholder="请粘贴 kubeconfig 文件内容（将自动进行 base64 编码）"
            :autosize="{ minRows: 6, maxRows: 12 }"
          />
          <div class="form-item-tips">
            <t-icon name="info-circle" /> 请粘贴原始的 kubeconfig YAML 内容，系统会自动进行 base64 编码
          </div>
        </t-form-item>
      </t-form>
    </t-dialog>


  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { SearchIcon, RefreshIcon } from 'tdesign-icons-vue-next';
import {
  getClusterList,
  createCluster,
  updateCluster,
  deleteCluster,
  type Cluster,
} from '@/api/cluster';

// 表格列定义
const COLUMNS = [
  { title: '集群名称', colKey: 'name', width: 180 },
  { title: '提供商', colKey: 'provider', width: 120 },
  { title: '环境', colKey: 'environment', width: 100 },
  { title: '地域', colKey: 'region', width: 120 },
  { title: '状态', colKey: 'status', width: 100 },
  { title: '资源', colKey: 'resources', width: 280 },
  { title: '创建者', colKey: 'creator', width: 100 },
  { title: '操作', colKey: 'op', width: 150, fixed: 'right' as const },
];

// 表单验证规则
const CLUSTER_FORM_RULES = {
  name: [{ required: true, message: '请输入集群名称', type: 'error' as const }],
  provider: [{ required: true, message: '请选择提供商', type: 'error' as const }],
  environment: [{ required: true, message: '请选择环境', type: 'error' as const }],
  kubeconfig: [{ required: true, message: '请输入 Kubeconfig', type: 'error' as const }],
};

// 集群列表相关
const data = ref<Cluster[]>([]);
const dataLoading = ref(false);
const searchName = ref('');

// 过滤后的数据
const filteredData = computed(() => {
  if (!searchName.value) {
    return data.value;
  }
  return data.value.filter(cluster =>
    cluster.name.toLowerCase().includes(searchName.value.toLowerCase())
  );
});

// 对话框相关
const clusterDialogVisible = ref(false);
const submitLoading = ref(false);
const isEdit = ref(false);
const editingClusterId = ref('');
const clusterFormData = ref({
  name: '',
  provider: '',
  environment: '',
  region: '',
  kubeconfig: '',
});



// 获取集群列表
const fetchData = async () => {
  dataLoading.value = true;
  try {
    const res = await getClusterList();
    data.value = res;
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载集群列表失败');
  } finally {
    dataLoading.value = false;
  }
};

// 添加集群
const handleAdd = () => {
  isEdit.value = false;
  editingClusterId.value = '';
  clusterFormData.value = {
    name: '',
    provider: '',
    environment: '',
    region: '',
    kubeconfig: '',
  };
  clusterDialogVisible.value = true;
};

// 编辑集群
const handleEdit = (row: Cluster) => {
  isEdit.value = true;
  editingClusterId.value = row.id;
  clusterFormData.value = {
    name: row.name,
    provider: row.provider,
    environment: row.environment,
    region: row.region || '',
    kubeconfig: '', // 编辑时不显示已有的 kubeconfig
  };
  clusterDialogVisible.value = true;
};

// 提交集群表单
const onSubmitCluster = async () => {
  // 简单验证
  if (!clusterFormData.value.name) {
    MessagePlugin.error('请输入集群名称');
    return;
  }
  if (!clusterFormData.value.provider) {
    MessagePlugin.error('请选择提供商');
    return;
  }
  if (!clusterFormData.value.environment) {
    MessagePlugin.error('请选择环境');
    return;
  }

  submitLoading.value = true;
  try {
    if (isEdit.value) {
      // 编辑模式
      const updateData: any = {
        name: clusterFormData.value.name,
        provider: clusterFormData.value.provider,
        environment: clusterFormData.value.environment,
        region: clusterFormData.value.region,
      };
      // 只有输入了新的 kubeconfig 才更新
      if (clusterFormData.value.kubeconfig) {
        updateData.kubeconfig = btoa(clusterFormData.value.kubeconfig);
      }
      await updateCluster(editingClusterId.value, updateData);
      MessagePlugin.success('更新成功');
    } else {
      // 创建模式
      if (!clusterFormData.value.kubeconfig) {
        MessagePlugin.error('请输入 Kubeconfig');
        submitLoading.value = false;
        return;
      }
      await createCluster({
        name: clusterFormData.value.name,
        kubeconfig: btoa(clusterFormData.value.kubeconfig), // base64 编码
        provider: clusterFormData.value.provider,
        environment: clusterFormData.value.environment,
        region: clusterFormData.value.region || undefined,
      });
      MessagePlugin.success('创建成功');
    }
    clusterDialogVisible.value = false;
    fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '操作失败');
  } finally {
    submitLoading.value = false;
  }
};

// 删除集群
const handleDelete = async (row: Cluster) => {
  try {
    await deleteCluster(row.id);
    MessagePlugin.success('删除成功');
    fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '删除失败');
  }
};



// 搜索处理
const handleSearch = () => {
  // 搜索是通过 computed 属性自动完成的
};

const rowKey = 'id';

onMounted(() => {
  fetchData();
});
</script>

<style lang="less" scoped>
.list-card-container {
  padding: var(--td-comp-paddingTB-xxl) var(--td-comp-paddingLR-xxl);
}

.left-operation-container {
  margin-bottom: var(--td-comp-margin-xxl);
  display: flex;
  gap: 8px;
}

.search-input {
  display: flex;
  align-items: center;
}

.form-item-tips {
  margin-top: 8px;
  color: var(--td-text-color-placeholder);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.resources-info {
  .resources-row {
    display: flex;
    align-items: center;
  }
}

.resources-error {
  color: var(--td-error-color-6);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.resources-empty {
  color: var(--td-text-color-placeholder);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

</style>
