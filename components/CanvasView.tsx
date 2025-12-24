import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Photo, CropData, AspectRatio, LogoLayer } from '../types';
import { applyImageFilters } from '../utils/processor';
import { applyWebGLFilters } from '../utils/webgl';
import { Loader2, BringToFront, SendToBack, Trash2 } from 'lucide-react';

interface CanvasViewProps {
  photo: Photo;
  isCropMode: boolean;
  onUpdateCrop: (crop: CropData | null) => void;
  onCommitCrop: (crop: CropData | null) => void;
  aspectRatio: AspectRatio;
  onLogosChange: (logos: LogoLayer[]) => void;
  useGPU?: boolean;
}

type DragMode = 'none' | 'move_crop' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'move_logo' | 'scale_logo' | 'rotate_logo';

interface SnapGuides {
    x: number | null; // Normalized X position to draw line
    y: number | null; // Normalized Y position to draw line
}

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
    onCommitCrop,
    aspectRatio,
    onLogosChange,
    useGPU = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Performance Optimization: Offscreen canvas to cache the filtered image
  const filteredCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isFilteredCacheValid = useRef<boolean>(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameImgRef = useRef<HTMLImageElement | null>(null);
  const logoImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [isGeneratingView, setIsGeneratingView] = useState(false);
  const [frameLoaded, setFrameLoaded] = useState(false);

  // Add a unique key to layout to ensure it belongs to the current photo/rotation state
  const [layout, setLayout] = useState({ width: 0, height: 0, top: 0, left: 0, scale: 1, key: '' });
  
  const [localCrop, setLocalCrop] = useState<CropData | null>(null);
  const [localLogos, setLocalLogos] = useState<LogoLayer[]>([]);

  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [activeLogoId, setActiveLogoId] = useState<string | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuides>({ x: null, y: null });
  
  const [dragStart, setDragStart] = useState({ 
      x: 0, y: 0, 
      cropX: 0, cropY: 0, cropW: 0, cropH: 0,
      logoX: 0, logoY: 0,
      logoScale: 0,
      logoRotation: 0,
      centerX: 0, centerY: 0 
  });
  
  const activeLogo = localLogos.find(l => l.id === activeLogoId);
  const currentRotationDeg = activeLogo ? Math.round((activeLogo.rotation * 180 / Math.PI) % 360) : 0;
  const displayRotation = currentRotationDeg < 0 ? currentRotationDeg + 360 : currentRotationDeg;

  // Sync local logos
  useEffect(() => {
    setLocalLogos(photo.logos);
  }, [photo.logos]);

  // Reset local crop momentarily when photo changes to prevent ghosting
  useEffect(() => {
      setLocalCrop(null);
      isFilteredCacheValid.current = false;
  }, [photo.id, photo.rotation]);

  // 0. Handle Rotation (Orientation)
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
      const currentUrls = new Set(localLogos.map(l => l.url));
      for (const [url] of logoImagesRef.current) {
          if (!currentUrls.has(url)) {
              logoImagesRef.current.delete(url);
          }
      }

      localLogos.forEach(logo => {
          if (!logoImagesRef.current.has(logo.url)) {
              const img = new Image();
              img.onload = () => {
                  logoImagesRef.current.set(logo.url, img);
                  updateFilterCache();
                  renderCanvas(); 
              };
              img.src = logo.url;
              logoImagesRef.current.set(logo.url, img);
          }
      });
  }, [localLogos]);

  // --- Filter Cache Logic ---
  const updateFilterCache = useCallback(() => {
      if (!imgRef.current) return;
      const img = imgRef.current;
      
      if (!filteredCanvasRef.current) {
          filteredCanvasRef.current = document.createElement('canvas');
      }
      const fCanvas = filteredCanvasRef.current;
      
      if (fCanvas.width !== img.width || fCanvas.height !== img.height) {
          fCanvas.width = img.width;
          fCanvas.height = img.height;
      }
      
      // Determine strategy based on GPU flag
      if (useGPU) {
          try {
             applyWebGLFilters(fCanvas, img, photo.adjustments);
          } catch (e) {
              console.error("WebGL Failed, falling back to CPU", e);
              // Fallback
              const ctx = fCanvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.clearRect(0, 0, fCanvas.width, fCanvas.height);
                ctx.drawImage(img, 0, 0);
                applyImageFilters(ctx, img.width, img.height, photo.adjustments);
              }
          }
      } else {
          const ctx = fCanvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return;
          // Ensure clear before drawing to avoid overlaps with transparent images
          ctx.clearRect(0, 0, fCanvas.width, fCanvas.height);
          ctx.drawImage(img, 0, 0);
          applyImageFilters(ctx, img.width, img.height, photo.adjustments);
      }
      
      isFilteredCacheValid.current = true;
  }, [photo.adjustments, useGPU]);

  // 1. Initialize & Sync Local Crop state
  useEffect(() => {
      if (!isCropMode) return;

      // Case A: Initial Load or reset
      if (imgRef.current && !photo.crop && !localCrop) {
           const initialCrop = { x: 0, y: 0, width: imgRef.current.width, height: imgRef.current.height };
           setLocalCrop(initialCrop);
           // Don't call onUpdateCrop here to avoid initial loop, wait for interaction
           return;
      }

      // Case B: Sync from parent (External change like Aspect Ratio or Batch)
      // Only sync if we are NOT dragging (dragMode === 'none')
      if (dragMode === 'none' && photo.crop) {
          setLocalCrop(photo.crop);
      }
  }, [isCropMode, photo.crop, dragMode]);

  // 2. Handle Aspect Ratio Changes (User interaction)
  useEffect(() => {
    if (!isCropMode || !localCrop || aspectRatio === 'Free' || !imgRef.current) return;
    // Check if layout is ready for current photo to avoid applying ratio to wrong dims
    if (!layout.key.startsWith(`${photo.id}-${photo.rotation}`)) return;

    const ratio = getRatioValue(aspectRatio);
    if (!ratio) return;

    applyAspectRatio(ratio, imgRef.current.width, imgRef.current.height, localCrop);
  }, [aspectRatio, layout.key]); 

  // Helper to apply aspect ratio logic
  const applyAspectRatio = (ratio: number, imgW: number, imgH: number, currentBaseCrop: CropData) => {
      const cx = currentBaseCrop.x + currentBaseCrop.width / 2;
      const cy = currentBaseCrop.y + currentBaseCrop.height / 2;
      const currentArea = currentBaseCrop.width * currentBaseCrop.height;
      
      let targetW = Math.sqrt(currentArea * ratio);
      let targetH = targetW / ratio;

      // Fit inside limits
      if (targetW > imgW) { targetW = imgW; targetH = targetW / ratio; }
      if (targetH > imgH) { targetH = imgH; targetW = targetH * ratio; }

      let newX = cx - targetW / 2;
      let newY = cy - targetH / 2;

      // Bound check
      if (newX < 0) newX = 0;
      if (newY < 0) newY = 0;
      if (newX + targetW > imgW) newX = imgW - targetW;
      if (newY + targetH > imgH) newY = imgH - targetH;

      const newCrop = { x: newX, y: newY, width: targetW, height: targetH };
      setLocalCrop(newCrop);
      onUpdateCrop(newCrop);
  };

  // 3. Main Render Logic
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imgRef.current;
    
    // Fallback to raw img if cache is invalid
    const sourceImage = (isFilteredCacheValid.current && filteredCanvasRef.current) ? filteredCanvasRef.current : img;

    if (!canvas || !container || !sourceImage || !img) return;

    const contW = container.clientWidth;
    const contH = container.clientHeight;
    
    let srcW, srcH;

    if (isCropMode) {
      srcW = img.width;
      srcH = img.height;
    } else {
      const c = photo.crop || { x: 0, y: 0, width: img.width, height: img.height };
      srcW = c.width;
      srcH = c.height;
    }

    const padding = 20;
    const availW = contW - padding * 2;
    const availH = contH - padding * 2;
    const scale = Math.min(availW / srcW, availH / srcH);

    const drawW = srcW * scale;
    const drawH = srcH * scale;

    // Use ID + Rotation as uniqueness key
    const layoutKey = `${photo.id}-${photo.rotation}`;

    const newLayout = {
      width: drawW,
      height: drawH,
      left: (contW - drawW) / 2,
      top: (contH - drawH) / 2,
      scale: scale,
      key: layoutKey
    };

    setLayout(prev => {
        // Prevent infinite loops but enforce update if ID changes
        if (prev.key === layoutKey && Math.abs(prev.width - drawW) < 1 && Math.abs(prev.scale - scale) < 0.0001) return prev;
        return newLayout;
    });

    // Explicitly set dims to clear canvas
    if (canvas.width !== drawW || canvas.height !== drawH) {
        canvas.width = drawW;
        canvas.height = drawH;
    } else {
        // If dims match, clear manually
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, drawW, drawH);
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const straightenRad = (photo.straighten || 0) * (Math.PI / 180);
    
    ctx.save();
    ctx.translate(drawW / 2, drawH / 2);
    ctx.rotate(straightenRad);
    
    let offsetX = 0;
    let offsetY = 0;

    if (isCropMode) {
        offsetX = -img.width * scale / 2;
        offsetY = -img.height * scale / 2;
    } else {
        const c = photo.crop || { x: 0, y: 0, width: img.width, height: img.height };
        const cropCx = c.x + c.width / 2;
        const cropCy = c.y + c.height / 2;
        
        offsetX = -cropCx * scale;
        offsetY = -cropCy * scale;
    }

    ctx.drawImage(sourceImage, 0, 0, img.width, img.height, offsetX, offsetY, img.width * scale, img.height * scale);
    ctx.restore();

    // Frame
    if (frameImgRef.current) {
        ctx.drawImage(frameImgRef.current, 0, 0, drawW, drawH);
    }

    // Logos
    localLogos.forEach(logo => {
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

            ctx.drawImage(logoImg, -renderW / 2, -renderH / 2, renderW, renderH);

            if (activeLogoId === logo.id) {
                // Bounds
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(-renderW / 2, -renderH / 2, renderW, renderH);
                
                // Handles
                ctx.fillStyle = '#3b82f6';
                ctx.strokeStyle = '#ffffff';
                const handleSize = 6;
                const halfW = renderW / 2;
                const halfH = renderH / 2;
                
                const corners = [{ x: -halfW, y: -halfH }, { x: halfW, y: -halfH }, { x: -halfW, y: halfH }, { x: halfW, y: halfH }];
                corners.forEach(corner => {
                    ctx.beginPath();
                    ctx.arc(corner.x, corner.y, handleSize, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                });

                // Rotate Handle
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
    
  }, [photo.crop, localLogos, photo.straighten, isCropMode, frameLoaded, activeLogoId, photo.id, photo.rotation]);

  // Adjustments change effect
  useEffect(() => {
      // If switching GPU modes, we might need to recreate the canvas or context, 
      // but for now re-running filter cache update handles drawing to the correct context.
      // However, converting a 2D canvas to WebGL or vice versa in place is tricky.
      // Easiest way: re-create the offscreen canvas element if mode switches.
      filteredCanvasRef.current = document.createElement('canvas');
      updateFilterCache();
      renderCanvas();
  }, [updateFilterCache, renderCanvas, useGPU]); // Add useGPU dependency

  // Image Load Effect
  useEffect(() => {
    if (!displayUrl) return;
    const img = new Image();
    img.src = displayUrl;
    img.onload = () => {
      imgRef.current = img;
      
      // CRITICAL: Initialize local crop relative to THIS image when loaded
      let newCrop = photo.crop;
      
      // If we don't have a crop yet (fresh image), or if we are in crop mode, we need to ensure the crop box fits
      if (!newCrop) {
          const fullCrop = { x: 0, y: 0, width: img.width, height: img.height };
          newCrop = fullCrop;

          // If a specific aspect ratio is selected, enforce it immediately on load
          if (aspectRatio !== 'Free') {
              const ratio = getRatioValue(aspectRatio);
              if (ratio) {
                  // Calculate fit for new dimensions
                  const imgW = img.width;
                  const imgH = img.height;
                  const currentArea = imgW * imgH;
                  
                  let targetW = Math.sqrt(currentArea * ratio);
                  let targetH = targetW / ratio;

                  if (targetW > imgW) { targetW = imgW; targetH = targetW / ratio; }
                  if (targetH > imgH) { targetH = imgH; targetW = targetH * ratio; }

                  newCrop = {
                      x: (imgW - targetW) / 2,
                      y: (imgH - targetH) / 2,
                      width: targetW,
                      height: targetH
                  };
              }
          }
      }

      // Update state
      if (isCropMode) {
          setLocalCrop(newCrop);
          // If we calculated a new default crop, sync it up
          if (!photo.crop) onUpdateCrop(newCrop);
      }

      updateFilterCache();
      renderCanvas();
    };
  }, [displayUrl, renderCanvas, updateFilterCache, photo.crop, aspectRatio, isCropMode]); 

  useEffect(() => {
    window.addEventListener('resize', renderCanvas);
    return () => window.removeEventListener('resize', renderCanvas);
  }, [renderCanvas]);

  // --- Interaction Handlers ---

  const isNear = (x: number, y: number, tx: number, ty: number, dist: number = 10) => {
      return Math.sqrt(Math.pow(x - tx, 2) + Math.pow(y - ty, 2)) < dist;
  }

  const getLogoInteraction = (x: number, y: number): { logo: LogoLayer, type: 'body' | 'resize' | 'rotate' } | null => {
      for (let i = localLogos.length - 1; i >= 0; i--) {
          const logo = localLogos[i];
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

          const dx = x - cx;
          const dy = y - cy;
          const lx = dx * Math.cos(-logo.rotation) - dy * Math.sin(-logo.rotation);
          const ly = dx * Math.sin(-logo.rotation) + dy * Math.cos(-logo.rotation);

          if (activeLogoId === logo.id) {
             if (isNear(lx, ly, 0, -renderH/2 - 25, 15)) return { logo, type: 'rotate' };
             const halfW = renderW / 2;
             const halfH = renderH / 2;
             if (isNear(lx, ly, -halfW, -halfH, 15) || isNear(lx, ly, halfW, -halfH, 15) || isNear(lx, ly, -halfW, halfH, 15) || isNear(lx, ly, halfW, halfH, 15)) {
                 return { logo, type: 'resize' };
             }
          }
          if (lx >= -renderW/2 && lx <= renderW/2 && ly >= -renderH/2 && ly <= renderH/2) {
              return { logo, type: 'body' };
          }
      }
      return null;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragMode === 'none') return;
    
    // SAFETY: If buttons are not pressed (e.g. lost focus and released outside), stop drag
    if (e.buttons === 0) {
        setDragMode('none');
        if (containerRef.current && containerRef.current.hasPointerCapture(e.pointerId)) {
            containerRef.current.releasePointerCapture(e.pointerId);
        }
        return;
    }

    e.preventDefault();

    if ((dragMode === 'move_logo' || dragMode === 'scale_logo' || dragMode === 'rotate_logo') && activeLogoId) {
        // Logo logic...
        const dx = (e.clientX - dragStart.x);
        const dy = (e.clientY - dragStart.y);

        const updatedLogos = localLogos.map(l => {
            if (l.id === activeLogoId) {
                if (dragMode === 'move_logo') {
                    let newX = dragStart.logoX + (dx / layout.width);
                    let newY = dragStart.logoY + (dy / layout.height);
                    
                    const logoImg = logoImagesRef.current.get(l.url);
                    const aspect = logoImg ? logoImg.width / logoImg.height : 1;
                    const minDim = Math.min(layout.width, layout.height);
                    const renderH = minDim * l.scale;
                    const renderW = renderH * aspect;
                    
                    const normHalfW = (renderW / 2) / layout.width;
                    const normHalfH = (renderH / 2) / layout.height;
                    
                    const snapPx = 12;
                    const snapThreshX = snapPx / layout.width;
                    const snapThreshY = snapPx / layout.height;

                    let snappedX = false;
                    let snappedY = false;

                    if (Math.abs(newX - 0.5) < snapThreshX) { newX = 0.5; snappedX = true; }
                    if (Math.abs(newY - 0.5) < snapThreshY) { newY = 0.5; snappedY = true; }

                    if (!snappedX && Math.abs((newX - normHalfW) - 0) < snapThreshX) { newX = normHalfW; snappedX = true; }
                    if (!snappedX && Math.abs((newX + normHalfW) - 1) < snapThreshX) { newX = 1 - normHalfW; snappedX = true; }
                    if (!snappedY && Math.abs((newY - normHalfH) - 0) < snapThreshY) { newY = normHalfH; snappedY = true; }
                    if (!snappedY && Math.abs((newY + normHalfH) - 1) < snapThreshY) { newY = 1 - normHalfH; snappedY = true; }

                    setSnapGuides({
                        x: snappedX ? newX : null,
                        y: snappedY ? newY : null
                    });

                    newX = Math.max(normHalfW, Math.min(newX, 1 - normHalfW));
                    newY = Math.max(normHalfH, Math.min(newY, 1 - normHalfH));

                    return { ...l, x: newX, y: newY };
                }
                if (dragMode === 'rotate_logo') {
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (!rect) return l;
                    const mx = e.clientX - rect.left;
                    const my = e.clientY - rect.top;
                    const angle = Math.atan2(my - dragStart.centerY, mx - dragStart.centerX);
                    return { ...l, rotation: angle + Math.PI / 2 };
                }
                if (dragMode === 'scale_logo') {
                     const rect = canvasRef.current?.getBoundingClientRect();
                     if (!rect) return l;
                     const mx = e.clientX - rect.left;
                     const my = e.clientY - rect.top;
                     const currentDist = Math.sqrt(Math.pow(mx - dragStart.centerX, 2) + Math.pow(my - dragStart.centerY, 2));
                     const initialH = Math.min(layout.width, layout.height) * dragStart.logoScale;
                     const logoImg = logoImagesRef.current.get(l.url);
                     const aspect = logoImg ? logoImg.width / logoImg.height : 1;
                     const initialW = initialH * aspect;
                     const initialHandleDist = Math.sqrt(Math.pow(initialW/2, 2) + Math.pow(initialH/2, 2));
                     if (initialHandleDist === 0) return l;
                     const scaleFactor = currentDist / initialHandleDist;
                     const newScale = dragStart.logoScale * scaleFactor;
                     return { ...l, scale: Math.max(0.02, newScale) };
                }
            }
            return l;
        });
        setLocalLogos(updatedLogos);
        return;
    }
    
    // Crop Logic
    if (dragMode === 'move_crop' || dragMode.length <= 2) {
      if (!localCrop || !imgRef.current) return;
      
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
      
      const newCrop = { x, y, width: w, height: h };
      setLocalCrop(newCrop);
      // OPTIMIZATION: Removed onUpdateCrop(newCrop) to prevent parent re-renders and lag
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragMode === 'none') return;

    if (containerRef.current && containerRef.current.hasPointerCapture(e.pointerId)) {
        containerRef.current.releasePointerCapture(e.pointerId);
    }

    if (dragMode.includes('_logo')) {
        setSnapGuides({ x: null, y: null }); 
        onLogosChange(localLogos);
    } else {
        onCommitCrop(localCrop);
    }
    setDragMode('none');
  };

  // Triggered when clicking a specific crop handle or the crop box itself
  const handleCropPointerDown = (e: React.PointerEvent, mode: DragMode) => {
      if (!localCrop || !layout.scale || !containerRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      
      // CRITICAL: Capture on the container so we can drag outside the handle bounds freely
      containerRef.current.setPointerCapture(e.pointerId);

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

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (!layout.scale || !containerRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (!isCropMode) {
        const hit = getLogoInteraction(mouseX, mouseY);
        
        if (hit) {
            setActiveLogoId(hit.logo.id);
            const mode = hit.type === 'rotate' ? 'rotate_logo' : hit.type === 'resize' ? 'scale_logo' : 'move_logo';
            setDragMode(mode);
            
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
            containerRef.current.setPointerCapture(e.pointerId);
            return;
        } else {
            setActiveLogoId(null);
        }
    }
  };

  const handleBringToFront = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeLogoId) return;
    const currentLogos = [...localLogos];
    const index = currentLogos.findIndex(l => l.id === activeLogoId);
    if (index === -1 || index === currentLogos.length - 1) return;
    const [item] = currentLogos.splice(index, 1);
    currentLogos.push(item);
    setLocalLogos(currentLogos);
    onLogosChange(currentLogos);
  };

  const handleSendToBack = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeLogoId) return;
    const currentLogos = [...localLogos];
    const index = currentLogos.findIndex(l => l.id === activeLogoId);
    if (index === -1 || index === 0) return;
    const [item] = currentLogos.splice(index, 1);
    currentLogos.unshift(item);
    setLocalLogos(currentLogos);
    onLogosChange(currentLogos);
  };

  const handleDeleteActiveLogo = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!activeLogoId) return;
      const currentLogos = localLogos.filter(l => l.id !== activeLogoId);
      setLocalLogos(currentLogos);
      onLogosChange(currentLogos);
      setActiveLogoId(null);
  };

  const toStyle = (val: number) => val * layout.scale;

  if (isGeneratingView) {
      return (
        <div className="flex-1 h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-950">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-blue-500" size={32} />
                <span className="text-zinc-500 text-sm">Rotating View...</span>
            </div>
        </div>
      );
  }

  // Ensure layout matches current photo before showing overlay
  const isLayoutSynced = layout.key.startsWith(`${photo.id}-${photo.rotation}`);

  return (
    <div 
        ref={containerRef} 
        className="flex-1 h-full relative flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 overflow-hidden select-none touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp} // Safety to stop drag if mouse leaves window
    >
      
      {dragMode === 'rotate_logo' && activeLogoId && (
        <div className="absolute z-30 bg-black/80 text-white px-2 py-1 rounded text-xs pointer-events-none transform -translate-x-1/2 -translate-y-full" 
             style={{ 
                 left: dragStart.centerX + layout.left, 
                 top: dragStart.centerY + layout.top - 50 
             }}>
             {displayRotation}°
        </div>
      )}

      {activeLogoId && !isCropMode && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-full px-4 py-2 flex items-center gap-3">
             <button onClick={handleSendToBack} title="Send Backward" className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"><SendToBack size={18} /></button>
             <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
             <button onClick={handleBringToFront} title="Bring Forward" className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"><BringToFront size={18} /></button>
             <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
             <button onClick={handleDeleteActiveLogo} title="Delete Logo" className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 transition-colors"><Trash2 size={18} /></button>
          </div>
      )}

      <div style={{ width: layout.width, height: layout.height, position: 'relative' }}>
        <canvas 
            ref={canvasRef} 
            className="block shadow-xl dark:shadow-none"
            onPointerDown={handleCanvasPointerDown}
        />

        {!isCropMode && (
            <>
                {snapGuides.x !== null && <div className="absolute top-0 bottom-0 w-px bg-pink-500 z-50 pointer-events-none shadow-[0_0_2px_rgba(0,0,0,0.5)]" style={{ left: snapGuides.x * layout.width }} />}
                {snapGuides.y !== null && <div className="absolute left-0 right-0 h-px bg-pink-500 z-50 pointer-events-none shadow-[0_0_2px_rgba(0,0,0,0.5)]" style={{ top: snapGuides.y * layout.height }} />}
            </>
        )}

        {isCropMode && localCrop && isLayoutSynced && (
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
                <div
                    className={`absolute border border-white/90 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] ${dragMode === 'move_crop' ? 'cursor-grabbing' : 'cursor-grab'}`}
                    style={{
                        left: toStyle(localCrop.x),
                        top: toStyle(localCrop.y),
                        width: toStyle(localCrop.width),
                        height: toStyle(localCrop.height),
                        pointerEvents: 'auto',
                        willChange: 'left, top, width, height' // Optimize rendering performance
                    }}
                    onPointerDown={(e) => handleCropPointerDown(e, 'move_crop')}
                >
                    <div className="absolute inset-0 pointer-events-none opacity-80">
                        <div className="absolute top-0 bottom-0 left-[33.33%] w-px bg-white/50 shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                        <div className="absolute top-0 bottom-0 left-[66.66%] w-px bg-white/50 shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                        <div className="absolute left-0 right-0 top-[33.33%] h-px bg-white/50 shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                        <div className="absolute left-0 right-0 top-[66.66%] h-px bg-white/50 shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                    </div>

                    <div className="absolute -top-1.5 -left-1.5 w-5 h-5 border-t-[3px] border-l-[3px] border-white cursor-nw-resize pointer-events-auto drop-shadow-md" onPointerDown={(e) => handleCropPointerDown(e, 'nw')} />
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 border-t-[3px] border-r-[3px] border-white cursor-ne-resize pointer-events-auto drop-shadow-md" onPointerDown={(e) => handleCropPointerDown(e, 'ne')} />
                    <div className="absolute -bottom-1.5 -left-1.5 w-5 h-5 border-b-[3px] border-l-[3px] border-white cursor-sw-resize pointer-events-auto drop-shadow-md" onPointerDown={(e) => handleCropPointerDown(e, 'sw')} />
                    <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 border-b-[3px] border-r-[3px] border-white cursor-se-resize pointer-events-auto drop-shadow-md" onPointerDown={(e) => handleCropPointerDown(e, 'se')} />
                    
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