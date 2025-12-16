import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
  className?: string;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast, className }) => {
  // Use passed className or fallback to bottom-fixed default
  const containerClass = className || "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none";

  return (
    <div className={containerClass}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: () => void }> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  return (
    <div className={`
      pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-md shadow-sm border backdrop-blur-md animate-in slide-in-from-left-2 fade-in duration-300
      ${toast.type === 'success' 
        ? 'bg-zinc-100/80 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100' 
        : 'bg-red-50/90 dark:bg-red-900/40 border-red-200 dark:border-red-900 text-red-600 dark:text-red-200'}
    `}>
      {toast.type === 'success' ? <CheckCircle size={14} className="text-green-500" /> : <AlertCircle size={14} />}
      <span className="text-xs font-medium whitespace-nowrap">{toast.message}</span>
      <button onClick={onRemove} className="ml-1 opacity-50 hover:opacity-100">
        <X size={12} />
      </button>
    </div>
  );
};