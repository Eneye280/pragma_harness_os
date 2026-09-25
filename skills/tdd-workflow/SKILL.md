---
name: tdd-workflow
description: Test-driven development with RED/GREEN/REFACTOR and 80% coverage
triggers: [feature, fix, test, tests, cobertura, coverage, tdd]
priority: 2
---

# TDD Workflow

## When to use
Toda feature o fix. El harness la inyecta cuando el intent es `feature`/`fix`
o cuando el mensaje menciona tests/cobertura.

## Procedure
1. **RED** — escribe el test que describe el comportamiento esperado y verifica
   que falla por la razón correcta (no por un error de sintaxis).
2. **GREEN** — implementa lo mínimo para que el test pase. Sin extras.
3. **REFACTOR** — limpia manteniendo los tests en verde. Nombres claros,
   sin duplicación, sin código muerto.
4. **Verify** — cobertura del módulo afectado >= 80%; corre el suite completo.

## Rules
- No escribas código de producción sin una prueba RED que lo justifique.
- Un commit por fase cuando el repo lo permita: `test:` (RED) → `fix:` (GREEN) → `refactor:`.
- Nunca bajes el umbral de cobertura para hacer pasar el pipeline.
- Los tests deben ser deterministas: sin reloj real, red o rutas absolutas.

## Anti-patterns
- Test que pasa sin haber fallado nunca (no prueba nada).
- Asserts múltiples por test que ocultan la causa del fallo.
- Mocks que replican la implementación en vez del contrato.

## Done when
Los tests nuevos cubren el caso feliz, el borde y el error; el suite pasa y la
cobertura es >= 80%.
