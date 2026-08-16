---
title: 03 · Posts and memory
description: CRUD-style steps against a fake REST API, passing data between steps with memory.
---

# Posts and memory

This flow uses [JSONPlaceholder](https://jsonplaceholder.typicode.com), a
free fake REST API. It needs internet access (`local` environment).

## List a user's posts

Assert the shape of a collection with a JavaScript expression:

```step
application: jsonplaceholder
method: listPosts
description: User 1 has exactly 10 posts
parameters:
  query:
    userId: 1
test:
  status: 200
  body: "$expr: Array.isArray(value) && value.length === 10"
```

## Fetch a single resource

```step
application: jsonplaceholder
method: getPost
description: Fetch post 1 and check its author
parameters:
  params:
    id: 1
test:
  status: 200
  body:
    id: 1
    userId: 1
```

## Create a post with random data

`createPost` writes the id assigned by the API to `memory.lastPostId`. The
fake API always answers `201` — check the execution details below the step
to see the request that was actually sent (with the random values already
resolved) and the full response.

```step
application: jsonplaceholder
method: createPost
description: Create a post signed by a random author
parameters:
  body:
    title: "{{ randomString }}"
    body: "Written by {{ randomName }} from {{ belgianCityEn }}"
    userId: 1
test:
  status: 201
  body:
    id: "$expr: typeof value === 'number' && value > 100"
```

## The unhappy path

Unknown ids return a `404` — assert it, so a regression that starts
returning `200` for missing resources would break this flow:

```step
application: jsonplaceholder
method: getPost
description: Post 9999 does not exist
parameters:
  params:
    id: 9999
test:
  status: 404
```
