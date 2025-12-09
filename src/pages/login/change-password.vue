<template>
  <div class="login-wrapper">
    <login-header />

    <div class="login-container">
      <div class="title-container">
        <h1 class="title margin-no">Change Password</h1>
        <div class="sub-title">
          <p class="tip">You must change your password before proceeding.</p>
        </div>
      </div>

      <t-form
        ref="form"
        :class="['item-container']"
        :data="formData"
        :rules="FORM_RULES"
        label-width="0"
        @submit="onSubmit"
      >
        <t-form-item name="oldPassword">
          <t-input v-model="formData.oldPassword" type="password" clearable placeholder="Old Password">
            <template #prefix-icon>
              <t-icon name="lock-on" />
            </template>
          </t-input>
        </t-form-item>

        <t-form-item name="newPassword">
          <t-input v-model="formData.newPassword" type="password" clearable placeholder="New Password">
            <template #prefix-icon>
              <t-icon name="lock-on" />
            </template>
          </t-input>
        </t-form-item>

        <t-form-item name="confirmPassword">
          <t-input v-model="formData.confirmPassword" type="password" clearable placeholder="Confirm New Password">
            <template #prefix-icon>
              <t-icon name="lock-on" />
            </template>
          </t-input>
        </t-form-item>

        <t-form-item class="btn-container">
          <t-button block theme="primary" type="submit" :loading="loading"> Change Password </t-button>
        </t-form-item>
      </t-form>
      <tdesign-setting />
    </div>

    <footer class="copyright">Copyright @ 2021-2025 Tencent. All Rights Reserved</footer>
  </div>
</template>

<script setup lang="ts">
import { MessagePlugin } from 'tdesign-vue-next';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { changePassword } from '@/api/auth';
import TdesignSetting from '@/layouts/setting.vue';
import { useUserStore } from '@/store';

import LoginHeader from './components/Header.vue';

const router = useRouter();
const userStore = useUserStore();

const formData = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const loading = ref(false);

const FORM_RULES = {
  oldPassword: [{ required: true, message: 'Required', type: 'error' as const }],
  newPassword: [{ required: true, message: 'Required', type: 'error' as const }],
  confirmPassword: [
    { required: true, message: 'Required', type: 'error' as const },
    {
      validator: (val: string) => val === formData.value.newPassword,
      message: 'Passwords do not match',
      type: 'error' as const,
    },
  ],
};

const onSubmit = async ({ validateResult }: any) => {
  if (validateResult === true) {
    loading.value = true;
    try {
      await changePassword({
        old_password: formData.value.oldPassword,
        new_password: formData.value.newPassword,
      });
      MessagePlugin.success('Password changed successfully');
      
      // Update store
      userStore.userInfo.needChangePassword = false;
      
      // Redirect to home
      router.push('/');
    } catch (e: any) {
      MessagePlugin.error(e.message);
    } finally {
      loading.value = false;
    }
  }
};
</script>

<style lang="less" scoped>
@import './index.less';
</style>
