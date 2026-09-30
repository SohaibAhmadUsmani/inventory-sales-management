import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import PageHeader from '../components/PageHeader';
import useDebounce from '../hooks/useDebounce';
import {
  FiDownload,
  FiEye,
  FiPrinter,
  FiX,
  FiXCircle,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';

const money = (n) =>
  `$${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [customerFilter, setCustomerFilter] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [selectedSale, setSelectedSale] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [cancellingId, setCancellingId] = useState(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [printingSale, setPrintingSale] = useState(null);

  const hasActiveFilters = Boolean(
    search || customerFilter || paymentMethod || status || startDate || endDate
  );

  useEffect(() => {
    api
      .get('/customers', { params: { limit: 500 } })
      .then((res) => setCustomers(res.data?.customers || []))
      .catch(() => {});
  }, []);

  const fetchDailySummary = useCallback(() => {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    api
      .get('/sales/daily', { params })
      .then((res) => setDailySales(res.data?.sales || []))
      .catch(() => setDailySales([]));
  }, [startDate, endDate]);

  const fetchSales = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { page, limit: 10 };
    if (debouncedSearch) params.search = debouncedSearch;
    if (customerFilter) params.customer = customerFilter;
    if (paymentMethod) params.paymentMethod = paymentMethod;
    if (status) params.status = status;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    api
      .get('/sales', { params })
      .then((res) => {
        setSales(res.data?.sales || []);
        setTotalPages(res.data?.totalPages || 1);
        setTotal(res.data?.total || 0);
      })
      .catch((err) =>
        setError(err.response?.data?.message || 'Failed to load sales')
      )
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, customerFilter, paymentMethod, status, startDate, endDate]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  useEffect(() => {
    fetchDailySummary();
  }, [fetchDailySummary]);

  const clearFilters = () => {
    setSearch('');
    setCustomerFilter('');
    setPaymentMethod('');
    setStatus('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const viewSale = (saleId) => {
    setSelectedSale(null);
    setDetailError(null);
    setDetailLoading(true);
    api
      .get(`/sales/${saleId}`)
      .then((res) => setSelectedSale(res.data.sale))
      .catch((err) =>
        setDetailError(
          err.response?.data?.message || 'Failed to load sale details'
        )
      )
      .finally(() => setDetailLoading(false));
  };

  const closeDetail = () => {
    setSelectedSale(null);
    setDetailError(null);
  };

  const handleCancelSale = async (sale) => {
    if (!sale || sale.status !== 'completed') return;
    if (
      !window.confirm(
        `Cancel sale ${sale.invoiceNumber}? This will restore product stock and reverse customer spending.`
      )
    ) {
      return;
    }
    setCancellingId(sale._id);
    try {
      const res = await api.put(`/sales/${sale._id}/cancel`);
      toast.success('Sale cancelled and stock restored');
      fetchSales();
      fetchDailySummary();
      if (selectedSale && selectedSale._id === sale._id) {
        setSelectedSale((prev) =>
          prev ? { ...prev, ...(res.data?.sale || {}), status: 'cancelled' } : null
        );
      }
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel sale');
    } finally {
      setCancellingId(null);
    }
  };

  const downloadInvoice = async (saleId, invoiceNumber) => {
    setDownloadingInvoice(true);
    try {
      const res = await api.get(`/sales/${saleId}/invoice`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(
        new Blob([res.data], { type: 'application/pdf' })
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = invoiceNumber ? `${invoiceNumber}.pdf` : 'invoice.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download invoice');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const handlePrintReceipt = (sale) => {
    setPrintingSale(sale);
  };

  useEffect(() => {
    if (!printingSale) return;
    const timer = setTimeout(() => window.print(), 50);
    return () => clearTimeout(timer);
  }, [printingSale]);

  useEffect(() => {
    const handleAfterPrint = () => setPrintingSale(null);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const periodRevenue = dailySales.reduce(
    (sum, d) => sum + Number(d.totalSales || 0),
    0
  );
  const periodOrders = dailySales.reduce(
    (sum, d) => sum + Number(d.count || 0),
    0
  );
  const avgOrderValue = periodOrders > 0 ? periodRevenue / periodOrders : 0;

  return (
    <div>
      <style>{`
        #receipt-print-area {
          display: none;
        }
        @media print {
          .shell-sidebar,
          .shell-topbar,
          .sales-screen-area {
            display: none !important;
          }
          .shell-main,
          .shell-content {
            margin: 0 !important;
            padding: 0 !important;
          }
          #receipt-print-area {
            display: block !important;
            width: 100%;
            padding: 24px;
            background: white;
          }
          #receipt-print-area table {
            width: 100%;
            border-collapse: collapse;
          }
          #receipt-print-area th,
          #receipt-print-area td {
            padding: 6px 8px;
            border-bottom: 1px solid #e2e8f0;
            text-align: left;
            font-size: 13px;
          }
          #receipt-print-area th {
            background: #f1f5f9;
            font-weight: 600;
          }
        }
      `}</style>

      <div className="sales-screen-area">
        <PageHeader
          title="Sales History"
          subtitle={`View and manage all recorded transactions${total > 0 ? ` (${total} total)` : ''}`}
        />

        <div className="ui-summary-grid">
          <div className="ui-summary-item">
            <div className="ui-summary-label">Completed Revenue</div>
            <div className="ui-summary-value">{money(periodRevenue)}</div>
          </div>
          <div className="ui-summary-item">
            <div className="ui-summary-label">Completed Orders</div>
            <div className="ui-summary-value">{periodOrders.toLocaleString()}</div>
          </div>
          <div className="ui-summary-item">
            <div className="ui-summary-label">Avg. Order Value</div>
            <div className="ui-summary-value">{money(avgOrderValue)}</div>
          </div>
          <div className="ui-summary-item">
            <div className="ui-summary-label">Active Sales Days</div>
            <div className="ui-summary-value">{dailySales.length}</div>
          </div>
        </div>

        <div className="ui-filter-bar">
          <input
            className="ui-filter-input"
            placeholder="Search invoice number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="ui-filter-input"
            value={customerFilter}
            onChange={(e) => {
              setCustomerFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Customers</option>
            {customers.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
                {c.phone ? ` (${c.phone})` : ''}
              </option>
            ))}
          </select>
          <select
            className="ui-filter-input"
            value={paymentMethod}
            onChange={(e) => {
              setPaymentMethod(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Payment Methods</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="online">Online</option>
          </select>
          <select
            className="ui-filter-input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="returned">Returned</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input
            type="date"
            aria-label="Start date"
            className="ui-filter-input"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
          />
          <input
            type="date"
            aria-label="End date"
            className="ui-filter-input"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
          />
          {hasActiveFilters && (
            <button className="ui-btn-outline" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>

        {!loading && error && (
          <div
            className="ui-table-card"
            style={{ textAlign: 'center', color: 'var(--danger)', padding: 24 }}
          >
            <p style={{ marginBottom: 12 }}>{error}</p>
            <button className="btn btn-secondary" onClick={fetchSales}>
              Retry
            </button>
          </div>
        )}

        {!error && (
          <div className="ui-table-card">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="loading">
                      Loading sales...
                    </td>
                  </tr>
                ) : sales.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      style={{
                        textAlign: 'center',
                        padding: 40,
                        color: 'var(--text-light)',
                      }}
                    >
                      {hasActiveFilters
                        ? 'No sales match the selected filters'
                        : 'No sales records found'}
                    </td>
                  </tr>
                ) : (
                  sales.map((s) => (
                    <tr key={s._id}>
                      <td style={{ fontWeight: 600 }}>{s.invoiceNumber}</td>
                      <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                      <td>{s.customer?.name || 'Walk-in'}</td>
                      <td>{(s.items || []).length}</td>
                      <td style={{ fontWeight: 600 }}>{money(s.total)}</td>
                      <td>
                        <span className="badge badge-info">
                          {s.paymentMethod}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge badge-${
                            s.status === 'completed'
                              ? 'success'
                              : s.status === 'returned'
                              ? 'warning'
                              : 'danger'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 12px', fontSize: 12 }}
                            onClick={() => viewSale(s._id)}
                          >
                            <FiEye size={13} /> View
                          </button>
                          {s.status === 'completed' && (
                            <button
                              className="btn btn-danger"
                              style={{ padding: '4px 10px', fontSize: 12 }}
                              disabled={cancellingId === s._id}
                              onClick={() => handleCancelSale(s)}
                              title="Cancel sale and restore stock"
                            >
                              <FiXCircle size={13} />{' '}
                              {cancellingId === s._id ? 'Cancelling...' : 'Cancel Sale'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {!loading && sales.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 16,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--text-light)' }}>
                  Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of{' '}
                  {total} sales
                </span>
                <div
                  style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                >
                  <button
                    className="btn btn-secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <FiChevronLeft size={14} /> Previous
                  </button>
                  <span
                    style={{ fontSize: 14, color: 'var(--text-light)' }}
                  >
                    Page {page} of {totalPages}
                  </span>
                  <button
                    className="btn btn-secondary"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next <FiChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {detailLoading && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
            }}
          >
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <div className="loading" style={{ height: 'auto' }}>
                Loading sale details...
              </div>
            </div>
          </div>
        )}

        {detailError && !detailLoading && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
            }}
            onClick={closeDetail}
          >
            <div
              className="card"
              style={{ width: 400, maxWidth: '95vw', textAlign: 'center' }}
              onClick={(e) => e.stopPropagation()}
            >
              <p style={{ color: 'var(--danger)', marginBottom: 16 }}>
                {detailError}
              </p>
              <button className="btn btn-secondary" onClick={closeDetail}>
                Close
              </button>
            </div>
          </div>
        )}

        {selectedSale && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
            }}
            onClick={closeDetail}
          >
            <div
              className="card"
              style={{
                width: 650,
                maxWidth: '95vw',
                maxHeight: '85vh',
                overflow: 'auto',
                position: 'relative',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={closeDetail}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-light)',
                }}
              >
                <FiX size={20} />
              </button>

              <h2 style={{ marginBottom: 4, paddingRight: 32 }}>
                Sale Details
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--text-light)',
                  marginBottom: 16,
                }}
              >
                {selectedSale.invoiceNumber}
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-light)',
                      marginBottom: 2,
                    }}
                  >
                    Date
                  </div>
                  <div style={{ fontWeight: 500 }}>
                    {new Date(selectedSale.createdAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-light)',
                      marginBottom: 2,
                    }}
                  >
                    Customer
                  </div>
                  <div style={{ fontWeight: 500 }}>
                    {selectedSale.customer?.name || 'Walk-in'}
                  </div>
                  {selectedSale.customer?.phone && (
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                      {selectedSale.customer.phone}
                    </div>
                  )}
                  {selectedSale.customer?.email && (
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                      {selectedSale.customer.email}
                    </div>
                  )}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-light)',
                      marginBottom: 2,
                    }}
                  >
                    Payment Method
                  </div>
                  <span className="badge badge-info">
                    {selectedSale.paymentMethod}
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-light)',
                      marginBottom: 2,
                    }}
                  >
                    Payment Status
                  </div>
                  <span
                    className={`badge badge-${
                      selectedSale.paymentStatus === 'paid'
                        ? 'success'
                        : selectedSale.paymentStatus === 'pending'
                        ? 'warning'
                        : 'info'
                    }`}
                  >
                    {selectedSale.paymentStatus}
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-light)',
                      marginBottom: 2,
                    }}
                  >
                    Sale Status
                  </div>
                  <span
                    className={`badge badge-${
                      selectedSale.status === 'completed'
                        ? 'success'
                        : selectedSale.status === 'returned'
                        ? 'warning'
                        : 'danger'
                    }`}
                  >
                    {selectedSale.status}
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-light)',
                      marginBottom: 2,
                    }}
                  >
                    Salesperson
                  </div>
                  <div style={{ fontWeight: 500 }}>
                    {selectedSale.createdBy?.name || 'System'}
                  </div>
                </div>
              </div>

              <h3 style={{ fontSize: 14, marginBottom: 8 }}>Items</h3>
              <table style={{ marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedSale.items || []).map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.name}</td>
                      <td>{item.sku || '-'}</td>
                      <td>{item.quantity}</td>
                      <td>{money(item.price)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {money(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div
                style={{
                  borderTop: '2px solid var(--border)',
                  paddingTop: 12,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <span>Subtotal</span>
                  <span>{money(selectedSale.subtotal)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <span>Discount</span>
                  <span style={{ color: 'var(--danger)' }}>
                    -{money(selectedSale.discount)}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <span>Tax</span>
                  <span>+{money(selectedSale.tax)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 18,
                    fontWeight: 700,
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <span>Grand Total</span>
                  <span style={{ color: 'var(--primary)' }}>
                    {money(selectedSale.total)}
                  </span>
                </div>
              </div>

              {selectedSale.notes && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-light)',
                      marginBottom: 4,
                    }}
                  >
                    Notes
                  </div>
                  <div
                    style={{
                      background: 'var(--bg)',
                      padding: 12,
                      borderRadius: 8,
                      fontSize: 14,
                    }}
                  >
                    {selectedSale.notes}
                  </div>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                }}
              >
                {selectedSale.status === 'completed' && (
                  <button
                    className="btn btn-danger"
                    disabled={cancellingId === selectedSale._id}
                    onClick={() => handleCancelSale(selectedSale)}
                  >
                    <FiXCircle size={14} />{' '}
                    {cancellingId === selectedSale._id
                      ? 'Cancelling...'
                      : 'Cancel Sale'}
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    downloadInvoice(
                      selectedSale._id,
                      selectedSale.invoiceNumber
                    )
                  }
                  disabled={downloadingInvoice}
                >
                  <FiDownload size={14} />{' '}
                  {downloadingInvoice ? 'Downloading...' : 'Download Invoice'}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handlePrintReceipt(selectedSale)}
                >
                  <FiPrinter size={14} /> Print Receipt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {printingSale && (
        <div id="receipt-print-area">
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>SALE RECEIPT</h2>
            <p style={{ fontSize: 13, color: '#64748b' }}>
              {printingSale.invoiceNumber}
            </p>
          </div>

          <div
            style={{ borderTop: '1px dashed #94a3b8', margin: '12px 0' }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              marginBottom: 4,
            }}
          >
            <span>
              Date: {new Date(printingSale.createdAt).toLocaleString()}
            </span>
            {printingSale.customer?.name && (
              <span>Customer: {printingSale.customer.name}</span>
            )}
          </div>
          {printingSale.customer?.phone && (
            <div style={{ fontSize: 13, marginBottom: 4 }}>
              Phone: {printingSale.customer.phone}
            </div>
          )}

          <div
            style={{ borderTop: '1px dashed #94a3b8', margin: '12px 0' }}
          />

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {(printingSale.items || []).map((item, idx) => (
                <tr key={idx}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td style={{ textAlign: 'right' }}>{money(item.price)}</td>
                  <td style={{ textAlign: 'right' }}>{money(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div
            style={{ borderTop: '1px dashed #94a3b8', margin: '12px 0' }}
          />

          <div style={{ fontSize: 13 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <span>Subtotal</span>
              <span>{money(printingSale.subtotal)}</span>
            </div>
            {printingSale.discount > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span>Discount</span>
                <span>-{money(printingSale.discount)}</span>
              </div>
            )}
            {printingSale.tax > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span>Tax</span>
                <span>+{money(printingSale.tax)}</span>
              </div>
            )}

            <div
              style={{ borderTop: '1px dashed #94a3b8', margin: '12px 0' }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              <span>Total</span>
              <span>{money(printingSale.total)}</span>
            </div>
          </div>

          <div
            style={{ borderTop: '1px dashed #94a3b8', margin: '12px 0' }}
          />

          <div style={{ fontSize: 13, marginBottom: 4 }}>
            <div>Payment: {printingSale.paymentMethod?.toUpperCase()}</div>
            <div>Payment Status: {printingSale.paymentStatus}</div>
            <div>Status: {printingSale.status}</div>
          </div>

          <div
            style={{
              marginTop: 16,
              textAlign: 'center',
              fontSize: 11,
              color: '#64748b',
            }}
          >
            Thank you for your purchase!
          </div>
        </div>
      )}
    </div>
  );
}
