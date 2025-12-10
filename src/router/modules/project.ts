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
                path: 'detail/:id/resources/deployments',
                name: 'ProjectResourceDeployments',
                component: () => import('@/pages/project/resources/deployments.vue'),
                meta: { title: 'Deployments' },
            },
            {
                path: 'detail/:id/resources/services',
                name: 'ProjectResourceServices',
                component: () => import('@/pages/project/resources/services.vue'),
                meta: { title: 'Services' },
            },
            {
                path: 'detail/:id/resources/configmaps',
                name: 'ProjectResourceConfigmaps',
                component: () => import('@/pages/project/resources/configmaps.vue'),
                meta: { title: 'ConfigMaps' },
            },
            {
                path: 'detail/:id/resources/secrets',
                name: 'ProjectResourceSecrets',
                component: () => import('@/pages/project/resources/secrets.vue'),
                meta: { title: 'Secrets' },
            },
        ],
    },
];

