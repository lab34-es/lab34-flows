import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

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
import { flowsApi } from '@/services/api';
import { newFlowTemplate } from '@/lib/templates';
import { useAppState } from '@/context/AppStateContext';

const joinPath = (parent, name) => (parent ? `${parent}/${name}` : name);

/**
 * Dialogs for the sidebar file actions: new flow, new folder and delete.
 * `action` is { type: 'new-flow' | 'new-folder' | 'delete', parentPath?, targetPath?, isFolder? }.
 */
export function FlowDialogs({ action, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshTree } = useAppState();
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName('');
    setError(null);
    setBusy(false);
  }, [action]);

  if (!action) { return null; }

  const close = () => {
    if (!busy) { onClose(); }
  };

  const handleCreateFlow = async () => {
    const trimmed = name.trim();
    if (!trimmed) { return; }

    const hasExtension = /\.(md|markdown|yaml|yml)$/i.test(trimmed);
    const fileName = hasExtension ? trimmed : `${trimmed}.md`;
    const title = fileName.replace(/\.(md|markdown|yaml|yml)$/i, '');
    const relativePath = joinPath(action.parentPath, fileName);

    setBusy(true);
    setError(null);
    try {
      const response = await flowsApi.saveFile(relativePath, newFlowTemplate(title));
      await refreshTree();
      onClose();
      navigate(`/flows/view?path=${encodeURIComponent(response.data.path)}`);
    } catch (ex) {
      setError(ex.response?.data?.error || ex.message);
      setBusy(false);
    }
  };

  const handleCreateFolder = async () => {
    const trimmed = name.trim();
    if (!trimmed) { return; }

    setBusy(true);
    setError(null);
    try {
      await flowsApi.createFolder(joinPath(action.parentPath, trimmed));
      await refreshTree();
      onClose();
    } catch (ex) {
      setError(ex.response?.data?.error || ex.message);
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await flowsApi.remove(action.targetPath);
      await refreshTree();
      onClose();

      // If the deleted flow (or an ancestor folder) is currently open,
      // leave the dead page
      if (location.pathname === '/flows/view') {
        const openPath = new URLSearchParams(location.search).get('path') || '';
        const suffix = `/${action.targetPath}`;
        if (openPath.endsWith(suffix) || openPath.includes(`${suffix}/`)) {
          navigate('/');
        }
      }
    } catch (ex) {
      setError(ex.response?.data?.error || ex.message);
      setBusy(false);
    }
  };

  const inFolder = action.parentPath ? ` in “${action.parentPath}”` : '';

  return (
    <>
      {/* New flow */}
      <Dialog open={action.type === 'new-flow'} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New flow</DialogTitle>
            <DialogDescription>
              Create a new Markdown flow{inFolder}. Steps are ```step code blocks.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="flow-name">File name</Label>
            <Input
              id="flow-name"
              placeholder="my-flow.md"
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleCreateFlow()}
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
            <Button onClick={handleCreateFlow} disabled={busy || !name.trim()}>Create flow</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New folder */}
      <Dialog open={action.type === 'new-folder'} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>Create a folder{inFolder} to organize your flows.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="folder-name">Folder name</Label>
            <Input
              id="folder-name"
              placeholder="my-team"
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleCreateFolder()}
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
            <Button onClick={handleCreateFolder} disabled={busy || !name.trim()}>Create folder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={action.type === 'delete'} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {action.isFolder ? 'folder' : 'flow'}</DialogTitle>
            <DialogDescription>
              “{action.targetPath}” will be permanently deleted
              {action.isFolder ? ', including everything inside it' : ''}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default FlowDialogs;
