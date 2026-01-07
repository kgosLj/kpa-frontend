import { request } from '@/utils/request';

/**
 * 审计日志查询参数
 */
export interface AuditLogQueryParams {
  cluster_name?: string;
  username?: string;
  project_name?: string;
  resource_type?: string;
  namespace?: string;
  operation_type?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

/**
 * 审计日志项
 */
export interface AuditLogItem {
  username: string;
  project_name: string;
  cluster_name: string;
  operation_type: string;
  resource_type: string;
  resource_name: string;
  namespace: string;
  timestamp: string;
}

/**
 * 审计日志列表响应
 */
export interface AuditLogListResponse {
  total: number;
  page: number;
  page_size: number;
  items: AuditLogItem[];
}

/**
 * 获取审计日志列表
 */
export const getAuditLogs = (params: AuditLogQueryParams): Promise<AuditLogListResponse> => {
  return request.get<AuditLogListResponse>({
    url: '/audit/logs',
    params,
  });
};
