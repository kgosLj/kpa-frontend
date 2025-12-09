<template>
  <t-dialog
    v-model:visible="visible"
    header="授予权限"
    :on-confirm="onConfirm"
    :on-close="onClose"
    width="500px"
  >
    <t-form ref="form" :data="formData" :rules="rules" @submit="onSubmit" label-width="100px">
      <t-form-item label="用户" name="user_id">
        <t-select v-model="formData.user_id" placeholder="请选择用户" :loading="userLoading" filterable>
            <t-option v-for="user in users" :key="user.id" :value="user.id" :label="user.username + ' (' + user.id + ')'">
                 {{ user.username }} <span style="color: #999; font-size: 12px">({{ user.id }})</span>
            </t-option>
        </t-select>
      </t-form-item>
      
      <t-form-item label="角色" name="role_name">
        <t-select v-model="formData.role_name" placeholder="请选择角色" :loading="roleLoading">
            <t-option v-for="role in roles" :key="role.id" :value="role.name" :label="role.name">
                {{ role.name }} <span style="color: #999; font-size: 12px">({{ role.description }})</span>
            </t-option>
        </t-select>
      </t-form-item>

      <t-form-item label="集群" name="cluster_id">
         <t-select v-model="formData.cluster_id" placeholder="请选择集群" :loading="clusterLoading">
            <t-option v-for="cluster in clusters" :key="cluster.id" :value="cluster.id" :label="cluster.name || cluster.id" />
        </t-select>
      </t-form-item>

      <t-form-item label="命名空间" name="namespace">
        <t-input v-model="formData.namespace" placeholder="请输入命名空间（可选，留空为集群级别）" />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { MessagePlugin, FormRules, ValidateTriggerType } from 'tdesign-vue-next';
import { getRoleList } from '@/api/role';
import { getClusterList } from '@/api/cluster';
import { getUserList } from '@/api/user';
import type { Role } from '@/api/model/roleModel';
import type { User } from '@/api/user';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits(['update:visible', 'confirm']);

const visible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
});

const formData = ref({
  user_id: '',
  role_name: '',
  cluster_id: '',
  namespace: '',
});

// Users
const users = ref<User[]>([]);
const userLoading = ref(false);
const fetchUsers = async () => {
    userLoading.value = true;
    try {
        const res = await getUserList();
        users.value = res.items;
    } finally {
        userLoading.value = false;
    }
}

// Roles
const roles = ref<Role[]>([]);
const roleLoading = ref(false);
const fetchRoles = async () => {
    roleLoading.value = true;
    try {
        roles.value = await getRoleList();
    } finally {
        roleLoading.value = false;
    }
}

// Clusters
const clusters = ref<any[]>([]); // Using any for now as I need to check cluster model
const clusterLoading = ref(false);
const fetchClusters = async () => {
    clusterLoading.value = true;
    try {
       const res = await getClusterList(); 
       clusters.value = res;
    } catch(e) {
        console.error(e)
    } finally {
        clusterLoading.value = false;
    }
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
        formData.value = {
            user_id: '',
            role_name: '',
            cluster_id: '',
            namespace: '',
        };
        fetchUsers();
        fetchRoles();
        fetchClusters();
    }
  }
);

const rules: FormRules = {
  user_id: [{ required: true, message: '请选择用户', trigger: 'change' as ValidateTriggerType }],
  role_name: [{ required: true, message: '请选择角色', trigger: 'change' as ValidateTriggerType }],
  cluster_id: [{ required: true, message: '请选择集群', trigger: 'change' as ValidateTriggerType }],
};

const onConfirm = () => {
  // @ts-ignore
  form.value.submit();
};

const form = ref(null);

const onSubmit = ({ validateResult, firstError }: any) => {
  if (validateResult === true) {
    emit('confirm', { ...formData.value });
  } else {
    MessagePlugin.warning(firstError);
  }
};

const onClose = () => {
  visible.value = false;
};
</script>
