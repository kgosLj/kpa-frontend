<template>
  <div>
    <t-card class="list-card-container" :bordered="false">
      <t-row justify="space-between">
        <div class="left-operation-container">
          <t-button @click="handleAdd">新建角色</t-button>
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
        <template #is_system="{ row }">
          <t-tag v-if="row.is_system" theme="primary" variant="light">系统预置</t-tag>
          <t-tag v-else theme="default" variant="light">自定义</t-tag>
        </template>
        <template #op="{ row }">
          <t-space>
            <t-link theme="primary" @click="handleEdit(row)">编辑</t-link>
            <t-popconfirm content="确认删除该角色吗？" @confirm="handleDelete(row)" v-if="!row.is_system">
              <t-link theme="danger">删除</t-link>
            </t-popconfirm>
          </t-space>
        </template>
      </t-table>
    </t-card>

    <RoleDialog
      v-model:visible="dialogVisible"
      :data="currentRole"
      @confirm="onDialogConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import type { PrimaryTableCol, TableRowData } from 'tdesign-vue-next';
import { ref, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { getRoleList, createRole, updateRole, deleteRole } from '@/api/role';
import type { Role } from '@/api/model/roleModel';
import RoleDialog from './components/RoleDialog.vue';

const COLUMNS: PrimaryTableCol<TableRowData>[] = [
  { title: '角色名称', colKey: 'name', width: 200 },
  { title: '描述', colKey: 'description', ellipsis: true },
  { title: '类型', colKey: 'is_system', width: 120 },
  { title: '创建时间', colKey: 'create_time', width: 200 },
  { title: '操作', colKey: 'op', width: 150, fixed: 'right' },
];

const data = ref<Role[]>([]);
const dataLoading = ref(false);
const dialogVisible = ref(false);
const currentRole = ref<Role | undefined>(undefined);

const fetchData = async () => {
  dataLoading.value = true;
  try {
    const res = await getRoleList();
    data.value = res; // API returns array directly based on my implementation plan, need check api.ts
  } catch (e) {
    console.error(e);
  } finally {
    dataLoading.value = false;
  }
};

onMounted(() => {
  fetchData();
});

const handleAdd = () => {
  currentRole.value = undefined;
  dialogVisible.value = true;
};

const handleEdit = (row: Role) => {
  currentRole.value = row;
  dialogVisible.value = true;
};

const handleDelete = async (row: Role) => {
  try {
    await deleteRole(row.id);
    MessagePlugin.success('删除成功');
    fetchData();
  } catch (e) {
    console.error(e);
  }
};

const onDialogConfirm = async (formData: any) => {
  try {
    if (currentRole.value) {
      await updateRole(currentRole.value.id, formData);
      MessagePlugin.success('更新成功');
    } else {
      await createRole(formData);
      MessagePlugin.success('创建成功');
    }
    dialogVisible.value = false;
    fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '操作失败');
    console.error(e);
  }
};

const rowKey = 'id';
</script>

<style lang="less" scoped>
.list-card-container {
  padding: var(--td-comp-paddingTB-xxl) var(--td-comp-paddingLR-xxl);
}
.left-operation-container {
  margin-bottom: var(--td-comp-margin-xxl);
}
</style>
