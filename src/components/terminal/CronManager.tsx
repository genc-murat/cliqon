import React, { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, X } from 'lucide-react';
import { api } from '../../services/api';
import { useConfirm } from '../../hooks/useConfirm';
import { SshProfile } from '../../types/connection';

interface CronJob {
    id: string;
    schedule: string;
    command: string;
    user: string;
    status: string;
}

interface CronManagerProps {
    profile: SshProfile;
}

const CRON_PRESETS = [
    { label: 'Every minute', value: '* * * * *' },
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every day at midnight', value: '0 0 * * *' },
    { label: 'Every day at 6am', value: '0 6 * * *' },
    { label: 'Every week (Sunday)', value: '0 0 * * 0' },
    { label: 'Every month', value: '0 0 1 * *' },
];

export const CronManager: React.FC<CronManagerProps> = ({ profile }) => {
    const confirm = useConfirm();
    const [jobs, setJobs] = useState<CronJob[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [history, setHistory] = useState<string[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    const [newSchedule, setNewSchedule] = useState('* * * * *');
    const [newCommand, setNewCommand] = useState('');

    useEffect(() => {
        loadJobs();
    }, [profile]);

    const loadJobs = async () => {
        setLoading(true);
        try {
            const result = await api.listCronJobs(profile);
            setJobs(result);
        } catch (err) {
            console.error('Failed to load cron jobs:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddJob = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSchedule.trim() || !newCommand.trim()) return;

        setLoading(true);
        try {
            await api.createCronJob(profile, newSchedule, newCommand);
            setShowAdd(false);
            setNewSchedule('* * * * *');
            setNewCommand('');
            await loadJobs();
        } catch (err) {
            console.error('Failed to create cron job:', err);
            alert('Failed to create cron job: ' + err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteJob = async (job: CronJob) => {
        const isConfirmed = await confirm({
            title: 'Delete Cron Job',
            message: `Are you sure you want to delete this cron job?\n\nSchedule: ${job.schedule}\nCommand: ${job.command}`,
            confirmLabel: 'Delete',
            isDestructive: true
        });

        if (isConfirmed) {
            try {
                await api.deleteCronJob(profile, job.schedule, job.command);
                await loadJobs();
            } catch (err) {
                console.error('Failed to delete cron job:', err);
            }
        }
    };

    const loadHistory = async () => {
        setLoading(true);
        try {
            const result = await api.getCronHistory(profile, 20);
            setHistory(result);
            setShowHistory(true);
        } catch (err) {
            console.error('Failed to load cron history:', err);
            alert('Failed to load cron history: ' + err);
        } finally {
            setLoading(false);
        }
    };

    const parseSchedule = (schedule: string): string => {
        const parts = schedule.split(' ');
        if (parts.length < 5) return schedule;

        const [min, hour, day, month, dow] = parts;

        if (schedule === '* * * * *') return 'Every minute';
        if (schedule === '0 * * * *') return 'Every hour at minute 0';
        if (schedule === '0 0 * * *') return 'Every day at midnight';
        if (schedule === '0 6 * * *') return 'Every day at 6:00 AM';
        if (schedule === '0 0 * * 0') return 'Every Sunday at midnight';
        if (schedule === '0 0 1 * *') return 'First day of every month';

        return `${min} ${hour} ${day} ${month} ${dow}`;
    };

    return (
        <div className="p-4 h-full overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Clock size={18} className="text-[var(--accent-color)]" />
                    <h3 className="font-semibold text-[var(--text-main)]">Cron Jobs</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadHistory}
                        className="px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-color)] rounded"
                    >
                        View History
                    </button>
                    <button
                        onClick={() => setShowAdd(true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent-color)] text-white rounded-md text-sm hover:opacity-90"
                    >
                        <Plus size={14} /> Add Job
                    </button>
                </div>
            </div>

            {/* Jobs List */}
            {loading && jobs.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent-color)]"></div>
                </div>
            ) : jobs.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)]">
                    <Clock size={36} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No cron jobs found</p>
                    <p className="text-xs mt-1">Click "Add Job" to create one</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {jobs.map(job => (
                        <div key={job.id} className="p-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-sm text-[var(--accent-color)]">{job.schedule}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs ${
                                            job.status === 'active' 
                                                ? 'bg-green-900/30 text-green-400' 
                                                : 'bg-gray-700/30 text-gray-400'
                                        }`}>
                                            {job.status}
                                        </span>
                                    </div>
                                    <div className="text-sm text-[var(--text-main)] font-mono truncate">
                                        {job.command}
                                    </div>
                                    <div className="text-xs text-[var(--text-muted)] mt-1">
                                        {parseSchedule(job.schedule)} • User: {job.user}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteJob(job)}
                                    className="p-1.5 hover:bg-[var(--hover-color)] rounded text-red-400 ml-2"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Job Modal */}
            {showAdd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAdd(false)}>
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-5 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-[var(--text-main)] mb-4">Add Cron Job</h3>
                        <form onSubmit={handleAddJob}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Schedule</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={newSchedule}
                                            onChange={(e) => setNewSchedule(e.target.value)}
                                            className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-main)] text-sm"
                                        >
                                            {CRON_PRESETS.map(preset => (
                                                <option key={preset.value} value={preset.value}>
                                                    {preset.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <input
                                        type="text"
                                        value={newSchedule}
                                        onChange={(e) => setNewSchedule(e.target.value)}
                                        className="w-full mt-2 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-main)] font-mono"
                                        placeholder="* * * * *"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Command</label>
                                    <textarea
                                        value={newCommand}
                                        onChange={(e) => setNewCommand(e.target.value)}
                                        className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-main)] font-mono text-sm h-24 resize-none"
                                        placeholder="/path/to/script.sh"
                                        required
                                    />
                                </div>
                                <div className="p-3 bg-[var(--bg-secondary)] rounded text-xs text-[var(--text-muted)]">
                                    <strong>Schedule format:</strong> minute hour day month weekday<br />
                                    <span className="font-mono">* * * * *</span> = every minute<br />
                                    <span className="font-mono">0 0 * * *</span> = daily at midnight
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-5">
                                <button
                                    type="button"
                                    onClick={() => setShowAdd(false)}
                                    className="px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 bg-[var(--accent-color)] text-white rounded hover:opacity-90 disabled:opacity-50"
                                >
                                    {loading ? 'Creating...' : 'Create Job'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {showHistory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowHistory(false)}>
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl p-5 w-full max-w-2xl max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-[var(--text-main)]">Cron History</h3>
                            <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-[var(--hover-color)] rounded">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {history.length === 0 ? (
                                <p className="text-center py-8 text-[var(--text-muted)]">No history available</p>
                            ) : (
                                <pre className="text-xs font-mono text-[var(--text-muted)] whitespace-pre-wrap">
                                    {history.join('\n')}
                                </pre>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
