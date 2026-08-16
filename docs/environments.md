# Environments

Credentials and endpoints never live in flow files. Each application keeps one
`.env` file **per environment** in its own folder:

```
<workspace>/applications/shop-api/env/
├── local.env
├── staging.env
└── production.env
```

- The environment names available to run with are the union of every
  application's env files (`staging.env` → environment `staging`).
- When a flow runs with `--env staging`, every application used by the flow
  must have a `staging.env` file — otherwise the run stops with a clear error.
- The GUI's sidebar selector lists all detected environments, color-coded
  (local / development / staging / uat / production, guessed from the name).

## Conventions used by the built-in helpers

| Variable | Used by | Meaning |
|---|---|---|
| `BASE_URL` | `httpClient` | Base URL every request path is appended to |
| `X_API_KEY` | `httpClient` | Sent as the `x-api-key` header |
| `HTTP_BASIC_AUTH` | `httpClient` | `user:pass`, sent as `Authorization: Basic ...` |
| `DATABASE_CONNECTION_STRING`, `PG*` | `pgClient` | PostgreSQL connection (below) |

Everything else is up to your application code (`ctx.env.<VAR>`).

## Secrets in the GUI

Environment files are viewable and editable in the GUI (Applications page).
Values whose keys look secret (`password`, `token`, `secret`, `x-api-key`,
`credential`, `authorization`) are masked in the variables table. The raw-file
editor shows the real contents — this is a local-only tool; the API binds to
your machine and reads your own files.

The CLI reporter masks the same kinds of keys when printing requests and
responses.

## PostgreSQL

The `pgClient` helper reads its configuration from the application's
environment file. Two styles are supported:

### Option 1: connection string

```bash
DATABASE_CONNECTION_STRING=postgres://user:password@host:5432/database
```

### Option 2: individual parameters

| Variable | Description | Example |
|---|---|---|
| `PGUSER` | Database user | `myuser` |
| `PGPASSWORD` | Database password | `mypassword` |
| `PGHOST` | Database host | `db.example.com` |
| `PGPORT` | Database port | `5432` |
| `PGDATABASE` | Database name | `mydatabase` |
| `PGQUERY_TIMEOUT` | Query timeout (ms) | `30000` |
| `PGLOCK_TIMEOUT` | Lock timeout (ms) | `10000` |
| `PGCLIENT_ENCODING` | Client encoding | `UTF8` |
| `PGOPTIONS` | Server command-line options | `-c statement_timeout=30s` |

If `DATABASE_CONNECTION_STRING` is present it takes precedence; the extra
parameters (`PGQUERY_TIMEOUT`, ...) apply in both styles.

### SSL

| Variable | Description | Example |
|---|---|---|
| `PGSSL_ENABLED` | Enable SSL | `true` |
| `PGSSL_REJECT_UNAUTHORIZED` | Reject unauthorized certificates | `false` |
| `PGSSL_CA` | CA certificate file | `/path/to/ca.pem` |
| `PGSSL_CERT` | Client certificate file | `/path/to/client-cert.pem` |
| `PGSSL_KEY` | Client key file | `/path/to/client-key.pem` |

**Self-signed certificates (development):**

```bash
PGSSL_ENABLED=true
PGSSL_REJECT_UNAUTHORIZED=false
```

**Full certificate validation (production):**

```bash
DATABASE_CONNECTION_STRING=postgres://admin:secret@secure.db.example.com:5432/production
PGSSL_ENABLED=true
PGSSL_CA=/path/to/ca-certificate.pem
PGSSL_CERT=/path/to/client-certificate.pem
PGSSL_KEY=/path/to/client-key.pem
```

## Per-case overrides

Application methods can run with a "case" (`ctx.case`); variables suffixed with
`_<case>` then override their base variable — e.g. with case `dev`,
`BASE_URL_dev` overrides `BASE_URL`. See
[Applications](applications.md#environment-overrides-per-case).
