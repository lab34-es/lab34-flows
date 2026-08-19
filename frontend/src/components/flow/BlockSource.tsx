import React, { useLayoutEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

/**
 * The source of the one block the caret is in.
 *
 * A plain textarea that grows with its content, so the document does not jump
 * when a paragraph turns from rendered Markdown into the Markdown itself.
 * Every rule about what the keys do lives in BlockEditor — this only draws
 * the text and reports what happened.
 */
export function BlockSource({
  value,
  onChange,
  onKeyDown,
  onBlur,
  onClick,
  initialCaret,
  placeholder,
  className,
  textareaRef,
}: {
  value: string;
  onChange: (value: string, caret: number) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  onClick?: (event: React.MouseEvent<HTMLTextAreaElement>) => void;
  initialCaret?: number;
  placeholder?: string;
  className?: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const caretApplied = useRef(false);

  // Grow to fit: the textarea must never scroll on its own, the document does
  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [value, textareaRef]);

  // The caret lands where the click (or the key that moved into this block)
  // asked for, once, when the block starts being edited
  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element || caretApplied.current) return;
    caretApplied.current = true;

    const caret = Math.max(0, Math.min(initialCaret ?? value.length, value.length));
    element.focus({ preventScroll: true });
    element.setSelectionRange(caret, caret);
  }, [initialCaret, value, textareaRef]);

  return (
    <textarea
      ref={textareaRef}
      className={cn('flow-block-source', className)}
      value={value}
      placeholder={placeholder}
      rows={1}
      spellCheck={false}
      onChange={(event) => onChange(event.target.value, event.target.selectionStart)}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      onClick={onClick}
    />
  );
}

export default BlockSource;
