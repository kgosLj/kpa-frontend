export interface RoleBinding {
    id: number;
    user_id: string;
    username?: string;
    role_id: number;
    role_name?: string;
    cluster_id: string;
    namespace: string;
    create_time: string;
}

export interface CreateRoleBindingRequest {
    user_id: string;
    role_id: number;
    cluster_id: string;
    namespace: string;
}

export interface GrantRoleRequest {
    user_id: string;
    role_name: string;
    cluster_id: string;
    namespace: string;
}

export interface RevokeRoleRequest {
    user_id: string;
    role_name: string;
    cluster_id: string;
    namespace: string;
}
