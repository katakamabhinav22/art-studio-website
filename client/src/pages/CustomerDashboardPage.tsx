import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Link, useNavigate } from 'react-router-dom';
import { Order, WallBooking, PotteryRequest, PotteryItem, PotteryGlaze } from '../types/index.js';
import { apiRequest } from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { ShoppingBag, Home, Sparkles, X, Edit3, AlertCircle, CheckCircle, Clock } from 'lucide-react';

function getDaysRemaining(dateStr: string): number {
  const parts = dateStr.split('-').map(Number);
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export const CustomerDashboardPage: React.FC = () => {
  const { user, isCustomer } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'orders' | 'bookings' | 'pottery'>('orders');

  // Data states
  const [orders, setOrders] = useState<Order[]>([]);
  const [bookings, setBookings] = useState<WallBooking[]>([]);
  const [pottery, setPottery] = useState<PotteryRequest[]>([]);
  const [items, setItems] = useState<PotteryItem[]>([]);
  const [glazes, setGlazes] = useState<PotteryGlaze[]>([]);

  // Loading & Error states
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Edit Pottery Modal
  const [editingPottery, setEditingPottery] = useState<PotteryRequest | null>(null);
  const [editItemId, setEditItemId] = useState('');
  const [editGlazeId, setEditGlazeId] = useState('');
  const [editQuantity, setEditQuantity] = useState(1);
  const [editNeededDate, setEditNeededDate] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login?redirect=/dashboard');
      return;
    }

    loadAllData();
  }, [user, navigate]);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, bookingsRes, potteryRes, optionsRes] = await Promise.all([
        apiRequest<{ orders: Order[] }>('/orders'),
        apiRequest<{ bookings: WallBooking[] }>('/bookings'),
        apiRequest<{ requests: PotteryRequest[] }>('/pottery'),
        apiRequest<{ items: PotteryItem[]; glazes: PotteryGlaze[] }>('/pottery/options').catch(() => ({ items: [], glazes: [] })),
      ]);

      setOrders(ordersRes.orders || []);
      setBookings(bookingsRes.bookings || []);
      setPottery(potteryRes.requests || []);
      setItems(optionsRes.items || []);
      setGlazes(optionsRes.glazes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load your dashboard records');
    } finally {
      setLoading(false);
    }
  };

  // 1. Cancel Painting Order
  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order? The painting will become available for purchase again.')) {
      return;
    }
    setError(null);
    setActionSuccess(null);
    try {
      const res = await apiRequest<{ message: string; order: Order }>(`/orders/${orderId}/cancel`, {
        method: 'PUT',
      });
      setActionSuccess(res.message);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' } : o))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to cancel order');
    }
  };

  // 2. Cancel Wall Booking
  const handleCancelBooking = async (booking: WallBooking) => {
    const daysLeft = getDaysRemaining(booking.bookingDate);
    if (daysLeft < 3) {
      setError(`Cannot cancel: cancellations are only permitted until 3 days before the date (${daysLeft} day(s) remaining).`);
      return;
    }

    if (!confirm('Are you sure you want to cancel this mural booking? The date will become available again.')) {
      return;
    }
    setError(null);
    setActionSuccess(null);
    try {
      const res = await apiRequest<{ message: string; booking: WallBooking }>(`/bookings/${booking.id}/cancel`, {
        method: 'PUT',
      });
      setActionSuccess(res.message);
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, status: 'cancelled' } : b))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to cancel wall booking');
    }
  };

  // 3. Open Edit Pottery Modal
  const openEditPottery = (p: PotteryRequest) => {
    if (p.status !== 'requested') {
      setError('Pottery requests can only be edited while in "requested" status.');
      return;
    }
    setEditingPottery(p);
    setEditItemId(p.itemId);
    setEditGlazeId(p.glazeId);
    setEditQuantity(p.quantity);
    setEditNeededDate(p.neededByDate);
    setEditError(null);
  };

  // Save Pottery Edit
  const handleSavePotteryEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPottery) return;

    setEditSaving(true);
    setEditError(null);

    try {
      const res = await apiRequest<{ message: string; request: PotteryRequest }>(
        `/pottery/${editingPottery.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            itemId: editItemId,
            glazeId: editGlazeId,
            quantity: editQuantity,
            neededByDate: editNeededDate,
          }),
        }
      );

      setActionSuccess('Pottery request updated successfully');
      setPottery((prev) =>
        prev.map((p) => (p.id === editingPottery.id ? res.request : p))
      );
      setEditingPottery(null);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update pottery request');
    } finally {
      setEditSaving(false);
    }
  };

  // 4. Cancel Pottery Request
  const handleCancelPottery = async (potteryId: string) => {
    if (!confirm('Are you sure you want to cancel this pottery request?')) {
      return;
    }
    setError(null);
    setActionSuccess(null);
    try {
      const res = await apiRequest<{ message: string; request: PotteryRequest }>(
        `/pottery/${potteryId}/cancel`,
        { method: 'PUT' }
      );
      setActionSuccess(res.message);
      setPottery((prev) =>
        prev.map((p) => (p.id === potteryId ? { ...p, status: 'cancelled' } : p))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to cancel pottery request');
    }
  };

  return (
    <div className="py-10 container">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-primary font-bold">
            Customer Portal
          </span>
          <h1 className="font-serif text-3xl font-bold text-stone-900 mt-1">
            My Orders & Commissions
          </h1>
          <p className="text-stone-600 text-sm">
            Manage your purchases, wall bookings, and custom pottery requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/paintings" className="btn btn-secondary btn-sm">
            + Buy Painting
          </Link>
          <Link to="/wall-booking" className="btn btn-secondary btn-sm">
            + Book Wall
          </Link>
          <Link to="/custom-pottery" className="btn btn-primary btn-sm">
            + Request Pottery
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 mb-6 bg-green-50 border border-green-200 rounded-lg text-green-800 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-green-700 hover:text-green-900 font-bold">
            <X size={16} />
          </button>
        </div>
      )}

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} onRetry={loadAllData} />}

      {/* Tabs */}
      <div className="flex border-b border-stone-200 mb-8 gap-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'orders'
              ? 'border-primary text-primary'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <ShoppingBag size={16} /> Painting Orders ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('bookings')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'bookings'
              ? 'border-primary text-primary'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Home size={16} /> Wall Bookings ({bookings.length})
        </button>
        <button
          onClick={() => setActiveTab('pottery')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'pottery'
              ? 'border-primary text-primary'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Sparkles size={16} /> Pottery Requests ({pottery.length})
        </button>
      </div>

      {loading && <LoadingSpinner message="Fetching your orders and records..." />}

      {!loading && (
        <>
          {/* TAB 1: ORDERS */}
          {activeTab === 'orders' && (
            <div>
              {orders.length === 0 ? (
                <EmptyState
                  title="No painting orders yet"
                  description="You have not purchased any paintings yet. Explore our one-of-a-kind original art collection."
                  action={{
                    label: 'Browse Paintings',
                    onClick: () => navigate('/paintings'),
                  }}
                />
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => {
                    const isPlaced = order.status === 'placed';

                    return (
                      <div
                        key={order.id}
                        className="card p-5 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-stone-200"
                      >
                        <div className="flex items-center gap-4">
                          {order.paintingImageUrl && (
                            <img
                              src={`/${order.paintingImageUrl}`}
                              alt={order.paintingTitle}
                              className="w-16 h-16 rounded object-cover border border-stone-200"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-stone-900 text-base">
                                {order.paintingTitle || 'Original Artwork'}
                              </h4>
                              <StatusBadge status={order.status} />
                            </div>
                            <div className="text-xs text-stone-500">
                              By {order.paintingArtist || 'Studio Artist'} • Ordered on{' '}
                              {new Date(order.createdAt).toLocaleDateString()}
                            </div>
                            <div className="text-xs font-mono text-stone-400 mt-0.5">
                              Order ID: {order.id}
                            </div>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                          <div className="font-bold text-stone-900 text-lg">
                            ₹{order.price.toLocaleString('en-IN')}
                          </div>
                          {isPlaced ? (
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              className="btn btn-outline btn-sm text-red-600 border-red-300 hover:bg-red-50 text-xs"
                            >
                              Cancel Order
                            </button>
                          ) : (
                            <span className="text-xs text-stone-400 font-medium">Cancelled</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: WALL BOOKINGS */}
          {activeTab === 'bookings' && (
            <div>
              {bookings.length === 0 ? (
                <EmptyState
                  title="No wall bookings yet"
                  description="You have not requested any wall paintings yet. Book our artists to paint your space."
                  action={{
                    label: 'Book a Wall Mural',
                    onClick: () => navigate('/wall-booking'),
                  }}
                />
              ) : (
                <div className="space-y-4">
                  {bookings.map((booking) => {
                    const daysLeft = getDaysRemaining(booking.bookingDate);
                    const canCancel =
                      ['requested', 'confirmed'].includes(booking.status) && daysLeft >= 3;

                    return (
                      <div
                        key={booking.id}
                        className="card p-5 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 border-stone-200"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-stone-900 text-base">
                              Mural Date: {booking.bookingDate}
                            </h4>
                            <StatusBadge status={booking.status} />
                            {daysLeft >= 0 ? (
                              <span className="text-xs text-stone-500 font-medium">
                                ({daysLeft} days away)
                              </span>
                            ) : (
                              <span className="text-xs text-stone-400">(Past date)</span>
                            )}
                          </div>
                          <div className="text-sm text-stone-700">
                            <strong>Wall Size:</strong> {booking.wallSizeSqFt} sq ft (₹{booking.ratePerSqFt}/sq ft)
                          </div>
                          <div className="text-xs text-stone-500">
                            <strong>Location:</strong> {booking.address}
                          </div>
                        </div>

                        <div className="flex md:flex-col items-center md:items-end justify-between gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-stone-100">
                          <div className="font-bold text-stone-900 text-lg">
                            ₹{booking.price.toLocaleString('en-IN')}
                          </div>

                          {['requested', 'confirmed'].includes(booking.status) ? (
                            canCancel ? (
                              <button
                                onClick={() => handleCancelBooking(booking)}
                                className="btn btn-outline btn-sm text-red-600 border-red-300 hover:bg-red-50 text-xs"
                              >
                                Cancel Booking
                              </button>
                            ) : (
                              <div
                                className="text-xs text-stone-400 flex items-center gap-1"
                                title="Cancellations are locked 3 days prior to the date"
                              >
                                <Clock size={12} /> Cancellation locked (&lt;3 days)
                              </div>
                            )
                          ) : (
                            <span className="text-xs text-stone-400 font-medium">
                              {booking.status === 'declined' ? 'Declined by Studio' : 'Cancelled'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: POTTERY REQUESTS */}
          {activeTab === 'pottery' && (
            <div>
              {pottery.length === 0 ? (
                <EmptyState
                  title="No custom pottery requests"
                  description="You have not requested any wheel-thrown pottery yet. Choose your vessel and mineral glaze."
                  action={{
                    label: 'Request Custom Pottery',
                    onClick: () => navigate('/custom-pottery'),
                  }}
                />
              ) : (
                <div className="space-y-4">
                  {pottery.map((req) => {
                    const isRequested = req.status === 'requested';

                    return (
                      <div
                        key={req.id}
                        className="card p-5 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 border-stone-200"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-stone-900 text-base">
                              {req.quantity}x {req.itemName}
                            </h4>
                            <StatusBadge status={req.status} />
                          </div>
                          <div className="text-sm text-stone-700">
                            <strong>Glaze:</strong> {req.glazeName} • <strong>Needed by:</strong> {req.neededByDate}
                          </div>
                          <div className="text-xs text-stone-500">
                            Requested on {new Date(req.createdAt).toLocaleDateString()}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-stone-100">
                          {isRequested ? (
                            <>
                              <button
                                onClick={() => openEditPottery(req)}
                                className="btn btn-secondary btn-sm text-xs flex items-center gap-1"
                              >
                                <Edit3 size={13} /> Edit
                              </button>
                              <button
                                onClick={() => handleCancelPottery(req.id)}
                                className="btn btn-outline btn-sm text-red-600 border-red-300 hover:bg-red-50 text-xs"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-stone-500 italic bg-stone-50 px-2.5 py-1 rounded border border-stone-200">
                              {req.status === 'accepted'
                                ? 'Accepted (In Kiln Queue)'
                                : req.status === 'declined'
                                ? 'Declined by Studio'
                                : 'Cancelled'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Edit Pottery Modal */}
      {editingPottery && (
        <div className="modal-overlay" onClick={() => setEditingPottery(null)}>
          <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-200">
              <h3 className="font-serif text-xl font-bold text-stone-900">
                Edit Pottery Request
              </h3>
              <button
                onClick={() => setEditingPottery(null)}
                className="p-1 text-stone-500 hover:text-stone-800"
              >
                <X size={20} />
              </button>
            </div>

            {editError && <ErrorAlert message={editError} onDismiss={() => setEditError(null)} />}

            <form onSubmit={handleSavePotteryEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Vessel Item
                </label>
                <select
                  value={editItemId}
                  onChange={(e) => setEditItemId(e.target.value)}
                  className="select text-sm"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Glaze
                </label>
                <select
                  value={editGlazeId}
                  onChange={(e) => setEditGlazeId(e.target.value)}
                  className="select text-sm"
                >
                  {glazes.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Quantity (1 to 12)
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(Number(e.target.value))}
                  className="input text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Needed-By Date (min 14 days in future)
                </label>
                <input
                  type="date"
                  value={editNeededDate}
                  onChange={(e) => setEditNeededDate(e.target.value)}
                  className="input text-sm"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setEditingPottery(null)}
                  className="btn btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="btn btn-primary text-sm"
                >
                  {editSaving ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
