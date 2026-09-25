---
name: security-review
description: OWASP and input validation for auth and endpoints
---

# Security Review

## Purpose
Prevent OWASP Top 10 via validation.

## Procedure
- Validate all inputs with Zod
- No secrets in code or logs
- Check JWT/HMAC

## Rules
- Never trust user input
- Block secrets via scan
