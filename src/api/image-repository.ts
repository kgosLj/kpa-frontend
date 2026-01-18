import { request } from '@/utils/request';
import type { CreateRepositoryForm, UpdateRepositoryForm, ImageRepository, Image } from '@/types/repository';

const API_BASE = '/image-repositories';

/**
 * 创建镜像仓库
 */
export function createRepository(data: CreateRepositoryForm) {
  return request.post<ImageRepository>({
    url: API_BASE,
    data,
  });
}

/**
 * 更新镜像仓库
 */
export function updateRepository(id: string, data: UpdateRepositoryForm) {
  return request.put<ImageRepository>({
    url: `${API_BASE}/${id}`,
    data,
  });
}

/**
 * 删除镜像仓库
 */
export function deleteRepository(id: string) {
  return request.delete({
    url: `${API_BASE}/${id}`,
  });
}

/**
 * 获取镜像仓库列表
 */
export function getRepositoryList(projectId?: string) {
  return request.get<ImageRepository[]>({
    url: API_BASE,
    params: projectId ? { project_id: projectId } : undefined,
  });
}

/**
 * 获取镜像仓库详情
 */
export function getRepository(id: string) {
  return request.get<ImageRepository>({
    url: `${API_BASE}/${id}`,
  });
}

/**
 * 获取镜像列表
 */
export function fetchImages(id: string, namespace?: string) {
  return request.get<Image[]>({
    url: `${API_BASE}/${id}/images`,
    params: namespace ? { namespace } : undefined,
  });
}

/**
 * 测试镜像仓库连接
 */
export function testConnection(id: string) {
  return request.post({
    url: `${API_BASE}/${id}/test`,
  });
}
