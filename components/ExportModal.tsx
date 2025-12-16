import React, { useState, useEffect, useRef } from 'react';
import { Photo } from '../types';
import { Download, X, Check, Settings2, Minimize2, Type, Layers, FolderPlus, Folder, Trash2, GripVertical, AlertCircle } from 'lucide-react';
import { ThumbnailCanvas } from './ThumbnailCanvas';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: Photo[];
  selectedId: string | null;
  onExport: (config: ExportConfig) => void;
}

export interface FolderStructure {
    id: string;
    name: string;
    photoIds: string[];
}

export interface ExportConfig {
  // Naming
  namingMode: 'sequence' | 'original';
  prefix: string; // for sequence
  suffix: string; // for original
  // Structure
  structure: FolderStructure[]; // Custom folders
  rootPhotoIds: string[]; // Photos staying in root
  // Format
  format: 'jpeg' | 'png' | 'webp';
  quality: number; // 0-1
  // Resizing
  resizeMode: 'original' | 'width' | 'height' | 'scale';
  resizeValue: number; // px or percentage
  // Layers
  includeLogos: boolean;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, photos, selectedId, onExport }) => {
  // Selection State (Subset of photos available for export)
  // Initially select all photos
  const [availableIds, setAvailableIds] = useState<string[]>([]);
  
  // Organization State
  const [folders, setFolders] = useState<FolderStructure[]>([]);
  const [rootIds, setRootIds] = useState<string[]>([]); // Ids currently in "Unsorted"
  
  // Drag State
  const [draggingPhotoId, setDraggingPhotoId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null); // 'root' or folder UUID

  // Settings State
  const [namingMode, setNamingMode] = useState<'sequence' | 'original'>('original');
  const [prefix, setPrefix] = useState('photo');
  const [suffix, setSuffix] = useState('_edit');
  
  const [format, setFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg');
  const [quality, setQuality] = useState(90);
  
  const [resizeMode, setResizeMode] = useState<'original' | 'width' | 'height' | 'scale'>('original');
  const [resizeValue, setResizeValue] = useState(1920);
  
  const [includeLogos, setIncludeLogos] = useState(true);

  // Initialize
  useEffect(() => {
    if (isOpen) {
      const allIds = photos.map(p => p.id);
      setAvailableIds(allIds);
      setRootIds(allIds);
      setFolders([]);
    }
  }, [isOpen, photos]);

  if (!isOpen) return null;

  // --- Folder Management ---

  const handleCreateFolder = () => {
      const newFolder: FolderStructure = {
          id: crypto.randomUUID(),
          name: `Folder ${folders.length + 1}`,
          photoIds: []
      };
      setFolders([...folders, newFolder]);
  };

  const handleDeleteFolder = (folderId: string) => {
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return;
      // Move photos back to root
      setRootIds(prev => [...prev, ...folder.photoIds]);
      setFolders(prev => prev.filter(f => f.id !== folderId));
  };

  const handleRenameFolder = (folderId: string, newName: string) => {
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: newName } : f));
  };

  // --- Drag & Drop Logic ---

  const handleDragStart = (e: React.DragEvent, photoId: string) => {
      setDraggingPhotoId(photoId);
      e.dataTransfer.effectAllowed = 'move';
      // Required for Firefox
      e.dataTransfer.setData('text/plain', photoId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverFolderId !== targetId) {
          setDragOverFolderId(targetId);
      }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      setDragOverFolderId(null);
      const photoId = draggingPhotoId;
      if (!photoId) return;

      // 1. Remove from source (could be root or another folder)
      let sourceFound = false;
      
      // Check Root
      if (rootIds.includes(photoId)) {
          if (targetId === 'root') return; // Drop on self
          setRootIds(prev => prev.filter(id => id !== photoId));
          sourceFound = true;
      } else {
          // Check Folders
          const sourceFolder = folders.find(f => f.photoIds.includes(photoId));
          if (sourceFolder) {
              if (sourceFolder.id === targetId) return; // Drop on self
              
              setFolders(prev => prev.map(f => {
                  if (f.id === sourceFolder.id) {
                      return { ...f, photoIds: f.photoIds.filter(id => id !== photoId) };
                  }
                  return f;
              }));
              sourceFound = true;
          }
      }

      if (!sourceFound) return;

      // 2. Add to target
      if (targetId === 'root') {
          setRootIds(prev => [...prev, photoId]);
      } else {
          setFolders(prev => prev.map(f => {
              if (f.id === targetId) {
                  return { ...f, photoIds: [...f.photoIds, photoId] };
              }
              return f;
          }));
      }
      setDraggingPhotoId(null);
  };

  const handleSubmit = () => {
    // Only export photos that are in rootIds or inside folders
    onExport({
      namingMode,
      prefix: prefix.trim() || 'image',
      suffix: suffix.trim(),
      structure: folders,
      rootPhotoIds: rootIds,
      format,
      quality: quality / 100,
      resizeMode,
      resizeValue,
      includeLogos
    });
    onClose();
  };

  // Helper to render photo grid items
  const renderPhotoItem = (photoId: string) => {
      const photo = photos.find(p => p.id === photoId);
      if (!photo) return null;
      return (
          <div 
            key={photoId}
            draggable
            onDragStart={(e) => handleDragStart(e, photoId)}
            className={`
                relative aspect-square rounded overflow-hidden cursor-grab active:cursor-grabbing border bg-zinc-100 dark:bg-zinc-800
                ${draggingPhotoId === photoId ? 'opacity-50' : 'opacity-100 hover:border-blue-500'}
            `}
          >
              <ThumbnailCanvas photo={photo} className="w-full h-full object-cover pointer-events-none" />
          </div>
      );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-5xl h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Download size={20} className="text-blue-500" /> Export Manager
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
            <X size={20} className="text-zinc-500" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            
            {/* Left: Global Settings */}
            <div className="w-full md:w-80 p-5 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto custom-scrollbar bg-zinc-50/30 dark:bg-zinc-900/30 shrink-0">
                <div className="space-y-6">
                    {/* 1. Naming */}
                    <section>
                         <h3 className="text-xs font-bold uppercase text-zinc-500 mb-3 flex items-center gap-2">
                            <Type size={14} /> File Naming
                        </h3>
                        <div className="flex gap-2 mb-3">
                            <button onClick={() => setNamingMode('original')} className={`flex-1 py-1.5 px-2 rounded border text-[10px] font-bold uppercase ${namingMode === 'original' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'}`}>Original</button>
                            <button onClick={() => setNamingMode('sequence')} className={`flex-1 py-1.5 px-2 rounded border text-[10px] font-bold uppercase ${namingMode === 'sequence' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'}`}>Sequence</button>
                        </div>
                        {namingMode === 'original' ? (
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Suffix</label>
                                <input type="text" value={suffix} onChange={(e) => setSuffix(e.target.value)} className="w-full px-2 py-1.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm" />
                            </div>
                        ) : (
                             <div>
                                <label className="block text-xs text-zinc-500 mb-1">Prefix</label>
                                <input type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)} className="w-full px-2 py-1.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm" />
                            </div>
                        )}
                    </section>
                    <div className="h-px bg-zinc-200 dark:bg-zinc-800" />
                    
                    {/* 2. Format */}
                    <section>
                        <h3 className="text-xs font-bold uppercase text-zinc-500 mb-3 flex items-center gap-2">
                            <Settings2 size={14} /> Format
                        </h3>
                        <div className="flex gap-2 mb-3">
                            {(['jpeg', 'png', 'webp'] as const).map(f => (
                                <button key={f} onClick={() => setFormat(f)} className={`flex-1 py-1.5 px-2 rounded border text-[10px] font-bold uppercase ${format === f ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'}`}>{f}</button>
                            ))}
                        </div>
                        {format !== 'png' && (
                            <div>
                                <div className="flex justify-between mb-1"><label className="text-xs text-zinc-500">Quality</label><span className="text-xs font-mono">{quality}%</span></div>
                                <input type="range" min="10" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                            </div>
                        )}
                    </section>
                    <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

                    {/* 3. Resize */}
                     <section>
                        <h3 className="text-xs font-bold uppercase text-zinc-500 mb-3 flex items-center gap-2">
                            <Minimize2 size={14} /> Resize
                        </h3>
                        <select 
                            value={resizeMode} 
                            onChange={(e) => setResizeMode(e.target.value as any)}
                            className="w-full mb-2 px-2 py-1.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm"
                        >
                            <option value="original">Original Size</option>
                            <option value="width">Fixed Width</option>
                            <option value="height">Fixed Height</option>
                            <option value="scale">Scale (%)</option>
                        </select>
                        {resizeMode !== 'original' && (
                             <input type="number" value={resizeValue} onChange={(e) => setResizeValue(Number(e.target.value))} className="w-full px-2 py-1.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm" />
                        )}
                    </section>
                    <div className="h-px bg-zinc-200 dark:bg-zinc-800" />
                    
                    {/* 4. Options */}
                    <section>
                         <h3 className="text-xs font-bold uppercase text-zinc-500 mb-3 flex items-center gap-2">
                            <Layers size={14} /> Options
                        </h3>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={includeLogos} onChange={(e) => setIncludeLogos(e.target.checked)} className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500" />
                            <span className="text-sm text-zinc-700 dark:text-zinc-300">Logos & Watermarks</span>
                        </label>
                    </section>
                </div>
            </div>

            {/* Right: Organizer */}
            <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950">
                
                {/* Organizer Header */}
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Folder size={16} className="text-blue-500" />
                        <h3 className="text-sm font-bold uppercase text-zinc-500">Folder Organizer</h3>
                    </div>
                    <button 
                        onClick={handleCreateFolder}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded border border-blue-200 dark:border-blue-900/50 text-xs font-medium transition-colors"
                    >
                        <FolderPlus size={14} /> New Folder
                    </button>
                </div>
                
                {/* Organizer Canvas */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4 bg-zinc-100/50 dark:bg-zinc-950/50">
                    
                    {/* ROOT / UNSORTED AREA */}
                    <div 
                        onDragOver={(e) => handleDragOver(e, 'root')}
                        onDrop={(e) => handleDrop(e, 'root')}
                        className={`
                            border-2 border-dashed rounded-xl p-4 transition-all
                            ${dragOverFolderId === 'root' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900'}
                        `}
                    >
                        <div className="flex justify-between items-center mb-3">
                             <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                <Layers size={14} /> Unsorted / Root ({rootIds.length})
                             </h4>
                             <span className="text-[10px] text-zinc-400">Drag photos here to unassign</span>
                        </div>
                        
                        {rootIds.length === 0 ? (
                            <div className="h-24 flex items-center justify-center text-zinc-400 text-xs italic">
                                No photos in root. All sorted!
                            </div>
                        ) : (
                            <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                                {rootIds.map(id => renderPhotoItem(id))}
                            </div>
                        )}
                    </div>

                    {/* FOLDERS LIST */}
                    {folders.map(folder => (
                        <div 
                            key={folder.id}
                            onDragOver={(e) => handleDragOver(e, folder.id)}
                            onDrop={(e) => handleDrop(e, folder.id)}
                            className={`
                                border-2 rounded-xl p-4 transition-all relative group
                                ${dragOverFolderId === folder.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10 border-dashed' : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'}
                            `}
                        >
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2 flex-1">
                                    <Folder size={16} className={dragOverFolderId === folder.id ? 'text-blue-600' : 'text-yellow-500'} />
                                    <input 
                                        type="text" 
                                        value={folder.name} 
                                        onChange={(e) => handleRenameFolder(folder.id, e.target.value)}
                                        className="bg-transparent border-none focus:ring-0 font-semibold text-sm text-zinc-800 dark:text-zinc-200 p-0 w-full"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-zinc-400">{folder.photoIds.length} items</span>
                                    <button 
                                        onClick={() => handleDeleteFolder(folder.id)}
                                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                        title="Delete Folder (Photos return to Unsorted)"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {folder.photoIds.length === 0 ? (
                                <div className="h-16 flex items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-400 text-xs italic">
                                    Drag photos here
                                </div>
                            ) : (
                                <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                                    {folder.photoIds.map(id => renderPhotoItem(id))}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Instruction State if empty */}
                    {folders.length === 0 && (
                        <div className="text-center py-8 text-zinc-400">
                             <AlertCircle className="mx-auto mb-2 opacity-50" size={24} />
                             <p className="text-sm">Create folders to organize your export.</p>
                             <p className="text-xs opacity-70">Any photos left in "Unsorted" will be in the root of the ZIP.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex justify-between items-center">
            <div className="text-xs text-zinc-500 px-2">
                Total Photos: {rootIds.length + folders.reduce((acc, f) => acc + f.photoIds.length, 0)}
            </div>
            <div className="flex gap-3">
                <button 
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleSubmit}
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-all flex items-center gap-2"
                >
                    <Download size={16} /> Export ZIP
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};