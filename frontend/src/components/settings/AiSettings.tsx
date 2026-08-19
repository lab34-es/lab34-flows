import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Loader2, RefreshCw, Save, Sparkles } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { settingsApi } from '@/services/api';

const HINTS = {
  ollama: 'Runs on your machine: nothing is sent anywhere. Pull a model with “ollama pull <model>” first.',
  gemini: 'Create an API key at aistudio.google.com/app/apikey.',
  anthropic: 'Create an API key at console.anthropic.com. Claude Opus 5 is the default model.',
};

/**
 * Which model writes your flows, and the credentials to reach it. Keys are
 * write-only: the API only tells us whether one is stored.
 */
export function AiSettings() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<any>(null);

  // Drafts, so nothing is written until Save is pressed
  const [provider, setProvider] = useState('');
  const [models, setModels] = useState<any>({});
  const [hosts, setHosts] = useState<any>({});
  const [keys, setKeys] = useState<any>({});

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<any>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const [ollamaModels, setOllamaModels] = useState<any>(null);
  const [loadingModels, setLoadingModels] = useState(false);

  const apply = useCallback((data) => {
    setSettings(data);
    setProvider(data.provider);
    setModels(Object.fromEntries(
      Object.entries<any>(data.providers).map(([id, config]) => [id, config.model || ''])
    ));
    setHosts(Object.fromEntries(
      Object.entries<any>(data.providers).map(([id, config]) => [id, config.host || ''])
    ));
    setKeys({});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await settingsApi.getAI();
      apply(response.data);
    } catch (ex) {
      setLoadError(ex.response?.data?.error || ex.message);
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    setTestResult(null);
    try {
      const providers = {};
      Object.keys(settings.providers).forEach((id) => {
        providers[id] = { model: models[id] };
        if (id === 'ollama') { providers[id].host = hosts[id]; }
        if (keys[id]) { providers[id].apiKey = keys[id]; }
      });

      const response = await settingsApi.saveAI({ provider, providers });
      apply(response.data);
      setSaved(true);
    } catch (ex) {
      setError(ex.response?.data?.error || ex.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await settingsApi.testAI(provider);
      setTestResult({ ok: true, message: `${response.data.model} answered: “${response.data.reply}”` });
    } catch (ex) {
      setTestResult({ ok: false, message: ex.response?.data?.error || ex.message });
    } finally {
      setTesting(false);
    }
  };

  const handleLoadOllamaModels = async () => {
    setLoadingModels(true);
    setOllamaModels(null);
    try {
      const response = await settingsApi.listAIModels('ollama');
      setOllamaModels(response.data.models);
    } catch (ex) {
      setError(ex.response?.data?.error || ex.message);
    } finally {
      setLoadingModels(false);
    }
  };

  const header = (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Sparkles className="size-5" /> AI
      </h1>
      <p className="text-muted-foreground text-sm">
        Used when generating a flow from a prompt, and when editing one with the
        magic wand. Keys are stored in your context folder, at
        <span className="font-mono"> config/ai.json</span>, and never leave this machine
        except to reach the provider you pick.
      </p>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        {header}
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not load the settings</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const dirty = provider !== settings.provider
    || Object.keys(keys).some((id) => keys[id])
    || Object.entries(models).some(([id, model]) => model !== (settings.providers[id].model || ''))
    || Object.entries(hosts).some(([id, host]) => host !== (settings.providers[id].host || ''));

  return (
    <div className="space-y-6">
      {header}

      <Card>
        <CardHeader>
          <CardTitle>Provider</CardTitle>
          <CardDescription>Which model writes your flows.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger className="w-full" aria-label="AI provider">
              <SelectValue placeholder="Select a provider" />
            </SelectTrigger>
            <SelectContent>
              {settings.available.map((item) => (
                <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-wrap items-center gap-2">
            {settings.ready ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="size-3" /> Ready
              </Badge>
            ) : (
              <Badge variant="warning" className="gap-1">
                <AlertCircle className="size-3" /> Not configured yet
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || dirty}>
              {testing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {testing ? 'Testing…' : 'Test connection'}
            </Button>
            {dirty && (
              <span className="text-muted-foreground text-xs">Save first to test your changes.</span>
            )}
          </div>

          {testResult && (
            <Alert variant={testResult.ok ? 'default' : 'destructive'}>
              {testResult.ok ? <CheckCircle2 /> : <AlertCircle />}
              <AlertTitle>{testResult.ok ? 'It works' : 'It did not work'}</AlertTitle>
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {settings.available.map((item) => {
        const stored = settings.providers[item.id];
        return (
          <Card key={item.id} className={provider === item.id ? 'border-primary' : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {item.label}
                {provider === item.id && <Badge variant="outline" className="text-[10px]">in use</Badge>}
              </CardTitle>
              <CardDescription>{HINTS[item.id]}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor={`${item.id}-model`}>Model</Label>
                <Input
                  id={`${item.id}-model`}
                  value={models[item.id] ?? ''}
                  placeholder={item.defaultModel}
                  onChange={(event) => setModels({ ...models, [item.id]: event.target.value })}
                />
              </div>

              {item.id === 'ollama' && (
                <div className="grid gap-2">
                  <Label htmlFor="ollama-host">Host</Label>
                  <Input
                    id="ollama-host"
                    value={hosts.ollama ?? ''}
                    placeholder="http://127.0.0.1:11434"
                    onChange={(event) => setHosts({ ...hosts, ollama: event.target.value })}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadOllamaModels}
                      disabled={loadingModels}
                    >
                      {loadingModels ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                      Installed models
                    </Button>
                    {ollamaModels?.length === 0 && (
                      <span className="text-muted-foreground text-xs">
                        No model pulled yet on this host.
                      </span>
                    )}
                    {ollamaModels?.map((model) => (
                      <button
                        key={model}
                        type="button"
                        onClick={() => setModels({ ...models, ollama: model })}
                        className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-full border px-2 py-0.5 font-mono text-xs"
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {item.requiresApiKey && (
                <div className="grid gap-2">
                  <Label htmlFor={`${item.id}-key`}>
                    <KeyRound className="size-3.5" /> API key
                  </Label>
                  <Input
                    id={`${item.id}-key`}
                    type="password"
                    autoComplete="off"
                    value={keys[item.id] ?? ''}
                    placeholder={stored.hasApiKey ? 'Stored — type to replace it' : 'Paste your API key'}
                    onChange={(event) => setKeys({ ...keys, [item.id]: event.target.value })}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !dirty}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
        {saved && !dirty && (
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            <CheckCircle2 className="size-4" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}

export default AiSettings;
