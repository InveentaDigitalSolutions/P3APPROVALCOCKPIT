import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import './Sidebar.css';

interface NavItem {
    to: string;
    label: string;
    icon: React.ReactNode;
}

interface NavCategory {
    heading: string;
    items: NavItem[];
}

const OverviewIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
);

const SpeichertypIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
);

const TimelineIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="4" rx="1" /><rect x="5" y="12" width="14" height="4" rx="1" />
        <rect x="7" y="20" width="10" height="4" rx="1" />
    </svg>
);

const IStufeIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
);

const BellIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
);

const CollapseIcon = ({ collapsed }: { collapsed?: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {collapsed
            ? <polyline points="9 18 15 12 9 6" />
            : <polyline points="15 18 9 12 15 6" />
        }
    </svg>
);

const NAV_CATEGORIES: NavCategory[] = [
    {
        heading: 'Hauptmenü',
        items: [
            { to: '/', label: 'Übersicht', icon: <OverviewIcon /> },
            { to: '/freigabe-timeline', label: 'Freigabe Timeline', icon: <TimelineIcon /> },
            { to: '/freigabe-bulk', label: 'Bulk Freigabe', icon: <TimelineIcon /> },
        ],
    },
    {
        heading: 'Einstellungen',
        items: [
            { to: '/speichertyp', label: 'Speichertyp', icon: <SpeichertypIcon /> },
            { to: '/istufe', label: 'I-Stufe', icon: <IStufeIcon /> },
            { to: '/benachrichtigungen', label: 'Benachrichtigungen', icon: <BellIcon /> },
        ],
    },
];

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
    const navigate = useNavigate();

    return (
        <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
            {/* Brand */}
            <div
                className="sidebar__brand"
                onClick={() => navigate('/')}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && navigate('/')}
            >
                <img
                    className="sidebar__logo"
                    src="https://www.bmw.com/etc.clientlibs/settings/wcm/designs/bmwcom/base/resources/ci2020/img/logo-light.svg"
                    alt="BMW"
                />
                {!collapsed && (
                    <div className="sidebar__brand-text">
                        <span className="sidebar__brand-title">Freigabecockpit</span>
                        <span className="sidebar__brand-sub">COAP · HVS Software</span>
                    </div>
                )}
            </div>

            {/* Navigation with categories */}
            <nav className="sidebar__nav">
                {NAV_CATEGORIES.map(cat => (
                    <div key={cat.heading} className="sidebar__category">
                        {!collapsed && (
                            <span className="sidebar__category-heading">{cat.heading}</span>
                        )}
                        {collapsed && <span className="sidebar__category-divider" />}
                        {cat.items.map(item => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/'}
                                className={({ isActive }) =>
                                    `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
                                }
                                title={collapsed ? item.label : undefined}
                            >
                                <span className="sidebar__link-icon">{item.icon}</span>
                                {!collapsed && <span className="sidebar__link-label">{item.label}</span>}
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            {/* Toggle */}
            <button
                className="sidebar__toggle"
                onClick={onToggle}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={collapsed ? 'Menü erweitern' : 'Menü einklappen'}
            >
                <span className="sidebar__toggle-icon">
                    <CollapseIcon collapsed={collapsed} />
                </span>
            </button>
        </aside>
    );
};
