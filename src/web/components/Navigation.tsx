import React from 'react';
import { BranchIndexingIndicator } from './BranchIndexingIndicator';
import ThemeToggle from './ThemeToggle';
import { ProjectIcon } from './ProjectIcon';

interface NavigationProps {
    projectName: string;
    loadingMessage?: string | null;
}

const Navigation: React.FC<NavigationProps> = ({projectName, loadingMessage}) => {
    return (
        <nav className="relative px-8 h-18 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm transition-colors duration-200">
            <div className="h-full flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    {projectName && (
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 shrink-0" aria-hidden="true">
                            <ProjectIcon name={projectName} className="w-6 h-6" />
                        </span>
                    )}
                    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{projectName || 'Loading...'}</h1>
                </div>
                <div className="flex items-center gap-3">
                    <BranchIndexingIndicator message={loadingMessage} />
                    <ThemeToggle />
                </div>
            </div>
        </nav>
    );
};

export default Navigation;
