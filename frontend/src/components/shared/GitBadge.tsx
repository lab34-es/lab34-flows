import React from 'react';

import { decorationFor } from '@/lib/git';
import { cn } from '@/lib/utils';

/**
 * The single letter an editor puts at the end of a changed row -- M, A, D, U,
 * R -- in the colour of its status. Renders nothing when the file is clean,
 * so it can be dropped into any row unconditionally.
 */
export function GitBadge({ status, className }: { status?: string | null, className?: string }) {
  const decoration = decorationFor(status);
  if (!decoration) { return null; }

  return (
    <span
      title={`${decoration.label} (git)`}
      aria-label={`Git status: ${decoration.label}`}
      className={cn('font-mono text-[11px] leading-none font-semibold', decoration.className, className)}
    >
      {decoration.letter}
    </span>
  );
}

export default GitBadge;
