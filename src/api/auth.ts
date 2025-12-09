import { request } from '@/utils/request';

export interface LoginRequest {
    username?: string;
    password?: string;
    phone?: string;
    verifyCode?: string;
    type?: 'password' | 'phone';
}

export interface LoginResponse {
    access_token: string;
    refresh_token: string;
    role: string;
    clusters: string[];
    need_change_password?: boolean;
}

export interface ChangePasswordRequest {
    old_password?: string;
    new_password?: string;
    confirm_password?: string; // Optional frontend check, backend only needs new_password
}

const Api = {
    Login: '/auth/login',
    Refresh: '/auth/refresh',
    ChangePassword: '/auth/change-password',
};

export function login(data: LoginRequest) {
    // Backend expects 'username' but frontend might send 'account' or 'phone'
    // Transformation handles this before calling API if needed, but here we define signature
    return request.post<LoginResponse>({
        url: Api.Login,
        data,
    });
}

export function refreshToken(token: string) {
    return request.post({
        url: Api.Refresh,
        data: {
            refresh_token: token,
        },
    });
}

export function changePassword(data: ChangePasswordRequest) {
    return request.post({
        url: Api.ChangePassword,
        data,
    });
}
