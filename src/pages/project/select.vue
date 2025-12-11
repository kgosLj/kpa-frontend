<template>
  <div class="project-select-page">
    <t-card :bordered="false">
      <template #header>
        <div class="page-header">
          <h3>选择项目</h3>
          <p class="description">请选择一个项目以管理其 Kubernetes 资源</p>
        </div>
      </template>

      <t-loading v-if="loading" text="加载中..." size="large" />

      <t-empty v-else-if="projects.length === 0" description="暂无可用项目" />

      <t-list v-else :split="true">
        <t-list-item
          v-for="project in projects"
          :key="project.id"
          class="project-item"
          @click="handleSelectProject(project)"
        >
          <t-list-item-meta>
            <template #avatar>
              <div class="project-avatar">
                <layers-icon size="24px" />
              </div>
            </template>
            <template #title>
              <div class="project-title">
                {{ project.name }}
                <t-tag 
                  :theme="project.status === 1 ? 'success' : 'default'" 
                  size="small"
                  style="margin-left: 8px;"
                >
                  {{ project.status === 1 ? '启用' : '禁用' }}
                </t-tag>
              </div>
            </template>
            <template #description>
              <div class="project-description">
                <span>{{ project.description || '暂无描述' }}</span>
                <span class="namespace-count">
                  <server-icon size="14px" />
                  {{ getNamespaceCount(project.id) }} 个命名空间
                </span>
              </div>
            </template>
          </t-list-item-meta>
          <template #action>
            <chevron-right-icon size="20px" />
          </template>
        </t-list-item>
      </t-list>
    </t-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { LayersIcon, ServerIcon, ChevronRightIcon } from 'tdesign-icons-vue-next';
import { getProjectList, getProjectNamespaces, type Project } from '@/api/project';

const router = useRouter();

const projects = ref<Project[]>([]);
const loading = ref(false);
const namespaceCounts = ref<Record<string, number>>({});

// 获取命名空间数量
const getNamespaceCount = (projectId: string): number => {
  return namespaceCounts.value[projectId] || 0;
};

// 处理项目选择
const handleSelectProject = async (project: Project) => {
  if (project.status !== 1) {
    MessagePlugin.warning('该项目已禁用');
    return;
  }
  
  try {
    // 跳转到集群资源管理页面，带上项目ID
    router.push({ 
      name: 'ClusterResourceManagement',
      query: { projectId: project.id },
    });
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载项目信息失败');
  }
};

// 加载项目列表
const loadProjects = async () => {
  loading.value = true;
  try {
    projects.value = await getProjectList();
    
    // 加载每个项目的命名空间数量
    for (const project of projects.value) {
      try {
        const namespaces = await getProjectNamespaces(project.id);
        namespaceCounts.value[project.id] = namespaces.length;
      } catch (e) {
        namespaceCounts.value[project.id] = 0;
      }
    }
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载项目列表失败');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadProjects();
});
</script>

<style lang="less" scoped>
.project-select-page {
  .page-header {
    h3 {
      margin: 0 0 8px 0;
      font-size: 20px;
      font-weight: 600;
    }

    .description {
      margin: 0;
      color: var(--td-text-color-secondary);
      font-size: 14px;
    }
  }

  .project-item {
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--td-bg-color-container-hover);
    }

    .project-avatar {
      width: 48px;
      height: 48px;
      background: var(--td-brand-color-light);
      border-radius: var(--td-radius-default);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--td-brand-color);
    }

    .project-title {
      display: flex;
      align-items: center;
      font-weight: 500;
    }

    .project-description {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;

      .namespace-count {
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--td-text-color-placeholder);
        font-size: 12px;
        white-space: nowrap;
      }
    }
  }
}
</style>
