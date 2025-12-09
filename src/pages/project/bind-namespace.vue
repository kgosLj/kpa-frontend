<template>
  <div>
    <t-card class="list-card-container" :bordered="false" title="绑定命名空间">
        <template #actions>
            <t-button variant="text" @click="$router.back()">返回</t-button>
        </template>
        
      <t-row justify="space-between">
        <div class="left-operation-container">
          <t-button @click="handleAdd">绑定新命名空间</t-button>
        </div>
      </t-row>
      <t-table
        :data="data"
        :columns="COLUMNS"
        :row-key="rowKey"
        vertical-align="top"
        :hover="true"
        :loading="dataLoading"
      >
        <template #environment="{ row }">
            <t-tag v-if="row.environment === 'prod'" theme="success">生产</t-tag>
            <t-tag v-else-if="row.environment === 'staging'" theme="warning">预发布</t-tag>
            <t-tag v-else-if="row.environment === 'dev'" theme="primary">开发</t-tag>
            <t-tag v-else>{{ row.environment }}</t-tag>
        </template>
        <template #op="{ row }">
           <t-popconfirm content="确定解绑吗？" @confirm="handleUnbind(row)">
               <t-link theme="danger">解绑</t-link>
           </t-popconfirm>
        </template>
      </t-table>
    </t-card>

    <t-dialog
      v-model:visible="dialogVisible"
      header="绑定命名空间"
      :confirm-btn="{ content: '提交', loading: submitLoading }"
      @confirm="onSubmit"
    >
      <t-form ref="formRef" :data="formData" :rules="FORM_RULES" label-align="right" :label-width="100">
        <t-form-item label="集群" name="cluster_id">
          <t-select v-model="formData.cluster_id" placeholder="请选择集群" @change="onClusterChange">
              <t-option v-for="cluster in clusters" :key="cluster.id" :value="cluster.id" :label="cluster.name" />
          </t-select>
        </t-form-item>
        <t-form-item label="命名空间" name="namespace">
          <t-select v-model="formData.namespace" placeholder="请选择命名空间" :loading="namespacesLoading">
              <t-option v-for="ns in namespaces" :key="ns" :value="ns" :label="ns" />
          </t-select>
        </t-form-item>
        <t-form-item label="环境" name="environment">
          <t-select v-model="formData.environment">
              <t-option value="dev" label="开发 (Dev)" />
              <t-option value="staging" label="预发布 (Staging)" />
              <t-option value="prod" label="生产 (Prod)" />
          </t-select>
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { getProjectNamespaces, bindProjectNamespace, unbindProjectNamespace } from '@/api/project';
import { getClusterList, type Cluster } from '@/api/cluster';
import type { ProjectNamespace } from '@/api/project';
import { request } from '@/utils/request';

const route = useRoute();
const projectId = route.params.id as string;

const COLUMNS = [
  { title: '集群ID', colKey: 'cluster_id', width: 200 },
  { title: '命名空间', colKey: 'namespace', width: 200 },
  { title: '环境', colKey: 'environment', width: 120 },
  { title: '绑定时间', colKey: 'create_time', width: 200 },
  { title: '操作', colKey: 'op', width: 100, fixed: 'right' },
];

const FORM_RULES = {
  cluster_id: [{ required: true, message: '必填', type: 'error' as const }],
  namespace: [{ required: true, message: '必填', type: 'error' as const }],
  environment: [{ required: true, message: '必填', type: 'error' as const }],
};

const data = ref<ProjectNamespace[]>([]);
const dataLoading = ref(false);
const dialogVisible = ref(false);
const submitLoading = ref(false);
const formData = ref({
  cluster_id: '',
  namespace: '',
  environment: 'prod',
});

const clusters = ref<Cluster[]>([]);
const namespaces = ref<string[]>([]);
const namespacesLoading = ref(false);

const fetchData = async () => {
  dataLoading.value = true;
  try {
    const res = await getProjectNamespaces(projectId);
    data.value = res;
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载失败');
    console.error(e);
  } finally {
    dataLoading.value = false;
  }
};

const fetchClusters = async () => {
  try {
    const res = await getClusterList();
    clusters.value = res;
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载集群列表失败');
  }
};

const onClusterChange = async (clusterId: string | number) => {
  if (!clusterId) {
    namespaces.value = [];
    return;
  }
  
  const clusterIdStr = String(clusterId);
  namespacesLoading.value = true;
  try {
    // 从 K8s API 获取命名空间列表
    const res = await request.get<{ items: Array<{ metadata: { name: string } }> }>({
      url: `/clusters/${clusterIdStr}/proxy/api/v1/namespaces`
    });
    namespaces.value = res.items.map(item => item.metadata.name);
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载命名空间失败');
    namespaces.value = [];
  } finally {
    namespacesLoading.value = false;
  }
};

const handleAdd = () => {
  formData.value = { cluster_id: '', namespace: '', environment: 'prod' };
  namespaces.value = [];
  dialogVisible.value = true;
};

const onSubmit = async () => {
  submitLoading.value = true;
  try {
    await bindProjectNamespace(projectId, formData.value);
    MessagePlugin.success('绑定成功');
    dialogVisible.value = false;
    fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '绑定失败');
  } finally {
    submitLoading.value = false;
  }
};

const handleUnbind = async (row: ProjectNamespace) => {
    try {
        await unbindProjectNamespace(projectId, { cluster_id: row.cluster_id, namespace: row.namespace });
        MessagePlugin.success('解绑成功');
        fetchData();
    } catch (e: any) {
        MessagePlugin.error(e.message || '解绑失败');
    }
}

const rowKey = 'id';

onMounted(() => {
  fetchData();
  fetchClusters();
});
</script>

<style lang="less" scoped>
.list-card-container {
  padding: var(--td-comp-paddingTB-xxl) var(--td-comp-paddingLR-xxl);
}
.left-operation-container {
  margin-bottom: var(--td-comp-margin-xxl);
}
</style>
