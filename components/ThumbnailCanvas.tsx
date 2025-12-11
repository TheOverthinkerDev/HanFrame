import React, { useEffect, useRef } from 'react';
import { Photo, LogoLayer } from '../types';
import { getThumbnailStyles } from '../utils/processor';

interface ThumbnailCanvasProps {
  photo: Photo;
  className?: string;
}

export const ThumbnailCanvas: React.FC<ThumbnailCanvasProps> = ({ photo, className }) => {
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
        
        // 1. Setup Canvas Dimensions (match thumbnail natural size)
        // We set canvas size to match the image aspect ratio
        // For thumbnail purposes, we can keep it relatively small but high enough quality
        const thumbW = 150; 
        const ratio = baseImg.width / baseImg.height;
        const thumbH = thumbW / ratio;

        canvas.width = thumbW;
        canvas.height = thumbH;

        // 2. Draw Base Image
        ctx.clearRect(0, 0, thumbW, thumbH);
        ctx.drawImage(baseImg, 0, 0, thumbW, thumbH);

        // 3. Draw Frame (on top of base, unaffected by filters usually, but here filters are CSS on container)
        // Actually, frame should be under CSS filters? 
        // In CanvasView, frame is drawn via ctx, then filters applied via pixel manipulation.
        // In Thumbnail, we apply CSS filters to the canvas. 
        // So drawing frame here means CSS filters apply to frame too. This matches CanvasView logic.
        if (frameImg) {
            ctx.drawImage(frameImg, 0, 0, thumbW, thumbH);
        }

        // 4. Draw Logos
        logoImgs.forEach(({ layer, img }) => {
            if (!img.complete) return;
            
            const minDim = Math.min(thumbW, thumbH);
            const w = img.width;
            const h = img.height;
            const aspect = w / h;
            
            let renderH = minDim * layer.scale;
            let renderW = renderH * aspect;

            const cx = layer.x * thumbW;
            const cy = layer.y * thumbH;

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
        img.onload = () => {
             // Re-draw when any logo loads
             draw();
        };
        img.src = layer.url;
        logoImgs.push({ layer, img });
    });

    return () => {
        isMounted = false;
    };
  }, [photo.thumbnailUrl, photo.frameOverlay, photo.logos, photo.rotation]); 
  // Note: rotation prop on photo is just metadata (0,90..), visually handling rotation in thumb is complex 
  // because we'd need to rotate the canvas. For now, we display the unrotated thumb content (frames/logos relative to original).

  // We use CSS styles for the color adjustments
  return (
    <canvas 
        ref={canvasRef} 
        className={className}
        style={{
            ...getThumbnailStyles(photo.adjustments),
            width: '100%',
            height: '100%',
            objectFit: 'cover'
        }}
    />
  );
};