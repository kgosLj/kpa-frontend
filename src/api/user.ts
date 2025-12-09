import { request } from '@/utils/request';

const Api = {
    User: '/users',
};

export interface User {
    id: string;
    username: string;
    is_super_admin: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateUserRequest {
    username: string;
}

export interface UserListResult {
    items: User[];
    total: number;
}

export function getUserList() {
    return request.get<UserListResult>({
        url: Api.User,
    });
}

export function createUser(data: CreateUserRequest) {
    return request.post<User>({
        url: Api.User,
        data,
    });
}
