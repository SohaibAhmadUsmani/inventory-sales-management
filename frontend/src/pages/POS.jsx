import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import PageHeader from '../components/PageHeader';

const CART_KEY = 'posCart';
const DISCOUNT_KEY = 'posDiscount';
const TAX_KEY = 'posTax';
const PAYMENT_KEY = 'posPaymentMethod';
const CUSTOMER_KEY = 'posCustomer';
const HELD_KEY = 'posHeldOrders';

const loadFromStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw === 'null') return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const resolveImageUrl = (imagePath) => {
  if (!imagePath) return '';
  if (/^(https?:|blob:|data:)/i.test(imagePath)) return imagePath;
  const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '');
  const normalized = imagePath.replace(/\\/g, '/').replace(/^\/?uploads\/?/, '');
  return `${base}/uploads/${normalized}`;
};

export default function POS() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [search, setSearch] = useState('');

  const [cart, setCart] = useState(() => loadFromStorage(CART_KEY, []));
  const [qtyDrafts, setQtyDrafts] = useState({});
  const [discount, setDiscount] = useState(() => {
    const value = Number(loadFromStorage(DISCOUNT_KEY, 0));
    return value >= 0 ? value : 0;
  });
  const [tax, setTax] = useState(() => {
    const value = Number(loadFromStorage(TAX_KEY, 0));
    return value >= 0 ? value : 0;
  });
  const [paymentMethod, setPaymentMethod] = useState(() => {
    const stored = loadFromStorage(PAYMENT_KEY, 'cash');
    return ['cash', 'card', 'online'].includes(stored) ? stored : 'cash';
  });
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [notes, setNotes] = useState('');

  const [customer, setCustomer] = useState(() => loadFromStorage(CUSTOMER_KEY, null));
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({ name: '', phone: '', email: '' });
  const [quickAddSaving, setQuickAddSaving] = useState(false);

  const [heldOrders, setHeldOrders] = useState(() => loadFromStorage(HELD_KEY, []));
  const [heldOpen, setHeldOpen] = useState(false);

  const [checking, setChecking] = useState(false);
  const searchTimer = useRef(null);
  const customerTimer = useRef(null);
  const firstSearch = useRef(true);
  const customerDropdownRef = useRef(null);

  useEffect(() => {
    api
      .get('/categories')
      .then((res) => setCategories(res.data?.categories || []))
      .catch(() => {});
  }, []);

  const loadProducts = useCallback((query, categoryId = selectedCategory) => {
    setProductsLoading(true);
    setProductsError(null);
    const params = { search: query, limit: 200 };
    if (categoryId) params.category = categoryId;
    return api
      .get('/products', { params })
      .then((res) => {
        const loaded = res.data?.products || [];
        setProducts(loaded);
        if (loaded.length > 0) {
          setCart((prev) =>
            prev.map((item) => {
              const fresh = loaded.find((p) => p._id === item.productId);
              if (!fresh) return item;
              const freshStock = Number(fresh.stock) || 0;
              return {
                ...item,
                name: fresh.name,
                sku: fresh.sku,
                price: fresh.price,
                stock: freshStock,
                quantity: freshStock > 0 ? Math.min(item.quantity, freshStock) : item.quantity,
              };
            })
          );
        }
      })
      .catch((err) =>
        setProductsError(err.response?.data?.message || 'Failed to load products')
      )
      .finally(() => setProductsLoading(false));
  }, [selectedCategory]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => loadProducts(search, selectedCategory),
      firstSearch.current ? 0 : 300
    );
    firstSearch.current = false;
    return () => clearTimeout(searchTimer.current);
  }, [search, selectedCategory, loadProducts]);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem(DISCOUNT_KEY, JSON.stringify(discount));
  }, [discount]);

  useEffect(() => {
    localStorage.setItem(TAX_KEY, JSON.stringify(tax));
  }, [tax]);

  useEffect(() => {
    localStorage.setItem(PAYMENT_KEY, JSON.stringify(paymentMethod));
  }, [paymentMethod]);

  useEffect(() => {
    if (customer) localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
    else localStorage.removeItem(CUSTOMER_KEY);
  }, [customer]);

  useEffect(() => {
    localStorage.setItem(HELD_KEY, JSON.stringify(heldOrders));
  }, [heldOrders]);

  useEffect(() => {
    if (!customerOpen) return;
    const handleMouseDown = (e) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setCustomerOpen(false);
        setQuickAddOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setCustomerOpen(false);
        setQuickAddOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [customerOpen]);

  useEffect(() => {
    if (!customerOpen) return;
    if (customerTimer.current) clearTimeout(customerTimer.current);
    customerTimer.current = setTimeout(() => {
      setCustomerLoading(true);
      api
        .get('/customers', { params: { search: customerSearch, limit: 8 } })
        .then((res) => setCustomerResults(res.data?.customers || []))
        .catch(() => setCustomerResults([]))
        .finally(() => setCustomerLoading(false));
    }, 250);
    return () => clearTimeout(customerTimer.current);
  }, [customerOpen, customerSearch]);

  const selectCustomer = (c) => {
    setCustomer(c);
    setCustomerOpen(false);
    setQuickAddOpen(false);
    setCustomerSearch('');
    setCustomerResults([]);
  };

  const handleQuickAddCustomer = async (e) => {
    e.preventDefault();
    if (!quickAddForm.name.trim()) {
      return toast.error('Customer name is required');
    }
    setQuickAddSaving(true);
    try {
      const res = await api.post('/customers', {
        name: quickAddForm.name.trim(),
        phone: quickAddForm.phone.trim(),
        email: quickAddForm.email.trim(),
      });
      const created = res.data?.customer;
      if (created) {
        selectCustomer(created);
        setQuickAddForm({ name: '', phone: '', email: '' });
        toast.success(`Customer "${created.name}" added and selected`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add customer');
    } finally {
      setQuickAddSaving(false);
    }
  };

  const addToCart = (product) => {
    const stock = Number(product.stock) || 0;
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product._id);
      const currentQty = existing ? existing.quantity : 0;
      if (stock <= 0 || currentQty + 1 > stock) {
        toast.error(stock <= 0 ? `${product.name} is out of stock` : `Insufficient stock for ${product.name}`);
        return prev;
      }
      if (existing) {
        return prev.map((i) =>
          i.productId === product._id
            ? { ...i, quantity: i.quantity + 1, stock, price: product.price }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          sku: product.sku,
          price: product.price,
          stock,
          quantity: 1,
        },
      ];
    });
  };

  const updateQuantity = (productId, qty) => {
    const item = cart.find((i) => i.productId === productId);
    if (!item) return;
    if (qty < 1) return removeFromCart(productId);
    const itemStock = Number(item.stock) || 0;
    if (qty > itemStock) {
      return toast.error(`Insufficient stock for ${item.name} (max ${itemStock})`);
    }
    setCart((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i))
    );
  };

  const handleQtyChange = (item, e) => {
    const value = e.target.value;
    if (value === '') {
      setQtyDrafts((prev) => ({ ...prev, [item.productId]: '' }));
      return;
    }
    if (!/^\d+$/.test(value)) return;
    setQtyDrafts((prev) => ({ ...prev, [item.productId]: value }));
    const qty = parseInt(value, 10);
    if (Number.isNaN(qty) || qty < 1) return;
    const itemStock = Number(item.stock) || 0;
    if (qty > itemStock) {
      toast.error(`Insufficient stock for ${item.name} (max ${itemStock})`);
      const clamped = Math.max(1, itemStock);
      setQtyDrafts((prev) => ({ ...prev, [item.productId]: String(clamped) }));
      if (itemStock >= 1) updateQuantity(item.productId, clamped);
      return;
    }
    updateQuantity(item.productId, qty);
  };

  const handleQtyBlur = (item) => {
    const draft = qtyDrafts[item.productId];
    setQtyDrafts((prev) => {
      const next = { ...prev };
      delete next[item.productId];
      return next;
    });
    if (draft === undefined) return;
    const parsed = parseInt(draft, 10);
    const maxStock = Math.max(1, Number(item.stock) || 1);
    const clamped = Number.isNaN(parsed) || parsed < 1 ? 1 : Math.min(parsed, maxStock);
    if (clamped !== item.quantity) {
      updateQuantity(item.productId, clamped);
    }
  };

  const removeFromCart = (productId) => {
    setQtyDrafts((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );

  useEffect(() => {
    if (discount > subtotal) {
      setDiscount(subtotal);
    }
  }, [subtotal, discount]);

  const total = Math.max(0, subtotal - Number(discount || 0) + Number(tax || 0));

  const handleDiscountChange = (e) => {
    const value = e.target.value;
    if (value === '') {
      setDiscount(0);
      return;
    }
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed) || parsed < 0) {
      setDiscount(0);
      return;
    }
    if (parsed > subtotal) {
      toast.warning('Discount cannot exceed subtotal');
      setDiscount(subtotal);
      return;
    }
    setDiscount(parsed);
  };

  const handleTaxChange = (e) => {
    const value = e.target.value;
    if (value === '') {
      setTax(0);
      return;
    }
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed) || parsed < 0) {
      setTax(0);
      return;
    }
    setTax(parsed);
  };

  const handleHoldOrder = () => {
    if (cart.length === 0) return toast.error('Cart is empty');
    const heldOrder = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      savedAt: new Date().toISOString(),
      cart,
      discount: Number(discount),
      tax: Number(tax),
      paymentMethod,
      paymentStatus,
      notes,
      customer,
    };
    setHeldOrders((prev) => [...prev, heldOrder]);
    setCart([]);
    setQtyDrafts({});
    setDiscount(0);
    setTax(0);
    setPaymentStatus('paid');
    setNotes('');
    setCustomer(null);
    toast.success('Order held');
  };

  const resumeOrder = (order) => {
    if (
      cart.length > 0 &&
      !window.confirm('Replace current cart items with this held order?')
    ) {
      return;
    }
    setCart(order.cart || []);
    setQtyDrafts({});
    setDiscount(Number(order.discount) || 0);
    setTax(Number(order.tax) || 0);
    if (['cash', 'card', 'online'].includes(order.paymentMethod)) {
      setPaymentMethod(order.paymentMethod);
    }
    if (['paid', 'pending', 'partial'].includes(order.paymentStatus)) {
      setPaymentStatus(order.paymentStatus);
    } else {
      setPaymentStatus('paid');
    }
    setNotes(order.notes || '');
    setCustomer(order.customer || null);
    deleteHeld(order.id);
    setHeldOpen(false);
    toast.success('Order resumed');
  };

  const deleteHeld = (id) =>
    setHeldOrders((prev) => prev.filter((o) => o.id !== id));

  const handleCheckout = async () => {
    if (checking) return;
    if (cart.length === 0) return toast.error('Cart is empty');
    const saleData = {
      items: cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      discount: Number(discount),
      tax: Number(tax),
      paymentMethod,
      paymentStatus,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(customer?._id ? { customerId: customer._id } : {}),
    };
    setChecking(true);
    try {
      const res = await api.post('/sales', saleData);
      toast.success(`Sale completed! Invoice: ${res.data.sale.invoiceNumber}`);
      setCart([]);
      setQtyDrafts({});
      setDiscount(0);
      setTax(0);
      setPaymentStatus('paid');
      setNotes('');
      setCustomer(null);
      window.dispatchEvent(new Event('notifications-updated'));
      loadProducts(search, selectedCategory);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sale failed');
    } finally {
      setChecking(false);
    }
  };

  const paymentMethods = ['cash', 'card', 'online'];

  return (
    <div className="pos-layout">
      <style>{`
        .pos-layout {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 20px;
        }
        @media (max-width: 960px) {
          .pos-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <div>
        <PageHeader
          title="POS"
          subtitle="Search products, build a cart, and complete sales"
          actions={
            <button className="btn btn-secondary" onClick={() => setHeldOpen(true)}>
              Held Orders ({heldOrders.length})
            </button>
          }
        />

        <input
          placeholder="Search by name or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            border: '1px solid var(--border)',
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 16,
            outline: 'none',
          }}
        />

        {categories.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 16,
            }}
          >
            <button
              type="button"
              className="btn"
              onClick={() => setSelectedCategory('')}
              style={{
                padding: '6px 14px',
                fontSize: 13,
                borderRadius: 20,
                background: selectedCategory === '' ? 'var(--primary)' : 'var(--card-bg)',
                color: selectedCategory === '' ? '#fff' : 'var(--text)',
                border: '1px solid var(--border)',
              }}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat._id}
                type="button"
                className="btn"
                onClick={() => setSelectedCategory(cat._id)}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  borderRadius: 20,
                  background: selectedCategory === cat._id ? 'var(--primary)' : 'var(--card-bg)',
                  color: selectedCategory === cat._id ? '#fff' : 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {productsLoading ? (
          <div className="loading">Loading products...</div>
        ) : productsError ? (
          <div
            className="card"
            style={{ textAlign: 'center', color: 'var(--danger)', padding: 24 }}
          >
            <p style={{ marginBottom: 12 }}>{productsError}</p>
            <button
              className="btn btn-secondary"
              onClick={() => loadProducts(search, selectedCategory)}
            >
              Retry
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-light)', padding: 40 }}>
            {search ? `No products found for "${search}"` : 'No products available'}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {products.map((p) => {
              const outOfStock = Number(p.stock) <= 0;
              const lowStock = Number(p.stock) > 0 && Number(p.stock) <= Number(p.minimumStock);
              return (
                <div
                  key={p._id}
                  className="card"
                  role="button"
                  tabIndex={outOfStock ? -1 : 0}
                  aria-disabled={outOfStock}
                  onClick={() => addToCart(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      addToCart(p);
                    }
                  }}
                  style={{
                    cursor: outOfStock ? 'not-allowed' : 'pointer',
                    padding: 16,
                    textAlign: 'center',
                    opacity: outOfStock ? 0.55 : 1,
                    position: 'relative',
                  }}
                >
                  {outOfStock && (
                    <span
                      className="badge badge-danger"
                      style={{ position: 'absolute', top: 8, right: 8 }}
                    >
                      Out of stock
                    </span>
                  )}
                  {p.image ? (
                    <img
                      src={resolveImageUrl(p.image)}
                      alt={p.name || 'Product'}
                      style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 6,
                        marginBottom: 8,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--border)',
                        color: 'var(--text-light)',
                        fontWeight: 600,
                        fontSize: 20,
                      }}
                    >
                      {(p.name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ color: 'var(--text-light)', fontSize: 13 }}>{p.sku}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)', marginTop: 8 }}>
                    ${Number(p.price || 0).toFixed(2)}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: outOfStock || lowStock ? 'var(--danger)' : 'var(--text-light)',
                    }}
                  >
                    Stock: {p.stock}
                    {lowStock ? ' (Low)' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 480 }}>
        <h2 style={{ marginBottom: 16 }}>Cart</h2>

        <div className="form-group">
          <label>Customer</label>
          <div style={{ position: 'relative' }} ref={customerDropdownRef}>
            {customer ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{customer.name}</div>
                  {customer.phone && (
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{customer.phone}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => setCustomerOpen((v) => !v)}
                  >
                    {customerOpen ? 'Close' : 'Change'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => {
                      setCustomer(null);
                      setCustomerOpen(false);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%' }}
                onClick={() => setCustomerOpen((v) => !v)}
              >
                {customerOpen ? 'Close search' : '+ Select customer (optional)'}
              </button>
            )}

            {customerOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  background: '#fff',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  marginTop: 4,
                  maxHeight: 340,
                  overflow: 'auto',
                }}
              >
                <input
                  autoFocus
                  placeholder="Search by name, phone, email..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    outline: 'none',
                  }}
                />
                {customerLoading ? (
                  <div style={{ padding: 12, fontSize: 13, color: 'var(--text-light)' }}>
                    Searching...
                  </div>
                ) : customerResults.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 13, color: 'var(--text-light)' }}>
                    No customers found
                  </div>
                ) : (
                  customerResults.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        border: 'none',
                        borderBottom: '1px solid var(--border)',
                        background: customer?._id === c._id ? 'var(--bg)' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                        {[c.phone, c.email].filter(Boolean).join(' • ')}
                      </div>
                    </button>
                  ))
                )}

                <div style={{ padding: 10, borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                  {!quickAddOpen ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ width: '100%', padding: '6px 10px', fontSize: 12 }}
                      onClick={() => {
                        setQuickAddOpen(true);
                        if (customerSearch && !quickAddForm.name) {
                          setQuickAddForm((f) => ({ ...f, name: customerSearch }));
                        }
                      }}
                    >
                      + Quick Add New Customer
                    </button>
                  ) : (
                    <form onSubmit={handleQuickAddCustomer} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input
                        placeholder="Customer Name *"
                        value={quickAddForm.name}
                        onChange={(e) => setQuickAddForm({ ...quickAddForm, name: e.target.value })}
                        required
                        style={{ padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6 }}
                      />
                      <input
                        placeholder="Phone (optional)"
                        value={quickAddForm.phone}
                        onChange={(e) => setQuickAddForm({ ...quickAddForm, phone: e.target.value })}
                        style={{ padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6 }}
                      />
                      <input
                        type="email"
                        placeholder="Email (optional)"
                        value={quickAddForm.email}
                        onChange={(e) => setQuickAddForm({ ...quickAddForm, email: e.target.value })}
                        style={{ padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6 }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ flex: 1, padding: '6px', fontSize: 12 }}
                          onClick={() => setQuickAddOpen(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          style={{ flex: 1, padding: '6px', fontSize: 12 }}
                          disabled={quickAddSaving}
                        >
                          {quickAddSaving ? 'Saving...' : 'Save & Select'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {cart.length === 0 ? (
            <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 40 }}>
              Click products to add
            </p>
          ) : (
            cart.map((item) => {
              const itemStock = Number(item.stock) || 0;
              const atMax = item.quantity >= itemStock;
              const displayQty =
                qtyDrafts[item.productId] !== undefined
                  ? qtyDrafts[item.productId]
                  : item.quantity;
              return (
                <div
                  key={item.productId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{item.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-light)' }}>
                      ${Number(item.price || 0).toFixed(2)} each
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>
                      ${(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '2px 8px' }}
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={itemStock > 0 ? itemStock : undefined}
                      value={displayQty}
                      onChange={(e) => handleQtyChange(item, e)}
                      onBlur={() => handleQtyBlur(item)}
                      style={{
                        width: 50,
                        textAlign: 'center',
                        padding: '4px',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        fontSize: 14,
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '2px 8px' }}
                      disabled={atMax}
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: '2px 8px' }}
                      onClick={() => removeFromCart(item.productId)}
                    >
                      x
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ borderTop: '2px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Subtotal:</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label>Discount ($)</label>
              <input type="number" min="0" step="0.01" value={discount} onChange={handleDiscountChange} />
            </div>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label>Tax ($)</label>
              <input type="number" min="0" step="0.01" value={tax} onChange={handleTaxChange} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label>Payment Method</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {paymentMethods.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className="btn"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: paymentMethod === method ? 'var(--primary)' : 'var(--border)',
                    color: paymentMethod === method ? '#fff' : 'var(--text)',
                    border: '1px solid var(--border)',
                    fontWeight: 500,
                  }}
                >
                  {method.charAt(0).toUpperCase() + method.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label>Payment Status</label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
            >
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Order Notes (Optional)</label>
            <input
              type="text"
              placeholder="Add note to receipt..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, padding: 14 }}
              onClick={handleHoldOrder}
            >
              Hold Order
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1, padding: 14 }}
              disabled={checking}
              onClick={handleCheckout}
            >
              {checking ? 'Processing...' : 'Complete Sale'}
            </button>
          </div>
        </div>
      </div>

      {heldOpen && (
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
          onClick={() => setHeldOpen(false)}
        >
          <div
            className="card"
            style={{ width: 560, maxWidth: '95vw', maxHeight: '80vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2>Held Orders ({heldOrders.length})</h2>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}
                onClick={() => setHeldOpen(false)}
              >
                x
              </button>
            </div>
            {heldOrders.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: 24 }}>
                No held orders
              </p>
            ) : (
              heldOrders.map((o) => {
                const heldTotal = Math.max(
                  0,
                  (o.cart || []).reduce(
                    (sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0),
                    0
                  ) -
                    Number(o.discount || 0) +
                    Number(o.tax || 0)
                );
                return (
                  <div
                    key={o.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{(o.cart || []).length} item(s)</div>
                      <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                        {new Date(o.savedAt).toLocaleString()} • {o.customer?.name || 'Walk-in'} • $
                        {heldTotal.toFixed(2)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => resumeOrder(o)}
                      >
                        Resume
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => deleteHeld(o.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}