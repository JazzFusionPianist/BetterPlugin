# The library the window, the devices and the hosting of other makers' plug-ins come from. The app is built with ONE
# exact copy of it, named here, so the same source always gives the same app: until 2026-10-13 the build took whatever
# lay in /Applications/JUCE that day (a checkout of the library's moving branch, with a change made by hand in it).
#
#   where it is looked for:  -DSLUR_JUCE_DIR=<folder>, else vendor/JUCE (./juce.sh makes it), else /Applications/JUCE
#   what it must be:         the version and, where the folder is a git checkout, the very commit below
#
# To move to a newer one on purpose: change the two lines, run ./juce.sh, then the whole self-test.
set(SLUR_JUCE_VERSION 8.0.10)
set(SLUR_JUCE_COMMIT  1b460fe0895635a2ab8ac5c00cb5575e33e5dc1e)   # nine commits after the 8.0.10 tag, 2025-09-29

set(SLUR_JUCE_DIR "" CACHE PATH "the copy of JUCE to build with (empty: vendor/JUCE if it is there, else /Applications/JUCE)")
set(_juce "${SLUR_JUCE_DIR}")
if(_juce STREQUAL "" AND EXISTS "${CMAKE_CURRENT_LIST_DIR}/../vendor/JUCE/CMakeLists.txt")
    set(_juce "${CMAKE_CURRENT_LIST_DIR}/../vendor/JUCE")
endif()
if(_juce STREQUAL "")
    set(_juce "/Applications/JUCE")
endif()
# the path is used as it is written (/Applications/JUCE is a link): a build made before this file was there
# knows the library's sources by that path, and would compile all of it again under another
if(NOT EXISTS "${_juce}/CMakeLists.txt")
    message(FATAL_ERROR "JUCE is not at ${_juce}. Run ./juce.sh (it fetches ${SLUR_JUCE_VERSION} at ${SLUR_JUCE_COMMIT} into vendor/JUCE).")
endif()

file(STRINGS "${_juce}/CMakeLists.txt" _line REGEX "^project\\(JUCE VERSION [0-9.]+" LIMIT_COUNT 1)
string(REGEX REPLACE "^project\\(JUCE VERSION ([0-9.]+).*" "\\1" _found "${_line}")
if(NOT _found STREQUAL SLUR_JUCE_VERSION)
    message(FATAL_ERROR "The JUCE at ${_juce} is ${_found}; this app is built with ${SLUR_JUCE_VERSION}. Run ./juce.sh for the right copy, or change cmake/Juce.cmake on purpose.")
endif()
if(EXISTS "${_juce}/.git")
    execute_process(COMMAND git -C "${_juce}" rev-parse HEAD OUTPUT_VARIABLE _head OUTPUT_STRIP_TRAILING_WHITESPACE ERROR_QUIET)
    if(_head AND NOT _head STREQUAL SLUR_JUCE_COMMIT)
        message(FATAL_ERROR "The JUCE at ${_juce} stands at ${_head}; this app is built with ${SLUR_JUCE_COMMIT}. Run ./juce.sh for the right copy (it leaves that folder alone), or change cmake/Juce.cmake on purpose.")
    endif()
endif()
message(STATUS "JUCE ${_found} from ${_juce}")
add_subdirectory("${_juce}" JUCE)
