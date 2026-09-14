import React from 'react';
import { BranchIndexingIndicator } from './BranchIndexingIndicator';
import CampfireDangle from './CampfireDangle';
import ThemePullCord from './ThemePullCord';
import { ProjectIcon } from './ProjectIcon';
import { useAppearance } from '../contexts/AppearanceContext';

interface NavigationProps {
    projectName: string;
    loadingMessage?: string | null;
}

const Navigation: React.FC<NavigationProps> = ({projectName, loadingMessage}) => {
    const { appearance } = useAppearance();
    return (
        <nav className="relative px-8 h-18 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm transition-colors duration-200">
            <div className="h-full flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    {projectName && (
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 shrink-0" aria-hidden="true">
                            <ProjectIcon name={projectName} theme={appearance.icon} className="w-6 h-6" />
                        </span>
                    )}
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">{projectName || 'Loading...'}</h1>
                        {appearance.description && (
                            <p className="text-xs italic text-gray-500 dark:text-gray-400 leading-snug line-clamp-2 max-w-xl">{appearance.description}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <BranchIndexingIndicator message={loadingMessage} />
                    <CampfireDangle />
                    <ThemePullCord />
                </div>
            </div>
        </nav>
    );
};

export default Navigation;
