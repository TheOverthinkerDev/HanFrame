import React from 'react';
import { Frame, Plus, Trash2, Image as ImageIcon, XCircle } from 'lucide-react';

interface LeftSidebarProps {
  uploadedFrames: string[];
  activeFrame: string | null;
  onUploadFrame: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectFrame: (url: string | null) => void;
  onDeleteFrame: (url: string) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  uploadedFrames,
  activeFrame,
  onUploadFrame,
  onSelectFrame,
  onDeleteFrame,
}) => {
  return (
    <div className="w-20 md:w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col h-full transition-colors duration-300 shrink-0 z-10">
      
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 bg-white dark:bg-zinc-950 sticky top-0">
        <Frame size={18} className="text-blue-600 dark:text-blue-500" />
        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 hidden md:inline">Frames</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
        {/* Upload Button */}
        <label className="flex flex-col items-center justify-center w-full h-24 mb-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-blue-500 dark:hover:border-blue-500 transition-all group">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Plus className="w-6 h-6 mb-1 text-zinc-400 dark:text-zinc-500 group-hover:text-blue-500" />
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 group-hover:text-blue-500 font-medium uppercase text-center hidden md:block">Upload PNG</p>
            </div>
            <input 
                type="file" 
                className="hidden" 
                accept="image/png,image/webp" 
                onChange={onUploadFrame} 
            />
        </label>

        {/* No Frame Option */}
        <div 
            onClick={() => onSelectFrame(null)}
            className={`relative w-full aspect-square mb-3 rounded-lg cursor-pointer border-2 transition-all flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 ${activeFrame === null ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-700'}`}
            title="No Frame"
        >
             <div className="flex flex-col items-center gap-1 text-zinc-400">
                <XCircle size={24} />
                <span className="text-[10px] hidden md:block">None</span>
             </div>
        </div>

        {/* Frame List */}
        <div className="grid grid-cols-1 gap-3">
            {uploadedFrames.map((url, index) => (
                <div 
                    key={index} 
                    className={`relative group w-full aspect-square rounded-lg bg-zinc-100 dark:bg-zinc-900 border-2 cursor-pointer overflow-hidden transition-all ${activeFrame === url ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                    onClick={() => onSelectFrame(url)}
                >
                    {/* Placeholder image inside frame to show effect */}
                    <div className="absolute inset-2 bg-zinc-300 dark:bg-zinc-800 rounded-sm overflow-hidden flex items-center justify-center">
                        <ImageIcon size={16} className="text-zinc-400" />
                    </div>
                    
                    {/* The Frame Overlay Preview */}
                    <img src={url} alt="Frame" className="absolute inset-0 w-full h-full object-fill z-10 pointer-events-none" />

                    {/* Delete Button */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteFrame(url); }}
                        className="absolute top-1 right-1 z-20 p-1.5 bg-red-500/90 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all shadow-md transform scale-90 hover:scale-100"
                        title="Delete Frame"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            ))}
        </div>
        
        {uploadedFrames.length === 0 && (
            <div className="text-center mt-4">
                <p className="text-xs text-zinc-500 hidden md:block">Upload transparent PNGs to create your library.</p>
            </div>
        )}

      </div>
    </div>
  );
};