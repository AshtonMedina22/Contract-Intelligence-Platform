# Drive staging (F8)

**Vault remains Supabase Storage.** Google Drive is import/source + human working-proposal collaboration only.

## Folders (public / editor — operator-owned)

| Role | Folder ID | URL |
| --- | --- | --- |
| LP Intelligence Platform | `1_I4Kt4uKTSX0934q6mJEErNLKz8yxYvF` | https://drive.google.com/drive/folders/1_I4Kt4uKTSX0934q6mJEErNLKz8yxYvF |
| Test Documents | `16OAYM97haJkn2zyBnKnh7L8RouSqtGfc` | https://drive.google.com/drive/folders/16OAYM97haJkn2zyBnKnh7L8RouSqtGfc |

## Agent access status (F8 session)

- Folders are **viewable** without login (list + public file download).
- Automation browser is **not signed in** → **cannot create/upload** without OAuth.
- `GOOGLE_DRIVE_ACCESS_TOKEN` is **unset** in `apps/web/.env.local`.
- Local corpus: `docs/pilot/acquired/` (**33 PDFs**) staged under `corpus-to-upload/` for one-shot upload when a token is available.
- Already on Drive (Test Documents): MHMR 25-003 tabulation PDF + “L&P Pilot Corpus — Source Links & Download Queue” Google Doc.

## Upload when token available

```bash
# OAuth bearer with drive.file (or drive) scope — never commit
# apps/web/.env.local → GOOGLE_DRIVE_ACCESS_TOKEN=ya29....

# Platform folder (default)
python scripts/upload-pilot-acquired-to-drive.py

# Test Documents folder
set GOOGLE_DRIVE_FOLDER_ID=16OAYM97haJkn2zyBnKnh7L8RouSqtGfc
python scripts/upload-pilot-acquired-to-drive.py

# Both folders
python scripts/upload-pilot-acquired-to-drive.py --both
```

Same token powers F8 Google Docs working-proposal create/sync when Docs scopes are included (`documents` + `drive.file`).

## Working proposals (app path)

Submission → Generate working proposal → Sync Google Doc (server-side provider). Idempotent per content hash unless force-new. No credentials in the browser.
