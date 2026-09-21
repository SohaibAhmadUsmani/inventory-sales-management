import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

const loadFromStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export default function POS() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState(() => {
    const stored = loadFromStorage('posCart', []);
    return Array.isArray(stored) ? stored : [];
  });
  const [search, setSearch] = useState('');
  const [discount, setDiscount] = useState(() => {
    const value = Number(loadFromStorage('posDiscount', 0));
    return value >= 0 ? value : 0;
  });
  const [tax, setTax] = useState(() => {
    const value = Number(loadFromStorage('posTax', 0));
    return value >= 0 ? value : 0;
  });
  const [paymentMethod, setPaymentMethod] = useState(() => {
    const stored = loadFromStorage('posPaymentMethod', 'cash');
    return ['cash', 'card', 'online'].includes(stored) ? stored : 'cash';
  });
  const [checking, setChecking] = useState(false);
  const searchTimer = useRef(null);
  const firstSearch = useRef(true);

  const loadProducts = (query) => {
    api.get('/products', { params: { search: query, limit: 50 } })
      .then(res => setProducts(res.data.products))
      .catch(console.error);
  };

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadProducts(search), firstSearch.current ? 0 : 300);
    firstSearch.current = false;
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  useEffect(() => {
    localStorage.setItem('posCart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('posDiscount', JSON.stringify(discount));
  }, [discount]);

  useEffect(() => {
    localStorage.setItem('posTax', JSON.stringify(tax));
  }, [tax]);

  useEffect(() => {
    localStorage.setItem('posPaymentMethod', JSON.stringify(paymentMethod));
  }, [paymentMethod]);

  const getStock = (productId) => {
    const product = products.find(p => p._id === productId);
    return product ? Number(product.stock) : NaN;
  };

  const addToCart = (product) => {
    const existing = cart.find(item => item.productId === product._id);
    const currentQty = existing ? existing.quantity : 0;
    if (currentQty + 1 > Number(product.stock)) {
      return toast.error(`Insufficient stock for ${product.name}`);
    }
    if (existing) {
      setCart(cart.map(item => item.productId === product._id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { productId: product._id, name: product.name, sku: product.sku, price: product.price, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId, qty) => {
    if (Number.isNaN(qty)) return;
    if (qty < 1) return removeFromCart(productId);
    const item = cart.find(item => item.productId === productId);
    if (item && qty > getStock(productId)) {
      return toast.error(`Insufficient stock for ${item.name}`);
    }
    setCart(cart.map(item => item.productId === productId ? { ...item, quantity: qty } : item));
  };

  const handleQtyChange = (item, e) => {
    const value = e.target.value;
    if (value === '') return;
    const qty = parseInt(value, 10);
    if (Number.isNaN(qty)) return;
    updateQuantity(item.productId, qty);
  };

  const removeFromCart = (productId) => setCart(cart.filter(item => item.productId !== productId));

  const subtotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
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

  const handleCheckout = async () => {
    if (cart.length === 0) return toast.error('Cart is empty');
    const saleData = {
      items: cart.map(item => ({ productId: item.productId, quantity: item.quantity })),
      discount: Number(discount),
      tax: Number(tax),
      paymentMethod,
      paymentStatus: 'paid',
    };
    setChecking(true);
    try {
      const res = await api.post('/sales', saleData);
      toast.success(`Sale completed! Invoice: ${res.data.sale.invoiceNumber}`);
      setCart([]);
      setDiscount(0);
      setTax(0);
      loadProducts(search);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sale failed');
    } finally {
      setChecking(false);
    }
  };

  const paymentMethods = ['cash', 'card', 'online'];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, height: 'calc(100vh - 48px)' }}>
      <div>
        <div className="page-header"><h1>POS</h1></div>
        <input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16, fontSize: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {products.map(p => (
            <div key={p._id} className="card" style={{ cursor: 'pointer', padding: 16, textAlign: 'center' }} onClick={() => addToCart(p)}>
              {p.image ? (
                <img src={p.image} alt={p.name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} />
              ) : (
                <div style={{ width: 60, height: 60, borderRadius: 6, marginBottom: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--border)', color: 'var(--text-light)', fontWeight: 600, fontSize: 20 }}>{p.name.charAt(0).toUpperCase()}</div>
              )}
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
              <div style={{ color: 'var(--text-light)', fontSize: 13 }}>{p.sku}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)', marginTop: 8 }}>${p.price}</div>
              <div style={{ fontSize: 12, color: p.stock <= p.minimumStock ? 'var(--danger)' : 'var(--text-light)' }}>Stock: {p.stock}{p.stock <= p.minimumStock ? ' (Low)' : ''}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ marginBottom: 16 }}>Cart</h2>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {cart.length === 0 ? (
            <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 40 }}>Click products to add</p>
          ) : cart.map(item => (
            <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{item.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-light)' }}>${item.price} each</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>${(Number(item.price) * Number(item.quantity)).toFixed(2)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="btn btn-secondary" style={{ padding: '2px 8px' }} onClick={() => updateQuantity(item.productId, item.quantity - 1)}>-</button>
                <input type="number" min="1" value={item.quantity} onChange={e => handleQtyChange(item, e)} style={{ width: 50, textAlign: 'center', padding: '4px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14 }} />
                <button className="btn btn-secondary" style={{ padding: '2px 8px' }} onClick={() => updateQuantity(item.productId, item.quantity + 1)}>+</button>
                <button className="btn btn-danger" style={{ padding: '2px 8px' }} onClick={() => removeFromCart(item.productId)}>x</button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '2px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Subtotal:</span><span>${subtotal.toFixed(2)}</span></div>
          <div className="form-group"><label>Discount</label><input type="number" min="0" step="0.01" value={discount} onChange={handleDiscountChange} /></div>
          <div className="form-group"><label>Tax</label><input type="number" min="0" step="0.01" value={tax} onChange={handleTaxChange} /></div>
          <div className="form-group">
            <label>Payment Method</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {paymentMethods.map(method => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className="btn"
                  style={{ flex: 1, padding: '10px 12px', background: paymentMethod === method ? 'var(--primary)' : 'var(--border)', color: paymentMethod === method ? '#fff' : 'var(--text)', border: '1px solid var(--border)', fontWeight: 500 }}
                >
                  {method.charAt(0).toUpperCase() + method.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700, marginBottom: 12 }}><span>Total:</span><span>${total.toFixed(2)}</span></div>
          <button className="btn btn-primary" style={{ width: '100%', padding: 14 }} disabled={checking} onClick={handleCheckout}>{checking ? 'Processing...' : 'Complete Sale'}</button>
        </div>
      </div>
    </div>
  );
}
