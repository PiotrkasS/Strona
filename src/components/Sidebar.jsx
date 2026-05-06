import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/tests',     icon: '▶️',  label: 'Uruchom testy' },
  { to: '/record',    icon: '🎬',  label: 'Nagraj test' },
  { to: '/results',   icon: '📋',  label: 'Historia wyników' },
];

export default function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-label">Nawigacja</div>
        {navItems.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="icon">{icon}</span>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
