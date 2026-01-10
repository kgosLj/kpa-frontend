import { defineStore } from 'pinia';
import { getProjectNamespaces, type ProjectNamespace } from '@/api/project';

interface ClusterResourceState {
  selectedProjectId: string | null;
  selectedNamespace: ProjectNamespace | null;
  availableNamespaces: ProjectNamespace[];
  loading: boolean;
}

// LocalStorage keys
const STORAGE_KEY_PROJECT = 'kpa_selected_project_id';
const STORAGE_KEY_NAMESPACE = 'kpa_selected_namespace';

// Helper functions for localStorage
const saveToStorage = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
};

const loadFromStorage = <T>(key: string): T | null => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
    return null;
  }
};

const removeFromStorage = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Failed to remove from localStorage:', e);
  }
};

export const useClusterResourceStore = defineStore('cluster-resource', {
  state: (): ClusterResourceState => ({
    selectedProjectId: loadFromStorage<string>(STORAGE_KEY_PROJECT),
    selectedNamespace: loadFromStorage<ProjectNamespace>(STORAGE_KEY_NAMESPACE),
    availableNamespaces: [],
    loading: false,
  }),

  getters: {
    // 当前选中的集群 ID
    clusterId: (state): string => {
      return state.selectedNamespace?.cluster_id || '';
    },

    // 当前选中的命名空间名称
    namespace: (state): string => {
      return state.selectedNamespace?.namespace || '';
    },

    // 是否已选择命名空间
    hasSelectedNamespace: (state): boolean => {
      return !!state.selectedNamespace;
    },
  },

  actions: {
    /**
     * 设置选中的项目
     * @param projectId 项目 ID
     */
    async setProject(projectId: string) {
      this.selectedProjectId = projectId;
      this.selectedNamespace = null;
      saveToStorage(STORAGE_KEY_PROJECT, projectId);
      removeFromStorage(STORAGE_KEY_NAMESPACE);
      await this.loadNamespaces(projectId);

      // 自动选择第一个命名空间
      if (this.availableNamespaces.length > 0) {
        this.selectedNamespace = this.availableNamespaces[0];
        saveToStorage(STORAGE_KEY_NAMESPACE, this.selectedNamespace);
      }
    },

    /**
     * 设置选中的命名空间
     * @param namespace 命名空间对象
     */
    setNamespace(namespace: ProjectNamespace) {
      this.selectedNamespace = namespace;
      saveToStorage(STORAGE_KEY_NAMESPACE, namespace);
    },

    /**
     * 加载项目的命名空间列表
     * @param projectId 项目 ID
     */
    async loadNamespaces(projectId: string) {
      this.loading = true;
      try {
        this.availableNamespaces = await getProjectNamespaces(projectId);
      } catch (error) {
        console.error('加载命名空间列表失败:', error);
        this.availableNamespaces = [];
      } finally {
        this.loading = false;
      }
    },

    /**
     * 设置项目和命名空间（用于从外部跳转）
     * @param projectId 项目 ID
     * @param namespace 命名空间对象
     */
    async setProjectAndNamespace(projectId: string, namespace: ProjectNamespace) {
      this.selectedProjectId = projectId;
      saveToStorage(STORAGE_KEY_PROJECT, projectId);
      await this.loadNamespaces(projectId);
      this.selectedNamespace = namespace;
      saveToStorage(STORAGE_KEY_NAMESPACE, namespace);
    },

    /**
     * 重置状态
     */
    reset() {
      this.selectedProjectId = null;
      this.selectedNamespace = null;
      this.availableNamespaces = [];
      removeFromStorage(STORAGE_KEY_PROJECT);
      removeFromStorage(STORAGE_KEY_NAMESPACE);
    },
  },
});
