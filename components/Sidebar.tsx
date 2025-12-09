import React from 'react';
import { Adjustments, Photo, AspectRatio } from '../types';
import { Slider } from './Slider';
import { Wand2, RotateCcw, Crop, Layers, Scissors, Zap } from 'lucide-react';

interface SidebarProps {
  photo: Photo | null;
  adjustments: Adjustments;
  onChange: (key: keyof Adjustments, value: number) => void;
  onCommit: () => void; // Trigger history save
  onRotate: () => void;
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

export const Sidebar: React.FC<SidebarProps> = ({ 
  photo, 
  adjustments, 
  onChange,
  onCommit,
  onRotate,
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
      <div className="w-80 border-l border-zinc-800 bg-zinc-950 p-6 flex items-center justify-center text-zinc-500">
        <p>No photo selected</p>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-950 flex flex-col h-full overflow-hidden">
      
      {/* Top Header */}
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950 sticky top-0 z-10">
        <h2 className="font-semibold text-zinc-100">Adjustments</h2>
        <div className="flex space-x-2">
          <button 
            onClick={onAuto}
            className="p-2 bg-blue-600 hover:bg-blue-500 rounded-md text-white transition-colors flex items-center gap-1 text-xs font-medium"
            title="Auto adjust current photo"
          >
            <Wand2 size={14} /> AUTO
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8">

        {/* BATCH ACTIONS ZONE */}
        <section className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-3">
            <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1">
                <Layers size={12} /> Batch Actions (All Photos)
            </h3>
            <div className="grid grid-cols-1 gap-2">
                <button 
                    onClick={onBatchAuto}
                    className="w-full py-2 px-3 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-200 flex items-center justify-center gap-2 border border-zinc-700/50 transition-colors"
                >
                    <Zap size={14} className="text-yellow-500" /> Auto Adjust All
                </button>
                
                <div className="flex gap-2">
                    <button 
                        onClick={onBatchApply}
                        className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 border border-zinc-700/50 transition-colors"
                        title="Copy current settings to all"
                    >
                        Sync Settings
                    </button>
                    <button 
                         onClick={onBatchCrop}
                         className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 border border-zinc-700/50 transition-colors flex items-center justify-center gap-1"
                         title="Apply selected aspect ratio to all"
                     >
                         <Scissors size={12} /> Crop All
                     </button>
                </div>
            </div>
        </section>
        
        {/* Light Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Light</h3>
             <button onClick={() => {
               onChange('exposure', 0);
               onChange('contrast', 0);
               onCommit(); // Commit immediately on button reset
             }} className="text-xs text-zinc-600 hover:text-zinc-400">Reset</button>
          </div>
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
        </section>

        {/* Color Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Color</h3>
             <button onClick={() => {
               onChange('temperature', 0);
               onChange('tint', 0);
               onChange('vibrance', 0);
               onChange('saturation', 0);
               onCommit();
             }} className="text-xs text-zinc-600 hover:text-zinc-400">Reset</button>
          </div>
          
          <div className="space-y-6">
            <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50">
               <Slider 
                label="Temp" 
                value={adjustments.temperature} 
                onChange={(v) => onChange('temperature', v)}
                onAfterChange={onCommit}
                onReset={() => { onChange('temperature', 0); onCommit(); }}
              />
              <div className="w-full h-1 mt-[-10px] rounded mb-4 bg-gradient-to-r from-blue-900 via-zinc-700 to-yellow-900 opacity-30 pointer-events-none" />

              <Slider 
                label="Tint" 
                value={adjustments.tint} 
                onChange={(v) => onChange('tint', v)}
                onAfterChange={onCommit}
                onReset={() => { onChange('tint', 0); onCommit(); }}
              />
               <div className="w-full h-1 mt-[-10px] rounded bg-gradient-to-r from-green-900 via-zinc-700 to-fuchsia-900 opacity-30 pointer-events-none" />
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
        </section>

        {/* Crop Section */}
        <section>
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Crop & Rotate</h3>
           </div>
           
           <div className="flex gap-2">
             <button 
               onClick={toggleCropMode}
               className={`flex-1 py-2 px-3 rounded text-sm font-medium border flex items-center justify-center gap-2 transition-all ${isCropMode ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'}`}
             >
               <Crop size={14} /> {isCropMode ? 'Done' : 'Crop'}
             </button>
             <button 
               onClick={onRotate}
               className="py-2 px-3 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700"
               title="Rotate 90deg Clockwise"
             >
               <RotateCcw size={16} />
             </button>
           </div>
           
           {isCropMode && (
             <div className="mt-4 grid grid-cols-3 gap-2">
               {['Free', '1:1', '16:9', '4:3', '3:2'].map((ratio) => (
                 <button
                   key={ratio}
                   onClick={() => setAspectRatio(ratio as AspectRatio)}
                   className={`text-xs py-1.5 rounded border ${currentAspectRatio === ratio ? 'bg-zinc-700 border-zinc-500 text-white' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                 >
                   {ratio}
                 </button>
               ))}
             </div>
           )}
           {isCropMode && currentAspectRatio === 'Free' && (
               <p className="text-[10px] text-zinc-500 mt-2 italic">Select a ratio to enable batch crop.</p>
           )}
        </section>

      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-950">
        <button onClick={onReset} className="w-full py-2 rounded border border-zinc-700 text-zinc-400 text-sm hover:text-white hover:border-zinc-500 transition-colors">
          Reset All Settings
        </button>
      </div>
    </div>
  );
};