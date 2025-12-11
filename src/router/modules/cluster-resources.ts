import Layout from '@/layouts/index.vue';

export default [
    {
        path: '/cluster-resources',
        name: 'ClusterResources',
        component: Layout,
        redirect: '/cluster-resources/management',
        meta: { title: '集群资源', icon: 'server' },
        children: [
            {
                path: 'management',
                name: 'ClusterResourceManagement',
                component: () => import('@/pages/cluster-resources/management.vue'),
                meta: { title: '资源管理' },
            },
            {
                path: 'pods',
                name: 'ClusterResourcePods',
                component: () => import('@/pages/cluster-resources/pods-detail.vue'),
                meta: { title: 'Pods', hidden: true },
            },
        ],
    },
];
