import { DashboardIcon } from 'tdesign-icons-vue-next';
import { shallowRef } from 'vue';

import Layout from '@/layouts/index.vue';

export default [
  {
    path: '/dashboard',
    component: Layout,
    redirect: '/dashboard/multi-cluster',
    name: 'dashboard',
    meta: {
      title: {
        zh_CN: 'Kubernetes 仪表盘',
        en_US: 'Kubernetes Dashboard',
      },
      icon: shallowRef(DashboardIcon),
      orderNo: 0,
    },
    children: [
      {
        path: 'multi-cluster',
        name: 'DashboardMultiCluster',
        component: () => import('@/pages/dashboard/multi-cluster/index.vue'),
        meta: {
          title: {
            zh_CN: '多集群看板',
            en_US: 'Multi-Cluster Dashboard',
          },
        },
      },
      {
        path: 'base',
        name: 'DashboardBase',
        component: () => import('@/pages/dashboard/base/index.vue'),
        meta: {
          title: {
            zh_CN: '单集群看板',
            en_US: 'Single Cluster Dashboard',
          },
        },
      },
    ],
  },
];
