import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { applicationsApi } from '@/services/api';
import { useAppState } from '@/context/AppStateContext';

/**
 * Dialogs for the application actions of the sidebar.
 * `action` is { type: 'rename-application', slug }.
 *
 * Renaming an application renames its folder: steps refer to applications by
 * that name, so the dialog says as much before going ahead.
 */
export function ApplicationDialogs({ action, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshApplications } = useAppState();

  const [name, setName] = useState('');
  const [error, setError] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(action?.slug || '');
    setError(null);
    setBusy(false);
  }, [action]);

  if (!action) { return null; }

  const close = () => {
    if (!busy) { onClose(); }
  };

  const handleRename = async () => {
    const trimmed = name.trim();
    if (!trimmed) { return; }

    if (trimmed === action.slug) {
      onClose();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await applicationsApi.rename(action.slug, trimmed);
      await refreshApplications();
      onClose();

      if (location.pathname === `/applications/${action.slug}`) {
        navigate(`/applications/${encodeURIComponent(response.data.slug)}`);
      }
    } catch (ex) {
      setError(ex.response?.data?.error || ex.message);
      setBusy(false);
    }
  };

  return (
    <Dialog open={action.type === 'rename-application'} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename application</DialogTitle>
          <DialogDescription>
            “{action.slug}” will be renamed, folder included. Steps point at
            applications by name, so update the flows using it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="application-name">New name</Label>
          <Input
            id="application-name"
            value={name}
            autoFocus
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleRename()}
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
          <Button onClick={handleRename} disabled={busy || !name.trim()}>
            {busy && <Loader2 className="animate-spin" />}
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ApplicationDialogs;
