import React from 'react';
import { Photo } from '../types';
import { Plus, X } from 'lucide-react';
import { ThumbnailCanvas } from './ThumbnailCanvas';

interface FilmstripProps {
  photos: Photo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: string, e: React.MouseEvent) => void;
}

export const Filmstrip: React.FC<FilmstripProps> = ({ photos, selectedId, onSelect, onAdd, onRemove }) => {
  return (
    <div className="h-32 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0 transition-colors duration-300">
      <div className="flex-1 flex overflow-x-auto overflow-y-hidden p-2 space-x-2 items-center custom-scrollbar">
        
        {/* Upload Button */}
        <label className="shrink-0 w-24 h-24 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all group">
          <Plus className="text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 mb-1" size={24} />
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium uppercase tracking-wide group-hover:text-zinc-600 dark:group-hover:text-zinc-300">Add Photos</span>
          {/* Allow all image formats supported by the browser */}
          <input 
            type="file" 
            multiple 
            accept="image/*" 
            className="hidden" 
            onChange={onAdd} 
          />
        </label>

        {/* Thumbnails */}
        {photos.map((photo) => (
          <div 
            key={photo.id}
            onClick={() => onSelect(photo.id)}
            className={`relative group shrink-0 w-24 h-24 bg-zinc-100 dark:bg-zinc-900 rounded-md overflow-hidden cursor-pointer border-2 transition-all ${selectedId === photo.id ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-600'}`}
          >
            {/* Use ThumbnailCanvas instead of img for composite preview */}
            <ThumbnailCanvas photo={photo} />
            
            {/* Cropped Indicator (Small icon) */}
            {photo.crop && (
               <div className="absolute top-1 left-1 bg-black/50 p-0.5 rounded pointer-events-none">
                   <div className="w-2 h-2 border border-white/80" />
               </div>
            )}
            
            {/* Remove Button */}
            <button 
              onClick={(e) => onRemove(photo.id, e)}
              className="absolute top-1 right-1 p-0.5 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all z-10"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        
        {/* Spacer for right padding */}
        <div className="w-4 shrink-0" />
      </div>
      
      <div className="h-6 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-3 transition-colors">
        <span className="text-[10px] text-zinc-500">{photos.length} photos</span>
        <span className="text-[10px] text-zinc-500">Press 'Add Photos' to start</span>
      </div>
    </div>
  );
};