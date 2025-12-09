import Layout from '@/layouts/index.vue';

export default [
    {
        path: '/project',
        name: 'project',
        component: Layout,
        redirect: '/project/list',
        meta: { title: '项目管理', icon: 'layers' },
        children: [
            {
                path: 'list',
                name: 'ProjectList',
                component: () => import('@/pages/project/index.vue'),
                meta: { title: '项目列表' },
            },
        ],
    },
];
