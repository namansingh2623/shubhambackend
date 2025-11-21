# Fixing Deploy Script for Divergent Branches

## Problem
After force-pushing to reset `main` to an earlier commit, the EC2 server's local branch has diverged from `origin/main`, causing the deploy script to fail.

## Quick Fix (On EC2 Server)

SSH into your EC2 server and run these commands:

### For Backend (blog):
```bash
cd /path/to/blog
git fetch origin main
git reset --hard origin/main
```

### For Frontend (if on server):
```bash
cd /path/to/frontend
git fetch origin main
git reset --hard origin/main
```

## Permanent Fix - Update deploy.sh

Replace the git pull commands in your `deploy.sh` script with this safer version:

### Option 1: Reset on Divergence (Recommended)
```bash
# Instead of: git pull origin main
# Use this:
git fetch origin main
git reset --hard origin/main
```

### Option 2: Force Pull with Merge Strategy
```bash
# Instead of: git pull origin main
# Use this:
git fetch origin main
git reset --hard origin/main || git pull origin main --no-rebase
```

## Updated deploy.sh Template

```bash
#!/bin/bash

set -e

echo "=== Starting Deployment ==="

# Backend
cd blog
echo "Updating Backend..."
git fetch origin main
git reset --hard origin/main
echo "✅ Backend updated"

# Frontend (if on same server)
if [ -d "../shubhamReact/naman" ]; then
    cd ../shubhamReact/naman
    echo "Updating Frontend..."
    git fetch origin main
    git reset --hard origin/main
    echo "✅ Frontend updated"
fi

# Restart services
# pm2 restart all
# or docker-compose restart
# etc.

echo "=== Deployment Complete ==="
```

## Why This Happens

When you force-push to reset a branch:
- Remote (`origin/main`) is reset to an earlier commit
- Local server branch still has the newer commits
- Git sees them as "divergent" (different history)
- Regular `git pull` fails because it doesn't know how to merge

## Solution

Using `git reset --hard origin/main`:
- Discards local commits that aren't on remote
- Makes local branch match remote exactly
- Perfect for deployment scenarios where server should match remote

## Important Notes

⚠️ **Warning**: `git reset --hard` will discard any local changes on the server. This is usually what you want for deployments, but make sure:
- No important uncommitted work on server
- All changes are in git (committed and pushed)
- You're okay with server matching remote exactly

## Alternative: Use deploy.sh.fixed

I've created a `deploy.sh.fixed` file with a safer version that:
- Checks for divergence
- Only resets when needed
- Provides better error messages
- Handles edge cases

Copy this to your server and use it instead.

