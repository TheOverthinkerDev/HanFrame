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
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
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
      pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-md animate-in slide-in-from-bottom-5 fade-in duration-300
      ${toast.type === 'success' 
        ? 'bg-zinc-900/90 dark:bg-zinc-800/90 border-zinc-700 text-zinc-100' 
        : 'bg-red-600/90 dark:bg-red-900/90 border-red-500 dark:border-red-700 text-white'}
    `}>
      {toast.type === 'success' ? <CheckCircle size={18} className="text-green-500" /> : <AlertCircle size={18} />}
      <span className="text-sm font-medium">{toast.message}</span>
      <button onClick={onRemove} className="ml-2 opacity-50 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
};