/**
 * Turning whatever a step threw into something the UI can show.
 *
 * The runner has always printed the raw error to the terminal with
 * `console.error`, which unwraps nested causes and prints the properties a
 * driver attached to it. What reached the UI, though, was only `name` and
 * `message` -- and plenty of the errors a flow hits carry neither. The one
 * that started this: node's `AggregateError`, thrown by `pg` when a
 * connection is refused, has an empty message and keeps the two
 * `ECONNREFUSED` errors in `.errors`, so the UI showed an error box with
 * nothing in it while the terminal showed everything.
 *
 * `describe()` flattens an error into a plain, JSON-serialisable object: a
 * message that is never empty, the error code, the stack, and the chain of
 * causes (both `AggregateError.errors` and `Error.cause`). It is deliberately
 * defensive -- it is fed whatever user code threw, which is not necessarily
 * an `Error`.
 */

/** An error, flattened for the socket. Every field is JSON-serialisable. */
export interface DescribedError {
  name: string;
  message: string;
  /** Whatever the thrower used: 'ECONNREFUSED', 42, a flow's own code... */
  code?: string | number;
  stack?: string;
  /** Driver detail worth showing: pg's `detail`/`hint`, node's `syscall`... */
  details?: Record<string, string | number | boolean>;
  /** `AggregateError.errors` and the `cause` chain, described in turn. */
  causes?: DescribedError[];
}

/** How deep the cause chain is followed before it is cut off. */
const MAX_DEPTH = 4;

/** How many sibling causes of one error are kept. */
const MAX_CAUSES = 10;

/** Stacks are for context, not for reading a whole trace in a browser. */
const MAX_STACK = 4000;

/**
 * Properties errors commonly carry that say more than the message does.
 * Everything else on the error is left out: it is user data of unknown shape
 * and unknown size, and this object is broadcast to every connected client.
 */
const DETAIL_FIELDS = [
  'detail', 'hint', 'severity', 'constraint', 'table', 'column', // pg
  'syscall', 'address', 'port', 'path', 'errno', 'hostname',     // node
  'status', 'statusText', 'url'                                  // http clients
];

const isPrimitive = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

/** The name to show, falling back to the constructor for exotic throwables. */
const nameOf = (error: any): string => {
  if (error && typeof error.name === 'string' && error.name.trim()) {
    return error.name.trim();
  }

  if (error instanceof Error) {
    return error.constructor?.name || 'Error';
  }

  return 'Error';
};

/** The causes of an error: an AggregateError's siblings, then its `cause`. */
const causesOf = (error: any): unknown[] => {
  const causes: unknown[] = [];

  if (error && Array.isArray(error.errors)) {
    causes.push(...error.errors);
  }

  if (error && error.cause !== undefined && error.cause !== null) {
    causes.push(error.cause);
  }

  return causes.slice(0, MAX_CAUSES);
};

/**
 * A message that is never empty. An `AggregateError` has none of its own, so
 * the messages of what it aggregates stand in for it -- that is what turns
 * "AggregateError: " into "connect ECONNREFUSED 127.0.0.1:5432".
 */
const messageOf = (error: any, causes: DescribedError[]): string => {
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (error && typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  const fromCauses = causes.map(cause => cause.message).filter(Boolean);
  if (fromCauses.length) {
    return [...new Set(fromCauses)].join('; ');
  }

  if (error && isPrimitive(error.code)) {
    return String(error.code);
  }

  return `${nameOf(error)} (no message)`;
};

/** The known-useful, primitive-valued properties of an error. */
const detailsOf = (error: any): Record<string, string | number | boolean> | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const details: Record<string, string | number | boolean> = {};

  DETAIL_FIELDS.forEach(field => {
    const value = error[field];
    if (isPrimitive(value) && value !== '') {
      details[field] = value;
    }
  });

  return Object.keys(details).length ? details : undefined;
};

const describeAt = (error: unknown, depth: number, seen: Set<unknown>): DescribedError => {
  // A cause chain may loop back on itself, and an error may be its own cause
  if (error && typeof error === 'object') {
    if (seen.has(error)) {
      return { name: 'Error', message: '(circular reference)' };
    }
    seen.add(error);
  }

  const raw = error as any;

  const causes = depth >= MAX_DEPTH
    ? []
    : causesOf(raw).map(cause => describeAt(cause, depth + 1, seen));

  const described: DescribedError = {
    name: nameOf(raw),
    message: messageOf(raw, causes)
  };

  if (raw && isPrimitive(raw.code)) {
    described.code = raw.code as string | number;
  }

  if (raw && typeof raw.stack === 'string' && raw.stack.trim()) {
    described.stack = raw.stack.slice(0, MAX_STACK);
  }

  const details = detailsOf(raw);
  if (details) {
    described.details = details;
  }

  if (causes.length) {
    described.causes = causes;
  }

  return described;
};

/**
 * Flatten an error -- or anything else that was thrown -- into a plain object
 * safe to send over the socket.
 * @param {*} error
 * @returns {DescribedError}
 */
export const describe = (error: unknown): DescribedError =>
  describeAt(error, 0, new Set());

/**
 * The error as one line, for a terminal or a summary: the message, plus the
 * causes when they add something the message does not already say.
 * @param {DescribedError} described
 * @returns {string}
 */
export const summarize = (described: DescribedError): string => {
  const extra = (described.causes || [])
    .map(cause => cause.message)
    .filter(message => message && !described.message.includes(message));

  return extra.length ? `${described.message} (${extra.join('; ')})` : described.message;
};
