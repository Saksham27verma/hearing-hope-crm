# Git repos: CRM + mobile (separate)

See the same guide in the workspace: `../REPOS_SETUP.md`.

## Web CRM (this repo)

- **Remote:** `https://github.com/Saksham27verma/hearing-hope-crm.git`

```bash
git push origin main
```

**If `git push` seems to do nothing:** wait 1–2 minutes on slow networks; avoid Ctrl+C unless you mean to cancel.

**HTTPS password:** Use a [GitHub Personal Access Token](https://github.com/settings/tokens), or SSH:

```bash
git remote set-url origin git@github.com:Saksham27verma/hearing-hope-crm.git
git push origin main
```

**Behind remote:**

```bash
git pull origin main --rebase
git push origin main
```

## Mobile app (`hearing-hope-mobile`)

Separate Git repo. Create an empty GitHub repo, then:

```bash
cd ../hearing-hope-mobile
git remote add origin https://github.com/Saksham27verma/hearing-hope-mobile.git
git push -u origin main
```

`.env` is gitignored; use `.env.example` as a template.

## Home-folder Git on macOS

If `git status` at `~` shows random Desktop files, open **this folder** or `hearing-hope-mobile` as the project root in your editor so Git uses the correct `.git` directory.
