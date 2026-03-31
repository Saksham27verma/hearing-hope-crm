'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg border border-zinc-100 bg-zinc-50/50 px-3 py-2 text-sm text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-150',
        'placeholder:text-zinc-400',
        'focus-visible:border-teal-200 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/25',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
