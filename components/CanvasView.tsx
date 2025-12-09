import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Photo, CropData, AspectRatio } from '../types';
import { applyImageFilters } from '../utils/processor';

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

  // Layout state (Display dimensions)
  const [layout, setLayout] = useState({ width: 0, height: 0, top: 0, left: 0, scale: 1 });
  
  // Crop Interaction State
  const [localCrop, setLocalCrop] = useState<CropData | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, cropX: 0, cropY: 0, cropW: 0, cropH: 0 });

  // 1. Initialize Local Crop state
  useEffect(() => {
    if (isCropMode) {
      const initialCrop = photo.crop || { x: 0, y: 0, width: photo.width, height: photo.height };
      setLocalCrop(initialCrop);
    } else {
      setLocalCrop(null);
    }
  }, [isCropMode, photo.id, photo.width, photo.height, photo.crop]);

  // 2. Handle Aspect Ratio Changes (Center fit)
  useEffect(() => {
    if (!isCropMode || !localCrop || aspectRatio === 'Free') return;

    const ratio = getRatioValue(aspectRatio);
    if (!ratio) return;

    let { width, height, x, y } = localCrop;
    const currentRatio = width / height;

    if (currentRatio > ratio) {
        // Too wide, reduce width
        const newWidth = height * ratio;
        x += (width - newWidth) / 2;
        width = newWidth;
    } else {
        // Too tall, reduce height
        const newHeight = width / ratio;
        y += (height - newHeight) / 2;
        height = newHeight;
    }

    const newCrop = { x, y, width, height };
    setLocalCrop(newCrop);
    onUpdateCrop(newCrop);
  }, [aspectRatio]);

  // 3. Main Render Logic
  // We use useCallback to separate the render function so we can control when it runs
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imgRef.current;
    if (!canvas || !container || !img) return;

    const contW = container.clientWidth;
    const contH = container.clientHeight;
    
    // Determine source rect based on mode
    // In CropMode: We show FULL image. The crop box is just a DOM overlay.
    // In ViewMode: We show the CROPPED image.
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

    // Update layout state for DOM overlays (CSS pixels)
    const newLayout = {
      width: drawW,
      height: drawH,
      left: (contW - drawW) / 2,
      top: (contH - drawH) / 2,
      scale: scale
    };

    // Optimization: Avoid state updates if layout hasn't physically changed
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
    applyImageFilters(ctx, drawW, drawH, photo.adjustments);
  }, [photo.adjustments, photo.crop, isCropMode, photo.originalUrl]);

  // Trigger render when key dependencies change
  // Note: We intentionally DO NOT include `localCrop` here. 
  // Moving the crop box should NOT redraw the canvas in CropMode.
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Load Image initially
  useEffect(() => {
    const img = new Image();
    img.src = photo.originalUrl;
    img.onload = () => {
      imgRef.current = img;
      renderCanvas();
    };
  }, [photo.originalUrl, renderCanvas]);

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
        // --- Robust Resizing Logic with Aspect Ratio & Bounds ---
        
        // 1. Calculate suggested dimensions based on mouse movement
        if (dragMode.includes('w')) { w -= dx; x += dx; }
        if (dragMode.includes('e')) { w += dx; }
        if (dragMode.includes('n')) { h -= dy; y += dy; }
        if (dragMode.includes('s')) { h += dy; }

        // 2. Enforce Minimum Size
        const minSize = 50 / layout.scale;
        
        // 3. Enforce Aspect Ratio (Unbounded)
        if (ratio) {
           // If dragging a corner, width usually dominates logic, but let's check direction
           if (dragMode.includes('e') || dragMode.includes('w')) {
             h = w / ratio;
             // If growing North, adjust Y
             if (dragMode.includes('n')) y = dragStart.cropY + dragStart.cropH - h;
           } else if (dragMode.includes('n') || dragMode.includes('s')) {
             w = h * ratio;
             // If growing West, adjust X
             if (dragMode.includes('w')) x = dragStart.cropX + dragStart.cropW - w;
           }
        }

        // 4. Enforce Bounds (The "Hard" Clamp)
        // If we hit a wall, we clamp that side, and IF ratio is locked, we must recalculate the other side.
        
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
             // If we were growing North, we need to fix Y position based on new Height
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
             // If we were growing West, we need to fix X position based on new Width
             if (dragMode.includes('w')) {
                x = dragStart.cropX + dragStart.cropW - w;
             }
        }

        // Final Safety Clamp for min size
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

  return (
    <div ref={containerRef} className="flex-1 h-full relative flex items-center justify-center bg-zinc-950 overflow-hidden select-none touch-none">
      
      <div style={{ width: layout.width, height: layout.height, position: 'relative' }}>
        <canvas ref={canvasRef} className="block" />

        {isCropMode && localCrop && (
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
                {/* Visual Overlay: Shadow outside the crop area */}
                <div
                    className="absolute border border-white/80 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.75)]"
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
                    {/* Fixed Grid Lines (3x3) using percentage to ensure alignment */}
                    <div className="absolute inset-0 pointer-events-none opacity-60">
                         {/* Verticals */}
                        <div className="absolute top-0 bottom-0 left-[33.33%] w-px bg-white/40" />
                        <div className="absolute top-0 bottom-0 left-[66.66%] w-px bg-white/40" />
                         {/* Horizontals */}
                        <div className="absolute left-0 right-0 top-[33.33%] h-px bg-white/40" />
                        <div className="absolute left-0 right-0 top-[66.66%] h-px bg-white/40" />
                    </div>

                    {/* Resize Handles */}
                    {/* Corners */}
                    <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-white cursor-nw-resize pointer-events-auto" onPointerDown={(e) => handlePointerDown(e, 'nw')} />
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-white cursor-ne-resize pointer-events-auto" onPointerDown={(e) => handlePointerDown(e, 'ne')} />
                    <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-white cursor-sw-resize pointer-events-auto" onPointerDown={(e) => handlePointerDown(e, 'sw')} />
                    <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-white cursor-se-resize pointer-events-auto" onPointerDown={(e) => handlePointerDown(e, 'se')} />
                    
                    {/* Edges (Only Free mode) */}
                    {aspectRatio === 'Free' && (
                        <>
                         <div onPointerDown={(e) => handlePointerDown(e, 'n')} className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-4 cursor-n-resize pointer-events-auto flex justify-center"><div className="w-4 h-1 bg-white/50 rounded-full" /></div>
                         <div onPointerDown={(e) => handlePointerDown(e, 's')} className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-4 cursor-s-resize pointer-events-auto flex items-end justify-center"><div className="w-4 h-1 bg-white/50 rounded-full" /></div>
                         <div onPointerDown={(e) => handlePointerDown(e, 'w')} className="absolute top-1/2 -left-2 -translate-y-1/2 h-8 w-4 cursor-w-resize pointer-events-auto flex items-center"><div className="h-4 w-1 bg-white/50 rounded-full" /></div>
                         <div onPointerDown={(e) => handlePointerDown(e, 'e')} className="absolute top-1/2 -right-2 -translate-y-1/2 h-8 w-4 cursor-e-resize pointer-events-auto flex items-center justify-end"><div className="h-4 w-1 bg-white/50 rounded-full" /></div>
                        </>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};