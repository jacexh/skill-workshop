---
name: REST API Design Standards
description: RESTful naming, HTTP status codes, pagination, and error response conventions
---

## URL Naming

- Use kebab-case for URL paths: `/user-profiles`, not `/userProfiles` or `/user_profiles`
- Resources are plural nouns: `/users`, `/orders`, not `/user`, `/order`
- Nested resources for ownership: `/users/{id}/orders`
- Actions that don't map to CRUD use verb phrases under `/actions`: `/orders/{id}/actions/cancel`

## HTTP Status Codes

- `200 OK` — successful GET, PUT, PATCH
- `201 Created` — successful POST that creates a resource; include `Location` header
- `204 No Content` — successful DELETE
- `400 Bad Request` — malformed request or validation failure; include error details in body
- `401 Unauthorized` — missing or invalid authentication
- `403 Forbidden` — authenticated but not authorized
- `404 Not Found` — resource does not exist
- `409 Conflict` — state conflict (e.g., duplicate creation)
- `422 Unprocessable Entity` — semantically invalid request
- `500 Internal Server Error` — unexpected server failure; never leak stack traces

## Error Response Body

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable description",
    "details": [{ "field": "email", "issue": "invalid format" }]
  }
}
```

## Pagination

- Use cursor-based pagination for large or frequently-updated collections
- Response includes `data` array and `pagination` object: `{ "cursor": "...", "has_more": true }`
- Page size default: 20, maximum: 100; controlled by `limit` query param
