# Project instructions

This is the ZJU campus guide course prototype. Follow the final rules in `docs/project-requirements-v0.3.md` and the user's later instructions. The user explicitly requested populating the third module from their supplied public-account collection on 2026-10-08. Maintain the populated account/site directory and sourced guide dataset; distinguish collected material from officially checked details, and retain source rows, screenshot mappings and collection notes.

## Current local content work

The user approved integrating the seven reviewed campus-card guides on 2026-10-09. On 2026-10-13 the user restored GitHub synchronization after the collaborator invitation: review and test local changes, preserve teammate commits, and push to the configured origin. This supersedes the earlier local-only restriction. Publishing the hosted website still requires a separate request; Git synchronization does not imply website deployment. Email and profile cloud changes must follow their separately authorized rollout and verification steps.

## GitHub collaboration

The user requested a public GitHub repository on 2026-10-08 and authorized keeping subsequent development in this project synchronized there.

The user authorizes connecting their selected GitHub account and uploading this project to the public repository https://github.com/hz9404807-ctrl/zju-campus-guide. Keep subsequent development synchronized with that repository configured as `origin`. Account recovery or support contact is outside this task.

- After completing requested development, run the relevant existing checks, review the changes, commit them with a clear message, and push to the configured `origin` repository.
- Include source, documentation, dependency lockfiles, migrations, and relevant tests in the same reviewable change.
- Before pushing, check the remote state. Integrate teammates' changes safely; do not force-push, overwrite remote work, or discard unrelated local edits.
- If authentication or permissions prevent synchronization, preserve the local commit and report that it has not been pushed.
- Keep real environment files, credentials, `node_modules`, build output, caches, screenshots, and temporary tools out of Git. `.env.example` must contain no real credentials.

## Current verification boundary

The group leader created and connected a real Supabase project on 2026-10-08. Seventeen live service checks and browser upload/publication/rating/session-refresh checks passed; see docs/development-status.md. Two independent origins in one browser were verified, but Sites production deployment succeeded with public access at https://zju-campus-guide.sangnuo0808.chatgpt.site. Physical cross-device, other-browser, real network-failure and production end-to-end checks remain pending. Keep all credentials and local environment files out of Git; never substitute local storage or sample data for shared service writes.
