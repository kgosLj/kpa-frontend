<template>
  <div>
    <t-card class="list-card-container" :bordered="false">
      <t-row justify="space-between">
        <div class="left-operation-container">
          <t-button @click="handleAdd">创建项目</t-button>
        </div>
        <div class="search-input">
          <t-input v-model="searchName" placeholder="请输入项目名称搜索" clearable @enter="handleSearch" style="width: 250px">
            <template #suffix-icon>
              <search-icon />
            </template>
          </t-input>
        </div>
      </t-row>
      <t-table
        :data="filteredData"
        :columns="COLUMNS"
        :row-key="rowKey"
        vertical-align="top"
        :hover="true"
        :loading="dataLoading"
      >
        <template #status="{ row }">
          <t-tag v-if="row.status === 1" theme="success">启用</t-tag>
          <t-tag v-else theme="default">禁用</t-tag>
        </template>
        <template #op="{ row }">
          <t-link theme="primary" @click="handleEdit(row)">编辑</t-link>
          <t-divider layout="vertical" />
          <t-link theme="primary" @click="handleManageNamespaces(row)">命名空间</t-link>
          <t-divider layout="vertical" />
          <t-link theme="primary" @click="handleManageMembers(row)">成员</t-link>
          <t-divider layout="vertical" />
          <t-popconfirm content="确定删除该项目吗？删除后将同时删除所有绑定的命名空间和成员。" @confirm="handleDelete(row)">
            <t-link theme="danger">删除</t-link>
          </t-popconfirm>
        </template>
      </t-table>
    </t-card>

    <!-- 创建/编辑项目对话框 -->
    <t-dialog
      v-model:visible="projectDialogVisible"
      :header="isEdit ? '编辑项目' : '创建项目'"
      :confirm-btn="{ content: '提交', loading: submitLoading }"
      @confirm="onSubmitProject"
    >
      <t-form ref="formRef" :data="projectFormData" :rules="PROJECT_FORM_RULES" label-align="right" :label-width="100">
        <t-form-item label="项目名称" name="name">
          <t-input v-model="projectFormData.name" placeholder="请输入项目名称" />
        </t-form-item>
        <t-form-item label="描述" name="description">
          <t-textarea v-model="projectFormData.description" placeholder="请输入描述" />
        </t-form-item>
        <t-form-item v-if="isEdit" label="状态" name="status">
          <t-select v-model="projectFormData.status">
            <t-option :value="1" label="启用" />
            <t-option :value="0" label="禁用" />
          </t-select>
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- 命名空间管理抽屉 -->
    <t-drawer
      v-model:visible="namespaceDrawerVisible"
      :header="`管理命名空间 - ${currentProject?.name}`"
      size="large"
      :footer="false"
    >
      <div class="drawer-content">
        <div class="drawer-actions">
          <t-button @click="handleAddNamespace">绑定命名空间</t-button>
        </div>
        <t-table
          :data="namespaces"
          :columns="NAMESPACE_COLUMNS"
          row-key="id"
          :loading="namespaceLoading"
        >
          <template #cluster_name="{ row }">
            {{ getClusterName(row.cluster_id) }}
          </template>
          <template #environment="{ row }">
            <t-tag v-if="row.environment === 'prod'" theme="danger">生产</t-tag>
            <t-tag v-else-if="row.environment === 'staging'" theme="warning">预发布</t-tag>
            <t-tag v-else-if="row.environment === 'dev'" theme="primary">开发</t-tag>
            <t-tag v-else>{{ row.environment }}</t-tag>
          </template>
          <template #op="{ row }">
            <t-popconfirm content="确定解绑该命名空间吗？" @confirm="handleUnbindNamespace(row)">
              <t-link theme="danger">解绑</t-link>
            </t-popconfirm>
          </template>
        </t-table>
      </div>
    </t-drawer>

    <!-- 绑定命名空间对话框 -->
    <t-dialog
      v-model:visible="namespaceDialogVisible"
      header="绑定命名空间"
      :confirm-btn="{ content: '提交', loading: namespaceSubmitLoading }"
      @confirm="onSubmitNamespace"
    >
      <t-form ref="namespaceFormRef" :data="namespaceFormData" :rules="NAMESPACE_FORM_RULES" label-align="right" :label-width="100">
        <t-form-item label="集群" name="cluster_id">
          <t-select v-model="namespaceFormData.cluster_id" placeholder="请选择集群" @change="onClusterChange">
            <t-option v-for="cluster in clusters" :key="cluster.id" :value="cluster.id" :label="cluster.name" />
          </t-select>
        </t-form-item>
        <t-form-item label="命名空间" name="namespace">
          <t-select v-model="namespaceFormData.namespace" placeholder="请选择命名空间" :loading="namespacesLoading">
            <t-option v-for="ns in availableNamespaces" :key="ns" :value="ns" :label="ns" />
          </t-select>
        </t-form-item>
        <t-form-item label="环境" name="environment">
          <t-select v-model="namespaceFormData.environment">
            <t-option value="dev" label="开发 (Dev)" />
            <t-option value="staging" label="预发布 (Staging)" />
            <t-option value="prod" label="生产 (Prod)" />
          </t-select>
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- 成员管理抽屉 -->
    <t-drawer
      v-model:visible="memberDrawerVisible"
      :header="`管理成员 - ${currentProject?.name}`"
      size="large"
      :footer="false"
    >
      <div class="drawer-content">
        <div class="drawer-actions">
          <t-button @click="handleAddMember">添加成员</t-button>
        </div>
        <t-table
          :data="members"
          :columns="MEMBER_COLUMNS"
          row-key="id"
          :loading="memberLoading"
        >
          <template #username="{ row }">
            {{ row.user?.username || row.user_id }}
          </template>
          <template #role_name="{ row }">
            {{ row.role?.name || '-' }}
          </template>
          <template #op="{ row }">
            <t-popconfirm content="确定移除该成员吗？" @confirm="handleRemoveMember(row)">
              <t-link theme="danger">移除</t-link>
            </t-popconfirm>
          </template>
        </t-table>
      </div>
    </t-drawer>

    <!-- 添加成员对话框 -->
    <t-dialog
      v-model:visible="memberDialogVisible"
      header="添加成员"
      :confirm-btn="{ content: '提交', loading: memberSubmitLoading }"
      @confirm="onSubmitMember"
    >
      <t-form ref="memberFormRef" :data="memberFormData" :rules="MEMBER_FORM_RULES" label-align="right" :label-width="100">
        <t-form-item label="用户" name="user_id">
          <t-select v-model="memberFormData.user_id" placeholder="请选择用户" filterable>
            <t-option v-for="user in users" :key="user.id" :value="user.id" :label="user.username">
              <div>{{ user.username }} ({{ user.id }})</div>
            </t-option>
          </t-select>
        </t-form-item>
        <t-form-item label="角色" name="role_id">
          <t-select v-model="memberFormData.role_id" placeholder="请选择角色">
            <t-option v-for="role in roles" :key="role.id" :value="role.id" :label="role.name" />
          </t-select>
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { SearchIcon } from 'tdesign-icons-vue-next';
import { 
  getProjectList, 
  createProject, 
  updateProject,
  deleteProject,
  getProjectNamespaces, 
  bindProjectNamespace, 
  unbindProjectNamespace,
  getProjectMembers,
  addProjectMember,
  removeProjectMember
} from '@/api/project';
import { getClusterList, type Cluster } from '@/api/cluster';
import { getUserList } from '@/api/user';
import { getRoleList } from '@/api/role';
import { request } from '@/utils/request';
import type { Project, ProjectNamespace, ProjectMember } from '@/api/project';

// 项目列表相关
const COLUMNS = [
  { title: 'ID', colKey: 'id', width: 280, ellipsis: true },
  { title: '项目名称', colKey: 'name', width: 200 },
  { title: '描述', colKey: 'description', ellipsis: true },
  { title: '状态', colKey: 'status', width: 100 },
  { title: '创建时间', colKey: 'create_time', width: 180 },
  { title: '操作', colKey: 'op', width: 280, fixed: 'right' as const },
];

const PROJECT_FORM_RULES = {
  name: [{ required: true, message: '必填', type: 'error' as const }],
};

const data = ref<Project[]>([]);
const dataLoading = ref(false);
const searchName = ref('');

// 过滤后的数据
const filteredData = computed(() => {
  if (!searchName.value) {
    return data.value;
  }
  return data.value.filter(project => 
    project.name.toLowerCase().includes(searchName.value.toLowerCase())
  );
});

const projectDialogVisible = ref(false);
const submitLoading = ref(false);
const isEdit = ref(false);
const projectFormData = ref({
  id: '',
  name: '',
  description: '',
  status: 1,
});

// 命名空间管理相关
const NAMESPACE_COLUMNS = [
  { title: '集群', colKey: 'cluster_name', width: 200 },
  { title: '命名空间', colKey: 'namespace', width: 200 },
  { title: '环境', colKey: 'environment', width: 120 },
  { title: '绑定时间', colKey: 'create_time', width: 180 },
  { title: '操作', colKey: 'op', width: 100, fixed: 'right' as const },
];

const NAMESPACE_FORM_RULES = {
  cluster_id: [{ required: true, message: '必填', type: 'error' as const }],
  namespace: [{ required: true, message: '必填', type: 'error' as const }],
  environment: [{ required: true, message: '必填', type: 'error' as const }],
};

const namespaceDrawerVisible = ref(false);
const namespaceDialogVisible = ref(false);
const namespaceLoading = ref(false);
const namespaceSubmitLoading = ref(false);
const namespacesLoading = ref(false);
const currentProject = ref<Project | null>(null);
const namespaces = ref<ProjectNamespace[]>([]);
const clusters = ref<Cluster[]>([]);
const availableNamespaces = ref<string[]>([]);
const namespaceFormData = ref({
  cluster_id: '',
  namespace: '',
  environment: 'prod',
});

// 成员管理相关
const MEMBER_COLUMNS = [
  { title: '用户名', colKey: 'username', width: 200 },
  { title: '角色', colKey: 'role_name', width: 200 },
  { title: '加入时间', colKey: 'create_time', width: 180 },
  { title: '操作', colKey: 'op', width: 100, fixed: 'right' as const },
];

const MEMBER_FORM_RULES = {
  user_id: [{ required: true, message: '必填', type: 'error' as const }],
  role_id: [{ required: true, message: '必填', type: 'error' as const }],
};

const memberDrawerVisible = ref(false);
const memberDialogVisible = ref(false);
const memberLoading = ref(false);
const memberSubmitLoading = ref(false);
const members = ref<ProjectMember[]>([]);
const users = ref<Array<{ id: string; username: string }>>([]);
const roles = ref<Array<{ id: number; name: string; description: string }>>([]);
const memberFormData = ref({
  user_id: '',
  role_id: null as number | null,
});

// 获取集群名称
const getClusterName = (clusterId: string) => {
  const cluster = clusters.value.find(c => c.id === clusterId);
  return cluster?.name || clusterId;
};

// 项目列表操作
const fetchData = async () => {
  dataLoading.value = true;
  try {
    const res = await getProjectList();
    data.value = res;
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载失败');
  } finally {
    dataLoading.value = false;
  }
};

const handleAdd = () => {
  isEdit.value = false;
  projectFormData.value = { id: '', name: '', description: '', status: 1 };
  projectDialogVisible.value = true;
};

const handleEdit = (row: Project) => {
  isEdit.value = true;
  projectFormData.value = {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
  };
  projectDialogVisible.value = true;
};

const onSubmitProject = async () => {
  submitLoading.value = true;
  try {
    if (isEdit.value) {
      await updateProject(projectFormData.value.id, {
        name: projectFormData.value.name,
        description: projectFormData.value.description,
        status: projectFormData.value.status,
      });
      MessagePlugin.success('更新成功');
    } else {
      await createProject({
        name: projectFormData.value.name,
        description: projectFormData.value.description,
      });
      MessagePlugin.success('创建成功');
    }
    projectDialogVisible.value = false;
    fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '操作失败');
  } finally {
    submitLoading.value = false;
  }
};

const handleSearch = () => {
  // 搜索是通过 computed 属性自动完成的，这里可以为空
  // 或者可以添加其他逻辑，比如聚焦到表格
};

const handleDelete = async (row: Project) => {
  try {
    await deleteProject(row.id);
    MessagePlugin.success('删除成功');
    fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '删除失败');
  }
};

// 命名空间管理操作
const handleManageNamespaces = async (row: Project) => {
  currentProject.value = row;
  namespaceDrawerVisible.value = true;
  await fetchNamespaces();
};

const fetchNamespaces = async () => {
  if (!currentProject.value) return;
  namespaceLoading.value = true;
  try {
    const res = await getProjectNamespaces(currentProject.value.id);
    namespaces.value = res;
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载命名空间失败');
  } finally {
    namespaceLoading.value = false;
  }
};

const fetchClusters = async () => {
  try {
    const res = await getClusterList();
    clusters.value = res;
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载集群列表失败');
  }
};

const onClusterChange = async (clusterId: string | number) => {
  if (!clusterId) {
    availableNamespaces.value = [];
    return;
  }
  
  const clusterIdStr = String(clusterId);
  namespacesLoading.value = true;
  availableNamespaces.value = []; // 清空之前的数据
  
  try {
    console.log('正在加载集群命名空间:', clusterIdStr);
    
    // 从 K8s API 获取命名空间列表
    const res = await request.get<any>({
      url: `/clusters/${clusterIdStr}/proxy/api/v1/namespaces`,
      headers: {
        'X-Current-Cluster': clusterIdStr,
      },
    });
    
    console.log('命名空间API响应:', res);
    
    // 兼容不同的响应格式
    let namespaceList: string[] = [];
    
    if (res && res.items && Array.isArray(res.items)) {
      // 标准 K8s API 格式
      namespaceList = res.items
        .filter((item: any) => item && item.metadata && item.metadata.name)
        .map((item: any) => item.metadata.name);
    } else if (Array.isArray(res)) {
      // 直接返回数组
      namespaceList = res;
    }
    
    console.log('解析后的命名空间列表:', namespaceList);
    
    if (namespaceList.length === 0) {
      MessagePlugin.warning('该集群没有可用的命名空间');
    }
    
    availableNamespaces.value = namespaceList;
  } catch (e: any) {
    console.error('加载命名空间失败:', e);
    console.error('错误详情:', {
      message: e.message,
      response: e.response,
      status: e.response?.status,
      data: e.response?.data,
    });
    
    const errorMsg = e.response?.data?.message || e.message || '加载命名空间失败';
    MessagePlugin.error(`加载命名空间失败: ${errorMsg}`);
    availableNamespaces.value = [];
  } finally {
    namespacesLoading.value = false;
  }
};

const handleAddNamespace = () => {
  namespaceFormData.value = { cluster_id: '', namespace: '', environment: 'prod' };
  availableNamespaces.value = [];
  namespaceDialogVisible.value = true;
};

const onSubmitNamespace = async () => {
  if (!currentProject.value) return;
  
  // 验证表单
  if (!namespaceFormData.value.cluster_id) {
    MessagePlugin.error('请选择集群');
    return;
  }
  if (!namespaceFormData.value.namespace) {
    MessagePlugin.error('请选择命名空间');
    return;
  }
  if (!namespaceFormData.value.environment) {
    MessagePlugin.error('请选择环境');
    return;
  }
  
  namespaceSubmitLoading.value = true;
  try {
    await bindProjectNamespace(currentProject.value.id, namespaceFormData.value);
    MessagePlugin.success('绑定成功');
    namespaceDialogVisible.value = false;
    fetchNamespaces();
  } catch (e: any) {
    MessagePlugin.error(e.message || '绑定失败');
    console.error('绑定命名空间失败:', e);
  } finally {
    namespaceSubmitLoading.value = false;
  }
};

const handleUnbindNamespace = async (row: ProjectNamespace) => {
  if (!currentProject.value) return;
  try {
    await unbindProjectNamespace(currentProject.value.id, {
      cluster_id: row.cluster_id,
      namespace: row.namespace,
    });
    MessagePlugin.success('解绑成功');
    fetchNamespaces();
  } catch (e: any) {
    MessagePlugin.error(e.message || '解绑失败');
  }
};

// 成员管理操作
const handleManageMembers = async (row: Project) => {
  currentProject.value = row;
  memberDrawerVisible.value = true;
  await fetchMembers();
};

const fetchMembers = async () => {
  if (!currentProject.value) return;
  memberLoading.value = true;
  try {
    const res = await getProjectMembers(currentProject.value.id);
    members.value = res;
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载成员失败');
  } finally {
    memberLoading.value = false;
  }
};

const fetchUsers = async () => {
  try {
    const res = await getUserList();
    users.value = res.items || [];
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载用户列表失败');
  }
};

const fetchRoles = async () => {
  try {
    const res = await getRoleList();
    roles.value = res;
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载角色列表失败');
  }
};

const handleAddMember = () => {
  memberFormData.value = { user_id: '', role_id: null };
  memberDialogVisible.value = true;
};

const onSubmitMember = async () => {
  if (!currentProject.value) return;
  
  // 验证表单
  if (!memberFormData.value.user_id) {
    MessagePlugin.error('请选择用户');
    return;
  }
  if (!memberFormData.value.role_id) {
    MessagePlugin.error('请选择角色');
    return;
  }
  
  memberSubmitLoading.value = true;
  try {
    await addProjectMember(currentProject.value.id, {
      user_id: memberFormData.value.user_id,
      role_id: memberFormData.value.role_id,
    });
    MessagePlugin.success('添加成功');
    memberDialogVisible.value = false;
    fetchMembers();
  } catch (e: any) {
    MessagePlugin.error(e.message || '添加失败');
    console.error('添加成员失败:', e);
  } finally {
    memberSubmitLoading.value = false;
  }
};

const handleRemoveMember = async (row: ProjectMember) => {
  if (!currentProject.value) return;
  try {
    await removeProjectMember(currentProject.value.id, row.user_id);
    MessagePlugin.success('移除成功');
    fetchMembers();
  } catch (e: any) {
    MessagePlugin.error(e.message || '移除失败');
  }
};

const rowKey = 'id';

onMounted(() => {
  fetchData();
  fetchClusters();
  fetchUsers();
  fetchRoles();
});
</script>

<style lang="less" scoped>
.list-card-container {
  padding: var(--td-comp-paddingTB-xxl) var(--td-comp-paddingLR-xxl);
}

.left-operation-container {
  margin-bottom: var(--td-comp-margin-xxl);
}

.search-input {
  display: flex;
  align-items: center;
}

.drawer-content {
  padding: 0;
}

.drawer-actions {
  margin-bottom: var(--td-comp-margin-xl);
  padding: 0 var(--td-comp-paddingLR-xl);
}
</style>
