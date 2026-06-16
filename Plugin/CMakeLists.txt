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
