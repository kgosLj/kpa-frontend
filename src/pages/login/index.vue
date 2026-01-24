<template>
  <div class="login-wrapper">
    <login-header />

    <div class="login-container">
      <div class="title-container">
        <h1 class="title margin-no">KPA</h1>
        <h1 class="title">你的一站式Kubernetes管理台</h1>
      </div>

      <login />
      <tdesign-setting />
    </div>

    <footer class="copyright">Copyright @ 2021-2025 Tencent. All Rights Reserved</footer>
  </div>
</template>
<script setup lang="ts">
import TdesignSetting from '@/layouts/setting.vue';

import LoginHeader from './components/Header.vue';
import Login from './components/Login.vue';

defineOptions({
  name: 'LoginIndex',
});
</script>
<style lang="less" scoped>
@import './index.less';
</style>
