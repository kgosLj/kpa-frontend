<template>
  <t-card title="最近活动" :bordered="false" class="activity-card">
    <template #actions>
      <t-link theme="primary" @click="$router.push('/operations/audit-logs')">查看全部</t-link>
    </template>
    
    <t-loading :loading="loading" size="small">
      <div v-if="activities.length > 0" class="activity-list">
        <div v-for="(item, index) in activities" :key="index" class="activity-item">
          <div class="activity-content">
            <div class="activity-left">
              <t-tag size="small" variant="light" :theme="getOperationTheme(item.operation_type) as any">
                {{ item.operation_type }}
              </t-tag>
            </div>
            <div class="activity-right">
              <div class="activity-text">
                <span class="activity-user">{{ item.username }}</span>
                <span class="activity-action">{{ getActionText(item.operation_type) }}</span>
                <span class="activity-resource">{{ item.resource_type }} "{{ item.resource_name }}"</span>
                <span v-if="item.namespace" class="activity-namespace">在 {{ item.namespace }}</span>
              </div>
              <div class="activity-time">
                {{ formatTime(item.timestamp) }}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <t-empty v-else description="暂无最近活动" />
    </t-loading>
  </t-card>
</template>

<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { LayersIcon, ServerIcon, TimeIcon, AddIcon, EditIcon, DeleteIcon, SettingIcon } from 'tdesign-icons-vue-next';
import { onMounted, ref } from 'vue';
import { getAuditLogs, type AuditLogItem } from '@/api/audit';

defineOptions({
  name: 'RecentActivity',
});

const props = defineProps<{
  clusterId?: string;
  limit?: number;
}>();

const loading = ref(false);
const activities = ref<AuditLogItem[]>([]);

// 获取最近活动
const fetchRecentActivities = async () => {
  loading.value = true;
  try {
    const params: any = {
      page: 1,
      page_size: props.limit || 10,
    };
    
    if (props.clusterId) {
      // 如果指定了集群，可以过滤（需要先获取集群名称）
      // params.cluster_id = props.clusterId;
    }
    
    const res = await getAuditLogs(params);
    activities.value = res.items || [];
  } catch (error) {
    console.error('Failed to fetch recent activities:', error);
    MessagePlugin.error('获取最近活动失败');
  } finally {
    loading.value = false;
  }
};

// 获取操作类型
const getOperationType = (operationType: string): string => {
  const typeMap: Record<string, string> = {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    PATCH: 'update',
  };
  return typeMap[operationType] || 'default';
};

// 获取操作图标
const getOperationIcon = (operationType: string) => {
  const iconMap: Record<string, any> = {
    CREATE: AddIcon,
    UPDATE: EditIcon,
    DELETE: DeleteIcon,
    PATCH: SettingIcon,
  };
  return iconMap[operationType] || SettingIcon;
};

// 获取操作主题色
const getOperationTheme = (operationType: string): string => {
  const themeMap: Record<string, string> = {
    CREATE: 'success',
    UPDATE: 'warning',
    DELETE: 'danger',
    PATCH: 'primary',
  };
  return themeMap[operationType] || 'default';
};

// 获取操作文本
const getActionText = (operationType: string): string => {
  const actionMap: Record<string, string> = {
    CREATE: '创建了',
    UPDATE: '更新了',
    DELETE: '删除了',
    PATCH: '修改了',
  };
  return actionMap[operationType] || '操作了';
};

// 格式化时间
const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // 小于 1 分钟
  if (diff < 60000) {
    return '刚刚';
  }
  
  // 小于 1 小时
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} 分钟前`;
  }
  
  // 小于 24 小时
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} 小时前`;
  }
  
  // 大于 24 小时，显示具体日期
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hour}:${minute}`;
};

onMounted(() => {
  fetchRecentActivities();
});

defineExpose({
  refresh: fetchRecentActivities,
});
</script>

<style lang="less" scoped>
.activity-card {
  height: 100%;
  
  :deep(.t-card__body) {
    padding: 0;
    max-height: 500px;
    overflow-y: auto;
  }
}

.activity-list {
  display: flex;
  flex-direction: column;
}

.activity-item {
  padding: 12px 24px;
  border-bottom: 1px solid var(--td-component-border);
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: var(--td-bg-color-container-hover);
  }
  
  &:last-child {
    border-bottom: none;
  }
}

.activity-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.activity-left {
  flex-shrink: 0;
}

.activity-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.activity-text {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  line-height: 1.6;
  font-size: 14px;
}

.activity-user {
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.activity-action {
  color: var(--td-text-color-secondary);
}

.activity-resource {
  color: var(--td-brand-color);
  font-weight: 500;
}

.activity-namespace {
  color: var(--td-text-color-placeholder);
  font-size: 13px;
}

.activity-time {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}
</style>
