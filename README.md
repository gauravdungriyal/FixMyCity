# Setup & Deployment Guide: FixMyCity PWA

Welcome to the **FixMyCity - Hyperlocal Problem Solver** platform. This application is a mobile-first Progressive Web App (PWA) with a live-updating APK setup built with React + Vite, Tailwind CSS, Google Maps JS API, Firebase (Firestore & Storage), and the Gemini 1.5 Flash API.

---

## 1. Prerequisites

Make sure you have [Node.js](https://nodejs.org/) (v18 or v20) installed on your computer.

---

## 2. Local Setup & Running

1. **Configure Environment Variables:**
   A template has been generated for you. Rename or copy `.env.example` to `.env` in the root folder, and fill in your keys:
   ```bash
   cp .env.example .env
   ```
   Modify the values inside `.env`:
   - `VITE_GEMINI_API_KEY`: Get a free API Key from [Google AI Studio](https://aistudio.google.com/).
   - `VITE_GOOGLE_MAPS_API_KEY`: Enable the **Maps JavaScript API** in your Google Cloud Console.
   - `VITE_FIREBASE_...`: Obtain these configurations by creating a web application in your Firebase console.

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   This will host the app at **`http://localhost:5173/`**.

---

## 3. GCP & Firebase Console Configuration

To enable real-time updates and image uploads, configure your GCP/Firebase project:

### Step 1: Create a Firebase Project
1. Open the [Firebase Console](https://console.firebase.google.com/) (which will leverage your GCP $300 credits).
2. Create a new project named `FixMyCity`.
3. Under the Project Overview, add a new **Web App**. Copy the configuration parameters (ApiKey, AuthDomain, ProjectId, etc.) into your local `.env` file.

### Step 2: Set Up Firestore Database
1. Go to **Build > Firestore Database** in Firebase Console and click **Create Database**.
2. Start in **Production Mode** or **Test Mode**.
3. Go to the **Rules** tab and paste the following security rules to allow read/write access:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true; // In production, refine rules based on authentication status
       }
     }
   }
   ```
4. Click **Publish**.

### Step 3: Set Up Cloud Storage for Photos
1. Go to **Build > Storage** in the Firebase Console and click **Get Started**.
2. Select your location and complete initialization.
3. Under the **Rules** tab, paste the following rules to allow image uploads:
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read, write: if true;
       }
     }
   }
   ```
4. Click **Publish**.

---

## 4. Application Routes (Mobile Viewports)

This application is designed **exclusively from a mobile phone perspective**.
* **Citizen Portal:** Access **`http://localhost:5173/`** directly. 
  - On desktop screens, the app automatically renders inside a mockup smartphone frame. 
  - To test the live camera scanner, open this URL directly on your phone's browser (both devices must be on the same Wi-Fi, using the local network IP provided in the Vite console).
* **Municipal Admin Portal (Secret URL):** Access **`http://localhost:5173/#/admin`** directly. 
  - Designed for workers in the field to manage tickets, update progress, and capture resolved "After" photos.

---

## 5. Deployment & PWA Configuration

To deploy the web app to GCP Firebase Hosting (enabling live updates in your installed APK):

1. **Install Firebase CLI globally:**
   ```bash
   npm install -g firebase-tools
   ```
2. **Log in to Firebase:**
   ```bash
   firebase login
   ```
3. **Initialize Firebase in the project:**
   ```bash
   firebase init
   ```
   - Choose **Hosting: Configure files for Firebase Hosting**.
   - Select **Use an existing project** and pick the project you created.
   - For public directory, type: `dist` (Vite's build output folder).
   - Configure as single-page app? **Yes**.
   - Set up automatic builds with GitHub? **Yes** (if you want GitHub Actions to automatically deploy code to the phone).
4. **Deploy Assets:**
   ```bash
   npm run build
   firebase deploy
   ```
   Firebase will output your live URL (e.g., `https://your-project.web.app`).

---

## 6. Build the Android APK (Bubblewrap CLI)

Google's **Bubblewrap** compiles PWAs into native Android APKs without requiring Android Studio.

1. **Install Bubblewrap globally on your computer:**
   ```bash
   npm install -g @bubblewrap/cli
   ```
2. **Initialize the Android Project wrapper:**
   *Make sure you have deployed your app to Firebase Hosting first.*
   ```bash
   npx @bubblewrap/cli init --manifest=https://your-project.web.app/manifest.json
   ```
   - Bubblewrap will ask to download JDK and Android SDK Command-Line tools. Type `y` (Yes) to let it download them automatically.
   - Follow the prompts to configure your APK package name (e.g., `com.fixmycity.app`), app launcher name, and signing key details.
3. **Build the signed APK:**
   ```bash
   npx @bubblewrap/cli build
   ```
4. **Install on Phone:**
   - Look in the generated files for `app-release-signed.apk`.
   - Transfer this file to your Android phone (via USB, email, or Google Drive) and open it to install the application.

*Once installed, any updates you push to GitHub or deploy to Firebase Hosting will automatically render live inside the installed APK on your phone, without needing to rebuild or reinstall the APK!*
