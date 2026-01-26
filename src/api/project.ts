import { request } from '@/utils/request';

export interface Project {
  id: string;  // UUID format
  name: string;
  description: string;
  creator_id: string;
  status: number;
  create_time: string;
  update_time: string;
}

export interface ProjectNamespace {
  id: number;
  project_id: string;
  cluster_id: string;
  namespace: string;
  environment: string;  // dev, staging, prod
  create_time: string;
}

export interface ProjectMember {
  id: number;
  project_id: string;
  user_id: string;
  username: string;  // 直接返回用户名
  role_id: number;
  role_name: string;  // 直接返回角色名
  created_at: string;
  updated_at: string;
}


// Project CRUD
export function createProject(data: { name: string; description: string }) {
  return request.post<Project>({ url: '/projects', data });
}

export function getProjectList() {
  return request.get<Project[]>({ url: '/projects' });
}

export function getProject(id: string) {
  return request.get<Project>({ url: `/projects/${id}` });
}

export function updateProject(id: string, data: { name: string; description: string; status: number }) {
  return request.put<Project>({ url: `/projects/${id}`, data });
}

export function deleteProject(id: string) {
  return request.delete<{ status: string }>({ url: `/projects/${id}` });
}

// Project Namespace Binding
export function bindProjectNamespace(id: string, data: { cluster_id: string; namespace: string; environment?: string }) {
  return request.post<{ status: string }>({ url: `/projects/${id}/namespaces`, data });
}

export function getProjectNamespaces(id: string) {
  return request.get<ProjectNamespace[]>({ url: `/projects/${id}/namespaces` });
}

export function unbindProjectNamespace(id: string, data: { cluster_id: string; namespace: string }) {
  return request.delete<{ status: string }>({ url: `/projects/${id}/namespaces`, data });
}

// Project Member Management
export function addProjectMember(id: string, data: { user_id: string; role_id: number }) {
  return request.post<{ status: string }>({ url: `/projects/${id}/members`, data });
}

export function getProjectMembers(id: string) {
  return request.get<ProjectMember[]>({ url: `/projects/${id}/members` });
}

export function removeProjectMember(id: string, userId: string) {
  return request.delete<{ status: string }>({ url: `/projects/${id}/members/${userId}` });
}

