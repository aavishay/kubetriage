import { Router } from 'express';
import { K8sService } from '../config/k8s.js';

export const clusterRouter = Router();

clusterRouter.get('/namespaces', async (req, res) => {
    try {
        const k8s = K8sService.getInstance();
        const result = await k8s.coreV1Api.listNamespace();
        const namespaces = result.body.items.map(ns => ({
            name: ns.metadata?.name,
            status: ns.status?.phase,
            creationTimestamp: ns.metadata?.creationTimestamp
        }));
        res.json(namespaces);
    } catch (err: any) {
        console.error('Failed to list namespaces:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch namespaces' });
    }
});
