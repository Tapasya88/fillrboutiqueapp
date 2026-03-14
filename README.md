# 🧵 Boutique Designer Studio (AI & AR Fashion Tech)

A professional React Native application for fashion designers to sketch designs, calculate body measurements automatically using AI, and visualize pastel fabric overlays on customers.

---

## ✨ Key Features

* **🎨 Digital Sketchpad:** High-performance drawing canvas using `@shopify/react-native-skia` with touch input for designs and references.
* **🤖 AI Idea Studio:** Generate high-quality fashion design concepts using ChatGPT/OpenAI DALL-E integration directly from text prompts.
* **📏 AI Auto-Measure:** Shoulder measurement from camera capture or drawn keypoints.
* **📷 Image-based Measure:** Capture from camera, compute measurement using image size and pose data model.
* **️ Boutique Branding:** First-time onboarding to capture and universally display your custom Boutique Name and Logo across the app.
* **🔐 Admin & Authentication:** Secure login system with role-based access control (Admin, Designer, Worker) and user management.
* ** Client Vault:** Persistent local storage for client profiles, measurement history, and captured images.
* **🖼️ Design Gallery:** Save, upload from device, and view drawn designs and references per customer profile.
* **📦 Order & Payment Tracking:** Manage customer orders, track total values, and automatically calculate remaining balances.
* **💸 UPI Integration:** Trigger direct UPI payment intents to instantly collect advance payments via installed apps (GPay, PhonePe, etc.).
* **👥 Customer Management:** Dedicated tab to view all customers, select a customer, and manage their measurements with auto-measure from images, manual input, and editing options.
* **💬 WhatsApp Integration:** One-click sharing of designs and measurements to customers.
* **💾 Data Export/Import:** Easily backup or restore your entire order database using CSV export and import functionalities.
* **📁 Native File Persistence:** Stores captured/uploaded reference images safely in the native device filesystem (`expo-file-system`).

---

## 🛠️ Tech Stack

* **Framework:** React Native (Expo)
* **Graphics:** [@shopify/react-native-skia](https://shopify.github.io/react-native-skia/)
* **Image Capture:** `expo-image-picker`
* **Image Rendering:** `expo-image`
* **AI Engine:** [@tensorflow/tfjs](https://www.tensorflow.org/js)
* **Storage:** `@react-native-async-storage/async-storage`
* **File System:** `expo-file-system`
* **Sharing & Export:** `expo-sharing`, `expo-document-picker`, React Native `Linking` (WhatsApp & UPI Intents)
* **Custom Storage Service:** `src/StorageService.js` with `getItem/setItem`.
* **Pose Estimation:** e.g., `@tensorflow-models/posenet` / `@tensorflow-models/blazepose` (placeholder simulation implemented)
* **Icons:** `@expo/vector-icons` (Ionicons)

---

## 🚀 Getting Started (Local Setup)

### 1. Prerequisites
Ensure you have:

* Node.js (LTS 18 or later)
* npm/yarn
* Expo CLI (`npm install -g expo-cli`) or [npx support]
* Expo Go app on mobile or Android/iOS emulator

### 2. Clone & Install

```bash
git clone https://github.com/your-org/BoutiqueDesignerApp.git
cd BoutiqueDesignerApp
npm install
# or yarn install
```

### 3. Run the App

```bash
npx expo start
```

Then open in Expo Go or simulator.

---

## 🏭 Build & Release (Production)

This app is configured for deployment using EAS Build.

1. **Install EAS CLI:**
   `npm install -g eas-cli`
2. **Login to Expo:**
   `eas login`
3. **Configure Build:**
   `eas build:configure`
4. **Run Production Build:**
   * **Android APK/AAB:** `eas build -p android --profile production`
   * **iOS IPA:** `eas build -p ios --profile production`

---

## 🧪 Testing

* Unit tests (if present): `npm test` or `yarn test`
* Linting: `npm run lint` or `yarn lint`

---

## 🔧 Troubleshooting

### Common Issues

1. **`Metro Bundler` fails or app crashes after install**
   * Delete `node_modules` and lockfile (`package-lock.json` / `yarn.lock`), then reinstall.
   * `npm cache clean --force`
   * `expo start -c` to clear cache.

2. **Camera permission denied (Android/iOS)**
   * Confirm permissions in device settings.
   * Reinstall the app after granting permissions.

3. **`@tensorflow/tfjs` performance is slow**
   * Use smaller model (`posenet` lightweight) and reduce frame rate.
   * Run on physical device instead of emulator for best performance.

4. **`react-native-skia` native build fail**
   * Ensure matching Expo SDK version (check `expo doctor`).
   * Rebuild with `expo prebuild` or recreate project if legacy dependencies are incompatible.

### Debugging Steps

* `npx expo doctor` for config issues
* `adb logcat` (Android) or Console app (iOS) for runtime logs
* `npm run lint` to catch type/model issues

---

## 🔐 Permissions

### Android

Add in `app.json` for Expo managed workflow:

```json
"android": {
  "permissions": [
    "CAMERA",
    "WRITE_EXTERNAL_STORAGE",
    "READ_EXTERNAL_STORAGE",
    "INTERNET"
  ]
}
```

### iOS

Add `infoPlist` to `app.json`:

```json
"ios": {
  "infoPlist": {
    "NSCameraUsageDescription": "Used for capturing customer body measurements with AR overlays.",
    "NSPhotoLibraryAddUsageDescription": "Used to save generated patterns and design photos."
  }
}
```

---

## 📝 Contributions

* Fork the repository
* Create your branch: `git checkout -b feature/my-feature`
* Commit changes: `git commit -m "feat: ..."`
* Push: `git push origin feature/my-feature`
* Open a Pull Request

---

##  Contact

For help, open an issue or message the maintainer at [mvtapasya@gmail.com]
