// 备份相关类型定义

/**
 * 创建备份请求
 */
export interface CreateBackupRequest {
    name: string;
    namespace: string;
    included_resources?: string[];
    ttl?: string; // 如 "720h"（30天）
    storage_location?: string;
}

/**
 * 备份响应
 */
export interface BackupResponse {
    id: string;
    name: string;
    cluster_id: string;
    namespace: string;
    status: string; // 数据库状态: New/InProgress/Completed/Failed
    phase: string; // Velero 状态
    included_resources: string[];
    start_timestamp?: string;
    completion_timestamp?: string;
    expiration?: string;
    errors: number;
    warnings: number;
    storage_location?: string;
}

/**
 * 备份列表查询参数
 */
export interface BackupListRequest {
    namespace?: string;
    status?: string;
    page?: number;
    page_size?: number;
}

/**
 * 备份列表响应
 */
export interface BackupListResponse {
    items: BackupResponse[];
    total: number;
    page: number;
    page_size: number;
}

/**
 * 创建定时备份请求
 */
export interface CreateScheduleRequest {
    name: string;
    namespace: string;
    schedule: string; // Cron 表达式，如 "0 2 * * *"
    template: CreateBackupRequest;
    paused?: boolean;
}

/**
 * 定时备份响应
 */
export interface ScheduleResponse {
    id: string;
    name: string;
    cluster_id: string;
    namespace: string;
    schedule: string;
    template: CreateBackupRequest;
    paused: boolean;
    last_backup_time?: string;
    next_schedule_time?: string;
    created_at: string;
}

/**
 * 恢复备份请求
 */
export interface RestoreRequest {
    target_namespace?: string;
}

/**
 * 恢复响应
 */
export interface RestoreResponse {
    id: string;
    backup_name: string;
    cluster_id: string;
    target_namespace: string;
    status: string;
    phase: string;
    errors: number;
    warnings: number;
    created_at: string;
    completed_at?: string;
}

/**
 * 恢复列表查询参数
 */
export interface RestoreListRequest {
    backup_name?: string;
    status?: string;
    page?: number;
    page_size?: number;
}

/**
 * 恢复列表响应
 */
export interface RestoreListResponse {
    items: RestoreResponse[];
    total: number;
    page: number;
    page_size: number;
}
