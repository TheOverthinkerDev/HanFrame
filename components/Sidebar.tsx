import React, { useState } from 'react';
import { Adjustments, Photo, AspectRatio } from '../types';
import { Slider } from './Slider';
import { Wand2, RotateCcw, RotateCw, Crop, Layers, Scissors, Zap, ChevronDown, ChevronRight, Sun, Palette, Layout } from 'lucide-react';

interface SidebarProps {
  photo: Photo | null;
  adjustments: Adjustments;
  onChange: (key: keyof Adjustments, value: number) => void;
  onCommit: () => void; 
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onAuto: () => void;
  onReset: () => void;
  isCropMode: boolean;
  toggleCropMode: () => void;
  currentAspectRatio: AspectRatio;
  setAspectRatio: (ar: AspectRatio) => void;
  onBatchApply: () => void;
  onBatchCrop: () => void;
  onBatchAuto: () => void;
}

const SidebarSection: React.FC<{ 
    title: string; 
    icon: React.ReactNode; 
    children: React.ReactNode; 
    defaultOpen?: boolean;
    rightAction?: React.ReactNode;
}> = ({ title, icon, children, defaultOpen = false, rightAction }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border-b border-zinc-200 dark:border-zinc-800 transition-colors">
            <div 
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors select-none"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 transition-colors">{icon} {title}</span>
                </div>
                {rightAction && <div onClick={e => e.stopPropagation()}>{rightAction}</div>}
            </div>
            
            {isOpen && (
                <div className="p-4 bg-zinc-50/50 dark:bg-zinc-950/50 animate-in slide-in-from-top-2 fade-in duration-200">
                    {children}
                </div>
            )}
        </div>
    );
};

export const Sidebar: React.FC<SidebarProps> = ({ 
  photo, 
  adjustments, 
  onChange,
  onCommit,
  onRotateLeft,
  onRotateRight,
  onAuto, 
  onReset,
  isCropMode,
  toggleCropMode,
  currentAspectRatio,
  setAspectRatio,
  onBatchApply,
  onBatchCrop,
  onBatchAuto
}) => {
  if (!photo) {
    return (
      <div className="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 flex items-center justify-center text-zinc-500 transition-colors">
        <p>No photo selected</p>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col h-full overflow-hidden transition-colors duration-300">
      
      {/* Top Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-950 sticky top-0 z-10 shrink-0 transition-colors">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Editor</h2>
        <button 
            onClick={onAuto}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-full text-white transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide"
            title="Auto adjust current photo"
        >
            <Wand2 size={12} /> Auto
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* BATCH ACTIONS */}
        <SidebarSection title="Batch Actions" icon={<Layers size={14} />} defaultOpen={false}>
            <div className="grid grid-cols-1 gap-2">
                <button 
                    onClick={onBatchAuto}
                    className="w-full py-2 px-3 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-xs text-zinc-700 dark:text-zinc-300 flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-800 transition-colors"
                >
                    <Zap size={14} className="text-yellow-500" /> Auto Adjust All
                </button>
                
                <div className="flex gap-2">
                    <button 
                        onClick={onBatchApply}
                        className="flex-1 py-2 px-3 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-xs text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 transition-colors"
                        title="Copy current settings to all"
                    >
                        Sync Settings
                    </button>
                    <button 
                         onClick={onBatchCrop}
                         className="flex-1 py-2 px-3 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-xs text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 transition-colors flex items-center justify-center gap-1"
                         title="Apply selected aspect ratio to all"
                     >
                         <Scissors size={12} /> Crop All
                     </button>
                </div>
            </div>
        </SidebarSection>
        
        {/* CROP & ROTATE */}
        <SidebarSection title="Crop & Rotate" icon={<Layout size={14} />} defaultOpen={isCropMode}>
            <div className="space-y-4">
                <div className="flex gap-2">
                    <button 
                    onClick={toggleCropMode}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium border flex items-center justify-center gap-2 transition-all ${isCropMode ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                    >
                    <Crop size={14} /> {isCropMode ? 'Done' : 'Crop'}
                    </button>
                    <button 
                    onClick={onRotateLeft}
                    className="py-2 px-3 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    title="Rotate Left"
                    >
                    <RotateCcw size={16} />
                    </button>
                    <button 
                    onClick={onRotateRight}
                    className="py-2 px-3 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    title="Rotate Right"
                    >
                    <RotateCw size={16} />
                    </button>
                </div>
                
                {isCropMode && (
                    <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-1">
                    {['Free', '1:1', '16:9', '4:3', '3:2'].map((ratio) => (
                        <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio as AspectRatio)}
                        className={`text-xs py-1.5 rounded border transition-colors ${currentAspectRatio === ratio ? 'bg-zinc-800 border-zinc-600 text-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                        >
                        {ratio}
                        </button>
                    ))}
                    </div>
                )}
                {isCropMode && currentAspectRatio === 'Free' && (
                    <p className="text-[10px] text-zinc-500 italic text-center">Select a fixed ratio to enable batch crop.</p>
                )}
           </div>
        </SidebarSection>
        
        {/* LIGHT */}
        <SidebarSection 
            title="Light" 
            icon={<Sun size={14} />} 
            defaultOpen={true}
            rightAction={
                <button onClick={(e) => {
                    e.stopPropagation();
                    onChange('exposure', 0);
                    onChange('contrast', 0);
                    onCommit();
                  }} className="text-[10px] text-zinc-500 hover:text-zinc-800 dark:text-zinc-600 dark:hover:text-zinc-400 px-2 py-1 transition-colors">
                    Reset
                </button>
            }
        >
          <Slider 
            label="Exposure" 
            value={adjustments.exposure} 
            onChange={(v) => onChange('exposure', v)} 
            onAfterChange={onCommit}
            onReset={() => { onChange('exposure', 0); onCommit(); }}
          />
          <Slider 
            label="Contrast" 
            value={adjustments.contrast} 
            onChange={(v) => onChange('contrast', v)}
            onAfterChange={onCommit}
            onReset={() => { onChange('contrast', 0); onCommit(); }}
          />
        </SidebarSection>

        {/* COLOR */}
        <SidebarSection 
            title="Color" 
            icon={<Palette size={14} />} 
            defaultOpen={true}
            rightAction={
                <button onClick={(e) => {
                    e.stopPropagation();
                    onChange('temperature', 0);
                    onChange('tint', 0);
                    onChange('vibrance', 0);
                    onChange('saturation', 0);
                    onCommit();
                  }} className="text-[10px] text-zinc-500 hover:text-zinc-800 dark:text-zinc-600 dark:hover:text-zinc-400 px-2 py-1 transition-colors">
                    Reset
                </button>
            }
        >
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900/40 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/50 shadow-sm dark:shadow-none transition-colors">
               <Slider 
                label="Temp" 
                value={adjustments.temperature} 
                onChange={(v) => onChange('temperature', v)}
                onAfterChange={onCommit}
                onReset={() => { onChange('temperature', 0); onCommit(); }}
              />
              <div className="w-full h-1 mt-[-10px] rounded mb-4 bg-gradient-to-r from-blue-900 via-zinc-400 dark:via-zinc-700 to-yellow-900 opacity-50 pointer-events-none" />

              <Slider 
                label="Tint" 
                value={adjustments.tint} 
                onChange={(v) => onChange('tint', v)}
                onAfterChange={onCommit}
                onReset={() => { onChange('tint', 0); onCommit(); }}
              />
               <div className="w-full h-1 mt-[-10px] rounded bg-gradient-to-r from-green-900 via-zinc-400 dark:via-zinc-700 to-fuchsia-900 opacity-50 pointer-events-none" />
            </div>

            <Slider 
              label="Vibrance" 
              value={adjustments.vibrance} 
              onChange={(v) => onChange('vibrance', v)}
              onAfterChange={onCommit}
              onReset={() => { onChange('vibrance', 0); onCommit(); }}
            />
            <Slider 
              label="Saturation" 
              value={adjustments.saturation} 
              onChange={(v) => onChange('saturation', v)}
              onAfterChange={onCommit}
              onReset={() => { onChange('saturation', 0); onCommit(); }}
            />
          </div>
        </SidebarSection>

      </div>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shrink-0 transition-colors">
        <button onClick={onReset} className="w-full py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 text-xs hover:bg-zinc-100 dark:hover:text-white dark:hover:border-zinc-700 transition-colors">
          Reset All Settings
        </button>
      </div>
    </div>
  );
};