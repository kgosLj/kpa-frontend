import { request } from '@/utils/request';

const Api = {
    Cluster: '/clusters',
};

export interface Cluster {
    id: string;
    name: string;
    status: string; // Note: swagger says integer, but frontend might expect string/enum? Keeping string for now or check usages.
    version: string; // swagger doesn't show version in ClusterResponse? id, name, provider, region, status, resources...
    nodes_count: number;
}

export function getClusterList() {
    return request.get<Cluster[]>({
        url: Api.Cluster,
    });
}
