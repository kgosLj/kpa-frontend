import { request } from '@/utils/request';
import type { RoleBinding, GrantRoleRequest, RevokeRoleRequest } from '@/api/model/roleBindingModel';

const Api = {
    RoleBinding: '/role-bindings',
    Grant: '/role-bindings/grant',
    Revoke: '/role-bindings/revoke',
};

// 获取所有角色绑定（支持过滤）
export function getRoleBindingList(params?: { username?: string; cluster_id?: string }) {
    return request.get<RoleBinding[]>({
        url: Api.RoleBinding,
        params,
    });
}

// 获取指定用户的绑定列表
export function getRoleBindingListByUser(userId: string) {
    return request.get<RoleBinding[]>({
        url: `${Api.RoleBinding}/users/${userId}`,
    });
}

// 获取指定集群的绑定列表
export function getRoleBindingListByCluster(clusterId: string) {
    return request.get<RoleBinding[]>({
        url: `${Api.RoleBinding}/clusters/${clusterId}`,
    });
}

export function grantRole(data: GrantRoleRequest) {
    return request.post({
        url: Api.Grant,
        data,
    });
}

export function revokeRole(data: RevokeRoleRequest) {
    return request.post({
        url: Api.Revoke,
        data,
    });
}

export function deleteRoleBinding(id: number) {
    return request.delete({
        url: `${Api.RoleBinding}/${id}`,
    });
}
