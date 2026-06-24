# Detailed Guide: Deploying and Running the FixMyCity APK

Follow these instructions step-by-step to push your code, trigger the cloud APK compilation, download the artifact, and run it on your mobile device.

---

## Step 1: Add Environment Variables to GitHub Secrets

Because GitHub Actions runs in a secure sandbox in the cloud, it does not have access to your local `.env` file. You must provide these variables as secrets so the bundle compiles with Google Maps, Firebase, and Gemini access active.

1. Copy the values of the following parameters from your local **`.env`** file:
   - `VITE_GEMINI_API_KEY`
   - `VITE_GOOGLE_MAPS_API_KEY`
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

2. Open your web browser and navigate to your **GitHub Repository** page.
3. Click on the **Settings** tab (gear icon at the top menu of the repository).
4. In the left sidebar, expand **Secrets and variables** and click **Actions**.
5. Click the green button: **New repository secret**.
6. Enter the name (e.g. `VITE_GEMINI_API_KEY`) in the **Name** field, paste the corresponding value in the **Secret** box, and click **Add secret**.
7. Repeat this for all 8 environment parameters listed above.

---

## Step 2: Push your Changes to GitHub

To trigger the cloud compilation workflow, you need to push the files to your remote repository.

Open your local terminal and execute the following Git commands in order:

```bash
# 1. Stage all changes (Capacitor configurations, workflows, and React updates)
git add .

# 2. Commit the changes
git commit -m "feat: configure capacitor wrapper and cloud apk compile workflow"

# 3. Push to your main branch
git push origin main
```

---

## Step 3: Monitor the Actions Run

Once pushed, GitHub Actions automatically detects the build workflow file and starts the compile worker.

1. Go back to your repository page on GitHub in your browser.
2. Click the **Actions** tab (play icon at the top menu).
3. Under the list, click on the active workflow named **"Build Android APK"** (usually marked with a yellow spinning circle).
4. Watch the step execution logs. The workflow runs through:
   - Installing Zulu JDK 17 and Node.js.
   - Restoring cache files.
   - Building the React web bundle.
   - Syncing files with Capacitor.
   - Running the Gradle wrapper compiler (`./gradlew assembleDebug`).
5. Once completed successfully, the spinning icon changes to a **green checkmark**.

---

## Step 4: Download and Transfer the APK

Once the workflow is finished, the generated APK file is uploaded as a downloadable artifact.

1. Click on the completed workflow run inside the **Actions** page.
2. Scroll down to the bottom of the page to the **Artifacts** panel.
3. Click on the link named **`fixmycity-debug-apk`**. This downloads a compressed zip file onto your computer.
4. Extract/unzip the file. Inside you will find:
   - **`app-debug.apk`**
5. Transfer this `app-debug.apk` file to your Android phone. You can do this by:
   - Connecting via a USB cable and copying it directly.
   - Uploading it to your Google Drive and downloading it on your phone.
   - Sending it to yourself via email or messaging apps (e.g., Slack, WhatsApp, Telegram).

---

## Step 5: Install and Run on Mobile

1. Open your phone's file explorer or downloads app, locate **`app-debug.apk`**, and tap it.
2. If prompted by Android security:
   - Allow "Installation from unknown sources" or "Install Unknown Apps" for your browser/file manager.
   - If Play Protect warns you that it is an unsigned app, tap **"Install Anyway"**.
3. Once installation completes, open the **FixMyCity** application on your device!

---

## Step 6: Verify Updates (Zero-rebuild Workflow)

To test the Live Web Wrapper integration:
1. Make a small text change locally (e.g., modify a header or class in a React component).
2. Commit and push it: `git push origin main`.
3. Wait for the Firebase hosting deploy workflow to finish deploying the new version.
4. Close and re-open the app on your phone. The change will reflect **instantly** without compiling a new APK!
