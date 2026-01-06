
export interface PatchSuggestion {
    description: string;
    patchType: string;
    patchContent: string;
    risk: 'Low' | 'Medium' | 'High';
    reasoning: string;
}

export const generateRemediation = async (resourceKind: string, resourceName: string, errorLog: string): Promise<PatchSuggestion> => {
    const response = await fetch('/api/remediate/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceKind, resourceName, namespace: 'default', errorLog }), // Namespace mocked for now or passed in
    });

    if (!response.ok) {
        throw new Error('Failed to generate remediation');
    }

    return response.json();
};

export const applyRemediation = async (resourceKind: string, resourceName: string, patchType: string, patchContent: string): Promise<void> => {
    const token = localStorage.getItem('mock_token') || 'mock-token'; // Or integration with AuthContext

    const response = await fetch('/api/remediate/apply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ resourceKind, resourceName, namespace: 'default', patchType, patchContent }),
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to apply remediation');
    }
};
