import React from 'react';
import { Loader2 } from 'lucide-react';

interface ProcessingModalProps {
  isOpen: boolean;
  message: string;
  progress: number; // 0 to 100
}

export const ProcessingModal: React.FC<ProcessingModalProps> = ({ isOpen, message, progress }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-80 shadow-2xl flex flex-col items-center text-center">
        <div className="mb-4 text-blue-500 animate-spin">
          <Loader2 size={32} />
        </div>
        <h3 className="text-zinc-200 font-semibold mb-1">{message}</h3>
        <p className="text-zinc-500 text-xs mb-4">Please wait...</p>
        
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden relative">
          <div 
            className="absolute left-0 top-0 bottom-0 bg-blue-600 transition-all duration-200 ease-out" 
            style={{ width: `${progress}%` }} 
          />
        </div>
        <div className="text-zinc-400 text-xs mt-2 font-mono">{Math.round(progress)}%</div>
      </div>
    </div>
  );
};