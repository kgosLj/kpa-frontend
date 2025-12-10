import { request } from '@/utils/request';
import type {
    BackupResponse,
    CreateBackupRequest,
    BackupListRequest,
    BackupListResponse,
    ScheduleResponse,
    CreateScheduleRequest,
    RestoreRequest,
    RestoreResponse,
    RestoreListRequest,
    RestoreListResponse,
} from './model/backupModel';

/**
 * 获取备份列表
 * @param clusterId 集群 ID
 * @param params 查询参数
 */
export function getBackupList(clusterId: string, params?: BackupListRequest) {
    return request.get<BackupListResponse>({
        url: `/clusters/${clusterId}/backups`,
        params,
    });
}

/**
 * 获取单个备份详情
 * @param clusterId 集群 ID
 * @param name 备份名称
 */
export function getBackup(clusterId: string, name: string) {
    return request.get<BackupResponse>({
        url: `/clusters/${clusterId}/backups/${name}`,
    });
}

/**
 * 创建备份
 * @param clusterId 集群 ID
 * @param data 备份数据
 */
export function createBackup(clusterId: string, data: CreateBackupRequest) {
    return request.post<BackupResponse>({
        url: `/clusters/${clusterId}/backups`,
        data,
    });
}

/**
 * 删除备份
 * @param clusterId 集群 ID
 * @param name 备份名称
 */
export function deleteBackup(clusterId: string, name: string) {
    return request.delete({
        url: `/clusters/${clusterId}/backups/${name}`,
    });
}

/**
 * 恢复备份
 * @param clusterId 集群 ID
 * @param name 备份名称
 * @param data 恢复参数
 */
export function restoreBackup(clusterId: string, name: string, data: RestoreRequest) {
    return request.post<RestoreResponse>({
        url: `/clusters/${clusterId}/backups/${name}/restore`,
        data,
    });
}

/**
 * 获取定时备份列表
 * @param clusterId 集群 ID
 */
export function getScheduleList(clusterId: string) {
    return request.get<ScheduleResponse[]>({
        url: `/clusters/${clusterId}/backup-schedules`,
    });
}

/**
 * 创建定时备份
 * @param clusterId 集群 ID
 * @param data 定时备份数据
 */
export function createSchedule(clusterId: string, data: CreateScheduleRequest) {
    return request.post<ScheduleResponse>({
        url: `/clusters/${clusterId}/backup-schedules`,
        data,
    });
}

/**
 * 删除定时备份
 * @param clusterId 集群 ID
 * @param name 调度名称
 */
export function deleteSchedule(clusterId: string, name: string) {
    return request.delete({
        url: `/clusters/${clusterId}/backup-schedules/${name}`,
    });
}

/**
 * 获取恢复任务列表
 * @param clusterId 集群 ID
 * @param params 查询参数
 */
export function getRestoreList(clusterId: string, params?: RestoreListRequest) {
    return request.get<RestoreListResponse>({
        url: `/clusters/${clusterId}/restores`,
        params,
    });
}
