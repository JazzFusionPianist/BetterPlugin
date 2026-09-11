cmake_minimum_required(VERSION 3.22)

project(OrbPlugin VERSION 1.0.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ── macOS: universal binary, minimum target ───────────────────────────────────
set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "Minimum macOS version")
set(CMAKE_OSX_ARCHITECTURES    "arm64;x86_64" CACHE STRING "Universal binary")

# ── JUCE ─────────────────────────────────────────────────────────────────────
add_subdirectory(/Applications/JUCE JUCE)

# ── AAX SDK (optional) ───────────────────────────────────────────────────────
set(AAX_SDK_PATH "" CACHE PATH "Path to the Avid AAX SDK (leave empty to skip AAX)")
# Formats are assembled here so AAX joins the list only when the SDK is
# available — passing AAX in FORMATS without the SDK is a configure error.
set(ORB_FORMATS AU VST3 Standalone)
if(AAX_SDK_PATH AND EXISTS "${AAX_SDK_PATH}")
  juce_set_aax_sdk_path("${AAX_SDK_PATH}")
  list(APPEND ORB_FORMATS AAX)
endif()

# ── Vercel URL ────────────────────────────────────────────────────────────────
set(ORB_APP_URL "https://better-plugin.vercel.app" CACHE STRING "Orb web app URL")

# ── Plugin ────────────────────────────────────────────────────────────────────
juce_add_plugin(OrbPlugin
    COMPANY_NAME                "Orb"
    COMPANY_WEBSITE             "https://orb.app"
    COMPANY_EMAIL               "hello@orb.app"

    PLUGIN_MANUFACTURER_CODE    Orb1   # 4 chars (>=1 uppercase for AU)
    PLUGIN_CODE                 OrbA   # 4 chars, unique per plugin

    # Standalone produces an Orb.app that runs the plugin UI without a
    # DAW — useful for fast dev iteration. AU/VST3 are the production
    # formats DAWs actually load.
    FORMATS                     ${ORB_FORMATS}

    PRODUCT_NAME                "Orb"
    BUNDLE_ID                   "com.orb.plugin"

    # Bundle icon — JUCE converts the PNG to .icns and embeds it on macOS.
    # Visible in the Dock, Finder, and the Standalone app's title bar.
    ICON_BIG                    "${CMAKE_CURRENT_SOURCE_DIR}/Resources/icon.png"

    PLUGIN_AU_MAIN_TYPE         "kAudioUnitType_Effect"
    PLUGIN_AU_EXPORT_PREFIX     OrbAU

    IS_SYNTH                    FALSE
    NEEDS_MIDI_INPUT            FALSE
    NEEDS_MIDI_OUTPUT           FALSE
    IS_MIDI_EFFECT              FALSE

    EDITOR_WANTS_KEYBOARD_FOCUS TRUE
    VST3_CATEGORIES             "Fx" "Tools"
    AAX_CATEGORY                "AAX_ePlugInCategory_None"

    # macOS hardened runtime — required for notarization & network access
    HARDENED_RUNTIME_ENABLED    TRUE
    COPY_PLUGIN_AFTER_BUILD     FALSE
)

target_sources(OrbPlugin PRIVATE
    Source/PluginProcessor.cpp
    Source/PluginEditor.cpp
    Source/OrbControlBridge.cpp
    Source/FxEngine.cpp
    Source/DragMonitor.mm      # ObjC++ — NSEvent-based drag for WKWebView
    Source/VideoCapture.mm     # ObjC++ — ScreenCaptureKit window/screen capture
)

# ObjC++ files require ARC (rest of the project uses MRC)
set_source_files_properties(Source/DragMonitor.mm Source/VideoCapture.mm
    PROPERTIES COMPILE_FLAGS "-fobjc-arc"
)

target_compile_definitions(OrbPlugin
    PUBLIC
        JUCE_WEB_BROWSER=1
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
        JUCE_DISPLAY_SPLASH_SCREEN=0
        ORB_APP_URL="${ORB_APP_URL}"
)

target_link_libraries(OrbPlugin
    PRIVATE
        juce::juce_audio_processors
        juce::juce_audio_utils
        juce::juce_gui_extra
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)

# macOS frameworks needed for VideoCapture.mm (ScreenCaptureKit pipeline)
if(APPLE)
    target_link_libraries(OrbPlugin PRIVATE
        "-framework ScreenCaptureKit"
        "-framework CoreMedia"
        "-framework CoreImage"
        "-framework ImageIO"
        "-framework UniformTypeIdentifiers"
        "-framework CoreMIDI"
        "-framework CoreAudio"
    )
endif()

# ── Entitlements: network access for WKWebView ────────────────────────────────
foreach(_fmt AU VST3 AAX)
    if(TARGET OrbPlugin_${_fmt})
        set_target_properties(OrbPlugin_${_fmt} PROPERTIES
            XCODE_ATTRIBUTE_CODE_SIGN_ENTITLEMENTS
                "${CMAKE_CURRENT_SOURCE_DIR}/Resources/Orb.entitlements"
        )
    endif()
endforeach()

# ── Split-out single-purpose plugins ─────────────────────────────────────────
# Orb is heading toward four separate plugins (chat / sounds / live /
# games). Each split-out shares the same sources and web app; only its
# identity (code/bundle/name) and the ORB_SURFACE define differ — the
# processor appends &surface=<name> to the app URL so the UI boots that
# one room. DAWs list them beside the full Orb.
#
#   orb_add_surface_plugin(<target> <plugin code> <bundle id> "<product name>" <surface> <AU export prefix>)
function(orb_add_surface_plugin _target _code _bundle _name _surface _au_prefix)
    juce_add_plugin(${_target}
        COMPANY_NAME                "Orb"
        COMPANY_WEBSITE             "https://orb.app"
        COMPANY_EMAIL               "hello@orb.app"
        PLUGIN_MANUFACTURER_CODE    Orb1
        PLUGIN_CODE                 ${_code}
        FORMATS                     ${ORB_FORMATS}
        PRODUCT_NAME                "${_name}"
        BUNDLE_ID                   "${_bundle}"
        ICON_BIG                    "${CMAKE_CURRENT_SOURCE_DIR}/Resources/icon.png"
        PLUGIN_AU_MAIN_TYPE         "kAudioUnitType_Effect"
        PLUGIN_AU_EXPORT_PREFIX     ${_au_prefix}
        IS_SYNTH                    FALSE
        NEEDS_MIDI_INPUT            FALSE
        NEEDS_MIDI_OUTPUT           FALSE
        IS_MIDI_EFFECT              FALSE
        EDITOR_WANTS_KEYBOARD_FOCUS TRUE
        VST3_CATEGORIES             "Fx" "Tools"
        AAX_CATEGORY                "AAX_ePlugInCategory_None"
        HARDENED_RUNTIME_ENABLED    TRUE
        COPY_PLUGIN_AFTER_BUILD     FALSE
    )

    target_sources(${_target} PRIVATE
        Source/PluginProcessor.cpp
        Source/PluginEditor.cpp
        Source/OrbControlBridge.cpp
    Source/FxEngine.cpp
        Source/DragMonitor.mm
        Source/VideoCapture.mm
    )

    target_compile_definitions(${_target}
        PUBLIC
            JUCE_WEB_BROWSER=1
            JUCE_USE_CURL=0
            JUCE_VST3_CAN_REPLACE_VST2=0
            JUCE_DISPLAY_SPLASH_SCREEN=0
            ORB_APP_URL="${ORB_APP_URL}"
            ORB_SURFACE="${_surface}"
    )

    target_link_libraries(${_target}
        PRIVATE
            juce::juce_audio_processors
            juce::juce_audio_utils
            juce::juce_gui_extra
        PUBLIC
            juce::juce_recommended_config_flags
            juce::juce_recommended_lto_flags
            juce::juce_recommended_warning_flags
    )

    if(APPLE)
        target_link_libraries(${_target} PRIVATE
            "-framework ScreenCaptureKit"
            "-framework CoreMedia"
            "-framework CoreImage"
            "-framework ImageIO"
            "-framework UniformTypeIdentifiers"
            "-framework CoreMIDI"
            "-framework CoreAudio"
        )
    endif()

    foreach(_fmt AU VST3 AAX)
        if(TARGET ${_target}_${_fmt})
            set_target_properties(${_target}_${_fmt} PROPERTIES
                XCODE_ATTRIBUTE_CODE_SIGN_ENTITLEMENTS
                    "${CMAKE_CURRENT_SOURCE_DIR}/Resources/Orb.entitlements"
            )
        endif()
    endforeach()
endfunction()

# Orb Chat — messages only (first split-out, 2026-09-11).
orb_add_surface_plugin(OrbChat   OrbC "com.orb.chat"   "Orb Chat"   chat   OrbChatAU)

# Orb Sounds — the one-knob fx chain, no account needed: the plugin boots
# straight into the darkened room.
orb_add_surface_plugin(OrbSounds OrbS "com.orb.sounds" "Orb Sounds" sounds OrbSoundsAU)

# Orb Games — the mini-games CD wall. Keeps the account (rooms, invites,
# world scores), drops every other room.
orb_add_surface_plugin(OrbGames  OrbG "com.orb.games"  "Orb Games"  games  OrbGamesAU)

# ── Engine self-test (console) ────────────────────────────────────────────────
# Runs the FX graph compiler + program runner on synthetic audio and checks
# the wiring semantics (mult, mix, wet, cycles). Not built by build.sh:
#   cmake --build build --config Debug --target FxGraphTest && ./build/FxGraphTest_artefacts/Debug/FxGraphTest
juce_add_console_app(FxGraphTest PRODUCT_NAME "FxGraphTest")
target_sources(FxGraphTest PRIVATE Source/FxEngine.cpp Tests/FxGraphTest.cpp)
target_include_directories(FxGraphTest PRIVATE Source)
target_compile_definitions(FxGraphTest PRIVATE JUCE_USE_CURL=0 JUCE_WEB_BROWSER=0)
target_link_libraries(FxGraphTest
    PRIVATE juce::juce_audio_basics
    PUBLIC  juce::juce_recommended_config_flags juce::juce_recommended_warning_flags)
