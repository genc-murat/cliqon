import React, { createContext, useContext, useState, useCallback } from 'react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

interface ConfirmOptions {
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [pending, setPending] = useState<Array<{ options: ConfirmOptions; resolve: (value: boolean) => void }>>([]);
    const request = pending[0];

    const confirm = useCallback((confirmOptions: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            setPending(current => [...current, { options: confirmOptions, resolve }]);
        });
    }, []);

    function resolveRequest(value: boolean) {
        if (!request) return;
        request.resolve(value);
        setPending(current => current.filter(item => item !== request));
    }

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            <ConfirmDialog
                isOpen={!!request}
                title={request?.options.title || 'Are you sure?'}
                message={request?.options.message || 'This action cannot be undone.'}
                confirmLabel={request?.options.confirmLabel}
                cancelLabel={request?.options.cancelLabel}
                isDestructive={request?.options.isDestructive}
                onConfirm={() => resolveRequest(true)}
                onCancel={() => resolveRequest(false)}
            />
        </ConfirmContext.Provider>
    );
};

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context.confirm;
};
