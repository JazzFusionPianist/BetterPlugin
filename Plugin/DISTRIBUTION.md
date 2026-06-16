# Orb — official distribution

How to produce a signed, notarized installer for AU / VST3 / AAX / Standalone.

## Prerequisites (one-time, human — cannot be scripted)

| # | Item | Status (2026-06-16) | Needed for |
|---|------|---------------------|------------|
| 1 | Apple Developer Program membership | ✅ enrolled | all formats |
| 2 | **Developer ID Application** cert | ❌ not created yet | sign AU/VST3/Standalone **and** AAX (`wraptool --signid`) |
| 3 | **Developer ID Installer** cert | ❌ not created yet | sign the `.pkg` |
| 4 | App-specific password / notary profile | ❌ | notarize the `.pkg` |
| 5 | Avid Developer + AAX agreement | SDK present (`../aax-sdk-2-9-0`) | build AAX |
| 6 | **PACE / Eden developer account → `wraptool`** | ❌ **not held** (iLok is a consumer account, no signing cert) | sign AAX for release Pro Tools |
| 7 | PACE product registration → `wcguid` | ❌ | sign AAX |

**Create #2 + #3:** Xcode ▸ Settings ▸ Accounts ▸ (your Apple ID) ▸ Manage
Certificates ▸ **+** ▸ "Developer ID Application", then again "Developer ID
Installer". Verify: `security find-identity -v -p codesigning`.

**Create #4:** `xcrun notarytool store-credentials orb-notary --apple-id
<id> --team-id <TEAMID> --password <app-specific-pw>` (app-specific password
from account.apple.com ▸ Sign-In and Security).

**#6/#7 (AAX, the long pole):** apply at paceap.com for the Eden developer
program, install PACE Eden Tools (gives `wraptool`), and register Orb to get
its `wcguid`. Until then, AAX can only be a Developer build (loads in Pro
Tools Developer, not release).

## Build & ship

```bash
cd Plugin
./build.sh --release                 # builds all 4 formats (AAX if SDK present)

# Apple bundles (needs #2)
APPLE_SIGN_ID="Developer ID Application: <Name> (<TEAMID>)" ./sign-apple.sh

# AAX (needs #2 + #6 + #7) — skip if PACE not ready yet
PACE_ACCOUNT=<acct> PACE_WCGUID=<guid> \
  APPLE_SIGN_ID="Developer ID Application: <Name> (<TEAMID>)" ./sign-aax.sh

# Installer, signed (needs #3). Auto-signs AAX too if PACE_ACCOUNT is set.
SIGN_ID="Developer ID Installer: <Name> (<TEAMID>)" ./package.sh --version=1.0.0

# Notarize + staple (needs #4)
./notarize.sh installer/Orb-1.0.0.pkg
```

## Partial release (PACE not ready)

You can ship a fully official **AU + VST3 + Standalone** installer now (steps
2–4 only) and add AAX later once the PACE account lands. `build.sh` without the
AAX SDK, or simply not signing AAX, leaves it out / unsigned; the other three
formats notarize and install cleanly.
