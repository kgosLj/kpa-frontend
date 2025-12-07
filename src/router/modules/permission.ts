import Layout from '@/layouts/index.vue';

export default [
    {
        path: '/permission',
        name: 'permission',
        component: Layout,
        redirect: '/permission/role',
        meta: {
            title: '权限管理',
            icon: 'user-safety',
            orderNo: 0,
        },
        children: [
            {
                path: 'role',
                name: 'RoleList',
                component: () => import('@/pages/permission/role/index.vue'),
                meta: {
                    title: '角色管理',
                },
            },
            {
                path: 'user',
                name: 'UserList',
                component: () => import('@/pages/permission/user/index.vue'),
                meta: {
                    title: '用户管理',
                },
            },
            {
                path: 'binding',
                name: 'RoleBindingList',
                component: () => import('@/pages/permission/binding/index.vue'),
                meta: {
                    title: '授权管理',
                },
            },
        ],
    },
];
