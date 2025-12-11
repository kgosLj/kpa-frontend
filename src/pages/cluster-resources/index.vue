<template>
  <div class="project-selection-container">
    <div class="selection-header">
      <div class="header-content">
        <div class="header-icon">
          <layers-icon size="48px" />
        </div>
        <div class="header-text">
          <h1>选择项目</h1>
          <p class="description">请选择一个项目以管理其 Kubernetes 资源</p>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <t-loading size="large" text="加载项目列表..." />
    </div>

    <div v-else-if="projects.length === 0" class="empty-container">
      <t-empty description="暂无可用项目">
        <template #image>
          <folder-open-icon size="64px" />
        </template>
      </t-empty>
    </div>

    <div v-else class="project-grid">
      <div
        v-for="project in projects"
        :key="project.id"
        class="project-card"
        :class="{ 'disabled': project.status !== 1 }"
        @click="handleSelectProject(project)"
      >
        <div class="card-background"></div>
        <div class="card-content">
          <div class="card-header">
            <div class="project-icon">
              <layers-icon size="28px" />
            </div>
            <t-tag 
              :theme="project.status === 1 ? 'success' : 'default'" 
              size="small"
              class="status-tag"
            >
              {{ project.status === 1 ? '启用' : '禁用' }}
            </t-tag>
          </div>
          
          <div class="card-body">
            <h3 class="project-name">{{ project.name }}</h3>
            <p class="project-desc">{{ project.description || '暂无描述' }}</p>
          </div>
          
          <div class="card-footer">
            <div class="namespace-info">
              <server-icon size="16px" />
              <span>{{ getNamespaceCount(project.id) }} 个命名空间</span>
            </div>
            <div class="arrow-icon">
              <chevron-right-icon size="20px" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { LayersIcon, ServerIcon, ChevronRightIcon, FolderOpenIcon } from 'tdesign-icons-vue-next';
import { getProjectList, getProjectNamespaces, type Project } from '@/api/project';
import { useClusterResourceStore } from '@/store/modules/cluster-resource';

const router = useRouter();
const store = useClusterResourceStore();

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
    // 跳转到命名空间选择页面
    router.push({ 
      name: 'ClusterResourceNamespaceSelect',
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
.project-selection-container {
  min-height: calc(100vh - 200px);
  padding: 0;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8eef5 100%);

  .selection-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 48px 32px;
    margin-bottom: 32px;
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 24px;

      .header-icon {
        width: 80px;
        height: 80px;
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        border-radius: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
      }

      .header-text {
        flex: 1;
        color: white;

        h1 {
          margin: 0 0 8px 0;
          font-size: 32px;
          font-weight: 700;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .description {
          margin: 0;
          font-size: 16px;
          opacity: 0.95;
          font-weight: 400;
        }
      }
    }
  }

  .loading-container,
  .empty-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 80px 32px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .project-grid {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 32px 48px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 24px;

    .project-card {
      position: relative;
      background: white;
      border-radius: 16px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        transform: scaleX(0);
        transform-origin: left;
        transition: transform 0.3s ease;
      }

      &:hover {
        transform: translateY(-8px);
        box-shadow: 0 12px 32px rgba(102, 126, 234, 0.2);

        &::before {
          transform: scaleX(1);
        }

        .card-background {
          opacity: 1;
        }

        .arrow-icon {
          transform: translateX(4px);
        }
      }

      &.disabled {
        opacity: 0.6;
        cursor: not-allowed;

        &:hover {
          transform: none;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

          &::before {
            transform: scaleX(0);
          }

          .arrow-icon {
            transform: none;
          }
        }
      }

      .card-background {
        position: absolute;
        top: 0;
        right: 0;
        width: 200px;
        height: 200px;
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
        border-radius: 50%;
        transform: translate(50%, -50%);
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .card-content {
        position: relative;
        padding: 24px;
        z-index: 1;

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;

          .project-icon {
            width: 56px;
            height: 56px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }

          .status-tag {
            font-weight: 500;
          }
        }

        .card-body {
          margin-bottom: 20px;

          .project-name {
            margin: 0 0 8px 0;
            font-size: 20px;
            font-weight: 600;
            color: #1f2937;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .project-desc {
            margin: 0;
            font-size: 14px;
            color: #6b7280;
            line-height: 1.6;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            min-height: 44px;
          }
        }

        .card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;

          .namespace-info {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #6b7280;
            font-size: 14px;
            font-weight: 500;

            :deep(.t-icon) {
              color: #9ca3af;
            }
          }

          .arrow-icon {
            color: #9ca3af;
            transition: transform 0.3s ease;
          }
        }
      }
    }
  }
}
</style>

