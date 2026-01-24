import { request } from '@/utils/request';

const Api = {
  Cluster: '/clusters',
};

// 集群资源统计信息
export interface ClusterResourceStats {
  node_count: number;
  node_ready: number;
  pod_count: number;
  pod_running: number;
  cpu_capacity: string;
  cpu_allocatable: string;
  memory_capacity: string;
  memory_allocatable: string;
}

// 集群响应类型（完整版）
export interface Cluster {
  id: string;
  name: string;
  provider: string;
  environment: string;
  region: string;
  creator: string;
  status: number;
  proxy_cache_version: number;
  prometheus_url?: string | null;
  resources?: ClusterResourceStats;
}

// 创建集群请求
export interface ClusterCreateRequest {
  name: string;
  kubeconfig: string;  // base64 编码的 kubeconfig
  provider: string;
  environment: string;
  region?: string;
  prometheus_url?: string;
}

// 更新集群请求
export interface ClusterUpdateRequest {
  name?: string;
  provider?: string;
  environment?: string;
  region?: string;
  status?: number;
  kubeconfig?: string;
  prometheus_url?: string | null;
}

// 集群验证响应
export interface ClusterValidateResponse {
  id: string;
  name: string;
  api_server: string;
  git_version: string;
  git_commit: string;
  platform: string;
  major: string;
  minor: string;
  build_date: string;
  ready: boolean;
  message: string;
  checked_at: string;
}

// 获取集群列表
export function getClusterList() {
  return request.get<Cluster[]>({
    url: Api.Cluster,
  });
}

// 获取集群详情
export function getClusterDetail(clusterId: string) {
  return request.get<Cluster>({
    url: `${Api.Cluster}/${clusterId}`,
  });
}

// 创建集群
export function createCluster(data: ClusterCreateRequest) {
  return request.post<Cluster>({
    url: Api.Cluster,
    data,
  });
}

// 更新集群
export function updateCluster(clusterId: string, data: ClusterUpdateRequest) {
  return request.put<Cluster>({
    url: `${Api.Cluster}/${clusterId}`,
    data,
  });
}

// 删除集群
export function deleteCluster(clusterId: string) {
  return request.delete({
    url: `${Api.Cluster}/${clusterId}`,
  });
}

// 验证集群连接
export function validateCluster(clusterId: string) {
  return request.post<ClusterValidateResponse>({
    url: `${Api.Cluster}/${clusterId}/validate`,
  });
}
