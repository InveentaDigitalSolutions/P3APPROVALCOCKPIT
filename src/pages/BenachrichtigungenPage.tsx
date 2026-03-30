import React from 'react';
import './BenachrichtigungenPage.css';

export const BenachrichtigungenPage: React.FC = () => {
    return (
        <div className="benachrichtigungen-page">
            <div className="benachrichtigungen-page__header">
                <h1 className="benachrichtigungen-page__title">Benachrichtigungen</h1>
                <p className="benachrichtigungen-page__subtitle">
                    Alerts und Benachrichtigungen für Freigabe-Änderungen
                </p>
            </div>

            <div className="benachrichtigungen-page__empty">
                <div className="benachrichtigungen-page__empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 01-3.46 0" />
                    </svg>
                </div>
                <p className="benachrichtigungen-page__empty-text">
                    Keine neuen Benachrichtigungen
                </p>
                <p className="benachrichtigungen-page__empty-hint">
                    Hier werden Alerts angezeigt, wenn sich Freigabe-Level ändern oder Zieldaten überschritten werden.
                </p>
            </div>
        </div>
    );
};
