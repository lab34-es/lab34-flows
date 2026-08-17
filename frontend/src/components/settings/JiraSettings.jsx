import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Loader2, RefreshCw, Save, Ticket } from 'lucide-react';

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

const CREDENTIAL_HINTS = {
  cloud: 'Create an API key in Jira > Apps > Xray > API Keys, then paste the client id and secret here.',
  basic: 'Create an API token at id.atlassian.com > Security > Create API token, then use it with your Atlassian account email.',
  server: 'Create a token in Jira > your profile > Personal Access Tokens.',
};

/**
 * Settings for the Jira / Xray integration: which flavour of Xray to talk
 * to, where Jira lives and the credentials to use. Secrets are write-only —
 * the API only tells us whether one is stored.
 */
export function JiraSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Drafts, so nothing is written until Save is pressed
  const [kind, setKind] = useState('cloud');
  const [jiraBaseUrl, setJiraBaseUrl] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [xrayBaseUrl, setXrayBaseUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [token, setToken] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const apply = useCallback((data) => {
    setSettings(data);
    setKind(data.kind);
    setJiraBaseUrl(data.jiraBaseUrl || '');
    setProjectKey(data.projectKey || '');
    setXrayBaseUrl(data.cloud.xrayBaseUrl || '');
    setClientId(data.cloud.clientId || '');
    setClientSecret('');
    setEmail(data.basic?.email || '');
    setApiToken('');
    setToken('');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await settingsApi.getJira();
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
      const payload = {
        kind,
        jiraBaseUrl,
        projectKey,
        cloud: { xrayBaseUrl, clientId },
        basic: { email },
        server: {},
      };
      // Secrets are only sent when the user typed a new one
      if (clientSecret) { payload.cloud.clientSecret = clientSecret; }
      if (apiToken) { payload.basic.apiToken = apiToken; }
      if (token) { payload.server.personalAccessToken = token; }

      const response = await settingsApi.saveJira(payload);
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
      const response = await settingsApi.testJira();
      setTestResult({ ok: true, message: response.data.message });
    } catch (ex) {
      setTestResult({ ok: false, message: ex.response?.data?.error || ex.message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Could not load the Jira settings</AlertTitle>
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }

  const dirty = kind !== settings.kind
    || jiraBaseUrl !== (settings.jiraBaseUrl || '')
    || projectKey !== (settings.projectKey || '')
    || xrayBaseUrl !== (settings.cloud.xrayBaseUrl || '')
    || clientId !== (settings.cloud.clientId || '')
    || email !== (settings.basic?.email || '')
    || Boolean(clientSecret)
    || Boolean(apiToken)
    || Boolean(token);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="size-4" /> Jira / Xray
        </CardTitle>
        <CardDescription>
          Link your flows to Xray: a flow is a Test, and every ```step block is one of its
          steps. Point a flow at its Test with <span className="font-mono">xray.testKey</span> in
          the frontmatter and the UI will show the Test's summary and status. Credentials are
          stored in your context folder, at <span className="font-mono">config/jira.json</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="jira-kind">Integration</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger id="jira-kind" className="w-full" aria-label="Jira integration type">
              <SelectValue placeholder="Select an integration" />
            </SelectTrigger>
            <SelectContent>
              {settings.available.map((item) => (
                <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {settings.available.find((item) => item.id === kind)?.hint}
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="jira-url">Jira URL</Label>
          <Input
            id="jira-url"
            value={jiraBaseUrl}
            placeholder="https://your-company.atlassian.net"
            onChange={(event) => setJiraBaseUrl(event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Used to link every test key to its issue.
          </p>
        </div>

        {kind === 'cloud' ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="xray-url">Xray Cloud URL</Label>
              <Input
                id="xray-url"
                value={xrayBaseUrl}
                placeholder={settings.defaultXrayBaseUrl}
                onChange={(event) => setXrayBaseUrl(event.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Use the regional endpoint if your instance has one:
                <span className="font-mono"> https://eu.xray.cloud.getxray.app</span> or
                <span className="font-mono"> https://us.xray.cloud.getxray.app</span>.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="xray-client-id">Client id</Label>
              <Input
                id="xray-client-id"
                autoComplete="off"
                value={clientId}
                placeholder="Paste the API key's client id"
                onChange={(event) => setClientId(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="xray-client-secret">
                <KeyRound className="size-3.5" /> Client secret
              </Label>
              <Input
                id="xray-client-secret"
                type="password"
                autoComplete="off"
                value={clientSecret}
                placeholder={settings.cloud.hasClientSecret
                  ? 'Stored — type to replace it'
                  : 'Paste the API key’s client secret'}
                onChange={(event) => setClientSecret(event.target.value)}
              />
            </div>
          </>
        ) : kind === 'basic' ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="jira-email">Email</Label>
              <Input
                id="jira-email"
                type="email"
                autoComplete="off"
                value={email}
                placeholder="you@your-company.com"
                onChange={(event) => setEmail(event.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                The email of your Atlassian account.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="jira-api-token">
                <KeyRound className="size-3.5" /> API token
              </Label>
              <Input
                id="jira-api-token"
                type="password"
                autoComplete="off"
                value={apiToken}
                placeholder={settings.basic?.hasApiToken
                  ? 'Stored — type to replace it'
                  : 'Paste your Atlassian API token'}
                onChange={(event) => setApiToken(event.target.value)}
              />
            </div>
          </>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="jira-token">
              <KeyRound className="size-3.5" /> Personal access token
            </Label>
            <Input
              id="jira-token"
              type="password"
              autoComplete="off"
              value={token}
              placeholder={settings.server.hasToken ? 'Stored — type to replace it' : 'Paste your token'}
              onChange={(event) => setToken(event.target.value)}
            />
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="jira-project">Project key</Label>
          <Input
            id="jira-project"
            value={projectKey}
            placeholder="BOP"
            onChange={(event) => setProjectKey(event.target.value)}
          />
          <p className="text-muted-foreground text-xs">Optional, for reference only.</p>
        </div>

        <p className="text-muted-foreground text-xs">{CREDENTIAL_HINTS[kind]}</p>

        <div className="flex flex-wrap items-center gap-2">
          {settings.configured ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="size-3" /> Configured
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
      </CardContent>
    </Card>
  );
}

export default JiraSettings;
