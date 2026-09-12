import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FiGrid, FiBox, FiClipboard, FiShoppingCart, FiClock, FiUsers, FiTruck,
  FiFileText, FiLogOut, FiSearch, FiBell, FiChevronRight,
} from 'react-icons/fi';
import './Layout.css';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: FiGrid, end: true },
  { to: '/products', label: 'Products', icon: FiBox },
  { to: '/inventory', label: 'Inventory', icon: FiClipboard },
  { to: '/pos', label: 'POS / New Sale', icon: FiShoppingCart },
  { to: '/sales', label: 'Sales History', icon: FiClock },
  { to: '/customers', label: 'Customers', icon: FiUsers },
  { to: '/suppliers', label: 'Suppliers', icon: FiTruck, adminOnly: true },
  { to: '/reports', label: 'Reports', icon: FiFileText, adminOnly: true },
];

const PATH_LABELS = {
  '/': 'Dashboard',
  '/products': 'Products',
  '/categories': 'Categories',
  '/inventory': 'Inventory',
  '/pos': 'POS / New Sale',
  '/sales': 'Sales History',
  '/customers': 'Customers',
  '/suppliers': 'Suppliers',
  '/purchases': 'Purchases',
  '/reports': 'Reports',
  '/activity-log': 'Activity Log',
  '/notifications': 'Notifications',
};

function getBreadcrumb(pathname) {
  if (pathname === '/') return ['Dashboard'];
  return ['Dashboard', PATH_LABELS[pathname] || pathname];
}

/**
 * App-wide layout: sidebar + topbar wrapping every authenticated route via
 * <Outlet/>. Rendered once from App.jsx so every page gets consistent chrome
 * without needing to render it themselves.
 */
export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const breadcrumb = getBreadcrumb(location.pathname);

  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="shell-logo">
          <span className="shell-logo-icon"><FiBox size={20} /></span>
          <div>
            <div className="shell-logo-title">InventoryHub</div>
            <div className="shell-logo-sub">Admin Panel</div>
          </div>
        </div>

        <nav className="shell-nav">
          {NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === 'admin').map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `shell-nav-item${isActive ? ' active' : ''}`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button className="shell-logout" onClick={logout}>
          <FiLogOut size={18} />
          <span>Log Out</span>
        </button>
      </aside>

      <div className="shell-main">
        <header className="shell-topbar">
          <div className="shell-breadcrumb">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="shell-breadcrumb-item">
                {i > 0 && <FiChevronRight size={14} className="shell-breadcrumb-sep" />}
                {crumb}
              </span>
            ))}
          </div>

          <div className="shell-topbar-right">
            <div className="shell-search">
              <FiSearch size={16} />
              <input placeholder="Search..." />
            </div>
            <button className="shell-bell" aria-label="Notifications" type="button">
              <FiBell size={18} />
            </button>
            <div className="shell-user">
              <div className="shell-avatar">
                {user?.avatar ? <img src={user.avatar} alt={user.name} /> : (user?.name?.[0]?.toUpperCase() || 'U')}
              </div>
              <div>
                <div className="shell-user-name">{user?.name || 'User'}</div>
                <div className="shell-user-role">{user?.role === 'admin' ? 'Admin Access' : 'Staff Access'}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="shell-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
