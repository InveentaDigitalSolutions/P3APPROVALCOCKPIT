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

const TimelineIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="4" rx="1" /><rect x="5" y="12" width="14" height="4" rx="1" />
        <rect x="7" y="20" width="10" height="4" rx="1" />
    </svg>
);

const DatabaseIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        <path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6" />
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
            { to: '/freigabe-timeline', label: 'Freigabe Timeline', icon: <TimelineIcon /> },
        ],
    },
    {
        heading: 'Daten',
        items: [
            { to: '/dataverse', label: 'Dataverse Admin', icon: <DatabaseIcon /> },
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
                onClick={() => navigate('/freigabe-timeline')}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && navigate('/freigabe-timeline')}
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
