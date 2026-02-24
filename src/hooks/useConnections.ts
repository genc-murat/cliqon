import { useConnectionsContext } from '../contexts/ConnectionsContext';

export function useConnections() {
    return useConnectionsContext();
}
