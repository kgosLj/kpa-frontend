<template>
  <div>
    <t-card :bordered="false" class="scaling-container">
      <div class="header">
        <h2 class="title">快速扩容</h2>
        <p class="description">同步调整 Deployment 副本数和关联 HPA 的范围，避免扩缩容冲突。</p>
      </div>

      <t-form label-align="left" class="select-form">
        <t-row :gutter="24">
          <t-col :span="4">
            <t-form-item label="选择集群">
              <t-select
                v-model="selectedCluster"
                placeholder="请选择集群"
                @change="onClusterChange"
                :loading="clustersLoading"
              >
                <t-option
                  v-for="item in clusters"
                  :key="item.id"
                  :value="item.id"
                  :label="item.name"
                />
              </t-select>
            </t-form-item>
          </t-col>
          <t-col :span="4">
            <t-form-item label="命名空间">
              <t-select
                v-model="selectedNamespace"
                placeholder="请选择命名空间"
                @change="fetchWorkloads"
                :loading="namespacesLoading"
                :disabled="!selectedCluster"
              >
                <t-option
                  v-for="item in namespaces"
                  :key="item.metadata.name"
                  :value="item.metadata.name"
                  :label="item.metadata.name"
                />
              </t-select>
            </t-form-item>
          </t-col>
        </t-row>
      </t-form>

      <t-table
        :data="workloads"
        :columns="COLUMNS"
        row-key="metadata.uid"
        :loading="dataLoading"
        vertical-align="middle"
        class="workload-table"
      >
        <template #name="{ row }">
          <div class="name-cell">
            <span class="kind-tag">{{ row.kind }}</span>
            <span class="resource-name">{{ row.metadata.name }}</span>
          </div>
        </template>

        <template #replicas="{ row }">
          <div class="replica-cell">
            <t-tag theme="primary" variant="light">
              当前: {{ row.status?.readyReplicas || 0 }} / {{ row.spec?.replicas || 0 }}
            </t-tag>
          </div>
        </template>

        <template #hpa="{ row }">
          <div v-if="getBoundHpa(row)" class="hpa-cell">
            <span class="hpa-name">{{ getBoundHpa(row).metadata.name }}</span>
            <div class="hpa-range-edit">
              <t-input-number
                v-model="row._hpaMin"
                size="small"
                theme="column"
                style="width: 70px"
                placeholder="Min"
              />
              <span class="range-sep">-</span>
              <t-input-number
                v-model="row._hpaMax"
                size="small"
                theme="column"
                style="width: 70px"
                placeholder="Max"
              />
              <t-button
                size="small"
                variant="outline"
                theme="primary"
                :loading="row._hpaLoading"
                @click="handleUpdateHpaRange(row)"
                style="margin-left: 8px"
              >
                保存
              </t-button>
            </div>
          </div>
          <t-tag v-else theme="default" variant="light">未绑定 HPA</t-tag>
        </template>

        <template #op="{ row }">
          <div class="op-cell">
             <t-input-number
              v-model="row._newReplicas"
              :min="0"
              :max="500"
              size="small"
              style="width: 100px; margin-right: 12px"
            />
            <t-button
              size="small"
              theme="primary"
              :loading="row._loading"
              @click="handleQuickScale(row)"
            >
              执行扩容
            </t-button>
          </div>
        </template>
      </t-table>
    </t-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { getClusterList, type Cluster } from '@/api/cluster';
import { 
  getNamespaces, 
  getDeployments, 
  getHPAs, 
  quickScaleWorkload,
  patchHPA,
  type Deployment,
  type HPA,
  type K8sResource
} from '@/api/k8s-resources';

const clusters = ref<Cluster[]>([]);
const selectedCluster = ref('');
const clustersLoading = ref(false);

const namespaces = ref<K8sResource[]>([]);
const selectedNamespace = ref('default');
const namespacesLoading = ref(false);

const workloads = ref<any[]>([]);
const hpas = ref<HPA[]>([]);
const dataLoading = ref(false);

const COLUMNS = [
  { title: '资源名称', colKey: 'name', width: 220 },
  { title: '副本状态', colKey: 'replicas', width: 180 },
  { title: 'HPA 关联与范围修改', colKey: 'hpa', width: 320 },
  { title: '副本数快速调整', colKey: 'op', fixed: 'right' as const, width: 220 },
];

const fetchClusters = async () => {
  clustersLoading.value = true;
  try {
    clusters.value = await getClusterList();
    if (clusters.value.length > 0) {
      selectedCluster.value = clusters.value[0].id;
      onClusterChange();
    }
  } catch (e: any) {
    MessagePlugin.error('加载集群列表失败');
  } finally {
    clustersLoading.value = false;
  }
};

const onClusterChange = async () => {
  if (!selectedCluster.value) return;
  namespacesLoading.value = true;
  try {
    const res = await getNamespaces(selectedCluster.value);
    namespaces.value = res.items;
    if (!namespaces.value.find(ns => ns.metadata.name === selectedNamespace.value)) {
      selectedNamespace.value = namespaces.value[0]?.metadata.name || 'default';
    }
    fetchWorkloads();
  } catch (e: any) {
    MessagePlugin.error('加载命名空间失败');
  } finally {
    namespacesLoading.value = false;
  }
};

const fetchWorkloads = async () => {
  if (!selectedCluster.value || !selectedNamespace.value) return;
  dataLoading.value = true;
  try {
    const [deployRes, hpaRes] = await Promise.all([
      getDeployments(selectedCluster.value, selectedNamespace.value),
      getHPAs(selectedCluster.value, selectedNamespace.value)
    ]);
    
    hpas.value = hpaRes.items;
    workloads.value = deployRes.items.map(item => {
      const boundHpa = hpaRes.items.find(hpa => 
        (hpa.spec.scaleTargetRef.kind || '').toLowerCase() === (item.kind || 'Deployment').toLowerCase() && 
        hpa.spec.scaleTargetRef.name === item.metadata.name
      );
      
      return {
        ...item,
        kind: item.kind || 'Deployment',
        _newReplicas: item.spec?.replicas || 0,
        _loading: false,
        _hpaMin: boundHpa?.spec.minReplicas || 0,
        _hpaMax: boundHpa?.spec.maxReplicas || 0,
        _hpaLoading: false,
      };
    });
  } catch (e: any) {
    MessagePlugin.error('加载资源列表失败');
  } finally {
    dataLoading.value = false;
  }
};

const getBoundHpa = (workload: Deployment) => {
  return hpas.value.find(hpa => 
    (hpa.spec.scaleTargetRef.kind || '').toLowerCase() === (workload.kind || 'Deployment').toLowerCase() && 
    hpa.spec.scaleTargetRef.name === workload.metadata.name
  );
};

const handleUpdateHpaRange = async (row: any) => {
  const hpa = getBoundHpa(row);
  if (!hpa) return;

  row._hpaLoading = true;
  try {
    await patchHPA(selectedCluster.value, selectedNamespace.value, hpa.metadata.name, {
      minReplicas: row._hpaMin,
      maxReplicas: row._hpaMax,
    });
    MessagePlugin.success(`HPA ${hpa.metadata.name} 范围已更新`);
    fetchWorkloads();
  } catch (e: any) {
    MessagePlugin.error(e.message || '更新 HPA 失败');
  } finally {
    row._hpaLoading = false;
  }
};

const handleQuickScale = async (row: any) => {
  row._loading = true;
  try {
    await quickScaleWorkload(selectedCluster.value, {
      namespace: selectedNamespace.value,
      kind: row.kind,
      name: row.metadata.name,
      replicas: row._newReplicas
    });
    MessagePlugin.success('扩缩容指令已发送');
    // 延迟刷新列表以看到状态变化
    setTimeout(fetchWorkloads, 2000);
  } catch (e: any) {
    MessagePlugin.error(e.message || '操作失败');
  } finally {
    row._loading = false;
  }
};

onMounted(() => {
  fetchClusters();
});
</script>

<style lang="less" scoped>
.scaling-container {
  margin: 16px;
  padding: 24px;
}

.header {
  margin-bottom: 32px;
  .title {
    font-size: 24px;
    font-weight: 600;
    color: var(--td-text-color-primary);
    margin-bottom: 8px;
  }
  .description {
    color: var(--td-text-color-secondary);
    font-size: 14px;
  }
}

.select-form {
  margin-bottom: 24px;
  background-color: var(--td-bg-color-container-hover);
  padding: 20px;
  border-radius: var(--td-radius-medium);
}

.workload-table {
  background: #fff;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  .kind-tag {
    font-size: 10px;
    background: var(--td-brand-color-light);
    color: var(--td-brand-color);
    padding: 2px 6px;
    border-radius: 4px;
  }
  .resource-name {
    font-weight: 500;
  }
}

.replica-cell {
  font-family: monospace;
}

.hpa-cell {
  .hpa-name {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--td-brand-color);
    margin-bottom: 8px;
  }
  .hpa-range-edit {
    display: flex;
    align-items: center;
    gap: 4px;
    .range-sep {
      color: var(--td-text-color-secondary);
    }
  }
}

.op-cell {
  display: flex;
  align-items: center;
}
</style>
