import React, { useState } from 'react';
import { Adjustments, Photo, AspectRatio, Asset } from '../types';
import { Slider } from './Slider';
import { formatBytes, calculateReadableRatio } from '../utils/processor';
import { 
    Wand2, RotateCcw, RotateCw, Crop, Layers, Scissors, Zap, 
    Sun, Palette, Layout, Sliders, Image as ImageIcon, Plus, 
    Trash2, Copy, X, Pencil, Frame, Stamp, Check, Cpu 
} from 'lucide-react';

// --- Types ---
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
  onStraightenChange: (val: number) => void;
  onStraightenCommit: () => void;
  
  // GPU
  useGPU: boolean;
  onToggleGPU: () => void;

  // Asset Props (Previously in LeftSidebar)
  uploadedFrames: Asset[];
  uploadedLogos: Asset[];
  onUploadFrame: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectFrame: (url: string | null) => void;
  onDeleteFrame: (id: string) => void;
  onRenameFrame: (id: string, newName: string) => void;
  onBatchFrame: () => void;
  onUploadLogo: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddLogoToPhoto: (url: string) => void;
  onDeleteLogoAsset: (id: string) => void;
  onRenameLogo: (id: string, newName: string) => void;
  onBatchLogo: () => void;
  onRenamePhoto: (id: string, newName: string) => void;
}

type Mode = 'tune' | 'crop' | 'layers';

// --- Shared Components ---

const EditableLabel: React.FC<{ 
    value: string; 
    onSave: (val: string) => void; 
    className?: string 
}> = ({ value, onSave, className }) => {
    const [isEditing, setIsEditing] = useState(false);
    
    const lastDotIndex = value.lastIndexOf('.');
    const hasExtension = lastDotIndex !== -1;
    const extension = hasExtension ? value.substring(lastDotIndex) : ''; 
    const currentBaseName = hasExtension ? value.substring(0, lastDotIndex) : value;

    const [tempName, setTempName] = useState(currentBaseName);

    React.useEffect(() => {
        if (!isEditing) {
            setTempName(currentBaseName);
        }
    }, [currentBaseName, isEditing]);

    const handleSave = () => {
        setIsEditing(false);
        const finalName = tempName.trim();
        if (finalName && finalName !== currentBaseName) {
            onSave(finalName + extension);
        } else {
            setTempName(currentBaseName);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setIsEditing(false);
            setTempName(currentBaseName);
        }
    };

    if (isEditing) {
        return (
            <div className={`flex items-center w-full ${className}`} onClick={(e) => e.stopPropagation()}>
                <input 
                    autoFocus
                    type="text" 
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className="min-w-0 flex-1 bg-white dark:bg-zinc-800 border border-blue-500 rounded px-1 py-0.5 text-xs focus:outline-none text-zinc-900 dark:text-zinc-100"
                />
                <span className="text-zinc-400 dark:text-zinc-500 text-[10px] ml-0.5 shrink-0 select-none">{extension}</span>
            </div>
        );
    }

    return (
        <div 
            className={`group/label flex items-center gap-1 cursor-text w-full overflow-hidden ${className}`}
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            title="Click to rename"
        >
            <span className="truncate">{value}</span>
            <Pencil size={10} className="opacity-0 group-hover/label:opacity-50 shrink-0 text-zinc-400" />
        </div>
    );
};

// --- Main Sidebar Component ---

export const Sidebar: React.FC<SidebarProps> = (props) => {
  const [activeTab, setActiveTab] = useState<Mode>('tune');

  // Helper to ensure Crop Mode is toggle correctly based on tab
  const handleTabChange = (tab: Mode) => {
      setActiveTab(tab);
      if (tab === 'crop' && !props.isCropMode) {
          props.toggleCropMode();
      } else if (tab !== 'crop' && props.isCropMode) {
          props.toggleCropMode();
      }
  };

  if (!props.photo) {
    return (
      <div className="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 flex items-center justify-center text-zinc-500">
        <div className="text-center">
            <Sliders size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm">Select a photo to edit</p>
        </div>
      </div>
    );
  }

  // Calculate effective dimensions based on rotation for display
  const rot = props.photo.rotation || 0;
  const isPortraitRot = rot % 180 !== 0;
  const effW = isPortraitRot ? props.photo.height : props.photo.width;
  const effH = isPortraitRot ? props.photo.width : props.photo.height;
  const ratioStr = calculateReadableRatio(effW, effH);

  return (
    <div className="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col h-full overflow-hidden">
      
      {/* Photo Info Header */}
      <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30">
        <div className="flex items-start justify-between gap-2">
           <div className="min-w-0 flex-1">
             <EditableLabel 
                value={props.photo.name} 
                onSave={(n) => props.onRenamePhoto(props.photo!.id, n)} 
                className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate"
             />
             <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-1 font-mono">
                <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400" title="Resolution & Aspect Ratio">
                    {effW} × {effH} • {ratioStr}
                </span>
                {props.photo.sizeInBytes && (
                    <span title="File Size">{formatBytes(props.photo.sizeInBytes)}</span>
                )}
             </div>
           </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex shrink-0 border-b border-zinc-200 dark:border-zinc-800">
          <button 
            onClick={() => handleTabChange('tune')}
            className={`flex-1 py-4 flex flex-col items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${activeTab === 'tune' ? 'text-blue-600 dark:text-blue-500' : 'text-zinc-400 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
          >
              <Sliders size={18} /> Tune
              {activeTab === 'tune' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-500" />}
          </button>
          <button 
            onClick={() => handleTabChange('crop')}
            className={`flex-1 py-4 flex flex-col items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${activeTab === 'crop' ? 'text-blue-600 dark:text-blue-500' : 'text-zinc-400 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
          >
              <Crop size={18} /> Crop
              {activeTab === 'crop' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-500" />}
          </button>
          <button 
            onClick={() => handleTabChange('layers')}
            className={`flex-1 py-4 flex flex-col items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${activeTab === 'layers' ? 'text-blue-600 dark:text-blue-500' : 'text-zinc-400 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
          >
              <Layers size={18} /> Layers
              {activeTab === 'layers' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-500" />}
          </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
        
        {/* === TUNE TAB === */}
        {activeTab === 'tune' && (
            <div className="space-y-8">
                {/* Auto & Batch */}
                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={props.onAuto}
                        className="py-2 px-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded border border-blue-100 dark:border-blue-900/50 flex items-center justify-center gap-2 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                        <Wand2 size={14} /> Auto Enhance
                    </button>
                    <button 
                        onClick={props.onBatchApply}
                        className="py-2 px-3 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 rounded border border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-2 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Copy these settings to all photos"
                    >
                        <Copy size={14} /> Sync All
                    </button>
                </div>

                {/* GPU Toggle */}
                 <div className="flex items-center justify-between py-2 px-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                         <div className={`p-1 rounded-full ${props.useGPU ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800'}`}>
                             <Cpu size={14} />
                         </div>
                         <div className="flex flex-col">
                             <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">GPU Acceleration</span>
                             <span className="text-[9px] text-zinc-400">{props.useGPU ? 'Enabled' : 'Disabled'}</span>
                         </div>
                    </div>
                    <button 
                        onClick={props.onToggleGPU}
                        className={`w-8 h-4 rounded-full p-0.5 transition-colors ${props.useGPU ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                    >
                        <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${props.useGPU ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                </div>

                {/* Light Section */}
                <div>
                    <h3 className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500 mb-4 flex items-center gap-2">
                        <Sun size={14} /> Light
                    </h3>
                    <Slider label="Exposure" value={props.adjustments.exposure} onChange={(v) => props.onChange('exposure', v)} onAfterChange={props.onCommit} onReset={() => { props.onChange('exposure', 0); props.onCommit(); }} />
                    <Slider label="Contrast" value={props.adjustments.contrast} onChange={(v) => props.onChange('contrast', v)} onAfterChange={props.onCommit} onReset={() => { props.onChange('contrast', 0); props.onCommit(); }} />
                </div>

                {/* Color Section */}
                <div>
                    <h3 className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500 mb-4 flex items-center gap-2">
                        <Palette size={14} /> Color
                    </h3>
                     <div className="bg-zinc-50/50 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/50 space-y-4 mb-4">
                        <Slider label="Temp" value={props.adjustments.temperature} onChange={(v) => props.onChange('temperature', v)} onAfterChange={props.onCommit} onReset={() => { props.onChange('temperature', 0); props.onCommit(); }} />
                        <div className="w-full h-1 mt-[-12px] rounded mb-1 bg-gradient-to-r from-blue-900 via-zinc-400 dark:via-zinc-700 to-yellow-900 opacity-40 pointer-events-none" />
                        
                        <Slider label="Tint" value={props.adjustments.tint} onChange={(v) => props.onChange('tint', v)} onAfterChange={props.onCommit} onReset={() => { props.onChange('tint', 0); props.onCommit(); }} />
                        <div className="w-full h-1 mt-[-12px] rounded bg-gradient-to-r from-green-900 via-zinc-400 dark:via-zinc-700 to-fuchsia-900 opacity-40 pointer-events-none" />
                    </div>

                    <Slider label="Vibrance" value={props.adjustments.vibrance} onChange={(v) => props.onChange('vibrance', v)} onAfterChange={props.onCommit} onReset={() => { props.onChange('vibrance', 0); props.onCommit(); }} />
                    <Slider label="Saturation" value={props.adjustments.saturation} onChange={(v) => props.onChange('saturation', v)} onAfterChange={props.onCommit} onReset={() => { props.onChange('saturation', 0); props.onCommit(); }} />
                </div>
                
                 <button onClick={props.onReset} className="w-full py-3 text-xs text-zinc-400 hover:text-red-500 transition-colors border-t border-zinc-100 dark:border-zinc-800/50 mt-4">
                    Reset All Adjustments
                </button>
            </div>
        )}

        {/* === CROP TAB === */}
        {activeTab === 'crop' && (
            <div className="space-y-6">
                
                {/* Done / Confirm Crop Button */}
                <button 
                    onClick={() => handleTabChange('tune')} // Switch back to Tune, effectively hiding crop mode
                    className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center justify-center gap-2 text-sm font-semibold transition-colors mb-2"
                >
                    <Check size={16} /> Apply / Done
                </button>

                {/* Rotation Controls */}
                <div className="bg-zinc-50 dark:bg-zinc-900 p-2 rounded-lg flex justify-between border border-zinc-200 dark:border-zinc-800">
                     <button onClick={props.onRotateLeft} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors text-zinc-600 dark:text-zinc-400" title="Rotate Left"><RotateCcw size={18} /></button>
                     <div className="w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />
                     <button onClick={props.onRotateRight} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors text-zinc-600 dark:text-zinc-400" title="Rotate Right"><RotateCw size={18} /></button>
                </div>

                {/* Straighten */}
                 <div>
                    <label className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500 mb-2 block">Straighten</label>
                    <Slider 
                        label=""
                        value={props.photo.straighten || 0}
                        min={-45}
                        max={45}
                        onChange={props.onStraightenChange}
                        onAfterChange={props.onStraightenCommit}
                        onReset={() => { props.onStraightenChange(0); props.onStraightenCommit(); }}
                    />
                 </div>

                {/* Aspect Ratios */}
                <div>
                     <label className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500 mb-3 block">Aspect Ratio</label>
                     <div className="grid grid-cols-3 gap-2">
                        {['Free', '1:1', '16:9', '4:3', '3:2'].map((ratio) => (
                            <button
                            key={ratio}
                            onClick={() => props.setAspectRatio(ratio as AspectRatio)}
                            className={`text-xs py-2 rounded-md border font-medium transition-all ${props.currentAspectRatio === ratio ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                            >
                            {ratio}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Batch Actions */}
                 <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <button 
                        onClick={props.onBatchCrop}
                        className="w-full py-2 px-3 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-xs text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Scissors size={14} /> Crop All Photos
                    </button>
                    {props.currentAspectRatio === 'Free' && <p className="text-[10px] text-zinc-400 mt-2 text-center">Batch crop will use the current photo's aspect ratio.</p>}
                 </div>
            </div>
        )}

        {/* === LAYERS TAB (Merged Assets) === */}
        {activeTab === 'layers' && (
             <div className="space-y-6">
                
                {/* --- FRAMES SUB-SECTION --- */}
                <div>
                    <h3 className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500 mb-3 flex items-center gap-2">
                        <Frame size={14} /> Frames
                    </h3>
                    
                    {/* Active Frame Info */}
                    {props.photo.frameOverlay ? (
                        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30 flex items-center justify-between">
                            <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Frame Applied</span>
                            <button 
                                onClick={() => props.onSelectFrame(null)}
                                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 rounded text-red-500 transition-colors"
                                title="Remove Frame"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ) : null}

                    {/* Upload */}
                    <label className="flex items-center justify-center w-full py-3 mb-3 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-blue-500 dark:hover:border-blue-500 transition-all text-xs text-zinc-500 gap-2">
                        <Plus size={14} /> Upload Frame
                        <input type="file" multiple className="hidden" accept="image/png,image/webp" onChange={props.onUploadFrame} />
                    </label>

                    {/* Grid */}
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                         {props.uploadedFrames.map((asset) => (
                             <div key={asset.id} className="group relative">
                                <div 
                                    className={`relative aspect-square rounded-md bg-zinc-100 dark:bg-zinc-900 border cursor-pointer overflow-hidden transition-all ${props.photo?.frameOverlay === asset.url ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'}`}
                                    onClick={() => props.onSelectFrame(asset.url)}
                                >
                                    <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); props.onDeleteFrame(asset.id); }}
                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                                <EditableLabel 
                                    value={asset.name} 
                                    onSave={(n) => props.onRenameFrame(asset.id, n)} 
                                    className="mt-1 text-[9px] text-zinc-500" 
                                />
                             </div>
                         ))}
                    </div>
                     {props.photo.frameOverlay && (
                         <button onClick={props.onBatchFrame} className="w-full mt-2 py-1.5 text-[10px] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800">
                            Apply to All Photos
                        </button>
                     )}
                </div>
                
                <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

                {/* --- LOGOS SUB-SECTION --- */}
                <div>
                     <h3 className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500 mb-3 flex items-center gap-2">
                        <Stamp size={14} /> Logos
                    </h3>

                    <label className="flex items-center justify-center w-full py-3 mb-3 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-blue-500 dark:hover:border-blue-500 transition-all text-xs text-zinc-500 gap-2">
                        <Plus size={14} /> Upload Logo
                        <input type="file" multiple className="hidden" accept="image/png,image/webp,image/jpeg" onChange={props.onUploadLogo} />
                    </label>

                     <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                         {props.uploadedLogos.map((asset) => (
                             <div key={asset.id} className="group relative">
                                <div 
                                    className="relative aspect-square rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 cursor-pointer overflow-hidden hover:border-blue-500 hover:shadow-md transition-all flex items-center justify-center p-2"
                                    onClick={() => props.onAddLogoToPhoto(asset.url)}
                                    title="Click to add to photo"
                                >
                                    <img src={asset.url} alt={asset.name} className="max-w-full max-h-full object-contain" />
                                    
                                    {/* Overlay on hover to indicate action */}
                                    <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />

                                    <button 
                                        onClick={(e) => { e.stopPropagation(); props.onDeleteLogoAsset(asset.id); }}
                                        className="absolute top-1 right-1 z-20 p-1 bg-red-500/90 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all shadow-md transform scale-90 hover:scale-100"
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                </div>
                                
                                {/* Editable Name */}
                                <EditableLabel 
                                    value={asset.name} 
                                    onSave={(newName) => props.onRenameLogo(asset.id, newName)}
                                    className="text-[10px] text-zinc-500 dark:text-zinc-400 justify-center"
                                />
                        </div>
                    ))}
                </div>
                    {props.photo.logos.length > 0 && (
                        <button onClick={props.onBatchLogo} className="w-full mt-2 py-1.5 text-[10px] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800">
                            Sync Logos to All
                        </button>
                    )}
                </div>

             </div>
        )}

      </div>
    </div>
  );
};