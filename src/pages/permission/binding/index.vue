<template>
  <div>
    <t-card class="list-card-container" :bordered="false">
      <t-row justify="space-between">
        <div class="left-operation-container">
          <t-button @click="handleGrant">授予权限</t-button>
        </div>
        <div class="search-input">
             <t-input v-model="searchUserId" placeholder="请输入用户ID搜索" clearable @enter="handleSearch" style="width: 200px; margin-right: 10px">
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
import { getRoleBindingListByUser, getRoleBindingListByCluster, grantRole, revokeRole } from '@/api/role-binding';
import type { RoleBinding } from '@/api/model/roleBindingModel';
import GrantDialog from './components/GrantDialog.vue';

const COLUMNS: PrimaryTableCol<TableRowData>[] = [
  { title: '用户ID', colKey: 'user_id', width: 200 },
  { title: '用户名', colKey: 'username', width: 150 },
  { title: '角色', colKey: 'role_name', width: 150 },
  { title: '集群', colKey: 'cluster_id', width: 200 },
  { title: '命名空间', colKey: 'namespace', cell: (h: any, { row }: { row: any }) => row.namespace || '全部 (All)' },
  { title: '绑定时间', colKey: 'create_time', width: 200 },
  { title: '操作', colKey: 'op', width: 100, fixed: 'right' },
];

const data = ref<RoleBinding[]>([]);
const dataLoading = ref(false);
const dialogVisible = ref(false);
const searchUserId = ref('');
const searchClusterId = ref('');

// Initial load? maybe load for current user or empty
const fetchData = async () => {
    if (!searchUserId.value && !searchClusterId.value) {
        // As per API design, we need either user_id or cluster_id. 
        // For UX, we return empty list if no search criteria
        data.value = [];
        return; 
    }

  dataLoading.value = true;
  try {
    let res: RoleBinding[] = [];
    if (searchUserId.value) {
        const response = await getRoleBindingListByUser(searchUserId.value);
        res = Array.isArray(response) ? response : [];
    } else if (searchClusterId.value) {
        const response = await getRoleBindingListByCluster(searchClusterId.value);
        res = Array.isArray(response) ? response : [];
    }
    
    // Client-side filtering if both present?
    if (searchUserId.value && searchClusterId.value && Array.isArray(res)) {
        res = res.filter(item => item.cluster_id === searchClusterId.value);
    }

    data.value = res;
  } catch (e) {
    console.error(e);
    data.value = []; // ensure data is reset on error
  } finally {
    dataLoading.value = false;
  }
};

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
        role_name: row.role_name || '', // Note: role_name might be missing if API only gives ID, need check backend. 
        // Backend `RoleBindingResponse` has `RoleName`.
        cluster_id: row.cluster_id,
        namespace: row.namespace
    });
    MessagePlugin.success('撤销成功');
    fetchData();
  } catch (e) {
    console.error(e);
  }
};

const onDialogConfirm = async (formData: any) => {
  try {
    await grantRole(formData);
    MessagePlugin.success('授权成功');
    dialogVisible.value = false;
    
    // Auto fill search and refresh to show the new grant
    if (formData.user_id) {
        searchUserId.value = formData.user_id;
        searchClusterId.value = ''; 
        
        // Add a small delay to ensure backend data consistency
        setTimeout(() => {
            fetchData();
        }, 500);
    }
  } catch (e: any) {
    MessagePlugin.error(e.message || '授权失败');
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
.search-input {
    display: flex;
}
</style>
