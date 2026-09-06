import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { readStoredProjectId, setActiveProjectId, storeProjectId } from '../lib/api';

export interface ProjectSummary {
  id: string;
  name: string;
  path: string;
}

export interface ProjectContextValue {
  projects: ProjectSummary[];
  defaultProjectId: string | null;
  projectId: string | null;
  activeProjectId: string | null;
  setProjectId: (id: string) => void;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

interface ProjectsResponse {
  projects: ProjectSummary[];
  defaultProjectId: string;
}

const PROJECT_STORAGE_KEY = 'pm.activeProjectId';

/** Wipe a stale/legacy stored selection so it can't cause the same 404 on the next load. */
function clearStoredProjectId(): void {
  try {
    localStorage.removeItem(PROJECT_STORAGE_KEY);
  } catch {
    // storage unavailable – nothing to clear
  }
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  // Synchronous first paint: whatever was stored last time is applied before any data fetch runs.
  const [projectId, setProjectIdState] = useState<string | null>(() => {
    const stored = readStoredProjectId();
    setActiveProjectId(stored);
    return stored;
  });
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [defaultProjectId, setDefaultProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const response = await fetch('/api/projects');
        if (!response.ok) throw new Error(`GET /api/projects → ${response.status}`);
        const body = (await response.json()) as ProjectsResponse;
        if (cancelled) return;
        setProjects(body.projects);
        setDefaultProjectId(body.defaultProjectId);
        setError(null);
        const known = new Set(body.projects.map(p => p.id));
        setProjectIdState(current => {
          const resolved = current !== null && known.has(current) ? current : body.defaultProjectId;
          // A stale id (project removed from the registry) or a first run with none stored both
          // land here with resolved !== current: reconcile storage too, so the next load doesn't
          // repeat the same 404 against a project that no longer exists.
          if (resolved !== current) {
            setActiveProjectId(resolved);
            storeProjectId(resolved);
          }
          return resolved;
        });
      } catch (err) {
        if (cancelled) return;
        // Legacy single-project server (or outage): keep /api unprefixed so the app still works,
        // and clear any stored id so a stale one doesn't keep 404ing on every future load.
        setProjects([]);
        setDefaultProjectId(null);
        setError(err instanceof Error ? err : new Error(String(err)));
        setActiveProjectId(null);
        setProjectIdState(null);
        clearStoredProjectId();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [generation]);

  const setProjectId = useCallback((id: string) => {
    setActiveProjectId(id);
    storeProjectId(id);
    setProjectIdState(id);
  }, []);

  const reload = useCallback(() => setGeneration(g => g + 1), []);

  const value = useMemo<ProjectContextValue>(
    () => ({
      projects,
      defaultProjectId,
      projectId,
      activeProjectId: projectId ?? defaultProjectId,
      setProjectId,
      loading,
      error,
      reload,
    }),
    [projects, defaultProjectId, projectId, setProjectId, loading, error, reload],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
  const value = useContext(ProjectContext);
  if (!value) throw new Error('useProject must be used within a ProjectProvider');
  return value;
}
