import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * What a step is asking the person running the flow for.
 *
 * A method that needs a human value (`inputs.text` on the server) stops the
 * run until it gets one. On the CLI that question is printed on the terminal;
 * here it is this field, rendered under the step that asked, so a flow with a
 * manual step is runnable from the UI at all.
 *
 * Cancelling is not a nicety: the run holds the "one flow at a time" lock
 * while it waits, so there has to be a way out of a question nobody can
 * answer.
 */
export function StepInput({ request, onAnswer }) {
  const [value, setValue] = useState(request?.defaultValue || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  // A new question starts from a clean field, focused: the person is waiting
  useEffect(() => {
    setValue(request?.defaultValue || '');
    setError(null);
    field.current?.focus();
  }, [request?.id, request?.defaultValue]);

  if (!request) { return null; }

  const settle = async (cancel) => {
    setBusy(true);
    setError(null);
    try {
      await onAnswer(request.id, value, cancel);
    } catch (ex) {
      setError(ex.response?.data?.error || ex.message || 'Could not send the answer');
      setBusy(false);
    }
  };

  return (
    <form
      data-role="step-input"
      className="border-info/40 bg-info/5 mb-2 rounded-md border px-3 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) { settle(false); }
      }}
    >
      <p className="text-info mb-2 flex items-center gap-1.5 text-xs font-semibold">
        <Keyboard className="size-3.5" /> {request.label}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          ref={field}
          autoFocus
          disabled={busy}
          type={request.secret ? 'password' : 'text'}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-8 max-w-xs font-mono text-xs"
          placeholder="Type a value and press enter"
        />
        <Button type="submit" size="sm" disabled={busy}>
          {busy && <Loader2 className="size-3.5 animate-spin" />} Send
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => settle(true)}
        >
          Cancel
        </Button>
      </div>
      {error && <p className="text-destructive mt-2 text-xs">{error}</p>}
    </form>
  );
}

export default StepInput;
