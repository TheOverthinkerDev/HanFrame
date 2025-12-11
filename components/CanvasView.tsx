import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Photo, CropData, AspectRatio } from '../types';
import { applyImageFilters } from '../utils/processor';
import { Loader2 } from 'lucide-react';

interface CanvasViewProps {
  photo: Photo;
  isCropMode: boolean;
  onUpdateCrop: (crop: CropData | null) => void;
  aspectRatio: AspectRatio;
}

type DragMode = 'none' | 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

const getRatioValue = (ar: AspectRatio): number | null => {
  switch (ar) {
    case '1:1': return 1;
    case '16:9': return 16 / 9;
    case '4:3': return 4 / 3;
    case '3:2': return 3 / 2;
    default: return null;
  }
};

export const CanvasView: React.FC<CanvasViewProps> = ({ photo, isCropMode, onUpdateCrop, aspectRatio }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameImgRef = useRef<HTMLImageElement | null>(null); // Ref for frame image

  // We maintain a "Display URL" which is the physically rotated version of the image.
  // This allows the Crop tool and Canvas logic to remain simple (they just see a WxH image).
  // This is generated on the fly when rotation changes.
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [isGeneratingView, setIsGeneratingView] = useState(false);
  const [frameLoaded, setFrameLoaded] = useState(false); // Track if frame PNG is ready

  // Layout state (Display dimensions)
  const [layout, setLayout] = useState({ width: 0, height: 0, top: 0, left: 0, scale: 1 });
  
  // Crop Interaction State
  const [localCrop, setLocalCrop] = useState<CropData | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, cropX: 0, cropY: 0, cropW: 0, cropH: 0 });

  // 0. Handle Rotation: Generate a rotated view blob when rotation changes
  useEffect(() => {
    // If no rotation, use original
    if (!photo.rotation || photo.rotation === 0) {
        setDisplayUrl(photo.originalUrl);
        return;
    }

    setIsGeneratingView(true);
    const img = new Image();
    img.src = photo.originalUrl;
    img.onload = () => {
        const angle = photo.rotation;
        const canvas = document.createElement('canvas');
        
        // Determine new dimensions
        if (angle % 180 !== 0) {
            canvas.width = img.height;
            canvas.height = img.width;
        } else {
            canvas.width = img.width;
            canvas.height = img.height;
        }
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((angle * Math.PI) / 180);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);
            
            canvas.toBlob((blob) => {
                if (blob) {
                   const newUrl = URL.createObjectURL(blob);
                   setDisplayUrl(prev => {
                       if (prev && prev !== photo.originalUrl) URL.revokeObjectURL(prev);
                       return newUrl;
                   });
                }
                setIsGeneratingView(false);
            }, 'image/jpeg', 0.85); // Reasonable quality for editor view
        }
    };
  }, [photo.originalUrl, photo.rotation]);

  // Load Frame Image whenever frameOverlay changes
  useEffect(() => {
      if (!photo.frameOverlay) {
          frameImgRef.current = null;
          setFrameLoaded(false);
          return;
      }
      
      const img = new Image();
      img.onload = () => {
          frameImgRef.current = img;
          setFrameLoaded(true); // Trigger re-render
      };
      img.src = photo.frameOverlay;
  }, [photo.frameOverlay]);


  // 1. Initialize Local Crop state
  // We use displayUrl here to ensure we have the correct dimensions loaded in imgRef
  useEffect(() => {
    if (isCropMode && imgRef.current) {
      // If we already have a crop, use it. Otherwise init full image.
      const initialCrop = photo.crop || { x: 0, y: 0, width: imgRef.current.width, height: imgRef.current.height };
      setLocalCrop(initialCrop);
    } else {
      setLocalCrop(null);
    }
  }, [isCropMode, photo.id, photo.crop, displayUrl]); 

  // 2. Handle Aspect Ratio Changes (Constant Area Strategy)
  useEffect(() => {
    if (!isCropMode || !localCrop || aspectRatio === 'Free' || !imgRef.current) return;

    const ratio = getRatioValue(aspectRatio);
    if (!ratio) return;

    const imgW = imgRef.current.width;
    const imgH = imgRef.current.height;
    
    const cx = localCrop.x + localCrop.width / 2;
    const cy = localCrop.y + localCrop.height / 2;

    const currentArea = localCrop.width * localCrop.height;
    let targetW = Math.sqrt(currentArea * ratio);
    let targetH = targetW / ratio;

    if (targetW > imgW) {
        targetW = imgW;
        targetH = targetW / ratio;
    }
    if (targetH > imgH) {
        targetH = imgH;
        targetW = targetH * ratio;
    }

    let newX = cx - targetW / 2;
    let newY = cy - targetH / 2;

    if (newX < 0) newX = 0;
    if (newY < 0) newY = 0;
    if (newX + targetW > imgW) newX = imgW - targetW;
    if (newY + targetH > imgH) newY = imgH - targetH;

    const newCrop = { x: newX, y: newY, width: targetW, height: targetH };
    setLocalCrop(newCrop);
    onUpdateCrop(newCrop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectRatio]);

  // 3. Main Render Logic
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imgRef.current;
    if (!canvas || !container || !img) return;

    const contW = container.clientWidth;
    const contH = container.clientHeight;
    
    // Determine source rect based on mode
    let srcW, srcH, srcX, srcY;

    if (isCropMode) {
      srcX = 0; srcY = 0;
      srcW = img.width;
      srcH = img.height;
    } else {
      const c = photo.crop || { x: 0, y: 0, width: img.width, height: img.height };
      srcX = c.x; srcY = c.y;
      srcW = c.width;
      srcH = c.height;
    }

    // Calculate layout scale to fit container
    const padding = 20;
    const availW = contW - padding * 2;
    const availH = contH - padding * 2;
    const scale = Math.min(availW / srcW, availH / srcH);

    const drawW = srcW * scale;
    const drawH = srcH * scale;

    const newLayout = {
      width: drawW,
      height: drawH,
      left: (contW - drawW) / 2,
      top: (contH - drawH) / 2,
      scale: scale
    };

    setLayout(prev => {
        if (Math.abs(prev.width - drawW) < 1 && Math.abs(prev.scale - scale) < 0.001) return prev;
        return newLayout;
    });

    // Draw to Canvas
    canvas.width = drawW;
    canvas.height = drawH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, drawW, drawH);
    
    // Apply filters
    applyImageFilters(ctx, drawW, drawH, photo.adjustments);
    
    // Apply PNG Frame Overlay (if exists and loaded)
    if (frameImgRef.current) {
        // Stretch frame to fit the destination rect
        ctx.drawImage(frameImgRef.current, 0, 0, drawW, drawH);
    }
    
  }, [photo.adjustments, photo.crop, isCropMode, frameLoaded]); // Re-render when frameLoaded changes

  // Trigger render when key dependencies change
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Load Image initially (whenever displayUrl changes due to rotation or selection)
  useEffect(() => {
    if (!displayUrl) return;
    const img = new Image();
    img.src = displayUrl;
    img.onload = () => {
      imgRef.current = img;
      renderCanvas();
    };
  }, [displayUrl, renderCanvas]);

  // Handle Resize of window
  useEffect(() => {
    window.addEventListener('resize', renderCanvas);
    return () => window.removeEventListener('resize', renderCanvas);
  }, [renderCanvas]);


  // --- Interaction Handlers ---

  const handlePointerDown = (e: React.PointerEvent, mode: DragMode) => {
    if (!localCrop || !layout.scale) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    setDragMode(mode);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      cropX: localCrop.x,
      cropY: localCrop.y,
      cropW: localCrop.width,
      cropH: localCrop.height
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragMode === 'none' || !localCrop || !imgRef.current) return;
    e.preventDefault();

    const dx = (e.clientX - dragStart.x) / layout.scale;
    const dy = (e.clientY - dragStart.y) / layout.scale;

    let { cropX: x, cropY: y, cropW: w, cropH: h } = dragStart;
    const imgW = imgRef.current.width;
    const imgH = imgRef.current.height;
    const ratio = getRatioValue(aspectRatio);

    if (dragMode === 'move') {
      x += dx;
      y += dy;
      // Simple Clamp
      x = Math.max(0, Math.min(x, imgW - w));
      y = Math.max(0, Math.min(y, imgH - h));
    } else {
        // --- Robust Resizing Logic ---
        
        if (dragMode.includes('w')) { w -= dx; x += dx; }
        if (dragMode.includes('e')) { w += dx; }
        if (dragMode.includes('n')) { h -= dy; y += dy; }
        if (dragMode.includes('s')) { h += dy; }

        const minSize = 50 / layout.scale;
        
        if (ratio) {
           if (dragMode.includes('e') || dragMode.includes('w')) {
             h = w / ratio;
             if (dragMode.includes('n')) y = dragStart.cropY + dragStart.cropH - h;
           } else if (dragMode.includes('n') || dragMode.includes('s')) {
             w = h * ratio;
             if (dragMode.includes('w')) x = dragStart.cropX + dragStart.cropW - w;
           }
        }

        let corrected = false;

        // Check X/Width Bounds
        if (x < 0) { 
            w += x; x = 0; corrected = true; 
        }
        if (x + w > imgW) { 
            w = imgW - x; corrected = true; 
        }

        // If X was corrected and we have a ratio, fix H
        if (corrected && ratio) {
             h = w / ratio;
             if (dragMode.includes('n')) {
                y = dragStart.cropY + dragStart.cropH - h;
             }
        }

        // Check Y/Height Bounds
        corrected = false;
        if (y < 0) { 
            h += y; y = 0; corrected = true; 
        }
        if (y + h > imgH) { 
            h = imgH - y; corrected = true; 
        }

        // If Y was corrected and we have a ratio, fix W
        if (corrected && ratio) {
            w = h * ratio;
             if (dragMode.includes('w')) {
                x = dragStart.cropX + dragStart.cropW - w;
             }
        }

        if (w < minSize) w = minSize;
        if (h < minSize) h = minSize;
    }

    setLocalCrop({ x, y, width: w, height: h });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragMode !== 'none') {
      setDragMode('none');
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      onUpdateCrop(localCrop);
    }
  };

  const toStyle = (val: number) => val * layout.scale;

  if (isGeneratingView) {
      return (
        <div className="flex-1 h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 transition-colors">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-blue-500" size={32} />
                <span className="text-zinc-500 text-sm">Rotating View...</span>
            </div>
        </div>
      );
  }

  return (
    <div ref={containerRef} className="flex-1 h-full relative flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 overflow-hidden select-none touch-none transition-colors duration-300">
      
      <div style={{ width: layout.width, height: layout.height, position: 'relative' }}>
        <canvas ref={canvasRef} className="block shadow-xl dark:shadow-none" />

        {isCropMode && localCrop && (
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
                {/* Visual Overlay: Shadow outside the crop area */}
                <div
                    className="absolute border border-white/90 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]"
                    style={{
                        left: toStyle(localCrop.x),
                        top: toStyle(localCrop.y),
                        width: toStyle(localCrop.width),
                        height: toStyle(localCrop.height),
                        cursor: 'move',
                        pointerEvents: 'all'
                    }}
                    onPointerDown={(e) => handlePointerDown(e, 'move')}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                >
                    {/* Grid Lines (Rule of Thirds) */}
                    <div className="absolute inset-0 pointer-events-none opacity-80">
                         {/* Verticals */}
                        <div className="absolute top-0 bottom-0 left-[33.33%] w-px bg-white/50 shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                        <div className="absolute top-0 bottom-0 left-[66.66%] w-px bg-white/50 shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                         {/* Horizontals */}
                        <div className="absolute left-0 right-0 top-[33.33%] h-px bg-white/50 shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                        <div className="absolute left-0 right-0 top-[66.66%] h-px bg-white/50 shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                    </div>

                    {/* Resize Handles - Improved Visuals */}
                    {/* Corners */}
                    <div 
                        className="absolute -top-1.5 -left-1.5 w-5 h-5 border-t-[3px] border-l-[3px] border-white cursor-nw-resize pointer-events-auto drop-shadow-md" 
                        onPointerDown={(e) => handlePointerDown(e, 'nw')} 
                    />
                    <div 
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 border-t-[3px] border-r-[3px] border-white cursor-ne-resize pointer-events-auto drop-shadow-md" 
                        onPointerDown={(e) => handlePointerDown(e, 'ne')} 
                    />
                    <div 
                        className="absolute -bottom-1.5 -left-1.5 w-5 h-5 border-b-[3px] border-l-[3px] border-white cursor-sw-resize pointer-events-auto drop-shadow-md" 
                        onPointerDown={(e) => handlePointerDown(e, 'sw')} 
                    />
                    <div 
                        className="absolute -bottom-1.5 -right-1.5 w-5 h-5 border-b-[3px] border-r-[3px] border-white cursor-se-resize pointer-events-auto drop-shadow-md" 
                        onPointerDown={(e) => handlePointerDown(e, 'se')} 
                    />
                    
                    {/* Edges (Only Free mode) */}
                    {aspectRatio === 'Free' && (
                        <>
                         <div onPointerDown={(e) => handlePointerDown(e, 'n')} className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-4 cursor-n-resize pointer-events-auto flex justify-center"><div className="w-4 h-1 bg-white/80 rounded-full shadow-sm" /></div>
                         <div onPointerDown={(e) => handlePointerDown(e, 's')} className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-4 cursor-s-resize pointer-events-auto flex items-end justify-center"><div className="w-4 h-1 bg-white/80 rounded-full shadow-sm" /></div>
                         <div onPointerDown={(e) => handlePointerDown(e, 'w')} className="absolute top-1/2 -left-2 -translate-y-1/2 h-8 w-4 cursor-w-resize pointer-events-auto flex items-center"><div className="h-4 w-1 bg-white/80 rounded-full shadow-sm" /></div>
                         <div onPointerDown={(e) => handlePointerDown(e, 'e')} className="absolute top-1/2 -right-2 -translate-y-1/2 h-8 w-4 cursor-e-resize pointer-events-auto flex items-center justify-end"><div className="h-4 w-1 bg-white/80 rounded-full shadow-sm" /></div>
                        </>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};