import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useNavigate, Link } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { PotteryItem, PotteryGlaze, PotteryRequest } from '../types/index.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { Sparkles, Calendar, Layers, Hash, CheckCircle, Info } from 'lucide-react';

function formatDateInput(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const PotteryRequestPage: React.FC = () => {
  const { user, isCustomer, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<PotteryItem[]>([]);
  const [glazes, setGlazes] = useState<PotteryGlaze[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Form states
  const today = new Date();
  const minNeededDateObj = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const minDateStr = formatDateInput(minNeededDateObj);

  const [selectedItemId, setSelectedItemId] = useState<string>('i-01');
  const [selectedGlazeId, setSelectedGlazeId] = useState<string>('g-01');
  const [quantity, setQuantity] = useState<number>(4);
  const [neededByDate, setNeededByDate] = useState<string>(minDateStr);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successRequest, setSuccessRequest] = useState<PotteryRequest | null>(null);

  useEffect(() => {
    apiRequest<{ items: PotteryItem[]; glazes: PotteryGlaze[] }>('/pottery/options')
      .then((data) => {
        setItems(data.items);
        setGlazes(data.glazes);
        if (data.items.length > 0) setSelectedItemId(data.items[0].id);
        if (data.glazes.length > 0) setSelectedGlazeId(data.glazes[0].id);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load pottery configuration');
      })
      .finally(() => setLoadingOptions(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      navigate('/login?redirect=/custom-pottery');
      return;
    }

    if (!isCustomer) {
      setError('Studio administrators cannot submit pottery requests. Please use a customer account.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessRequest(null);

    try {
      const res = await apiRequest<{ message: string; request: PotteryRequest }>('/pottery', {
        method: 'POST',
        body: JSON.stringify({
          itemId: selectedItemId,
          glazeId: selectedGlazeId,
          quantity,
          neededByDate,
        }),
      });

      setSuccessRequest(res.request);
    } catch (err: any) {
      setError(err.message || 'Failed to submit pottery request');
    } finally {
      setSubmitting(false);
    }
  };

  const getGlazeColorPreview = (glazeId: string) => {
    switch (glazeId) {
      case 'g-01': return '#9b2c2c'; // Kumkum Red
      case 'g-02': return '#d69e2e'; // Haldi Yellow
      case 'g-03': return '#2f855a'; // Mehendi Green
      case 'g-04': return '#2b6cb0'; // Indigo Blue
      case 'g-05': return '#d6bcfa'; // Sandalwood Beige / warm
      case 'g-06': return '#2d3748'; // Charcoal Black
      default: return '#718096';
    }
  };

  if (loadingOptions) {
    return <LoadingSpinner message="Loading handcrafted pottery options..." />;
  }

  const selectedItemObj = items.find((i) => i.id === selectedItemId);
  const selectedGlazeObj = glazes.find((g) => g.id === selectedGlazeId);

  return (
    <div className="py-12 container max-w-4xl">
      <div className="text-center mb-10">
        <span className="text-xs uppercase tracking-widest font-bold text-terracotta bg-primary-light px-3 py-1 rounded-full">
          Studio Kiln Custom Orders
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900 mt-3 mb-3">
          Request Bespoke Custom Pottery
        </h1>
        <p className="text-stone-600 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
          Order authentic wheel-thrown terracotta and stoneware vessels finished with your chosen traditional mineral glaze.
        </p>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {successRequest ? (
        <div className="card p-8 bg-white border-green-200 text-center shadow-md">
          <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={36} />
          </div>
          <h2 className="font-serif text-2xl font-bold text-stone-900 mb-2">
            Pottery Request Submitted!
          </h2>
          <p className="text-stone-600 text-sm max-w-md mx-auto mb-6">
            Your request for <span className="font-semibold text-stone-900">{successRequest.quantity}x {successRequest.itemName}</span> in <span className="font-semibold text-stone-900">{successRequest.glazeName}</span> glaze has been queued.
          </p>

          <div className="p-4 bg-stone-50 rounded-lg max-w-sm mx-auto text-left text-xs space-y-2 mb-6 border border-stone-200">
            <div className="flex justify-between">
              <span className="text-stone-500">Request ID:</span>
              <span className="font-mono font-semibold">{successRequest.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Item:</span>
              <span className="font-semibold text-stone-900">{successRequest.itemName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Glaze:</span>
              <span className="font-semibold text-stone-900">{successRequest.glazeName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Quantity:</span>
              <span className="font-semibold text-stone-900">{successRequest.quantity} piece(s)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Needed By:</span>
              <span className="font-semibold text-stone-900">{successRequest.neededByDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Status:</span>
              <span className="font-semibold text-amber-600 uppercase">Requested</span>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => {
                setSuccessRequest(null);
                setQuantity(4);
              }}
              className="btn btn-secondary text-sm"
            >
              Request Another Pottery Piece
            </button>
            <Link to="/dashboard" className="btn btn-primary text-sm">
              Track in My Dashboard →
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="md:col-span-2 card p-6 bg-white border-stone-200 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Item Selection */}
              <div>
                <label className="block text-sm font-semibold text-stone-800 mb-1 flex items-center gap-1.5">
                  <Layers size={16} className="text-primary" /> Choose Pottery Vessel
                </label>
                <p className="text-xs text-stone-500 mb-2">
                  Select a traditional handcrafted clayware piece from our seed catalogue.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className={`p-3 rounded-lg border text-left transition flex items-center justify-between text-sm ${
                        selectedItemId === item.id
                          ? 'border-primary bg-primary-light font-bold text-primary'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                      }`}
                    >
                      <span>{item.name}</span>
                      <span className="text-xs text-stone-400 font-mono">[{item.id}]</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Glaze Selection */}
              <div>
                <label className="block text-sm font-semibold text-stone-800 mb-1 flex items-center gap-1.5">
                  <Sparkles size={16} className="text-primary" /> Select Natural Glaze
                </label>
                <p className="text-xs text-stone-500 mb-2">
                  Traditional mineral glazes fired at high kiln temperatures.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {glazes.map((glaze) => (
                    <button
                      type="button"
                      key={glaze.id}
                      onClick={() => setSelectedGlazeId(glaze.id)}
                      className={`p-2.5 rounded-lg border text-left transition flex items-center gap-2 text-xs ${
                        selectedGlazeId === glaze.id
                          ? 'border-primary bg-primary-light font-bold text-primary'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-stone-300"
                        style={{ backgroundColor: getGlazeColorPreview(glaze.id) }}
                      />
                      <span className="truncate">{glaze.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-semibold text-stone-800 flex items-center gap-1.5">
                    <Hash size={16} className="text-primary" /> Quantity (1 to 12 pieces)
                  </label>
                  <span className="text-sm font-bold text-stone-900 bg-stone-100 px-2.5 py-0.5 rounded">
                    {quantity} piece{quantity > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mb-3">
                  Each batch is hand-thrown on the wheel. Maximum 12 pieces per order.
                </p>
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer mb-2"
                />
                <div className="flex justify-between text-[11px] text-stone-400 font-semibold">
                  <span>1 piece</span>
                  <span>6 pieces (Half set)</span>
                  <span>12 pieces (Full set)</span>
                </div>
              </div>

              {/* Needed-by Date Selection */}
              <div>
                <label className="block text-sm font-semibold text-stone-800 mb-1 flex items-center gap-1.5">
                  <Calendar size={16} className="text-primary" /> Needed-By Date
                </label>
                <p className="text-xs text-stone-500 mb-2">
                  Pottery requires drying, bisque firing, glazing, and final firing. Date must be at least 14 days in the future (on or after {minDateStr}).
                </p>
                <input
                  type="date"
                  min={minDateStr}
                  value={neededByDate}
                  onChange={(e) => setNeededByDate(e.target.value)}
                  required
                  className="input text-sm"
                />
              </div>

              {/* Submit CTA */}
              <div className="pt-4 border-t border-stone-200">
                {isAdmin ? (
                  <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded border border-amber-200">
                    Logged in as Studio Administrator. Pottery requests can only be placed by Customer accounts.
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary w-full py-3 text-base"
                  >
                    {submitting ? 'Submitting Request...' : `Submit Pottery Request (${quantity}x ${selectedItemObj?.name || 'Item'})`}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Guidelines Sidebar */}
          <div className="space-y-6">
            <div className="card p-6 bg-stone-50 border-stone-200">
              <h3 className="font-serif text-lg font-bold text-stone-900 mb-3 flex items-center gap-1.5">
                <Info size={18} className="text-terracotta" /> Studio Kiln Policy
              </h3>
              <p className="text-xs text-stone-600 mb-4 leading-relaxed">
                Every pottery request is individually reviewed by our master potters before the clay wheel preparation begins.
              </p>

              <div className="text-xs text-stone-600 space-y-2 border-t border-b border-stone-200 py-3 mb-4">
                <div>
                  <strong className="text-stone-900">14-Day Minimum:</strong> Allows sufficient clay curing, bisque firing, and glazed firing cycles.
                </div>
                <div>
                  <strong className="text-stone-900">Quantities 1–12:</strong> Hand-crafted studio scale ensures uniform thickness and finish.
                </div>
                <div>
                  <strong className="text-stone-900">Editable While Requested:</strong> You can modify or cancel your request anytime before the studio accepts it.
                </div>
              </div>

              <div className="p-3 bg-white rounded border border-stone-200 text-xs text-stone-600">
                <span className="font-semibold text-stone-800 block mb-1">Current Selection:</span>
                <div>• {selectedItemObj?.name}</div>
                <div>• {selectedGlazeObj?.name} glaze</div>
                <div>• {quantity} piece(s)</div>
                <div>• By {neededByDate}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
