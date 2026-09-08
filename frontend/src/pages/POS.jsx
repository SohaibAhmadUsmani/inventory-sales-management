import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  useEffect(() => {
    api.get('/products', { params: { search, limit: 50 } })
      .then(res => setProducts(res.data.products))
      .catch(console.error);
  }, [search]);

  const addToCart = (product) => {
    const existing = cart.find(item => item.productId === product._id);
    if (existing) {
      setCart(cart.map(item => item.productId === product._id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { productId: product._id, name: product.name, sku: product.sku, price: product.price, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId, qty) => {
    if (qty < 1) return removeFromCart(productId);
    setCart(cart.map(item => item.productId === productId ? { ...item, quantity: qty } : item));
  };

  const removeFromCart = (productId) => setCart(cart.filter(item => item.productId !== productId));

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal - Number(discount) + Number(tax);

  const handleCheckout = async () => {
    if (cart.length === 0) return toast.error('Cart is empty');
    try {
      const saleData = {
        items: cart.map(item => ({ productId: item.productId, quantity: item.quantity })),
        discount: Number(discount),
        tax: Number(tax),
        paymentMethod,
        paymentStatus: 'paid',
      };
      const res = await api.post('/sales', saleData);
      toast.success(`Sale completed! Invoice: ${res.data.sale.invoiceNumber}`);
      setCart([]);
      setDiscount(0);
      setTax(0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sale failed');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, height: 'calc(100vh - 48px)' }}>
      <div>
        <div className="page-header"><h1>POS</h1></div>
        <input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16, fontSize: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {products.map(p => (
            <div key={p._id} className="card" style={{ cursor: 'pointer', padding: 16, textAlign: 'center' }} onClick={() => addToCart(p)}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
              <div style={{ color: 'var(--text-light)', fontSize: 13 }}>{p.sku}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)', marginTop: 8 }}>${p.price}</div>
              <div style={{ fontSize: 12, color: p.stock <= p.minimumStock ? 'var(--danger)' : 'var(--text-light)' }}>Stock: {p.stock}</div>
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
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="btn btn-secondary" style={{ padding: '2px 8px' }} onClick={() => updateQuantity(item.productId, item.quantity - 1)}>-</button>
                <span>{item.quantity}</span>
                <button className="btn btn-secondary" style={{ padding: '2px 8px' }} onClick={() => updateQuantity(item.productId, item.quantity + 1)}>+</button>
                <button className="btn btn-danger" style={{ padding: '2px 8px' }} onClick={() => removeFromCart(item.productId)}>x</button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '2px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Subtotal:</span><span>${subtotal.toFixed(2)}</span></div>
          <div className="form-group"><label>Discount</label><input type="number" value={discount} onChange={e => setDiscount(e.target.value)} /></div>
          <div className="form-group"><label>Tax</label><input type="number" value={tax} onChange={e => setTax(e.target.value)} /></div>
          <div className="form-group">
            <label>Payment Method</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="online">Online</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700, marginBottom: 12 }}><span>Total:</span><span>${total.toFixed(2)}</span></div>
          <button className="btn btn-primary" style={{ width: '100%', padding: 14 }} onClick={handleCheckout}>Complete Sale</button>
        </div>
      </div>
    </div>
  );
}
