import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Link, useNavigate } from 'react-router-dom';
import { Painting, Order } from '../types/index.js';
import { apiRequest, ApiError } from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { Search, ShoppingBag, Info, X, CheckCircle, ShieldAlert } from 'lucide-react';

export const PaintingsPage: React.FC = () => {
  const { user, isCustomer, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [paintings, setPaintings] = useState<Painting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<'all' | 'available' | 'sold'>('all');
  const [search, setSearch] = useState('');

  // Selected painting for details modal
  const [selectedPainting, setSelectedPainting] = useState<Painting | null>(null);

  // Purchase state
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{ message: string; order: Order } | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const fetchPaintings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ paintings: Painting[] }>('/paintings');
      setPaintings(data.paintings);
    } catch (err: any) {
      setError(err.message || 'Failed to load paintings catalogue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaintings();
  }, []);

  const handlePurchase = async (painting: Painting) => {
    if (!user) {
      navigate('/login?redirect=/paintings');
      return;
    }

    if (!isCustomer) {
      setPurchaseError('Administrators cannot purchase paintings. Please sign in as a customer.');
      return;
    }

    setPurchasingId(painting.id);
    setPurchaseError(null);
    setPurchaseSuccess(null);

    try {
      const data = await apiRequest<{ message: string; order: Order }>(
        `/paintings/${painting.id}/purchase`,
        { method: 'POST' }
      );

      setPurchaseSuccess(data);

      // Update painting in list to sold
      setPaintings((prev) =>
        prev.map((p) => (p.id === painting.id ? { ...p, status: 'sold' } : p))
      );

      if (selectedPainting && selectedPainting.id === painting.id) {
        setSelectedPainting({ ...selectedPainting, status: 'sold' });
      }
    } catch (err: any) {
      setPurchaseError(err.message || 'Failed to complete painting purchase');
    } finally {
      setPurchasingId(null);
    }
  };

  const filteredPaintings = paintings.filter((p) => {
    const matchesFilter = filter === 'all' ? true : p.status === filter;
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.artist.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="py-10 container">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900 mb-2">
          Original Painting Catalogue
        </h1>
        <p className="text-stone-600 max-w-2xl">
          Browse our collection of one-of-a-kind handcrafted paintings. Each work is completely unique and can only be sold once.
        </p>
      </div>

      {/* Global Alerts */}
      {purchaseSuccess && (
        <div className="p-4 mb-6 bg-green-50 border border-green-200 rounded-lg text-green-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
            <div>
              <div className="font-semibold">{purchaseSuccess.message}</div>
              <div className="text-xs text-green-700">Order ID: {purchaseSuccess.order.id}</div>
            </div>
          </div>
          <Link to="/dashboard" className="btn btn-secondary btn-sm text-xs">
            View in Dashboard →
          </Link>
        </div>
      )}

      {purchaseError && (
        <ErrorAlert message={purchaseError} onDismiss={() => setPurchaseError(null)} />
      )}

      {error && <ErrorAlert message={error} onRetry={fetchPaintings} />}

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8 bg-white p-4 rounded-lg border border-stone-200 shadow-sm">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilter('all')}
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          >
            All Works ({paintings.length})
          </button>
          <button
            onClick={() => setFilter('available')}
            className={`btn btn-sm ${filter === 'available' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Available ({paintings.filter((p) => p.status === 'available').length})
          </button>
          <button
            onClick={() => setFilter('sold')}
            className={`btn btn-sm ${filter === 'sold' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Sold ({paintings.filter((p) => p.status === 'sold').length})
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-3 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, artist, style..."
            className="input pl-9 py-2 text-sm"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && <LoadingSpinner message="Curating collection from studio gallery..." />}

      {/* Empty State */}
      {!loading && !error && filteredPaintings.length === 0 && (
        <EmptyState
          title="No paintings found"
          description={
            search
              ? `No paintings matched your search query "${search}". Try clearing your filters.`
              : 'There are currently no paintings in this category.'
          }
          action={
            search || filter !== 'all'
              ? {
                  label: 'Clear Filters',
                  onClick: () => {
                    setFilter('all');
                    setSearch('');
                  },
                }
              : undefined
          }
        />
      )}

      {/* Painting Cards Grid */}
      {!loading && !error && filteredPaintings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredPaintings.map((painting) => {
            const isAvailable = painting.status === 'available';
            const isProcessing = purchasingId === painting.id;

            return (
              <div
                key={painting.id}
                className="card bg-white flex flex-col justify-between group overflow-hidden border-stone-200"
              >
                {/* Image */}
                <div
                  className="relative aspect-[4/3] bg-stone-100 overflow-hidden cursor-pointer"
                  onClick={() => setSelectedPainting(painting)}
                >
                  <img
                    src={`/${painting.imageUrl}`}
                    alt={painting.title}
                    className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                      !isAvailable ? 'grayscale opacity-75' : ''
                    }`}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute top-3 right-3">
                    <StatusBadge status={painting.status} />
                  </div>
                  {!isAvailable && (
                    <div className="absolute inset-0 bg-stone-900/40 flex items-center justify-center">
                      <span className="px-3 py-1 bg-stone-900 text-white text-xs font-bold uppercase tracking-wider rounded">
                        Sold & In Collection
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col flex-1 justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3
                        className="font-serif font-bold text-stone-900 text-lg hover:text-primary transition cursor-pointer leading-snug"
                        onClick={() => setSelectedPainting(painting)}
                      >
                        {painting.title}
                      </h3>
                    </div>
                    <p className="text-xs font-medium text-stone-500 mb-2">By {painting.artist}</p>
                    <p className="text-sm text-stone-600 line-clamp-2 mb-4 leading-relaxed">
                      {painting.description}
                    </p>
                  </div>

                  {/* Actions & Price */}
                  <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-stone-400 uppercase tracking-wider font-semibold">Price</div>
                      <div className="text-lg font-bold text-stone-900">
                        ₹{painting.price.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedPainting(painting)}
                        className="btn btn-secondary btn-sm"
                        title="View detailed artwork specs"
                      >
                        <Info size={14} /> Details
                      </button>

                      {isAvailable ? (
                        isAdmin ? (
                          <span className="text-xs font-medium text-stone-500 bg-stone-100 px-2.5 py-1.5 rounded">
                            Admin Mode
                          </span>
                        ) : (
                          <button
                            onClick={() => handlePurchase(painting)}
                            disabled={isProcessing}
                            className="btn btn-primary btn-sm flex items-center gap-1.5"
                          >
                            <ShoppingBag size={14} />
                            {isProcessing ? 'Processing...' : 'Buy Now'}
                          </button>
                        )
                      ) : (
                        <button disabled className="btn btn-secondary btn-sm opacity-50 cursor-not-allowed">
                          Sold Out
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Painting Details Modal */}
      {selectedPainting && (
        <div className="modal-overlay" onClick={() => setSelectedPainting(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              {/* Close Button */}
              <button
                onClick={() => setSelectedPainting(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-white/80 hover:bg-white text-stone-700 rounded-full shadow transition"
              >
                <X size={20} />
              </button>

              <div className="max-h-80 w-full bg-stone-100 overflow-hidden flex items-center justify-center">
                <img
                  src={`/${selectedPainting.imageUrl}`}
                  alt={selectedPainting.title}
                  className="max-h-80 w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <h2 className="font-serif text-2xl font-bold text-stone-900">
                    {selectedPainting.title}
                  </h2>
                  <StatusBadge status={selectedPainting.status} />
                </div>

                <div className="text-sm font-semibold text-stone-600 mb-4">
                  Artist: <span className="text-stone-900 font-bold">{selectedPainting.artist}</span>
                </div>

                <div className="p-4 bg-stone-50 rounded-lg border border-stone-200 mb-6">
                  <h4 className="text-xs uppercase tracking-wider font-bold text-stone-500 mb-1">
                    Art Description & Medium
                  </h4>
                  <p className="text-sm text-stone-700 leading-relaxed">
                    {selectedPainting.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-stone-200">
                  <div>
                    <span className="text-xs text-stone-500 block">Total Investment</span>
                    <span className="text-2xl font-bold text-stone-900">
                      ₹{selectedPainting.price.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedPainting(null)}
                      className="btn btn-secondary"
                    >
                      Close
                    </button>

                    {selectedPainting.status === 'available' ? (
                      isAdmin ? (
                        <div className="text-xs text-stone-500 bg-stone-100 px-3 py-2 rounded flex items-center gap-1.5">
                          <ShieldAlert size={14} /> Administrators cannot buy inventory
                        </div>
                      ) : (
                        <button
                          onClick={() => handlePurchase(selectedPainting)}
                          disabled={purchasingId === selectedPainting.id}
                          className="btn btn-primary"
                        >
                          <ShoppingBag size={16} />
                          {purchasingId === selectedPainting.id ? 'Purchasing...' : 'Confirm Purchase'}
                        </button>
                      )
                    ) : (
                      <span className="btn btn-secondary opacity-50 cursor-not-allowed">
                        Already Sold
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
