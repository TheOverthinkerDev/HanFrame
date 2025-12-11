import React, { useState } from 'react';
import { Frame, Plus, Trash2, Image as ImageIcon, XCircle, Stamp, Layers, Copy, X } from 'lucide-react';

interface LeftSidebarProps {
  // Frame props
  uploadedFrames: string[];
  activeFrame: string | null;
  onUploadFrame: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectFrame: (url: string | null) => void;
  onDeleteFrame: (url: string) => void;
  onBatchFrame: () => void;
  
  // Logo props
  uploadedLogos: string[];
  hasLogos: boolean;
  onUploadLogo: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddLogoToPhoto: (url: string) => void;
  onDeleteLogoAsset: (url: string) => void;
  onBatchLogo: () => void;
}

type Tab = 'frames' | 'logos';

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  uploadedFrames,
  activeFrame,
  onUploadFrame,
  onSelectFrame,
  onDeleteFrame,
  onBatchFrame,
  uploadedLogos,
  hasLogos,
  onUploadLogo,
  onAddLogoToPhoto,
  onDeleteLogoAsset,
  onBatchLogo
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('frames');

  return (
    <div className="w-20 md:w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col h-full transition-colors duration-300 shrink-0 z-10">
      
      {/* Tab Header */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <button 
            onClick={() => setActiveTab('frames')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 text-xs font-medium transition-colors ${activeTab === 'frames' ? 'text-blue-600 dark:text-blue-500 border-b-2 border-blue-600 dark:border-blue-500' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
          >
              <Frame size={16} />
              <span className="hidden md:inline">Frames</span>
          </button>
          <button 
            onClick={() => setActiveTab('logos')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 text-xs font-medium transition-colors ${activeTab === 'logos' ? 'text-blue-600 dark:text-blue-500 border-b-2 border-blue-600 dark:border-blue-500' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
          >
              <Stamp size={16} />
              <span className="hidden md:inline">Logos</span>
          </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
        
        {/* --- FRAMES TAB --- */}
        {activeTab === 'frames' && (
            <div className="animate-in fade-in slide-in-from-left-2 duration-200">
                {/* Upload Frame */}
                <label className="flex flex-col items-center justify-center w-full h-20 mb-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-blue-500 dark:hover:border-blue-500 transition-all group">
                    <div className="flex flex-col items-center justify-center pt-2 pb-3">
                        <Plus className="w-5 h-5 mb-1 text-zinc-400 dark:text-zinc-500 group-hover:text-blue-500" />
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 group-hover:text-blue-500 font-medium uppercase text-center hidden md:block">Upload Frame</p>
                    </div>
                    <input type="file" className="hidden" accept="image/png,image/webp" onChange={onUploadFrame} />
                </label>

                {/* Batch Action & Remove Action */}
                {activeFrame && (
                    <div className="mb-4 space-y-2">
                        <button 
                            onClick={() => onSelectFrame(null)}
                            className="w-full py-2 px-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-xs rounded border border-red-200 dark:border-red-900/50 flex items-center justify-center gap-2 transition-colors"
                        >
                            <X size={12} /> Remove Current Frame
                        </button>
                        <button 
                            onClick={onBatchFrame}
                            className="w-full py-2 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs rounded border border-zinc-200 dark:border-zinc-700 flex items-center justify-center gap-2 transition-colors"
                        >
                            <Copy size={12} /> Apply Frame to All
                        </button>
                    </div>
                )}

                {/* Frame List */}
                <div className="grid grid-cols-1 gap-3">
                    {uploadedFrames.map((url, index) => (
                        <div 
                            key={index} 
                            className={`relative group w-full aspect-square rounded-lg bg-zinc-100 dark:bg-zinc-900 border-2 cursor-pointer overflow-hidden transition-all ${activeFrame === url ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                            onClick={() => onSelectFrame(url)}
                        >
                            <div className="absolute inset-2 bg-zinc-300 dark:bg-zinc-800 rounded-sm overflow-hidden flex items-center justify-center">
                                <ImageIcon size={16} className="text-zinc-400" />
                            </div>
                            <img src={url} alt="Frame" className="absolute inset-0 w-full h-full object-fill z-10 pointer-events-none" />
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteFrame(url); }}
                                className="absolute top-1 right-1 z-20 p-1.5 bg-red-500/90 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all shadow-md transform scale-90 hover:scale-100"
                                title="Delete from Library"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- LOGOS TAB --- */}
        {activeTab === 'logos' && (
             <div className="animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="mb-3 px-1">
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Logos are draggable layers on top of your photo.</p>
                </div>

                {/* Upload Logo */}
                <label className="flex flex-col items-center justify-center w-full h-20 mb-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-blue-500 dark:hover:border-blue-500 transition-all group">
                    <div className="flex flex-col items-center justify-center pt-2 pb-3">
                        <Plus className="w-5 h-5 mb-1 text-zinc-400 dark:text-zinc-500 group-hover:text-blue-500" />
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 group-hover:text-blue-500 font-medium uppercase text-center hidden md:block">Upload Logo</p>
                    </div>
                    <input type="file" className="hidden" accept="image/png,image/webp,image/jpeg" onChange={onUploadLogo} />
                </label>

                {/* Batch Action */}
                {hasLogos && (
                    <button 
                        onClick={onBatchLogo}
                        className="w-full mb-4 py-2 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs rounded border border-zinc-200 dark:border-zinc-700 flex items-center justify-center gap-2 transition-colors"
                    >
                        <Copy size={12} /> Sync Logos to All
                    </button>
                )}

                 {/* Logo List */}
                 <div className="grid grid-cols-2 gap-2">
                    {uploadedLogos.map((url, index) => (
                        <div 
                            key={index} 
                            className="relative group aspect-square rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 cursor-pointer overflow-hidden hover:border-blue-500 hover:shadow-md transition-all flex items-center justify-center p-2"
                            onClick={() => onAddLogoToPhoto(url)}
                            title="Click to add to photo"
                        >
                            <img src={url} alt="Logo" className="max-w-full max-h-full object-contain" />
                            
                            {/* Overlay on hover to indicate action */}
                            <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />

                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteLogoAsset(url); }}
                                className="absolute top-1 right-1 z-20 p-1 bg-red-500/90 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all shadow-md transform scale-90 hover:scale-100"
                            >
                                <Trash2 size={10} />
                            </button>
                        </div>
                    ))}
                </div>
                 {uploadedLogos.length === 0 && (
                    <div className="text-center mt-8 opacity-50">
                        <Layers size={24} className="mx-auto mb-2" />
                        <p className="text-xs">Library empty</p>
                    </div>
                )}
             </div>
        )}

      </div>
    </div>
  );
};