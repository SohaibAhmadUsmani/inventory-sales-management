import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useLenis from '../hooks/useLenis';
import api from '../services/api';
import {
  FiGrid,
  FiBox,
  FiTag,
  FiClipboard,
  FiShoppingCart,
  FiShoppingBag,
  FiClock,
  FiUsers,
  FiTruck,
  FiFileText,
  FiUserCheck,
  FiActivity,
  FiLogOut,
  FiSearch,
  FiBell,
  FiChevronRight,
  FiChevronLeft,
  FiMenu,
  FiX,
  FiCommand,
  FiArrowRight,
  FiCheck,
  FiCheckCircle,
  FiAlertTriangle,
  FiSidebar,
  FiZap,
} from 'react-icons/fi';
import './Layout.css';

export const NAV_GROUPS = [
  {
    id: 'overview',
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: FiGrid, end: true, shortcut: 'Alt+1' },
    ],
  },
  {
    id: 'catalog',
    title: 'Catalog & Stock',
    items: [
      { to: '/products', label: 'Products', icon: FiBox, shortcut: 'Alt+2' },
      { to: '/categories', label: 'Categories', icon: FiTag },
      { to: '/inventory', label: 'Inventory', icon: FiClipboard, shortcut: 'Alt+3', badgeKey: 'lowStock' },
    ],
  },
  {
    id: 'sales',
    title: 'Sales & CRM',
    items: [
      { to: '/pos', label: 'POS / New Sale', icon: FiShoppingCart, shortcut: 'Alt+4', pill: 'POS' },
      { to: '/sales', label: 'Sales History', icon: FiClock, shortcut: 'Alt+5' },
      { to: '/customers', label: 'Customers', icon: FiUsers },
    ],
  },
  {
    id: 'procurement',
    title: 'Procurement',
    adminOnly: true,
    items: [
      { to: '/suppliers', label: 'Suppliers', icon: FiTruck, adminOnly: true },
      { to: '/purchases', label: 'Purchases', icon: FiShoppingBag, adminOnly: true },
    ],
  },
  {
    id: 'admin',
    title: 'Administration & System',
    items: [
      { to: '/users', label: 'Users & Staff', icon: FiUserCheck, adminOnly: true },
      { to: '/reports', label: 'Reports', icon: FiFileText, adminOnly: true },
      { to: '/activity-log', label: 'Activity Log', icon: FiActivity, adminOnly: true },
      { to: '/notifications', label: 'Notifications', icon: FiBell, badgeKey: 'unread' },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

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
  '/users': 'Users & Staff',
  '/reports': 'Reports',
  '/activity-log': 'Activity Log',
  '/notifications': 'Notifications',
};

const PATH_SECTIONS = {
  '/': 'Overview',
  '/products': 'Catalog & Stock',
  '/categories': 'Catalog & Stock',
  '/inventory': 'Catalog & Stock',
  '/pos': 'Sales & CRM',
  '/sales': 'Sales & CRM',
  '/customers': 'Sales & CRM',
  '/suppliers': 'Procurement',
  '/purchases': 'Procurement',
  '/users': 'Administration',
  '/reports': 'Administration',
  '/activity-log': 'Administration',
  '/notifications': 'System',
};

function getBreadcrumb(pathname) {
  if (pathname === '/') return ['Dashboard'];
  return ['Dashboard', PATH_LABELS[pathname] || pathname];
}

function formatRelativeTime(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

/**
 * App-wide layout: sidebar + topbar + command palette + notification popover
 * wrapping every authenticated route via <Outlet/>.
 */
export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  useLenis(location.pathname);

  const isAdmin = user?.role === 'admin';
  const breadcrumb = getBreadcrumb(location.pathname);
  const currentSection = PATH_SECTIONS[location.pathname] || 'Workspace';

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [globalSearch, setGlobalSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('ism_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Notification Bell Popover state
  const [bellOpen, setBellOpen] = useState(false);
  const [markingId, setMarkingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const bellWrapRef = useRef(null);

  // Command Palette (Ctrl+K) state
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIndex, setPaletteIndex] = useState(0);
  const paletteInputRef = useRef(null);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ism_sidebar_collapsed', String(next));
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
  }, []);

  const fetchUnreadCount = useCallback(() => {
    if (!user) return;
    api
      .get('/notifications')
      .then((res) => {
        const list = Array.isArray(res.data?.notifications) ? res.data.notifications : [];
        setNotifications(list);
        setUnreadCount(Number(res.data?.unreadCount) || 0);
        const lowAlerts = list.filter(
          (n) => !n.isRead && (n.type === 'low_stock' || n.type === 'out_of_stock')
        ).length;
        setLowStockCount(lowAlerts);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount, location.pathname]);

  useEffect(() => {
    const handleNotificationsUpdated = () => fetchUnreadCount();
    window.addEventListener('notifications-updated', handleNotificationsUpdated);
    return () => window.removeEventListener('notifications-updated', handleNotificationsUpdated);
  }, [fetchUnreadCount]);

  useEffect(() => {
    setSidebarOpen(false);
    setBellOpen(false);
    setPaletteOpen(false);
  }, [location.pathname]);

  // Close notification popover on outside click
  useEffect(() => {
    if (!bellOpen) return undefined;
    const handlePointerDown = (e) => {
      if (bellWrapRef.current && !bellWrapRef.current.contains(e.target)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [bellOpen]);

  // Focus command palette input when opened
  useEffect(() => {
    if (paletteOpen) {
      setPaletteIndex(0);
      const id = requestAnimationFrame(() => {
        paletteInputRef.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    }
    setPaletteQuery('');
    return undefined;
  }, [paletteOpen]);

  // Global keyboard shortcuts (Ctrl+K, Ctrl+B, Alt+1..5, Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key?.toLowerCase();
      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && key === 'k') {
        e.preventDefault();
        setBellOpen(false);
        setPaletteOpen((prev) => !prev);
        return;
      }

      if (isMod && key === 'b') {
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault();
          toggleCollapsed();
          return;
        }
      }

      if (e.key === 'Escape') {
        if (paletteOpen) {
          setPaletteOpen(false);
          return;
        }
        if (bellOpen) {
          setBellOpen(false);
          return;
        }
        if (sidebarOpen) {
          setSidebarOpen(false);
        }
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        const shortcutMap = {
          '1': '/',
          '2': '/products',
          '3': '/inventory',
          '4': '/pos',
          '5': '/sales',
        };
        if (shortcutMap[e.key]) {
          e.preventDefault();
          navigate(shortcutMap[e.key]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paletteOpen, bellOpen, sidebarOpen, navigate, toggleCollapsed]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      const q = globalSearch.trim();
      navigate(q ? `/products?search=${encodeURIComponent(q)}` : '/products');
    }
  };

  const handleMarkNotificationRead = async (id, e) => {
    e.stopPropagation();
    setMarkingId(id);
    try {
      await api.put(`/notifications/${id}/read`);
      window.dispatchEvent(new Event('notifications-updated'));
      fetchUnreadCount();
    } catch {
      // Ignore transient errors in quick popover
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllNotificationsRead = async (e) => {
    e.stopPropagation();
    setMarkingAll(true);
    try {
      await api.put('/notifications/read-all');
      window.dispatchEvent(new Event('notifications-updated'));
      fetchUnreadCount();
    } catch {
      // Ignore transient errors in quick popover
    } finally {
      setMarkingAll(false);
    }
  };

  // Visible navigation groups filtered by role
  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.filter((group) => !group.adminOnly || isAdmin)
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.adminOnly || isAdmin),
      }))
      .filter((group) => group.items.length > 0);
  }, [isAdmin]);

  // Command palette entries (pages + quick actions + dynamic product search)
  const paletteEntries = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    const navEntries = visibleGroups.flatMap((group) =>
      group.items.map((item) => ({
        id: `nav-${item.to}`,
        type: 'Navigation',
        label: item.label,
        subtitle: `${group.title} · Go to ${item.label}`,
        icon: item.icon,
        shortcut: item.shortcut || null,
        action: () => navigate(item.to),
      }))
    );

    const quickActions = [
      {
        id: 'act-pos',
        type: 'Quick Action',
        label: 'Launch POS Checkout',
        subtitle: 'Start a new customer sale or barcode scan immediately',
        icon: FiZap,
        shortcut: 'Alt+4',
        action: () => navigate('/pos'),
      },
      {
        id: 'act-stock',
        type: 'Quick Action',
        label: 'View Low Stock Alerts',
        subtitle: 'Inspect critical stock levels and reorder thresholds',
        icon: FiAlertTriangle,
        shortcut: 'Alt+3',
        action: () => navigate('/inventory'),
      },
      {
        id: 'act-products',
        type: 'Quick Action',
        label: 'Manage Products Catalog',
        subtitle: 'Create, edit, or search SKU inventory items',
        icon: FiBox,
        shortcut: 'Alt+2',
        action: () => navigate('/products'),
      },
      ...(isAdmin
        ? [
            {
              id: 'act-reports',
              type: 'Quick Action',
              label: 'Generate Business Reports',
              subtitle: 'View revenue analytics, margins, and inventory valuation',
              icon: FiFileText,
              action: () => navigate('/reports'),
            },
          ]
        : []),
      {
        id: 'act-sidebar',
        type: 'Workspace',
        label: collapsed ? 'Expand Sidebar Navigation' : 'Collapse Sidebar to Compact Rail',
        subtitle: 'Toggle desktop navigation rail width',
        icon: FiSidebar,
        shortcut: 'Ctrl+B',
        action: () => toggleCollapsed(),
      },
    ];

    const combined = [...quickActions, ...navEntries];
    const filtered = q
      ? combined.filter(
          (entry) =>
            entry.label.toLowerCase().includes(q) ||
            entry.subtitle.toLowerCase().includes(q) ||
            entry.type.toLowerCase().includes(q)
        )
      : combined;

    if (paletteQuery.trim()) {
      filtered.unshift({
        id: `search-products-${paletteQuery.trim()}`,
        type: 'Catalog Search',
        label: `Search Products for "${paletteQuery.trim()}"`,
        subtitle: 'Jump to Products catalog filtered by this query',
        icon: FiSearch,
        shortcut: 'Enter',
        action: () => navigate(`/products?search=${encodeURIComponent(paletteQuery.trim())}`),
      });
    }

    return filtered;
  }, [paletteQuery, visibleGroups, isAdmin, collapsed, navigate, toggleCollapsed]);

  const handlePaletteKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (paletteEntries.length > 0) {
        setPaletteIndex((prev) => (prev + 1) % paletteEntries.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (paletteEntries.length > 0) {
        setPaletteIndex((prev) => (prev - 1 + paletteEntries.length) % paletteEntries.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = paletteEntries[paletteIndex] || paletteEntries[0];
      if (selected) {
        setPaletteOpen(false);
        selected.action();
      } else if (paletteQuery.trim()) {
        const q = paletteQuery.trim();
        setPaletteOpen(false);
        navigate(`/products?search=${encodeURIComponent(q)}`);
      }
    }
  };

  const getBadgeValue = (badgeKey) => {
    if (badgeKey === 'unread') return unreadCount;
    if (badgeKey === 'lowStock') return lowStockCount;
    return 0;
  };

  const recentNotifications = useMemo(() => notifications.slice(0, 5), [notifications]);

  return (
    <div className={`shell${collapsed ? ' shell-collapsed' : ''}`}>
      {sidebarOpen && (
        <div
          className="shell-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`shell-sidebar${sidebarOpen ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}
        aria-label="Primary Sidebar Navigation"
      >
        <div className="shell-logo">
          <Link to="/" className="shell-logo-brand" onClick={() => setSidebarOpen(false)}>
            <span className="shell-logo-icon">
              <FiBox size={20} />
            </span>
            <div className="shell-logo-copy">
              <div className="shell-logo-title">InventoryHub</div>
              <div className="shell-logo-sub">
                <span className="shell-logo-dot" />
                {isAdmin ? 'Admin Console' : 'Staff Workspace'}
              </div>
            </div>
          </Link>

          <button
            type="button"
            className="shell-rail-toggle"
            aria-label={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
            title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
            onClick={toggleCollapsed}
          >
            {collapsed ? <FiChevronRight size={16} /> : <FiChevronLeft size={16} />}
          </button>

          <button
            type="button"
            className="shell-sidebar-close"
            aria-label="Close navigation menu"
            onClick={() => setSidebarOpen(false)}
          >
            <FiX size={18} />
          </button>
        </div>

        <nav className="shell-nav" data-lenis-prevent>
          {visibleGroups.map((group) => (
            <div key={group.id} className="shell-nav-group">
              <div className="shell-nav-group-label">{group.title}</div>
              <div className="shell-nav-group-items">
                {group.items.map((item) => {
                  const badgeVal = item.badgeKey ? getBadgeValue(item.badgeKey) : 0;
                  const isDangerBadge = item.badgeKey === 'unread' || item.badgeKey === 'lowStock';
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      data-tooltip={item.label}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `shell-nav-item${isActive ? ' active' : ''}`
                      }
                    >
                      <span className="shell-nav-icon">
                        <item.icon size={18} />
                        {collapsed && badgeVal > 0 && (
                          <span className="shell-nav-collapsed-dot" />
                        )}
                      </span>
                      <span className="shell-nav-label">{item.label}</span>

                      {item.pill && !collapsed && (
                        <span className="shell-nav-pill">{item.pill}</span>
                      )}

                      {badgeVal > 0 && !collapsed && (
                        <span
                          className={`shell-nav-badge${
                            isDangerBadge ? ' shell-nav-badge-alert' : ''
                          }`}
                        >
                          {badgeVal > 99 ? '99+' : badgeVal}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shell-sidebar-footer">
          <div className="shell-sidebar-user">
            <div className="shell-sidebar-avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} />
              ) : (
                user?.name?.[0]?.toUpperCase() || 'U'
              )}
              <span className="shell-status-dot" title="Online" />
            </div>
            <div className="shell-sidebar-user-meta">
              <div className="shell-sidebar-user-name">{user?.name || 'User'}</div>
              <div className="shell-sidebar-user-role">
                {isAdmin ? 'Administrator' : 'Staff Member'}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="shell-logout"
            onClick={logout}
            data-tooltip="Log Out"
            title="Log Out"
          >
            <FiLogOut size={17} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      <div className="shell-main">
        <header className="shell-topbar">
          <div className="shell-topbar-left">
            <button
              type="button"
              className="shell-menu-btn"
              aria-label="Toggle navigation menu"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <FiMenu size={20} />
            </button>

            <nav aria-label="Breadcrumb" className="shell-breadcrumb">
              <span className="shell-breadcrumb-section">{currentSection}</span>
              <FiChevronRight size={13} className="shell-breadcrumb-sep shell-breadcrumb-section-sep" />
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="shell-breadcrumb-item">
                  {i > 0 && <FiChevronRight size={14} className="shell-breadcrumb-sep" />}
                  {i === 0 && breadcrumb.length > 1 ? (
                    <Link to="/" className="shell-breadcrumb-link">
                      {crumb}
                    </Link>
                  ) : (
                    <span className="shell-breadcrumb-current">{crumb}</span>
                  )}
                </span>
              ))}
            </nav>
          </div>

          <div className="shell-topbar-right">
            <div className="shell-search">
              <FiSearch size={15} className="shell-search-icon" />
              <input
                type="search"
                placeholder="Search products..."
                aria-label="Search products"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              <button
                type="button"
                className="shell-search-kbd"
                onClick={() => setPaletteOpen(true)}
                title="Open Command Palette (Ctrl+K)"
                aria-label="Open Command Palette"
              >
                <FiCommand size={11} />
                <span>K</span>
              </button>
            </div>

            <Link to="/pos" className="shell-pos-quick" title="Open Point of Sale (Alt+4)">
              <FiShoppingCart size={15} />
              <span>POS</span>
            </Link>

            <div className="shell-bell-wrap" ref={bellWrapRef}>
              <button
                className={`shell-bell${bellOpen ? ' active' : ''}`}
                aria-label={
                  unreadCount > 0
                    ? `Notifications (${unreadCount} unread)`
                    : 'Notifications'
                }
                aria-expanded={bellOpen}
                type="button"
                onClick={() => setBellOpen((prev) => !prev)}
              >
                <FiBell size={18} />
                {unreadCount > 0 && (
                  <span className="shell-bell-badge">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div
                  className="shell-notif-popover"
                  role="dialog"
                  aria-label="Notifications preview"
                  data-lenis-prevent
                >
                  <div className="shell-notif-head">
                    <div className="shell-notif-head-title">
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <span className="shell-notif-unread-pill">{unreadCount} new</span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        className="shell-notif-mark-all"
                        onClick={handleMarkAllNotificationsRead}
                        disabled={markingAll}
                      >
                        <FiCheckCircle size={13} />
                        {markingAll ? 'Marking...' : 'Mark all read'}
                      </button>
                    )}
                  </div>

                  <div className="shell-notif-list">
                    {recentNotifications.length === 0 ? (
                      <div className="shell-notif-empty">
                        <FiBell size={22} />
                        <p>You are all caught up.</p>
                      </div>
                    ) : (
                      recentNotifications.map((n) => (
                        <div
                          key={n._id}
                          className={`shell-notif-item${n.isRead ? '' : ' unread'}`}
                          onClick={() => {
                            setBellOpen(false);
                            navigate('/notifications');
                          }}
                        >
                          <span
                            className={`shell-notif-dot${
                              n.type === 'low_stock' || n.type === 'out_of_stock'
                                ? ' warning'
                                : ''
                            }`}
                          />
                          <div className="shell-notif-body">
                            <div className="shell-notif-item-top">
                              <span className="shell-notif-title">{n.title}</span>
                              <span className="shell-notif-time">
                                {formatRelativeTime(n.createdAt)}
                              </span>
                            </div>
                            <p className="shell-notif-msg">{n.message}</p>
                          </div>
                          {!n.isRead && (
                            <button
                              type="button"
                              className="shell-notif-read-btn"
                              title="Mark as read"
                              aria-label="Mark notification as read"
                              disabled={markingId === n._id}
                              onClick={(e) => handleMarkNotificationRead(n._id, e)}
                            >
                              <FiCheck size={14} />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="shell-notif-foot">
                    <button
                      type="button"
                      className="shell-notif-view-all"
                      onClick={() => {
                        setBellOpen(false);
                        navigate('/notifications');
                      }}
                    >
                      <span>View all notifications</span>
                      <FiArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="shell-user">
              <div className="shell-avatar">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} />
                ) : (
                  user?.name?.[0]?.toUpperCase() || 'U'
                )}
              </div>
              <div className="shell-user-info">
                <div className="shell-user-name">{user?.name || 'User'}</div>
                <div className="shell-user-role">
                  {isAdmin ? 'Admin Access' : 'Staff Access'}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="shell-content">
          <Outlet />
        </main>
      </div>

      {/* Interactive Ctrl+K Command Palette Modal */}
      {paletteOpen && (
        <div
          className="shell-cmd-backdrop"
          onClick={() => setPaletteOpen(false)}
          role="presentation"
        >
          <div
            className="shell-cmd-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Command Palette"
            onClick={(e) => e.stopPropagation()}
            data-lenis-prevent
          >
            <div className="shell-cmd-input-row">
              <FiSearch size={18} className="shell-cmd-search-icon" />
              <input
                ref={paletteInputRef}
                type="text"
                className="shell-cmd-input"
                placeholder="Type a command, jump to a page, or search products..."
                value={paletteQuery}
                onChange={(e) => {
                  setPaletteQuery(e.target.value);
                  setPaletteIndex(0);
                }}
                onKeyDown={handlePaletteKeyDown}
              />
              <button
                type="button"
                className="shell-cmd-esc"
                onClick={() => setPaletteOpen(false)}
              >
                ESC
              </button>
            </div>

            <div className="shell-cmd-list">
              {paletteEntries.length === 0 ? (
                <div className="shell-cmd-empty">
                  No matching commands found. Press <strong>Enter</strong> to search products.
                </div>
              ) : (
                paletteEntries.map((entry, idx) => {
                  const Icon = entry.icon;
                  const isSelected = idx === paletteIndex;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className={`shell-cmd-item${isSelected ? ' selected' : ''}`}
                      onMouseEnter={() => setPaletteIndex(idx)}
                      onClick={() => {
                        setPaletteOpen(false);
                        entry.action();
                      }}
                    >
                      <span className="shell-cmd-item-icon">
                        <Icon size={17} />
                      </span>
                      <div className="shell-cmd-item-body">
                        <div className="shell-cmd-item-label">
                          <span>{entry.label}</span>
                          <span className="shell-cmd-item-type">{entry.type}</span>
                        </div>
                        <div className="shell-cmd-item-sub">{entry.subtitle}</div>
                      </div>
                      {entry.shortcut && (
                        <kbd className="shell-cmd-kbd">{entry.shortcut}</kbd>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="shell-cmd-footer">
              <span>
                <kbd>↑</kbd> <kbd>↓</kbd> to navigate
              </span>
              <span>
                <kbd>↵</kbd> to select
              </span>
              <span>
                <kbd>Ctrl+B</kbd> toggle sidebar
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
