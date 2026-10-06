# Slur Studio plugins — official distribution

How to produce a signed, notarized installer for AU / VST3 / AAX / Standalone.

## AAX signing without PACE product registration

The Slur Studio publisher account has signing-only access. PACE Code Signing
for AAX SDK 6 supports `wraptool sign` with the company's customer number and
name, so a PACE Product or Wrap Configuration (`WCGUID`) is **not** needed to
develop or sign an AAX plugin. This is code signing, not iLok copy protection.
Each final AAX bundle must still be signed separately before release.

On 2026-09-21, a temporary AAX copy passed both `wraptool verify` and macOS
`codesign --verify --deep --strict`. PACE reported signer `Slur Studio` and an
empty Product GUID. This was a signing smoke test only; the legacy-named binary
was not installed or prepared for distribution.

Prerequisites:

- Build the desired AAX with the Avid SDK.
- Install PACE Code Signing for AAX SDK 6 (provides `wraptool`).
- Activate the PACE Tools license and PACE Central Access license in the
  `puddingnpiano@gmail.com` account; keep the licensed iLok USB connected.
- In iLok License Manager, select that USB and run **Synchronize** to install
  the Slur Studio signing certificate. If synchronization fails, PACE signing
  will fail with `CouldNotFindSignerCredentials` even though the tool license
  is verified.
- Have an Apple **Developer ID Application** certificate in the keychain.
- Obtain the Slur Studio customer number from PACE Central → Admin → Company
  Details. Do not commit it or any account password to the repository.

`sign-aax.sh` signs exactly one specified bundle and runs `wraptool verify`.
Do not sign or install a release build until its final public product name and
bundle metadata have been chosen. If `PACE_PRODUCT_NAME` is omitted, PACE uses
the AAX bundle filename as the product name in the signature; this is **not**
PACE Product registration.

## Build & ship

```bash
cd Plugin
./build.sh --release                 # builds all 4 formats (AAX if SDK present)

# Apple bundles
APPLE_SIGN_ID="Developer ID Application: <Name> (<TEAMID>)" ./sign-apple.sh

# AAX: no WCGUID or PACE Product registration required
PACE_CUSTOMER_NUMBER="<Slur Studio number from PACE Central>" \
  APPLE_SIGN_ID="Developer ID Application: <Name> (<TEAMID>)" \
  ./sign-aax.sh /absolute/path/to/FinalName.aaxplugin

# Installer: package.sh includes AAX only after successful PACE verification.
# It can auto-sign AAX when PACE_CUSTOMER_NUMBER and APPLE_SIGN_ID are set.
SIGN_ID="Developer ID Installer: <Name> (<TEAMID>)" ./package.sh --version=1.0.0

# Notarize and staple with a configured notary profile.
./notarize.sh 'installer/Slur Orb-1.0.0.pkg'
```

## Partial release when AAX signing is unavailable

`package.sh` excludes an unsigned AAX rather than installing a plugin that
release Pro Tools will reject. AU, VST3, and Standalone can still be packaged
independently once their own signing and notarization requirements are met.

## Split-out plugins (Slur, Patch on Slur, Slur Games)

Each single-purpose plugin is its own download with its own bundle id, so
installing one never touches Slur Orb or another split-out.

```bash
cd Plugin
./build.sh --release --only=sounds        # or --only=chat; omit for everything
./package.sh --product=sounds --version=1.0.0   # → installer/Patch on Slur-1.0.0.pkg
./package.sh --product=chat   --version=1.0.0   # → installer/Slur-1.0.0.pkg
./package.sh --product=games  --version=1.0.0   # → installer/Slur Games-1.0.0.pkg
```

Sign and notarize exactly as above. Patch on Slur needs no account — it boots
straight into the one-knob room. Slur Games keeps the sign-in (multiplayer rooms,
invites and world scores are account-bound) and boots onto the CD wall.
