cmake_minimum_required(VERSION 3.22)

project(CoOpPlugin VERSION 1.0.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ── macOS: universal binary, minimum target ───────────────────────────────────
set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "Minimum macOS version")
set(CMAKE_OSX_ARCHITECTURES    "arm64;x86_64" CACHE STRING "Universal binary")

# ── JUCE ─────────────────────────────────────────────────────────────────────
add_subdirectory(/Applications/JUCE JUCE)

# ── AAX SDK (optional) ───────────────────────────────────────────────────────
set(AAX_SDK_PATH "" CACHE PATH "Path to the Avid AAX SDK (leave empty to skip AAX)")
if(AAX_SDK_PATH AND EXISTS "${AAX_SDK_PATH}")
  juce_set_aax_sdk_path("${AAX_SDK_PATH}")
endif()

# ── Vercel URL ────────────────────────────────────────────────────────────────
set(COOP_APP_URL "https://better-plugin.vercel.app" CACHE STRING "CoOp web app URL")

# ── Plugin ────────────────────────────────────────────────────────────────────
juce_add_plugin(CoOpPlugin
    COMPANY_NAME                "CoOp"
    COMPANY_WEBSITE             "https://coop.app"
    COMPANY_EMAIL               "hello@coop.app"

    PLUGIN_MANUFACTURER_CODE    CoOp   # 4 chars
    PLUGIN_CODE                 CoAp   # 4 chars, unique per plugin

    FORMATS                     AU VST3

    PRODUCT_NAME                "CoOp"
    BUNDLE_ID                   "com.coop.plugin"

    PLUGIN_AU_MAIN_TYPE         "kAudioUnitType_Effect"
    PLUGIN_AU_EXPORT_PREFIX     CoOpAU

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

target_sources(CoOpPlugin PRIVATE
    Source/PluginProcessor.cpp
    Source/PluginEditor.cpp
)

target_compile_definitions(CoOpPlugin
    PUBLIC
        JUCE_WEB_BROWSER=1
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
        JUCE_DISPLAY_SPLASH_SCREEN=0
        COOP_APP_URL="${COOP_APP_URL}"
)

target_link_libraries(CoOpPlugin
    PRIVATE
        juce::juce_audio_processors
        juce::juce_audio_utils
        juce::juce_gui_extra
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)

# ── Entitlements: network access for WKWebView ────────────────────────────────
foreach(_fmt AU VST3 AAX)
    if(TARGET CoOpPlugin_${_fmt})
        set_target_properties(CoOpPlugin_${_fmt} PROPERTIES
            XCODE_ATTRIBUTE_CODE_SIGN_ENTITLEMENTS
                "${CMAKE_CURRENT_SOURCE_DIR}/Resources/CoOp.entitlements"
        )
    endif()
endforeach()
