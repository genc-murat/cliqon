import Dexie, { Table } from 'dexie';
import { SshProfile, Snippet } from '../types/connection';

export interface MlModelRecord {
    profileId: string;
    modelData: string;
    updatedAt: number;
}

export interface SettingRecord {
    key: string;
    value: unknown;
    updatedAt: number;
}

export interface PanelStateRecord {
    key: string;
    value: number;
    updatedAt: number;
}

export interface BackupRecord {
    id: string;
    timestamp: number;
    data: string;
    version: string;
    size: number;
}

export interface ExportData {
    version: string;
    exportDate: string;
    profiles: SshProfile[];
    snippets: Snippet[];
    settings: Record<string, unknown>;
    mlModels: Array<{
        profileId: string;
        modelData: string;
    }>;
}

class CliqonDatabase extends Dexie {
    profiles!: Table<SshProfile, string>;
    snippets!: Table<Snippet, string>;
    mlModels!: Table<MlModelRecord, string>;
    settings!: Table<SettingRecord, string>;
    panelStates!: Table<PanelStateRecord, string>;
    backups!: Table<BackupRecord, string>;

    constructor() {
        super('cliqon-db');
        
        this.version(1).stores({
            profiles: 'id, name, host, category, is_favorite',
            snippets: 'id, folder, name',
            mlModels: 'profileId, updatedAt',
            settings: 'key',
            panelStates: 'key',
            backups: 'id, timestamp, version'
        });
    }
}

export const db = new CliqonDatabase();

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const record = await db.settings.get(key);
    if (record === undefined) return defaultValue;
    return record.value as T;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
    await db.settings.put({
        key,
        value,
        updatedAt: Date.now()
    });
}

export async function removeSetting(key: string): Promise<void> {
    await db.settings.delete(key);
}

export async function getPanelState(key: string, defaultValue: number): Promise<number> {
    const record = await db.panelStates.get(key);
    if (record === undefined) return defaultValue;
    return record.value;
}

export async function setPanelState(key: string, value: number): Promise<void> {
    await db.panelStates.put({
        key,
        value,
        updatedAt: Date.now()
    });
}

export async function getMlModel(profileId: string): Promise<string | null> {
    const record = await db.mlModels.get(profileId);
    return record?.modelData ?? null;
}

export async function saveMlModel(profileId: string, modelData: string): Promise<void> {
    await db.mlModels.put({
        profileId,
        modelData,
        updatedAt: Date.now()
    });
}

export async function deleteMlModel(profileId: string): Promise<void> {
    await db.mlModels.delete(profileId);
}

export async function getAllMlModels(): Promise<MlModelRecord[]> {
    return db.mlModels.toArray();
}

export async function getMultipleSettings(keys: string[]): Promise<Record<string, unknown>> {
    const records = await db.settings.where('key').anyOf(keys).toArray();
    const result: Record<string, unknown> = {};
    for (const record of records) {
        result[record.key] = record.value;
    }
    return result;
}

export async function setMultipleSettings(items: Record<string, unknown>): Promise<void> {
    const now = Date.now();
    const records = Object.entries(items).map(([key, value]) => ({
        key,
        value,
        updatedAt: now
    }));
    await db.settings.bulkPut(records);
}

export async function exportAllData(): Promise<ExportData> {
    const profiles = await db.profiles.toArray();
    const snippets = await db.snippets.toArray();
    const settingsRecords = await db.settings.toArray();
    const mlModels = await db.mlModels.toArray();
    
    const settings: Record<string, unknown> = {};
    for (const record of settingsRecords) {
        settings[record.key] = record.value;
    }
    
    return {
        version: '0.4.0',
        exportDate: new Date().toISOString(),
        profiles: profiles.map(p => ({
            ...p,
            obfuscated_secret: undefined
        })),
        snippets,
        settings,
        mlModels: mlModels.map(m => ({
            profileId: m.profileId,
            modelData: m.modelData
        }))
    };
}

export async function importData(data: ExportData, mergeStrategy: 'replace' | 'merge' = 'merge'): Promise<{ profiles: number; snippets: number; settings: number; mlModels: number }> {
    const now = Date.now();
    
    if (mergeStrategy === 'replace') {
        await db.profiles.clear();
        await db.snippets.clear();
        await db.settings.clear();
        await db.mlModels.clear();
    }
    
    if (data.profiles.length > 0) {
        const profiles = data.profiles.map(p => ({ ...p, obfuscated_secret: undefined }));
        if (mergeStrategy === 'replace') {
            await db.profiles.bulkAdd(profiles);
        } else {
            await db.profiles.bulkPut(profiles);
        }
    }
    
    if (data.snippets.length > 0) {
        if (mergeStrategy === 'replace') {
            await db.snippets.bulkAdd(data.snippets);
        } else {
            await db.snippets.bulkPut(data.snippets);
        }
    }
    
    if (Object.keys(data.settings).length > 0) {
        const settingsRecords = Object.entries(data.settings).map(([key, value]) => ({
            key,
            value,
            updatedAt: now
        }));
        await db.settings.bulkPut(settingsRecords);
    }
    
    if (data.mlModels.length > 0) {
        const mlModelRecords = data.mlModels.map(m => ({
            profileId: m.profileId,
            modelData: m.modelData,
            updatedAt: now
        }));
        await db.mlModels.bulkPut(mlModelRecords);
    }
    
    return {
        profiles: data.profiles.length,
        snippets: data.snippets.length,
        settings: Object.keys(data.settings).length,
        mlModels: data.mlModels.length
    };
}

export async function clearAllData(): Promise<void> {
    await db.profiles.clear();
    await db.snippets.clear();
    await db.settings.clear();
    await db.panelStates.clear();
    await db.mlModels.clear();
    await db.backups.clear();
}

export async function getDatabaseStats(): Promise<{
    profiles: number;
    snippets: number;
    settings: number;
    panelStates: number;
    mlModels: number;
    backups: number;
    estimatedSize: number;
}> {
    const [profiles, snippets, settings, panelStates, mlModels, backups] = await Promise.all([
        db.profiles.count(),
        db.snippets.count(),
        db.settings.count(),
        db.panelStates.count(),
        db.mlModels.count(),
        db.backups.count()
    ]);
    
    const mlModelsData = await db.mlModels.toArray();
    const estimatedSize = mlModelsData.reduce((acc, m) => acc + m.modelData.length, 0);
    
    return {
        profiles,
        snippets,
        settings,
        panelStates,
        mlModels,
        backups,
        estimatedSize
    };
}
