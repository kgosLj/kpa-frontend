<template>
  <t-dialog
    :visible="localVisible"
    header="资源变更预览"
    width="1200px"
    :confirm-btn="confirmBtn"
    :cancel-btn="{ content: '取消' }"
    @confirm="handleConfirm"
    @close="handleClose"
  >
    <div class="diff-container">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container">
        <t-loading text="正在对比资源..." />
      </div>

      <template v-else-if="diffData">
        <!-- 新资源提示 -->
        <t-alert
          v-if="!diffData.exists"
          theme="info"
          message="资源不存在，将创建新资源"
          style="margin-bottom: 16px"
        />

        <!-- 风险提示 -->
        <t-alert
          v-if="hasHighRisk"
          theme="warning"
          style="margin-bottom: 16px"
        >
          <template #message>
            <strong>⚠️ 检测到高风险变更</strong>
            <ul class="risk-list">
              <li v-for="(risk, idx) in riskWarnings" :key="idx">{{ risk }}</li>
            </ul>
          </template>
        </t-alert>



        <!-- Diff 视图 -->
        <div v-if="diffData.exists && diffData.old_yaml" class="diff-section">
          <diff-viewer
            :old-content="diffData.old_yaml"
            :new-content="diffData.new_yaml"
          />
        </div>

        <!-- 新资源预览 -->
        <div v-if="!diffData.exists" class="new-resource-preview">
          <h4>新资源配置：</h4>
          <pre class="yaml-preview">{{ diffData.new_yaml }}</pre>
        </div>
      </template>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ResourceDiffResponse, ResourceChange } from '@/api/k8s-resources';
import DiffViewer from './DiffViewer.vue';

interface Props {
  visible: boolean;
  diffData: ResourceDiffResponse | null;
  loading?: boolean;
  confirmText?: string;
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm'): void;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  confirmText: '确认部署',
});

const emit = defineEmits<Emits>();

const localVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
});

const confirmBtn = computed(() => ({
  content: props.confirmText,
  loading: props.loading,
  disabled: props.loading,
}));



// 检测高风险变更
const riskWarnings = computed(() => {
  const warnings: string[] = [];
  if (!props.diffData?.changes) return warnings;

  for (const change of props.diffData.changes) {
    // 副本数大幅减少
    if (change.path.includes('replicas') && change.type === 'modify') {
      const oldVal = parseInt(change.old_value || '0', 10);
      const newVal = parseInt(change.new_value || '0', 10);
      if (oldVal > 0 && newVal < oldVal * 0.5) {
        warnings.push(`副本数大幅减少: ${oldVal} → ${newVal}`);
      }
    }

    // 删除健康检查
    if (change.path.includes('livenessProbe') && change.type === 'remove') {
      warnings.push('删除了存活探针 (livenessProbe)');
    }
    if (change.path.includes('readinessProbe') && change.type === 'remove') {
      warnings.push('删除了就绪探针 (readinessProbe)');
    }

    // 镜像改为 latest
    if (change.path.includes('image') && change.new_value?.includes(':latest')) {
      warnings.push('镜像标签使用了 latest（不推荐用于生产环境）');
    }

    // 删除资源限制
    if ((change.path.includes('resources.limits') || change.path.includes('resources.requests')) && change.type === 'remove') {
      warnings.push('删除了资源限制配置');
    }
  }

  return warnings;
});

const hasHighRisk = computed(() => riskWarnings.value.length > 0);

// 格式化路径
const formatPath = (path: string) => {
  return path
    .replace(/^spec\.template\.spec\./, '')
    .replace(/^spec\./, '')
    .replace(/^metadata\./, '');
};

const getChangeTheme = (type: string) => {
  switch (type) {
    case 'add':
      return 'success';
    case 'remove':
      return 'danger';
    case 'modify':
      return 'warning';
    default:
      return 'default';
  }
};

const getChangeLabel = (type: string) => {
  switch (type) {
    case 'add':
      return '新增';
    case 'remove':
      return '删除';
    case 'modify':
      return '修改';
    default:
      return type;
  }
};

const truncate = (text: string, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const handleConfirm = () => {
  emit('confirm');
};

const handleClose = () => {
  emit('update:visible', false);
};
</script>

<style lang="less" scoped>
.diff-container {
  max-height: 70vh;
  overflow-y: auto;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.risk-list {
  margin: 8px 0 0 0;
  padding-left: 20px;

  li {
    margin: 4px 0;
  }
}



.diff-section {
  margin-bottom: 16px;
}

.new-resource-preview {
  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 500;
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
    max-height: 400px;
    overflow: auto;
    white-space: pre;
  }
}
</style>
