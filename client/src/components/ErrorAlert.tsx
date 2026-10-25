import React from 'react';
import { AlertCircle, X, RotateCcw } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  message,
  onDismiss,
  onRetry,
}) => {
  if (!message) return null;

  return (
    <div className="flex items-center justify-between p-4 mb-6 bg-red-50 border border-red-200 rounded-lg text-red-700 shadow-sm">
      <div className="flex items-center gap-3">
        <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
        <span className="text-sm font-medium">{message}</span>
      </div>
      <div className="flex items-center gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn btn-sm btn-secondary flex items-center gap-1 text-xs"
          >
            <RotateCcw size={14} /> Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 text-red-600 hover:text-red-800 rounded transition"
            aria-label="Dismiss error"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
};
