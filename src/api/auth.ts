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
}

const Api = {
    Login: '/auth/login',
    Refresh: '/auth/refresh',
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
