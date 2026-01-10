import { request } from '../utils/request';

// 历史版本响应接口
export interface HistoryVersion {
  id: number;
  cluster_id: string;
  namespace: string;
  name: string;
  kind: string;
  version: number;
  yaml_content?: string; // 列表时不返回，单个查询时返回
  created_by: string;
  created_at: string;
  description: string;
}

// 获取历史版本列表请求参数
export interface GetHistoryVersionsParams {
  namespace: string;
  name: string;
  kind: 'Deployment' | 'Service' | 'ConfigMap';
}

// 获取指定版本请求参数
export interface GetHistoryByVersionParams extends GetHistoryVersionsParams {
  version: number;
}

// 回滚请求参数
export interface RollbackRequest {
  namespace: string;
  name: string;
  kind: 'Deployment' | 'Service' | 'ConfigMap';
  version: number;
}

// 保存历史版本请求参数
export interface SaveHistoryRequest {
  namespace: string;
  name: string;
  kind: 'Deployment' | 'Service' | 'ConfigMap';
  yaml_content: string;
  description?: string;
}

/**
 * 获取资源的历史版本列表
 */
export function getHistoryVersions(clusterId: string, params: GetHistoryVersionsParams) {
  return request.get<HistoryVersion[]>({
    url: `/clusters/${clusterId}/rollback/history`,
    params,
  });
}

/**
 * 获取指定版本的历史记录（包含完整 YAML）
 */
export function getHistoryByVersion(clusterId: string, params: GetHistoryByVersionParams) {
  return request.get<HistoryVersion>({
    url: `/clusters/${clusterId}/rollback/history/version`,
    params,
  });
}

/**
 * 回滚到指定版本
 */
export function rollbackToVersion(clusterId: string, data: RollbackRequest) {
  return request.post<{ message: string }>({
    url: `/clusters/${clusterId}/rollback`,
    data,
  });
}

/**
 * 保存资源历史版本
 */
export function saveResourceHistory(clusterId: string, data: SaveHistoryRequest) {
  return request.post<{ message: string }>({
    url: `/clusters/${clusterId}/rollback/save`,
    data,
  });
}
