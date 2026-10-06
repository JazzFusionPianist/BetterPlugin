# Slur project scope

When the user asks for a Slur change, apply it to the plugin, web app, iOS app,
and Android app by default. Keep shared behavior in `packages/core` where possible.
Build and verify each affected platform, refresh the locally installed native
apps and downloadable builds when applicable, and report any platform limitation.
Do not treat a web-only edit as completion of a cross-platform request.

Normal chat and file sharing must require only the signed-in account, with no
recovery-key input, device enrollment, passkey setup or encryption unlock screen.
Verify the post-login chat screen in installed builds, not just the login form.
Build native apps from the source that contains the requested feature; do not
repackage an older production baseline that omits already-requested behavior.

The macOS desktop app loads the hosted web app, so shared web changes also apply
there after deployment.
