import { request } from '@/utils/request';

// K8s 资源通用接口
export interface K8sMetadata {
  name: string;
  namespace?: string;
  uid?: string;
  creationTimestamp?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface K8sResource {
  apiVersion: string;
  kind: string;
  metadata: K8sMetadata;
  spec?: any;
  status?: any;
}

export interface K8sListResponse<T = K8sResource> {
  apiVersion: string;
  kind: string;
  items: T[];
  metadata?: {
    resourceVersion?: string;
  };
}

// Deployment 相关接口
export interface DeploymentSpec {
  replicas?: number;
  selector: {
    matchLabels: Record<string, string>;
  };
  template: {
    metadata: {
      labels: Record<string, string>;
    };
    spec: {
      containers: Array<{
        name: string;
        image: string;
        ports?: Array<{
          containerPort: number;
          protocol?: string;
        }>;
        env?: Array<{
          name: string;
          value?: string;
          valueFrom?: any;
        }>;
        resources?: {
          requests?: Record<string, string>;
          limits?: Record<string, string>;
        };
      }>;
    };
  };
}

export interface DeploymentStatus {
  replicas?: number;
  updatedReplicas?: number;
  readyReplicas?: number;
  availableReplicas?: number;
  conditions?: Array<{
    type: string;
    status: string;
    reason?: string;
    message?: string;
  }>;
}

export interface Deployment extends K8sResource {
  spec: DeploymentSpec;
  status?: DeploymentStatus;
}

// Service 相关接口
export interface ServiceSpec {
  type: string;
  clusterIP?: string;
  ports: Array<{
    name?: string;
    protocol: string;
    port: number;
    targetPort: number | string;
    nodePort?: number;
  }>;
  selector?: Record<string, string>;
}

export interface Service extends K8sResource {
  spec: ServiceSpec;
  status?: any;
}

// ConfigMap 相关接口
export interface ConfigMap extends K8sResource {
  data?: Record<string, string>;
  binaryData?: Record<string, string>;
}

// Secret 相关接口
export interface Secret extends K8sResource {
  type: string;
  data?: Record<string, string>;
  stringData?: Record<string, string>;
}

// API 调用函数

/**
 * 获取 Deployment 列表
 */
export function getDeployments(clusterId: string, namespace: string) {
  return request.get<K8sListResponse<Deployment>>({
    url: `/clusters/${clusterId}/proxy/apis/apps/v1/namespaces/${namespace}/deployments`,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 获取单个 Deployment
 */
export function getDeployment(clusterId: string, namespace: string, name: string) {
  return request.get<Deployment>({
    url: `/clusters/${clusterId}/proxy/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 更新 Deployment
 */
export function updateDeployment(clusterId: string, namespace: string, name: string, data: Deployment) {
  return request.put<Deployment>({
    url: `/clusters/${clusterId}/proxy/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
    data,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 删除 Deployment
 */
export function deleteDeployment(clusterId: string, namespace: string, name: string) {
  return request.delete({
    url: `/clusters/${clusterId}/proxy/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 更新 Deployment 副本数
 */
export function scaleDeployment(clusterId: string, namespace: string, name: string, replicas: number) {
  return request.patch<Deployment>({
    url: `/clusters/${clusterId}/proxy/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
    data: {
      spec: {
        replicas,
      },
    },
    headers: {
      'X-Current-Cluster': clusterId,
      'Content-Type': 'application/merge-patch+json',
    },
  });
}

/**
 * 重启 Deployment (类似 kubectl rollout restart)
 */
export function restartDeployment(clusterId: string, namespace: string, name: string) {
  return request.patch<Deployment>({
    url: `/clusters/${clusterId}/proxy/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
    data: {
      spec: {
        template: {
          metadata: {
            annotations: {
              'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
            },
          },
        },
      },
    },
    headers: {
      'X-Current-Cluster': clusterId,
      'Content-Type': 'application/merge-patch+json',
    },
  });
}

// Service API

/**
 * 获取 Service 列表
 */
export function getServices(clusterId: string, namespace: string) {
  return request.get<K8sListResponse<Service>>({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/services`,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 获取单个 Service
 */
export function getService(clusterId: string, namespace: string, name: string) {
  return request.get<Service>({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/services/${name}`,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 更新 Service
 */
export function updateService(clusterId: string, namespace: string, name: string, data: Service) {
  return request.put<Service>({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/services/${name}`,
    data,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 删除 Service
 */
export function deleteService(clusterId: string, namespace: string, name: string) {
  return request.delete({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/services/${name}`,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

// ConfigMap API

/**
 * 获取 ConfigMap 列表
 */
export function getConfigMaps(clusterId: string, namespace: string) {
  return request.get<K8sListResponse<ConfigMap>>({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/configmaps`,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 获取单个 ConfigMap
 */
export function getConfigMap(clusterId: string, namespace: string, name: string) {
  return request.get<ConfigMap>({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/configmaps/${name}`,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 更新 ConfigMap
 */
export function updateConfigMap(clusterId: string, namespace: string, name: string, data: ConfigMap) {
  return request.put<ConfigMap>({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/configmaps/${name}`,
    data,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 删除 ConfigMap
 */
export function deleteConfigMap(clusterId: string, namespace: string, name: string) {
  return request.delete({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/configmaps/${name}`,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

// Secret API

/**
 * 获取 Secret 列表
 */
export function getSecrets(clusterId: string, namespace: string) {
  return request.get<K8sListResponse<Secret>>({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/secrets`,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 获取单个 Secret
 */
export function getSecret(clusterId: string, namespace: string, name: string) {
  return request.get<Secret>({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/secrets/${name}`,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 更新 Secret
 */
export function updateSecret(clusterId: string, namespace: string, name: string, data: Secret) {
  return request.put<Secret>({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/secrets/${name}`,
    data,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 删除 Secret
 */
export function deleteSecret(clusterId: string, namespace: string, name: string) {
  return request.delete({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/secrets/${name}`,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

// Namespace API

/**
 * 获取命名空间列表
 */
export function getNamespaces(clusterId: string) {
  return request.get<K8sListResponse<K8sResource>>({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces`,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

// Pod 相关接口
export interface PodSpec {
  containers: Array<{
    name: string;
    image: string;
    ports?: Array<{
      containerPort: number;
      protocol?: string;
    }>;
    resources?: {
      requests?: Record<string, string>;
      limits?: Record<string, string>;
    };
  }>;
  restartPolicy?: string;
  nodeName?: string;
}

export interface PodStatus {
  phase: string; // Running, Pending, Succeeded, Failed, Unknown
  conditions?: Array<{
    type: string;
    status: string;
    reason?: string;
    message?: string;
  }>;
  containerStatuses?: Array<{
    name: string;
    ready: boolean;
    restartCount: number;
    state?: any;
  }>;
  podIP?: string;
  startTime?: string;
}

export interface Pod extends K8sResource {
  spec: PodSpec;
  status?: PodStatus;
}

// Metrics 相关接口
export interface ContainerMetricsItem {
  name: string;
  cpu_usage: string;
  memory_usage: string;
}

export interface PodMetricsItem {
  name: string;
  namespace: string;
  total_cpu_usage: string;
  total_memory_usage: string;
  containers: ContainerMetricsItem[];
}

export interface PodMetricsResponse {
  items: PodMetricsItem[];
}

// Pod API

/**
 * 获取 Pod 列表
 */
export function getPods(clusterId: string, namespace: string, labelSelector?: string) {
  const params: Record<string, string> = {};
  if (labelSelector) {
    params.labelSelector = labelSelector;
  }

  return request.get<K8sListResponse<Pod>>({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/pods`,
    params,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 获取单个 Pod
 */
export function getPod(clusterId: string, namespace: string, name: string) {
  return request.get<Pod>({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/pods/${name}`,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 删除 Pod
 */
export function deletePod(clusterId: string, namespace: string, name: string) {
  return request.delete({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/pods/${name}`,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

// Metrics API

/**
 * 获取 Pod 监控数据
 */
export function getPodMetrics(clusterId: string, namespace?: string) {
  const params: Record<string, string> = {};
  if (namespace) {
    params.namespace = namespace;
  }

  return request.get<PodMetricsResponse>({
    url: `/clusters/${clusterId}/metrics/pods`,
    params,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 获取 Pod 日志
 */
export function getPodLogs(
  clusterId: string,
  namespace: string,
  podName: string,
  options?: {
    container?: string;
    tailLines?: number;
    follow?: boolean;
  }
) {
  const params: Record<string, string> = {};

  if (options?.container) {
    params.container = options.container;
  }
  if (options?.tailLines) {
    params.tailLines = options.tailLines.toString();
  }
  if (options?.follow) {
    params.follow = 'true';
  }

  return request.get<string>({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/pods/${podName}/log`,
    params,
    headers: {
      'X-Current-Cluster': clusterId,
    },
    requestOptions: {
      isTransformResponse: false,
    },
  });
}
