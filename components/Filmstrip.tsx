import React from 'react';
import { Photo } from '../types';
import { Plus, X, ImagePlus, Stamp } from 'lucide-react';
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
    <div className="h-28 bg-white/90 dark:bg-zinc-950/90 border-t border-zinc-200 dark:border-zinc-800 backdrop-blur-md flex flex-col shrink-0 transition-colors duration-300">
      
      {/* Strip Container */}
      <div className="flex-1 flex overflow-x-auto overflow-y-hidden items-center px-4 gap-3 custom-scrollbar">
        
        {/* Compact Upload Button */}
        <label className="shrink-0 w-16 h-16 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 dark:hover:bg-zinc-800 hover:border-blue-400 dark:hover:border-zinc-600 transition-all group shadow-sm">
          <ImagePlus className="text-zinc-400 dark:text-zinc-500 group-hover:text-blue-500" size={20} />
          {/* Allow all image formats supported by the browser */}
          <input 
            type="file" 
            multiple 
            accept="image/*" 
            className="hidden" 
            onChange={onAdd} 
          />
        </label>

        {/* Separator */}
        <div className="w-px h-10 bg-zinc-200 dark:bg-zinc-800 mx-1 shrink-0" />

        {/* Thumbnails */}
        {photos.map((photo) => {
          // Identify Primary Brand/Logo for Badge
          const primaryLogo = photo.logos.length > 0 ? photo.logos[photo.logos.length - 1] : null;

          return (
            <div 
              key={photo.id}
              onClick={() => onSelect(photo.id)}
              className={`relative group shrink-0 w-20 h-20 bg-zinc-100 dark:bg-zinc-900 rounded-lg overflow-hidden cursor-pointer border-2 transition-all shadow-sm ${selectedId === photo.id ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md scale-105 z-10' : 'border-transparent opacity-70 hover:opacity-100 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
            >
              {/* Use ThumbnailCanvas instead of img for composite preview */}
              <ThumbnailCanvas photo={photo} />
              
              {/* Indicators Container */}
              <div className="absolute top-0 left-0 right-0 p-1 flex justify-between pointer-events-none">
                  {/* Cropped Indicator */}
                  {photo.crop && (
                     <div className="w-2 h-2 bg-blue-500 rounded-full shadow-sm" title="Cropped" />
                  )}
              </div>

              {/* Logo Badge (Bottom) */}
              {primaryLogo && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-[2px] px-1 py-0.5 flex items-center justify-center pointer-events-none">
                      <span className="text-[8px] font-bold text-white truncate max-w-full leading-none">
                          {primaryLogo.name || 'Brand'}
                      </span>
                  </div>
              )}
              
              {/* Remove Button */}
              <button 
                onClick={(e) => onRemove(photo.id, e)}
                className="absolute top-0.5 right-0.5 p-1 bg-black/60 hover:bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
              >
                <X size={10} />
              </button>
            </div>
          );
        })}
        
        {/* End Padding */}
        <div className="w-4 shrink-0" />
      </div>
      
      {/* Footer Status */}
      <div className="h-5 bg-zinc-50 dark:bg-black/20 border-t border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between px-3">
        <span className="text-[9px] font-medium text-zinc-400 uppercase tracking-wider">{photos.length} item{photos.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
};