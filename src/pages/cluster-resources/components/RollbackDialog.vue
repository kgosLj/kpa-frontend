<template>
  <t-dialog
    :visible="localVisible"
    header="资源版本回滚"
    width="900px"
    :confirm-btn="confirmBtn"
    :cancel-btn="{ content: '取消' }"
    @confirm="handleConfirm"
    @close="handleClose"
  >
    <div class="rollback-container">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container">
        <t-loading text="正在加载历史版本..." />
      </div>

      <!-- 历史版本列表 -->
      <template v-else-if="versions.length > 0">
        <t-alert theme="info" message="选择要回滚到的历史版本" style="margin-bottom: 16px" />

        <t-table
          :data="versions"
          :columns="columns"
          row-key="id"
          :selected-row-keys="selectedRowKeys"
          @select-change="handleSelectChange"
          max-height="400"
        >
          <template #version="{ row }">
            <t-tag theme="primary" variant="light">v{{ row.version }}</t-tag>
          </template>

          <template #created_at="{ row }">
            {{ formatTime(row.created_at) }}
          </template>

          <template #description="{ row }">
            <span class="description">{{ row.description || '-' }}</span>
          </template>

          <template #operation="{ row }">
            <t-button
              theme="primary"
              variant="text"
              size="small"
              @click="handlePreview(row)"
            >
              查看 YAML
            </t-button>
          </template>
        </t-table>

        <!-- 警告提示 -->
        <t-alert
          v-if="selectedVersion"
          theme="warning"
          style="margin-top: 16px"
        >
          <template #message>
            <strong>⚠️ 回滚警告</strong>
            <p style="margin: 8px 0 0 0">
              即将回滚到版本 <strong>v{{ selectedVersion.version }}</strong>，
              创建于 {{ formatTime(selectedVersion.created_at) }}。
              回滚操作将替换当前资源配置，请确认后继续。
            </p>
          </template>
        </t-alert>
      </template>

      <!-- 空状态 -->
      <t-empty v-else description="暂无历史版本" />
    </div>

    <!-- YAML 预览对话框 -->
    <t-dialog
      v-model:visible="yamlDialogVisible"
      header="YAML 预览"
      width="800px"
      :footer="false"
    >
      <div v-if="loadingYaml" class="loading-container">
        <t-loading text="正在加载 YAML..." />
      </div>
      <pre v-else class="yaml-preview">{{ previewYaml }}</pre>
    </t-dialog>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import type { HistoryVersion } from '@/api/rollback';
import { getHistoryByVersion } from '@/api/rollback';

interface Props {
  visible: boolean;
  versions: HistoryVersion[];
  loading?: boolean;
  clusterId: string;
  namespace: string;
  name: string;
  kind: 'Deployment' | 'Service' | 'ConfigMap';
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm', version: number): void;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<Emits>();

const selectedRowKeys = ref<(string | number)[]>([]);
const yamlDialogVisible = ref(false);
const loadingYaml = ref(false);
const previewYaml = ref('');

const localVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
});

const selectedVersion = computed(() => {
  if (selectedRowKeys.value.length === 0) return null;
  return props.versions.find((v) => v.id === selectedRowKeys.value[0]);
});

const confirmBtn = computed(() => ({
  content: '确认回滚',
  loading: props.loading,
  disabled: props.loading || !selectedVersion.value,
}));

const columns = [
  {
    colKey: 'row-select',
    type: 'single' as const,
    width: 50,
  },
  {
    colKey: 'version',
    title: '版本',
    width: 100,
  },
  {
    colKey: 'created_at',
    title: '创建时间',
    width: 180,
  },
  {
    colKey: 'created_by',
    title: '创建者',
    width: 150,
  },
  {
    colKey: 'description',
    title: '描述',
    ellipsis: true,
  },
  {
    colKey: 'operation',
    title: '操作',
    width: 120,
    align: 'center' as const,
  },
];

const formatTime = (time: string) => {
  const date = new Date(time);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const handleSelectChange = (value: (string | number)[]) => {
  selectedRowKeys.value = value;
};

const handlePreview = async (row: HistoryVersion) => {
  try {
    loadingYaml.value = true;
    yamlDialogVisible.value = true;

    const response = await getHistoryByVersion(props.clusterId, {
      namespace: props.namespace,
      name: props.name,
      kind: props.kind,
      version: row.version,
    });

    previewYaml.value = response.yaml_content || '';
  } catch (error: any) {
    MessagePlugin.error(error.message || '加载 YAML 失败');
    yamlDialogVisible.value = false;
  } finally {
    loadingYaml.value = false;
  }
};

const handleConfirm = () => {
  if (!selectedVersion.value) {
    MessagePlugin.warning('请选择要回滚的版本');
    return;
  }
  emit('confirm', selectedVersion.value.version);
};

const handleClose = () => {
  selectedRowKeys.value = [];
  emit('update:visible', false);
};

// 监听对话框关闭，重置选择
watch(localVisible, (newVal) => {
  if (!newVal) {
    selectedRowKeys.value = [];
  }
});
</script>

<style lang="less" scoped>
.rollback-container {
  max-height: 70vh;
  overflow-y: auto;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.description {
  color: var(--td-text-color-secondary);
}

.yaml-preview {
  margin: 0;
  padding: 16px;
  background: var(--td-bg-color-page);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-default);
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
  max-height: 500px;
  overflow: auto;
  white-space: pre;
}
</style>
