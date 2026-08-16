# Contributing to Abyssal Command

Thanks for helping improve the NEREID-7 interface. Contributions should preserve the project's immersive visual direction, server-authoritative simulation model, and responsive behavior.

## Development workflow

1. Fork the repository and create a focused branch from `main`.
2. Install dependencies with `npm install`.
3. Start the application with `npm run dev`.
4. Add or update tests for simulation and command behavior.
5. Run `npm run check` before opening a pull request.

## Pull requests

- Keep each pull request focused on one concern.
- Explain the operator-facing impact and technical approach.
- Include screenshots or a short recording for visual changes.
- Verify desktop and narrow viewport behavior for interface changes.
- Do not commit generated builds, local databases, credentials, or `.vercel` state.
- Update the README when commands, architecture, setup, or deployment behavior changes.

## Code conventions

- Use strict TypeScript and existing component patterns.
- Keep the Node.js server authoritative for simulation state.
- Prefer accessible semantic controls over clickable generic containers.
- Avoid unnecessary rendering work in the Three.js scene and telemetry loop.
- Preserve the existing visual language: compact instrumentation, deliberate motion, and high information density.

## Reporting issues

Use the repository issue templates and include reproduction steps, browser and operating-system details, expected behavior, and screenshots when relevant. Security reports must follow [SECURITY.md](SECURITY.md).
