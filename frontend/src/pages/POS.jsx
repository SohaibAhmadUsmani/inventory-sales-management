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
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '');
  const normalized = imagePath.replace(/\\/g, '/').replace(/^\/?uploads\/?/, '');
  return `${base}/uploads/${normalized}`;
};

export default function POS() {
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [search, setSearch] = useState('');

  const [cart, setCart] = useState(() => loadFromStorage(CART_KEY, []));
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

  const [customer, setCustomer] = useState(() => loadFromStorage(CUSTOMER_KEY, null));
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);

  const [heldOrders, setHeldOrders] = useState(() => loadFromStorage(HELD_KEY, []));
  const [heldOpen, setHeldOpen] = useState(false);

  const [checking, setChecking] = useState(false);
  const searchTimer = useRef(null);
  const customerTimer = useRef(null);
  const firstSearch = useRef(true);

  const loadProducts = useCallback((query) => {
    setProductsLoading(true);
    setProductsError(null);
    return api
      .get('/products', { params: { search: query, limit: 50 } })
      .then((res) => setProducts(res.data.products || []))
      .catch((err) =>
        setProductsError(err.response?.data?.message || 'Failed to load products')
      )
      .finally(() => setProductsLoading(false));
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => loadProducts(search),
      firstSearch.current ? 0 : 300
    );
    firstSearch.current = false;
    return () => clearTimeout(searchTimer.current);
  }, [search, loadProducts]);

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
    if (customerTimer.current) clearTimeout(customerTimer.current);
    customerTimer.current = setTimeout(() => {
      setCustomerLoading(true);
      api
        .get('/customers', { params: { search: customerSearch, limit: 6 } })
        .then((res) => setCustomerResults(res.data.customers || []))
        .catch(() => setCustomerResults([]))
        .finally(() => setCustomerLoading(false));
    }, 250);
    return () => clearTimeout(customerTimer.current);
  }, [customerOpen, customerSearch]);

  const selectCustomer = (c) => {
    setCustomer(c);
    setCustomerOpen(false);
    setCustomerSearch('');
    setCustomerResults([]);
  };

  const addToCart = (product) => {
    const stock = Number(product.stock);
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product._id);
      const currentQty = existing ? existing.quantity : 0;
      if (stock <= 0 || currentQty + 1 > stock) {
        toast.error(stock <= 0 ? `${product.name} is out of stock` : `Insufficient stock for ${product.name}`);
        return prev;
      }
      if (existing) {
        return prev.map((i) =>
          i.productId === product._id ? { ...i, quantity: i.quantity + 1 } : i
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
    if (itemStock > 0 && qty > itemStock) {
      return toast.error(`Insufficient stock for ${item.name} (max ${itemStock})`);
    }
    setCart((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i))
    );
  };

  const handleQtyChange = (item, e) => {
    const value = e.target.value;
    if (value === '') return;
    if (!/^\d+$/.test(value)) return;
    const qty = parseInt(value, 10);
    if (Number.isNaN(qty)) return;
    updateQuantity(item.productId, qty);
  };

  const removeFromCart = (productId) =>
    setCart((prev) => prev.filter((item) => item.productId !== productId));

  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
  const total = subtotal - Number(discount || 0) + Number(tax || 0);

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
      customer,
    };
    setHeldOrders((prev) => [...prev, heldOrder]);
    setCart([]);
    setDiscount(0);
    setTax(0);
    setCustomer(null);
    toast.success('Order held');
  };

  const resumeOrder = (order) => {
    setCart(order.cart || []);
    setDiscount(Number(order.discount) || 0);
    setTax(Number(order.tax) || 0);
    if (['cash', 'card', 'online'].includes(order.paymentMethod)) {
      setPaymentMethod(order.paymentMethod);
    }
    setCustomer(order.customer || null);
    deleteHeld(order.id);
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
      paymentStatus: 'paid',
      ...(customer?._id ? { customerId: customer._id } : {}),
    };
    setChecking(true);
    try {
      const res = await api.post('/sales', saleData);
      toast.success(`Sale completed! Invoice: ${res.data.sale.invoiceNumber}`);
      setCart([]);
      setDiscount(0);
      setTax(0);
      setCustomer(null);
      loadProducts(search);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sale failed');
    } finally {
      setChecking(false);
    }
  };

  const paymentMethods = ['cash', 'card', 'online'];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
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
            marginBottom: 16,
            fontSize: 16,
            outline: 'none',
          }}
        />

        {productsLoading ? (
          <div className="loading">Loading products...</div>
        ) : productsError ? (
          <div
            className="card"
            style={{ textAlign: 'center', color: 'var(--danger)', padding: 24 }}
          >
            <p style={{ marginBottom: 12 }}>{productsError}</p>
            <button className="btn btn-secondary" onClick={() => loadProducts(search)}>
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
                  onClick={() => addToCart(p)}
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
                      alt={p.name}
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
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ color: 'var(--text-light)', fontSize: 13 }}>{p.sku}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)', marginTop: 8 }}>
                    ${Number(p.price).toFixed(2)}
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
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => setCustomerOpen((v) => !v)}
                >
                  Change
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => setCustomer(null)}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-secondary"
                style={{ width: '100%' }}
                onClick={() => setCustomerOpen((v) => !v)}
              >
                {customerOpen ? 'Close search' : '+ Select customer (optional)'}
              </button>
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
                    maxHeight: 280,
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
                          background: 'transparent',
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
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {cart.length === 0 ? (
            <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 40 }}>
              Click products to add
            </p>
          ) : (
            cart.map((item) => {
              const itemStock = Number(item.stock) || 0;
              const atMax = itemStock > 0 && item.quantity >= itemStock;
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
                      ${Number(item.price).toFixed(2)} each
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>
                      ${(Number(item.price) * Number(item.quantity)).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '2px 8px' }}
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleQtyChange(item, e)}
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
                      className="btn btn-secondary"
                      style={{ padding: '2px 8px' }}
                      disabled={atMax}
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    >
                      +
                    </button>
                    <button
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
          <div className="form-group">
            <label>Discount ($)</label>
            <input type="number" min="0" step="0.01" value={discount} onChange={handleDiscountChange} />
          </div>
          <div className="form-group">
            <label>Tax ($)</label>
            <input type="number" min="0" step="0.01" value={tax} onChange={handleTaxChange} />
          </div>
          <div className="form-group">
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
            <button className="btn btn-secondary" style={{ flex: 1, padding: 14 }} onClick={handleHoldOrder}>
              Hold Order
            </button>
            <button
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
            style={{ width: 560, maxHeight: '80vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2>Held Orders ({heldOrders.length})</h2>
              <button
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
                const heldTotal =
                  (o.cart || []).reduce(
                    (sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0),
                    0
                  ) -
                  Number(o.discount || 0) +
                  Number(o.tax || 0);
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
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => resumeOrder(o)}
                      >
                        Resume
                      </button>
                      <button
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