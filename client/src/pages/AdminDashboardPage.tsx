import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useNavigate } from 'react-router-dom';
import { Painting, WallBooking, PotteryRequest, Order } from '../types/index.js';
import { apiRequest } from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import {
  Shield,
  Palette,
  Home,
  Sparkles,
  ShoppingBag,
  Plus,
  Edit2,
  Check,
  X,
  XCircle,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'paintings' | 'bookings' | 'pottery' | 'orders'>('paintings');

  // Master Lists
  const [paintings, setPaintings] = useState<Painting[]>([]);
  const [bookings, setBookings] = useState<WallBooking[]>([]);
  const [pottery, setPottery] = useState<PotteryRequest[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // Page Status
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add Painting Modal
  const [showAddPainting, setShowAddPainting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrice, setNewPrice] = useState<number | ''>('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [addingPainting, setAddingPainting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Painting Modal
  const [editingPainting, setEditingPainting] = useState<Painting | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState<number | ''>('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login?redirect=/admin');
      return;
    }
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    loadAdminData();
  }, [user, isAdmin, navigate]);

  const loadAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [paintingsRes, bookingsRes, potteryRes, ordersRes] = await Promise.all([
        apiRequest<{ paintings: Painting[] }>('/paintings'),
        apiRequest<{ bookings: WallBooking[] }>('/bookings'),
        apiRequest<{ requests: PotteryRequest[] }>('/pottery'),
        apiRequest<{ orders: Order[] }>('/orders'),
      ]);

      setPaintings(paintingsRes.paintings || []);
      setBookings(bookingsRes.bookings || []);
      setPottery(potteryRes.requests || []);
      setOrders(ordersRes.orders || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load administrator data');
    } finally {
      setLoading(false);
    }
  };

  // 1. Add Painting
  const handleAddPainting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrice || Number(newPrice) <= 0) {
      setAddError('Price must be greater than 0');
      return;
    }

    setAddingPainting(true);
    setAddError(null);

    try {
      const res = await apiRequest<{ message: string; painting: Painting }>('/paintings', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim(),
          artist: newArtist.trim(),
          description: newDescription.trim(),
          price: Number(newPrice),
          imageUrl: newImageUrl.trim() || 'images/p-001.jpg',
        }),
      });

      setSuccessMsg(res.message);
      setPaintings((prev) => [res.painting, ...prev]);
      setShowAddPainting(false);
      setNewTitle('');
      setNewArtist('');
      setNewDescription('');
      setNewPrice('');
      setNewImageUrl('');
    } catch (err: any) {
      setAddError(err.message || 'Failed to add painting');
    } finally {
      setAddingPainting(false);
    }
  };

  // 2. Open Edit Painting Modal
  const openEditPainting = (p: Painting) => {
    if (p.status !== 'available') {
      setError('Cannot edit a painting that has already been sold.');
      return;
    }
    setEditingPainting(p);
    setEditTitle(p.title);
    setEditArtist(p.artist);
    setEditDescription(p.description);
    setEditPrice(p.price);
    setEditImageUrl(p.imageUrl);
    setEditError(null);
  };

  // Save Painting Edit
  const handleSavePaintingEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPainting) return;

    setSavingEdit(true);
    setEditError(null);

    try {
      const res = await apiRequest<{ message: string; painting: Painting }>(
        `/paintings/${editingPainting.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            title: editTitle.trim(),
            artist: editArtist.trim(),
            description: editDescription.trim(),
            price: Number(editPrice),
            imageUrl: editImageUrl.trim(),
          }),
        }
      );

      setSuccessMsg('Painting updated successfully');
      setPaintings((prev) =>
        prev.map((p) => (p.id === editingPainting.id ? res.painting : p))
      );
      setEditingPainting(null);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update painting');
    } finally {
      setSavingEdit(false);
    }
  };

  // 3. Confirm or Decline Booking
  const handleBookingStatus = async (bookingId: string, status: 'confirmed' | 'declined') => {
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await apiRequest<{ message: string; booking: WallBooking }>(
        `/bookings/${bookingId}/status`,
        {
          method: 'PUT',
          body: JSON.stringify({ status }),
        }
      );
      setSuccessMsg(res.message);
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? res.booking : b))
      );
    } catch (err: any) {
      setError(err.message || `Failed to update booking status`);
    }
  };

  // 4. Accept or Decline Pottery
  const handlePotteryStatus = async (requestId: string, status: 'accepted' | 'declined') => {
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await apiRequest<{ message: string; request: PotteryRequest }>(
        `/pottery/${requestId}/status`,
        {
          method: 'PUT',
          body: JSON.stringify({ status }),
        }
      );
      setSuccessMsg(res.message);
      setPottery((prev) =>
        prev.map((p) => (p.id === requestId ? res.request : p))
      );
    } catch (err: any) {
      setError(err.message || `Failed to update pottery status`);
    }
  };

  return (
    <div className="py-10 container">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 mb-1">
            <Shield size={14} className="text-amber-800" /> Studio Administrator Command Center
          </span>
          <h1 className="font-serif text-3xl font-bold text-stone-900 mt-1">
            Studio Management Portal
          </h1>
          <p className="text-stone-600 text-sm">
            Manage painting inventory, review incoming mural dates, and process pottery commissions.
          </p>
        </div>

        {activeTab === 'paintings' && (
          <button
            onClick={() => setShowAddPainting(true)}
            className="btn btn-primary btn-sm flex items-center gap-1.5"
          >
            <Plus size={16} /> Add Painting
          </button>
        )}
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 mb-6 bg-green-50 border border-green-200 rounded-lg text-green-800 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-green-700 hover:text-green-900 font-bold">
            <X size={16} />
          </button>
        </div>
      )}

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} onRetry={loadAdminData} />}

      {/* Tabs */}
      <div className="flex border-b border-stone-200 mb-8 gap-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('paintings')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'paintings'
              ? 'border-primary text-primary'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Palette size={16} /> Painting Inventory ({paintings.length})
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
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'orders'
              ? 'border-primary text-primary'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <ShoppingBag size={16} /> Master Orders ({orders.length})
        </button>
      </div>

      {loading && <LoadingSpinner message="Fetching studio inventory and requests..." />}

      {!loading && (
        <>
          {/* TAB 1: PAINTINGS INVENTORY */}
          {activeTab === 'paintings' && (
            <div>
              {paintings.length === 0 ? (
                <EmptyState
                  title="No paintings in catalogue"
                  description="Add your first painting to open the studio catalogue to customers."
                  action={{
                    label: 'Add Painting',
                    onClick: () => setShowAddPainting(true),
                  }}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paintings.map((p) => {
                    const isAvailable = p.status === 'available';

                    return (
                      <div
                        key={p.id}
                        className="card bg-white p-5 border-stone-200 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-mono font-bold text-stone-400">
                              {p.id}
                            </span>
                            <StatusBadge status={p.status} />
                          </div>
                          <h4 className="font-serif font-bold text-stone-900 text-base mb-1">
                            {p.title}
                          </h4>
                          <p className="text-xs text-stone-500 mb-2">By {p.artist}</p>
                          <p className="text-xs text-stone-600 line-clamp-2 mb-4 leading-relaxed">
                            {p.description}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                          <span className="font-bold text-stone-900 text-base">
                            ₹{p.price.toLocaleString('en-IN')}
                          </span>

                          {isAvailable ? (
                            <button
                              onClick={() => openEditPainting(p)}
                              className="btn btn-secondary btn-sm text-xs flex items-center gap-1.5"
                            >
                              <Edit2 size={13} /> Edit Artwork
                            </button>
                          ) : (
                            <span
                              className="text-xs text-stone-400 italic"
                              title="Rule: Administrators can edit paintings only while they are available"
                            >
                              Locked (Sold)
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

          {/* TAB 2: WALL BOOKINGS REVIEW */}
          {activeTab === 'bookings' && (
            <div>
              {bookings.length === 0 ? (
                <EmptyState
                  title="No wall bookings requested"
                  description="Customer bookings for murals will appear here for review."
                />
              ) : (
                <div className="space-y-4">
                  {bookings.map((b) => (
                    <div
                      key={b.id}
                      className="card p-5 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 border-stone-200"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-stone-900 text-base">
                            Date: {b.bookingDate}
                          </h4>
                          <StatusBadge status={b.status} />
                        </div>
                        <div className="text-xs text-stone-600">
                          <strong>Customer:</strong> {b.customerName || 'Customer'} ({b.customerEmail})
                        </div>
                        <div className="text-xs text-stone-600">
                          <strong>Wall Size:</strong> {b.wallSizeSqFt} sq ft • <strong>Price:</strong> ₹{b.price.toLocaleString('en-IN')}
                        </div>
                        <div className="text-xs text-stone-500">
                          <strong>Address:</strong> {b.address}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-stone-100">
                        {b.status === 'requested' ? (
                          <>
                            <button
                              onClick={() => handleBookingStatus(b.id, 'confirmed')}
                              className="btn btn-primary btn-sm text-xs flex items-center gap-1 bg-green-700 hover:bg-green-800"
                            >
                              <Check size={14} /> Confirm
                            </button>
                            <button
                              onClick={() => handleBookingStatus(b.id, 'declined')}
                              className="btn btn-outline btn-sm text-xs text-red-600 border-red-300 hover:bg-red-50 flex items-center gap-1"
                            >
                              <XCircle size={14} /> Decline
                            </button>
                          </>
                        ) : (
                          <span className="text-xs font-semibold uppercase text-stone-500 px-3 py-1 bg-stone-100 rounded">
                            {b.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: POTTERY REQUESTS REVIEW */}
          {activeTab === 'pottery' && (
            <div>
              {pottery.length === 0 ? (
                <EmptyState
                  title="No custom pottery requests"
                  description="Customer pottery requests will appear here for review."
                />
              ) : (
                <div className="space-y-4">
                  {pottery.map((p) => (
                    <div
                      key={p.id}
                      className="card p-5 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 border-stone-200"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-stone-900 text-base">
                            {p.quantity}x {p.itemName} ({p.glazeName} Glaze)
                          </h4>
                          <StatusBadge status={p.status} />
                        </div>
                        <div className="text-xs text-stone-600">
                          <strong>Customer:</strong> {p.customerName || 'Customer'} ({p.customerEmail})
                        </div>
                        <div className="text-xs text-stone-600">
                          <strong>Needed By Date:</strong> {p.neededByDate}
                        </div>
                        <div className="text-xs text-stone-400">
                          Submitted: {new Date(p.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-stone-100">
                        {p.status === 'requested' ? (
                          <>
                            <button
                              onClick={() => handlePotteryStatus(p.id, 'accepted')}
                              className="btn btn-primary btn-sm text-xs flex items-center gap-1 bg-green-700 hover:bg-green-800"
                            >
                              <Check size={14} /> Accept Request
                            </button>
                            <button
                              onClick={() => handlePotteryStatus(p.id, 'declined')}
                              className="btn btn-outline btn-sm text-xs text-red-600 border-red-300 hover:bg-red-50 flex items-center gap-1"
                            >
                              <XCircle size={14} /> Decline Request
                            </button>
                          </>
                        ) : (
                          <span className="text-xs font-semibold uppercase text-stone-500 px-3 py-1 bg-stone-100 rounded">
                            {p.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ALL ORDERS */}
          {activeTab === 'orders' && (
            <div>
              {orders.length === 0 ? (
                <EmptyState
                  title="No painting purchases recorded"
                  description="When customers buy paintings, records will appear in this ledger."
                />
              ) : (
                <div className="space-y-4">
                  {orders.map((o) => (
                    <div
                      key={o.id}
                      className="card p-5 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 border-stone-200"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-stone-900 text-base">
                            {o.paintingTitle || 'Painting'}
                          </h4>
                          <StatusBadge status={o.status} />
                        </div>
                        <div className="text-xs text-stone-600">
                          <strong>Buyer:</strong> {o.customerName || 'Customer'} ({o.customerEmail})
                        </div>
                        <div className="text-xs text-stone-400">
                          Order Date: {new Date(o.createdAt).toLocaleString()} • ID: {o.id}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-bold text-stone-900">
                          ₹{o.price.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Add Painting Modal */}
      {showAddPainting && (
        <div className="modal-overlay" onClick={() => setShowAddPainting(false)}>
          <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-200">
              <h3 className="font-serif text-xl font-bold text-stone-900">
                Add New Painting to Catalogue
              </h3>
              <button onClick={() => setShowAddPainting(false)} className="text-stone-500 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            {addError && <ErrorAlert message={addError} onDismiss={() => setAddError(null)} />}

            <form onSubmit={handleAddPainting} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Lotus Awakening in Gond Style"
                  required
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Artist Name
                </label>
                <input
                  type="text"
                  value={newArtist}
                  onChange={(e) => setNewArtist(e.target.value)}
                  placeholder="e.g. Radhika Sharma"
                  required
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Price (INR ₹)
                </label>
                <input
                  type="number"
                  min={1}
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 12000"
                  required
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Image Path / URL (defaults to placeholder)
                </label>
                <input
                  type="text"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="images/p-001.jpg"
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Description & Medium
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe the art style, pigments, and dimensions..."
                  required
                  className="textarea text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowAddPainting(false)}
                  className="btn btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingPainting}
                  className="btn btn-primary text-sm"
                >
                  {addingPainting ? 'Adding...' : 'Add Painting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Painting Modal */}
      {editingPainting && (
        <div className="modal-overlay" onClick={() => setEditingPainting(null)}>
          <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-200">
              <h3 className="font-serif text-xl font-bold text-stone-900">
                Edit Painting: {editingPainting.id}
              </h3>
              <button onClick={() => setEditingPainting(null)} className="text-stone-500 hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            {editError && <ErrorAlert message={editError} onDismiss={() => setEditError(null)} />}

            <form onSubmit={handleSavePaintingEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Artist Name
                </label>
                <input
                  type="text"
                  value={editArtist}
                  onChange={(e) => setEditArtist(e.target.value)}
                  required
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Price (INR ₹)
                </label>
                <input
                  type="number"
                  min={1}
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Image Path / URL
                </label>
                <input
                  type="text"
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  required
                  className="input text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Description & Medium
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  required
                  className="textarea text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setEditingPainting(null)}
                  className="btn btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn btn-primary text-sm"
                >
                  {savingEdit ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
