# Creative Finance (bank)

## Git Workflow

- Default branch: `prod`
- **Always fetch and pull before branching:**
  ```bash
  git fetch origin
  git checkout prod
  git pull origin prod
  ```
- **Create feature branches from up-to-date `prod`:**
  ```bash
  git checkout -b feature/<description> prod
  ```
- **Branch naming:** `feature/*`, `fix/*`, `chore/*`
- **Rebase before pushing:**
  ```bash
  git fetch origin
  git rebase origin/prod
  ```
- **Never commit directly to `prod`** — always use feature branches + PRs
