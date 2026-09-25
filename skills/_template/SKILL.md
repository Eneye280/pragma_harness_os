---
name: _template
description: Plantilla base para una skill nativa del harness
triggers: [palabra, otra-palabra]
priority: 99
---

# Nombre de la Skill

## When to use
Describe en una frase cuándo el harness debe compilar esta skill (tipo de
tarea, dominio, o palabras que la disparan).

## Procedure
1. Primer paso concreto y accionable.
2. Segundo paso: cómo verificar que el anterior salió bien.
3. Tercer paso: qué dejar listo antes de continuar.

## Rules
- Regla dura que el agente no debe violar.
- Otra regla verificable por un gate o un test.

## Anti-patterns
- Lo que se ve tentador pero rompe el sistema.
- El atajo que genera deuda técnica.

## Done when
Criterio objetivo de cierre (tests en verde, cobertura, sin secretos, etc.).

<!--
Cómo crear una skill:
1. Copia este directorio a skills/<mi-skill>/.
2. Rellena el frontmatter: name (igual al directorio), description, triggers, priority.
3. Mapea un "need" del classifier a esta skill en
   apps/desktop/src/main/harness/skills/skill-compiler.ts (NEEDS_TO_SKILL).
4. El SkillCompiler la resolverá y compilará en el bloque pre-agent.
-->
