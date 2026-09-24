import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import PageHeader from '../components/PageHeader';
import { FiPlus, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const emptyItem = () => ({ productId: '', quantity: 1, cost: '' });

const getLocalToday = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createInitialForm = () => ({
  supplierId: '',
  purchaseDate: getLocalToday(),
  status: 'ordered',
  paymentStatus: 'pending',
  notes: '',
  items: [emptyItem()],
});

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [originalStatus, setOriginalStatus] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [form, setForm] = useState(createInitialForm);

  const hasActiveFilters = Boolean(
    supplierFilter || statusFilter || paymentStatusFilter || startDate || endDate
  );

  useEffect(() => {
    Promise.all([
      api.get('/suppliers', { params: { limit: 500 } }),
      api.get('/products', { params: { limit: 500 } }),
    ])
      .then(([suppliersRes, productsRes]) => {
        setSuppliers(suppliersRes.data?.suppliers || []);
        setProducts(productsRes.data?.products || []);
      })
      .catch(() => toast.error('Failed to load suppliers or products'));
  }, []);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (supplierFilter) params.supplier = supplierFilter;
      if (statusFilter) params.status = statusFilter;
      if (paymentStatusFilter) params.paymentStatus = paymentStatusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get('/purchases', { params });
      setPurchases(res.data?.purchases || []);
      setTotalPages(res.data?.totalPages || 1);
      setTotal(res.data?.total || 0);
    } catch {
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [page, supplierFilter, statusFilter, paymentStatusFilter, startDate, endDate]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const clearFilters = () => {
    setSupplierFilter('');
    setStatusFilter('');
    setPaymentStatusFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const openDetails = async (purchase) => {
    setSelectedPurchase({ ...purchase });
    setOriginalStatus(purchase.status);
    setDetailLoading(true);
    try {
      const res = await api.get(`/purchases/${purchase._id}`);
      if (res.data?.purchase) {
        setSelectedPurchase(res.data.purchase);
        setOriginalStatus(res.data.purchase.status);
      }
    } catch {
      toast.error('Failed to load full purchase order details');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetails = () => {
    setSelectedPurchase(null);
    setOriginalStatus(null);
  };

  const updateItem = (index, field, value) => {
    if (field === 'productId' && value) {
      const duplicateIndex = form.items.findIndex(
        (item, idx) => idx !== index && item.productId === value
      );
      if (duplicateIndex !== -1) {
        const currentQty = Number(form.items[index]?.quantity) || 1;
        const mergedItems = form.items
          .map((item, idx) =>
            idx === duplicateIndex
              ? { ...item, quantity: (Number(item.quantity) || 0) + currentQty }
              : item
          )
          .filter((_, idx) => idx !== index);
        setForm({
          ...form,
          items: mergedItems.length > 0 ? mergedItems : [emptyItem()],
        });
        toast.info('Merged duplicate product into existing row');
        return;
      }
    }

    const nextItems = form.items.map((item, idx) => {
      if (idx !== index) return item;
      const updatedItem = { ...item, [field]: value };
      if (field === 'productId' && value) {
        const selectedProduct = products.find((p) => p._id === value);
        if (selectedProduct) {
          updatedItem.cost = selectedProduct.cost ?? '';
          if (!updatedItem.quantity) updatedItem.quantity = 1;
        }
      }
      return updatedItem;
    });

    setForm({ ...form, items: nextItems });
  };

  const addItemRow = () => {
    setForm({ ...form, items: [...form.items, emptyItem()] });
  };

  const removeItemRow = (index) => {
    if (form.items.length === 1) {
      setForm({ ...form, items: [emptyItem()] });
      return;
    }
    setForm({
      ...form,
      items: form.items.filter((_, idx) => idx !== index),
    });
  };

  const orderTotalPreview = form.items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.cost) || 0;
    return sum + (qty > 0 && cost >= 0 ? qty * cost : 0);
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!form.supplierId) {
      toast.error('Please select a supplier');
      return;
    }

    const mergedMap = new Map();
    for (const item of form.items) {
      if (!item.productId) continue;
      const qty = Number(item.quantity);
      const cost = Number(item.cost);
      if (!Number.isFinite(qty) || qty <= 0) {
        toast.error('Each product must have a quantity of at least 1');
        return;
      }
      if (!Number.isFinite(cost) || cost < 0) {
        toast.error('Each product must have a valid unit cost');
        return;
      }
      if (mergedMap.has(item.productId)) {
        const existing = mergedMap.get(item.productId);
        existing.quantity += qty;
        existing.cost = cost;
      } else {
        mergedMap.set(item.productId, {
          productId: item.productId,
          quantity: qty,
          cost,
        });
      }
    }

    const items = Array.from(mergedMap.values());
    if (!items.length) {
      toast.error('Please add at least one product');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/purchases', {
        supplierId: form.supplierId,
        purchaseDate: form.purchaseDate,
        status: form.status,
        paymentStatus: form.paymentStatus,
        notes: form.notes.trim(),
        items,
      });

      toast.success('Purchase order created');
      setShowModal(false);
      setForm(createInitialForm());
      window.dispatchEvent(new Event('notifications-updated'));
      fetchPurchases();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  const markAsReceived = async (purchaseId) => {
    if (updatingId) return;
    setUpdatingId(purchaseId);
    try {
      await api.put(`/purchases/${purchaseId}/status`, { status: 'received' });
      toast.success('Purchase marked as received');
      window.dispatchEvent(new Event('notifications-updated'));
      fetchPurchases();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update purchase status');
    } finally {
      setUpdatingId(null);
    }
  };

  const updateSelectedPurchase = async (e) => {
    e.preventDefault();
    if (!selectedPurchase || updatingId) return;

    setUpdatingId(selectedPurchase._id);
    try {
      await api.put(`/purchases/${selectedPurchase._id}/status`, {
        status: selectedPurchase.status,
        paymentStatus: selectedPurchase.paymentStatus,
        notes: selectedPurchase.notes || '',
      });

      toast.success('Purchase updated');
      closeDetails();
      window.dispatchEvent(new Event('notifications-updated'));
      fetchPurchases();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update purchase');
    } finally {
      setUpdatingId(null);
    }
  };

  const isStatusLocked =
    originalStatus === 'received' || originalStatus === 'cancelled';

  return (
    <div>
      <style>{`
        .btn-success {
          background: var(--success);
          color: #ffffff;
        }
        .btn-success:hover:not(:disabled) {
          filter: brightness(0.92);
        }
        .btn-success:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>

      <PageHeader
        title="Purchase Orders"
        subtitle={`Create and track supplier purchase orders and stock receipts${total > 0 ? ` (${total} total)` : ''}`}
        actions={
          <button
            className="btn btn-primary"
            onClick={() => {
              setForm(createInitialForm());
              setShowModal(true);
            }}
          >
            <FiPlus /> Create Purchase Order
          </button>
        }
      />

      <div className="ui-filter-bar">
        <select
          className="ui-filter-input"
          value={supplierFilter}
          onChange={(e) => {
            setSupplierFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s._id} value={s._id}>
              {s.company ? `${s.company} (${s.name})` : s.name}
            </option>
          ))}
        </select>

        <select
          className="ui-filter-input"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Order Statuses</option>
          <option value="ordered">Ordered</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          className="ui-filter-input"
          value={paymentStatusFilter}
          onChange={(e) => {
            setPaymentStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Payment Statuses</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
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

      <div className="ui-table-card">
        <table>
          <thead>
            <tr>
              <th>Order #</th>
              <th>Supplier</th>
              <th>Date</th>
              <th>Items</th>
              <th>Total Cost</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="loading">
                  Loading purchase orders...
                </td>
              </tr>
            ) : purchases.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: 32, color: 'var(--text-light)' }}>
                  {hasActiveFilters
                    ? 'No purchase orders match the selected filters'
                    : 'No purchase orders found'}
                </td>
              </tr>
            ) : (
              purchases.map((p) => (
                <tr key={p._id}>
                  <td style={{ fontWeight: 600 }}>{p.orderNumber}</td>
                  <td>
                    {p.supplier?.company
                      ? `${p.supplier.company} (${p.supplier.name})`
                      : p.supplier?.name || '-'}
                  </td>
                  <td>{new Date(p.purchaseDate).toLocaleDateString()}</td>
                  <td>{(p.items || []).length}</td>
                  <td style={{ fontWeight: 600 }}>
                    ${Number(p.totalCost || 0).toFixed(2)}
                  </td>
                  <td>
                    <span
                      className={`badge badge-${
                        p.paymentStatus === 'paid'
                          ? 'success'
                          : p.paymentStatus === 'partial'
                          ? 'info'
                          : 'warning'
                      }`}
                    >
                      {p.paymentStatus}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge badge-${
                        p.status === 'received'
                          ? 'success'
                          : p.status === 'cancelled'
                          ? 'danger'
                          : 'info'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => openDetails(p)}
                      >
                        Details
                      </button>
                      {p.status === 'ordered' && (
                        <button
                          className="btn btn-success"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          disabled={updatingId === p._id}
                          onClick={() => markAsReceived(p._id)}
                        >
                          {updatingId === p._id ? 'Receiving...' : 'Mark Received'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!loading && purchases.length > 0 && (
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
              Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total} purchase orders
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <FiChevronLeft size={14} /> Previous
              </button>
              <span style={{ fontSize: 14, color: 'var(--text-light)' }}>
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

      {selectedPurchase && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={closeDetails}
        >
          <div
            className="card"
            style={{ width: 760, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', marginBottom: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>Purchase Details</h2>
                {detailLoading && (
                  <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
                    Refreshing details...
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeDetails}
              >
                Close
              </button>
            </div>

            <form onSubmit={updateSelectedPurchase}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Order Number</label>
                  <input value={selectedPurchase.orderNumber || ''} disabled />
                </div>
                <div className="form-group">
                  <label>Supplier</label>
                  <input
                    value={
                      selectedPurchase.supplier?.company
                        ? `${selectedPurchase.supplier.company} (${selectedPurchase.supplier.name})`
                        : selectedPurchase.supplier?.name || '-'
                    }
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label>Supplier Contact</label>
                  <input
                    value={
                      [selectedPurchase.supplier?.phone, selectedPurchase.supplier?.email]
                        .filter(Boolean)
                        .join(' • ') || '—'
                    }
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label>Created By</label>
                  <input value={selectedPurchase.createdBy?.name || 'System'} disabled />
                </div>
                <div className="form-group">
                  <label>Purchase Date</label>
                  <input
                    value={
                      selectedPurchase.purchaseDate
                        ? new Date(selectedPurchase.purchaseDate).toLocaleDateString()
                        : '-'
                    }
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label>Total Cost</label>
                  <input
                    value={`$${Number(selectedPurchase.totalCost || 0).toFixed(2)}`}
                    disabled
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>
                    Status{' '}
                    {isStatusLocked && (
                      <span style={{ fontSize: 12, color: 'var(--text-light)', fontWeight: 400 }}>
                        (Locked: {originalStatus})
                      </span>
                    )}
                  </label>
                  <select
                    value={selectedPurchase.status}
                    disabled={isStatusLocked}
                    onChange={(e) =>
                      setSelectedPurchase({ ...selectedPurchase, status: e.target.value })
                    }
                  >
                    <option value="ordered" disabled={isStatusLocked}>
                      Ordered
                    </option>
                    <option value="received" disabled={originalStatus === 'cancelled'}>
                      Received
                    </option>
                    <option value="cancelled" disabled={originalStatus === 'received'}>
                      Cancelled
                    </option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Payment Status</label>
                  <select
                    value={selectedPurchase.paymentStatus}
                    onChange={(e) =>
                      setSelectedPurchase({
                        ...selectedPurchase,
                        paymentStatus: e.target.value,
                      })
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  rows={3}
                  value={selectedPurchase.notes || ''}
                  onChange={(e) =>
                    setSelectedPurchase({ ...selectedPurchase, notes: e.target.value })
                  }
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 8 }}>Items</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Cost</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedPurchase.items || []).map((item, index) => (
                      <tr key={index}>
                        <td>{item.name}</td>
                        <td>{item.quantity}</td>
                        <td>${Number(item.cost || 0).toFixed(2)}</td>
                        <td>${Number(item.total || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeDetails}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updatingId === selectedPurchase._id}
                >
                  {updatingId === selectedPurchase._id ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => !submitting && setShowModal(false)}
        >
          <div
            className="card"
            style={{ width: 760, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', marginBottom: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: 16 }}>Create Purchase Order</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Supplier *</label>
                  <select
                    value={form.supplierId}
                    onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                    required
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier._id} value={supplier._id}>
                        {supplier.name} ({supplier.company || 'No company'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Purchase Date *</label>
                  <input
                    type="date"
                    value={form.purchaseDate}
                    onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Initial Order Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="ordered">Ordered (Receive Later)</option>
                    <option value="received">Received Immediately (Add to Stock)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Payment Status</label>
                  <select
                    value={form.paymentStatus}
                    onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <strong>Products</strong>
                  <button type="button" className="btn btn-secondary" onClick={addItemRow}>
                    + Add Item
                  </button>
                </div>

                {form.items.map((item, index) => {
                  const lineTotal =
                    (Number(item.quantity) || 0) * (Number(item.cost) || 0);
                  return (
                    <div
                      key={index}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr auto auto',
                        gap: 8,
                        alignItems: 'center',
                        marginBottom: 10,
                      }}
                    >
                      <select
                        value={item.productId}
                        onChange={(e) => updateItem(index, 'productId', e.target.value)}
                        required
                      >
                        <option value="">Select product</option>
                        {products.map((product) => {
                          const alreadyChosen = form.items.some(
                            (other, idx) =>
                              idx !== index && other.productId === product._id
                          );
                          return (
                            <option
                              key={product._id}
                              value={product._id}
                              disabled={alreadyChosen}
                            >
                              {product.name} ({product.stock} in stock)
                              {alreadyChosen ? ' — Already added' : ''}
                            </option>
                          );
                        })}
                      </select>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        required
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Unit Cost"
                        value={item.cost}
                        onChange={(e) => updateItem(index, 'cost', e.target.value)}
                        required
                      />
                      <span
                        style={{
                          minWidth: 80,
                          textAlign: 'right',
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        ${lineTotal.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => removeItemRow(index)}
                        style={{ padding: '8px 10px' }}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: 12,
                    paddingTop: 10,
                    borderTop: '1px solid var(--border)',
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  <span>Order Total Preview:</span>
                  <span style={{ color: 'var(--primary)' }}>
                    ${orderTotalPreview.toFixed(2)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={submitting}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
