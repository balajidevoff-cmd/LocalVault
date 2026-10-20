# LocalVault Android Build & Deployment Guide

This guide covers running and building the LocalVault Android client using Expo and React Native.

---

## 1. Network Configuration Essentials

> [!IMPORTANT]
> **Do not use `localhost` or `127.0.0.1` in the Android application.**
> On an Android device or emulator, `localhost` refers to the Android device itself, not your Windows laptop!

### Finding Your Laptop's Server Address:
- **Same Wi-Fi Network (LAN)**: Open PowerShell and run `ipconfig`. Look for the IPv4 Address under your Wi-Fi adapter (e.g., `192.168.1.50`). Your server URL will be:
  ```
  http://192.168.1.50:8000/api/v1
  ```
- **Tailscale (Private Remote Access)**: Open PowerShell and run `tailscale ip -4`. If your IP is `100.85.120.45`, your server URL will be:
  ```
  http://100.85.120.45:8000/api/v1
  ```

The LocalVault Android client provides an interactive Server Base URL input with a **"Test"** button on the sign-in screen to verify connectivity before logging in.

---

## 2. Running in Development (Expo Go)

1. Open PowerShell and navigate to the Android app directory:
   ```powershell
   cd "d:\All files\Cloud storage\apps\android"
   ```
2. Install dependencies:
   ```powershell
   npm install
   ```
3. Start the Expo development server:
   ```powershell
   npm start
   ```
4. Install **Expo Go** on your Android phone from the Google Play Store.
5. Scan the QR code displayed in your terminal using Expo Go.

---

## 3. Building an Installable Android APK

There are two primary methods to build a standalone `.apk` package:

### Method A: Cloud Build with EAS (Recommended & Easiest)
EAS (Expo Application Services) builds the APK in the cloud without needing Android Studio or Java SDK installed locally.

1. Install the EAS CLI globally:
   ```powershell
   npm install -g eas-cli
   ```
2. Log into your free Expo account:
   ```powershell
   eas login
   ```
3. Initialize EAS in the `apps/android` directory:
   ```powershell
   eas build:configure
   ```
4. Add a preview profile in `eas.json` to generate an APK (instead of an AAB for the Play Store):
   ```json
   {
     "build": {
       "preview": {
         "android": {
           "buildType": "apk"
         }
       }
     }
   }
   ```
5. Trigger the APK build:
   ```powershell
   eas build -p android --profile preview
   ```
6. Download the resulting `.apk` file directly to your phone and install it.

---

### Method B: Local Offline Build (Android Studio & Gradle)

If you have Android Studio and the Android SDK configured locally on your Windows laptop:

1. Prebuild the native Android project:
   ```powershell
   npx expo prebuild --platform android
   ```
2. Build the release APK using Gradle:
   ```powershell
   cd android
   .\gradlew assembleRelease
   ```
3. The generated APK will be located at:
   ```
   android\app\build\outputs\apk\release\app-release.apk
   ```
4. Copy the APK to your phone and tap to install.
