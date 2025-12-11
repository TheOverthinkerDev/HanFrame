import React, { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Sidebar } from './components/Sidebar';
import { LeftSidebar } from './components/LeftSidebar';
import { Filmstrip } from './components/Filmstrip';
import { CanvasView } from './components/CanvasView';
import { ToastContainer, ToastMessage } from './components/Toast';
import { ProcessingModal } from './components/ProcessingModal';
import { Photo, Adjustments, DEFAULT_ADJUSTMENTS, AspectRatio, CropData, LogoLayer } from './types';
import { createThumbnail, isHeic, convertHeicToJpeg } from './utils/processor';
import { Download, Image as ImageIcon, Sparkles, Undo2, Redo2, UploadCloud, Moon, Sun } from 'lucide-react';
import { useHistory } from './hooks/useHistory';
import { useTheme } from './hooks/useTheme';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  
  // Replace direct useState with useHistory
  const { 
    state: photos, 
    set: setPhotos, 
    push: pushHistory, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  } = useHistory<Photo[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // Assets State (Session based)
  const [uploadedFrames, setUploadedFrames] = useState<string[]>([]);
  const [uploadedLogos, setUploadedLogos] = useState<string[]>([]);

  // Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');

  // Drag & Drop State
  const [isDragging, setIsDragging] = useState(false);

  // Crop state
  const [isCropMode, setIsCropMode] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Free');

  const selectedPhoto = photos.find(p => p.id === selectedId) || null;

  // --- Toast Helpers ---
  const addToast = (type: 'success' | 'error', message: string) => {
    setToasts(prev => [...prev, { id: uuidv4(), type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // --- Batch Processing Helper ---
  const runBatchOperation = async (message: string, operation: (photo: Photo) => Promise<Photo> | Photo) => {
    if (photos.length === 0) return;
    
    setIsProcessing(true);
    setProcessingMessage(message);
    setProgress(0);

    const newPhotos = [...photos];
    const total = newPhotos.length;
    const chunkSize = 5; 
    const artificialDelay = total < 20 ? 50 : 0; 

    for (let i = 0; i < total; i += chunkSize) {
        await new Promise(r => setTimeout(r, artificialDelay));
        const end = Math.min(i + chunkSize, total);
        for (let j = i; j < end; j++) {
            newPhotos[j] = await operation(newPhotos[j]);
        }
        setProgress((end / total) * 100);
    }

    // Push to history AFTER the batch op is done
    pushHistory(newPhotos);

    // Small delay at 100% before closing
    await new Promise(r => setTimeout(r, 200));
    setIsProcessing(false);
    return total;
  };

  // --- Handlers ---

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    
    const newPhotos: Photo[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let blobToLoad: Blob = file;
      let fileName = file.name;

      if (isHeic(file)) {
          try {
             addToast('success', `Converting ${file.name}...`);
             blobToLoad = await convertHeicToJpeg(file);
             fileName = fileName.replace(/\.(heic|heif)$/i, '.jpg');
          } catch (err) {
             console.error(err);
             addToast('error', `Could not convert ${file.name}.`);
             continue; 
          }
      }

      const objectUrl = URL.createObjectURL(blobToLoad);
      
      try {
        const thumb = await createThumbnail(objectUrl);
        newPhotos.push({
          id: uuidv4(),
          name: fileName,
          originalUrl: objectUrl,
          thumbnailUrl: thumb.url,
          width: thumb.width,
          height: thumb.height,
          sizeInBytes: file.size, // Capture file size
          rotation: 0,
          adjustments: { ...DEFAULT_ADJUSTMENTS },
          frameOverlay: null,
          logos: [],
          crop: null
        });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        addToast('error', `Failed to load ${fileName}.`);
      }
    }

    if (newPhotos.length > 0) {
      pushHistory([...photos, ...newPhotos]);
      if (!selectedId) {
        setSelectedId(newPhotos[0].id);
      }
    }
  };

  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const fileList = e.target.files;
    const files: File[] = [];
    if (fileList) {
        for (let i = 0; i < fileList.length; i++) {
            const item = fileList.item(i);
            if (item) files.push(item);
        }
    }
    
    await processFiles(files);
    e.target.value = ''; // Reset input
  };

  // Drag & Drop Handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }, [isDragging]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we leave the main container
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files: File[] = [];
    const fileList = e.dataTransfer.files;
    for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        if (f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.heic')) {
            files.push(f);
        }
    }

    if (files.length > 0) {
        await processFiles(files);
    }
  }, [photos, selectedId, pushHistory]); // Dependencies for processFiles logic closure

  const handleRemovePhoto = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newPhotos = photos.filter(p => p.id !== id);
    pushHistory(newPhotos);
    if (selectedId === id) setSelectedId(null);
  };

  // --- Frame Handlers ---
  const handleUploadFrame = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setUploadedFrames(prev => [url, ...prev]);
      addToast('success', 'Frame added to library');
      e.target.value = '';
  };

  const handleDeleteFrame = (urlToDelete: string) => {
      setUploadedFrames(prev => prev.filter(url => url !== urlToDelete));
  };

  const handleSelectFrame = (url: string | null) => {
      if (!selectedId) return;
      const newPhotos = photos.map(p => {
          if (p.id === selectedId) {
              return { ...p, frameOverlay: url };
          }
          return p;
      });
      pushHistory(newPhotos);
  };

  const handleBatchFrame = async () => {
    if (!selectedPhoto) return;
    const frame = selectedPhoto.frameOverlay;
    if (!frame) return;

    await runBatchOperation('Applying Frame...', (p) => ({
      ...p,
      frameOverlay: frame
    }));
    addToast('success', `Frame applied to ${photos.length} photos`);
  };
  
  // --- Logo Handlers ---
  const handleUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setUploadedLogos(prev => [url, ...prev]);
      addToast('success', 'Logo added to library');
      e.target.value = '';
  };

  const handleDeleteLogoAsset = (urlToDelete: string) => {
      setUploadedLogos(prev => prev.filter(url => url !== urlToDelete));
  };

  const handleAddLogoToPhoto = (url: string) => {
      if (!selectedId) return;
      const newLogo: LogoLayer = {
          id: uuidv4(),
          url,
          x: 0.5, // Center
          y: 0.5,
          scale: 0.2, // Start at 20% size relative to min dim
          rotation: 0
      };
      
      const newPhotos = photos.map(p => {
          if (p.id === selectedId) {
              return { ...p, logos: [...p.logos, newLogo] };
          }
          return p;
      });
      pushHistory(newPhotos);
  };

  const handleUpdateLogos = (logos: LogoLayer[]) => {
      if (!selectedId) return;
      // Used for real-time dragging (no history push yet)
      setPhotos(photos.map(p => {
          if (p.id === selectedId) {
              return { ...p, logos };
          }
          return p;
      }));
  };

  const handleCommitLogos = () => {
      // Push current state to history after drag ends
      pushHistory(photos);
  };

  const handleBatchLogo = async () => {
    if (!selectedPhoto) return;
    const logos = selectedPhoto.logos;
    if (logos.length === 0) return;

    await runBatchOperation('Syncing Logos...', (p) => ({
      ...p,
      logos: [...logos] // Shallow copy array, objects are immutable enough for this context
    }));
    addToast('success', `Logos synced to ${photos.length} photos`);
  };

  // Called while dragging slider (No History Push)
  const handleAdjustmentChange = (key: keyof Adjustments, value: number) => {
    if (!selectedId) return;
    setPhotos(photos.map(p => {
      if (p.id === selectedId) {
        return {
          ...p,
          adjustments: {
            ...p.adjustments,
            [key]: value
          }
        };
      }
      return p;
    }));
  };

  // Called on MouseUp (Push History)
  const handleAdjustmentCommit = () => {
    pushHistory(photos);
  };

  const handleAutoAdjust = () => {
    if (!selectedId) return;
    const autoVals: Partial<Adjustments> = {
      exposure: 10,
      contrast: 15,
      vibrance: 25,
      temperature: -5,
      saturation: 5
    };

    const newPhotos = photos.map(p => 
      p.id === selectedId ? { ...p, adjustments: { ...p.adjustments, ...autoVals } } : p
    );
    pushHistory(newPhotos);
    addToast('success', 'Auto adjustments applied');
  };

  const handleResetAdjustments = () => {
    if (!selectedId) return;
    const newPhotos = photos.map(p => 
      p.id === selectedId ? { 
          ...p, 
          adjustments: { ...DEFAULT_ADJUSTMENTS }, 
          frameOverlay: null,
          logos: [],
          crop: null, 
          rotation: 0 
      } : p
    );
    pushHistory(newPhotos);
    addToast('success', 'Reset successfully');
  };

  const handleRotateLeft = () => {
      if (!selectedId) return;
      const newPhotos = photos.map(p => {
          if (p.id === selectedId) {
              const current = p.rotation || 0;
              // -90 degrees
              return { 
                  ...p, 
                  rotation: (current - 90 + 360) % 360,
                  crop: null // Reset crop on rotate to avoid alignment issues
              };
          }
          return p;
      });
      pushHistory(newPhotos);
  };

  const handleRotateRight = () => {
      if (!selectedId) return;
      const newPhotos = photos.map(p => {
          if (p.id === selectedId) {
              const current = p.rotation || 0;
              // +90 degrees
              return { 
                  ...p, 
                  rotation: (current + 90) % 360,
                  crop: null 
              };
          }
          return p;
      });
      pushHistory(newPhotos);
  };

  // Batch Handlers
  const handleBatchApply = async () => {
    if (!selectedPhoto) return;
    const settings = { ...selectedPhoto.adjustments };
    const frame = selectedPhoto.frameOverlay;
    // Copy logos too? Maybe tricky if dimensions differ, but let's do it for consistency
    const logos = [...selectedPhoto.logos];
    
    await runBatchOperation('Syncing Settings...', (p) => ({
        ...p,
        adjustments: { ...settings },
        frameOverlay: frame,
        logos: [...logos] // Deep copy needed if logos were objects, but structure is simple enough
    }));
    addToast('success', `Synced settings to ${photos.length} photos`);
  };

  const handleBatchAutoAdjust = async () => {
      const autoVals: Partial<Adjustments> = {
          exposure: 10, contrast: 15, vibrance: 20, saturation: 5
      };
      
      await runBatchOperation('Auto Adjusting...', (p) => ({
          ...p,
          adjustments: { ...p.adjustments, ...autoVals }
      }));
      addToast('success', `Auto adjusted ${photos.length} photos`);
  };

  const handleBatchCrop = async () => {
    if (photos.length === 0) return;

    if (aspectRatio === 'Free') {
      addToast('error', 'Select a specific aspect ratio (e.g. 16:9) first');
      return;
    }
    
    const getRatio = (ar: AspectRatio): number => {
        switch(ar) {
            case '1:1': return 1;
            case '16:9': return 16/9;
            case '4:3': return 4/3;
            case '3:2': return 3/2;
            default: return 1;
        }
    };
    const targetRatio = getRatio(aspectRatio);

    await runBatchOperation(`Cropping to ${aspectRatio}...`, (p) => {
        // We need to account for rotation when calculating batch crop!
        const rot = p.rotation || 0;
        const isVertical = rot % 180 !== 0;
        
        let width = isVertical ? p.height : p.width;
        let height = isVertical ? p.width : p.height;
        
        const currentRatio = width / height;
        
        // Calculate crop relative to the VISIBLE (Rotated) dimensions
        let cropW = width;
        let cropH = height;

        if (currentRatio > targetRatio) {
            cropW = height * targetRatio;
        } else {
            cropH = width / targetRatio;
        }
        const x = (width - cropW) / 2;
        const y = (height - cropH) / 2;

        return {
            ...p,
            crop: { x, y, width: cropW, height: cropH }
        };
    });
    
    addToast('success', `Cropped ${photos.length} photos to ${aspectRatio}`);
  };
  
  const handleUpdateCrop = (crop: CropData | null) => {
      if (!selectedId) return;
      // We update state immediately for smooth UI...
      const newPhotos = photos.map(p => 
        p.id === selectedId ? { ...p, crop } : p
      );
      setPhotos(newPhotos);
  };
  
  const handleCropCommit = (crop: CropData | null) => {
      if (!selectedId) return;
       const newPhotos = photos.map(p => 
        p.id === selectedId ? { ...p, crop } : p
      );
      pushHistory(newPhotos);
  };

  const handleDownload = () => {
      addToast('success', 'Export started... (Demo)');
  };

  return (
    <div 
      className="flex flex-col h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white overflow-hidden selection:bg-blue-500 selection:text-white transition-colors duration-300"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ProcessingModal isOpen={isProcessing} message={processingMessage} progress={progress} />
      
      {/* Drag Drop Overlay */}
      {isDragging && (
          <div className="fixed inset-0 z-50 bg-blue-600/20 backdrop-blur-sm border-4 border-blue-500 border-dashed m-4 rounded-xl flex items-center justify-center pointer-events-none">
              <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl flex flex-col items-center shadow-2xl animate-bounce">
                  <UploadCloud size={48} className="text-blue-500 mb-2" />
                  <span className="text-xl font-bold dark:text-white text-zinc-900">Drop photos to upload</span>
              </div>
          </div>
      )}

      {/* Top Bar */}
      <header className="h-12 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 z-20 shrink-0 transition-colors duration-300">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <Sparkles className="text-blue-600 dark:text-blue-500" size={20} />
                <h1 className="font-bold text-lg tracking-tight text-zinc-900 dark:text-zinc-100">HanFrame</h1>
            </div>

            {/* Undo/Redo Controls */}
            <div className="flex items-center gap-1 ml-4 border-l border-zinc-200 dark:border-zinc-800 pl-4 h-6">
                <button 
                    onClick={undo} 
                    disabled={!canUndo}
                    className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all"
                    title="Undo"
                >
                    <Undo2 size={16} />
                </button>
                <button 
                    onClick={redo} 
                    disabled={!canRedo}
                    className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all"
                    title="Redo"
                >
                    <Redo2 size={16} />
                </button>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
           {/* Info updated in CanvasView but kept simple here or removed if redundant. 
               Let's keep name/size here as a backup or summary. 
               The user asked for info in the 'top left corner of the edit screen'. 
               I will add an overlay in CanvasView and keep this clean. 
           */}
            <button
                onClick={toggleTheme}
                className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
                title="Toggle Theme"
            >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

           <button 
             onClick={handleDownload}
             disabled={!selectedPhoto}
             className="bg-zinc-100 dark:bg-zinc-100 text-black px-3 py-1.5 rounded text-xs font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors border border-zinc-200 dark:border-transparent"
           >
             <Download size={14} /> Export
           </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar (Frames & Logos) */}
        <LeftSidebar 
            uploadedFrames={uploadedFrames}
            activeFrame={selectedPhoto?.frameOverlay || null}
            onUploadFrame={handleUploadFrame}
            onSelectFrame={handleSelectFrame}
            onDeleteFrame={handleDeleteFrame}
            onBatchFrame={handleBatchFrame}
            uploadedLogos={uploadedLogos}
            hasLogos={(selectedPhoto?.logos.length || 0) > 0}
            onUploadLogo={handleUploadLogo}
            onAddLogoToPhoto={handleAddLogoToPhoto}
            onDeleteLogoAsset={handleDeleteLogoAsset}
            onBatchLogo={handleBatchLogo}
        />

        {/* Center Canvas Area */}
        <main className="flex-1 flex flex-col relative bg-zinc-100 dark:bg-zinc-950/50 transition-colors duration-300">
          {selectedPhoto ? (
            <CanvasView 
              photo={selectedPhoto} 
              isCropMode={isCropMode}
              onUpdateCrop={handleCropCommit} 
              aspectRatio={aspectRatio}
              onUpdateLogos={handleUpdateLogos}
              onCommitLogos={handleCommitLogos}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-600">
               <div className="w-20 h-20 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mb-6 shadow-sm dark:shadow-none">
                  <ImageIcon size={40} className="opacity-50" />
               </div>
               <h3 className="text-lg font-medium text-zinc-400 mb-2">No photo selected</h3>
               <p className="text-sm text-zinc-500">Drag & drop photos here or use the add button below</p>
            </div>
          )}

          {/* Bottom Filmstrip */}
          <Filmstrip 
            photos={photos} 
            selectedId={selectedId} 
            onSelect={setSelectedId} 
            onAdd={handleAddPhotos}
            onRemove={handleRemovePhoto}
          />
        </main>

        {/* Right Sidebar */}
        <Sidebar 
          photo={selectedPhoto}
          adjustments={selectedPhoto?.adjustments || DEFAULT_ADJUSTMENTS}
          onChange={handleAdjustmentChange}
          onCommit={handleAdjustmentCommit}
          onRotateLeft={handleRotateLeft}
          onRotateRight={handleRotateRight}
          onAuto={handleAutoAdjust}
          onReset={handleResetAdjustments}
          isCropMode={isCropMode}
          toggleCropMode={() => setIsCropMode(!isCropMode)}
          currentAspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          onBatchApply={handleBatchApply}
          onBatchCrop={handleBatchCrop}
          onBatchAuto={handleBatchAutoAdjust}
        />
      </div>
    </div>
  );
}