import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A small toggle, built on a native button so it needs no extra dependency:
 * `role="switch"` + `aria-checked` give screen readers the same semantics as
 * the Radix primitive, and the button handles keyboard activation.
 */
function Switch({ className, checked = false, onCheckedChange, disabled, ...props }: React.ComponentProps<'button'> & Record<string, any>) {
  return (
    <button
      type="button"
      role="switch"
      data-slot="switch"
      aria-checked={checked}
      data-state={checked ? 'checked' : 'unchecked'}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-xs transition-all outline-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        checked ? 'bg-primary' : 'bg-input dark:bg-input/80',
        className
      )}
      {...props}
    >
      <span
        data-slot="switch-thumb"
        className={cn(
          'bg-background pointer-events-none block size-4 rounded-full ring-0 shadow-sm transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

export { Switch };
