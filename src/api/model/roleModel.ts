export interface Role {
    id: number;
    name: string;
    description: string;
    permissions: string; // JSON string of permissions array
    is_system: boolean;
    create_time: string;
    update_time: string;
}

export interface CreateRoleRequest {
    name: string;
    description: string;
    permissions: string[];
}

export interface UpdateRoleRequest {
    name?: string;
    description?: string;
    permissions?: string[];
}
