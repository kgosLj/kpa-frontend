import { request } from '@/utils/request';
import type { Role, CreateRoleRequest, UpdateRoleRequest } from '@/api/model/roleModel';

const Api = {
    Role: '/roles',
};

export function getRoleList() {
    return request.get<Role[]>({
        url: Api.Role,
    });
}

export function createRole(data: CreateRoleRequest) {
    return request.post<Role>({
        url: Api.Role,
        data,
    });
}

export function updateRole(id: number, data: UpdateRoleRequest) {
    return request.put<Role>({
        url: `${Api.Role}/${id}`,
        data,
    });
}

export function deleteRole(id: number) {
    return request.delete({
        url: `${Api.Role}/${id}`,
    });
}

export function getRole(id: number) {
    return request.get<Role>({
        url: `${Api.Role}/${id}`,
    });
}
