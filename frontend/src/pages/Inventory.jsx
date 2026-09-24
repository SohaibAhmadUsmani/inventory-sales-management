import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import useDebounce from '../hooks/useDebounce';
import api from '../services/api';
import { toast } from 'react-toastify';
import {
  FiBox,
  FiAlertCircle,
  FiArrowDownLeft,
  FiArrowUpRight,
  FiRefreshCw,
  FiSliders,
  FiDownload,
  FiSearch,
  FiPlus,
  FiMinus,
  FiAlertTriangle,
  FiX,
  FiCheckCircle,
  FiClock,
  FiChevronLeft,
  FiChevronRight,
  FiPackage,
  FiLayers,
  FiActivity,
  FiEye,
  FiFileText,
  FiCalendar,
  FiFilter,
} from 'react-icons/fi';
import './Inventory.css';

const resolveImageUrl = (img) => {
  if (!img) return null;
  if (/^(https?:|blob:|data:)/i.test(img)) return img;
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  const cleanPath = String(img).replace(/\\/g, '/').replace(/^\/?uploads\/?/, '');
  return `${base}/uploads/${cleanPath}`;
};

const formatLocalDate = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Inventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Navigation tabs: 'history' | 'alerts' | 'current'
  const [activeTab, setActiveTab] = useState('history');

  // Stats
  const [stats, setStats] = useState({
    totalStockedItems: 0,
    criticalLowStock: 0,
    movementsToday: 0,
    totalPortfolioValue: 0,
    accuracyRate: 100,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Movement Ledger State
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [catalogStatusFilter, setCatalogStatusFilter] = useState('all');

  // Critical Alerts & Catalog State
  const [criticalAlerts, setCriticalAlerts] = useState([]);
  const [currentStockList, setCurrentStockList] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogTotalPages, setCatalogTotalPages] = useState(1);
  const [catalogTotalEntries, setCatalogTotalEntries] = useState(0);
  const [creatingPo, setCreatingPo] = useState(false);

  // Real Data: Suppliers, Products, and Categories
  const [productsList, setProductsList] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);

  // Modals & Action Forms
  const [modalMode, setModalMode] = useState(null);
  const [form, setForm] = useState({
    productId: '',
    supplierId: '',
    quantity: '',
    newQuantity: '',
    unitCost: '',
    reason: '',
    reference: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(null);

  // Product Stock Audit Modal (Section 4 Exemplar)
  const [auditModal, setAuditModal] = useState({
    open: false,
    loading: false,
    product: null,
    audit: null,
    history: [],
  });

  // Fetch KPI statistics from live database
  const fetchStats = useCallback(() => {
    setStatsLoading(true);
    api.get('/inventory/stats')
      .then((res) => {
        if (res.data?.stats) {
          setStats(res.data.stats);
        }
      })
      .catch((err) => console.error('Failed to load inventory stats', err))
      .finally(() => setStatsLoading(false));
  }, []);

  // Calculate start date string based on preset or custom range using local calendar dates
  const getDateRangeParams = useCallback(() => {
    if (dateFilter === 'today') {
      const today = formatLocalDate(new Date());
      return { startDate: today, endDate: today };
    }
    if (dateFilter === '7days') {
      const d = formatLocalDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      return { startDate: d };
    }
    if (dateFilter === '30days') {
      const d = formatLocalDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
      return { startDate: d };
    }
    if (dateFilter === 'custom') {
      if (customStartDate && customEndDate && customStartDate > customEndDate) {
        return {
          startDate: customEndDate,
          endDate: customStartDate,
        };
      }
      return {
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      };
    }
    return {};
  }, [dateFilter, customStartDate, customEndDate]);

  // Fetch Movement History Ledger with filters
  const fetchInventory = useCallback((signal) => {
    setLoading(true);
    const dateParams = getDateRangeParams();
    api.get('/inventory', {
      params: {
        page,
        limit: 10,
        search: debouncedSearch.trim() || undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        category: categoryFilter || undefined,
        supplier: supplierFilter || undefined,
        ...dateParams,
      },
      signal,
    })
      .then((res) => {
        setRecords(res.data?.records || []);
        setTotalPages(res.data?.totalPages || 1);
        setTotalEntries(res.data?.total || 0);
      })
      .catch((err) => {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        toast.error(err.response?.data?.message || 'Failed to load movement logs');
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, [page, debouncedSearch, typeFilter, categoryFilter, supplierFilter, getDateRangeParams]);

  // Fetch Critical Low Stock Items
  const fetchLowStockAlerts = useCallback(() => {
    api.get('/inventory/low-stock')
      .then((res) => setCriticalAlerts(res.data?.alerts || []))
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to load low stock alerts');
      });
  }, []);

  // Fetch Current Stock Catalog with pagination
  const fetchCurrentStock = useCallback((signal) => {
    setCatalogLoading(true);
    api.get('/inventory/current-stock', {
      params: {
        search: debouncedSearch.trim() || undefined,
        category: categoryFilter || undefined,
        status: catalogStatusFilter !== 'all' ? catalogStatusFilter : undefined,
        page: catalogPage,
        limit: 25,
      },
      signal,
    })
      .then((res) => {
        setCurrentStockList(res.data?.products || []);
        setCatalogTotalPages(res.data?.totalPages || 1);
        setCatalogTotalEntries(res.data?.total || 0);
      })
      .catch((err) => {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        toast.error(err.response?.data?.message || 'Failed to load current stock catalog');
      })
      .finally(() => {
        if (!signal?.aborted) setCatalogLoading(false);
      });
  }, [debouncedSearch, categoryFilter, catalogStatusFilter, catalogPage]);

  // Fetch products for modal selectors
  const fetchProductsForModal = useCallback(() => {
    api.get('/products', { params: { limit: 500 } })
      .then((res) => setProductsList(res.data?.products || []))
      .catch(console.error);
  }, []);

  // Fetch real suppliers
  const fetchSuppliers = useCallback(() => {
    api.get('/suppliers', { params: { limit: 500 } })
      .then((res) => setSuppliersList(res.data?.suppliers || []))
      .catch(() => setSuppliersList([]));
  }, []);

  // Fetch product categories
  const fetchCategories = useCallback(() => {
    api.get('/categories')
      .then((res) => setCategoriesList(res.data?.categories || []))
      .catch(() => setCategoriesList([]));
  }, []);

  // Initial Data Load
  useEffect(() => {
    fetchStats();
    fetchLowStockAlerts();
    fetchProductsForModal();
    fetchSuppliers();
    fetchCategories();
  }, [fetchStats, fetchLowStockAlerts, fetchProductsForModal, fetchSuppliers, fetchCategories]);

  const closeModal = useCallback(() => {
    if (submitting) return;
    setModalMode(null);
    setForm({ productId: '', supplierId: '', quantity: '', newQuantity: '', unitCost: '', reason: '', reference: '', notes: '' });
  }, [submitting]);

  const closeProductAudit = useCallback(() => {
    setAuditModal({ open: false, loading: false, product: null, audit: null, history: [] });
  }, []);

  // Escape key closes open modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (modalMode) closeModal();
        if (auditModal.open) closeProductAudit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalMode, auditModal.open, closeModal, closeProductAudit]);

  // Reset pagination when debouncedSearch updates
  useEffect(() => {
    setPage(1);
    setCatalogPage(1);
  }, [debouncedSearch]);

  // Tab synchronization with AbortController
  useEffect(() => {
    const controller = new AbortController();
    if (activeTab === 'history') {
      fetchInventory(controller.signal);
    } else if (activeTab === 'current') {
      fetchCurrentStock(controller.signal);
    }
    return () => controller.abort();
  }, [activeTab, fetchInventory, fetchCurrentStock]);

  // Filtered low-stock alerts for Tab 2 search
  const filteredAlerts = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return criticalAlerts;
    return criticalAlerts.filter((item) =>
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.sku && item.sku.toLowerCase().includes(q)) ||
      (item.category && String(item.category).toLowerCase().includes(q)) ||
      (item.supplier && String(item.supplier).toLowerCase().includes(q))
    );
  }, [criticalAlerts, debouncedSearch]);

  // Selected product helper for real-time calculations in modals
  const selectedProduct = useMemo(() => {
    return productsList.find((p) => p._id === form.productId) || null;
  }, [productsList, form.productId]);

  // Open Product Stock Audit Modal (Section 4 Exemplar)
  const openProductAudit = (productId) => {
    if (!productId) return;
    setAuditModal({ open: true, loading: true, product: null, audit: null, history: [] });
    api.get(`/inventory/product/${productId}`)
      .then((res) => {
        if (res.data?.success) {
          setAuditModal({
            open: true,
            loading: false,
            product: res.data.product,
            audit: res.data.audit,
            history: res.data.history || [],
          });
        }
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to load product audit breakdown');
        setAuditModal({ open: false, loading: false, product: null, audit: null, history: [] });
      });
  };

  // Build clean export query params (removes undefined/null/empty strings)
  const buildExportParams = () => {
    const dateParams = getDateRangeParams();
    const raw = {
      type: typeFilter !== 'all' ? typeFilter : undefined,
      search: search.trim() || undefined,
      category: categoryFilter || undefined,
      supplier: supplierFilter || undefined,
      ...dateParams,
    };
    const cleanParams = Object.fromEntries(
      Object.entries(raw).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    return new URLSearchParams(cleanParams).toString();
  };

  // Handle Export Log (CSV)
  const handleExportCsv = async () => {
    setExporting('csv');
    try {
      const params = buildExportParams();
      const response = await api.get(`/inventory/export-csv?${params}`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `inventory-ledger-${formatLocalDate(new Date())}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Inventory ledger exported to CSV');
    } catch (err) {
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          toast.error(parsed.message || 'Failed to export inventory logs');
        } catch {
          toast.error('Failed to export inventory logs');
        }
      } else {
        toast.error(err.response?.data?.message || 'Failed to export inventory logs');
      }
    } finally {
      setExporting(null);
    }
  };

  // Handle Export Log (Excel .xlsx)
  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      const params = buildExportParams();
      const response = await api.get(`/inventory/export-excel?${params}`, { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `inventory-ledger-${formatLocalDate(new Date())}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Inventory workbook exported to Excel');
    } catch (err) {
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          toast.error(parsed.message || 'Failed to export Excel workbook');
        } catch {
          toast.error('Failed to export Excel workbook');
        }
      } else {
        toast.error(err.response?.data?.message || 'Failed to export Excel workbook');
      }
    } finally {
      setExporting(null);
    }
  };

  // Handle Export Log (Printable PDF Audit)
  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      const params = buildExportParams();
      const response = await api.get(`/inventory/export-pdf?${params}`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `inventory-audit-report-${formatLocalDate(new Date())}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Audit report exported to PDF');
    } catch (err) {
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          toast.error(parsed.message || 'Failed to export PDF report');
        } catch {
          toast.error('Failed to export PDF report');
        }
      } else {
        toast.error(err.response?.data?.message || 'Failed to export PDF report');
      }
    } finally {
      setExporting(null);
    }
  };

  // Trigger one-click draft PO replenishment generator
  const handleGenerateDraftPo = async () => {
    if (creatingPo) return;
    if (!window.confirm('Generate draft Purchase Orders for all low-stock items with assigned suppliers?')) return;
    setCreatingPo(true);
    try {
      const res = await api.post('/inventory/create-draft-po');
      toast.success(res.data?.message || 'Draft Purchase Orders generated successfully!');
      fetchLowStockAlerts();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate draft purchase orders');
    } finally {
      setCreatingPo(false);
    }
  };

  // Open Modal with clean form
  const openModal = (mode, defaultProductId = '') => {
    if (defaultProductId && !productsList.some((p) => p._id === defaultProductId)) {
      api.get(`/products/${defaultProductId}`)
        .then((res) => {
          const prod = res.data?.product;
          if (prod) {
            setProductsList((prev) => (prev.some((p) => p._id === prod._id) ? prev : [prod, ...prev]));
          }
        })
        .catch(() => {});
    }
    setModalMode(mode);
    setForm({
      productId: defaultProductId,
      supplierId: '',
      quantity: '',
      newQuantity: '',
      unitCost: '',
      reason:
        mode === 'adjust'
          ? 'Cycle Count Variance'
          : mode === 'damaged'
          ? 'Damaged in Warehouse Storage'
          : '',
      reference: '',
      notes: '',
    });
  };

  // Submit Modal Action
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!form.productId) {
      return toast.warning('Please select a product');
    }

    // Over-dispatch prevention
    if (['out', 'damaged'].includes(modalMode)) {
      const qty = Number(form.quantity);
      if (selectedProduct && qty > selectedProduct.stock) {
        return toast.error(`Requested quantity (${qty}) exceeds available physical stock (${selectedProduct.stock} units).`);
      }
    }

    setSubmitting(true);
    try {
      if (modalMode === 'in') {
        const payload = {
          productId: form.productId,
          quantity: Number(form.quantity),
          supplierId: form.supplierId || undefined,
          unitCost: form.unitCost ? Number(form.unitCost) : undefined,
          reference: form.reference,
          notes: form.notes,
        };
        const res = await api.post('/inventory/stock-in', payload);
        toast.success(res.data?.message || 'Stock In recorded successfully');
      } else if (modalMode === 'out') {
        const payload = {
          productId: form.productId,
          quantity: Number(form.quantity),
          reference: form.reference,
          notes: form.notes,
        };
        const res = await api.post('/inventory/stock-out', payload);
        toast.success(res.data?.message || 'Stock Out recorded successfully');
      } else if (modalMode === 'damaged') {
        const payload = {
          productId: form.productId,
          quantity: Number(form.quantity),
          reason: form.reason,
          notes: form.notes,
        };
        const res = await api.post('/inventory/damaged', payload);
        toast.success(res.data?.message || 'Damaged stock recorded successfully');
      } else if (modalMode === 'adjust') {
        const payload = {
          productId: form.productId,
          newQuantity: Number(form.newQuantity),
          expectedStock: selectedProduct ? selectedProduct.stock : undefined,
          reason: form.reason,
          notes: form.notes,
        };
        const res = await api.post('/inventory/adjust', payload);
        toast.success(res.data?.message || 'Stock reconciled successfully');
      }

      setModalMode(null);
      setForm({ productId: '', supplierId: '', quantity: '', newQuantity: '', unitCost: '', reason: '', reference: '', notes: '' });
      fetchStats();
      fetchLowStockAlerts();
      fetchProductsForModal();
      if (activeTab === 'history') fetchInventory();
      if (activeTab === 'current') fetchCurrentStock();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper for rendering initials
  const getInitials = (name) => {
    if (!name) return 'SYS';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // Helper for vector pill styling
  const renderVectorBadge = (type) => {
    switch (type) {
      case 'opening_stock':
        return (
          <span className="inv-vector-badge inv-vector-opening">
            <FiPackage size={12} />
            Opening
          </span>
        );
      case 'stock_in':
      case 'purchase':
      case 'sale_return':
      case 'transfer_in':
        return (
          <span className="inv-vector-badge inv-vector-inbound">
            <FiArrowDownLeft size={13} />
            {type === 'sale_return' ? 'Sale Return' : type === 'transfer_in' ? 'Transfer In' : 'Inbound'}
          </span>
        );
      case 'stock_out':
      case 'sale':
      case 'purchase_return':
      case 'transfer_out':
        return (
          <span className="inv-vector-badge inv-vector-outbound">
            <FiArrowUpRight size={13} />
            {type === 'purchase_return' ? 'PO Return' : type === 'transfer_out' ? 'Transfer Out' : 'Outbound'}
          </span>
        );
      case 'adjustment':
        return (
          <span className="inv-vector-badge inv-vector-adjust">
            <FiRefreshCw size={12} />
            Adjustment
          </span>
        );
      case 'damaged':
      case 'expired':
        return (
          <span className="inv-vector-badge inv-vector-damaged">
            <FiAlertTriangle size={12} />
            {type === 'expired' ? 'Expired' : 'Damaged'}
          </span>
        );
      default:
        return <span className="inv-vector-badge">{type}</span>;
    }
  };

  // Helper for reference pill badges
  const renderRefPill = (ref) => {
    if (!ref) return <span className="inv-ref-badge inv-ref-badge-general">MANUAL</span>;
    const isInv = ref.startsWith('INV-');
    const isPo = ref.startsWith('PO-');
    const isOpn = ref.startsWith('OPN-');
    let pillClass = 'inv-ref-badge-general';
    if (isInv) pillClass = 'inv-ref-badge-inv';
    if (isPo) pillClass = 'inv-ref-badge-po';
    if (isOpn) pillClass = 'inv-ref-badge-opn';
    return <span className={`inv-ref-badge ${pillClass}`}>{ref}</span>;
  };

  return (
    <div className="inv-container">
      {/* ----------------- Top Control Bar & Header ----------------- */}
      <div className="inv-header">
        <div className="inv-header-main">
          <div className="inv-system-badge">
            <span className="inv-pulse-dot" />
            System Operational
          </div>
          <h1 className="inv-title">Inventory Control</h1>
          <p className="inv-subtitle">
            Monitor real-time stock levels, track forensic movements across catalog lines, and execute audit reconciliations.
          </p>
        </div>

        <div className="inv-header-actions">
          <div className="inv-export-group">
            <button
              className="inv-btn inv-btn-secondary"
              onClick={handleExportCsv}
              disabled={exporting !== null}
              title="Export raw CSV ledger"
            >
              <FiDownload size={14} />
              {exporting === 'csv' ? 'CSV...' : 'CSV'}
            </button>
            <button
              className="inv-btn inv-btn-secondary"
              onClick={handleExportExcel}
              disabled={exporting !== null}
              title="Export formatted Excel workbook (.xlsx)"
            >
              <FiFileText size={14} />
              {exporting === 'excel' ? 'Excel...' : 'Excel'}
            </button>
            <button
              className="inv-btn inv-btn-secondary"
              onClick={handleExportPdf}
              disabled={exporting !== null}
              title="Export printable PDF audit report"
            >
              <FiDownload size={14} />
              {exporting === 'pdf' ? 'PDF...' : 'PDF'}
            </button>
          </div>
          <button className="inv-btn inv-btn-primary" onClick={() => openModal('adjust')}>
            <FiSliders size={15} />
            Manual Adjustment
          </button>
          <button className="inv-btn inv-btn-inbound-outline inv-btn-sm" onClick={() => openModal('in')}>
            <FiPlus size={14} />
            Stock In
          </button>
          <button className="inv-btn inv-btn-outbound-outline inv-btn-sm" onClick={() => openModal('out')}>
            <FiMinus size={14} />
            Stock Out
          </button>
          <button className="inv-btn inv-btn-danger-outline inv-btn-sm" onClick={() => openModal('damaged')}>
            <FiAlertTriangle size={14} />
            Damaged
          </button>
        </div>
      </div>

      {/* ----------------- 4 KPI Stat Cards (Live Data) ----------------- */}
      <div className="inv-kpi-grid">
        {/* Card 1: Total Stocked Items */}
        <div className="inv-kpi-card">
          <div className="inv-kpi-top">
            <span className="inv-kpi-label">Total Stocked Items</span>
            <div className="inv-kpi-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
              <FiPackage size={18} />
            </div>
          </div>
          <div className="inv-kpi-value">
            {statsLoading ? '...' : Number(stats.totalStockedItems).toLocaleString()}
          </div>
          <div className="inv-kpi-bottom">
            <span>• Active physical units in warehouse</span>
          </div>
        </div>

        {/* Card 2: Critical Low Stock */}
        <div className="inv-kpi-card">
          <div className="inv-kpi-top">
            <span className="inv-kpi-label">Critical Low Stock</span>
            <div className="inv-kpi-icon-wrap" style={{ background: '#fee2e2', color: '#e11d48' }}>
              <FiAlertCircle size={18} />
            </div>
          </div>
          <div className="inv-kpi-value" style={{ color: stats.criticalLowStock > 0 ? '#e11d48' : '#059669' }}>
            {statsLoading ? '...' : stats.criticalLowStock}
          </div>
          <div className="inv-kpi-bottom">
            <span className={`inv-kpi-pill ${stats.criticalLowStock > 0 ? 'inv-kpi-pill-critical' : 'inv-kpi-pill-normal'}`}>
              {stats.criticalLowStock > 0 ? 'Require attention' : 'Optimal levels'}
            </span>
          </div>
        </div>

        {/* Card 3: Movements Today */}
        <div className="inv-kpi-card">
          <div className="inv-kpi-top">
            <span className="inv-kpi-label">Movements Today</span>
            <div className="inv-kpi-icon-wrap" style={{ background: '#eef2ff', color: '#4f46e5' }}>
              <FiArrowDownLeft size={18} />
            </div>
          </div>
          <div className="inv-kpi-value">
            {statsLoading ? '...' : stats.movementsToday}
          </div>
          <div className="inv-kpi-bottom">
            <span>• {stats.unitsMovedToday || 0} units moved today</span>
          </div>
        </div>

        {/* Card 4: Total Portfolio Value */}
        <div className="inv-kpi-card">
          <div className="inv-kpi-top">
            <span className="inv-kpi-label">Total Portfolio Value</span>
            <div className="inv-kpi-icon-wrap" style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0' }}>
              <FiBox size={18} />
            </div>
          </div>
          <div className="inv-kpi-value">
            {statsLoading ? '...' : `$${Number(stats.totalPortfolioValue).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          </div>
          <div className="inv-kpi-bottom">
            <span>• Cost-basis inventory valuation</span>
          </div>
        </div>
      </div>

      {/* ----------------- Sub-Nav Tabs ----------------- */}
      <div className="inv-tabs-bar">
        <div className="inv-tabs-list" role="tablist" aria-label="Inventory views">
          <button
            role="tab"
            aria-selected={activeTab === 'history'}
            className={`inv-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <FiClock size={15} />
            Movement History
            <span className="inv-tab-count">{totalEntries}</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'alerts'}
            className={`inv-tab-btn ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            <FiAlertCircle size={15} />
            Low Stock Alerts
            <span className="inv-tab-count" style={{ background: criticalAlerts.length > 0 ? '#fee2e2' : undefined, color: criticalAlerts.length > 0 ? '#b91c1c' : undefined }}>
              {criticalAlerts.length}
            </span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'current'}
            className={`inv-tab-btn ${activeTab === 'current' ? 'active' : ''}`}
            onClick={() => setActiveTab('current')}
          >
            <FiLayers size={15} />
            Current Stock Levels
            <span className="inv-tab-count">{catalogTotalEntries || stats.totalProductCount || productsList.length || 0}</span>
          </button>
        </div>

        {activeTab === 'history' && (
          <button className="inv-btn inv-btn-secondary inv-btn-sm" onClick={() => fetchInventory()}>
            <FiRefreshCw size={13} />
            Refresh
          </button>
        )}
      </div>

      {/* ----------------- Toolbar: Search & Multi-Dimensional Filters ----------------- */}
      <div className="inv-toolbar">
        <div className="inv-search-wrap">
          <FiSearch size={16} color="var(--inv-text-muted)" />
          <input
            type="text"
            aria-label="Search inventory"
            placeholder={
              activeTab === 'current'
                ? 'Filter catalog by product name or SKU...'
                : activeTab === 'alerts'
                ? 'Filter low stock alerts by product, SKU, category, or supplier...'
                : 'Search SKU, product name, or reference ID...'
            }
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
              setCatalogPage(1);
            }}
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setPage(1);
                setCatalogPage(1);
              }}
              aria-label="Clear search"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--inv-text-muted)' }}
            >
              <FiX size={14} />
            </button>
          )}
        </div>

        {activeTab === 'history' && (
          <div className="inv-filters-group">
            <select
              className="inv-select"
              aria-label="Filter by movement vector"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Vectors</option>
              <option value="opening_stock">Opening Stock</option>
              <option value="inbound">Inbound (Stock In / PO)</option>
              <option value="outbound">Outbound (Stock Out / Sale)</option>
              <option value="adjustment">Adjustments</option>
              <option value="damaged">Damaged Goods</option>
            </select>

            {categoriesList.length > 0 && (
              <select
                className="inv-select"
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                  setCatalogPage(1);
                }}
              >
                <option value="">All Categories</option>
                {categoriesList.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}

            {suppliersList.length > 0 && (
              <select
                className="inv-select"
                aria-label="Filter by supplier"
                value={supplierFilter}
                onChange={(e) => {
                  setSupplierFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Suppliers</option>
                {suppliersList.map((sup) => (
                  <option key={sup._id} value={sup._id}>
                    {sup.name}
                  </option>
                ))}
              </select>
            )}

            <select
              className="inv-select"
              aria-label="Filter by date range"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>

            {dateFilter === 'custom' && (
              <div className="inv-custom-dates">
                <input
                  type="date"
                  className="inv-date-input"
                  aria-label="Custom start date"
                  value={customStartDate}
                  max={customEndDate || undefined}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setPage(1);
                  }}
                  title="Start Date"
                />
                <span style={{ color: 'var(--inv-text-muted)', fontSize: '12px' }}>to</span>
                <input
                  type="date"
                  className="inv-date-input"
                  aria-label="Custom end date"
                  value={customEndDate}
                  min={customStartDate || undefined}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setPage(1);
                  }}
                  title="End Date"
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'current' && (
          <div className="inv-filters-group">
            {categoriesList.length > 0 && (
              <select
                className="inv-select"
                aria-label="Filter catalog by category"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCatalogPage(1);
                  setPage(1);
                }}
              >
                <option value="">All Categories</option>
                {categoriesList.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}

            <select
              className="inv-select"
              aria-label="Filter catalog by stock status"
              value={catalogStatusFilter}
              onChange={(e) => {
                setCatalogStatusFilter(e.target.value);
                setCatalogPage(1);
              }}
            >
              <option value="all">All Stock Statuses</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>
        )}
      </div>

      {/* ----------------- Tab 1: Movement History Table ----------------- */}
      {activeTab === 'history' && (
        <div className="inv-table-card">
          <div className="inv-table-scroll">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Product / SKU</th>
                  <th>Type</th>
                  <th>Differential</th>
                  <th>Category / Supplier</th>
                  <th>Reason / Notes</th>
                  <th>Date & Time</th>
                  <th>Operator</th>
                  <th>Audit</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx}>
                      <td colSpan={9} style={{ padding: '16px' }}>
                        <div className="inv-skeleton" style={{ height: '28px', width: '100%' }} />
                      </td>
                    </tr>
                  ))
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="inv-empty-state">
                        <FiPackage size={36} color="var(--inv-border-hover)" />
                        <div style={{ fontWeight: 600, color: 'var(--inv-text-title)' }}>No transaction records found</div>
                        <div style={{ fontSize: '13px' }}>
                          Start by recording a Stock In or Manual Adjustment above.
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  records.map((r) => {
                    const diff = r.differential;
                    const isPositive = diff > 0;
                    const isNegative = diff < 0;

                    return (
                      <tr key={r._id}>
                        {/* Reference ID & Badge */}
                        <td>
                          <div className="inv-ref-col">
                            {renderRefPill(r.reference || r.trxCode)}
                            <span className="inv-ref-time">
                              {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>

                        {/* Product Thumbnail & SKU (Clickable Audit) */}
                        <td>
                          <div
                            className="inv-prod-cell inv-clickable-prod"
                            role="button"
                            tabIndex={0}
                            onClick={() => openProductAudit(r.product?._id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openProductAudit(r.product?._id);
                              }
                            }}
                            title="Click to view full forensic stock audit (Section 4)"
                          >
                            <div className="inv-prod-thumb">
                              {r.product?.image ? (
                                <img
                                  src={resolveImageUrl(r.product.image)}
                                  alt={r.product.name}
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                r.product?.name?.[0]?.toUpperCase() || 'P'
                              )}
                            </div>
                            <div className="inv-prod-meta">
                              <span className="inv-prod-name">{r.product?.name || 'Unknown Product'}</span>
                              <span className="inv-prod-sku">{r.product?.sku || 'SKU-N/A'}</span>
                            </div>
                          </div>
                        </td>

                        {/* Vector Type */}
                        <td>{renderVectorBadge(r.type)}</td>

                        {/* Differential (+ / -) */}
                        <td>
                          <span
                            className={`inv-diff ${
                              isPositive ? 'inv-diff-pos' : isNegative ? 'inv-diff-neg' : 'inv-diff-neutral'
                            }`}
                          >
                            {isPositive ? `+${diff}` : diff}
                          </span>
                        </td>

                        {/* Category & Supplier Metadata */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--inv-text-title)' }}>
                              {r.product?.category?.name || r.category?.name || 'General'}
                            </span>
                            {r.supplier?.name && (
                              <span style={{ fontSize: '11.5px', color: 'var(--inv-teal-dark)', fontWeight: 500 }}>
                                {r.supplier.name}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Reason / Note */}
                        <td>
                          <div style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.notes || r.reference || 'Manual movement'}>
                            {r.notes || r.reference || 'Manual movement'}
                          </div>
                        </td>

                        {/* Date */}
                        <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {new Date(r.createdAt).toLocaleDateString()}
                        </td>

                        {/* User Initials & Name */}
                        <td>
                          <div className="inv-user-cell">
                            <div className="inv-user-bubble">{getInitials(r.performedBy?.name)}</div>
                            <span className="inv-user-name">{r.performedBy?.name || 'Staff User'}</span>
                          </div>
                        </td>

                        {/* Forensic Audit Action */}
                        <td>
                          <button
                            className="inv-btn inv-btn-secondary inv-btn-sm"
                            onClick={() => openProductAudit(r.product?._id)}
                            title="Audit Stock Breakdown (Section 4)"
                          >
                            <FiActivity size={12} />
                            Audit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {!loading && records.length > 0 && (
            <div className="inv-table-footer">
              <div>
                Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, totalEntries)} of {totalEntries} entries
              </div>
              <div className="inv-pagination">
                <button
                  className="inv-page-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <FiChevronLeft size={14} />
                  Prev
                </button>
                <button className="inv-page-btn active">{page}</button>
                <button
                  className="inv-page-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <FiChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----------------- Tab 2: Low Stock Alerts View (Live Data) ----------------- */}
      {activeTab === 'alerts' && (
        <div className="inv-table-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--inv-border)' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--inv-text-title)' }}>
                Replenishment Threshold Watchlist
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--inv-text-muted)' }}>
                {filteredAlerts.length} item{filteredAlerts.length === 1 ? '' : 's'} currently at or below minimum threshold
              </p>
            </div>
            {isAdmin && criticalAlerts.length > 0 && (
              <button
                className="inv-btn inv-btn-primary inv-btn-sm"
                onClick={handleGenerateDraftPo}
                disabled={creatingPo}
                title="Automatically create draft POs for all suppliers with low stock items"
              >
                <FiPackage size={14} />
                {creatingPo ? 'Generating Draft POs...' : 'Generate Replenishment POs'}
              </button>
            )}
          </div>
          <div className="inv-table-scroll">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Product Details</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Min Threshold</th>
                  <th>Deficit to Reorder</th>
                  <th>Supplier</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="inv-empty-state">
                        <FiCheckCircle size={36} color="#059669" />
                        <div style={{ fontWeight: 700, color: 'var(--inv-text-title)' }}>
                          {criticalAlerts.length === 0 ? 'All stock levels are optimal' : 'No matching low-stock alerts'}
                        </div>
                        <div style={{ fontSize: '13px' }}>
                          {criticalAlerts.length === 0
                            ? 'No products are currently at or below minimum threshold.'
                            : 'Try clearing your search filter above.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAlerts.map((item) => (
                    <tr key={item._id}>
                      <td>
                        <div
                          className="inv-prod-cell inv-clickable-prod"
                          role="button"
                          tabIndex={0}
                          onClick={() => openProductAudit(item._id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openProductAudit(item._id);
                            }
                          }}
                          title="Click to view full forensic stock audit (Section 4)"
                        >
                          <div className="inv-prod-thumb">
                            {item.image ? (
                              <img
                                src={resolveImageUrl(item.image)}
                                alt={item.name}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              item.name?.[0]?.toUpperCase() || 'P'
                            )}
                          </div>
                          <div className="inv-prod-meta">
                            <span className="inv-prod-name">{item.name}</span>
                            <span className="inv-prod-sku">{item.sku}</span>
                          </div>
                        </div>
                      </td>
                      <td>{item.category}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: item.stock === 0 ? '#e11d48' : '#d97706', fontVariantNumeric: 'tabular-nums' }}>
                          {item.stock} units
                        </span>
                      </td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{item.minimumStock} units</td>
                      <td>
                        <span className="inv-kpi-pill inv-kpi-pill-critical">
                          -{item.deficit} units required
                        </span>
                      </td>
                      <td>{item.supplier || 'Not linked'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="inv-btn inv-btn-inbound-outline inv-btn-sm"
                            onClick={() => openModal('in', item._id)}
                            title="Quick Restock"
                          >
                            <FiPlus size={13} />
                            Restock
                          </button>
                          <button
                            className="inv-btn inv-btn-secondary inv-btn-sm"
                            onClick={() => openProductAudit(item._id)}
                            title="Audit Stock Breakdown (Section 4)"
                          >
                            <FiActivity size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------- Tab 3: Current Stock Catalog (Live Data) ----------------- */}
      {activeTab === 'current' && (
        <div className="inv-table-card">
          <div className="inv-table-scroll">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Stock On Hand</th>
                  <th>Min Stock</th>
                  <th>Unit Cost</th>
                  <th>Total Valuation</th>
                  <th>Status</th>
                  <th>Quick Actions</th>
                </tr>
              </thead>
              <tbody>
                {catalogLoading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx}>
                      <td colSpan={8} style={{ padding: '16px' }}>
                        <div className="inv-skeleton" style={{ height: '28px', width: '100%' }} />
                      </td>
                    </tr>
                  ))
                ) : currentStockList.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="inv-empty-state">No products found</div>
                    </td>
                  </tr>
                ) : (
                  currentStockList.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <div
                          className="inv-prod-cell inv-clickable-prod"
                          role="button"
                          tabIndex={0}
                          onClick={() => openProductAudit(p._id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openProductAudit(p._id);
                            }
                          }}
                          title="Click to view full forensic stock audit (Section 4)"
                        >
                          <div className="inv-prod-thumb">
                            {p.image ? (
                              <img
                                src={resolveImageUrl(p.image)}
                                alt={p.name}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              p.name?.[0]?.toUpperCase() || 'P'
                            )}
                          </div>
                          <div className="inv-prod-meta">
                            <span className="inv-prod-name">{p.name}</span>
                            <span className="inv-prod-sku">{p.sku}</span>
                          </div>
                        </div>
                      </td>
                      <td>{p.category?.name || 'General'}</td>
                      <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{p.stock}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{p.minimumStock}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                        ${Number(p.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        ${Number(p.stockValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span
                          className={`inv-kpi-pill ${
                            p.stockStatus === 'critical' || p.stockStatus === 'low_stock'
                              ? 'inv-kpi-pill-critical'
                              : 'inv-kpi-pill-normal'
                          }`}
                        >
                          {p.stock === 0 ? 'Out of Stock' : p.stock <= p.minimumStock ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="inv-btn inv-btn-secondary inv-btn-sm"
                            title="Audit Breakdown (Section 4)"
                            onClick={() => openProductAudit(p._id)}
                          >
                            <FiActivity size={12} />
                          </button>
                          <button
                            className="inv-btn inv-btn-secondary inv-btn-sm"
                            title="Adjust Stock"
                            onClick={() => openModal('adjust', p._id)}
                          >
                            <FiSliders size={12} />
                          </button>
                          <button
                            className="inv-btn inv-btn-inbound-outline inv-btn-sm"
                            title="Add Stock In"
                            onClick={() => openModal('in', p._id)}
                          >
                            <FiPlus size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {catalogTotalEntries > 25 && (
            <div className="inv-table-footer">
              <div className="inv-pagination-info">
                Showing {(catalogPage - 1) * 25 + 1} to {Math.min(catalogPage * 25, catalogTotalEntries)} of {catalogTotalEntries} catalog products
              </div>
              <div className="inv-pagination">
                <button
                  className="inv-page-btn"
                  disabled={catalogPage <= 1}
                  onClick={() => setCatalogPage((p) => Math.max(1, p - 1))}
                >
                  <FiChevronLeft size={14} />
                  Prev
                </button>
                <button className="inv-page-btn active">{catalogPage}</button>
                <button
                  className="inv-page-btn"
                  disabled={catalogPage >= catalogTotalPages}
                  onClick={() => setCatalogPage((p) => p + 1)}
                >
                  Next
                  <FiChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----------------- Bottom Bento Grid (Visily 1:1 Layout) ----------------- */}
      {activeTab === 'history' && (
        <div className="inv-bento-grid">
          {/* Left Panel: Critical Stock Watchlist */}
          <div className="inv-bento-card">
            <div className="inv-bento-head">
              <div>
                <div className="inv-bento-title">Critical Stock Watchlist</div>
                <div className="inv-bento-sub">Stock units requiring replenishment below minimum threshold</div>
              </div>
              <button
                className="inv-btn inv-btn-secondary inv-btn-sm"
                onClick={() => setActiveTab('alerts')}
              >
                View All Alerts ({criticalAlerts.length})
              </button>
            </div>

            <div className="inv-critical-list">
              {criticalAlerts.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--inv-text-muted)', padding: '12px 0' }}>
                  No critical stock items right now.
                </div>
              ) : (
                criticalAlerts.slice(0, 3).map((item) => (
                  <div key={item._id} className="inv-critical-item">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--inv-text-title)' }}>
                        {item.name}
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--inv-text-muted)' }}>{item.sku}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 700, color: '#e11d48', fontVariantNumeric: 'tabular-nums' }}>
                        {item.stock} / {item.minimumStock} units
                      </span>
                      <span className="inv-kpi-pill inv-kpi-pill-critical">Critical</span>
                      <button
                        className="inv-btn inv-btn-primary inv-btn-sm"
                        onClick={() => openModal('in', item._id)}
                      >
                        Restock
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Panel: Daily Audit Reconciliation Card */}
          <div className="inv-audit-card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="inv-audit-badge">
                <FiCheckCircle size={13} color="#10b981" />
                Audit Status
              </div>
              <div className="inv-audit-title">Stock Audit Ready</div>
              <div className="inv-audit-rate">
                <strong>{stats.accuracyRate || 100}% catalog accuracy</strong> recorded across active inventory clusters.
              </div>
            </div>

            <div className="inv-audit-actions">
              <button className="inv-btn inv-btn-audit-white" onClick={() => openModal('adjust')}>
                <FiSliders size={14} />
                Reconcile Cycle Count
              </button>
              <button className="inv-btn inv-btn-audit-ghost" onClick={handleExportCsv}>
                <FiDownload size={14} />
                Download Audit Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- Action Modals (With Real Data & Live Calculation) ----------------- */}
      {modalMode && (
        <div className="inv-modal-overlay" onClick={closeModal}>
          <div className="inv-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="inv-modal-header">
              <div className="inv-modal-title">
                {modalMode === 'adjust' && <><FiSliders color="var(--inv-teal)" /> Reconcile Stock Adjustment</>}
                {modalMode === 'in' && <><FiPlus color="var(--inv-teal)" /> Record Inbound Stock</>}
                {modalMode === 'out' && <><FiMinus color="var(--inv-indigo)" /> Record Outbound Dispatch</>}
                {modalMode === 'damaged' && <><FiAlertTriangle color="var(--inv-rose)" /> Record Damaged Goods</>}
              </div>
              <button className="inv-modal-close" onClick={closeModal} disabled={submitting} aria-label="Close modal">
                <FiX />
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="inv-modal-body">
                {/* Product Selection */}
                <div className="inv-form-group">
                  <label className="inv-form-label">
                    Select Product <span>(required)</span>
                  </label>
                  <select
                    className="inv-form-select"
                    value={form.productId}
                    onChange={(e) => setForm({ ...form, productId: e.target.value })}
                    required
                  >
                    <option value="">-- Choose item from catalog --</option>
                    {productsList.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.sku}) — In Stock: {p.stock}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stock Adjustment Specific Fields */}
                {modalMode === 'adjust' && (
                  <>
                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        Counted Physical Stock <span>(actual units counted)</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="inv-form-input"
                        placeholder="e.g. 48"
                        value={form.newQuantity}
                        onChange={(e) => setForm({ ...form, newQuantity: e.target.value })}
                        required
                      />
                    </div>

                    {selectedProduct && form.newQuantity !== '' && (
                      <div className="inv-differential-banner">
                        <div>
                          System Stock: <strong>{selectedProduct.stock}</strong> units
                        </div>
                        <div>
                          Discrepancy:{' '}
                          <strong
                            style={{
                              color:
                                Number(form.newQuantity) - selectedProduct.stock >= 0 ? '#059669' : '#e11d48',
                            }}
                          >
                            {Number(form.newQuantity) - selectedProduct.stock >= 0 ? '+' : ''}
                            {Number(form.newQuantity) - selectedProduct.stock} units
                          </strong>
                        </div>
                      </div>
                    )}

                    <div className="inv-form-group">
                      <label className="inv-form-label">Adjustment Reason</label>
                      <select
                        className="inv-form-select"
                        value={form.reason}
                        onChange={(e) => setForm({ ...form, reason: e.target.value })}
                      >
                        <option value="Cycle Count Variance">Cycle Count Variance</option>
                        <option value="Physical Audit Reconciliation">Physical Audit Reconciliation</option>
                        <option value="Found Unrecorded Stock">Found Unrecorded Stock (+)</option>
                        <option value="Shrinkage / Unaccounted Discrepancy">Shrinkage / Unaccounted Discrepancy (-)</option>
                        <option value="Clerical Correction">Clerical Correction</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Stock In Specific Fields */}
                {modalMode === 'in' && (
                  <>
                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        Quantity to Add <span>(units)</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="inv-form-input"
                        placeholder="e.g. 50"
                        value={form.quantity}
                        onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                        required
                      />
                    </div>

                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        Unit Cost ($) <span>(optional — updates Weighted Average Cost / AVCO)</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="inv-form-input"
                        placeholder={selectedProduct?.cost ? `Current: $${Number(selectedProduct.cost).toFixed(2)}` : 'e.g. 15.50'}
                        value={form.unitCost || ''}
                        onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                      />
                    </div>

                    {selectedProduct && form.quantity > 0 && (
                      <div className="inv-differential-banner">
                        <span>Current Stock: {selectedProduct.stock}</span>
                        <span>New Total: <strong>{selectedProduct.stock + Number(form.quantity)} units</strong></span>
                      </div>
                    )}

                    {/* Dynamic Real Supplier Selector from Shanza's module */}
                    {suppliersList.length > 0 && (
                      <div className="inv-form-group">
                        <label className="inv-form-label">
                          Supplier <span>(optional)</span>
                        </label>
                        <select
                          className="inv-form-select"
                          value={form.supplierId || ''}
                          onChange={(e) => {
                            const selectedSup = suppliersList.find((s) => s._id === e.target.value);
                            setForm({
                              ...form,
                              supplierId: e.target.value,
                              reference: selectedSup ? `Delivery from ${selectedSup.name} (${selectedSup.company || ''})` : form.reference,
                            });
                          }}
                        >
                          <option value="">-- Select Registered Supplier --</option>
                          {suppliersList.map((s) => (
                            <option key={s._id} value={s._id}>
                              {s.name} {s.company ? `(${s.company})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        PO / Delivery Reference <span>(optional)</span>
                      </label>
                      <input
                        type="text"
                        className="inv-form-input"
                        placeholder="e.g. PO-8834 or Delivery Note"
                        value={form.reference}
                        onChange={(e) => setForm({ ...form, reference: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {/* Stock Out Specific Fields */}
                {modalMode === 'out' && (
                  <>
                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        Quantity to Deduct <span>(units)</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        max={selectedProduct ? selectedProduct.stock : undefined}
                        className="inv-form-input"
                        placeholder="e.g. 10"
                        value={form.quantity}
                        onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                        required
                      />
                    </div>

                    {selectedProduct && form.quantity > 0 && (
                      <div className="inv-differential-banner">
                        <span>Available: {selectedProduct.stock} units</span>
                        <span>
                          Remaining:{' '}
                          <strong style={{ color: selectedProduct.stock - Number(form.quantity) < 0 ? '#e11d48' : '#059669' }}>
                            {selectedProduct.stock - Number(form.quantity)} units
                          </strong>
                        </span>
                      </div>
                    )}

                    <div className="inv-form-group">
                      <label className="inv-form-label">Purpose / Dispatch Reason</label>
                      <input
                        type="text"
                        className="inv-form-input"
                        placeholder="e.g. Store transfer, demo unit, sample"
                        value={form.reference}
                        onChange={(e) => setForm({ ...form, reference: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {/* Damaged Stock Specific Fields */}
                {modalMode === 'damaged' && (
                  <>
                    <div className="inv-form-group">
                      <label className="inv-form-label">
                        Quantity Damaged <span>(units to write off)</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        max={selectedProduct ? selectedProduct.stock : undefined}
                        className="inv-form-input"
                        placeholder="e.g. 3"
                        value={form.quantity}
                        onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                        required
                      />
                    </div>

                    <div className="inv-form-group">
                      <label className="inv-form-label">Damage Classification</label>
                      <select
                        className="inv-form-select"
                        value={form.reason}
                        onChange={(e) => setForm({ ...form, reason: e.target.value })}
                      >
                        <option value="Damaged in Warehouse Storage">Damaged in Warehouse Storage</option>
                        <option value="Broken in Transit / Handling">Broken in Transit / Handling</option>
                        <option value="Expired / Past Shelf Life">Expired / Past Shelf Life</option>
                        <option value="Defective from Supplier">Defective from Supplier</option>
                        <option value="Water / Environmental Damage">Water / Environmental Damage</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Optional Notes */}
                <div className="inv-form-group">
                  <label className="inv-form-label">Additional Notes</label>
                  <textarea
                    className="inv-form-textarea"
                    placeholder="Provide any relevant forensic context or audit notes..."
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="inv-modal-footer">
                <button type="button" className="inv-btn inv-btn-secondary" onClick={closeModal} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="inv-btn inv-btn-primary" disabled={submitting}>
                  {submitting ? 'Processing...' : 'Confirm Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- Forensic Product Stock Audit Modal (Section 4 Exemplar) ----------------- */}
      {auditModal.open && (
        <div className="inv-modal-overlay" onClick={closeProductAudit}>
          <div className="inv-modal inv-modal-wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="inv-modal-header">
              <div className="inv-modal-title">
                <FiActivity color="var(--inv-teal)" size={18} />
                <span>Forensic Stock Audit & Movement Breakdown</span>
              </div>
              <button className="inv-modal-close" onClick={closeProductAudit} aria-label="Close modal">
                <FiX />
              </button>
            </div>

            <div className="inv-modal-body">
              {auditModal.loading ? (
                <div style={{ padding: '36px', textAlign: 'center' }}>
                  <div className="inv-skeleton" style={{ height: '32px', marginBottom: '16px' }} />
                  <div className="inv-skeleton" style={{ height: '120px', marginBottom: '16px' }} />
                  <div className="inv-skeleton" style={{ height: '200px' }} />
                </div>
              ) : auditModal.audit ? (
                <>
                  {/* Product Header Banner */}
                  <div className="inv-audit-prod-banner">
                    <div className="inv-audit-prod-info">
                      <div className="inv-prod-thumb" style={{ width: '48px', height: '48px', fontSize: '18px' }}>
                        {auditModal.product?.image ? (
                          <img
                            src={resolveImageUrl(auditModal.product.image)}
                            alt={auditModal.product.name}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          auditModal.product?.name?.[0]?.toUpperCase() || 'P'
                        )}
                      </div>
                      <div>
                        <h3 className="inv-audit-prod-title">{auditModal.product?.name}</h3>
                        <div className="inv-audit-prod-meta">
                          <span>SKU: <strong>{auditModal.product?.sku}</strong></span>
                          <span>•</span>
                          <span>Category: <strong>{auditModal.product?.category?.name || 'General'}</strong></span>
                          <span>•</span>
                          <span>
                            Unit Cost:{' '}
                            <strong>
                              ${Number(auditModal.product?.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="inv-audit-stock-badge">
                      <span className="inv-audit-stock-label">Current Stock On Hand</span>
                      <span className="inv-audit-stock-val">{auditModal.audit.currentStock} units</span>
                    </div>
                  </div>

                  {/* Section 4 Reconciliation Formula Banner */}
                  <div className="inv-equation-banner">
                    <div className="inv-equation-title">
                      <FiFileText size={14} />
                      Section 4 Inventory Audit Balance Formula:
                    </div>
                    <div className="inv-equation-formula">
                      <span className="inv-eq-term">Opening ({auditModal.audit.openingStock})</span>
                      <span className="inv-eq-op">+</span>
                      <span className="inv-eq-term">Inbound ({auditModal.audit.totalInbound})</span>
                      <span className="inv-eq-op">-</span>
                      <span className="inv-eq-term">Sold ({auditModal.audit.totalSold})</span>
                      <span className="inv-eq-op">-</span>
                      <span className="inv-eq-term">Damaged ({auditModal.audit.totalDamaged})</span>
                      <span className="inv-eq-op">±</span>
                      <span className="inv-eq-term">
                        Adjustments ({auditModal.audit.netAdjustments >= 0 ? `+${auditModal.audit.netAdjustments}` : auditModal.audit.netAdjustments})
                      </span>
                      <span className="inv-eq-op">=</span>
                      <span className="inv-eq-result">
                        Current Stock ({auditModal.audit.currentStock})
                      </span>
                    </div>
                  </div>

                  {/* 6-Card KPI Breakdown Grid */}
                  <div className="inv-audit-kpi-grid">
                    <div className="inv-audit-kpi-box">
                      <span className="inv-audit-kpi-lbl">Opening Stock</span>
                      <span className="inv-audit-kpi-num" style={{ color: '#475569' }}>
                        {auditModal.audit.openingStock}
                      </span>
                      <span className="inv-audit-kpi-sub">Baseline recorded</span>
                    </div>
                    <div className="inv-audit-kpi-box">
                      <span className="inv-audit-kpi-lbl">Total Inbound</span>
                      <span className="inv-audit-kpi-num" style={{ color: '#059669' }}>
                        +{auditModal.audit.totalInbound}
                      </span>
                      <span className="inv-audit-kpi-sub">PO deliveries & stock-in</span>
                    </div>
                    <div className="inv-audit-kpi-box">
                      <span className="inv-audit-kpi-lbl">Total Sold</span>
                      <span className="inv-audit-kpi-num" style={{ color: '#4f46e5' }}>
                        -{auditModal.audit.totalSold}
                      </span>
                      <span className="inv-audit-kpi-sub">Customer invoices</span>
                    </div>
                    <div className="inv-audit-kpi-box">
                      <span className="inv-audit-kpi-lbl">Total Damaged</span>
                      <span className="inv-audit-kpi-num" style={{ color: '#e11d48' }}>
                        -{auditModal.audit.totalDamaged}
                      </span>
                      <span className="inv-audit-kpi-sub">Written off defectives</span>
                    </div>
                    <div className="inv-audit-kpi-box">
                      <span className="inv-audit-kpi-lbl">Net Adjustments</span>
                      <span
                        className="inv-audit-kpi-num"
                        style={{ color: auditModal.audit.netAdjustments >= 0 ? '#059669' : '#d97706' }}
                      >
                        {auditModal.audit.netAdjustments >= 0 ? `+${auditModal.audit.netAdjustments}` : auditModal.audit.netAdjustments}
                      </span>
                      <span className="inv-audit-kpi-sub">Cycle counts & clerical</span>
                    </div>
                    <div className="inv-audit-kpi-box" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                      <span className="inv-audit-kpi-lbl">Live Physical Stock</span>
                      <span className="inv-audit-kpi-num" style={{ color: '#15803d', fontWeight: 800 }}>
                        {auditModal.audit.currentStock}
                      </span>
                      <span className="inv-audit-kpi-sub">Warehouse verified</span>
                    </div>
                  </div>

                  {/* Audit Discrepancy Status */}
                  <div
                    className={`inv-audit-status-banner ${
                      (auditModal.audit.auditDiscrepancy ?? 0) === 0 ? 'inv-status-balanced' : 'inv-status-unbalanced'
                    }`}
                  >
                    {(auditModal.audit.auditDiscrepancy ?? 0) === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FiCheckCircle size={16} color="#059669" />
                        <span>
                          <strong>Forensic Reconciliation Balanced:</strong> Cumulative movement ledger balances exactly with live stock on hand (0 unit discrepancy).
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FiAlertTriangle size={16} color="#d97706" />
                        <span>
                          <strong>Discrepancy Detected:</strong> Ledger calculation expected {auditModal.audit.expectedStock ?? (auditModal.audit.openingStock + auditModal.audit.totalInbound - auditModal.audit.totalSold - auditModal.audit.totalDamaged + (auditModal.audit.netAdjustments || auditModal.audit.totalAdjustments || 0))} units, but physical stock is recorded as {auditModal.audit.currentStock} units ({auditModal.audit.auditDiscrepancy > 0 ? `+${auditModal.audit.auditDiscrepancy}` : auditModal.audit.auditDiscrepancy} unit variance).
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Transaction Timeline Table for this Product */}
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13.5px', marginBottom: '8px', color: 'var(--inv-text-title)' }}>
                      Recent Product Transaction Ledger ({auditModal.history?.length || 0} entries)
                    </div>
                    <div className="inv-table-scroll" style={{ maxHeight: '240px' }}>
                      <table className="inv-table">
                        <thead>
                          <tr>
                            <th>Reference</th>
                            <th>Type</th>
                            <th>Change</th>
                            <th>Reason / Reference</th>
                            <th>Operator</th>
                            <th>Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditModal.history.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: 'var(--inv-text-muted)' }}>
                                No ledger transactions logged for this product.
                              </td>
                            </tr>
                          ) : (
                            auditModal.history.map((h) => {
                              const diff = h.differential !== undefined
                                ? h.differential
                                : h.quantityChange !== undefined
                                ? h.quantityChange
                                : (['stock_out', 'damaged', 'sale', 'expired', 'purchase_return', 'transfer_out'].includes(h.type)
                                    ? -Math.abs(h.quantity)
                                    : h.type === 'adjustment'
                                    ? (h.currentStock - h.previousStock)
                                    : Math.abs(h.quantity));
                              return (
                                <tr key={h._id}>
                                  <td>{renderRefPill(h.reference || h.trxCode)}</td>
                                  <td>{renderVectorBadge(h.type)}</td>
                                  <td>
                                    <span className={`inv-diff ${diff > 0 ? 'inv-diff-pos' : diff < 0 ? 'inv-diff-neg' : 'inv-diff-neutral'}`}>
                                      {diff > 0 ? `+${diff}` : diff}
                                    </span>
                                  </td>
                                  <td>
                                    <span style={{ fontSize: '12.5px' }}>{h.notes || h.reference || 'Movement'}</span>
                                  </td>
                                  <td>
                                    <span style={{ fontSize: '12px', color: 'var(--inv-text-muted)' }}>
                                      {h.performedBy?.name || 'Staff User'}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
                                    {new Date(h.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--inv-text-muted)' }}>
                  Unable to load product audit details.
                </div>
              )}
            </div>

            <div className="inv-modal-footer">
              <button type="button" className="inv-btn inv-btn-secondary" onClick={closeProductAudit}>
                Close
              </button>
              {auditModal.product && (
                <>
                  <button
                    type="button"
                    className="inv-btn inv-btn-secondary"
                    onClick={() => {
                      const pid = auditModal.product._id;
                      closeProductAudit();
                      openModal('adjust', pid);
                    }}
                  >
                    <FiSliders size={14} />
                    Reconcile Physical Count
                  </button>
                  <button
                    type="button"
                    className="inv-btn inv-btn-primary"
                    onClick={() => {
                      const pid = auditModal.product._id;
                      closeProductAudit();
                      openModal('in', pid);
                    }}
                  >
                    <FiPlus size={14} />
                    Restock Product
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
