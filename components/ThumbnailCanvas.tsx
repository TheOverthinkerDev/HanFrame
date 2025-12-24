import React, { useEffect, useRef } from 'react';
import { Photo, LogoLayer } from '../types';
import { getThumbnailStyles } from '../utils/processor';

interface ThumbnailCanvasProps {
  photo: Photo;
  className?: string;
}

export const ThumbnailCanvas = React.memo(({ photo, className }: ThumbnailCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load images
    const baseImg = new Image();
    const frameImg = photo.frameOverlay ? new Image() : null;
    const logoImgs: { layer: LogoLayer; img: HTMLImageElement }[] = [];

    let isMounted = true;

    // Helper to draw everything once resources are loaded
    const draw = () => {
        if (!isMounted) return;
        if (!baseImg.complete) return;
        if (frameImg && !frameImg.complete) return;
        
        // 1. Calculate effective dimensions (Orientation)
        // photo.width/height are the full original dimensions
        const naturalW = photo.width; 
        const naturalH = photo.height;
        const rot = photo.rotation || 0;
        const isVert = rot % 180 !== 0;

        const effW = isVert ? naturalH : naturalW;
        const effH = isVert ? naturalW : naturalH;
        
        // 2. Determine Viewport (Crop)
        // If crop exists, use it. Else use full effective size.
        const crop = photo.crop || { x: 0, y: 0, width: effW, height: effH };
        
        // 3. Set Canvas Resolution
        // We cap the max dimension to save memory/perf, e.g. 300px for thumbnails.
        // This ensures the thumbnail isn't huge but maintains the aspect ratio of the crop.
        const thumbMax = 300; 
        const renderScale = Math.min(thumbMax / crop.width, thumbMax / crop.height);
        
        const canvasW = Math.ceil(crop.width * renderScale);
        const canvasH = Math.ceil(crop.height * renderScale);

        // Update canvas size if changed
        if (canvas.width !== canvasW || canvas.height !== canvasH) {
            canvas.width = canvasW;
            canvas.height = canvasH;
        }

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 4. Draw Base Image with Transforms
        // We want to simulate looking through the "Crop Window" at the "Rotated Image".
        ctx.save();
        ctx.scale(renderScale, renderScale); // Map Logical Pixels to Canvas Pixels
        
        // Move "Camera" Center to Center of output canvas (Logical Space)
        ctx.translate(crop.width / 2, crop.height / 2);

        // Apply Straighten Rotation
        const straightenRad = (photo.straighten || 0) * (Math.PI / 180);
        ctx.rotate(straightenRad);

        // Find Center of Crop in Effective Space
        const cropCx = crop.x + crop.width / 2;
        const cropCy = crop.y + crop.height / 2;

        // Translate so that Crop Center aligns with current origin (0,0)
        // effectively moving the world so crop center is at camera center
        ctx.translate(-cropCx, -cropCy);

        // Now we are in "Effective Space" top-left origin.
        // Move to Image Center to apply orientation rotation
        ctx.translate(effW / 2, effH / 2);
        ctx.rotate(rot * Math.PI / 180);

        // Draw Base Image Centered
        // Note: baseImg.width/height are the small thumbnail blob sizes (~300px).
        // photo.width/height are the full original sizes (~4000px).
        // We draw the small thumbnail stretched to the Logical dimensions so it aligns with the coordinate system.
        // This might look pixelated for deep crops, which is acceptable for thumbnails.
        ctx.drawImage(baseImg, -naturalW / 2, -naturalH / 2, naturalW, naturalH);
        
        ctx.restore();

        // 5. Draw Overlays (Frame & Logos)
        // Overlays are applied relative to the Final Cropped View
        
        if (frameImg) {
            ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
        }

        logoImgs.forEach(({ layer, img }) => {
            if (!img.complete) return;
            
            const minDim = Math.min(canvas.width, canvas.height);
            const w = img.width;
            const h = img.height;
            const aspect = w / h;
            
            let renderH = minDim * layer.scale;
            let renderW = renderH * aspect;

            const cx = layer.x * canvas.width;
            const cy = layer.y * canvas.height;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(layer.rotation);
            ctx.drawImage(img, -renderW / 2, -renderH / 2, renderW, renderH);
            ctx.restore();
        });
    };

    // Load Base
    baseImg.onload = draw;
    baseImg.src = photo.thumbnailUrl;

    // Load Frame
    if (frameImg) {
        frameImg.onload = draw;
        frameImg.src = photo.frameOverlay!;
    }

    // Load Logos
    photo.logos.forEach(layer => {
        const img = new Image();
        img.onload = draw;
        img.src = layer.url;
        logoImgs.push({ layer, img });
    });
    
    // Trigger initial draw if images already cached/loaded
    if (baseImg.complete) draw();

    return () => {
        isMounted = false;
    };
  }, [photo.thumbnailUrl, photo.frameOverlay, photo.logos, photo.rotation, photo.crop, photo.straighten, photo.width, photo.height]); 

  // Apply CSS filters to the canvas to preview adjustments
  return (
    <canvas 
        ref={canvasRef} 
        className={className}
        style={{
            ...getThumbnailStyles(photo.adjustments),
            width: '100%',
            height: '100%',
            objectFit: 'contain' 
        }}
    />
  );
}, (prev, next) => {
    // Custom comparison to effectively use React.memo even if photo object reference changes slightly.
    // We only care if visual properties changed.
    return prev.photo.id === next.photo.id &&
           prev.photo.thumbnailUrl === next.photo.thumbnailUrl &&
           prev.photo.frameOverlay === next.photo.frameOverlay &&
           prev.photo.logos === next.photo.logos && 
           prev.photo.rotation === next.photo.rotation &&
           prev.photo.crop === next.photo.crop &&
           prev.photo.straighten === next.photo.straighten &&
           prev.photo.adjustments === next.photo.adjustments && 
           prev.className === next.className;
});