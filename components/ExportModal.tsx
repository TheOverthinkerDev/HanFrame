import React, { useState, useEffect } from 'react';
import { Photo } from '../types';
import { Download, X, Check, FileType, Image as ImageIcon, Settings2 } from 'lucide-react';
import { ThumbnailCanvas } from './ThumbnailCanvas';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: Photo[];
  selectedId: string | null;
  onExport: (config: ExportConfig) => void;
}

export interface ExportConfig {
  selectedIds: string[];
  prefix: string;
  format: 'jpeg' | 'png';
  quality: number; // 0-1
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, photos, selectedId, onExport }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [prefix, setPrefix] = useState('edited');
  const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg');
  const [quality, setQuality] = useState(90);

  // Initialize selection when opening
  useEffect(() => {
    if (isOpen) {
      // Default to exporting all, or currently selected if user prefers
      setSelectedIds(photos.map(p => p.id));
    }
  }, [isOpen, photos]);

  if (!isOpen) return null;

  const handleToggleId = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => setSelectedIds(photos.map(p => p.id));
  const handleSelectNone = () => setSelectedIds([]);

  const handleSubmit = () => {
    onExport({
      selectedIds,
      prefix: prefix.trim() || 'image',
      format,
      quality: quality / 100
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Download size={20} className="text-blue-500" /> Export Options
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
            <X size={20} className="text-zinc-500" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            
            {/* Left: Settings */}
            <div className="w-full md:w-1/2 p-6 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto">
                <h3 className="text-sm font-bold uppercase text-zinc-500 mb-4 flex items-center gap-2">
                    <Settings2 size={14} /> Configuration
                </h3>

                <div className="space-y-5">
                    {/* Filename */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">File Name Prefix</label>
                        <input 
                            type="text" 
                            value={prefix}
                            onChange={(e) => setPrefix(e.target.value)}
                            placeholder="e.g. vacation_2024"
                            className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                        <p className="text-[10px] text-zinc-500 mt-1">Output: {prefix}_001.{format === 'jpeg' ? 'jpg' : 'png'}</p>
                    </div>

                    {/* Format */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Format</label>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setFormat('jpeg')}
                                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${format === 'jpeg' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50'}`}
                            >
                                JPEG
                            </button>
                            <button 
                                onClick={() => setFormat('png')}
                                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${format === 'png' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50'}`}
                            >
                                PNG
                            </button>
                        </div>
                    </div>

                    {/* Quality */}
                    <div>
                         <div className="flex justify-between mb-1">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Quality</label>
                            <span className="text-xs font-mono text-zinc-500">{quality}%</span>
                         </div>
                        <input 
                            type="range" 
                            min="10" 
                            max="100" 
                            value={quality}
                            onChange={(e) => setQuality(Number(e.target.value))}
                            className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <p className="text-[10px] text-zinc-500 mt-1">
                            {quality > 90 ? 'Low compression (Large file)' : quality < 50 ? 'High compression (Small file)' : 'Balanced'}
                        </p>
                    </div>

                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/50">
                        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                            <FileType size={14} className="shrink-0 mt-0.5" />
                            Files will be downloaded as a standard ZIP archive.
                        </p>
                    </div>
                </div>
            </div>

            {/* Right: Selection */}
            <div className="w-full md:w-1/2 flex flex-col h-96 md:h-auto">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
                    <h3 className="text-sm font-bold uppercase text-zinc-500 flex items-center gap-2">
                        <ImageIcon size={14} /> Select Photos ({selectedIds.length})
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={handleSelectAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">All</button>
                        <span className="text-zinc-300 dark:text-zinc-700">|</span>
                        <button onClick={handleSelectNone} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">None</button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2">
                    <div className="grid grid-cols-3 gap-2">
                        {photos.map(photo => {
                            const isSelected = selectedIds.includes(photo.id);
                            return (
                                <div 
                                    key={photo.id}
                                    onClick={() => handleToggleId(photo.id)}
                                    className={`relative aspect-square rounded-md overflow-hidden cursor-pointer border-2 transition-all ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                >
                                    <ThumbnailCanvas photo={photo} className="w-full h-full object-cover" />
                                    {isSelected && (
                                        <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-0.5 shadow-sm">
                                            <Check size={10} />
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex justify-end gap-3">
            <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
                Cancel
            </button>
            <button 
                onClick={handleSubmit}
                disabled={selectedIds.length === 0}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
                <Download size={16} /> Export {selectedIds.length} Photos
            </button>
        </div>

      </div>
    </div>
  );
};