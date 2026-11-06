# Notes fork of Docmost (beetz12/docmost)

David's personal notes app: Docmost plus features built from a clean-room spec
(`~/Work/skunkworks/research/notes-app/affine-feature-spec.md` on David's Mac).

Rules for this fork:
- Clean room: build only from the spec and Docmost's own code. Never open, search or copy the AFFiNE repository.
- Never enable, import or copy from Docmost's `ee/` folders (Docmost Enterprise licence). Our versions live outside `ee/`.
- Our code lives in separate modules (`apps/server/src/notes/`, `apps/client/src/notes/`) and our own tables, so `upstream` can still be merged.
- PRs go to `beetz12/docmost`, never to `docmost/docmost`.

## Run it locally

```bash
scripts/notes/init-env.sh          # writes a gitignored .env with generated secrets
docker compose -f docker-compose.notes.yml up -d --build
```

Open http://localhost:3000 and create the workspace (the first account is the owner).
Ports bind to 127.0.0.1 by default. To reach it from other devices on the tailnet, set
`BIND_ADDR` to the machine's Tailscale IP in `.env`. Never bind 0.0.0.0 on a public interface.

## Pull upstream updates

```bash
git fetch upstream && git merge upstream/main
```
