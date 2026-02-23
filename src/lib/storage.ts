import { setSetting, removeSetting, setPanelState, getMlModel, saveMlModel, deleteMlModel, db } from './db';

type ChangeListener = (value: unknown) => void;

const memoryCache: Map<string, unknown> = new Map();
const changeListeners: Map<string, Set<ChangeListener>> = new Map();
let initialized = false;
let initPromise: Promise<void> | null = null;

const SETTING_KEYS = [
    'cliqon-theme',
    'cliqon-terminal-theme',
    'cliqon-terminal-font',
    'cliqon-terminal-cursor',
    'cliqon-terminal-scrollback',
    'cliqon-terminal-scrollback-mode',
    'cliqon-terminal-throttle-ms',
    'cliqon-terminal-renderer',
    'cliqon-terminal-show-fps',
    'cliqon-auto-open-monitor',
    'cliqon-session-timeout',
    'cliqon-pool-idle-minutes',
    'cliqon-pool-keepalive-seconds',
];

const PANEL_STATE_KEYS = [
    'cliqon-docker-height',
    'cliqon-sidebar-width',
    'cliqon-sftp-width',
    'cliqon-snippet-width',
    'cliqon-monitor-height',
];

export async function initializeStorage(): Promise<void> {
    if (initialized) return;
    if (initPromise) return initPromise;
    
    initPromise = (async () => {
        const settings = await db.settings.where('key').anyOf(SETTING_KEYS).toArray();
        for (const record of settings) {
            memoryCache.set(record.key, record.value);
        }
        
        const panelStates = await db.panelStates.where('key').anyOf(PANEL_STATE_KEYS).toArray();
        for (const record of panelStates) {
            memoryCache.set(record.key, record.value);
        }
        
        initialized = true;
    })();
    
    return initPromise;
}

export function isStorageInitialized(): boolean {
    return initialized;
}

export function getCached<T>(key: string, defaultValue: T): T {
    const cached = memoryCache.get(key);
    return cached !== undefined ? (cached as T) : defaultValue;
}

export function getSync<T>(key: string, defaultValue: T): T {
    return getCached(key, defaultValue);
}

export async function get<T>(key: string, defaultValue: T): Promise<T> {
    await initializeStorage();
    return getCached(key, defaultValue);
}

export async function set<T>(key: string, value: T): Promise<void> {
    memoryCache.set(key, value);
    
    if (SETTING_KEYS.includes(key)) {
        await setSetting(key, value);
    } else if (PANEL_STATE_KEYS.includes(key)) {
        await setPanelState(key, value as number);
    } else {
        await setSetting(key, value);
    }
    
    notifyListeners(key, value);
}

export async function remove(key: string): Promise<void> {
    memoryCache.delete(key);
    await removeSetting(key);
    notifyListeners(key, undefined);
}

export function setSync<T>(key: string, value: T): void {
    memoryCache.set(key, value);
    set(key, value).catch(err => {
        console.error(`Failed to persist setting ${key}:`, err);
    });
    notifyListeners(key, value);
}

export async function getMultiple(keys: string[]): Promise<Record<string, unknown>> {
    await initializeStorage();
    const result: Record<string, unknown> = {};
    for (const key of keys) {
        const cached = memoryCache.get(key);
        if (cached !== undefined) {
            result[key] = cached;
        }
    }
    return result;
}

export async function setMultiple(items: Record<string, unknown>): Promise<void> {
    await initializeStorage();
    
    const now = Date.now();
    const settingRecords: Array<{ key: string; value: unknown; updatedAt: number }> = [];
    const panelRecords: Array<{ key: string; value: number; updatedAt: number }> = [];
    
    for (const [key, value] of Object.entries(items)) {
        memoryCache.set(key, value);
        notifyListeners(key, value);
        
        if (PANEL_STATE_KEYS.includes(key) && typeof value === 'number') {
            panelRecords.push({ key, value, updatedAt: now });
        } else {
            settingRecords.push({ key, value, updatedAt: now });
        }
    }
    
    if (settingRecords.length > 0) {
        await db.settings.bulkPut(settingRecords);
    }
    if (panelRecords.length > 0) {
        await db.panelStates.bulkPut(panelRecords);
    }
}

export async function getMlModelData(profileId: string): Promise<string | null> {
    return getMlModel(profileId);
}

export async function saveMlModelData(profileId: string, modelData: string): Promise<void> {
    await saveMlModel(profileId, modelData);
}

export async function deleteMlModelData(profileId: string): Promise<void> {
    await deleteMlModel(profileId);
}

export function subscribe(key: string, listener: ChangeListener): () => void {
    if (!changeListeners.has(key)) {
        changeListeners.set(key, new Set());
    }
    changeListeners.get(key)!.add(listener);
    
    return () => {
        changeListeners.get(key)?.delete(listener);
        if (changeListeners.get(key)?.size === 0) {
            changeListeners.delete(key);
        }
    };
}

function notifyListeners(key: string, value: unknown): void {
    const listeners = changeListeners.get(key);
    if (listeners) {
        for (const listener of listeners) {
            try {
                listener(value);
            } catch (err) {
                console.error(`Error in storage listener for ${key}:`, err);
            }
        }
    }
}

export function clearCache(): void {
    memoryCache.clear();
    initialized = false;
    initPromise = null;
}

export const storage = {
    get,
    set,
    remove,
    getSync,
    setSync,
    getMultiple,
    setMultiple,
    getCached,
    subscribe,
    initialize: initializeStorage,
    isInitialized: isStorageInitialized,
    clearCache,
    
    getMlModel: getMlModelData,
    saveMlModel: saveMlModelData,
    deleteMlModel: deleteMlModelData,
    
    SETTING_KEYS,
    PANEL_STATE_KEYS,
};

export default storage;
