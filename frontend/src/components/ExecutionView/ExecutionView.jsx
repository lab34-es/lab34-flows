import React, { useState } from 'react';
import {
  Box,
  Typography,
  Sheet,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/joy';
import {
  PlayArrow as RunIcon,
  CheckCircle as PassedIcon,
  Cancel as FailedIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

// Map an execution status to a Joy UI color
const statusColor = (status) => {
  switch (status) {
    case 'passed': return 'success';
    case 'running': return 'primary';
    case 'failed':
    case 'error': return 'danger';
    default: return 'neutral';
  }
};

const StatusChip = ({ status, size = 'sm' }) => {
  if (!status) {
    return <Chip size={size} variant="soft" color="neutral">pending</Chip>;
  }

  return (
    <Chip
      size={size}
      variant={status === 'running' ? 'solid' : 'soft'}
      color={statusColor(status)}
      startDecorator={
        status === 'running' ? <CircularProgress size="sm" variant="solid" thickness={2} sx={{ '--CircularProgress-size': '14px' }} /> :
          status === 'passed' ? <PassedIcon sx={{ fontSize: 14 }} /> :
            (status === 'failed' || status === 'error') ? <FailedIcon sx={{ fontSize: 14 }} /> : null
      }
    >
      {status}
    </Chip>
  );
};

const JsonBlock = ({ value }) => (
  <Sheet
    variant="soft"
    sx={{
      p: 1.5,
      borderRadius: 'sm',
      bgcolor: 'background.level2',
      overflow: 'auto',
      maxHeight: 320,
    }}
  >
    <Box
      component="pre"
      sx={{
        fontFamily: 'monospace',
        fontSize: 'xs',
        lineHeight: 1.5,
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
    </Box>
  </Sheet>
);

const Section = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Box sx={{ mt: 1 }}>
      <Box
        onClick={() => setOpen(!open)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <IconButton size="sm" variant="plain" sx={{ minWidth: 24, minHeight: 24 }}>
          {open ? <CollapseIcon sx={{ fontSize: 16 }} /> : <ExpandIcon sx={{ fontSize: 16 }} />}
        </IconButton>
        <Typography level="body-xs" fontWeight="lg" textTransform="uppercase" sx={{ letterSpacing: '0.05em' }}>
          {title}
        </Typography>
      </Box>
      {open && <Box sx={{ mt: 0.5, ml: 3.5 }}>{children}</Box>}
    </Box>
  );
};

const TestReport = ({ report }) => {
  if (!report) { return null; }

  const aspects = Object.entries(report).filter(([aspect, errors]) =>
    aspect !== 'hasErrors' && Array.isArray(errors));

  return (
    <Box>
      <Chip
        size="sm"
        variant="soft"
        color={report.hasErrors ? 'danger' : 'success'}
        sx={{ mb: 1 }}
      >
        {report.hasErrors ? 'Test failed' : 'Test passed'}
      </Chip>

      {aspects.map(([aspect, errors]) => (
        <Box key={aspect} sx={{ mb: 1 }}>
          <Typography level="body-xs" fontWeight="lg">
            {aspect}: {errors.length === 0 ? 'OK' : `${errors.length} error(s)`}
          </Typography>
          {errors.map((error, i) => (
            <Sheet
              key={i}
              variant="soft"
              color="danger"
              sx={{ p: 1, mt: 0.5, borderRadius: 'sm' }}
            >
              <Typography level="body-xs">{error.message}</Typography>
              {'expected' in error && (
                <Typography level="body-xs" sx={{ fontFamily: 'monospace' }}>
                  expected: {JSON.stringify(error.expected)}
                </Typography>
              )}
              {'actual' in error && (
                <Typography level="body-xs" sx={{ fontFamily: 'monospace' }}>
                  actual: {JSON.stringify(error.actual)}
                </Typography>
              )}
              {'expression' in error && (
                <Typography level="body-xs" sx={{ fontFamily: 'monospace' }}>
                  expression: {error.expression} — value: {JSON.stringify(error.actualValue)}
                </Typography>
              )}
              {'errors' in error && (
                <Typography level="body-xs" sx={{ fontFamily: 'monospace' }}>
                  {JSON.stringify(error.errors)}
                </Typography>
              )}
            </Sheet>
          ))}
        </Box>
      ))}
    </Box>
  );
};

const stepDuration = (step) => {
  const times = step?.execution?.times;
  if (!times?.start || !times?.end) { return null; }
  return ((times.end - times.start) / 1000).toFixed(2);
};

/**
 * Live view of a flow execution. Receives the latest execution object and
 * step list built from "flowexecution:update" socket events.
 */
const ExecutionView = ({ execution, steps, requestError }) => {
  if (requestError) {
    return (
      <Alert color="danger" startDecorator={<WarningIcon />} sx={{ m: 2 }}>
        <Box>
          <Typography level="title-sm">Could not start the flow</Typography>
          <Typography level="body-sm">{requestError}</Typography>
        </Box>
      </Alert>
    );
  }

  if (!execution) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <RunIcon sx={{ fontSize: 48, color: 'text.tertiary', mb: 2 }} />
          <Typography level="title-md" sx={{ mb: 1 }}>
            No execution yet
          </Typography>
          <Typography level="body-sm" color="neutral">
            Press "Run flow" to execute this flow and watch live progress here.
          </Typography>
        </Box>
      </Box>
    );
  }

  const totalDuration = execution.times?.duration
    ? (execution.times.duration / 1000).toFixed(2)
    : null;

  return (
    <Box sx={{ p: 2 }}>
      {/* Overall execution banner */}
      <Sheet
        variant="soft"
        color={statusColor(execution.status)}
        sx={{ p: 2, borderRadius: 'md', mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}
      >
        <StatusChip status={execution.status} size="md" />
        <Typography level="body-sm" sx={{ fontFamily: 'monospace' }}>
          {execution.id}
        </Typography>
        {totalDuration && (
          <Typography level="body-sm">
            finished in {totalDuration}s
          </Typography>
        )}
      </Sheet>

      {execution.error && (
        <Alert color="danger" startDecorator={<WarningIcon />} sx={{ mb: 2 }}>
          <Box>
            <Typography level="title-sm">{execution.error.name || 'Error'}</Typography>
            <Typography level="body-sm">{execution.error.message}</Typography>
          </Box>
        </Alert>
      )}

      {/* Steps */}
      <Sheet variant="outlined" sx={{ borderRadius: 'md', overflow: 'hidden' }}>
        {(steps || []).map((step, index) => (
          <Box
            key={step.id || index}
            sx={{
              p: 2,
              borderBottom: index < steps.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: `${statusColor(step.execution?.status)}.500`,
                  color: '#fff',
                  fontSize: 'xs',
                  fontWeight: 'md',
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </Box>
              <Typography level="title-sm">
                {step.application}
                <Typography level="body-sm" color="neutral"> / {step.method}</Typography>
              </Typography>
              <StatusChip status={step.execution?.status} />
              {step.execution?.attempt > 0 && (
                <Chip size="sm" variant="outlined" color="warning">
                  attempt {step.execution.attempt + 1}
                </Chip>
              )}
              {stepDuration(step) && (
                <Typography level="body-xs" color="neutral">
                  {stepDuration(step)}s
                </Typography>
              )}
            </Box>

            {step.description && (
              <Typography level="body-sm" color="neutral" sx={{ mt: 0.5, ml: 4.5 }}>
                {step.description}
              </Typography>
            )}

            {step.execution?.error && (
              <Alert color="danger" size="sm" sx={{ mt: 1, ml: 4.5 }}>
                {step.execution.error.message}
              </Alert>
            )}

            <Box sx={{ ml: 1 }}>
              {step.parameters && Object.keys(step.parameters).length > 0 && (
                <Section title="Request parameters">
                  <JsonBlock value={step.parameters} />
                </Section>
              )}

              {step.response && (
                <Section title={`Response${step.response.status ? ` — ${step.response.status}` : ''}`}>
                  {step.response.headers && (
                    <>
                      <Typography level="body-xs" fontWeight="lg" sx={{ mb: 0.5 }}>Headers</Typography>
                      <JsonBlock value={step.response.headers} />
                    </>
                  )}
                  <Typography level="body-xs" fontWeight="lg" sx={{ my: 0.5 }}>Body</Typography>
                  <JsonBlock value={step.response.body ?? 'empty'} />
                </Section>
              )}

              {step.testReport && (
                <Section title="Test report" defaultOpen={Boolean(step.testReport.hasErrors)}>
                  <TestReport report={step.testReport} />
                </Section>
              )}
            </Box>
          </Box>
        ))}

        {(!steps || steps.length === 0) && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <CircularProgress size="sm" />
            <Typography level="body-sm" color="neutral" sx={{ mt: 1 }}>
              Waiting for execution details...
            </Typography>
          </Box>
        )}
      </Sheet>
    </Box>
  );
};

export default ExecutionView;
