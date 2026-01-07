import { ToolsIcon } from 'tdesign-icons-vue-next';
import { shallowRef } from 'vue';

import Layout from '@/layouts/index.vue';

export default [
  {
    path: '/operations',
    name: 'operations',
    component: Layout,
    redirect: '/operations/clusters',
    meta: {
      title: '运维控制面板',
      icon: shallowRef(ToolsIcon),
      orderNo: 4,
      requireAdmin: true, // 仅管理员可访问
    },
    children: [
      {
        path: 'clusters',
        name: 'ClusterManagement',
        component: () => import('@/pages/operations/clusters/index.vue'),
        meta: {
          title: '集群管理',
          requireAdmin: true,
        },
      },
      {
        path: 'audit-logs',
        name: 'OperationAuditLogs',
        component: () => import('@/pages/operations/audit/index.vue'),
        meta: {
          title: '集群操作记录',
          requireAdmin: true,
        },
      },
      {
        path: 'scaling',
        name: 'QuickScaling',
        component: () => import('@/pages/operations/scaling/index.vue'),
        meta: {
          title: '快速扩容',
          requireAdmin: true,
        },
      },
    ],
  },
];
