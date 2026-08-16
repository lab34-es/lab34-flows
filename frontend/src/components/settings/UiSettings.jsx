import React from 'react';
import { Check, Monitor, Moon, Palette, Sun } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';

const OPTIONS = [
  {
    id: 'light',
    label: 'Light',
    icon: Sun,
    description: 'Always the light palette.',
  },
  {
    id: 'dark',
    label: 'Dark',
    icon: Moon,
    description: 'Always the dark palette.',
  },
  {
    id: 'system',
    label: 'Auto',
    icon: Monitor,
    description: 'Follows your operating system, live.',
  },
];

/**
 * A miniature of the app — sidebar, header and a couple of content rows — in
 * fixed colours, so each choice looks like what it does whatever the current
 * theme is. "Auto" shows both halves.
 */
function Preview({ variant }) {
  const half = (side) => {
    const dark = side === 'dark';
    return (
      <div className={cn('flex h-full w-full', dark ? 'bg-zinc-900' : 'bg-zinc-50')}>
        <div className={cn('h-full w-1/3 border-r', dark ? 'border-zinc-700 bg-zinc-800' : 'border-zinc-200 bg-white')}>
          <div className="space-y-1 p-1.5">
            <div className={cn('h-1.5 w-4/5 rounded-full', dark ? 'bg-zinc-600' : 'bg-zinc-300')} />
            <div className={cn('h-1.5 w-3/5 rounded-full', dark ? 'bg-zinc-700' : 'bg-zinc-200')} />
            <div className={cn('h-1.5 w-2/3 rounded-full', dark ? 'bg-zinc-700' : 'bg-zinc-200')} />
          </div>
        </div>
        <div className="flex-1 space-y-1 p-1.5">
          <div className={cn('h-2 w-1/2 rounded-full', dark ? 'bg-zinc-500' : 'bg-zinc-400')} />
          <div className={cn('h-1.5 w-full rounded-full', dark ? 'bg-zinc-700' : 'bg-zinc-200')} />
          <div className={cn('h-1.5 w-4/5 rounded-full', dark ? 'bg-zinc-700' : 'bg-zinc-200')} />
        </div>
      </div>
    );
  };

  if (variant === 'system') {
    return (
      <div className="flex h-20 w-full overflow-hidden rounded-md border">
        <div className="w-1/2 overflow-hidden">
          <div className="h-full w-[200%]">{half('light')}</div>
        </div>
        <div className="w-1/2 overflow-hidden">
          <div className="ml-[-100%] h-full w-[200%]">{half('dark')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-20 w-full overflow-hidden rounded-md border">{half(variant)}</div>
  );
}

/**
 * Look and feel of the web UI. The choice is stored in this browser only
 * (localStorage), not in the context folder: it is per person, per machine.
 */
export function UiSettings() {
  const { mode, setMode, theme, systemTheme } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Palette className="size-5" /> UI
        </h1>
        <p className="text-muted-foreground text-sm">
          How the web UI looks. Saved in this browser, so it never travels with your flows.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Pick a palette, or let the app follow your system. Editors and code blocks follow
            the same choice.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div
            role="radiogroup"
            aria-label="Theme"
            className="grid gap-3 sm:grid-cols-3"
          >
            {OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = mode === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setMode(option.id)}
                  className={cn(
                    'focus-visible:ring-ring/50 group flex flex-col gap-2 rounded-lg border p-2 text-left transition focus-visible:ring-[3px] focus-visible:outline-none',
                    selected ? 'border-primary ring-primary/30 ring-2' : 'hover:border-primary/40'
                  )}
                >
                  <Preview variant={option.id} />
                  <div className="flex items-center gap-2 px-1 pb-1">
                    <Icon className="text-muted-foreground size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{option.label}</div>
                      <div className="text-muted-foreground text-xs">{option.description}</div>
                    </div>
                    {selected && <Check className="text-primary size-4 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-muted-foreground text-xs">
            {mode === 'system'
              ? `Your system is currently in ${systemTheme} mode.`
              : `Showing the ${theme} palette.`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default UiSettings;
