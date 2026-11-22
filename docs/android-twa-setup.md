# EduPulse PRO — browser-only Android TWA packaging

## Architecture

Keep the existing production app as one `index.html` file on Vercel. The Android app is a Trusted Web Activity wrapper that opens `https://edupulse.cc.cd/`; it does not port the app to React, Next.js, or a multi-page native implementation.

## Repository and deployment safety

This setup is being prepared on branch `android-twa-prep`, not `main`. It does not change the live Vercel deployment until you merge the branch. Existing `icons/` files are reused.

The uploaded `index.html` snapshot needs a separate structural review before any redeployment: it contains a premature body close and content after the final `</html>`. The live domain renders, so confirm the deployed version before replacing it.

## PWA manifest and service worker

- The manifest uses `https://edupulse.cc.cd/`, a standalone display, and `orientation: any` so landscape and portrait remain available.
- The maskable icon path is `/icons/maskable-512.png`, which exists in this repository. The old manifest pointed to `/icons/icon-maskable-512.png`, which does not appear in the repo's icon listing.
- The service worker increments the EduPulse cache version, preserves offline caching of `raw.githubusercontent.com` content and known static CDNs, and avoids caching Supabase, AI, auth, and API responses.
- It only deletes old `edupulse-` caches, not caches owned by unrelated apps.

## Build in a browser with GitHub Codespaces

1. Open this repository on GitHub: https://github.com/sakuniijiii-byte/Edupulse
2. Switch to branch `android-twa-prep`.
3. Select **Code → Codespaces → Create codespace on android-twa-prep**. This opens a cloud Linux machine in your browser; no personal computer or Android Studio install is needed.
4. In the Codespaces terminal run:

   ```bash
   npm install -g @bubblewrap/cli
   rm android/README.md
   bubblewrap init --manifest=https://edupulse.cc.cd/manifest.json --directory=android
   ```

5. In the wizard confirm:
   - Package ID: `com.edupulse.pro`
   - App name: `EduPulse PRO`
   - Host: `edupulse.cc.cd`
   - Start URL: `/?source=android`
   - Display: `standalone`
   - Orientation: `any`
   - Target SDK: use the current Bubblewrap template (currently compile/target SDK 36).
6. Allow Bubblewrap to install the JDK and Android SDK dependencies if prompted. Let Bubblewrap create a new upload keystore because this is a new Play Store app. Choose strong unique passwords.
7. **Immediately download and safely back up the generated keystore** and record its alias and passwords in a password manager. Do not commit the keystore, passwords, or signing credentials to GitHub.
8. Commit the generated Android project files and `twa-manifest.json` to this branch, but leave the keystore out. Put the keystore file in `android/keys/edupulse-upload.jks` only in the cloud build workspace, restored from GitHub Actions secrets by the workflow.
9. Create the four repository Actions secrets:
   - `EDUPULSE_KEYSTORE_BASE64`: base64 of the upload keystore bytes
   - `EDUPULSE_KEYSTORE_PASSWORD`
   - `EDUPULSE_KEY_PASSWORD`
   - `EDUPULSE_KEY_ALIAS`
10. Open **Actions → Build EduPulse PRO TWA AAB → Run workflow**. Download the `edupulse-pro-android-release` artifact from the successful run. It contains the signed AAB for Play Console and APK for device testing.

If the Codespaces session is deleted before the keystore has been backed up, you may permanently lose the ability to update the app with the same upload key. Back it up before closing the session.

## Digital Asset Links

After the signing key is final, obtain its SHA-256 certificate fingerprint and publish `/.well-known/assetlinks.json` with:

- package name: `com.edupulse.pro`
- relation: `delegate_permission/common.handle_all_urls`
- fingerprint: the SHA-256 fingerprint of the certificate used by the upload key when building the TWA

Do not deploy a placeholder fingerprint. Verify the endpoint and TWA association before release. If Play App Signing is enabled, ensure the asset links configuration also accounts for the app-signing certificate used by Google Play where required.

## Play Store

Create a Play Console account when ready. Google currently lists a one-time US$25 developer registration fee. New personal developer accounts created after 13 November 2023 must complete a closed test with at least 12 opted-in testers for 14 continuous days before applying for production access. Check the current Play Console checklist for account-specific requirements.

Upload the signed `.aab`, not just the APK. Complete the store listing, privacy policy, Data Safety, content rating, app access instructions, and user-generated-content moderation declarations before review.

## Security

- Never commit a keystore, private key, passwords, Supabase service-role key, or private API credentials.
- Keep Supabase client access limited to the publishable/anon key and enforce Row Level Security.
- A TWA is a website wrapper; web bugs, unavailable APIs, and web outages remain app bugs/outages too.
