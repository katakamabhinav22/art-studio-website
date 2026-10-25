import React, { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-lg border border-stone-200">
      <div className="p-3 bg-stone-100 rounded-full text-stone-500 mb-4">
        {icon || <Sparkles size={32} />}
      </div>
      <h3 className="text-lg font-bold text-stone-800 mb-2">{title}</h3>
      <p className="text-sm text-stone-600 max-w-md mb-6">{description}</p>
      {action && (
        <button onClick={action.onClick} className="btn btn-primary btn-sm">
          {action.label}
        </button>
      )}
    </div>
  );
};
