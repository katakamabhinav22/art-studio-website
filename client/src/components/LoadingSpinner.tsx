import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading...',
  size = 'md',
}) => {
  const sizeMap = {
    sm: 16,
    md: 28,
    lg: 40,
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 text-stone-600 gap-3">
      <Loader2 size={sizeMap[size]} className="animate-spin text-primary" />
      {message && <p className="text-sm font-medium">{message}</p>}
    </div>
  );
};
