import Dexie, { Table } from 'dexie';
import { SshProfile, Snippet } from '../types/connection';
import { api } from '../services/api';

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
    panelStates?: Record<string, number>;
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
    const [{ profiles, snippets }, settings, panelStates, mlModels] = await Promise.all([
        api.exportBackupRecords(),
        db.settings.toArray(),
        db.panelStates.toArray(),
        db.mlModels.toArray(),
    ]);

    return {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        profiles,
        snippets,
        settings: Object.fromEntries(settings.map(({ key, value }) => [key, value])),
        panelStates: Object.fromEntries(panelStates.map(({ key, value }) => [key, value])),
        mlModels: mlModels.map(({ profileId, modelData }) => ({ profileId, modelData })),
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export async function importData(value: unknown): Promise<void> {
    if (!isRecord(value) || !['0.4.0', '1.0.0'].includes(String(value.version))
        || !Array.isArray(value.profiles) || !Array.isArray(value.snippets)
        || !isRecord(value.settings) || !Array.isArray(value.mlModels)
        || !value.mlModels.every(model => isRecord(model)
            && typeof model.profileId === 'string' && typeof model.modelData === 'string')
        || (value.panelStates !== undefined && (!isRecord(value.panelStates)
            || !Object.values(value.panelStates).every(size => Number.isFinite(size))))) {
        throw new Error('Invalid or unsupported Cliqon backup.');
    }

    const data = value as unknown as ExportData;
    const updatedAt = Date.now();
    await db.transaction('rw', db.settings, db.panelStates, db.mlModels, async () => {
        await db.settings.bulkPut(Object.entries(data.settings).map(([key, value]) => ({ key, value, updatedAt })));
        await db.panelStates.bulkPut(Object.entries(data.panelStates ?? {}).map(([key, value]) => ({ key, value, updatedAt })));
        const profileIds = await Dexie.waitFor(api.restoreBackupRecords({ profiles: data.profiles, snippets: data.snippets }));
        await db.mlModels.bulkPut(data.mlModels.map(({ profileId, modelData }) => ({
            profileId: Object.prototype.hasOwnProperty.call(profileIds, profileId) ? profileIds[profileId] : profileId,
            modelData,
            updatedAt,
        })));
    });
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
    const [{ profiles, snippets }, settings, panelStates, mlModels, backups] = await Promise.all([
        api.exportBackupRecords(),
        db.settings.count(),
        db.panelStates.count(),
        db.mlModels.count(),
        db.backups.count()
    ]);
    
    const mlModelsData = await db.mlModels.toArray();
    const estimatedSize = mlModelsData.reduce((acc, m) => acc + m.modelData.length, 0);
    
    return {
        profiles: profiles.length,
        snippets: snippets.length,
        settings,
        panelStates,
        mlModels,
        backups,
        estimatedSize
    };
}
