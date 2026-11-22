# Git Commit and Push Rules (PHANTOM Project Review)

Whenever the user asks to commit or push code to GitHub, follow these steps strictly in order:

1. **Inspect & Protect First:**
   - Run `git status` and review `git diff` to see all uncommitted changes.
   - Verify `.gitignore` blocks `.env`, API keys, `node_modules`, `__pycache__`, `dist`, `build`, and `.next`. If any sensitive or generated files are untracked, add them to `.gitignore` before staging anything.

2. **Split Into Logical Commits:**
   - Never dump unrelated changes into one massive commit.
   - Group changes by feature, bug fix, or component (e.g., UI layout in one commit, API logic in another).

3. **Write Natural, Specific Commit Messages:**
   - Stage only the files for each logical group using `git add <file1> <file2>`.
   - Use Conventional Commits (`feat:`, `fix:`, `style:`, `refactor:`, `docs:`, `chore:`) with a subject line under 60 characters.
   - Describe the exact change in plain, everyday English (e.g., `feat: add player jump physics and gravity`). Avoid vague AI phrases like "implement core functionality" or "update codebase".

4. **Push Safely:**
   - Run `git log -n 5 --oneline` to verify the commit history looks clean.
   - Run `git push` to upload changes to GitHub.

5. **Strict Prohibitions:**
   - NEVER use `git commit --amend`, `git rebase`, `git reset --hard`, or `git push --force`.
   - NEVER modify or rewrite existing commit history or timestamps.
   - If a push or merge fails, stop immediately and ask the user before running any recovery commands.
