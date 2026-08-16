# jsonplaceholder

Example application backed by
[JSONPlaceholder](https://jsonplaceholder.typicode.com), a free fake REST API
for testing and prototyping. It behaves like a real posts/users API:
collections, lookups by id, `404`s for unknown resources and `201`s on
creation.

## What you can practice with it

- **CRUD-style steps** — list, fetch and create resources.
- **Assertions with expressions** — e.g.
  `"$expr: Array.isArray(value) && value.length === 10"`.
- **Memory between steps** — `createPost` stores the created id as
  `memory.lastPostId` for later steps.
- **Random test data** — combine with replacers like `{{ randomString }}`
  and `{{ randomName }}`.

> Note: JSONPlaceholder fakes writes — `POST /posts` answers `201` with a new
> id, but the resource is not really persisted.

## Methods

| Method | Description |
|-|-|
| `listPosts` | `GET /posts`, optionally filtered by `query.userId` |
| `getPost` | `GET /posts/{id}`, a single post |
| `createPost` | `POST /posts`, writes the new id to `memory.lastPostId` |
| `getUser` | `GET /users/{id}`, a user profile |

See the **Methods** section in the UI (or the JSDoc blocks of `index.js`) for
the full input / output / memory reference of each method.

## Environment

| Variable | Description | Example |
|-|-|-|
| `BASE_URL` | Base URL of the API | `https://jsonplaceholder.typicode.com` |
