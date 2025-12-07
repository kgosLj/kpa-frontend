import { defineStore } from 'pinia';

import { login } from '@/api/auth';
import { usePermissionStore } from '@/store';
import type { UserInfo } from '@/types/interface';

const InitUserInfo: UserInfo = {
  name: '', // 用户名，用于展示在页面右上角头像处
  roles: [], // 前端权限模型使用 如果使用请配置modules/permission-fe.ts使用
};

export const useUserStore = defineStore('user', {
  state: () => ({
    token: 'main_token', // 默认token不走权限
    userInfo: { ...InitUserInfo },
  }),
  getters: {
    roles: (state) => {
      return state.userInfo?.roles;
    },
  },
  actions: {
    async login(userInfo: Record<string, unknown>) {
      const res = await login({
        username: userInfo.account as string,
        password: userInfo.password as string,
        phone: userInfo.phone as string,
        verifyCode: userInfo.verifyCode as string,
      });

      if (res.access_token) {
        this.token = res.access_token;
        // 存储用户信息，因为后端没有/me接口
        this.userInfo = {
          name: userInfo.account as string || userInfo.phone as string,
          roles: [res.role],
        };
      } else {
        throw new Error('Login failed: Token not received');
      }
    },
    async getUserInfo() {
      // 后端暂无 /me 接口，使用登录时获取的信息
      // 如果需要持久化，已经在 login 中设置了 state
      // 此处保留方法是为了兼容前端路由守卫的调用检查
      if (!this.userInfo.name) {
        // 如果页面刷新，尝试从本地存储恢复或重新登录
        // 这里暂时只是防止空数据报错，实际可能需要持久化存储支持
        // 由于 pinia-plugin-persist 存在，state 会被恢复
      }
    },
    async logout() {
      this.token = '';
      this.userInfo = { ...InitUserInfo };
    },
  },
  persist: {
    afterRestore: () => {
      const permissionStore = usePermissionStore();
      permissionStore.initRoutes();
    },
    key: 'user',
    paths: ['token', 'userInfo'],
  },
});
