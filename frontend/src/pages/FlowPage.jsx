import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { AlertCircle, CheckCircle2, FileText, Loader2, Play, Save, Wand2, XCircle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Markdown from '@/components/shared/Markdown';
import AiEditDialog from '@/components/flow/AiEditDialog';
import StepCell from '@/components/flow/StepCell';
import XrayChip from '@/components/flow/XrayChip';
import { flowsApi, jiraApi } from '@/services/api';
import { useAppState } from '@/context/AppStateContext';
import { useExecutions } from '@/context/ExecutionContext';
import { useTheme } from '@/context/ThemeContext';

const RUN_STATUS_META = {
  starting: { label: 'Starting…', variant: 'info', Icon: Loader2, iconClass: 'animate-spin' },
  running: { label: 'Running…', variant: 'info', Icon: Loader2, iconClass: 'animate-spin' },
  passed: { label: 'Passed', variant: 'success', Icon: CheckCircle2 },
  error: { label: 'Failed', variant: 'destructive', Icon: XCircle },
};

export function FlowPage() {
  const [searchParams] = useSearchParams();
  const flowPath = searchParams.get('path');

  const { environment, refreshTree } = useAppState();
  const { executions, startRun, clearRun, anyRunning } = useExecutions();
  const { theme } = useTheme();

  const [flowData, setFlowData] = useState(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState('document');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [xray, setXray] = useState({ jiraBaseUrl: '', tests: {} });

  const run = flowPath ? executions[flowPath] : undefined;
  const dirty = flowData ? draft !== flowData.plainText : false;

  const loadFlow = useCallback(async () => {
    if (!flowPath) { return; }
    setLoading(true);
    setLoadError(null);
    try {
      const response = await flowsApi.getUserFlow(flowPath);
      setFlowData(response.data);
      setDraft(response.data.plainText || '');
    } catch (ex) {
      setLoadError(ex.response?.data?.error || ex.message);
    } finally {
      setLoading(false);
    }
  }, [flowPath]);

  useEffect(() => {
    setTab('document');
    setSaveError(null);
    setAiOpen(false);
    loadFlow();
  }, [loadFlow]);

  /**
   * Take the document the model rewrote as an unsaved change: the notebook
   * is re-parsed so it shows the new content right away, but the file on
   * disk is only touched when the user hits Save.
   */
  const handleAiEdit = async (content) => {
    setDraft(content);
    setSaveError(null);

    try {
      const parsed = await flowsApi.parse(content, flowData.format);
      setFlowData((current) => ({
        ...current,
        segments: parsed.data.segments,
        steps: parsed.data.steps,
        errors: parsed.data.errors,
        title: parsed.data.title || current.title,
      }));
    } catch (ex) {
      setSaveError(ex.response?.data?.error || ex.message);
    }

    // The previous run's step mapping no longer matches the document
    clearRun(flowPath);
    setTab('document');
  };

  const handleRun = async () => {
    if (!flowData || !environment) { return; }

    let content = dirty ? draft : flowData.plainText;

    // When running unsaved changes, re-parse them first so the notebook
    // cells match what is actually going to run.
    if (dirty) {
      try {
        const parsed = await flowsApi.parse(content, flowData.format);
        setFlowData((current) => ({
          ...current,
          segments: parsed.data.segments,
          steps: parsed.data.steps,
          errors: parsed.data.errors,
          title: parsed.data.title || current.title,
        }));
        if (parsed.data.errors?.length) {
          setTab('document');
          return;
        }
      } catch (ex) {
        setSaveError(ex.response?.data?.error || ex.message);
        return;
      }
    }

    setTab('document');
    await startRun(flowPath, { value: content, environment, format: flowData.format });
  };

  const handleSave = async () => {
    if (!flowData?.relativePath) { return; }
    setSaving(true);
    setSaveError(null);
    try {
      await flowsApi.saveFile(flowData.relativePath, draft, true);
      const response = await flowsApi.getUserFlow(flowPath);
      setFlowData(response.data);
      setDraft(response.data.plainText || '');
      // The old run's step mapping no longer matches the saved document
      clearRun(flowPath);
      refreshTree();
    } catch (ex) {
      setSaveError(ex.response?.data?.error || ex.message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * The Xray tests this document mentions: the flow's own one
   * (frontmatter "xray.testKey") plus the "testKey" of each step.
   */
  const testKeys = useMemo(() => {
    const keys = [];
    if (flowData?.xray?.testKey) { keys.push(flowData.xray.testKey); }
    (flowData?.steps || []).forEach((step) => {
      if (step?.testKey) { keys.push(step.testKey); }
    });
    return [...new Set(keys.map((key) => String(key).trim()).filter(Boolean))];
  }, [flowData]);

  const testKeysParam = testKeys.join(',');

  // Xray data is fetched after the document is rendered, and never blocks
  // it: when the integration is off, or Jira is unreachable, the flow reads
  // exactly as it did before.
  useEffect(() => {
    const keys = testKeysParam ? testKeysParam.split(',') : [];

    if (!keys.length) {
      setXray({ jiraBaseUrl: '', tests: {} });
      return undefined;
    }

    let cancelled = false;

    jiraApi.getTests(keys)
      .then((response) => {
        if (cancelled) { return; }
        setXray({
          jiraBaseUrl: response.data.jiraBaseUrl || '',
          tests: response.data.tests || {},
        });
      })
      .catch(() => {
        if (!cancelled) { setXray({ jiraBaseUrl: '', tests: {} }); }
      });

    return () => { cancelled = true; };
  }, [testKeysParam]);

  const xrayTestFor = useCallback(
    (key) => (key ? xray.tests[String(key).trim().toUpperCase()] : undefined),
    [xray]
  );

  const runStatusMeta = run ? RUN_STATUS_META[run.status] : null;

  const parseErrors = flowData?.errors || [];

  const stepDataFor = useMemo(() => {
    return (segment) => {
      if (!run || !run.stepOrder?.length) { return undefined; }
      const stepId = run.stepOrder[segment.stepIndex];
      return stepId ? run.steps[stepId] : undefined;
    };
  }, [run]);

  if (!flowPath) {
    return (
      <div className="p-6">
        <Alert>
          <FileText />
          <AlertTitle>No flow selected</AlertTitle>
          <AlertDescription>Pick a flow from the sidebar.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-4xl p-6">
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not load the flow</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <AiEditDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        content={dirty ? draft : flowData.plainText}
        onApply={handleAiEdit}
      />

      {/* Toolbar */}
      <div className="bg-background/95 sticky top-0 z-10 border-b px-6 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-bold tracking-tight">{flowData.title}</h1>
              <Badge variant="outline" className="text-[10px] uppercase">{flowData.format}</Badge>
              {runStatusMeta && (
                <Badge variant={runStatusMeta.variant} className="gap-1">
                  <runStatusMeta.Icon className={runStatusMeta.iconClass ? `size-3 ${runStatusMeta.iconClass}` : 'size-3'} />
                  {runStatusMeta.label}
                </Badge>
              )}
              {dirty && <Badge variant="warning" className="text-[10px]">unsaved</Badge>}
              {flowData.xray?.testKey && (
                <XrayChip
                  testKey={flowData.xray.testKey}
                  test={xrayTestFor(flowData.xray.testKey)}
                  jiraBaseUrl={xray.jiraBaseUrl}
                />
              )}
            </div>
            {flowData.relativePath && (
              <p className="text-muted-foreground truncate font-mono text-xs">{flowData.relativePath}</p>
            )}
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="document">Document</TabsTrigger>
              <TabsTrigger value="source">Source</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAiOpen(true)}
            disabled={anyRunning}
            title="Edit this flow with AI"
            aria-label="Edit this flow with AI"
          >
            <Wand2 />
          </Button>

          {dirty && flowData.relativePath && (
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              <Save /> {saving ? 'Saving…' : 'Save'}
            </Button>
          )}

          <Button
            onClick={handleRun}
            // Stale parse errors must not block a run of edited (dirty)
            // content: handleRun re-parses the draft and bails if needed
            disabled={anyRunning || !environment || (!dirty && parseErrors.length > 0)}
            title={!environment ? 'Select an environment in the sidebar first' : `Run on “${environment}”`}
          >
            <Play /> Run{environment ? ` · ${environment}` : ''}
          </Button>
        </div>
      </div>

      {/* Content */}
      {tab === 'source' ? (
        <div className="min-h-0 flex-1">
          <Editor
            height="100%"
            language="markdown"
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            value={draft}
            onChange={(value) => setDraft(value ?? '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-4xl space-y-1 px-6 py-6">
            {/* Problems */}
            {saveError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle />
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
            {run?.startError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle />
                <AlertTitle>The flow could not start</AlertTitle>
                <AlertDescription>{run.startError}</AlertDescription>
              </Alert>
            )}
            {run?.execution?.error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle />
                <AlertTitle>{run.execution.error.name || 'Execution error'}</AlertTitle>
                <AlertDescription>{run.execution.error.message}</AlertDescription>
              </Alert>
            )}
            {parseErrors.length > 0 && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle />
                <AlertTitle>This flow has {parseErrors.length} problem{parseErrors.length > 1 ? 's' : ''}</AlertTitle>
                <AlertDescription>
                  {parseErrors.map((error, index) => (
                    <p key={index} className="font-mono text-xs">
                      {typeof error.stepIndex === 'number' ? `step ${error.stepIndex + 1}: ` : ''}{error.message}
                    </p>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {/* The notebook: markdown prose + step cells with execution output */}
            {(flowData.segments || []).map((segment, index) => {
              if (segment.type === 'step') {
                const step = (flowData.steps || []).find(
                  (candidate) => candidate && candidate.stepIndex === segment.stepIndex
                );
                return (
                  <StepCell
                    key={index}
                    segment={segment}
                    step={step}
                    stepData={stepDataFor(segment)}
                    xrayTest={xrayTestFor(step?.testKey)}
                    jiraBaseUrl={xray.jiraBaseUrl}
                  />
                );
              }
              return <Markdown key={index} className="py-2">{segment.content}</Markdown>;
            })}

            {(flowData.segments || []).length === 0 && (
              <p className="text-muted-foreground text-sm">
                This flow is empty. Switch to <strong>Source</strong> and start writing Markdown —
                add executable steps with ```step code blocks.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FlowPage;
