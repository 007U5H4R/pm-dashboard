import React from 'react';
import { BranchIndexingIndicator } from './BranchIndexingIndicator';
import ThemeToggle from './ThemeToggle';

interface NavigationProps {
    projectName: string;
    loadingMessage?: string | null;
}

const Navigation: React.FC<NavigationProps> = ({projectName, loadingMessage}) => {
    return (
        <nav className="relative px-8 h-18 border-b border-white/30 dark:border-white/10 border-t border-t-white/40 dark:border-t-white/10 bg-white/60 dark:bg-gray-900/45 backdrop-blur-lg shadow-sm shadow-black/5 dark:shadow-black/20 transition-colors duration-200">
            <div className="h-full flex items-center justify-between">
                <div className="flex items-center gap-2">
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
