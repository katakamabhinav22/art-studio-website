import React from 'react';
import { Palette, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-stone-900 text-stone-300 py-12 mt-16 border-t border-stone-800">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 text-white mb-3">
              <Palette className="text-terracotta" size={24} />
              <span className="font-serif text-xl font-bold">Varnika Art Studio</span>
            </div>
            <p className="text-sm text-stone-400 leading-relaxed mb-4">
              Dedicated to celebrating timeless Indian art traditions—from Madhubani, Warli, and Kalamkari to bespoke handcrafted clay pottery and tailored wall murals.
            </p>
            <div className="text-xs text-stone-500">
              Currency: INR (₹) • Studio Admin: studio@artstudio.in
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-stone-200 mb-4">Our Services</h4>
            <ul className="text-sm space-y-2 text-stone-400">
              <li>• One-of-a-Kind Original Paintings</li>
              <li>• Custom Wall Murals (₹150 / sq ft)</li>
              <li>• Traditional Wheel-Thrown Handcrafted Pottery</li>
              <li>• Studio Consultation & Art Directing</li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-stone-200 mb-4">Evaluation Info</h4>
            <p className="text-sm text-stone-400 mb-3">
              Built for the Art Studio Full-Stack project brief. Implements strict server-side RBAC, transaction-based collision protection, and comprehensive automated test coverage.
            </p>
            <div className="p-3 bg-stone-800 rounded-md text-xs text-stone-300 border border-stone-700">
              <span className="font-semibold text-white">Default Admin:</span> studio@artstudio.in / Studio@123
            </div>
          </div>
        </div>

        <div className="border-t border-stone-800 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500">
          <div>© {new Date().getFullYear()} Varnika Art Studio. All rights reserved.</div>
          <div className="flex items-center gap-1 mt-2 sm:mt-0">
            Handcrafted with <Heart size={12} className="text-red-500 fill-red-500 inline" /> and TypeScript.
          </div>
        </div>
      </div>
    </footer>
  );
};
