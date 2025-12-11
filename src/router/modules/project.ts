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
            {
                path: 'detail/:id',
                name: 'ProjectDetail',
                component: () => import('@/pages/project/detail.vue'),
                meta: { title: '项目详情' },
            },
            {
                path: 'select',
                name: 'ProjectSelect',
                component: () => import('@/pages/project/select.vue'),
                meta: { title: '选择项目' },
            },
        ],
    },
];

