# Slur project scope

When the user asks for a Slur change, apply it to the plugin, web app, iOS app,
and Android app by default. Keep shared behavior in `packages/core` where possible.
Build and verify each affected platform, refresh the locally installed native
apps and downloadable builds when applicable, and report any platform limitation.
Do not treat a web-only edit as completion of a cross-platform request.

The macOS desktop app loads the hosted web app, so shared web changes also apply
there after deployment.
