import { useEffect } from 'react';
import { decayMemories, pruneMemories } from '../services/memoryManager';
import { getMemorySettings } from '../services/storage';

/**
 * Hook to handle background memory maintenance tasks
 * - Decays memory importance over time
 * - Prunes low-importance memories
 */
export function useMemoryMaintenance() {
    useEffect(() => {
        const runMaintenance = async () => {
            const settings = getMemorySettings();
            if (!settings.enabled || !settings.forgettingEnabled) return;

            // 1. Apply decay
            // We run this first to update scores before pruning
            decayMemories();

            // 2. Prune
            // Clean up memories that have fallen below threshold
            pruneMemories();
        };

        // Run on mount (app start)
        // In a real long-running app, you might want to use setInterval here too
        // e.g., run once every 24 hours
        runMaintenance();

        // Optional: Set up a daily interval if the app is left open
        const intervalId = setInterval(runMaintenance, 24 * 60 * 60 * 1000);

        return () => clearInterval(intervalId);
    }, []);
}
