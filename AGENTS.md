# Project instructions

This is the ZJU campus guide course prototype. Follow the final rules in `docs/project-requirements-v0.3.md` and the user's later instructions. Keep the third module as a placeholder and keep unverified guides clearly marked as examples.

## GitHub collaboration

The user requested a public GitHub repository on 2026-10-08 and authorized keeping subsequent development in this project synchronized there.

The user authorizes connecting their selected GitHub account and uploading this project to the public repository https://github.com/hz9404807-ctrl/zju-campus-guide. Keep subsequent development synchronized with that repository configured as `origin`. Account recovery or support contact is outside this task.

- After completing requested development, run the relevant existing checks, review the changes, commit them with a clear message, and push to the configured `origin` repository.
- Include source, documentation, dependency lockfiles, migrations, and relevant tests in the same reviewable change.
- Before pushing, check the remote state. Integrate teammates' changes safely; do not force-push, overwrite remote work, or discard unrelated local edits.
- If authentication or permissions prevent synchronization, preserve the local commit and report that it has not been pushed.
- Keep real environment files, credentials, `node_modules`, build output, caches, screenshots, and temporary tools out of Git. `.env.example` must contain no real credentials.

## Current verification boundary

The shared-service code and local checks are prepared, but the group leader's Supabase project creation is intentionally deferred. Do not claim that real anonymous authentication, uploads, or cross-device sharing have passed until they are actually tested against that project. Do not substitute local storage or sample data for shared service writes.
