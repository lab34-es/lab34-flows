import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Info,
  Lightbulb,
  Link2,
  List,
  ListOrdered,
  MessageSquareWarning,
  Minus,
  OctagonAlert,
  Play,
  Quote,
  SquareCheck,
  Table,
  TriangleAlert,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { SlashCommand } from '@/lib/slash-commands';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  play: Play,
  check: Check,
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  list: List,
  'list-ordered': ListOrdered,
  'check-square': SquareCheck,
  quote: Quote,
  code: Code,
  table: Table,
  minus: Minus,
  link: Link2,
  image: Image,
  info: Info,
  lightbulb: Lightbulb,
  'message-warning': MessageSquareWarning,
  'triangle-alert': TriangleAlert,
  'octagon-alert': OctagonAlert,
};

/**
 * The list that drops out of a "/" while writing a flow.
 *
 * It is drawn in a portal at fixed coordinates: the document scrolls under
 * it, and no ancestor with `overflow: auto` can clip it. The caret stays in
 * the block being edited the whole time — the menu never takes focus, it only
 * reads the keys the editor forwards to it.
 */
export function SlashMenu({
  commands,
  activeIndex,
  position,
  onSelect,
  onHover,
}: {
  commands: SlashCommand[];
  activeIndex: number;
  position: { top: number; left: number };
  onSelect: (command: SlashCommand) => void;
  onHover: (index: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the highlighted entry in view when it is picked with the keyboard
  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!commands.length) return null;

  // Flip the menu above the caret when it would not fit below
  const height = Math.min(320, commands.length * 44 + 16);
  const top = position.top + height > window.innerHeight - 12
    ? Math.max(12, position.top - height - 24)
    : position.top;

  return createPortal(
    <div
      ref={listRef}
      className="bg-popover text-popover-foreground fixed z-50 max-h-80 w-72 overflow-y-auto rounded-lg border p-1 shadow-lg"
      style={{ top, left: Math.min(position.left, window.innerWidth - 300) }}
      // The caret must stay where it is: taking focus would close the editor
      onMouseDown={(event) => event.preventDefault()}
      role="listbox"
      aria-label="Insert block"
    >
      {commands.map((command, index) => {
        const Icon = ICONS[command.icon] || Code;
        // The group name is written once, above the first entry that carries it
        const header = commands[index - 1]?.group === command.group ? null : command.group;

        return (
          <React.Fragment key={command.id}>
            {header && (
              <p className="text-muted-foreground px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wide uppercase">
                {header}
              </p>
            )}
            <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              data-active={index === activeIndex}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                index === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
              )}
              onMouseEnter={() => onHover(index)}
              onClick={() => onSelect(command)}
            >
              <Icon className="text-muted-foreground size-4 shrink-0" />
              <span className="flex-1 truncate">{command.label}</span>
              <span className="text-muted-foreground truncate font-mono text-[10px]">{command.hint}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>,
    document.body
  );
}

export default SlashMenu;
