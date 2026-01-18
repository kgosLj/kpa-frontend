<template>
  <div class="image-repository-container">
    <t-card :bordered="false">
      <t-row justify="space-between" class="operation-row">
        <div class="left-operation">
          <t-button @click="handleAdd">
            <template #icon><add-icon /></template>
            新增镜像仓库
          </t-button>
        </div>
        <div class="right-operation">
          <t-input
            v-model="searchName"
            placeholder="搜索镜像仓库名称"
            clearable
            style="width: 300px"
          >
            <template #prefix-icon>
              <search-icon />
            </template>
          </t-input>
        </div>
      </t-row>

      <t-loading :loading="loading" size="large">
        <div class="repository-grid">
          <t-card
            v-for="repo in filteredRepositories"
            :key="repo.id"
            class="repository-card"
            hover-shadow
          >
            <template #header>
              <div class="card-header">
                <div class="repo-name">{{ repo.name }}</div>
                <t-tag :theme="repo.type === 'tencent' ? 'success' : 'primary'" variant="light">
                  {{ repo.type === 'tencent' ? '腾讯云 TCR' : 'Harbor' }}
                </t-tag>
              </div>
            </template>

            <div class="card-content">
              <div class="info-item">
                <span class="label">{{ repo.type === 'tencent' ? '镜像地址:' : '端点地址:' }}</span>
                <span class="value">{{ repo.endpoint }}</span>
              </div>
              <div class="info-item">
                <span class="label">所属项目:</span>
                <span class="value">{{ getProjectName(repo.project_id) }}</span>
              </div>
              <div class="info-item">
                <span class="label">区域:</span>
                <span class="value">{{ repo.region || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">状态:</span>
                <t-tag :theme="repo.status === 0 ? 'success' : 'danger'" size="small">
                  {{ repo.status === 0 ? '正常' : '禁用' }}
                </t-tag>
              </div>
              <div class="info-item">
                <span class="label">创建时间:</span>
                <span class="value">{{ formatTime(repo.created_at) }}</span>
              </div>
            </div>

            <template #footer>
              <div class="card-actions">
                <t-button theme="primary" variant="text" size="small" @click="handleViewImages(repo)">
                  <template #icon><view-list-icon /></template>
                  查看镜像
                </t-button>
                <t-button theme="default" variant="text" size="small" @click="handleEdit(repo)">
                  <template #icon><edit-icon /></template>
                  编辑
                </t-button>
                <t-button theme="default" variant="text" size="small" @click="handleTest(repo)">
                  <template #icon><link-icon /></template>
                  测试连接
                </t-button>
                <t-popconfirm
                  content="确定删除该镜像仓库吗？"
                  @confirm="handleDelete(repo.id)"
                >
                  <t-button theme="danger" variant="text" size="small">
                    <template #icon><delete-icon /></template>
                    删除
                  </t-button>
                </t-popconfirm>
              </div>
            </template>
          </t-card>

          <t-empty v-if="filteredRepositories.length === 0" description="暂无镜像仓库" />
        </div>
      </t-loading>
    </t-card>

    <!-- 新增/编辑对话框 -->
    <repository-form
      v-model:visible="formVisible"
      :repository="editingRepository"
      @success="handleFormSuccess"
    />

    <!-- 查看镜像对话框 -->
    <t-dialog
      v-model:visible="imagesDialogVisible"
      :header="`${currentRepository?.name} - 镜像列表`"
      width="900px"
      :footer="false"
    >
      <t-loading :loading="imagesLoading">
        <t-table
          :data="images"
          :columns="imageColumns"
          row-key="digest"
          size="small"
          :pagination="{ defaultPageSize: 10 }"
          :empty="{ text: '暂无镜像' }"
        >
          <template #size="{ row }">
            {{ formatSize(row.size) }}
          </template>
          <template #pushed_at="{ row }">
            {{ formatImageTime(row.pushed_at) }}
          </template>
        </t-table>
      </t-loading>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { AddIcon, SearchIcon, EditIcon, DeleteIcon, LinkIcon, ViewListIcon } from 'tdesign-icons-vue-next';
import { getRepositoryList, deleteRepository, testConnection, fetchImages } from '@/api/image-repository';
import { getProjectList } from '@/api/project';
import RepositoryForm from './components/RepositoryForm.vue';
import type { ImageRepository, Image } from '@/types/repository';

const loading = ref(false);
const repositories = ref<ImageRepository[]>([]);
const projects = ref<any[]>([]);
const searchName = ref('');
const formVisible = ref(false);
const editingRepository = ref<ImageRepository | null>(null);

// 镜像对话框相关
const imagesDialogVisible = ref(false);
const imagesLoading = ref(false);
const images = ref<Image[]>([]);
const currentRepository = ref<ImageRepository | null>(null);

const imageColumns = [
  { colKey: 'name', title: '镜像名称', width: 200 },
  { colKey: 'tag', title: '标签', width: 150 },
  { colKey: 'size', title: '大小', width: 120, cell: 'size' },
  { colKey: 'pushed_at', title: '推送时间', width: 180, cell: 'pushed_at' },
  { colKey: 'full_path', title: '完整路径', ellipsis: true },
];

// 过滤后的仓库列表
const filteredRepositories = computed(() => {
  if (!searchName.value) {
    return repositories.value;
  }
  return repositories.value.filter((repo) =>
    repo.name.toLowerCase().includes(searchName.value.toLowerCase()),
  );
});

// 获取项目列表
const fetchProjects = async () => {
  try {
    const res = await getProjectList();
    projects.value = res || [];
  } catch (error: any) {
    console.error('Failed to load projects:', error);
  }
};

// 获取项目名称
const getProjectName = (projectId: string) => {
  const project = projects.value.find((p) => p.id === projectId);
  return project ? project.name : projectId;
};

// 获取仓库列表
const fetchRepositories = async () => {
  loading.value = true;
  try {
    const res = await getRepositoryList();
    // 防御性编程：处理后端可能返回 null 的情况
    repositories.value = res || [];
  } catch (error: any) {
    MessagePlugin.error(error.message || '获取镜像仓库列表失败');
    repositories.value = [];
  } finally {
    loading.value = false;
  }
};

// 查看镜像
const handleViewImages = async (repo: ImageRepository) => {
  currentRepository.value = repo;
  imagesDialogVisible.value = true;
  imagesLoading.value = true;
  
  try {
    const res = await fetchImages(repo.id);
    images.value = res || [];
  } catch (error: any) {
    MessagePlugin.error(error.message || '获取镜像列表失败');
    images.value = [];
  } finally {
    imagesLoading.value = false;
  }
};

// 新增仓库
const handleAdd = () => {
  editingRepository.value = null;
  formVisible.value = true;
};

// 编辑仓库
const handleEdit = (repo: ImageRepository) => {
  editingRepository.value = repo;
  formVisible.value = true;
};

// 删除仓库
const handleDelete = async (id: string) => {
  try {
    await deleteRepository(id);
    MessagePlugin.success('删除成功');
    fetchRepositories();
  } catch (error: any) {
    MessagePlugin.error(error.message || '删除失败');
  }
};

// 测试连接
const handleTest = async (repo: ImageRepository) => {
  let loadingMsg;
  try {
    loadingMsg = MessagePlugin.loading('正在测试连接...', 0);
    await testConnection(repo.id);
    MessagePlugin.close(loadingMsg);
    MessagePlugin.success('连接成功');
  } catch (error: any) {
    if (loadingMsg) {
      MessagePlugin.close(loadingMsg);
    }
    MessagePlugin.error(error.message || '连接失败');
  }
};

// 表单提交成功
const handleFormSuccess = () => {
  fetchRepositories();
};

// 格式化时间
const formatTime = (time: string) => {
  return new Date(time).toLocaleString('zh-CN');
};

// 格式化镜像时间
const formatImageTime = (time: string) => {
  const date = new Date(time);
  return date.toLocaleString('zh-CN');
};

// 格式化大小
const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

onMounted(async () => {
  await fetchProjects(); // 先加载项目列表
  await fetchRepositories();
});
</script>

<style lang="less" scoped>
.image-repository-container {
  padding: 20px;
}

.operation-row {
  margin-bottom: 20px;
}

.repository-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.repository-card {
  :deep(.t-card__header) {
    padding: 16px 20px;
    border-bottom: 1px solid var(--td-component-border);
  }

  :deep(.t-card__body) {
    padding: 20px;
  }

  :deep(.t-card__footer) {
    padding: 12px 20px;
    border-top: 1px solid var(--td-component-border);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .repo-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--td-text-color-primary);
  }
}

.card-content {
  .info-item {
    display: flex;
    margin-bottom: 12px;
    font-size: 14px;

    &:last-child {
      margin-bottom: 0;
    }

    .label {
      min-width: 80px;
      color: var(--td-text-color-secondary);
    }

    .value {
      flex: 1;
      color: var(--td-text-color-primary);
      word-break: break-all;
    }
  }
}

.card-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-start;
}
</style>
