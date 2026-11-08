# Learning OS

AI-powered, audio-first, adaptive learning and skill-development platform.

## Stack
- React 19 + TypeScript + Vite frontend
- TypeScript + Bun backend foundation
- PostgreSQL planned for durable persistence
- Standalone application with optional Human Operating System integration

## Status
Phase 1 delivered as an offline ZIP; Phase 1.1 is repository import, local build verification and UI certification. The original source package is available from the corresponding ChatGPT conversation. Full frontend source import and CI verification must be completed before certification.

## Development
After importing the Phase 1 source archive into this repository:

```bash
npm install
npm run check:phase1
npm run typecheck
npm run build
npm run dev
```

The initial UI uses local browser storage and demo lessons. Cloud AI, Google Calendar sync and PostgreSQL persistence are later phases.

## Safety and provenance
The first reference curriculum covers lucid dreaming and related subjective sleep experiences. Extraordinary-ability claims are tracked as hypotheses, not validated product outcomes.
