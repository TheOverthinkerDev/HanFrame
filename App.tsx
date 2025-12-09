import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Sidebar } from './components/Sidebar';
import { Filmstrip } from './components/Filmstrip';
import { CanvasView } from './components/CanvasView';
import { ToastContainer, ToastMessage } from './components/Toast';
import { ProcessingModal } from './components/ProcessingModal';
import { Photo, Adjustments, DEFAULT_ADJUSTMENTS, AspectRatio, CropData } from './types';
import { createThumbnail, isHeic, convertHeicToJpeg, rotateImage } from './utils/processor';
import { Download, Image as ImageIcon, Sparkles, Undo2, Redo2 } from 'lucide-react';
import { useHistory } from './hooks/useHistory';

export default function App() {
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
  
  // Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');

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

  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const newPhotos: Photo[] = [];
    const fileList = e.target.files;
    const files: File[] = [];
    if (fileList) {
        for (let i = 0; i < fileList.length; i++) {
            const item = fileList.item(i);
            if (item) files.push(item);
        }
    }
    
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
          adjustments: { ...DEFAULT_ADJUSTMENTS },
          crop: null
        });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        addToast('error', `Failed to load ${fileName}.`);
      }
    }

    // Push new photos to history
    pushHistory([...photos, ...newPhotos]);

    if (!selectedId && newPhotos.length > 0) {
      setSelectedId(newPhotos[0].id);
    }
    e.target.value = '';
  };

  const handleRemovePhoto = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newPhotos = photos.filter(p => p.id !== id);
    const removed = photos.find(p => p.id === id);
    
    // Revoke URLs to avoid memory leaks
    if (removed) {
        // Ideally we only revoke if we are sure it's not in undo stack,
        // but for a simple browser app, let's keep it safe or rely on GC.
        // Actually, revoking here breaks Undo. 
        // Better to NOT revoke immediately in an Undo-based app, or clone blobs.
        // For this demo, we will skip manual revocation to enable Undo.
    }

    pushHistory(newPhotos);
    if (selectedId === id) setSelectedId(null);
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
      p.id === selectedId ? { ...p, adjustments: { ...DEFAULT_ADJUSTMENTS }, crop: null } : p
    );
    pushHistory(newPhotos);
    addToast('success', 'Reset successfully');
  };

  const handleRotate = async () => {
     if (!selectedId || !selectedPhoto) return;
     
     setIsProcessing(true);
     setProcessingMessage('Rotating...');
     try {
         const { url, width, height } = await rotateImage(selectedPhoto.originalUrl, 90);
         const thumb = await createThumbnail(url);
         
         const newPhotos = photos.map(p => {
             if (p.id === selectedId) {
                 return {
                     ...p,
                     originalUrl: url,
                     thumbnailUrl: thumb.url,
                     width,
                     height,
                     crop: null // Reset crop on rotate to avoid bounds issues
                 };
             }
             return p;
         });
         
         pushHistory(newPhotos);
     } catch (e) {
         addToast('error', 'Rotation failed');
     } finally {
         setIsProcessing(false);
     }
  };

  // Batch Handlers
  const handleBatchApply = async () => {
    if (!selectedPhoto) return;
    const settings = { ...selectedPhoto.adjustments };
    
    await runBatchOperation('Syncing Settings...', (p) => ({
        ...p,
        adjustments: { ...settings }
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
        let width = p.width;
        let height = p.height;
        const currentRatio = width / height;
        
        if (currentRatio > targetRatio) {
            width = height * targetRatio;
        } else {
            height = width / targetRatio;
        }
        const x = (p.width - width) / 2;
        const y = (p.height - height) / 2;

        return {
            ...p,
            crop: { x, y, width, height }
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
  
  // We need to commit crop to history only when drag ends. 
  // Since CanvasView handles the drag interaction internally and calls onUpdateCrop frequently,
  // we might need to modify CanvasView to support onCommit, OR just assume that 'crop' updates 
  // are frequent and we debounce history? 
  // For simplicity: We will just push history on every crop update for now, 
  // OR we can rely on the fact that CanvasView calls onUpdateCrop on PointerUp.
  // Looking at CanvasView implementation: `onUpdateCrop` is called on `handlePointerUp`.
  // So it is safe to push history here.
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
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden selection:bg-blue-500 selection:text-white">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ProcessingModal isOpen={isProcessing} message={processingMessage} progress={progress} />
      
      {/* Top Bar */}
      <header className="h-12 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <Sparkles className="text-blue-500" size={20} />
                <h1 className="font-bold text-lg tracking-tight">Lumina</h1>
            </div>

            {/* Undo/Redo Controls */}
            <div className="flex items-center gap-1 ml-4 border-l border-zinc-800 pl-4 h-6">
                <button 
                    onClick={undo} 
                    disabled={!canUndo}
                    className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent text-zinc-400 hover:text-white transition-all"
                    title="Undo (Ctrl+Z)"
                >
                    <Undo2 size={16} />
                </button>
                <button 
                    onClick={redo} 
                    disabled={!canRedo}
                    className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent text-zinc-400 hover:text-white transition-all"
                    title="Redo (Ctrl+Y)"
                >
                    <Redo2 size={16} />
                </button>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
           {selectedPhoto && (
             <span className="text-xs text-zinc-500 font-mono hidden md:block">
               {selectedPhoto.width}x{selectedPhoto.height} • {selectedPhoto.name}
             </span>
           )}
           <button 
             onClick={handleDownload}
             disabled={!selectedPhoto}
             className="bg-zinc-100 text-black px-3 py-1.5 rounded text-xs font-semibold hover:bg-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
           >
             <Download size={14} /> Export
           </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Center Canvas Area */}
        <main className="flex-1 flex flex-col relative">
          {selectedPhoto ? (
            <CanvasView 
              photo={selectedPhoto} 
              isCropMode={isCropMode}
              // CanvasView calls this on PointerUp (Drag End)
              onUpdateCrop={handleCropCommit} 
              aspectRatio={aspectRatio}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
               <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center mb-4">
                  <ImageIcon size={32} />
               </div>
               <p className="text-sm">Import photos to start editing</p>
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
          onRotate={handleRotate}
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