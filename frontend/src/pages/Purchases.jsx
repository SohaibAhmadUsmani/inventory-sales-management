import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

const emptyItem = () => ({ productId: '', quantity: '', cost: '' });

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [form, setForm] = useState({
    supplierId: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    paymentStatus: 'pending',
    notes: '',
    items: [emptyItem()],
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [purchasesRes, suppliersRes, productsRes] = await Promise.all([
        api.get('/purchases'),
        api.get('/suppliers', { params: { limit: 200 } }),
        api.get('/products', { params: { limit: 500 } }),
      ]);

      setPurchases(purchasesRes.data.purchases || []);
      setSuppliers(suppliersRes.data.suppliers || []);
      setProducts(productsRes.data.products || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load purchase data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateItem = (index, field, value) => {
    const nextItems = form.items.map((item, idx) => {
      if (idx !== index) return item;

      const updatedItem = { ...item, [field]: value };

      if (field === 'productId' && value) {
        const selectedProduct = products.find(product => product._id === value);
        if (selectedProduct) {
          updatedItem.cost = selectedProduct.cost ?? '';
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const items = form.items
        .filter(item => item.productId)
        .map(item => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          cost: Number(item.cost),
        }));

      if (!form.supplierId) {
        toast.error('Please select a supplier');
        return;
      }

      if (!items.length) {
        toast.error('Please add at least one product');
        return;
      }

      await api.post('/purchases', {
        ...form,
        items,
      });

      toast.success('Purchase order created');
      setShowModal(false);
      setForm({
        supplierId: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        paymentStatus: 'pending',
        notes: '',
        items: [emptyItem()],
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create purchase order');
    }
  };

  const markAsReceived = async (purchaseId) => {
    try {
      await api.put(`/purchases/${purchaseId}/status`, { status: 'received' });
      toast.success('Purchase marked as received');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update purchase status');
    }
  };

  const updateSelectedPurchase = async (e) => {
    e.preventDefault();

    try {
      await api.put(`/purchases/${selectedPurchase._id}/status`, {
        status: selectedPurchase.status,
        paymentStatus: selectedPurchase.paymentStatus,
        notes: selectedPurchase.notes || '',
      });

      toast.success('Purchase updated');
      setSelectedPurchase(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update purchase');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Purchases</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>Create Purchase Order</button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Order #</th>
              <th>Supplier</th>
              <th>Date</th>
              <th>Total Cost</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="loading">Loading...</td></tr>
            ) : purchases.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: 24 }}>No purchase orders found</td></tr>
            ) : purchases.map(p => (
              <tr key={p._id}>
                <td>{p.orderNumber}</td>
                <td>{p.supplier?.name || '-'}</td>
                <td>{new Date(p.purchaseDate).toLocaleDateString()}</td>
                <td>${p.totalCost?.toFixed(2)}</td>
                <td>
                  <span className={`badge badge-${p.paymentStatus === 'paid' ? 'success' : p.paymentStatus === 'partial' ? 'warning' : 'secondary'}`}>
                    {p.paymentStatus}
                  </span>
                </td>
                <td>
                  <span className={`badge badge-${p.status === 'received' ? 'success' : p.status === 'cancelled' ? 'danger' : 'info'}`}>
                    {p.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setSelectedPurchase(p)}>
                      Details
                    </button>
                    {p.status !== 'received' && (
                      <button className="btn btn-success" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => markAsReceived(p._id)}>
                        Mark Received
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedPurchase && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 760, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Purchase Details</h2>
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedPurchase(null)}>Close</button>
            </div>

            <form onSubmit={updateSelectedPurchase}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Order Number</label>
                  <input value={selectedPurchase.orderNumber} disabled />
                </div>
                <div className="form-group">
                  <label>Supplier</label>
                  <input value={selectedPurchase.supplier?.name || '-'} disabled />
                </div>
                <div className="form-group">
                  <label>Purchase Date</label>
                  <input value={new Date(selectedPurchase.purchaseDate).toLocaleDateString()} disabled />
                </div>
                <div className="form-group">
                  <label>Total Cost</label>
                  <input value={`$${selectedPurchase.totalCost?.toFixed(2)}`} disabled />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Status</label>
                  <select value={selectedPurchase.status} onChange={e => setSelectedPurchase({ ...selectedPurchase, status: e.target.value })}>
                    <option value="ordered">Ordered</option>
                    <option value="received">Received</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Payment Status</label>
                  <select value={selectedPurchase.paymentStatus} onChange={e => setSelectedPurchase({ ...selectedPurchase, paymentStatus: e.target.value })}>
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea rows={3} value={selectedPurchase.notes || ''} onChange={e => setSelectedPurchase({ ...selectedPurchase, notes: e.target.value })} />
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
                        <td>${item.cost?.toFixed(2)}</td>
                        <td>${item.total?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedPurchase(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 760, maxHeight: '85vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: 16 }}>Create Purchase Order</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Supplier</label>
                <select value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })} required>
                  <option value="">Select supplier</option>
                  {suppliers.map(supplier => (
                    <option key={supplier._id} value={supplier._id}>{supplier.name} ({supplier.company || 'No company'})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Purchase Date</label>
                <input type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} required />
              </div>

              <div className="form-group">
                <label>Payment Status</label>
                <select value={form.paymentStatus} onChange={e => setForm({ ...form, paymentStatus: e.target.value })}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                </select>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong>Products</strong>
                  <button type="button" className="btn btn-secondary" onClick={addItemRow}>Add Item</button>
                </div>

                {form.items.map((item, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 10 }}>
                    <select value={item.productId} onChange={e => updateItem(index, 'productId', e.target.value)} required>
                      <option value="">Select product</option>
                      {products.map(product => (
                        <option key={product._id} value={product._id}>{product.name} ({product.stock} in stock)</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={e => updateItem(index, 'quantity', e.target.value)}
                      required
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Cost"
                      value={item.cost}
                      onChange={e => updateItem(index, 'cost', e.target.value)}
                      required
                    />
                    <button type="button" className="btn btn-danger" onClick={() => removeItemRow(index)} style={{ padding: '8px 10px' }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Purchase Order</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
