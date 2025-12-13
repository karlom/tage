import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onChange, id, ...props }, ref) => {
    return (
      <label
        htmlFor={id}
        className="inline-flex items-center cursor-pointer"
      >
        <input
          type="checkbox"
          id={id}
          className="sr-only peer"
          checked={checked}
          onChange={onChange}
          ref={ref}
          {...props}
        />
        <div
          className={cn(
            "relative w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full transition-colors peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 peer-focus:ring-offset-2",
            "after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white",
            className
          )}
        />
      </label>
    );
  }
);
Switch.displayName = 'Switch';

export { Switch };
