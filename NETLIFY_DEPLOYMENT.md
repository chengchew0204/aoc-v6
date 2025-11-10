# Netlify Deployment Checklist

## Issue: API routes returning 404

### 1. Environment Variables on Netlify

Make sure ALL these environment variables are set in Netlify Dashboard:
- Go to: Site settings → Environment variables
- Add:
  - `LIVEKIT_URL` (should be `wss://your-livekit-server.livekit.cloud`)
  - `LIVEKIT_API_KEY` 
  - `LIVEKIT_API_SECRET`
  - `NEXT_PUBLIC_LIVEKIT_URL` (same as LIVEKIT_URL)
  - `OPENAI_API_KEY`

### 2. Build Settings

In Netlify Dashboard → Site settings → Build & deploy:
- **Build command**: `npm run build`
- **Publish directory**: `.next`
- **Functions directory**: (leave blank, plugin handles this)

### 3. Plugin Installation

The `@netlify/plugin-nextjs` should be automatically detected from package.json.

Check build logs for:
```
@netlify/plugin-nextjs: Plugin loaded
```

### 4. Rebuild

After setting environment variables:
1. Go to Deploys tab
2. Click "Trigger deploy" → "Clear cache and deploy site"
3. Wait for build to complete
4. Check build logs for any errors

### 5. Verify Deployment

After successful build, check:
1. Browse to: `https://your-site.netlify.app/api/game/check-config`
2. Should return JSON with environment variable status
3. If 404, check build logs for function creation

### 6. Common Issues

**If API routes still return 404:**
- Check if functions were created: Netlify Dashboard → Functions tab
- You should see functions like `___netlify-handler`
- If no functions exist, the Next.js build failed to create them

**Check build logs for:**
```
@netlify/plugin-nextjs - Setting up functions
```

If not present, the plugin isn't working correctly.

### 7. Alternative: Update Plugin Version

If still failing, try updating the plugin:
```bash
npm install --save-dev @netlify/plugin-nextjs@latest
git add package.json package-lock.json
git commit -m "Update Netlify Next.js plugin"
git push
```

### 8. Test Locally with Netlify CLI

```bash
npm install -g netlify-cli
netlify dev
```

This simulates Netlify's environment locally.

