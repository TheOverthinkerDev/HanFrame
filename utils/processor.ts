import React from 'react';
// @ts-ignore
import heic2any from 'heic2any';
import { Adjustments } from '../types';

/**
 * clamp value between min and max
 */
const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

/**
 * Checks if a file is a HEIC image
 */
export const isHeic = (file: File): boolean => {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return type === 'image/heic' || type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif');
};

/**
 * Converts a HEIC file to a JPEG Blob
 */
export const convertHeicToJpeg = async (file: File): Promise<Blob> => {
  try {
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9
    });
    // heic2any can return a single blob or an array of blobs
    if (Array.isArray(result)) {
        return result[0];
    }
    return result as Blob;
  } catch (e: any) {
     console.error("HEIC Conversion error:", e);
     throw new Error(e.message || "Failed to convert HEIC");
  }
};

/**
 * Rotates an image blob by 90 degrees clockwise
 */
export const rotateImage = async (imageUrl: string, angle: number = 90): Promise<{ url: string; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // For 90 or 270 degrees, flip dimensions
      if (angle % 180 !== 0) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Failed to get context'));
      
      // Move context to center
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      
      canvas.toBlob((blob) => {
        if (blob) {
           resolve({ url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height });
        } else {
           reject(new Error('Rotation failed'));
        }
      }, 'image/jpeg', 0.95);
    };
    img.src = imageUrl;
  });
};

/**
 * Creates a thumbnail blob from a source URL
 */
export const createThumbnail = async (url: string, maxWidth = 300): Promise<{ url: string; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = img.width * scale;
      const h = img.height * scale;
      
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Failed to get canvas context'));
      
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve({ url: URL.createObjectURL(blob), width: img.width, height: img.height });
        } else {
          reject(new Error('Thumbnail creation failed: Canvas toBlob returned null'));
        }
      }, 'image/jpeg', 0.8);
    };
    img.onerror = () => {
        reject(new Error('Failed to load image. The format might not be supported by this browser (e.g. HEIC/RAW).'));
    };
    img.src = url;
  });
};

/**
 * Converts internal adjustments to CSS filter string for thumbnails
 * This is an approximation for performance reasons
 */
export const getThumbnailStyles = (adj: Adjustments): React.CSSProperties => {
  const brightness = 1 + (adj.exposure / 100);
  const contrast = 1 + (adj.contrast / 100);
  const saturate = 1 + (adj.saturation / 100);
  const totalSat = saturate + (adj.vibrance / 200);
  const sepia = adj.temperature > 0 ? adj.temperature / 200 : 0;
  const hue = adj.tint * 0.2; 

  return {
    filter: `brightness(${brightness}) contrast(${contrast}) saturate(${totalSat}) sepia(${sepia}) hue-rotate(${hue}deg)`
  };
};

/**
 * Applies pixel-level manipulation to a canvas context
 */
export const applyImageFilters = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  adj: Adjustments
) => {
  if (width === 0 || height === 0) return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const len = data.length;

  // 1. Smart Exposure Calculation
  const exposureMultiplier = Math.pow(2, adj.exposure / 80);
  
  // Highlight Rolloff Constants
  const rollOffThreshold = 210;
  const maxVal = 255;
  const rollOffRange = maxVal - rollOffThreshold;

  // 2. Contrast Factor
  const contrastFactor = (259 * (adj.contrast + 255)) / (255 * (259 - adj.contrast));
  
  // 3. Temp/Tint
  const tempR = adj.temperature > 0 ? 1 + (adj.temperature / 100) * 0.4 : 1;
  const tempB = adj.temperature < 0 ? 1 + (Math.abs(adj.temperature) / 100) * 0.4 : 1;
  const tintG = adj.tint < 0 ? 1 + (Math.abs(adj.tint) / 100) * 0.4 : 1;
  const tintRB = adj.tint > 0 ? 1 + (adj.tint / 100) * 0.2 : 1;

  // 4. Saturation / Vibrance
  const sat = adj.saturation / 100;
  const vib = adj.vibrance / 100;

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // --- Exposure (Smart) ---
    r *= exposureMultiplier;
    g *= exposureMultiplier;
    b *= exposureMultiplier;

    // Apply Soft Knee Rolloff for highlights
    if (r > rollOffThreshold) {
        r = rollOffThreshold + rollOffRange * Math.tanh((r - rollOffThreshold) / rollOffRange);
    }
    if (g > rollOffThreshold) {
        g = rollOffThreshold + rollOffRange * Math.tanh((g - rollOffThreshold) / rollOffRange);
    }
    if (b > rollOffThreshold) {
        b = rollOffThreshold + rollOffRange * Math.tanh((b - rollOffThreshold) / rollOffRange);
    }

    // --- Contrast ---
    r = contrastFactor * (r - 128) + 128;
    g = contrastFactor * (g - 128) + 128;
    b = contrastFactor * (b - 128) + 128;

    // --- Temperature / Tint ---
    r *= tempR * tintRB;
    g *= tintG;
    b *= tempB * tintRB;

    // --- Saturation & Vibrance ---
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    
    // Saturation
    if (sat !== 0) {
      r = gray + (r - gray) * (1 + sat);
      g = gray + (g - gray) * (1 + sat);
      b = gray + (b - gray) * (1 + sat);
    }

    // Vibrance
    if (vib !== 0) {
      const max = Math.max(r, g, b);
      const avg = (r + g + b) / 3;
      const amt = ((Math.abs(max - avg) * 2) / 255) * vib * -1 + vib;
      
      r = r + (r - gray) * amt;
      g = g + (g - gray) * amt;
      b = b + (b - gray) * amt;
    }

    data[i] = clamp(r, 0, 255);
    data[i + 1] = clamp(g, 0, 255);
    data[i + 2] = clamp(b, 0, 255);
  }

  ctx.putImageData(imageData, 0, 0);
};

/**
 * Calculates a simple histogram stretch for "Auto" functionality
 */
export const calculateAutoAdjustments = (ctx: CanvasRenderingContext2D, width: number, height: number): Partial<Adjustments> => {
   // Sampling for performance
   const sampleSize = 100;
   const imageData = ctx.getImageData(0, 0, width, height);
   const data = imageData.data;
   let totalLum = 0;
   let minLum = 255;
   let maxLum = 0;

   for (let i = 0; i < data.length; i += 4 * 100) { // skip pixels
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      totalLum += lum;
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
   }
   
   const avgLum = totalLum / (data.length / (4 * 100));
   
   let newExposure = 0;
   let newContrast = 0;

   // Simple logic: if dark, boost exposure. if flat, boost contrast.
   if (avgLum < 100) newExposure = 20;
   if (avgLum > 180) newExposure = -20;
   
   const dynamicRange = maxLum - minLum;
   if (dynamicRange < 150) newContrast = 25;

   return {
     exposure: newExposure,
     contrast: newContrast,
     vibrance: 10, // Always looks a bit nice
   };
};

export const formatBytes = (bytes?: number, decimals = 1) => {
    if (!bytes) return '0 B';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const calculateReadableRatio = (w: number, h: number): string => {
  if (!w || !h) return '';
  
  const ratio = w / h;
  const tolerance = 0.05;

  // Dictionary of common aspect ratios
  const common = [
    { n: 1, d: 1, s: "1:1" },
    { n: 4, d: 3, s: "4:3" },
    { n: 3, d: 4, s: "3:4" },
    { n: 3, d: 2, s: "3:2" },
    { n: 2, d: 3, s: "2:3" },
    { n: 16, d: 9, s: "16:9" },
    { n: 9, d: 16, s: "9:16" },
    { n: 5, d: 4, s: "5:4" },
    { n: 4, d: 5, s: "4:5" },
    { n: 2, d: 1, s: "2:1" },
    { n: 1, d: 2, s: "1:2" },
    { n: 21, d: 9, s: "21:9" },
  ];

  for (const c of common) {
    if (Math.abs(ratio - c.n / c.d) < tolerance) {
      return c.s;
    }
  }

  // If not common, simplify fraction or use decimal
  // GCD based simplification
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const divisor = gcd(Math.round(w), Math.round(h));
  const sw = Math.round(w) / divisor;
  const sh = Math.round(h) / divisor;

  // If simplified integers are reasonably small (readable)
  if (sw <= 20 && sh <= 20) {
      return `${sw}:${sh}`;
  }
  
  // Fallback to decimal ratio for things like 1.91:1
  return ratio >= 1 ? `${ratio.toFixed(2)}:1` : `1:${(1/ratio).toFixed(2)}`;
};