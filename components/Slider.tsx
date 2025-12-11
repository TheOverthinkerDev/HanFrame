import React from 'react';

interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  onAfterChange?: () => void; // Called on mouse up / key up
  onReset: () => void;
}

export const Slider: React.FC<SliderProps> = ({ label, value, min = -100, max = 100, onChange, onAfterChange, onReset }) => {
  return (
    <div className="mb-4 group">
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors select-none">
          {label}
        </label>
        <button 
          onClick={onReset}
          className={`text-xs ${value !== 0 ? 'text-blue-500 dark:text-blue-400 opacity-100' : 'text-zinc-400 dark:text-zinc-600 opacity-0'} transition-all cursor-pointer hover:text-blue-600 dark:hover:text-blue-300`}
        >
          {value}
        </button>
      </div>
      <div className="relative h-6 flex items-center">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerUp={onAfterChange}
          onKeyUp={onAfterChange}
          className="w-full h-1 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer focus:outline-none focus:bg-zinc-300 dark:focus:bg-zinc-600 accent-blue-600 dark:accent-blue-500 transition-colors"
        />
        {/* Center notch */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-2 bg-zinc-400 dark:bg-zinc-500 pointer-events-none" />
      </div>
    </div>
  );
};