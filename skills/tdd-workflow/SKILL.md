---
name: tdd-workflow
description: Test-driven development with RED/GREEN/REFACTOR and 80% coverage
---

# TDD Workflow

## Purpose
Enforce RED/GREEN/REFACTOR for every feature/fix.

## Procedure
1. Write failing test (RED)
2. Implement minimal fix (GREEN)
3. Refactor keeping tests green
4. Verify 80% coverage

## Rules
- No production code without RED proof
- Checkpoint commits: test: RED -> fix: GREEN -> refactor
