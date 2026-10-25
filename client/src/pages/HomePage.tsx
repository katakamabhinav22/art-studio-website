import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Palette, Home, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Painting } from '../types/index.js';
import { apiRequest } from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';

export const HomePage: React.FC = () => {
  const [featuredPaintings, setFeaturedPaintings] = useState<Painting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ paintings: Painting[] }>('/paintings')
      .then((data) => {
        setFeaturedPaintings(data.paintings.slice(0, 4));
      })
      .catch((err) => {
        console.error('Failed to load featured paintings:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-stone-900 text-white py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#c05621_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="container relative z-10 text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-terracotta text-white mb-6 uppercase tracking-wider">
            <Sparkles size={14} /> Traditional Indian Art & Living Murals
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Original Art Crafted with Soul and Heritage
          </h1>
          <p className="text-stone-300 text-lg sm:text-xl font-normal mb-8 leading-relaxed">
            Welcome to Varnika Art Studio. Discover one-of-a-kind traditional paintings, bespoke wall mural commissions, and handcrafted wheel-thrown pottery.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/paintings" className="btn btn-primary px-6 py-3 text-base">
              Explore Painting Catalogue <ArrowRight size={18} />
            </Link>
            <Link to="/wall-booking" className="btn btn-secondary px-6 py-3 text-base">
              Commission a Wall Mural
            </Link>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-16 container">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-serif text-3xl font-bold text-stone-900 mb-3">Our Dedicated Services</h2>
          <p className="text-stone-600">
            Each creation is an unrepeatable work of craftsmanship, from heritage folk canvases to hand-painted architectural murals.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Service 1: Paintings */}
          <div className="card p-6 flex flex-col justify-between hover:border-terracotta transition">
            <div>
              <div className="w-12 h-12 bg-primary-light text-primary rounded-lg flex items-center justify-center mb-4">
                <Palette size={26} />
              </div>
              <h3 className="font-serif text-xl font-bold text-stone-900 mb-2">Original Paintings</h3>
              <p className="text-stone-600 text-sm mb-4 leading-relaxed">
                Authentic Indian art traditions including Madhubani, Warli, Tanjore, and Kalamkari. Each painting is one-of-a-kind and sold only once.
              </p>
              <ul className="text-xs text-stone-500 space-y-1.5 mb-6">
                <li className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-600" /> Strictly one piece per work</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-600" /> Immediate availability locks</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-600" /> Easy order cancellation</li>
              </ul>
            </div>
            <Link to="/paintings" className="btn btn-outline w-full text-center">
              Browse Catalogue
            </Link>
          </div>

          {/* Service 2: Wall Murals */}
          <div className="card p-6 flex flex-col justify-between hover:border-terracotta transition">
            <div>
              <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-lg flex items-center justify-center mb-4">
                <Home size={26} />
              </div>
              <h3 className="font-serif text-xl font-bold text-stone-900 mb-2">Wall Murals on Booking</h3>
              <p className="text-stone-600 text-sm mb-4 leading-relaxed">
                Bring art into your living space. Select a convenient date between 7 and 90 days out, enter wall dimensions, and book online.
              </p>
              <ul className="text-xs text-stone-500 space-y-1.5 mb-6">
                <li className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-600" /> Transparent ₹150/sq ft rate</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-600" /> Single booking per date policy</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-600" /> Cancelable up to 3 days before</li>
              </ul>
            </div>
            <Link to="/wall-booking" className="btn btn-outline w-full text-center">
              Book a Mural
            </Link>
          </div>

          {/* Service 3: Custom Pottery */}
          <div className="card p-6 flex flex-col justify-between hover:border-terracotta transition">
            <div>
              <div className="w-12 h-12 bg-stone-100 text-stone-700 rounded-lg flex items-center justify-center mb-4">
                <Sparkles size={26} />
              </div>
              <h3 className="font-serif text-xl font-bold text-stone-900 mb-2">Bespoke Clay Pottery</h3>
              <p className="text-stone-600 text-sm mb-4 leading-relaxed">
                Custom clayware wheel-thrown and glazed to order. Choose from traditional Kulhads, Surahis, Matkas, and natural mineral glazes.
              </p>
              <ul className="text-xs text-stone-500 space-y-1.5 mb-6">
                <li className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-600" /> 5 traditional items & 6 glazes</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-600" /> Batches of 1 to 12 pieces</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-600" /> Editable while requested</li>
              </ul>
            </div>
            <Link to="/custom-pottery" className="btn btn-outline w-full text-center">
              Request Pottery
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Paintings Preview */}
      <section className="py-12 bg-stone-100 border-t border-b border-stone-200">
        <div className="container">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
            <div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">Featured Paintings</h2>
              <p className="text-stone-600 text-sm">Discover recent hand-painted masterworks from our studio artisans</p>
            </div>
            <Link to="/paintings" className="mt-2 sm:mt-0 text-sm font-semibold text-primary hover:underline flex items-center gap-1">
              View All 12 Works <ArrowRight size={16} />
            </Link>
          </div>

          {loading ? (
            <LoadingSpinner message="Loading paintings..." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredPaintings.map((painting) => (
                <div key={painting.id} className="card bg-white flex flex-col justify-between">
                  <div className="relative aspect-[4/3] bg-stone-200 overflow-hidden">
                    <img
                      src={`/${painting.imageUrl}`}
                      alt={painting.title}
                      className="w-full h-full object-cover transition duration-300 hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute top-2 right-2">
                      <StatusBadge status={painting.status} />
                    </div>
                  </div>
                  <div className="p-4 flex flex-col flex-1 justify-between">
                    <div>
                      <h4 className="font-serif font-bold text-stone-900 text-base mb-1 line-clamp-1">{painting.title}</h4>
                      <p className="text-xs text-stone-500 mb-2">By {painting.artist}</p>
                      <p className="text-xs text-stone-600 line-clamp-2 mb-3">{painting.description}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                      <span className="font-bold text-stone-900 text-sm">₹{painting.price.toLocaleString('en-IN')}</span>
                      <Link to="/paintings" className="text-xs font-semibold text-primary hover:underline">
                        Details →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
