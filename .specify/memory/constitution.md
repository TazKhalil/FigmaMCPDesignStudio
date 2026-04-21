<!--
SYNC IMPACT REPORT
==================
Version change: 0.0.0 (all-placeholder template) → 1.0.0
Bump rationale: MAJOR — initial substantive governance document created from blank template;
  all six principles and all sections are net-new.

Modified principles: None (initial creation)
Added sections:
  - Core Principles I–VI (all new)
  - Technical Standards (new)
  - Agent Behavior (new)
  - Governance (filled from placeholder)

Templates updated:
  - .specify/templates/plan-template.md ✅ updated — Constitution Check gates now reference
    principles I, II, III, IV, V by name and number.
  - .specify/templates/spec-template.md ✅ updated — Figma MCP retrieval requirement added
    to UI feature requirements sections.
  - .specify/templates/tasks-template.md ✅ updated — accessibility and performance task
    types noted in Phase 2 Foundational and Polish phases.
  - .specify/templates/checklist-template.md ⚠ pending — no Figma-specific quality gates
    yet; flag for next constitution amendment.

Follow-up TODOs: None. All fields resolved from user input and Figma Make source.
-->

# Perceptiv Design Studio Constitution

## Core Principles

### I. Figma Make Is the Authoritative Reference (NON-NEGOTIABLE)

The Figma Make prototype at `https://www.figma.com/make/ZzjCw7mP1LFPjeKqkD5sog` is the
single source of truth for every visual and interaction decision — colors, typography,
spacing, shadows, motion, component shapes, and layouts.

Rules:
- Before writing or proposing ANY UI code, the Figma MCP (`get_design_context`) MUST be
  called to retrieve the current source files from the Make file. Memory of a prior MCP
  call is not acceptable; re-query each time.
- Styles, tokens, and component structures in production code MUST mirror the Make file
  source exactly. If a value does not appear in the prototype, it does not belong in
  production code.
- If the Make file and an external request conflict, the Make file wins. The conflict MUST
  be flagged explicitly; silent resolution is not permitted.
- Never introduce visual patterns, colors, typography, or component styles not present in
  the prototype.
- If a feature requires UI with no counterpart in the prototype, work MUST stop and the
  team MUST be consulted before proceeding.

Rationale: Perceptiv Design Studio is premium product-grade tooling used in front of
customers. Visual inconsistency or deviation from the prototype erodes perceived quality.

### II. Production-Quality Uplift Only (NON-NEGOTIABLE)

The production build adds engineering quality on top of the prototype. It MUST NOT regress
visual fidelity or change interaction behavior without explicit approval.

Production MUST add:
- Feature-folder project structure and clear separation of concerns.
- Real state management (Zustand), replacing prototype shortcuts.
- Mandatory test coverage for all new business logic.
- Accessibility audit and fixes: keyboard navigation, ARIA, focus management.
- Performance work: code splitting, Web Workers for heavy compute, lazy loading.
- Error boundaries, loading states, and empty states the prototype may have omitted.

Production MUST NOT add:
- Unrequested features, UI patterns, or design decisions.
- Style or layout deviations from the prototype, however minor.
- Architectural complexity not justified by a specific, articulated production need.

Rationale: The prototype already captures the product vision. Production engineering
uplifts execution quality, it does not reinvent the design.

### III. Accessibility is Non-Negotiable (NON-NEGOTIABLE)

Every feature shipped MUST meet WCAG 2.1 AA as a minimum.

Rules:
- All interactive elements MUST be keyboard-navigable with visible focus indicators.
- All non-decorative images and icons MUST have meaningful `alt` text or ARIA labels.
- Semantic HTML elements MUST be preferred over ARIA roles wherever applicable.
- Color contrast ratios MUST meet WCAG 2.1 AA (4.5:1 for normal text; 3:1 for large text).
- Focus management MUST be handled correctly in modals, dialogs, and side panels.
- Accessibility MUST be verified against the WCAG checklist before any task is marked done.

Rationale: Application engineers may use assistive technology. Accessibility failures
reflect directly on product quality and expose business risk.

### IV. Test-Driven Engineering

Tests are a first-class deliverable, not an afterthought.

Rules:
- Unit tests (Vitest + React Testing Library) are REQUIRED for all new business logic,
  state transitions, RF calculations, and utility functions.
- Playwright E2E tests are REQUIRED for every critical user flow (floor plan upload,
  gateway placement, sensor assignment, export).
- For complex logic — RF path-loss calculations, heatmap generation, floor-plan geometry —
  tests MUST be written before implementation (Red-Green-Refactor cycle).
- Test files MUST live adjacent to their source files or in a `__tests__/` sibling.
- No feature task is considered complete until all tests pass in CI.
- Coverage threshold: 80% on all new code.

Rationale: The prototype has zero tests. The production build MUST be the inverse of that.

### V. Performance-Conscious Architecture

Performance is a design constraint, not a post-shipping optimization pass.

Rules:
- Tool modules (Canvas, RF engine, export pipelines) MUST be lazy-loaded so the initial
  bundle remains small.
- Any computation that blocks the main thread for more than 16ms MUST be moved to a Web
  Worker. This includes RF path-loss calculations, heatmap generation, and floor-plan
  geometry processing.
- Canvas rendering logic MUST be isolated from React's render cycle.
- Bundle size increases MUST be justified in the PR description.
- No synchronous network or disk I/O on the main thread.

Rationale: Engineers use this tool in the field, potentially on underpowered hardware. A
laggy canvas during a customer demo is unacceptable.

### VI. Intentional Scope — Ask, Don't Assume

Scope creep and silent assumptions are the primary drivers of rework.

Rules:
- If any specification or plan is ambiguous, the agent MUST ask for clarification rather
  than assuming.
- Never invent scope that was not explicitly requested or clearly implied.
- Any divergence between the prototype source and production code MUST be surfaced as a
  documented flag (in the PR description or plan) for human review — never silently
  resolved.
- Refactoring MUST be scoped to what is directly needed for the current task. Opportunistic
  refactoring requires explicit approval.
- The README MUST be updated whenever routes or major architectural structures change.

Rationale: Perceptiv Design Studio serves a specific user persona with a known workflow.
Scope discipline keeps the product lean, predictable, and maintainable.

## Technical Standards

**Stack (locked to prototype):**
- React 18 + TypeScript (strict mode enabled)
- Vite 5 (build tooling)
- Tailwind CSS v4 (utility-first; token system mirrors `src/styles/theme.css` exactly)
- shadcn/ui + Radix UI (46 primitive components from prototype; do not replace or swap)
- Lucide React (icon set; do not introduce alternate icon libraries)
- MUI / Emotion present in prototype dependencies — use only where the prototype already
  uses them; do not expand MUI usage further.

**State Management:**
- Zustand for all cross-component state. Stores live in `src/app/store/`.
- Redux Toolkit is not permitted until Zustand is proven insufficient with documented
  justification.

**Testing Stack:**
- Vitest + React Testing Library — unit and component tests.
- Playwright — critical E2E user flows only.

**Code Style:**
- Functional components only. No class components.
- Custom hooks over higher-order components (HOCs).
- No default exports except route-level page components.
- ESLint + Prettier enforced on CI; no merges with lint errors.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`.

**Project Structure:**
```
src/
  app/
    components/
      ui/          # shadcn/ui primitives — mirror prototype, do not modify
    features/      # Feature modules (lazy-loaded route chunks)
    hooks/         # Shared custom hooks
    store/         # Zustand stores
    types/         # TypeScript types and domain constants (from prototype types.ts)
    workers/       # Web Worker scripts for heavy compute
    utils/         # Pure utility functions (rf-utils, geometry, etc.)
  styles/          # theme.css, tailwind.css — mirror prototype exactly
tests/
  unit/
  integration/
  e2e/             # Playwright tests
```

## Agent Behavior

- For any UI-related task, the Figma MCP (`get_design_context`) MUST be called to retrieve
  the current Make file source before writing production code. This is mandatory, not
  optional.
- Treat the prototype as a reference implementation: port and improve — fix bugs, add
  TypeScript types, improve accessibility — but do not alter visual output without an
  explicit instruction.
- Surface all prototype-vs-production divergences in a `## Prototype Divergences` section
  of the relevant plan or PR description. Never silently accept a divergence.
- If a task requires UI that does not exist in the prototype, stop and ask before writing
  any code.
- Do not add comments, docstrings, or type annotations to code that was not changed in the
  current task.
- Do not over-engineer. Only make changes directly requested or clearly necessary for
  production quality.

## Governance

This constitution supersedes all other documented practices and conventions for
Perceptiv Design Studio.

**Amendment Procedure:**
1. Propose the amendment as a PR against `.specify/memory/constitution.md`.
2. Describe the specific problem the amendment solves and which principle it affects.
3. Identify all templates and dependent documents requiring update.
4. Obtain at least one team-member review before merging.
5. Increment the version following the semantic versioning policy below.
6. Update the Sync Impact Report HTML comment at the top of this file.

**Versioning Policy:**
- MAJOR: Backward-incompatible governance change — principle removal or substantive
  redefinition that changes existing behavior.
- MINOR: New principle or section added, or materially expanded guidance.
- PATCH: Clarification, wording correction, or non-semantic refinement.

**Compliance Review:**
- Constitution compliance MUST be verified during PR review for every non-trivial change.
- The Constitution Check section in `plan-template.md` enforces gates before Phase 0
  research and again after Phase 1 design.
- Any PR that knowingly violates a principle MUST include an explicit justification and
  receive explicit approval — not just passing CI.

**Version**: 1.0.0 | **Ratified**: 2026-04-21 | **Last Amended**: 2026-04-21
