import { request } from '@/utils/request';

const Api = {
    Cluster: '/clusters',
};

export interface Cluster {
    cluster_id: string;
    name: string;
    status: string;
    version: string;
    nodes_count: number;
}

export function getClusterList() {
    return request.get<Cluster[]>({
        url: Api.Cluster,
    });
}
