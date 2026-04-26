---
name: REST API Design Standards
description: Use when designing, implementing, or reviewing RESTful APIs. Covers URL naming, HTTP methods and status codes, request/response conventions, error handling, pagination, filtering, versioning, idempotency, rate limiting, authentication, and HATEOAS.
---

# REST API Design Standard

## 1. Compliance Levels

| Level | Meaning | Action |
|-------|---------|--------|
| [MANDATORY] | Must follow, no exceptions | Code review will fail |
| [PREFERRED] | Strongly recommended | Explain reason if not following |
| [SUGGESTED] | Choose based on scenario | Keep consistent within team |

---

## 2. URL Design

### 2.1 General Rules

1. [MANDATORY] Use kebab-case for URL path segments: `/user-profiles`, not `/userProfiles` or `/user_profiles`.
2. [MANDATORY] Resources are plural nouns: `/users`, `/orders`, not `/user`, `/order`.
3. [MANDATORY] URL paths are lowercase only. No uppercase letters, no underscores.
4. [MANDATORY] No trailing slashes: `/users`, not `/users/`.
5. [MANDATORY] No file extensions in URLs: `/users/123`, not `/users/123.json`.
6. [PREFERRED] URL depth should not exceed 3 levels: `/users/{id}/orders` is acceptable; `/users/{id}/orders/{oid}/items/{iid}/comments` is too deep — flatten it.

### 2.2 Resource Naming

1. [MANDATORY] Use nouns to represent resources, never verbs: `/users`, not `/getUsers`.
2. [MANDATORY] Nested resources express ownership or containment: `/users/{id}/orders` means "orders belonging to this user".
3. [PREFERRED] If a sub-resource can be identified globally, expose it as a top-level resource as well: `/orders/{id}` alongside `/users/{uid}/orders`.
4. [SUGGESTED] Singleton sub-resources use singular: `/users/{id}/profile`, not `/users/{id}/profiles`.

### 2.3 Non-CRUD Actions

Not all operations map cleanly to CRUD. Use the following patterns:

1. [PREFERRED] Model the action as a state transition and use `PATCH` on the resource:
   ```
   PATCH /orders/{id}
   { "status": "cancelled" }
   ```

2. [PREFERRED] If the action is complex or has side effects beyond state change, model it as a sub-resource:
   ```
   POST /orders/{id}/cancellation
   POST /orders/{id}/refund
   POST /users/{id}/password-reset
   ```

3. [SUGGESTED] As a last resort, use a `/actions` namespace:
   ```
   POST /orders/{id}/actions/archive
   ```

### 2.4 Query Parameters

1. [MANDATORY] Use camelCase for query parameter names: `?pageSize=20`, not `?page_size=20`.
2. [MANDATORY] Filtering uses field names as parameter keys: `?status=active&role=admin`.
3. [PREFERRED] Sorting uses a `sort` parameter with field names, prefix `-` for descending: `?sort=-createdAt,name`.
4. [PREFERRED] Field selection uses a `fields` parameter: `?fields=id,name,email`.
5. [SUGGESTED] Complex filters use bracket notation: `?filter[status]=active&filter[createdAt][gte]=2025-01-01`.

---

## 3. HTTP Methods

### 3.1 Method Semantics

| Method | Semantics | Idempotent | Safe | Request Body |
|--------|-----------|------------|------|--------------|
| `GET` | Retrieve resource(s) | Yes | Yes | No |
| `POST` | Create resource or trigger action | No | No | Yes |
| `PUT` | Full replacement of a resource | Yes | No | Yes |
| `PATCH` | Partial update of a resource | No* | No | Yes |
| `DELETE` | Remove a resource | Yes | No | Optional |

> *`PATCH` can be made idempotent if the payload describes the target state (merge-patch), not a diff.

### 3.2 Method Usage Rules

1. [MANDATORY] `GET` must never produce side effects. No creating, updating, or deleting via `GET`.
2. [MANDATORY] `PUT` replaces the entire resource. Omitted fields are reset to defaults, not ignored.
3. [MANDATORY] `POST` is used for creation when the server assigns the ID. The response must include the created resource and a `Location` header.
4. [PREFERRED] Use `PATCH` with JSON Merge Patch (`application/merge-patch+json`) for partial updates: send only the fields to change.
5. [PREFERRED] `DELETE` is idempotent: deleting an already-deleted resource returns `204`, not `404`.
6. [MANDATORY] Bulk operations use `POST` to a collection endpoint, never overload `DELETE` or `PUT` with arrays.

### 3.3 Method-to-Endpoint Mapping

```
Collection: /users
  GET    /users          → List users (with pagination)
  POST   /users          → Create a new user

Instance:  /users/{id}
  GET    /users/{id}     → Retrieve a specific user
  PUT    /users/{id}     → Full update of a user
  PATCH  /users/{id}     → Partial update of a user
  DELETE /users/{id}     → Delete a user
```

---

## 4. HTTP Status Codes

### 4.1 Success Codes

| Code | When to Use | Body |
|------|-------------|------|
| `200 OK` | Successful `GET`, `PUT`, `PATCH`, or action `POST` | Response body with data |
| `201 Created` | Successful `POST` that creates a resource | Created resource + `Location` header |
| `202 Accepted` | Request accepted for async processing | Status tracking reference (e.g., job ID) |
| `204 No Content` | Successful `DELETE` or `PUT`/`PATCH` with no response body needed | Empty body |

### 4.2 Client Error Codes

| Code | When to Use | Notes |
|------|-------------|-------|
| `400 Bad Request` | Malformed request syntax, invalid JSON | Not for business validation |
| `401 Unauthorized` | Missing or invalid authentication credentials | Include `WWW-Authenticate` header |
| `403 Forbidden` | Authenticated but not authorized for this action | Do not reveal whether the resource exists |
| `404 Not Found` | Resource does not exist or is soft-deleted | Also use when the user has no permission and you want to hide the resource's existence |
| `405 Method Not Allowed` | HTTP method not supported on this endpoint | Include `Allow` header listing valid methods |
| `409 Conflict` | State conflict (duplicate creation, concurrent modification) | Include details about the conflict |
| `415 Unsupported Media Type` | Request `Content-Type` not supported | Specify accepted media types |
| `422 Unprocessable Entity` | Business validation failure (semantically invalid) | Include field-level error details |
| `429 Too Many Requests` | Rate limit exceeded | Include `Retry-After` header |

### 4.3 Server Error Codes

| Code | When to Use | Notes |
|------|-------------|-------|
| `500 Internal Server Error` | Unexpected server failure | Never expose stack traces or internal details |
| `502 Bad Gateway` | Upstream service returned invalid response | Used by API gateways / reverse proxies |
| `503 Service Unavailable` | Temporarily unable to handle requests | Include `Retry-After` header if possible |
| `504 Gateway Timeout` | Upstream service did not respond in time | Used by API gateways / reverse proxies |

### 4.4 Status Code Rules

1. [MANDATORY] Never return `200` with an error body. Use the correct 4xx/5xx code.
2. [MANDATORY] Never return `500` for client errors. Distinguish between client and server fault.
3. [MANDATORY] Never leak stack traces, SQL, or internal file paths in any error response.
4. [PREFERRED] Use `422` for business validation errors, `400` for structural/syntactic errors.
5. [PREFERRED] Return `404` instead of `403` when you want to hide the existence of a resource from unauthorized users.

---

## 5. Request and Response Format

### 5.1 Content Type

1. [MANDATORY] API must accept and return `application/json` by default.
2. [MANDATORY] Set `Content-Type: application/json; charset=utf-8` on all JSON responses.
3. [PREFERRED] Use `application/merge-patch+json` for `PATCH` requests.

### 5.2 Request Body Conventions

1. [MANDATORY] Use camelCase for JSON field names: `{ "firstName": "John" }`, not `{ "first_name": "John" }`.
2. [MANDATORY] Do not include read-only fields (`id`, `createdAt`, `updatedAt`) in create/update request bodies. Ignore them silently if sent.
3. [PREFERRED] Use ISO 8601 format for date/time fields in JSON: `"2025-04-01T12:00:00Z"`.
4. [PREFERRED] Use string representation for monetary amounts to avoid floating-point issues: `"amount": "123.45"`, with a separate `"currency": "USD"` field.

### 5.3 Unified Response Envelope

[MANDATORY] All API responses use a unified envelope with four top-level fields: `data`, `error`, `pagination`, `meta`. A response contains either `data` or `error`, never both.

```json
{
  "data":       <object | array | null>,
  "error":      <object | null>,
  "pagination": <object | null>,
  "meta":       <object | null>
}
```

| Field | Type | Present When |
|-------|------|--------------|
| `data` | object or array | Success (2xx). Single resource → object. Collection → array. `204 No Content` → omit body entirely. |
| `error` | object | Failure (4xx/5xx). |
| `pagination` | object | Collection responses only. |
| `meta` | object | Optional. Telemetry and request metadata for observability. Present in both success and error responses. |

**Rules:**

1. [MANDATORY] Success responses set `data` and leave `error` as `null` (or omit it).
2. [MANDATORY] Error responses set `error` and leave `data` as `null` (or omit it).
3. [MANDATORY] `pagination` is only present when `data` is an array.
4. [PREFERRED] Omit `null` fields from the envelope to reduce payload size. Clients determine the response type by checking which top-level key is present.
5. [SUGGESTED] Include `meta` for observability. It is optional — services may choose to include it based on environment (e.g., always in staging, selectively in production).

### 5.4 Single Resource Response

```json
{
  "data": {
    "id": "01JQVKX3...",
    "name": "John Doe",
    "email": "john@example.com",
    "status": "active",
    "createdAt": "2025-04-01T12:00:00Z",
    "updatedAt": "2025-04-01T14:30:00Z"
  }
}
```

### 5.5 Collection Response

```json
{
  "data": [
    { "id": "01JQVKX3...", "name": "John Doe" },
    { "id": "01JQVKX4...", "name": "Jane Doe" }
  ],
  "pagination": {
    "cursor": "eyJpZCI6...",
    "hasMore": true
  }
}
```

### 5.6 Error Response

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable description of the error",
    "details": [
      { "field": "email", "issue": "Invalid email format" },
      { "field": "age", "issue": "Must be at least 18" }
    ]
  },
  "meta": {
    "requestId": "req_abc123"
  }
}
```

### 5.7 Empty States

1. [MANDATORY] Empty collection: return `200` with `{ "data": [], "pagination": { "cursor": null, "hasMore": false } }`. Never return `404` for empty collections.
2. [MANDATORY] `204 No Content` (e.g., successful `DELETE`): no response body at all. Do not return an empty envelope.
3. [MANDATORY] Null vs. absent within `data`: omit fields that are not set, rather than including them with `null`. Exception: if the client explicitly requested a field via `fields` parameter, include it as `null`.

### 5.8 Meta Object (Telemetry)

[SUGGESTED] The `meta` field carries request-level telemetry and metadata for observability. It is present in both success and error responses when enabled.

```json
{
  "data": { ... },
  "meta": {
    "requestId": "req_abc123",
    "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
    "serverTime": "2025-04-01T12:00:00.123Z",
    "latency": 42
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | string | Unique request identifier. Same value as the `X-Request-Id` response header. |
| `traceId` | string | Distributed tracing ID (W3C Trace Context `trace-id`). Omit if tracing is not enabled. |
| `serverTime` | string | ISO 8601 timestamp when the server produced the response. |
| `latency` | integer | Server-side processing time in milliseconds. |

**Rules:**

1. [SUGGESTED] `requestId` is the minimum required field when `meta` is present.
2. [SUGGESTED] `traceId` should be included when distributed tracing (e.g., OpenTelemetry) is enabled.
3. [SUGGESTED] `serverTime` and `latency` are useful for debugging but may be omitted in production for security or performance reasons.
4. [PREFERRED] When `meta` is enabled, include it in **both** success and error responses for consistent observability.

---

## 6. Error Detail

### 6.1 Error Object Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Machine-readable error code, UPPER_SNAKE_CASE |
| `message` | string | Yes | Human-readable description, suitable for logging |
| `details` | array | No | Field-level or item-level errors for validation failures |

> `requestId` has been moved to the top-level `meta` object (see Section 5.8) for consistency across success and error responses.

### 6.2 Standard Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_FAILED` | 422 | One or more fields failed business validation |
| `INVALID_REQUEST` | 400 | Malformed request syntax or missing required field |
| `UNAUTHORIZED` | 401 | Authentication required or credentials invalid |
| `FORBIDDEN` | 403 | Authenticated but not authorized |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | State conflict or duplicate resource |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### 6.3 Error Rules

1. [PREFERRED] Include `meta.requestId` in every response (success and error) for tracing. See Section 5.8.
2. [MANDATORY] Return all validation errors at once, not one at a time.
3. [MANDATORY] Error messages must not reveal internal implementation details, SQL queries, or stack traces.
4. [PREFERRED] Error codes are stable and documented; clients should be able to programmatically handle errors based on `code`.
5. [PREFERRED] For `409 Conflict`, include enough detail for the client to resolve the conflict (e.g., current version, conflicting field).

---

## 7. Pagination

### 7.1 Cursor-Based Pagination (Default)

[PREFERRED] Use cursor-based (keyset) pagination for all collection endpoints. It provides stable results under concurrent writes and O(1) performance regardless of offset depth.

**Request:**
```
GET /orders?limit=20&cursor=eyJpZCI6...
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "cursor": "eyJpZCI6...",
    "hasMore": true
  }
}
```

### 7.2 Offset-Based Pagination (Legacy Only)

[SUGGESTED] Only use offset-based pagination when the client genuinely needs random page access (e.g., admin dashboards). Be aware of performance degradation on deep pages.

**Request:**
```
GET /orders?page=1&pageSize=20
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalCount": 1523,
    "totalPages": 77
  }
}
```

### 7.3 Pagination Rules

1. [MANDATORY] Default page size: 20. Maximum page size: 100. Controlled by `limit` or `pageSize` query parameter.
2. [MANDATORY] If `limit` exceeds the maximum, clamp to the maximum silently. Do not return an error.
3. [MANDATORY] Cursor values must be opaque to the client. Use Base64-encoded JSON internally; never expose raw database IDs or timestamps.
4. [PREFERRED] Include `hasMore` (boolean) in every pagination response so the client knows whether to request the next page.
5. [PREFERRED] For cursor pagination, the cursor encodes the sort key + tie-breaker (e.g., `createdAt` + `id`) to guarantee deterministic ordering.

---

## 8. Filtering, Sorting, and Field Selection

### 8.1 Filtering

1. [PREFERRED] Simple equality filters use field names as query parameters: `?status=active&role=admin`.
2. [SUGGESTED] Range filters use bracket notation: `?createdAt[gte]=2025-01-01&createdAt[lt]=2025-02-01`.
3. [SUGGESTED] Multi-value filters use comma-separated values: `?status=active,pending`.
4. [MANDATORY] Never allow filtering on unindexed fields in production. Return `400` if an unsupported filter is requested.

### 8.2 Sorting

1. [PREFERRED] Sorting uses a `sort` query parameter: `?sort=-createdAt,name` (descending `createdAt`, then ascending `name`).
2. [MANDATORY] Default sort order must be deterministic. Always include a tie-breaker (typically `id`) to ensure stable pagination.
3. [MANDATORY] Only allow sorting on indexed fields. Return `400` for unsupported sort fields.

### 8.3 Field Selection (Sparse Fieldsets)

1. [SUGGESTED] Support a `fields` parameter for clients to request only needed fields: `?fields=id,name,email`.
2. [SUGGESTED] Always return `id` even if not explicitly requested.
3. [SUGGESTED] Unknown field names in `fields` are silently ignored.

---

## 9. Versioning

### 9.1 Strategy

[PREFERRED] Use URL path versioning with a major version prefix:

```
/v1/users
/v2/users
```

### 9.2 Versioning Rules

1. [MANDATORY] The API version is always the first path segment after the base path.
2. [MANDATORY] Breaking changes require a new major version. Non-breaking additions (new fields, new endpoints) do not.
3. [PREFERRED] Support at most 2 major versions simultaneously. Deprecate old versions with a timeline.
4. [PREFERRED] Include a `Deprecation` header on deprecated endpoints: `Deprecation: true`.
5. [SUGGESTED] Include a `Sunset` header with the retirement date: `Sunset: Sat, 01 Jan 2028 00:00:00 GMT`.

### 9.3 What Counts as a Breaking Change

| Breaking (new version) | Non-breaking (same version) |
|------------------------|-----------------------------|
| Removing a field from response | Adding a new optional field to response |
| Renaming a field | Adding a new endpoint |
| Changing a field's type | Adding a new optional query parameter |
| Removing an endpoint | Adding a new enum value (if client handles unknown values) |
| Changing error code semantics | Adding a new error code |
| Making an optional field required | Relaxing a validation constraint |

---

## 10. Idempotency

### 10.1 Idempotency Key

[PREFERRED] Support an `Idempotency-Key` header for `POST` requests that create resources or trigger side effects.

**Request:**
```
POST /payments
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{ "amount": "100.00", "currency": "USD" }
```

### 10.2 Idempotency Rules

1. [PREFERRED] `Idempotency-Key` is a client-generated UUID.
2. [PREFERRED] If a request with the same key has already been processed, return the original response (same status code and body). Do not re-execute the operation.
3. [PREFERRED] Store idempotency records for at least 24 hours, then expire them.
4. [MANDATORY] `GET`, `PUT`, and `DELETE` are inherently idempotent by HTTP specification. Do not require an `Idempotency-Key` for these methods.
5. [SUGGESTED] If a duplicate request arrives while the original is still being processed, return `409 Conflict` with an appropriate message.

---

## 11. Authentication and Security

### 11.1 Authentication

1. [MANDATORY] Use Bearer tokens in the `Authorization` header: `Authorization: Bearer <token>`.
2. [MANDATORY] Never pass credentials in URL query parameters.
3. [MANDATORY] All API endpoints must be served over HTTPS. HTTP requests should be rejected, not redirected.
4. [PREFERRED] Use short-lived access tokens (15-60 minutes) with a refresh token mechanism.

### 11.2 Security Headers

[MANDATORY] Include the following headers on all API responses:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `Cache-Control` | `no-store` | Prevent caching of sensitive data (adjust for public endpoints) |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforce HTTPS |

### 11.3 Rate Limiting

1. [PREFERRED] Return rate limit information in response headers:
   ```
   X-RateLimit-Limit: 1000
   X-RateLimit-Remaining: 999
   X-RateLimit-Reset: 1617235200
   ```
2. [MANDATORY] When rate limited, return `429 Too Many Requests` with a `Retry-After` header (seconds).
3. [PREFERRED] Apply rate limits per API key or per user, not per IP alone.

### 11.4 Input Validation

1. [MANDATORY] Validate and sanitize all input at the Adapter layer boundary.
2. [MANDATORY] Reject unexpected fields in strict mode or ignore them silently — never process them.
3. [MANDATORY] Enforce maximum request body size (default: 1 MB unless the endpoint explicitly needs more).
4. [MANDATORY] Enforce maximum string lengths for all string fields.

---

## 12. Asynchronous Operations

### 12.1 Long-Running Operations

[PREFERRED] For operations that take longer than a few seconds, return `202 Accepted` with a status resource:

**Initial request:**
```
POST /reports/generate
→ 202 Accepted
Location: /jobs/abc123

{
  "data": {
    "jobId": "abc123",
    "status": "pending",
    "statusUrl": "/jobs/abc123"
  }
}
```

**Polling:**
```
GET /jobs/abc123
→ 200 OK

{
  "data": {
    "jobId": "abc123",
    "status": "completed",
    "result": { ... }
  }
}
```

### 12.2 Async Rules

1. [MANDATORY] The `202 Accepted` response must include a `Location` header pointing to the status endpoint.
2. [PREFERRED] Status endpoint returns the current state: `pending`, `processing`, `completed`, `failed`.
3. [SUGGESTED] Support webhooks as an alternative to polling: allow clients to register a callback URL.
4. [SUGGESTED] Include `progress` percentage or `estimatedCompletionTime` when feasible.

---

## 13. HATEOAS and Discoverability

### 13.1 Link Relations

[SUGGESTED] Include `_links` for navigational discoverability when the API is consumed by multiple teams or external partners:

```json
{
  "data": {
    "id": "01JQVKX3...",
    "name": "John Doe",
    "_links": {
      "self": { "href": "/v1/users/01JQVKX3..." },
      "orders": { "href": "/v1/users/01JQVKX3.../orders" }
    }
  }
}
```

### 13.2 HATEOAS Rules

1. [SUGGESTED] Use `_links` with relation names following IANA link relation types where applicable.
2. [SUGGESTED] Always include a `self` link on every resource.
3. [SUGGESTED] Do not over-engineer: HATEOAS adds value for public APIs with diverse clients; it is overkill for tightly coupled internal microservice APIs.

---

## 14. Health Check and Observability

### 14.1 Health Check Endpoint

[MANDATORY] Expose a health check endpoint:

```
GET /health
→ 200 OK

{
  "data": {
    "status": "healthy",
    "version": "1.2.3",
    "timestamp": "2025-04-01T12:00:00Z"
  }
}
```

### 14.2 Observability Rules

1. [MANDATORY] Generate a unique `X-Request-Id` for every request (if not provided by the client). Return it in the response and include it in all logs.
2. [MANDATORY] Log the following for every request: method, path, status code, latency, request ID.
3. [PREFERRED] Propagate distributed tracing headers (`traceparent`, `tracestate`) per W3C Trace Context specification.
4. [PREFERRED] Expose Prometheus-compatible metrics at `/metrics` (not publicly accessible).

---

## 15. Documentation

### 15.1 API Specification

1. [MANDATORY] Maintain an OpenAPI 3.x specification as the single source of truth.
2. [MANDATORY] Every endpoint must include: summary, description, request schema, response schema (all status codes), and at least one example.
3. [PREFERRED] Use `$ref` to avoid schema duplication.
4. [PREFERRED] Generate client SDKs from the OpenAPI spec, not hand-written.

### 15.2 Changelog

1. [PREFERRED] Maintain a changelog for the API documenting all changes per version.
2. [MANDATORY] Document breaking changes clearly with migration guides.

---

## 16. Checklist

### 16.1 Endpoint Design Checklist

- [ ] URL uses kebab-case, plural nouns, no verbs
- [ ] URL depth does not exceed 3 levels
- [ ] Correct HTTP method for the operation
- [ ] Query parameters use camelCase
- [ ] Default sort order is deterministic with a tie-breaker

### 16.2 Response Design Checklist

- [ ] Unified envelope: `data` / `error` / `pagination` as top-level fields
- [ ] JSON fields use camelCase
- [ ] Dates in ISO 8601 format
- [ ] No `null` fields — omit absent fields instead
- [ ] Pagination included for all collection endpoints
- [ ] `meta` with `requestId` included in both success and error responses
- [ ] All validation errors returned at once, not one by one

### 16.3 Security Checklist

- [ ] HTTPS only, no HTTP
- [ ] Bearer token authentication via `Authorization` header
- [ ] Security headers set (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Cache-Control`)
- [ ] Rate limiting with `429` and `Retry-After`
- [ ] Request body size limit enforced
- [ ] String field max lengths enforced
- [ ] No stack traces, SQL, or internal paths in error responses

### 16.4 Operational Checklist

- [ ] Health check endpoint at `/health`
- [ ] `X-Request-Id` generated and returned for every request
- [ ] Request logging: method, path, status, latency, request ID
- [ ] OpenAPI 3.x spec maintained and up to date
- [ ] Breaking changes documented with migration guide

---

*Standard Version: 2.0.0*
*Updated: 2026-04-02*
