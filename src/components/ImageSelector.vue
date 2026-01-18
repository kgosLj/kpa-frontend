<template>
  <t-dialog
    v-model:visible="dialogVisible"
    header="选择镜像"
    :confirm-btn="{ content: '确认', disabled: !selectedImage }"
    @confirm="handleConfirm"
    @close="handleClose"
    width="900px"
  >
    <div class="image-selector">
      <div class="selector-left">
        <div class="section-title">镜像仓库</div>
        <t-loading :loading="loadingRepos">
          <div class="repo-list">
            <div
              v-for="repo in repositories"
              :key="repo.id"
              class="repo-item"
              :class="{ active: selectedRepoId === repo.id }"
              @click="handleSelectRepo(repo)"
            >
              <div class="repo-info">
                <div class="repo-name">{{ repo.name }}</div>
                <t-tag
                  :theme="repo.type === 'tencent' ? 'success' : 'primary'"
                  size="small"
                  variant="light"
                >
                  {{ repo.type === 'tencent' ? 'TCR' : 'Harbor' }}
                </t-tag>
              </div>
            </div>
            <t-empty v-if="repositories.length === 0" description="暂无镜像仓库" />
          </div>
        </t-loading>
      </div>

      <div class="selector-right">
        <div class="section-title">
          <span>镜像列表</span>
          <t-input
            v-if="selectedRepoId"
            v-model="searchKeyword"
            placeholder="搜索镜像名称或标签"
            clearable
            size="small"
            style="width: 250px"
          >
            <template #prefix-icon>
              <search-icon />
            </template>
          </t-input>
        </div>

        <div v-if="!selectedRepoId" class="empty-hint">
          <t-icon name="arrow-left" size="large" />
          <div>请先选择一个镜像仓库</div>
        </div>

        <t-loading v-else :loading="loadingImages">
          <div class="image-list">
            <div
              v-for="image in filteredImages"
              :key="image.digest"
              class="image-item"
              :class="{ active: selectedImage?.full_path === image.full_path }"
              @click="handleSelectImage(image)"
            >
              <div class="image-info">
                <div class="image-name">
                  <t-icon name="layers" />
                  {{ image.name }}
                </div>
                <div class="image-tag">
                  <t-tag theme="default" size="small">{{ image.tag }}</t-tag>
                </div>
              </div>
              <div class="image-meta">
                <span class="meta-item">{{ formatSize(image.size) }}</span>
                <span class="meta-item">{{ formatTime(image.pushed_at) }}</span>
              </div>
            </div>
            <t-empty v-if="filteredImages.length === 0" description="暂无镜像" />
          </div>
        </t-loading>
      </div>
    </div>

    <template #footer>
      <div v-if="selectedImage" class="selected-info">
        <span class="label">已选择:</span>
        <span class="value">{{ selectedImage.full_path }}</span>
      </div>
    </template>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { SearchIcon } from 'tdesign-icons-vue-next';
import { getRepositoryList, fetchImages } from '@/api/image-repository';
import type { ImageRepository, Image } from '@/types/repository';

interface Props {
  visible: boolean;
  namespace?: string;
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'select', image: Image): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const loadingRepos = ref(false);
const loadingImages = ref(false);
const repositories = ref<ImageRepository[]>([]);
const images = ref<Image[]>([]);
const selectedRepoId = ref<string>('');
const selectedImage = ref<Image | null>(null);
const searchKeyword = ref('');

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

// 过滤后的镜像列表
const filteredImages = computed(() => {
  if (!searchKeyword.value) {
    return images.value;
  }
  const keyword = searchKeyword.value.toLowerCase();
  return images.value.filter(
    (img) =>
      img.name.toLowerCase().includes(keyword) ||
      img.tag.toLowerCase().includes(keyword),
  );
});

// 获取仓库列表
const fetchRepositories = async () => {
  loadingRepos.value = true;
  try {
    const res = await getRepositoryList();
    repositories.value = res;
  } catch (error: any) {
    MessagePlugin.error(error.message || '获取仓库列表失败');
  } finally {
    loadingRepos.value = false;
  }
};

// 选择仓库
const handleSelectRepo = async (repo: ImageRepository) => {
  selectedRepoId.value = repo.id;
  selectedImage.value = null;
  images.value = [];

  loadingImages.value = true;
  try {
    const res = await fetchImages(repo.id, props.namespace);
    images.value = res;
  } catch (error: any) {
    MessagePlugin.error(error.message || '获取镜像列表失败');
  } finally {
    loadingImages.value = false;
  }
};

// 选择镜像
const handleSelectImage = (image: Image) => {
  selectedImage.value = image;
};

// 确认选择
const handleConfirm = () => {
  if (selectedImage.value) {
    emit('select', selectedImage.value);
    dialogVisible.value = false;
  }
};

// 关闭对话框
const handleClose = () => {
  selectedRepoId.value = '';
  selectedImage.value = null;
  images.value = [];
  searchKeyword.value = '';
};

// 格式化大小
const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

// 格式化时间
const formatTime = (time: string) => {
  const date = new Date(time);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;
  if (days < 30) return `${Math.floor(days / 7)} 周前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return date.toLocaleDateString('zh-CN');
};

// 监听对话框打开
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      fetchRepositories();
    }
  },
);
</script>

<style lang="less" scoped>
.image-selector {
  display: flex;
  height: 500px;
  gap: 1px;
  background: var(--td-component-border);
  border: 1px solid var(--td-component-border);
  border-radius: 4px;
  overflow: hidden;
}

.selector-left,
.selector-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--td-bg-color-container);
}

.selector-left {
  max-width: 300px;
}

.section-title {
  padding: 12px 16px;
  font-weight: 600;
  font-size: 14px;
  color: var(--td-text-color-primary);
  background: var(--td-bg-color-container-hover);
  border-bottom: 1px solid var(--td-component-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.repo-list,
.image-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.repo-item,
.image-item {
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;

  &:hover {
    background: var(--td-bg-color-container-hover);
  }

  &.active {
    background: var(--td-brand-color-light);
    border-color: var(--td-brand-color);
  }
}

.repo-info {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .repo-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--td-text-color-primary);
  }
}

.image-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;

  .image-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 500;
    color: var(--td-text-color-primary);
  }
}

.image-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--td-text-color-placeholder);

  .meta-item {
    display: flex;
    align-items: center;
  }
}

.empty-hint {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 12px;
  color: var(--td-text-color-placeholder);
}

.selected-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--td-bg-color-container-hover);
  border-radius: 4px;
  font-size: 13px;

  .label {
    font-weight: 600;
    color: var(--td-text-color-secondary);
  }

  .value {
    color: var(--td-brand-color);
    font-family: 'Courier New', monospace;
  }
}
</style>
