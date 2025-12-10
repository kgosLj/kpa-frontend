<template>
  <t-dialog
    v-model:visible="dialogVisible"
    header="恢复备份"
    :on-confirm="handleConfirm"
    :confirm-btn="{ loading: confirmLoading }"
    width="500px"
  >
    <t-alert theme="info" message="恢复操作将从备份中恢复资源到指定命名空间" style="margin-bottom: 16px" />
    <t-form ref="formRef" :data="formData" label-width="120px">
      <t-form-item label="备份名称">
        <t-input :value="backupName" disabled />
      </t-form-item>
      <t-form-item label="目标命名空间" name="target_namespace">
        <t-input
          v-model="formData.target_namespace"
          placeholder="可选,默认恢复到原命名空间"
        />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { FormInstanceFunctions } from 'tdesign-vue-next';
import type { RestoreRequest } from '@/api/model/backupModel';

interface Props {
  visible: boolean;
  backupName: string;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  backupName: '',
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'confirm', data: RestoreRequest): void;
}>();

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
});

const formRef = ref<FormInstanceFunctions>();
const confirmLoading = ref(false);

const formData = ref<RestoreRequest>({
  target_namespace: '',
});

const handleConfirm = async () => {
  confirmLoading.value = true;
  try {
    const submitData: RestoreRequest = {};
    if (formData.value.target_namespace) {
      submitData.target_namespace = formData.value.target_namespace;
    }
    emit('confirm', submitData);
  } finally {
    confirmLoading.value = false;
  }
};
</script>
