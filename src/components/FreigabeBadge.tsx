import React from 'react';
import type { FreigabeLevel } from '../types';
import './FreigabeBadge.css';

interface Props {
    level: FreigabeLevel;
    size?: 'sm' | 'md' | 'lg';
    showEmpty?: boolean;
    /** Override the default title tooltip */
    tooltip?: string;
    /** 'colored' = normal category colors, 'neutral' = all white/neutral (for system status column) */
    variant?: 'colored' | 'neutral';
}

const LEVEL_CONFIG: Record<FreigabeLevel, { label: string; className: string }> = {
    'N/A': { label: 'N/A', className: 'badge--nicht-gesetzt' },
    'Nicht gesetzt': { label: 'N/G', className: 'badge--nicht-gesetzt' },
    'RTSB geplant': { label: 'RTSB', className: 'badge--geplant' },
    'RTSB freigegeben': { label: 'RTSB ✓', className: 'badge--freigegeben' },
    'X': { label: 'X', className: 'badge--x' },
    'L1 Erstfreigabe geplant': { label: 'L1 ☆', className: 'badge--erstfreigabe' },
    'L1 Erstfreigabe': { label: 'L1 ★', className: 'badge--erstfreigabe' },
    'L1 geplant': { label: 'L1', className: 'badge--geplant' },
    'L1 freigegeben': { label: 'L1 ✓', className: 'badge--freigegeben' },
    'L2 Erstfreigabe geplant': { label: 'L2 ☆', className: 'badge--erstfreigabe' },
    'L2 Erstfreigabe': { label: 'L2 ★', className: 'badge--erstfreigabe' },
    'L2 geplant': { label: 'L2', className: 'badge--geplant' },
    'L2 freigegeben': { label: 'L2 ✓', className: 'badge--freigegeben' },
    'L3 Erstfreigabe geplant': { label: 'L3 ☆', className: 'badge--erstfreigabe' },
    'L3 Erstfreigabe': { label: 'L3 ★', className: 'badge--erstfreigabe' },
    'L3 geplant': { label: 'L3', className: 'badge--geplant' },
    'L3 freigegeben': { label: 'L3 ✓', className: 'badge--freigegeben' },
    'L4 Erstfreigabe geplant': { label: 'L4 ☆', className: 'badge--erstfreigabe' },
    'L4 Erstfreigabe': { label: 'L4 ★', className: 'badge--erstfreigabe' },
    'L4 geplant': { label: 'L4', className: 'badge--geplant' },
    'L4 freigegeben': { label: 'L4 ✓', className: 'badge--freigegeben' },
    '': { label: '—', className: 'badge--empty' },
};

export const FreigabeBadge: React.FC<Props> = ({ level, size = 'md', showEmpty = true, tooltip, variant = 'colored' }) => {
    if (!showEmpty && (level === '' || level === 'Nicht gesetzt' || level === 'N/A')) return null;

    const config = LEVEL_CONFIG[level] ?? LEVEL_CONFIG[''];
    const cls = variant === 'neutral' ? 'badge--neutral' : config.className;

    return (
        <span
            className={`freigabe-badge freigabe-badge--${size} ${cls}`}
            title={tooltip ?? (level || 'Nicht gesetzt')}
        >
            {config.label}
        </span>
    );
};
