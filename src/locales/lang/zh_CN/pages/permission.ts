export default {
    role: {
        title: '角色管理',
        create: '新建角色',
        edit: '编辑角色',
        delete: '删除角色',
        name: '角色名称',
        description: '描述',
        isSystem: '类型',
        createTime: '创建时间',
        system: '系统预置',
        custom: '自定义',
        permissions: '权限配置',
        permissionsTip: '格式示例: resource:action (如 pod:list) 或 * (所有权限)',
    },
    binding: {
        title: '授权管理',
        grant: '授予权限',
        revoke: '撤销权限',
        userId: '用户ID',
        role: '角色',
        cluster: '集群',
        namespace: '命名空间',
        bindTime: '绑定时间',
    }
};
