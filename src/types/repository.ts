// 镜像仓库类型定义

export type RepositoryType = 'tencent' | 'harbor';

export interface ImageRepository {
  id: string;
  name: string;
  type: RepositoryType;
  endpoint: string; // Harbor: API地址 (https://harbor.example.com); TCR: 镜像拉取地址 (ccr.ccs.tencentyun.com)
  region?: string;
  registry_id?: string; // TCR 实例 ID (tcr-abc123)
  project_id: string;
  creator_id: string;
  status: number;
  created_at: string;
  updated_at: string;
}

export interface CreateRepositoryForm {
  name: string;
  type: RepositoryType;
  endpoint: string; // Harbor: API地址; TCR: 镜像拉取地址
  username: string;
  password: string;
  secret_key?: string; // 腾讯云 SecretKey
  region?: string; // 腾讯云区域
  registry_id?: string; // TCR 实例 ID
  project_id: string;
}

export interface UpdateRepositoryForm {
  name?: string;
  endpoint?: string;
  username?: string;
  password?: string;
  secret_key?: string;
  region?: string;
  status?: number;
}

export interface Image {
  name: string;
  tag: string;
  digest: string;
  size: number;
  pushed_at: string;
  repository: string;
  full_path: string;
}

export interface FetchImagesRequest {
  namespace?: string;
}
