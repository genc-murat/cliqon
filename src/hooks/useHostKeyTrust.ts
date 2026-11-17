import { useCallback } from 'react';
import { api } from '../services/api';
import { SshProfile } from '../types/connection';
import { useConfirm } from './useConfirm';

const unknownHostKey = 'SSH_HOST_KEY_UNKNOWN: ';

export function sshErrorMessage(error: unknown): string {
    return (error instanceof Error ? error.message : String(error)).replace(unknownHostKey, '');
}

export function isUnknownHostKey(error: unknown): boolean {
    return (error instanceof Error ? error.message : String(error)).startsWith(unknownHostKey);
}

export function useHostKeyTrust() {
    const confirm = useConfirm();
    return useCallback(async (profile: SshProfile, isCurrent: () => boolean) => {
        const key = await api.inspectSshHostKey(profile);
        if (!isCurrent()) return false;
        if (key.trusted) return true;

        const approved = await confirm({
            title: 'Verify SSH host key',
            message: `${key.endpoint}\n${key.algorithm} ${key.fingerprint}\n\nCompare this fingerprint with a trusted source before continuing.`,
            confirmLabel: 'Trust Host Key',
            isDestructive: false,
        });

        if (!approved || !isCurrent()) return false;
        await api.trustSshHostKey(profile, key.fingerprint);
        return isCurrent();
    }, [confirm]);
}
