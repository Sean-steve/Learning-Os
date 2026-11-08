# Learning OS — Phase 5: Assessments, Evidence, Progress & Adaptive Coaching

## Implementation and scope

Phase 5 replaces the previous demo Assessments, Analytics and Coach screens with a shared evidence-driven workspace. It retains the existing UI routes so existing navigation and Phase 1–4 deep links continue to work.

1. **Assessments:** three curated 3-question banks; confidence before feedback; complete-answer validation; graded results and explanations; local attempt history and retakes. Existing three-question Week 01 assessment remains compatible with the Phase 1 test.
2. **Mastery model:** a single passing quiz is not mastery. A repeated knowledge gate requires >=80% on at least two distinct UTC dates. A practice note is explicitly self-reported. Independent verification is not implemented, and there is no local way to assert one. Custom skills and outcomes are supported without pretending a questionnaire exists.
3. **Progress intelligence:** sessions and minutes only count when explicitly marked complete; test accuracy is based only on actual answers; evidence ledger shows knowledge checks, documented practice, unverified claims, and retrieval due dates. No simulated data.
4. **Coaching:** deterministic, explainable offline recommendations prioritize due reviews and poor performance; low rest ratings shrink the proposed session. Scheduled actions require a click and use Phase 4 constraints/quiet hours/active weekdays/other sessions. The system never auto-marks learning or invents external proof.
5. **Optional private AI interpretation:** Bun `POST /v1/mastery/ai-review`, loopback-only and origin-checked, disabled when no `OPENAI_API_KEY`. Only 7 numeric aggregate metrics are accepted. Never transmit journal content, goal/source titles, skill names or raw media. No public AI API is deployed on GitHub Pages.

## Trust and privacy boundaries

- GitHub Pages is a static frontend. Assessments, practice notes and local skill definitions are in browser localStorage (`los.phase5.*`), shared only across tabs of the same origin. **No cross-device durability**. Clearing browser data deletes them.
- The UI never certifies paranormal claims, clinical outcomes or external verifier status. “Practice-documented” only means user-supplied observations exist. The independent review stage remains unavailable until a separate trust model and backend workflow exist.
- Existing Google Calendar OAuth (Phase 4) is separately configured on a private Bun backend; this phase does not authorize edits to the user's actual calendar. Coaches may add a new *local* session after approval.
- The optional AI endpoint must not be deployed publicly without authentication, durable rate limits, audit, data-retention policy, and abuse controls. It is not live-provider-certified.
- This phase does not add PostgreSQL. Production authentication and persistence are later phases.

## Validation gates

- `npm ci`
- `npm run check:phase5`
- `npm run test:core` (includes Phase 5 unit tests)
- `npm run typecheck`
- `npm run build`
- `GITHUB_PAGES=true npm run build && node scripts/check-pages.mjs`
- `npm run test:e2e` (desktop + mobile Chromium)
- Confirm Phase 1–4 regressions and main CI on merge, then Pages deployment success.

## Not yet proven

Human expert evaluation of assessment content; psychometric calibration; auth and SQL persistence; live AI provider behavior; external verification; accessibility WCAG audit; Firefox, Safari and physical-device testing. Those are distinct release gates, not claimed complete by the prototype CI.
