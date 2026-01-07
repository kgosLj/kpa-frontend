<template>
  <div class="audit-logs-container">
    <t-card :bordered="false">
      <!-- 查询表单 -->
      <div class="filter-section">
        <t-form :data="filterData" layout="inline" @submit="handleSearch" @reset="handleReset">
          <t-form-item label="集群" name="cluster_name">
            <t-select
              v-model="filterData.cluster_name"
              placeholder="请选择集群"
              clearable
              filterable
              style="width: 200px"
            >
              <t-option
                v-for="cluster in clusters"
                :key="cluster.id"
                :value="cluster.name"
                :label="cluster.name"
              />
            </t-select>
          </t-form-item>

          <t-form-item label="用户名" name="username">
            <t-input
              v-model="filterData.username"
              placeholder="请输入用户名"
              clearable
              style="width: 180px"
            />
          </t-form-item>

          <t-form-item label="资源类型" name="resource_type">
            <t-select
              v-model="filterData.resource_type"
              placeholder="请选择资源类型"
              clearable
              style="width: 180px"
            >
              <t-option value="deployment" label="Deployment" />
              <t-option value="service" label="Service" />
              <t-option value="pod" label="Pod" />
              <t-option value="configmap" label="ConfigMap" />
              <t-option value="secret" label="Secret" />
              <t-option value="cluster" label="Cluster" />
              <t-option value="namespace" label="Namespace" />
              <t-option value="project" label="Project" />
            </t-select>
          </t-form-item>

          <t-form-item label="操作类型" name="operation_type">
            <t-select
              v-model="filterData.operation_type"
              placeholder="请选择操作类型"
              clearable
              style="width: 180px"
            >
              <t-option value="CREATE" label="创建" />
              <t-option value="UPDATE" label="更新" />
              <t-option value="DELETE" label="删除" />
              <t-option value="SCALE" label="扩缩容" />
              <t-option value="RESTART" label="重启" />
              <t-option value="EXEC" label="执行命令" />
              <t-option value="LOGS" label="查看日志" />
            </t-select>
          </t-form-item>

          <t-form-item label="时间范围" name="dateRange">
            <t-date-range-picker
              v-model="dateRange"
              clearable
              placeholder="选择时间范围"
              style="width: 360px"
              enable-time-picker
              format="YYYY-MM-DD HH:mm:ss"
              :presets="datePresets"
            />
          </t-form-item>

          <t-form-item>
            <t-space>
              <t-button theme="primary" type="submit" :loading="loading">
                <template #icon><search-icon /></template>
                查询
              </t-button>
              <t-button theme="default" type="reset">
                <template #icon><refresh-icon /></template>
                重置
              </t-button>
            </t-space>
          </t-form-item>
        </t-form>
      </div>

      <t-divider />

      <!-- 统计信息 -->
      <div v-if="stats" class="stats-section">
        <t-row :gutter="16">
          <t-col :span="6">
            <div class="stat-card stat-total">
              <div class="stat-icon">
                <file-icon size="32px" />
              </div>
              <div class="stat-content">
                <div class="stat-value">{{ stats.total }}</div>
                <div class="stat-label">总记录数</div>
              </div>
            </div>
          </t-col>
          <t-col :span="6">
            <div class="stat-card stat-create">
              <div class="stat-icon">
                <add-icon size="32px" />
              </div>
              <div class="stat-content">
                <div class="stat-value">{{ stats.create }}</div>
                <div class="stat-label">创建操作</div>
              </div>
            </div>
          </t-col>
          <t-col :span="6">
            <div class="stat-card stat-update">
              <div class="stat-icon">
                <edit-icon size="32px" />
              </div>
              <div class="stat-content">
                <div class="stat-value">{{ stats.update }}</div>
                <div class="stat-label">更新操作</div>
              </div>
            </div>
          </t-col>
          <t-col :span="6">
            <div class="stat-card stat-delete">
              <div class="stat-icon">
                <delete-icon size="32px" />
              </div>
              <div class="stat-content">
                <div class="stat-value">{{ stats.delete }}</div>
                <div class="stat-label">删除操作</div>
              </div>
            </div>
          </t-col>
        </t-row>
      </div>

      <!-- 数据表格 -->
      <div class="table-section">
        <t-table
          :data="auditLogs"
          :columns="columns"
          :loading="loading"
          :pagination="pagination"
          row-key="id"
          :scroll="{ x: 1400 } as any"
          @page-change="handlePageChange"
        >
          <!-- 时间列 -->
          <template #timestamp="{ row }">
            <div class="timestamp-cell">
              <div class="timestamp-date">{{ formatDate(row.timestamp) }}</div>
              <div class="timestamp-time">{{ formatTime(row.timestamp) }}</div>
            </div>
          </template>

          <!-- 操作类型列 -->
          <template #operation_type="{ row }">
            <t-tag :theme="getOperationTheme(row.operation_type)" size="small">
              {{ getOperationLabel(row.operation_type) }}
            </t-tag>
          </template>

          <!-- 资源类型列 -->
          <template #resource_type="{ row }">
            <t-tag :theme="getResourceTheme(row.resource_type)" size="small" variant="light">
              {{ getResourceLabel(row.resource_type) }}
            </t-tag>
          </template>
        </t-table>
      </div>
    </t-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import dayjs from 'dayjs';
import { MessagePlugin } from 'tdesign-vue-next';
import {
  SearchIcon,
  RefreshIcon,
  FileIcon,
  AddIcon,
  EditIcon,
  DeleteIcon,
} from 'tdesign-icons-vue-next';
import { getAuditLogs, type AuditLogQueryParams, type AuditLogItem } from '@/api/audit';
import { getClusterList, type Cluster } from '@/api/cluster';

const loading = ref(false);
const auditLogs = ref<AuditLogItem[]>([]);
const clusters = ref<Cluster[]>([]);

// 过滤条件
const filterData = ref<AuditLogQueryParams>({
  cluster_name: '',
  username: '',
  resource_type: '',
  operation_type: '',
  page: 1,
  page_size: 20,
});

// 日期范围
const dateRange = ref<[string, string] | null>(null);

// 分页信息
const pagination = computed(() => ({
  current: filterData.value.page || 1,
  pageSize: filterData.value.page_size || 20,
  total: stats.value?.total || 0,
  showSizeChanger: true,
  pageSizeOptions: [10, 20, 50, 100],
}));

// 统计信息
const stats = ref<{
  total: number;
  create: number;
  update: number;
  delete: number;
} | null>(null);

// 日期预设
const datePresets = {
  '最近 1 小时': [dayjs().subtract(1, 'hour').toDate(), dayjs().toDate()],
  '今天': [dayjs().startOf('day').toDate(), dayjs().toDate()],
  '昨天': [dayjs().subtract(1, 'day').startOf('day').toDate(), dayjs().subtract(1, 'day').endOf('day').toDate()],
  '最近 7 天': [dayjs().subtract(7, 'day').toDate(), dayjs().toDate()],
  '最近 30 天': [dayjs().subtract(30, 'day').toDate(), dayjs().toDate()],
} as any;

// 表格列配置
const columns = [
  {
    colKey: 'timestamp',
    title: '时间',
    width: 180,
    fixed: 'left' as const,
  },
  {
    colKey: 'username',
    title: '用户',
    width: 120,
  },
  {
    colKey: 'project_name',
    title: '项目',
    width: 150,
    ellipsis: true,
  },
  {
    colKey: 'cluster_name',
    title: '集群',
    width: 150,
    ellipsis: true,
  },
  {
    colKey: 'namespace',
    title: '命名空间',
    width: 140,
    ellipsis: true,
  },
  {
    colKey: 'resource_type',
    title: '资源类型',
    width: 120,
  },
  {
    colKey: 'resource_name',
    title: '资源名称',
    width: 180,
    ellipsis: true,
  },
  {
    colKey: 'operation_type',
    title: '操作类型',
    width: 100,
  },
];

// 获取日期
function formatDate(timestamp: string): string {
  return dayjs(timestamp).format('YYYY-MM-DD');
}

// 获取时间
function formatTime(timestamp: string): string {
  return dayjs(timestamp).format('HH:mm:ss');
}

// 获取操作类型标签
const getOperationLabel = (type: string): string => {
  const t = type?.toUpperCase();
  const labels: Record<string, string> = {
    CREATE: '创建',
    UPDATE: '更新',
    DELETE: '删除',
    SCALE: '扩缩容',
    RESTART: '重启',
    EXEC: '执行命令',
    LOGS: '查看日志',
  };
  return labels[t] || type;
};

// 获取操作类型主题色
const getOperationTheme = (type: string): any => {
  const t = type?.toUpperCase();
  const themes: Record<string, any> = {
    CREATE: 'success',
    UPDATE: 'warning',
    DELETE: 'danger',
    SCALE: 'primary',
    RESTART: 'primary',
    EXEC: 'default',
    LOGS: 'default',
  };
  return themes[t] || 'default';
};

// 获取资源类型标签
const getResourceLabel = (type: string): string => {
  const labels: Record<string, string> = {
    deployment: 'Deployment',
    service: 'Service',
    pod: 'Pod',
    configmap: 'ConfigMap',
    secret: 'Secret',
    cluster: 'Cluster',
    namespace: 'Namespace',
    project: 'Project',
  };
  return labels[type] || type;
};

// 获取资源类型主题色
const getResourceTheme = (type: string): any => {
  const themes: Record<string, any> = {
    deployment: 'primary',
    service: 'success',
    pod: 'warning',
    configmap: 'info',
    secret: 'danger',
    cluster: 'default',
    namespace: 'default',
    project: 'default',
  };
  return themes[type] || 'default';
};

// 加载审计日志
const loadAuditLogs = async () => {
  loading.value = true;
  try {
    const params = { ...filterData.value };

    // 处理日期范围
    if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
      params.from = new Date(dateRange.value[0]).toISOString();
      params.to = new Date(dateRange.value[1]).toISOString();
    }

    const response = await getAuditLogs(params);
    auditLogs.value = response.items || [];

    // 更新统计
    stats.value = {
      total: response.total || 0,
      create: (response.items || []).filter((item) => item.operation_type?.toUpperCase() === 'CREATE').length,
      update: (response.items || []).filter((item) => item.operation_type?.toUpperCase() === 'UPDATE').length,
      delete: (response.items || []).filter((item) => item.operation_type?.toUpperCase() === 'DELETE').length,
    };
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载审计日志失败');
  } finally {
    loading.value = false;
  }
};

// 加载集群列表
const loadClusters = async () => {
  try {
    clusters.value = await getClusterList();
  } catch (e: any) {
    console.error('加载集群列表失败:', e);
  }
};

// 查询
const handleSearch = () => {
  filterData.value.page = 1;
  loadAuditLogs();
};

// 重置
const handleReset = () => {
  filterData.value = {
    cluster_name: '',
    username: '',
    resource_type: '',
    operation_type: '',
    page: 1,
    page_size: 20,
  };
  dateRange.value = null;
  loadAuditLogs();
};

// 分页变化
const handlePageChange = (pageInfo: any) => {
  filterData.value.page = pageInfo.current;
  filterData.value.page_size = pageInfo.pageSize;
  loadAuditLogs();
};

onMounted(() => {
  loadClusters();
  loadAuditLogs();
});
</script>

<style lang="less" scoped>
.audit-logs-container {
  padding: 16px;
  .filter-section {
    margin-bottom: var(--td-comp-margin-l);
  }

  .stats-section {
    margin-bottom: var(--td-comp-margin-l);

    .stat-card {
      display: flex;
      align-items: center;
      padding: 20px;
      border-radius: 8px;
      background: linear-gradient(135deg, rgba(24, 144, 255, 0.1) 0%, rgba(24, 144, 255, 0.05) 100%);
      border: 1px solid rgba(24, 144, 255, 0.2);

      .stat-icon {
        width: 64px;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: rgba(24, 144, 255, 0.1);
        color: #1890ff;
        margin-right: 16px;
      }

      .stat-content {
        flex: 1;

        .stat-value {
          font-size: 28px;
          font-weight: 600;
          color: var(--td-text-color-primary);
          line-height: 1.2;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 14px;
          color: var(--td-text-color-secondary);
        }
      }

      &.stat-create {
        background: linear-gradient(135deg, rgba(52, 211, 153, 0.1) 0%, rgba(52, 211, 153, 0.05) 100%);
        border-color: rgba(52, 211, 153, 0.2);

        .stat-icon {
          background: rgba(52, 211, 153, 0.1);
          color: #34d399;
        }
      }

      &.stat-update {
        background: linear-gradient(135deg, rgba(250, 173, 20, 0.1) 0%, rgba(250, 173, 20, 0.05) 100%);
        border-color: rgba(250, 173, 20, 0.2);

        .stat-icon {
          background: rgba(250, 173, 20, 0.1);
          color: #faad14;
        }
      }

      &.stat-delete {
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
        border-color: rgba(239, 68, 68, 0.2);

        .stat-icon {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
      }
    }
  }

  .table-section {
    .timestamp-cell {
      .timestamp-date {
        font-size: 14px;
        color: var(--td-text-color-primary);
        font-weight: 500;
      }

      .timestamp-time {
        font-size: 12px;
        color: var(--td-text-color-secondary);
        margin-top: 2px;
      }
    }
  }
}
</style>
