---
name: security-review
description: OWASP Top 10, input validation and secret handling
triggers: [auth, oauth, jwt, security, password, token, supabase, hmac]
priority: 1
---

# Security Review

## When to use
Cualquier cambio que toque autenticación, autorización, entrada del usuario,
secretos o integraciones externas.

## Procedure
- **Validación** — valida toda entrada con Zod en el borde del sistema;
  rechaza lo que no cumple el esquema en vez de sanear a ciegas.
- **Autorización** — verifica el permiso en el servidor, no en el cliente;
  nunca confíes en un rol enviado por el usuario.
- **Secretos** — llaves solo por variables de entorno; jamás en código,
  tests, logs ni en el EventLog.
- **OWASP** — revisa inyección (SQL/command), XSS, SSRF, deserialización
  insegura, dependencias vulnerables y rate limiting en endpoints públicos.
- **Criptografía** — HMAC/JWT con algoritmos fuertes y comparación de tiempo
  constante para tokens.

## Rules
- Nunca confíes en input del usuario ni en headers del cliente.
- Bloquea el pipeline si aparece un patrón de secreto (plugin `secret-scan`).
- Errores al cliente sin filtrar stack traces ni detalles internos.

## Anti-patterns
- Validar en el cliente y asumir que el servidor ya está protegido.
- Concatenar SQL en lugar de usar consultas parametrizadas.
- Loggear el cuerpo completo de requests con credenciales.

## Done when
Las entradas están validadas, la autorización se evalúa en servidor, no hay
secretos en el diff y los casos de abuso tienen test.
