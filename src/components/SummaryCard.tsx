import React from 'react';
import './SummaryCard.css';

interface Props {
    title: string;
    value: string | number;
    subtitle?: string;
    variant?: 'default' | 'blue' | 'success' | 'warning';
    icon?: React.ReactNode;
}

export const SummaryCard: React.FC<Props> = ({
    title,
    value,
    subtitle,
    variant = 'default',
    icon,
}) => (
    <div className={`summary-card summary-card--${variant}`}>
        <div className="summary-card__header">
            <span className="summary-card__title">{title}</span>
            {icon && <span className="summary-card__icon">{icon}</span>}
        </div>
        <div className="summary-card__value">{value}</div>
        {subtitle && <div className="summary-card__subtitle">{subtitle}</div>}
    </div>
);
