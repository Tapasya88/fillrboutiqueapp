# 🚀 App Store Release Checklist

Before submitting your application to the Apple App Store or Google Play Store, please ensure all the following tasks are completed.

## 1. App Configuration (`app.json` / `app.config.js`)
- [ ] **Name & Slug**: Ensure `name` and `slug` are correctly set.
- [ ] **Version**: Increment the `version` (e.g., `1.0.0` -> `1.0.1`).
- [ ] **Android Package ID**: Verify `android.package` is set (e.g., `com.yourcompany.boutiqueapp`).
- [ ] **Android Version Code**: Increment `android.versionCode`.
- [ ] **iOS Bundle Identifier**: Verify `ios.bundleIdentifier` is set (e.g., `com.yourcompany.boutiqueapp`).
- [ ] **iOS Build Number**: Increment `ios.buildNumber`.
- [ ] **Assets**: Verify `icon.png`, `splash.png`, and `adaptive-icon.png` exist and are of proper resolution.
- [ ] **Permissions**: Confirm `android.permissions` and `ios.infoPlist` only include required hardware accesses (e.g., Camera, Photo Library).

## 2. Environment & Integrations
- [ ] **Firebase/API Keys**: Ensure production Google Services files (`google-services.json` / `GoogleService-Info.plist`) are configured in `app.json`.
- [ ] **HuggingFace / AI Keys**: Ensure production AI model API keys are set.

## 3. Code & Assets
- [ ] **Remove Debug Logs**: Clear or disable all unnecessary `console.log` statements.
- [ ] **Test Production Build locally**: Run `npx expo start --no-dev --minify` to ensure no bundled errors.

## 4. Build & Submit (via EAS)
- [ ] **Login**: Run `eas login`.
- [ ] **Configure Builds**: Run `eas build:configure`.
- [ ] **Android Build**: `eas build --platform android --profile production`
- [ ] **iOS Build**: `eas build --platform ios --profile production`
- [ ] **Android Submit**: `eas submit --platform android --profile production`
- [ ] **iOS Submit**: `eas submit --platform ios --profile production`

## 5. Store Metadata
- [ ] Prepare App Screenshots (iOS: 6.5" and 5.5", Android: standard screenshots).
- [ ] Prepare App Description, Keywords, Privacy Policy URL, and Support URLs.