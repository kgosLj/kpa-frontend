<template>
  <t-dialog
    v-model:visible="visible"
    header="新建用户"
    :on-confirm="onConfirm"
    :on-close="onClose"
    width="500px"
  >
    <t-form ref="form" :data="formData" :rules="rules" @submit="onSubmit" label-width="100px">
      <t-form-item label="用户名" name="username">
        <t-input v-model="formData.username" placeholder="请输入用户名" />
        <div class="tips">默认密码: user_Kpa123</div>
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { MessagePlugin, FormRules, ValidateTriggerType } from 'tdesign-vue-next';
import { createUser } from '@/api/user';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits(['update:visible', 'confirm']);

const visible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
});

const formData = ref({
  username: '',
});

watch(
  () => props.visible,
  (val) => {
    if (val) {
      formData.value.username = '';
    }
  }
);

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' as ValidateTriggerType }],
};

const onConfirm = () => {
  // @ts-ignore
  form.value.submit();
};

const form = ref(null);

const onSubmit = async ({ validateResult, firstError }: any) => {
  if (validateResult === true) {
    try {
      await createUser({ username: formData.value.username });
      MessagePlugin.success('用户创建成功');
      emit('confirm');
      visible.value = false;
    } catch (e: any) {
      MessagePlugin.error(e.message || '创建失败');
      console.error(e);
    }
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
  margin-left: 8px;
}
</style>
