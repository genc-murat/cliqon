import { db, setSetting, setPanelState, saveMlModel } from './db';

const MIGRATION_KEY = 'cliqon-migration-version';
const CURRENT_MIGRATION_VERSION = 1;

const SETTINGS_KEYS = [
    'cliqon-theme',
    'cliqon-terminal-theme',
    'cliqon-terminal-font',
    'cliqon-terminal-cursor',
    'cliqon-auto-open-monitor',
    'cliqon-session-timeout',
];

const PANEL_STATE_KEYS = [
    'cliqon-docker-height',
    'cliqon-sidebar-width',
    'cliqon-sftp-width',
    'cliqon-snippet-width',
    'cliqon-monitor-height',
];

const ML_MODEL_PREFIX = 'cliqon-ml-model-';

export interface MigrationResult {
    migrated: boolean;
    version: number;
    settings: number;
    panelStates: number;
    mlModels: number;
    errors: string[];
}

function parseJsonValue(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

async function getMigrationVersion(): Promise<number> {
    try {
        const record = await db.settings.get(MIGRATION_KEY);
        if (record && typeof record.value === 'number') {
            return record.value;
        }
    } catch {
        // Ignore errors
    }
    return 0;
}

async function setMigrationVersion(version: number): Promise<void> {
    await setSetting(MIGRATION_KEY, version);
}

async function needsMigration(): Promise<boolean> {
    const version = await getMigrationVersion();
    if (version >= CURRENT_MIGRATION_VERSION) {
        return false;
    }
    
    for (const key of SETTINGS_KEYS) {
        if (localStorage.getItem(key) !== null) {
            return true;
        }
    }
    
    for (const key of PANEL_STATE_KEYS) {
        if (localStorage.getItem(key) !== null) {
            return true;
        }
    }
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(ML_MODEL_PREFIX)) {
            return true;
        }
    }
    
    return false;
}

async function migrateSettings(): Promise<{ count: number; errors: string[] }> {
    let count = 0;
    const errors: string[] = [];
    
    for (const key of SETTINGS_KEYS) {
        const value = localStorage.getItem(key);
        if (value !== null) {
            try {
                const parsed = parseJsonValue(value);
                await setSetting(key, parsed);
                count++;
            } catch (err) {
                errors.push(`Failed to migrate ${key}: ${err}`);
            }
        }
    }
    
    return { count, errors };
}

async function migratePanelStates(): Promise<{ count: number; errors: string[] }> {
    let count = 0;
    const errors: string[] = [];
    
    for (const key of PANEL_STATE_KEYS) {
        const value = localStorage.getItem(key);
        if (value !== null) {
            try {
                const parsed = parseInt(value, 10);
                if (!isNaN(parsed)) {
                    await setPanelState(key, parsed);
                    count++;
                }
            } catch (err) {
                errors.push(`Failed to migrate ${key}: ${err}`);
            }
        }
    }
    
    return { count, errors };
}

async function migrateMlModels(): Promise<{ count: number; errors: string[] }> {
    let count = 0;
    const errors: string[] = [];
    
    const keysToMigrate: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(ML_MODEL_PREFIX)) {
            keysToMigrate.push(key);
        }
    }
    
    for (const key of keysToMigrate) {
        const profileId = key.substring(ML_MODEL_PREFIX.length);
        const value = localStorage.getItem(key);
        
        if (value !== null && profileId) {
            try {
                await saveMlModel(profileId, value);
                count++;
            } catch (err) {
                errors.push(`Failed to migrate ML model for ${profileId}: ${err}`);
            }
        }
    }
    
    return { count, errors };
}

function clearMigratedKeys(): void {
    for (const key of SETTINGS_KEYS) {
        localStorage.removeItem(key);
    }
    
    for (const key of PANEL_STATE_KEYS) {
        localStorage.removeItem(key);
    }
    
    const mlKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(ML_MODEL_PREFIX)) {
            mlKeys.push(key);
        }
    }
    for (const key of mlKeys) {
        localStorage.removeItem(key);
    }
}

export async function runMigration(): Promise<MigrationResult> {
    const result: MigrationResult = {
        migrated: false,
        version: CURRENT_MIGRATION_VERSION,
        settings: 0,
        panelStates: 0,
        mlModels: 0,
        errors: [],
    };
    
    const shouldMigrate = await needsMigration();
    if (!shouldMigrate) {
        await setMigrationVersion(CURRENT_MIGRATION_VERSION);
        return result;
    }
    
    try {
        const settingsResult = await migrateSettings();
        result.settings = settingsResult.count;
        result.errors.push(...settingsResult.errors);
        
        const panelResult = await migratePanelStates();
        result.panelStates = panelResult.count;
        result.errors.push(...panelResult.errors);
        
        const mlResult = await migrateMlModels();
        result.mlModels = mlResult.count;
        result.errors.push(...mlResult.errors);
        
        await setMigrationVersion(CURRENT_MIGRATION_VERSION);
        
        clearMigratedKeys();
        
        result.migrated = true;
    } catch (err) {
        result.errors.push(`Migration failed: ${err}`);
    }
    
    return result;
}

export async function checkAndMigrate(): Promise<MigrationResult> {
    const version = await getMigrationVersion();
    
    if (version >= CURRENT_MIGRATION_VERSION) {
        return {
            migrated: false,
            version,
            settings: 0,
            panelStates: 0,
            mlModels: 0,
            errors: [],
        };
    }
    
    return runMigration();
}

export { needsMigration, getMigrationVersion };
