import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Photo, CropData, AspectRatio, LogoLayer } from '../types';
import { applyImageFilters } from '../utils/processor';
import { Loader2, BringToFront, SendToBack, Trash2 } from 'lucide-react';

interface CanvasViewProps {
  photo: Photo;
  isCropMode: boolean;
  onUpdateCrop: (crop: CropData | null) => void;
  aspectRatio: AspectRatio;
  onUpdateLogos: (logos: LogoLayer[]) => void;
  onCommitLogos: () => void;
  onLogosChange: (logos: LogoLayer[]) => void;
}

type DragMode = 'none' | 'move_crop' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'move_logo' | 'scale_logo' | 'rotate_logo';

const getRatioValue = (ar: AspectRatio): number | null => {
  switch (ar) {
    case '1:1': return 1;
    case '16:9': return 16 / 9;
    case '4:3': return 4 / 3;
    case '3:2': return 3 / 2;
    default: return null;
  }
};

export const CanvasView: React.FC<CanvasViewProps> = ({ 
    photo, 
    isCropMode, 
    onUpdateCrop, 
    aspectRatio,
    onUpdateLogos,
    onCommitLogos,
    onLogosChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameImgRef = useRef<HTMLImageElement | null>(null);
  const logoImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [isGeneratingView, setIsGeneratingView] = useState(false);
  const [frameLoaded, setFrameLoaded] = useState(false);

  const [layout, setLayout] = useState({ width: 0, height: 0, top: 0, left: 0, scale: 1 });
  
  const [localCrop, setLocalCrop] = useState<CropData | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [activeLogoId, setActiveLogoId] = useState<string | null>(null);
  
  // Drag State including logo specific properties
  const [dragStart, setDragStart] = useState({ 
      x: 0, y: 0, 
      cropX: 0, cropY: 0, cropW: 0, cropH: 0,
      logoX: 0, logoY: 0,
      logoScale: 0,
      logoRotation: 0,
      centerX: 0, centerY: 0 // Center of the logo in screen space at start of drag
  });
  
  // Computed active logo rotation for display
  const activeLogo = photo.logos.find(l => l.id === activeLogoId);
  const currentRotationDeg = activeLogo ? Math.round((activeLogo.rotation * 180 / Math.PI) % 360) : 0;
  // Normalize to 0-360 range for display
  const displayRotation = currentRotationDeg < 0 ? currentRotationDeg + 360 : currentRotationDeg;


  // 0. Handle Rotation
  useEffect(() => {
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
            }, 'image/jpeg', 0.85);
        }
    };
  }, [photo.originalUrl, photo.rotation]);

  // Load Frame Image
  useEffect(() => {
      if (!photo.frameOverlay) {
          frameImgRef.current = null;
          setFrameLoaded(false);
          return;
      }
      const img = new Image();
      img.onload = () => {
          frameImgRef.current = img;
          setFrameLoaded(true);
      };
      img.src = photo.frameOverlay;
  }, [photo.frameOverlay]);

  // Load Logo Images
  useEffect(() => {
      const currentUrls = new Set(photo.logos.map(l => l.url));
      for (const [url] of logoImagesRef.current) {
          if (!currentUrls.has(url)) {
              logoImagesRef.current.delete(url);
          }
      }

      photo.logos.forEach(logo => {
          if (!logoImagesRef.current.has(logo.url)) {
              const img = new Image();
              img.onload = () => {
                  logoImagesRef.current.set(logo.url, img);
                  renderCanvas(); 
              };
              img.src = logo.url;
              logoImagesRef.current.set(logo.url, img);
          }
      });
  }, [photo.logos]);


  // 1. Initialize Local Crop state
  useEffect(() => {
    if (isCropMode && imgRef.current) {
      const initialCrop = photo.crop || { x: 0, y: 0, width: imgRef.current.width, height: imgRef.current.height };
      setLocalCrop(initialCrop);
    } else {
      setLocalCrop(null);
    }
  }, [isCropMode, photo.id, photo.crop, displayUrl]); 

  // 2. Handle Aspect Ratio Changes
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

    if (targetW > imgW) { targetW = imgW; targetH = targetW / ratio; }
    if (targetH > imgH) { targetH = imgH; targetW = targetH * ratio; }

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

    canvas.width = drawW;
    canvas.height = drawH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Draw Image
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, drawW, drawH);
    
    // Apply filters
    applyImageFilters(ctx, drawW, drawH, photo.adjustments);
    
    // Apply Frame
    if (frameImgRef.current) {
        ctx.drawImage(frameImgRef.current, 0, 0, drawW, drawH);
    }

    // Apply Logos
    photo.logos.forEach(logo => {
        const logoImg = logoImagesRef.current.get(logo.url);
        if (logoImg && logoImg.complete) {
            const minDim = Math.min(drawW, drawH);
            const w = logoImg.width;
            const h = logoImg.height;
            const aspect = w / h;
            
            let renderH = minDim * logo.scale;
            let renderW = renderH * aspect;

            const cx = logo.x * drawW;
            const cy = logo.y * drawH;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(logo.rotation);

            // Draw Image Centered
            ctx.drawImage(logoImg, -renderW / 2, -renderH / 2, renderW, renderH);

            // Highlight active logo with Bounding Box and Handles
            if (activeLogoId === logo.id) {
                // Bounding Box
                ctx.strokeStyle = '#3b82f6'; // Blue
                ctx.lineWidth = 1.5;
                ctx.strokeRect(-renderW / 2, -renderH / 2, renderW, renderH);
                
                // Scale Handles (4 Corners)
                ctx.fillStyle = '#3b82f6';
                ctx.strokeStyle = '#ffffff';
                const handleSize = 6;
                const halfW = renderW / 2;
                const halfH = renderH / 2;
                
                const corners = [
                    { x: -halfW, y: -halfH }, // TL
                    { x: halfW, y: -halfH },  // TR
                    { x: -halfW, y: halfH },  // BL
                    { x: halfW, y: halfH },   // BR
                ];

                corners.forEach(corner => {
                    ctx.beginPath();
                    ctx.arc(corner.x, corner.y, handleSize, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                });

                // Rotate Handle (Top Center, extended)
                const handleDist = 25;
                ctx.beginPath();
                ctx.moveTo(0, -renderH / 2);
                ctx.lineTo(0, -renderH / 2 - handleDist);
                ctx.strokeStyle = '#3b82f6';
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(0, -renderH / 2 - handleDist, handleSize, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.stroke();
            }
            
            ctx.restore();
        }
    });
    
  }, [photo.adjustments, photo.crop, photo.logos, isCropMode, frameLoaded, activeLogoId]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  useEffect(() => {
    if (!displayUrl) return;
    const img = new Image();
    img.src = displayUrl;
    img.onload = () => {
      imgRef.current = img;
      renderCanvas();
    };
  }, [displayUrl, renderCanvas]);

  useEffect(() => {
    window.addEventListener('resize', renderCanvas);
    return () => window.removeEventListener('resize', renderCanvas);
  }, [renderCanvas]);

  // --- Interaction Utils ---

  // Helper to check if a point is close to a target
  const isNear = (x: number, y: number, tx: number, ty: number, dist: number = 10) => {
      return Math.sqrt(Math.pow(x - tx, 2) + Math.pow(y - ty, 2)) < dist;
  }

  const getLogoInteraction = (x: number, y: number): { logo: LogoLayer, type: 'body' | 'resize' | 'rotate' } | null => {
      // Loop reverse to hit top-most first
      for (let i = photo.logos.length - 1; i >= 0; i--) {
          const logo = photo.logos[i];
          const logoImg = logoImagesRef.current.get(logo.url);
          if (!logoImg) continue;

          const drawW = layout.width;
          const drawH = layout.height;
          const minDim = Math.min(drawW, drawH);
          const aspect = logoImg.width / logoImg.height;
          const renderH = minDim * logo.scale;
          const renderW = renderH * aspect;

          const cx = logo.x * drawW;
          const cy = logo.y * drawH;

          // Transform mouse point to local unrotated space
          const dx = x - cx;
          const dy = y - cy;
          // Inverse rotate
          const lx = dx * Math.cos(-logo.rotation) - dy * Math.sin(-logo.rotation);
          const ly = dx * Math.sin(-logo.rotation) + dy * Math.cos(-logo.rotation);

          // Check handles first (only if active)
          if (activeLogoId === logo.id) {
             // Rotate Handle: (0, -H/2 - 25)
             if (isNear(lx, ly, 0, -renderH/2 - 25, 15)) {
                 return { logo, type: 'rotate' };
             }
             // Resize Handles: Check all 4 corners
             const halfW = renderW / 2;
             const halfH = renderH / 2;
             const corners = [
                 { x: -halfW, y: -halfH },
                 { x: halfW, y: -halfH },
                 { x: -halfW, y: halfH },
                 { x: halfW, y: halfH },
             ];
             
             for (const corner of corners) {
                 if (isNear(lx, ly, corner.x, corner.y, 15)) {
                     return { logo, type: 'resize' };
                 }
             }
          }

          // Check Body: [-W/2, W/2] x [-H/2, H/2]
          if (lx >= -renderW/2 && lx <= renderW/2 && ly >= -renderH/2 && ly <= renderH/2) {
              return { logo, type: 'body' };
          }
      }
      return null;
  };


  // --- Interaction Handlers ---

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!layout.scale) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check Crop Mode Interaction (Simplified hit detection for mode switching)
    if (isCropMode && localCrop) {
         // Pass to crop handlers handled by overlay... 
         return; 
    }

    // Check Logo Interaction
    if (!isCropMode) {
        const hit = getLogoInteraction(mouseX, mouseY);
        
        if (hit) {
            setActiveLogoId(hit.logo.id);
            const mode = hit.type === 'rotate' ? 'rotate_logo' : hit.type === 'resize' ? 'scale_logo' : 'move_logo';
            setDragMode(mode);
            
            // Screen coords for center used in rotation
            const drawW = layout.width;
            const drawH = layout.height;
            const cx = hit.logo.x * drawW;
            const cy = hit.logo.y * drawH;

            setDragStart({
                ...dragStart,
                x: e.clientX,
                y: e.clientY,
                logoX: hit.logo.x,
                logoY: hit.logo.y,
                logoScale: hit.logo.scale,
                logoRotation: hit.logo.rotation,
                centerX: cx,
                centerY: cy
            });
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            return;
        } else {
            // Deselect if clicked empty space
            setActiveLogoId(null);
        }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragMode === 'none') return;
    e.preventDefault();

    if ((dragMode === 'move_logo' || dragMode === 'scale_logo' || dragMode === 'rotate_logo') && activeLogoId) {
        const dx = (e.clientX - dragStart.x);
        const dy = (e.clientY - dragStart.y);

        const updatedLogos = photo.logos.map(l => {
            if (l.id === activeLogoId) {
                // MOVE
                if (dragMode === 'move_logo') {
                    const deltaX = dx / layout.width;
                    const deltaY = dy / layout.height;
                    return {
                        ...l,
                        x: dragStart.logoX + deltaX,
                        y: dragStart.logoY + deltaY
                    };
                }
                
                // ROTATE
                if (dragMode === 'rotate_logo') {
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (!rect) return l;
                    const mx = e.clientX - rect.left;
                    const my = e.clientY - rect.top;
                    
                    const angle = Math.atan2(my - dragStart.centerY, mx - dragStart.centerX);
                    
                    return {
                        ...l,
                        rotation: angle + Math.PI / 2
                    };
                }

                // SCALE
                if (dragMode === 'scale_logo') {
                     const rect = canvasRef.current?.getBoundingClientRect();
                     if (!rect) return l;
                     const mx = e.clientX - rect.left;
                     const my = e.clientY - rect.top;
                     
                     // Current distance from center
                     const currentDist = Math.sqrt(Math.pow(mx - dragStart.centerX, 2) + Math.pow(my - dragStart.centerY, 2));
                     
                     const minDim = Math.min(layout.width, layout.height);
                     const logoImg = logoImagesRef.current.get(l.url);
                     const aspect = logoImg ? logoImg.width / logoImg.height : 1;
                     
                     const initialH = minDim * dragStart.logoScale;
                     const initialW = initialH * aspect;
                     const initialHandleDist = Math.sqrt(Math.pow(initialW/2, 2) + Math.pow(initialH/2, 2));

                     if (initialHandleDist === 0) return l;
                     
                     const scaleFactor = currentDist / initialHandleDist;
                     const newScale = dragStart.logoScale * scaleFactor;

                     return {
                         ...l,
                         scale: Math.max(0.02, newScale) // Min size limit
                     };
                }
            }
            return l;
        });
        
        onUpdateLogos(updatedLogos);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragMode.includes('_logo')) {
        setDragMode('none');
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        onCommitLogos();
    }
  };

  // --- Layer Management Handlers ---

  const handleBringToFront = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeLogoId) return;
    const currentLogos = [...photo.logos];
    const index = currentLogos.findIndex(l => l.id === activeLogoId);
    if (index === -1 || index === currentLogos.length - 1) return;
    const [item] = currentLogos.splice(index, 1);
    currentLogos.push(item);
    onLogosChange(currentLogos);
  };

  const handleSendToBack = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeLogoId) return;
    const currentLogos = [...photo.logos];
    const index = currentLogos.findIndex(l => l.id === activeLogoId);
    if (index === -1 || index === 0) return;
    const [item] = currentLogos.splice(index, 1);
    currentLogos.unshift(item);
    onLogosChange(currentLogos);
  };

  const handleDeleteActiveLogo = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!activeLogoId) return;
      const currentLogos = photo.logos.filter(l => l.id !== activeLogoId);
      onLogosChange(currentLogos);
      setActiveLogoId(null);
  };

  // --- Crop Overlay Handlers ---
  const handleCropPointerDown = (e: React.PointerEvent, mode: DragMode) => {
      if (!localCrop || !layout.scale) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragMode(mode);
      setDragStart({
          ...dragStart,
          x: e.clientX,
          y: e.clientY,
          cropX: localCrop.x,
          cropY: localCrop.y,
          cropW: localCrop.width,
          cropH: localCrop.height
      });
  };
  
  const handleCropPointerMove = (e: React.PointerEvent) => {
      if (!localCrop || !imgRef.current || !dragMode.includes('crop') && !['nw','ne','sw','se','n','s','e','w'].includes(dragMode)) return;
      
      const dx = (e.clientX - dragStart.x) / layout.scale;
      const dy = (e.clientY - dragStart.y) / layout.scale;

      let { cropX: x, cropY: y, cropW: w, cropH: h } = dragStart;
      const imgW = imgRef.current.width;
      const imgH = imgRef.current.height;
      const ratio = getRatioValue(aspectRatio);

      if (dragMode === 'move_crop') { 
        x += dx;
        y += dy;
        x = Math.max(0, Math.min(x, imgW - w));
        y = Math.max(0, Math.min(y, imgH - h));
      } else {
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
        
        if (x < 0) { w += x; x = 0; }
        if (x + w > imgW) { w = imgW - x; }
        if (y < 0) { h += y; y = 0; }
        if (y + h > imgH) { h = imgH - y; }

        if (w < minSize) w = minSize;
        if (h < minSize) h = minSize;
      }
      setLocalCrop({ x, y, width: w, height: h });
  };
  
  const handleCropPointerUp = (e: React.PointerEvent) => {
       if (dragMode !== 'none' && !dragMode.includes('_logo')) {
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
      
      {/* Rotation Popup */}
      {dragMode === 'rotate_logo' && activeLogoId && (
        <div className="absolute z-30 bg-black/80 text-white px-2 py-1 rounded text-xs pointer-events-none transform -translate-x-1/2 -translate-y-full" 
             style={{ 
                 left: dragStart.centerX + layout.left, 
                 top: dragStart.centerY + layout.top - 50 
             }}>
             {displayRotation}°
        </div>
      )}

      {/* Layer Management Toolbar */}
      {activeLogoId && !isCropMode && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-full px-4 py-2 flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-200">
             <button 
                onClick={handleSendToBack}
                title="Send Backward"
                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
             >
                <SendToBack size={18} />
             </button>
             <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
             <button 
                onClick={handleBringToFront}
                title="Bring Forward"
                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
             >
                <BringToFront size={18} />
             </button>
             <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
             <button 
                onClick={handleDeleteActiveLogo}
                title="Delete Logo"
                className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 transition-colors"
             >
                <Trash2 size={18} />
             </button>
          </div>
      )}

      <div style={{ width: layout.width, height: layout.height, position: 'relative' }}>
        <canvas 
            ref={canvasRef} 
            className="block shadow-xl dark:shadow-none cursor-crosshair" 
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        />

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
                    onPointerDown={(e) => handleCropPointerDown(e, 'move_crop')}
                    onPointerMove={handleCropPointerMove}
                    onPointerUp={handleCropPointerUp}
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

                    {/* Resize Handles */}
                    {/* Corners */}
                    <div 
                        className="absolute -top-1.5 -left-1.5 w-5 h-5 border-t-[3px] border-l-[3px] border-white cursor-nw-resize pointer-events-auto drop-shadow-md" 
                        onPointerDown={(e) => handleCropPointerDown(e, 'nw')} 
                    />
                    <div 
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 border-t-[3px] border-r-[3px] border-white cursor-ne-resize pointer-events-auto drop-shadow-md" 
                        onPointerDown={(e) => handleCropPointerDown(e, 'ne')} 
                    />
                    <div 
                        className="absolute -bottom-1.5 -left-1.5 w-5 h-5 border-b-[3px] border-l-[3px] border-white cursor-sw-resize pointer-events-auto drop-shadow-md" 
                        onPointerDown={(e) => handleCropPointerDown(e, 'sw')} 
                    />
                    <div 
                        className="absolute -bottom-1.5 -right-1.5 w-5 h-5 border-b-[3px] border-r-[3px] border-white cursor-se-resize pointer-events-auto drop-shadow-md" 
                        onPointerDown={(e) => handleCropPointerDown(e, 'se')} 
                    />
                    
                    {/* Edges (Only Free mode) */}
                    {aspectRatio === 'Free' && (
                        <>
                         <div onPointerDown={(e) => handleCropPointerDown(e, 'n')} className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-4 cursor-n-resize pointer-events-auto flex justify-center"><div className="w-4 h-1 bg-white/80 rounded-full shadow-sm" /></div>
                         <div onPointerDown={(e) => handleCropPointerDown(e, 's')} className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-4 cursor-s-resize pointer-events-auto flex items-end justify-center"><div className="w-4 h-1 bg-white/80 rounded-full shadow-sm" /></div>
                         <div onPointerDown={(e) => handleCropPointerDown(e, 'w')} className="absolute top-1/2 -left-2 -translate-y-1/2 h-8 w-4 cursor-w-resize pointer-events-auto flex items-center"><div className="h-4 w-1 bg-white/80 rounded-full shadow-sm" /></div>
                         <div onPointerDown={(e) => handleCropPointerDown(e, 'e')} className="absolute top-1/2 -right-2 -translate-y-1/2 h-8 w-4 cursor-e-resize pointer-events-auto flex items-center justify-end"><div className="h-4 w-1 bg-white/80 rounded-full shadow-sm" /></div>
                        </>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};