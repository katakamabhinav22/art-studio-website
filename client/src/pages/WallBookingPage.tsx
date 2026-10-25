import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useNavigate, Link } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { WallBooking } from '../types/index.js';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { Calendar, Ruler, MapPin, IndianRupee, CheckCircle, AlertTriangle } from 'lucide-react';

function formatDateInput(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const WallBookingPage: React.FC = () => {
  const { user, isCustomer, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Seed rate state
  const [ratePerSqFt, setRatePerSqFt] = useState<number>(150);
  const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Form states
  const today = new Date();
  const minDateObj = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const maxDateObj = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

  const minDateStr = formatDateInput(minDateObj);
  const maxDateStr = formatDateInput(maxDateObj);

  const [bookingDate, setBookingDate] = useState<string>(minDateStr);
  const [wallSizeSqFt, setWallSizeSqFt] = useState<number>(50);
  const [address, setAddress] = useState<string>('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBooking, setSuccessBooking] = useState<WallBooking | null>(null);

  useEffect(() => {
    Promise.all([
      apiRequest<{ ratePerSqFt: number }>('/bookings/rate').catch(() => ({ ratePerSqFt: 150 })),
      apiRequest<{ unavailableDates: string[] }>('/bookings/unavailable-dates').catch(() => ({ unavailableDates: [] })),
    ])
      .then(([rateData, dateData]) => {
        if (rateData?.ratePerSqFt) setRatePerSqFt(rateData.ratePerSqFt);
        if (dateData?.unavailableDates) setUnavailableDates(dateData.unavailableDates);
      })
      .finally(() => setLoadingConfig(false));
  }, []);

  const calculatedPrice = Math.round(wallSizeSqFt * ratePerSqFt);
  const isDateUnavailable = unavailableDates.includes(bookingDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      navigate('/login?redirect=/wall-booking');
      return;
    }

    if (!isCustomer) {
      setError('Studio administrators cannot book murals. Please use a customer account.');
      return;
    }

    if (isDateUnavailable) {
      setError('The selected date has already been reserved. Please pick another date.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessBooking(null);

    try {
      const res = await apiRequest<{ message: string; booking: WallBooking }>('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          bookingDate,
          wallSizeSqFt,
          address: address.trim(),
        }),
      });

      setSuccessBooking(res.booking);
      setUnavailableDates((prev) => [...prev, bookingDate]);
    } catch (err: any) {
      setError(err.message || 'Failed to submit mural booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingConfig) {
    return <LoadingSpinner message="Loading studio scheduling configuration..." />;
  }

  return (
    <div className="py-12 container max-w-4xl">
      <div className="text-center mb-10">
        <span className="text-xs uppercase tracking-widest font-bold text-terracotta bg-primary-light px-3 py-1 rounded-full">
          Bespoke Commission
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900 mt-3 mb-3">
          Book a Custom Wall Painting
        </h1>
        <p className="text-stone-600 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
          Transform your interior or exterior wall into an original work of Indian folk art or modern mural.
          Our artists travel to your site with all pigments and equipment.
        </p>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {successBooking ? (
        <div className="card p-8 bg-white border-green-200 text-center shadow-md">
          <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={36} />
          </div>
          <h2 className="font-serif text-2xl font-bold text-stone-900 mb-2">
            Wall Booking Request Submitted!
          </h2>
          <p className="text-stone-600 text-sm max-w-md mx-auto mb-6">
            Your booking for <span className="font-semibold text-stone-900">{successBooking.bookingDate}</span> ({successBooking.wallSizeSqFt} sq ft) has been received. The studio will review and confirm your request.
          </p>

          <div className="p-4 bg-stone-50 rounded-lg max-w-sm mx-auto text-left text-xs space-y-2 mb-6 border border-stone-200">
            <div className="flex justify-between">
              <span className="text-stone-500">Booking ID:</span>
              <span className="font-mono font-semibold">{successBooking.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Scheduled Date:</span>
              <span className="font-semibold text-stone-900">{successBooking.bookingDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Calculated Price:</span>
              <span className="font-bold text-stone-900">₹{successBooking.price.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Status:</span>
              <span className="font-semibold text-amber-600 uppercase">Requested</span>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => {
                setSuccessBooking(null);
                setAddress('');
              }}
              className="btn btn-secondary text-sm"
            >
              Book Another Wall
            </button>
            <Link to="/dashboard" className="btn btn-primary text-sm">
              View in My Dashboard →
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="md:col-span-2 card p-6 bg-white border-stone-200 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Date Selection */}
              <div>
                <label className="block text-sm font-semibold text-stone-800 mb-1 flex items-center gap-1.5">
                  <Calendar size={16} className="text-primary" /> Select Booking Date
                </label>
                <p className="text-xs text-stone-500 mb-2">
                  Must be between 7 and 90 days from today (between {minDateStr} and {maxDateStr}).
                </p>
                <input
                  type="date"
                  min={minDateStr}
                  max={maxDateStr}
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  required
                  className="input text-sm"
                />
                {isDateUnavailable && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 mt-2 font-medium">
                    <AlertTriangle size={14} />
                    This date has already been booked by another customer. Please choose a different date.
                  </div>
                )}
              </div>

              {/* Wall Size Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-semibold text-stone-800 flex items-center gap-1.5">
                    <Ruler size={16} className="text-primary" /> Wall Surface Area (Square Feet)
                  </label>
                  <span className="text-sm font-bold text-stone-900 bg-stone-100 px-2.5 py-0.5 rounded">
                    {wallSizeSqFt} sq ft
                  </span>
                </div>
                <p className="text-xs text-stone-500 mb-3">
                  Allowed range: 10 sq ft to 500 sq ft.
                </p>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={5}
                  value={wallSizeSqFt}
                  onChange={(e) => setWallSizeSqFt(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer mb-2"
                />
                <div className="flex justify-between text-[11px] text-stone-400 font-semibold">
                  <span>10 sq ft (Mini accent)</span>
                  <span>250 sq ft (Living wall)</span>
                  <span>500 sq ft (Large exterior)</span>
                </div>
              </div>

              {/* Address Input */}
              <div>
                <label className="block text-sm font-semibold text-stone-800 mb-1 flex items-center gap-1.5">
                  <MapPin size={16} className="text-primary" /> Wall Location & Address
                </label>
                <p className="text-xs text-stone-500 mb-2">
                  Please provide the complete street address and property details for our artists.
                </p>
                <textarea
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Flat 402, Lotus Residency, Road No. 12, Banjara Hills, Hyderabad"
                  required
                  className="textarea text-sm"
                />
              </div>

              {/* Submit CTA */}
              <div className="pt-4 border-t border-stone-200">
                {isAdmin ? (
                  <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded border border-amber-200">
                    Logged in as Studio Administrator. Bookings can only be placed by Customer accounts.
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting || isDateUnavailable || !address.trim()}
                    className="btn btn-primary w-full py-3 text-base"
                  >
                    {submitting ? 'Submitting Request...' : `Confirm & Request Booking (₹${calculatedPrice.toLocaleString('en-IN')})`}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Pricing Summary Sidebar */}
          <div className="space-y-6">
            <div className="card p-6 bg-stone-50 border-stone-200">
              <h3 className="font-serif text-lg font-bold text-stone-900 mb-3 flex items-center gap-1.5">
                <IndianRupee size={18} className="text-terracotta" /> Transparent Pricing
              </h3>
              <p className="text-xs text-stone-600 mb-4 leading-relaxed">
                Our rate is standard and all-inclusive across canvas preparation, natural pigment preparation, and artist labor.
              </p>

              <div className="space-y-2.5 text-sm border-t border-b border-stone-200 py-3 mb-4">
                <div className="flex justify-between">
                  <span className="text-stone-600">Base Wall Rate:</span>
                  <span className="font-semibold text-stone-900">₹{ratePerSqFt} / sq ft</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Selected Surface:</span>
                  <span className="font-semibold text-stone-900">{wallSizeSqFt} sq ft</span>
                </div>
                <div className="flex justify-between text-base font-bold text-stone-900 pt-2 border-t border-stone-200">
                  <span>Total Calculated:</span>
                  <span className="text-primary font-bold">₹{calculatedPrice.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="text-xs text-stone-500 space-y-1.5">
                <div>• Single booking allowed per date.</div>
                <div>• Studio confirms or declines each request.</div>
                <div>• Cancellable up to 3 days before scheduled date.</div>
              </div>
            </div>

            {unavailableDates.length > 0 && (
              <div className="card p-4 bg-white border-stone-200">
                <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                  Currently Reserved Dates ({unavailableDates.length})
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {unavailableDates.map((date) => (
                    <span
                      key={date}
                      className="px-2 py-0.5 bg-stone-100 text-stone-600 rounded text-[11px] font-mono"
                    >
                      {date}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
