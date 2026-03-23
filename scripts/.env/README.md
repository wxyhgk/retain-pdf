# Local Secrets

Put local tokens in this directory.

Current convention:

- `mineru.env`
  Contains `MINERU_API_TOKEN=...`

Notes:

- real `*.env` files in this directory are ignored by git
- this directory is only for local development secrets
- CLI `--token` values still override file-based secrets
