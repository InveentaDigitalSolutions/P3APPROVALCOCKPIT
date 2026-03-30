import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import './NavBar.css';

interface NavItem {
    to: string;
    label: string;
    icon: React.ReactNode;
}

const OverviewIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
);

const FreigabeIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
);

const StammdatenIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
);

const IStufeIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
);

const NAV_ITEMS: NavItem[] = [
    { to: '/', label: 'Übersicht', icon: <OverviewIcon /> },
    { to: '/freigabe', label: 'Freigabe', icon: <FreigabeIcon /> },
    { to: '/stammdaten', label: 'Stammdaten', icon: <StammdatenIcon /> },
    { to: '/istufe', label: 'I-Stufe', icon: <IStufeIcon /> },
];

export const NavBar: React.FC = () => {
    const navigate = useNavigate();

    return (
        <nav className="navbar">
            <div className="navbar__brand" onClick={() => navigate('/')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && navigate('/')}>
                {/* BMW Logo */}
                <img
                    className="navbar__logo"
                    src="https://www.bmw.com/etc.clientlibs/settings/wcm/designs/bmwcom/base/resources/ci2020/img/logo-light.svg"
                    alt="BMW"
                />
                <div className="navbar__brand-text">
                    <span className="navbar__brand-title">Freigabecockpit</span>
                    <span className="navbar__brand-sub">COAP · HVS Software</span>
                </div>
            </div>

            <ul className="navbar__nav">
                {NAV_ITEMS.map(item => (
                    <li key={item.to}>
                        <NavLink
                            to={item.to}
                            end={item.to === '/'}
                            className={({ isActive }) =>
                                `navbar__link${isActive ? ' navbar__link--active' : ''}`
                            }
                        >
                            <span className="navbar__link-icon">{item.icon}</span>
                            <span className="navbar__link-label">{item.label}</span>
                        </NavLink>
                    </li>
                ))}
            </ul>
        </nav>
    );
};
