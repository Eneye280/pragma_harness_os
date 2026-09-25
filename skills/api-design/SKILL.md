---
name: api-design
description: REST API design with Zod schemas, pagination and error contract
triggers: [api, endpoint, rest, route, fastify, pagination, openapi]
priority: 3
---

# API Design

## When to use
Al crear o modificar endpoints REST, contratos de datos o integraciones.

## Procedure
- **Contrato primero** — define el esquema Zod de request y response antes de
  escribir el handler; el tipo se deriva del esquema, no al revés.
- **Recursos** — URLs en plural y estables (`/users`, `/users/:id`); usa los
  verbos HTTP con su semántica (GET/POST/PATCH/DELETE).
- **Paginación** — cursor + limit por defecto; responde `{ data, nextCursor }`
  y nunca devuelvas la colección completa sin límite.
- **Errores** — forma única `{ error: { code, message, details? } }`; usa el
  status correcto (400 validación, 401 auth, 403 permiso, 404, 409, 429, 500).
- **Idempotencia** — POST con clave de idempotencia cuando el reintento sea
  posible; PATCH para cambios parciales.

## Rules
- Un esquema por endpoint, reutilizado en validación y documentación.
- Nada de strings SQL crudos; usa el query builder / ORM.
- Versiona cambios incompatibles; nunca rompas el contrato en silencio.

## Anti-patterns
- Devolver arrays sin paginar en tablas grandes.
- 200 OK con `{ success: false }` en vez de un status de error real.
- Exponer campos internos (hashes, ids de proveedor) en la respuesta.

## Done when
El contrato está validado, paginado y documentado, con tests de validación,
permiso y error en cada endpoint nuevo.
