import { request } from '@/utils/request';

const Api = {
  Metrics: '/clusters',
  Proxy: '/clusters',
};

// 集群监控指标响应
export interface ClusterMetricsResponse {
  cpu_total: string;         // 总核心数 (e.g. "4000m")
  cpu_usage: string;         // 已用 (e.g. "1500m")
  cpu_percentage: number;    // 使用率 (0-100)
  memory_total: string;      // 总内存 (e.g. "16Gi")
  memory_usage: string;      // 已用 (e.g. "4Gi")
  memory_percentage: number; // 使用率 (0-100)
  nodes_count: number;       // 节点总数
  timestamp: string;         // 数据时间
}

// 集群资源统计响应
export interface ClusterResourceStats {
  pod_count: number;          // Pod 总数
  pod_running: number;        // 运行中的 Pod
  namespace_count: number;    // 命名空间数量
  deployment_count: number;   // Deployment 数量
  service_count: number;      // Service 数量
}

// 节点监控项
export interface NodeMetricsItem {
  name: string;              // 节点名称
  status: string;            // 状态 (Ready, NotReady)
  ip: string;                // 节点 IP
  cpu_usage: string;         // CPU 使用量 (milli)
  cpu_capacity: string;      // CPU 总容量 (milli)
  cpu_percentage: number;    // 利用率
  memory_usage: string;      // 内存使用量 (bytes/IEC)
  memory_capacity: string;   // 内存总容量
  memory_percentage: number; // 利用率
}

// 节点监控响应
export interface NodeMetricsResponse {
  items: NodeMetricsItem[];
}

// Pod 监控容器项
export interface ContainerMetricsItem {
  name: string;
  cpu_usage: string;
  memory_usage: string;
}

// Pod 监控项
export interface PodMetricsItem {
  name: string;
  namespace: string;
  total_cpu_usage: string;
  total_memory_usage: string;
  containers: ContainerMetricsItem[];
}

// Pod 监控响应
export interface PodMetricsResponse {
  items: PodMetricsItem[];
}

/**
 * 获取集群聚合监控数据
 * @param clusterId 集群 ID
 */
export function getClusterMetrics(clusterId: string) {
  return request.get<ClusterMetricsResponse>({
    url: `${Api.Metrics}/${clusterId}/metrics/cluster`,
  });
}

/**
 * 获取节点监控列表
 * @param clusterId 集群 ID
 */
export function getNodeMetrics(clusterId: string) {
  return request.get<NodeMetricsResponse>({
    url: `${Api.Metrics}/${clusterId}/metrics/nodes`,
  });
}

/**
 * 获取 Pod 监控列表
 * @param clusterId 集群 ID
 * @param namespace 命名空间（可选，默认获取所有）
 */
export function getPodMetrics(clusterId: string, namespace?: string) {
  return request.get<PodMetricsResponse>({
    url: `${Api.Metrics}/${clusterId}/metrics/pods`,
    params: namespace ? { namespace } : undefined,
  });
}

/**
 * 获取集群资源统计
 * @param clusterId 集群 ID
 */
export async function getClusterResourceStats(clusterId: string): Promise<ClusterResourceStats> {
  try {
    // 获取所有 Pod
    const podsRes = await request.get<any>({
      url: `${Api.Proxy}/${clusterId}/proxy/api/v1/pods`,
      headers: {
        'X-Current-Cluster': clusterId,
      },
    });
    console.log('Pods response:', podsRes);
    const pods = podsRes?.items || [];
    const podCount = pods.length;
    const podRunning = pods.filter((p: any) => p.status?.phase === 'Running').length;

    // 获取所有命名空间
    const namespacesRes = await request.get<any>({
      url: `${Api.Proxy}/${clusterId}/proxy/api/v1/namespaces`,
      headers: {
        'X-Current-Cluster': clusterId,
      },
    });
    console.log('Namespaces response:', namespacesRes);
    const namespaceCount = namespacesRes?.items?.length || 0;

    // 获取所有 Deployment
    const deploymentsRes = await request.get<any>({
      url: `${Api.Proxy}/${clusterId}/proxy/apis/apps/v1/deployments`,
      headers: {
        'X-Current-Cluster': clusterId,
      },
    });
    console.log('Deployments response:', deploymentsRes);
    const deploymentCount = deploymentsRes?.items?.length || 0;

    // 获取所有 Service
    const servicesRes = await request.get<any>({
      url: `${Api.Proxy}/${clusterId}/proxy/api/v1/services`,
      headers: {
        'X-Current-Cluster': clusterId,
      },
    });
    console.log('Services response:', servicesRes);
    const serviceCount = servicesRes?.items?.length || 0;

    console.log('Resource stats:', {
      pod_count: podCount,
      pod_running: podRunning,
      namespace_count: namespaceCount,
      deployment_count: deploymentCount,
      service_count: serviceCount,
    });

    return {
      pod_count: podCount,
      pod_running: podRunning,
      namespace_count: namespaceCount,
      deployment_count: deploymentCount,
      service_count: serviceCount,
    };
  } catch (error) {
    console.error('Failed to fetch cluster resource stats:', error);
    return {
      pod_count: 0,
      pod_running: 0,
      namespace_count: 0,
      deployment_count: 0,
      service_count: 0,
    };
  }
}
