import React from 'react';
import { BranchIndexingIndicator } from './BranchIndexingIndicator';
import CampfireDangle from './CampfireDangle';
import ThemePullCord from './ThemePullCord';
import { ProjectIcon, projectTheme } from './ProjectIcon';
import { useAppearance } from '../contexts/AppearanceContext';
import { DOODLES } from '../assets/doodles';

interface NavigationProps {
    projectName: string;
    loadingMessage?: string | null;
}

const Navigation: React.FC<NavigationProps> = ({projectName, loadingMessage}) => {
    const { appearance } = useAppearance();
    // Subtle Office-style watermark: the project's doodle (same image as the page background) bleeds
    // in from the right of the bar. grayscale + overlay blend makes it adapt to any accent color.
    const doodleUrl = DOODLES[appearance.doodleBg || projectTheme(projectName)];
    return (
        <nav className="relative px-8 h-18 border-b shadow-sm transition-colors duration-200" style={{ backgroundColor: 'var(--chrome-topbar-bg)', borderColor: 'var(--chrome-topbar-border)', color: 'var(--chrome-topbar-fg)' }}>
            {doodleUrl && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-0 w-[420px] z-0"
                    style={{
                        backgroundImage: `url(${doodleUrl})`,
                        backgroundSize: '300px',
                        backgroundRepeat: 'repeat',
                        backgroundPosition: 'right center',
                        filter: 'grayscale(1)',
                        mixBlendMode: 'overlay',
                        opacity: 0.12,
                        WebkitMaskImage: 'linear-gradient(to left, #000 0%, #000 25%, transparent 92%)',
                        maskImage: 'linear-gradient(to left, #000 0%, #000 25%, transparent 92%)',
                    }}
                />
            )}
            <div className="relative z-10 h-full flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    {projectName && (
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0" style={{ backgroundColor: 'var(--chrome-topbar-badge)' }} aria-hidden="true">
                            <ProjectIcon name={projectName} theme={appearance.icon} className="w-6 h-6" />
                        </span>
                    )}
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold leading-tight">{projectName || 'Loading...'}</h1>
                        {appearance.description && (
                            <p className="text-xs italic leading-snug line-clamp-2 max-w-xl" style={{ color: 'var(--chrome-topbar-fg-muted)' }}>{appearance.description}</p>
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
