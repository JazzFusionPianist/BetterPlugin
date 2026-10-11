cmake_minimum_required(VERSION 3.22)

project(SlurDaw VERSION 0.1.0)   # alpha: the sketch's page in a window, the engine underneath

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_OSX_DEPLOYMENT_TARGET "12.0" CACHE STRING "Minimum macOS version")

add_subdirectory(/Applications/JUCE JUCE)

# The program is called Slur Studio (decided 2026-10-11). "Slur DAW" was its working title, and is still what its target
# and its bundle id say: macOS remembers what an app may reach by that id.
juce_add_gui_app(SlurDaw
    COMPANY_NAME                  "Slur Studio"
    PRODUCT_NAME                  "Slur Studio"
    BUNDLE_ID                     "com.slurstudio.daw.alpha"
    ICON_BIG                      "${CMAKE_CURRENT_SOURCE_DIR}/Resources/icon.png"      # the staff and one whole note in the program's blue (design/logo)
    MICROPHONE_PERMISSION_ENABLED TRUE
    MICROPHONE_PERMISSION_TEXT    "Slur Studio records what you play."
    HARDENED_RUNTIME_ENABLED      FALSE     # an unhardened local build may load anyone's plug-ins
    # a project is a folder named <song>.sls that the Finder shows as one file and opens here
    PLIST_TO_MERGE [[<plist version="1.0"><dict>
        <key>CFBundleDocumentTypes</key><array><dict>
            <key>CFBundleTypeName</key><string>Slur Studio Project</string>
            <key>CFBundleTypeRole</key><string>Editor</string>
            <key>LSHandlerRank</key><string>Owner</string>
            <key>LSTypeIsPackage</key><true/>
            <key>LSItemContentTypes</key><array><string>com.slurstudio.daw.project</string></array>
        </dict></array>
        <key>UTExportedTypeDeclarations</key><array><dict>
            <key>UTTypeIdentifier</key><string>com.slurstudio.daw.project</string>
            <key>UTTypeDescription</key><string>Slur Studio Project</string>
            <key>UTTypeConformsTo</key><array><string>com.apple.package</string><string>public.composite-content</string></array>
            <key>UTTypeTagSpecification</key><dict><key>public.filename-extension</key><array><string>sls</string></array></dict>
        </dict></array>
    </dict></plist>]]
)

target_sources(SlurDaw PRIVATE
    Source/Main.cpp
    Source/Mac.mm
    Source/Stretch.cpp
    ../Plugin/Source/FxEngine.cpp           # the Patch engine, the very file the plug-in builds
)
set_source_files_properties(Source/Mac.mm PROPERTIES COMPILE_FLAGS "-fobjc-arc")

target_include_directories(SlurDaw PRIVATE Source ../Plugin/Source ../Plugin/Source/ThirdParty)
target_compile_definitions(SlurDaw PRIVATE
    JUCE_WEB_BROWSER=1
    SLUR_APP_URL="https://better-plugin.vercel.app"      # Slur itself: the plug-in's own page, shown in the room's right-hand panel
    JUCE_USE_CURL=0
    JUCE_DISPLAY_SPLASH_SCREEN=0
    JUCE_PLUGINHOST_AU=1
    JUCE_PLUGINHOST_VST3=1
    JUCE_VST3_CAN_REPLACE_VST2=0
    SIGNALSMITH_USE_ACCELERATE=1
)
target_link_libraries(SlurDaw
    PRIVATE
        juce::juce_audio_utils
        juce::juce_audio_processors
        juce::juce_gui_extra
        "-framework Accelerate"
        "-framework AudioToolbox"
        "-framework AVFoundation"
        "-framework WebKit"
    PUBLIC
        juce::juce_recommended_config_flags
)
