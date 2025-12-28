<template>
  <div>
    <t-card class="list-card-container" :bordered="false">
      <t-row justify="space-between">
        <div class="left-operation-container">
          <t-button @click="handleGrant">授予权限</t-button>
        </div>
        <div class="search-input">
             <t-input v-model="searchUsername" placeholder="请输入用户名搜索" clearable @enter="handleSearch" style="width: 200px; margin-right: 10px">
                <template #suffix-icon>
                  <search-icon />
                </template>
             </t-input>
             <t-input v-model="searchClusterId" placeholder="请输入集群ID搜索" clearable @enter="handleSearch" style="width: 200px">
                <template #suffix-icon>
                  <search-icon />
                </template>
             </t-input>
             <t-button theme="primary" variant="text" @click="handleSearch">搜索</t-button>
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
        <template #op="{ row }">
          <t-popconfirm content="确认撤销该权限吗？" @confirm="handleRevoke(row)">
             <t-link theme="danger">撤销</t-link>
          </t-popconfirm>
        </template>
      </t-table>
    </t-card>

    <GrantDialog
      v-model:visible="dialogVisible"
      @confirm="onDialogConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import type { PrimaryTableCol, TableRowData } from 'tdesign-vue-next';
import { ref, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { SearchIcon } from 'tdesign-icons-vue-next';
import { getRoleBindingList, grantRole, revokeRole } from '@/api/role-binding';
import type { RoleBinding } from '@/api/model/roleBindingModel';
import GrantDialog from './components/GrantDialog.vue';

const COLUMNS: PrimaryTableCol<TableRowData>[] = [
  { title: '用户名', colKey: 'username', width: 150 },
  { title: '角色', colKey: 'role_name', width: 150 },
  { title: '集群', colKey: 'cluster_name', width: 200 },
  { title: '命名空间', colKey: 'namespace', cell: (h: any, { row }: { row: any }) => row.namespace || '全部 (All)' },
  { title: '绑定时间', colKey: 'create_time', width: 200 },
  { title: '操作', colKey: 'op', width: 100, fixed: 'right' },
];

const data = ref<RoleBinding[]>([]);
const dataLoading = ref(false);
const dialogVisible = ref(false);
const searchUsername = ref('');
const searchClusterId = ref('');

// 获取数据
const fetchData = async () => {
  dataLoading.value = true;
  try {
    const params: { username?: string; cluster_id?: string } = {};
    
    if (searchUsername.value) {
      params.username = searchUsername.value;
    }
    if (searchClusterId.value) {
      params.cluster_id = searchClusterId.value;
    }
    
    const res = await getRoleBindingList(params);
    data.value = Array.isArray(res) ? res : [];
  } catch (e: any) {
    MessagePlugin.error(e.message || '加载失败');
    console.error('加载权限绑定失败:', e);
    data.value = [];
  } finally {
    dataLoading.value = false;
  }
};

// 默认加载所有数据
onMounted(() => {
    fetchData();
});

const handleSearch = () => {
    fetchData();
}

const handleGrant = () => {
  dialogVisible.value = true;
};

const handleRevoke = async (row: RoleBinding) => {
  try {
    await revokeRole({
        user_id: row.user_id,
        role_name: row.role_name || '',
        cluster_id: row.cluster_id,
        namespace: row.namespace
    });
    MessagePlugin.success('撤销成功');
    fetchData();
  } catch (e: any) {
    MessagePlugin.error(e.message || '撤销失败');
    console.error('撤销权限失败:', e);
  }
};

const onDialogConfirm = async (formData: any) => {
  try {
    await grantRole(formData);
    MessagePlugin.success('授权成功');
    dialogVisible.value = false;
    
    // 刷新列表
    setTimeout(() => {
        fetchData();
    }, 500);
  } catch (e: any) {
    MessagePlugin.error(e.message || '授权失败');
    console.error('授权失败:', e);
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
.search-input {
    display: flex;
}
</style>
