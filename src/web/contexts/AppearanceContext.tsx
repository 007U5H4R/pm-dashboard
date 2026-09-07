import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiClient, type AppearanceSettings } from '../lib/api';
import { useProject } from './ProjectContext';

interface AppearanceContextValue {
	appearance: AppearanceSettings;
	update: (patch: AppearanceSettings) => Promise<void>;
}

const AppearanceContext = createContext<AppearanceContextValue>({
	appearance: {},
	update: async () => {},
});

/** Loads the active project's appearance selections (icon / doodle bg / Gantt bg) and lets the
 * Settings page update them. Re-fetches whenever the active project changes. */
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
	const { activeProjectId } = useProject();
	const [appearance, setAppearance] = useState<AppearanceSettings>({});

	useEffect(() => {
		let alive = true;
		apiClient
			.fetchAppearance()
			.then((a) => {
				if (alive) setAppearance(a ?? {});
			})
			.catch(() => {
				if (alive) setAppearance({});
			});
		return () => {
			alive = false;
		};
	}, [activeProjectId]);

	const update = useCallback(async (patch: AppearanceSettings) => {
		const next = await apiClient.updateAppearance(patch);
		setAppearance(next ?? {});
	}, []);

	return <AppearanceContext.Provider value={{ appearance, update }}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
	return useContext(AppearanceContext);
}
