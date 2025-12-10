import { BackupIcon } from 'tdesign-icons-vue-next';
import { shallowRef } from 'vue';

import Layout from '@/layouts/index.vue';

export default [
    {
        path: '/backup',
        name: 'backup',
        component: Layout,
        redirect: '/backup/list',
        meta: {
            title: '集群备份',
            icon: shallowRef(BackupIcon),
            orderNo: 3,
        },
        children: [
            {
                path: 'list',
                name: 'BackupList',
                component: () => import('@/pages/backup/list/index.vue'),
                meta: {
                    title: '备份列表',
                },
            },
            {
                path: 'schedule',
                name: 'BackupSchedule',
                component: () => import('@/pages/backup/schedule/index.vue'),
                meta: {
                    title: '定时备份',
                },
            },
            {
                path: 'restore',
                name: 'BackupRestore',
                component: () => import('@/pages/backup/restore/index.vue'),
                meta: {
                    title: '恢复记录',
                },
            },
        ],
    },
];
