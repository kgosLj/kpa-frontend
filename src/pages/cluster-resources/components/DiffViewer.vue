<template>
  <div class="diff-viewer">
    <!-- 视图模式切换 -->
    <div class="diff-controls">
      <t-radio-group v-model="viewMode" variant="default-filled" size="small">
        <t-radio-button value="split">并排对比</t-radio-button>
        <t-radio-button value="unified">统一视图</t-radio-button>
      </t-radio-group>
    </div>

    <!-- Diff 内容 -->
    <div class="diff-content">
      <!-- 标签头部 -->
      <div v-if="viewMode === 'split'" class="diff-labels">
        <div class="diff-label old-label">📄 原 YAML（当前集群）</div>
        <div class="diff-label new-label">📝 新 YAML（待部署）</div>
      </div>
      <div v-else class="diff-labels unified">
        <div class="diff-label">🔄 变更对比（红色=删除，绿色=新增）</div>
      </div>
      
      <code-diff
        :old-string="oldContent"
        :new-string="newContent"
        :output-format="viewMode === 'split' ? 'side-by-side' : 'line-by-line'"
        :context="10"
        language="yaml"
        :hideStat="false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { CodeDiff } from 'v-code-diff';

interface Props {
  oldContent: string;
  newContent: string;
  defaultMode?: 'split' | 'unified';
}

const props = withDefaults(defineProps<Props>(), {
  oldContent: '',
  newContent: '',
  defaultMode: 'split',
});

const viewMode = ref<'split' | 'unified'>(props.defaultMode);
</script>

<style lang="less" scoped>
.diff-viewer {
  .diff-controls {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 12px;
  }

  .diff-content {
    border: 1px solid var(--td-border-level-1-color);
    border-radius: var(--td-radius-default);
    overflow: hidden;

    .diff-labels {
      display: flex;
      border-bottom: 1px solid var(--td-border-level-1-color);
      background: var(--td-bg-color-container);
      
      .diff-label {
        flex: 1;
        padding: 8px 12px;
        font-size: 13px;
        font-weight: 500;
        
        &.old-label {
          color: var(--td-error-color);
          border-right: 1px solid var(--td-border-level-1-color);
        }
        
        &.new-label {
          color: var(--td-success-color);
        }
      }
      
      &.unified {
        justify-content: center;
        
        .diff-label {
          flex: none;
          text-align: center;
          color: var(--td-brand-color);
        }
      }
    }

    :deep(.d2h-wrapper) {
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 12px;
    }

    :deep(.d2h-file-header) {
      display: none;
    }

    :deep(.d2h-code-line) {
      padding: 0 8px;
    }

    :deep(.d2h-code-side-line) {
      padding: 0 8px;
    }

    :deep(.d2h-diff-table) {
      font-size: 12px;
    }

    :deep(.d2h-file-diff) {
      max-height: 500px;
      overflow: auto;
    }
  }
}
</style>
