import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const joinPath = (parent, name) => (parent ? `${parent}/${name}` : name);

/**
 * Dialogs behind the explorer actions of the Source view: new file, rename
 * and delete. `action` is
 * { type: 'new-file' | 'rename' | 'delete', parentPath?, targetPath?, isFolder? }.
 *
 * `onSubmit(action, value)` does the work and is expected to reject with an
 * error to show; the dialog closes itself once it resolves.
 */
export function SourceFileDialogs({ action, onSubmit, onClose }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Renaming starts from the current path, so a file can also be moved by
    // typing a folder in front of it
    setValue(action?.type === 'rename' ? action.targetPath : '');
    setError(null);
    setBusy(false);
  }, [action]);

  if (!action) { return null; }

  const close = () => {
    if (!busy) { onClose(); }
  };

  const submit = async (payload) => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(action, payload);
      onClose();
    } catch (ex) {
      setError(ex.response?.data?.error || ex.message);
      setBusy(false);
    }
  };

  const trimmed = value.trim();
  const newFilePath = joinPath(action.parentPath, trimmed);
  const inFolder = action.parentPath ? ` in “${action.parentPath}”` : '';

  return (
    <>
      {/* New file */}
      <Dialog open={action.type === 'new-file'} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New file</DialogTitle>
            <DialogDescription>
              Create a file{inFolder}. Use a path to put it in a folder — any
              missing folder is created.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="source-new-file">File name</Label>
            <Input
              id="source-new-file"
              placeholder="helpers/http.js"
              value={value}
              autoFocus
              disabled={busy}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && trimmed && submit(newFilePath)}
            />
            {trimmed && action.parentPath && (
              <p className="text-muted-foreground font-mono text-xs">{newFilePath}</p>
            )}
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
            <Button onClick={() => submit(newFilePath)} disabled={busy || !trimmed}>
              {busy && <Loader2 className="animate-spin" />}
              Create file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={action.type === 'rename'} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {action.isFolder ? 'folder' : 'file'}</DialogTitle>
            <DialogDescription>
              “{action.targetPath}” will be renamed
              {action.isFolder ? ', together with everything inside it' : ''}.
              Typing a path moves it to another folder.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="source-rename">New path</Label>
            <Input
              id="source-rename"
              value={value}
              autoFocus
              disabled={busy}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && trimmed && submit(trimmed)}
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
            <Button onClick={() => submit(trimmed)} disabled={busy || !trimmed}>
              {busy && <Loader2 className="animate-spin" />}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={action.type === 'delete'} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {action.isFolder ? 'folder' : 'file'}</DialogTitle>
            <DialogDescription>
              “{action.targetPath}” will be permanently deleted
              {action.isFolder ? ', including everything inside it' : ''}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={() => submit(action.targetPath)} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SourceFileDialogs;
