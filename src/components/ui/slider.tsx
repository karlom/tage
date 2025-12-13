import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value?: number;
  onValueChange?: (value: number) => void;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value);
      onValueChange?.(newValue);
    };

    return (
      <div className="relative flex items-center w-full">
        <input
          type="range"
          className={cn(
            'w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700',
            className
          )}
          ref={ref}
          value={value}
          onChange={handleChange}
          min={min}
          max={max}
          step={step}
          {...props}
        />
        {value !== undefined && (
          <div className="absolute text-xs text-gray-500 dark:text-gray-400 mt-1">
            {value}
          </div>
        )}
      </div>
    );
  }
);
Slider.displayName = 'Slider';

export { Slider };
