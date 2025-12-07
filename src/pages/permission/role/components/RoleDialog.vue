<template>
  <t-dialog
    v-model:visible="visible"
    :header="title"
    :on-confirm="onConfirm"
    :on-close="onClose"
    width="600px"
  >
    <t-form ref="form" :data="formData" :rules="rules" @submit="onSubmit">
      <t-form-item label="角色名称" name="name">
        <t-input v-model="formData.name" placeholder="请输入角色名称" :disabled="isEdit && formData.is_system" />
      </t-form-item>
      <t-form-item label="描述" name="description">
        <t-textarea v-model="formData.description" placeholder="请输入角色描述" />
      </t-form-item>
      <t-form-item label="权限配置" name="permissions">
        <t-tag-input
          v-model="formData.permissions"
          placeholder="输入权限后按回车，如 *:list"
          :disabled="isEdit && formData.is_system"
          clearable
        />
        <div class="tips">格式示例: resource:action (如 pod:list) 或 * (所有权限)</div>
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { MessagePlugin, FormRules, ValidateTriggerType } from 'tdesign-vue-next';
import type { Role } from '@/api/model/roleModel';

const props = defineProps<{
  visible: boolean;
  data?: Role;
}>();

const emit = defineEmits(['update:visible', 'confirm']);

const visible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
});

const isEdit = computed(() => !!props.data?.id);
const title = computed(() => (isEdit.value ? '编辑角色' : '新建角色'));

const formData = ref({
  name: '',
  description: '',
  is_system: false,
  permissions: [] as string[],
});

watch(
  () => props.data,
  (val) => {
    if (val) {
      let perms: string[] = [];
      try {
        perms = JSON.parse(val.permissions);
      } catch (e) {
        perms = [];
      }
      formData.value = {
        name: val.name,
        description: val.description,
        is_system: val.is_system,
        permissions: perms,
      };
    } else {
      formData.value = {
        name: '',
        description: '',
        is_system: false,
        permissions: [],
      };
    }
  },
  { immediate: true },
);

const rules: FormRules = {
  name: [{ required: true, message: '请输入角色名称', trigger: 'blur' as ValidateTriggerType }],
  permissions: [
    { required: true, message: '请配置权限', type: 'error', trigger: 'change' as ValidateTriggerType },
    {
      validator: (val: string[]) => {
        if (!val || val.length === 0) return { result: false, message: '请配置权限', type: 'error' };
        for (const p of val) {
             if (p !== '*' && (p.match(/:/g) || []).length !== 1) {
                 return { result: false, message: `权限格式错误: ${p}, 请使用 resource:action 或 *`, type: 'error' };
             }
        }
        return true;
      },
      trigger: 'change' as ValidateTriggerType
    }
  ],
};

const onConfirm = () => {
  // @ts-ignore
  form.value.submit();
};

const form = ref(null);

const onSubmit = ({ validateResult, firstError }: any) => {
  if (validateResult === true) {
    emit('confirm', {
      ...formData.value,
      // permissions is already in formData.value, but just effectively passing the object.
      // previous code manually merged. Since formData has permissions now, we can just pass formData.value
    });
  } else {
    MessagePlugin.warning(firstError);
  }
};

const onClose = () => {
  visible.value = false;
};
</script>

<style scoped>
.tips {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
  margin-top: 4px;
}
</style>
