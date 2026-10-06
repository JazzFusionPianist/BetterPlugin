# Slur for Android

This Capacitor host packages the same static Next.js mobile UI as the iOS app. The first signed APK uses web commit `01e701cad931fce053f1ab7115e2c0d707daefb3`, native version 1.0.1 / version code 2. Its provenance is recorded in the APK manifest and the downloaded `build-info.json`.

## Build locally

Use JDK 17, Android SDK platform 34 and build tools 34.0.0. Install workspace dependencies with `pnpm install`, provide the existing public web configuration in `apps/web/.env.local`, then run:

```sh
pnpm --filter web build:android
```

This produces `app/build/outputs/apk/debug/app-debug.apk`. `pnpm --filter web cap:android` opens the project in Android Studio. For a release, run `./gradlew assembleRelease` inside this directory, then zip-align and sign the unsigned APK with the private Slur release key. Set `SLUR_SOURCE_COMMIT` to the web source SHA during the Gradle build; keep it consistent with the `VERCEL_GIT_COMMIT_SHA` used for the web export.

SDK paths belong in ignored `local.properties`; build output, copied web assets and generated Capacitor configuration are ignored. Do not commit signing keys or passwords. The local release key is kept outside this repository at `~/.local/share/slur/android-signing/` so subsequent APK updates can use the same identity.

## Native behavior

The web UI is bundled; no local development server is required. Login and collaboration still connect to the existing Slur services. Android uses native Capacitor HTTPS in `MainActivity`, because the deployed attachment service's browser CORS list does not include Android's `https://localhost` origin. The iOS HTTP configuration is preserved. Camera and microphone access is requested by the WebView when a user invokes those features. Application backup is disabled for local chat and authentication data.

## Authentication verification

Version 1.0.2 renders Turnstile on the approved HTTPS challenge page and receives the verified token over a nonce-bound MessageChannel. Native runtime dependencies are patched to Capacitor 6.2.2. The shared login form retains the token requirement and offers a retry when verification fails.

The instrumented test opens the native login screen and waits for a real token to enable its login button; it enters no credentials and never submits login. Run on a disposable emulator after syncing the bundled web assets:

```sh
./gradlew :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.slur.app.NativeSecurityCheckTest
```

The platform was generated using the [official Capacitor Android workflow](https://capacitorjs.com/docs/v6/android).
