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
  strategy?: {
    type: string;
    rollingUpdate?: {
      maxSurge?: number | string;
      maxUnavailable?: number | string;
    };
  };
  selector: {
    matchLabels: Record<string, string>;
  };
  template: {
    metadata: {
      labels: Record<string, string>;
      annotations?: Record<string, string>;
    };
    spec: {
      containers: Array<{
        name: string;
        image: string;
        imagePullPolicy?: string;
        command?: string[];
        args?: string[];
        workingDir?: string;
        ports?: Array<{
          containerPort: number;
          protocol?: string;
        }>;
        env?: Array<{
          name: string;
          value?: string;
          valueFrom?: any;
        }>;
        envFrom?: Array<{
          configMapRef?: { name: string };
          secretRef?: { name: string };
        }>;
        volumeMounts?: Array<{
          name: string;
          mountPath: string;
          readOnly?: boolean;
          subPath?: string;
        }>;
        resources?: {
          requests?: Record<string, string>;
          limits?: Record<string, string>;
        };
        livenessProbe?: any;
        readinessProbe?: any;
        startupProbe?: any;
        securityContext?: any;
      }>;
      volumes?: Array<{
        name: string;
        configMap?: {
          name: string;
          items?: Array<{ key: string; path: string }>;
        };
        secret?: {
          secretName: string;
        };
        emptyDir?: any;
        hostPath?: any;
        persistentVolumeClaim?: {
          claimName: string;
        };
      }>;
      restartPolicy?: string;
      terminationGracePeriodSeconds?: number;
      dnsPolicy?: string;
      serviceAccountName?: string;
      serviceAccount?: string;
      securityContext?: any;
      schedulerName?: string;
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

// HPA 相关接口
export interface HPA extends K8sResource {
  spec: {
    scaleTargetRef: {
      apiVersion: string;
      kind: string;
      name: string;
    };
    minReplicas?: number;
    maxReplicas: number;
    metrics?: Array<{
      type: string;
      resource?: {
        name: string;
        target: {
          type: string;
          averageUtilization?: number;
          averageValue?: string;
        };
      };
    }>;
  };
  status?: {
    lastScaleTime?: string;
    currentReplicas: number;
    desiredReplicas: number;
    currentMetrics?: any[];
  };
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
 * 创建 Deployment
 */
export function createDeployment(clusterId: string, namespace: string, data: Deployment) {
  return request.post<Deployment>({
    url: `/clusters/${clusterId}/proxy/apis/apps/v1/namespaces/${namespace}/deployments`,
    data,
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
 * 创建 Service
 */
export function createService(clusterId: string, namespace: string, data: Service) {
  return request.post<Service>({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/services`,
    data,
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
 * 创建 ConfigMap
 */
export function createConfigMap(clusterId: string, namespace: string, data: ConfigMap) {
  return request.post<ConfigMap>({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/configmaps`,
    data,
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
 * 创建 Secret
 */
export function createSecret(clusterId: string, namespace: string, data: Secret) {
  return request.post<Secret>({
    url: `/clusters/${clusterId}/proxy/api/v1/namespaces/${namespace}/secrets`,
    data,
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

// Resource Diff API

/**
 * 资源对比请求
 */
export interface ResourceDiffRequest {
  namespace: string;
  kind: string;
  name: string;
  new_yaml: string;
}

/**
 * 变更项
 */
export interface ResourceChange {
  type: string; // add, remove, modify
  path: string;
  old_value?: string;
  new_value?: string;
}

/**
 * 资源对比响应
 */
export interface ResourceDiffResponse {
  exists: boolean;
  old_yaml: string;
  new_yaml: string;
  diff_text: string;
  changes: ResourceChange[];
}

/**
 * 对比资源差异
 */
export function diffResource(
  clusterId: string,
  diffRequest: ResourceDiffRequest
) {
  return request.post<ResourceDiffResponse>({
    url: `/clusters/${clusterId}/resources/diff`,
    data: diffRequest,
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

// HPA API

/**
 * 获取 HPA 列表
 */
export function getHPAs(clusterId: string, namespace: string) {
  return request.get<K8sListResponse<HPA>>({
    url: `/clusters/${clusterId}/proxy/apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers`,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 获取单个 HPA
 */
export function getHPA(clusterId: string, namespace: string, name: string) {
  return request.get<HPA>({
    url: `/clusters/${clusterId}/proxy/apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers/${name}`,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 创建 HPA
 */
export function createHPA(clusterId: string, namespace: string, data: HPA) {
  return request.post<HPA>({
    url: `/clusters/${clusterId}/proxy/apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers`,
    data,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 更新 HPA
 */
export function updateHPA(clusterId: string, namespace: string, name: string, data: HPA) {
  return request.put<HPA>({
    url: `/clusters/${clusterId}/proxy/apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers/${name}`,
    data,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 删除 HPA
 */
export function deleteHPA(clusterId: string, namespace: string, name: string) {
  return request.delete({
    url: `/clusters/${clusterId}/proxy/apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers/${name}`,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}
/**
 * 快速扩缩容 (同时调整 Deployment 和 HPA)
 */
export function quickScaleWorkload(
  clusterId: string,
  data: {
    namespace: string;
    kind: string;
    name: string;
    replicas: number;
  },
) {
  return request.patch({
    url: `/clusters/${clusterId}/workloads/quick-scale`,
    data,
    headers: {
      'X-Current-Cluster': clusterId,
    },
  });
}

/**
 * 部分更新 HPA (例如调整最小/最大副本数)
 */
export function patchHPA(
  clusterId: string,
  namespace: string,
  name: string,
  spec: Partial<HPA['spec']>
) {
  return request.patch<HPA>({
    url: `/clusters/${clusterId}/proxy/apis/autoscaling/v2/namespaces/${namespace}/horizontalpodautoscalers/${name}`,
    data: { spec },
    headers: {
      'X-Current-Cluster': clusterId,
      'Content-Type': 'application/merge-patch+json',
    },
  });
}
