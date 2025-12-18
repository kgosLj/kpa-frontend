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
      <!-- 变更摘要 -->
      <div v-if="diffData" class="summary-section">
        <t-alert v-if="!diffData.exists" theme="info" message="资源不存在，将创建新资源" />
        <t-alert v-else theme="warning" :message="`检测到 ${diffData.changes.length} 处变更`" />
        
        <!-- 变更列表 -->
        <div v-if="diffData.exists && diffData.changes.length > 0" class="changes-list">
          <h4>变更详情:</h4>
          <div class="change-item" v-for="(change, idx) in diffData.changes" :key="idx">
            <t-tag 
              :theme="getChangeTheme(change.type)" 
              size="small"
              variant="outline"
            >
              {{ getChangeLabel(change.type) }}
            </t-tag>
            <span class="change-path">{{ change.path }}</span>
            <div v-if="change.old_value" class="change-value">
              <small>旧值:</small> <code>{{ truncate(change.old_value) }}</code>
            </div>
            <div v-if="change.new_value" class="change-value">
              <small>新值:</small> <code>{{ truncate(change.new_value) }}</code>
            </div>
          </div>
        </div>
      </div>

      <!-- YAML 对比 -->
      <div v-if="diffData && diffData.exists" class="yaml-comparison">
        <div class="yaml-panel">
          <h4>当前版本</h4>
          <pre class="yaml-content">{{ diffData.old_yaml }}</pre>
        </div>
        <div class="yaml-panel">
          <h4>新版本</h4>
          <pre class="yaml-content">{{ diffData.new_yaml }}</pre>
        </div>
      </div>

      <!-- Diff 文本 -->
      <div v-if="diffData && diffData.diff_text" class="diff-text-section">
        <h4>Diff 输出:</h4>
        <pre class="diff-text">{{ diffData.diff_text }}</pre>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container">
        <t-loading text="正在对比资源..." />
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ResourceDiffResponse } from '@/api/k8s-resources';

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

const truncate = (text: string, maxLength = 100) => {
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

.summary-section {
  margin-bottom: var(--td-comp-margin-l);

  .changes-list {
    margin-top: var(--td-comp-margin-m);
    padding: var(--td-comp-paddingTB-m) var(--td-comp-paddingLR-m);
    background: var(--td-bg-color-container);
    border-radius: var(--td-radius-default);

    h4 {
      margin: 0 0 var(--td-comp-margin-s) 0;
      font-size: 14px;
      font-weight: 500;
    }

    .change-item {
      padding: 8px 0;
      border-bottom: 1px solid var(--td-border-level-1-color);

      &:last-child {
        border-bottom: none;
      }

      .change-path {
        margin-left: var(--td-comp-margin-s);
        font-weight: 500;
        color: var(--td-text-color-primary);
      }

      .change-value {
        margin-left: 24px;
        margin-top: 4px;
        font-size: 12px;
        color: var(--td-text-color-secondary);

        code {
          padding: 2px 6px;
          background: var(--td-bg-color-page);
          border-radius: 3px;
          font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
        }
      }
    }
  }
}

.yaml-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--td-comp-margin-m);
  margin-bottom: var(--td-comp-margin-l);

  .yaml-panel {
    h4 {
      margin: 0 0 var(--td-comp-margin-s) 0;
      font-size: 14px;
      font-weight: 500;
    }

    .yaml-content {
      margin: 0;
      padding: var(--td-comp-paddingTB-m) var(--td-comp-paddingLR-m);
      background: var(--td-bg-color-page);
      border: 1px solid var(--td-border-level-1-color);
      border-radius: var(--td-radius-default);
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 12px;
      line-height: 1.6;
      max-height: 400px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
  }
}

.diff-text-section {
  h4 {
    margin: 0 0 var(--td-comp-margin-s) 0;
    font-size: 14px;
    font-weight: 500;
  }

  .diff-text {
    margin: 0;
    padding: var(--td-comp-paddingTB-m) var(--td-comp-paddingLR-m);
    background: var(--td-bg-color-page);
    border: 1px solid var(--td-border-level-1-color);
    border-radius: var(--td-radius-default);
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.6;
    max-height: 400px;
    overflow-y: auto;
    white-space: pre;
  }
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}
</style>
