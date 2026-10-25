import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'painting' | 'order' | 'booking' | 'pottery';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normalized = status.toLowerCase();

  let styles = 'bg-stone-100 text-stone-700 border-stone-200';
  let label = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  switch (normalized) {
    case 'available':
      styles = 'bg-green-50 text-green-700 border-green-200';
      break;
    case 'sold':
      styles = 'bg-stone-800 text-white border-stone-800';
      break;
    case 'placed':
      styles = 'bg-blue-50 text-blue-700 border-blue-200';
      break;
    case 'requested':
      styles = 'bg-amber-50 text-amber-700 border-amber-200';
      break;
    case 'confirmed':
    case 'accepted':
      styles = 'bg-green-50 text-green-700 border-green-200';
      break;
    case 'declined':
      styles = 'bg-red-50 text-red-700 border-red-200';
      break;
    case 'cancelled':
      styles = 'bg-stone-100 text-stone-500 border-stone-200 line-through';
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles}`}
    >
      {label}
    </span>
  );
};
