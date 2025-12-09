<template>
  <div>
    <t-card class="list-card-container" :bordered="false" title="项目成员管理">
        <template #actions>
            <t-button variant="text" @click="$router.back()">返回</t-button>
        </template>
        
      <t-row justify="space-between">
        <div class="left-operation-container">
          <t-button @click="handleAdd">添加成员</t-button>
        </div>
      </t-row>
      <t-table
        :data="data"
        :columns="COLUMNS"
        :row-key="rowKey"
        vertical-align="top"
        :hover="true"
        :loading="dataLoading"
      >
        <template #username="{ row }">
            {{ row.user?.username || row.user_id }}
        </template>
        <template #role_name="{ row }">
            {{ row.role?.name || '-' }}
        </template>
        <template #op="{ row }">
           <t-popconfirm content="确定移除该成员吗？" @confirm="handleRemove(row)">
               <t-link theme="danger">移除</t-link>
           </t-popconfirm>
        </template>
      </t-table>
    </t-card>

    <t-dialog
      v-model:visible="dialogVisible"
      header="添加成员"
      :confirm-btn="{ content: '提交', loading: submitLoading }"
      @confirm="onSubmit"
    >
      <t-form ref="formRef" :data="formData" :rules="FORM_RULES" label-align="right" :label-width="100">
        <t-form-item label="用户" name="user_id">
          <t-select v-model="formData.user_id" placeholder="请选择用户" filterable>
              <t-option v-for="user in users" :key="user.id" :value="user.id" :label="user.username">
                  <div>{{ user.username }} ({{ user.id }})</div>
              </t-option>
          </t-select>
        </t-form-item>
        <t-form-item label="角色" name="role_id">
            <t-select v-model="formData.role_id" placeholder="请选择角色">
                <t-option v-for="role in roles" :key="role.id" :value="role.id" :label="role.name" />
            </t-select>
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { getProjectMembers, addProjectMember, removeProjectMember } from '@/api/project';
import { getUserList } from '@/api/user';
import { getRoleList } from '@/api/role';
import type { ProjectMember } from '@/api/project';

const route = useRoute();
const projectId = route.params.id as string;

const COLUMNS = [
  { title: '用户名', colKey: 'username', width: 200 },
  { title: '角色', colKey: 'role_name', width: 200 },
  { title: '加入时间', colKey: 'create_time', width: 200 },
  { title: '操作', colKey: 'op', width: 100, fixed: 'right' as const },
];

const FORM_RULES = {
  user_id: [{ required: true, message: '必填', type: 'error' as const }],
  role_id: [{ required: true, message: '必填', type: 'error' as const }],
};

const data = ref<ProjectMember[]>([]);
const dataLoading = ref(false);
const dialogVisible = ref(false);
const submitLoading = ref(false);
const formData = ref({
  user_id: '',
  role_id: 0,
});

const users = ref<Array<{ id: string; username: string }>>([]);
const roles = ref<Array<{ id: number; name: string; description: string }>>([]);

const fetchData = async () => {
  dataLoading.value = true;
  try {
    const res = await getProjectMembers(projectId);
    data.value = res;
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载失败');
  } finally {
    dataLoading.value = false;
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

const handleAdd = () => {
  formData.value = { user_id: '', role_id: 0 };
  dialogVisible.value = true;
};

const onSubmit = async () => {
  submitLoading.value = true;
  try {
    await addProjectMember(projectId, formData.value);
    MessagePlugin.success('添加成功');
    dialogVisible.value = false;
    fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '添加失败');
  } finally {
    submitLoading.value = false;
  }
};

const handleRemove = async (row: ProjectMember) => {
    try {
        await removeProjectMember(projectId, row.user_id);
        MessagePlugin.success('移除成功');
        fetchData();
    } catch (e: any) {
        MessagePlugin.error(e.message || '移除失败');
    }
}

const rowKey = 'id';

onMounted(() => {
  fetchData();
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
</style>
