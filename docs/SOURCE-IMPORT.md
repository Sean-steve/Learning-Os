# Import the original Phase 1 source ZIP

The original Phase 1 archive is available from the Learning OS conversation.
This GitHub connection supports repository file writes but no ZIP import.
Import the archive without nesting its outer folder:

```bash
unzip learning-os-phase1.zip
cd learning-os-phase1
npm install
npm run check:phase1
npm run typecheck
npm run build
git init
git remote add origin https://github.com/Sean-steve/Learning-Os.git
git fetch origin
git checkout -b phase/1.1-repository-ui-certification origin/phase/1.1-repository-ui-certification
git add .
git commit -m "feat: import Learning OS Phase 1 frontend and Bun API"
git push -u origin phase/1.1-repository-ui-certification
```

Git commands assume an appropriately authenticated GitHub account; do not commit
.env values, credentials, node_modules or build artifacts. Review any checkout
overwrites before proceeding.
