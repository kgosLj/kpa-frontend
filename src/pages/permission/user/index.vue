<template>
  <div>
    <t-card class="list-card-container" :bordered="false">
      <t-row justify="space-between">
        <div class="left-operation-container">
          <t-button @click="handleAdd">新建用户</t-button>
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
        <template #is_super_admin="{ row }">
          <t-tag v-if="row.is_super_admin" theme="danger" variant="light">超级管理员</t-tag>
          <t-tag v-else theme="default" variant="light">普通用户</t-tag>
        </template>
        <template #create_time="{ row }">
          {{ formatTime(row.created_at) }}
        </template>
      </t-table>
    </t-card>

    <CreateUserDialog
      v-model:visible="dialogVisible"
      @confirm="fetchData"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { PrimaryTableCol, TableRowData } from 'tdesign-vue-next';
import { getUserList } from '@/api/user';
import type { User } from '@/api/user';
import CreateUserDialog from './components/CreateUserDialog.vue';
import dayjs from 'dayjs';

const COLUMNS: PrimaryTableCol<TableRowData>[] = [
  { title: '用户ID', colKey: 'id', width: 250 },
  { title: '用户名', colKey: 'username', width: 150 },
  { title: '角色', colKey: 'is_super_admin', width: 150 },
  { title: '创建时间', colKey: 'created_at', width: 200 },
];

const data = ref<User[]>([]);
const dataLoading = ref(false);
const dialogVisible = ref(false);

const fetchData = async () => {
  dataLoading.value = true;
  try {
    const res = await getUserList();
    data.value = res.items;
  } catch (e) {
    console.error(e);
  } finally {
    dataLoading.value = false;
  }
};

const formatTime = (time: string) => {
    return dayjs(time).format('YYYY-MM-DD HH:mm:ss');
}

onMounted(() => {
  fetchData();
});

const handleAdd = () => {
  dialogVisible.value = true;
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
