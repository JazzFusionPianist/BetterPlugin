# Orb — official distribution

How to produce a signed, notarized installer for Orb, Orb StemLink, AU / VST3 /
AAX, and Standalone.

## Prerequisites (one-time, human — cannot be scripted)

| # | Item | Status (2026-08-05) | Needed for |
|---|------|---------------------|------------|
| 1 | Apple Developer Program membership | ✅ enrolled | all formats |
| 2 | **Developer ID Application** cert | ✅ installed; expires 2031-08-05 | sign AU/VST3/Standalone **and** AAX (`wraptool --signid`) |
| 3 | **Developer ID Installer** cert | ✅ installed; expires 2031-08-05 | sign the `.pkg` |
| 4 | App Store Connect API key / notary profile | ✅ `orb-notary` saved in login keychain | notarize the `.pkg` |
| 5 | Avid Developer + AAX agreement | SDK present (`../aax-sdk-2-9-0`) | build AAX |
| 6 | **PACE / Eden developer account → `wraptool`** | ⏳ application submitted to PACE; awaiting onboarding | sign AAX for release Pro Tools |
| 7 | PACE product registration → `wcguid` | ❌ | sign AAX |

**#2 + #3 are installed on this Mac:** the Application identity is
`Developer ID Application: Sanghyun Park (2RRXTY96WF)` and the Installer
identity is `Developer ID Installer: Sanghyun Park (2RRXTY96WF)`. Their
private keys were created with the matching CSRs on this Mac. Verify the app
identity with `security find-identity -v -p codesigning` and the finished
installer with `pkgutil --check-signature <pkg>`.

**#4 is configured on this Mac:** use the `orb-notary` keychain profile. It
uses a dedicated App Store Connect team API key with the Product Developer
role. The private key is stored outside the repository with user-only file
permissions; never commit or share it.

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

You can prepare a Developer ID-signed **AU + VST3 + Standalone** installer now.
The AU and VST3 choices include both Orb and Orb StemLink. You can add AAX later
once the PACE account lands. `package.sh` excludes AAX unless
`wraptool verify` confirms its PACE signature, so a release package cannot
accidentally install an unsigned AAX. Complete #4 before public distribution so
the installer can be notarized and stapled for Gatekeeper.
