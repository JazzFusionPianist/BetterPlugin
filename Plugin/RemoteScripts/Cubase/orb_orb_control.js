// Orb Control — Cubase/Nuendo MIDI Remote adapter.
// Uses only Steinberg's public MIDI Remote API and Orb's CoreMIDI virtual ports.

var midiremote_api = require('midiremote_api_v1')
var deviceDriver = midiremote_api.makeDeviceDriver('Orb', 'Orb Control', 'Orb')
var midiInput = deviceDriver.mPorts.makeMidiInput()
var midiOutput = deviceDriver.mPorts.makeMidiOutput()

deviceDriver.makeDetectionUnit().detectPortPair(midiInput, midiOutput)
    .expectInputNameEquals('Orb Control Out')
    .expectOutputNameEquals('Orb Control In')

var header = [0xF0, 0x7D, 0x4F, 0x52, 0x42]
var trackCount = 64
var trackNames = []
var trackSelected = []
var selectedButtons = []

function startsWithHeader(msg) {
    if (!msg || msg.length < 7) return false
    for (var i = 0; i < header.length; ++i)
        if (msg[i] !== header[i]) return false
    return true
}

function encodePayload(value) {
    var encoded = encodeURIComponent(value)
    var result = []
    for (var i = 0; i < encoded.length; ++i) result.push(encoded.charCodeAt(i) & 0x7F)
    return result
}

function decodePayload(msg) {
    var encoded = ''
    for (var i = 6; i < msg.length && msg[i] !== 0xF7; ++i)
        encoded += String.fromCharCode(msg[i])
    try { return decodeURIComponent(encoded) } catch (error) { return encoded }
}

function send(activeDevice, command, payload) {
    var message = header.slice()
    message.push(command)
    message = message.concat(encodePayload(payload || ''))
    message.push(0xF7)
    midiOutput.sendMidi(activeDevice, message)
}

function sendTracks(activeDevice) {
    send(activeDevice, 0x10, 'Cubase MIDI Remote')
    for (var i = 0; i < trackCount; ++i) {
        var name = trackNames[i]
        if (name && name !== 'No Track')
            send(activeDevice, 0x11, i + '|' + name + '|' + (trackSelected[i] ? '1' : '0'))
    }
}

var page = deviceDriver.mMapping.makePage('Orb Stems')
var mixerZone = page.mHostAccess.mMixConsole.makeMixerBankZone('Orb Project Tracks')
    .excludeInputChannels()
    .excludeOutputChannels()
    .setFollowVisibility(true)

for (var channelIndex = 0; channelIndex < trackCount; ++channelIndex) {
    var button = deviceDriver.mSurface.makeButton(channelIndex % 8, Math.floor(channelIndex / 8), 1, 1)
    button.mSurfaceValue.mMidiBinding
        .setInputPort(midiInput)
        .setOutputPort(midiOutput)
        .bindToNote(0, channelIndex)
    selectedButtons.push(button)

    var channel = mixerZone.makeMixerBankChannel()
    page.makeValueBinding(button.mSurfaceValue, channel.mValue.mSelected).setTypeToggle()

    channel.mOnTitleChange = (function (index) {
        return function (activeDevice, activeMapping, name) {
            trackNames[index] = name
            if (name && name !== 'No Track')
                send(activeDevice, 0x11, index + '|' + name + '|' + (trackSelected[index] ? '1' : '0'))
        }
    })(channelIndex)

    button.mSurfaceValue.mOnProcessValueChange = (function (index) {
        return function (activeDevice, value) {
            trackSelected[index] = value >= 0.5
            if (trackNames[index])
                send(activeDevice, 0x12, index + '|' + (trackSelected[index] ? '1' : '0'))
        }
    })(channelIndex)
}

var exportButton = deviceDriver.mSurface.makeButton(9, 0, 1, 1)
exportButton.mSurfaceValue.mMidiBinding
    .setInputPort(midiInput)
    .setOutputPort(midiOutput)
    .bindToNote(0, 100)
page.makeCommandBinding(exportButton.mSurfaceValue, 'Audio Export', 'Perform Audio Export')

midiInput.mOnSysex = function (activeDevice, msg) {
    if (!startsWithHeader(msg)) return
    var command = msg[5]
    var payload = decodePayload(msg)

    if (command === 0x01) {
        sendTracks(activeDevice)
    } else if (command === 0x03) {
        var selectParts = payload.split('|')
        var selectIndex = parseInt(selectParts[0], 10)
        if (selectIndex >= 0 && selectIndex < selectedButtons.length)
            selectedButtons[selectIndex].mSurfaceValue.setProcessValue(activeDevice, selectParts[1] === '1' ? 1 : 0)
    } else if (command === 0x04) {
        var exportParts = payload.split('|')
        var requested = exportParts.length > 1 && exportParts[1] ? exportParts[1].split(',') : []
        // One-pass StemLink capture needs one ordinary master export. Keep the
        // user's channel selection untouched; every armed StemLink captures
        // itself while Cubase renders the graph.
        if (exportParts[0] !== 'onepass') {
            for (var i = 0; i < selectedButtons.length; ++i)
                selectedButtons[i].mSurfaceValue.setProcessValue(activeDevice, requested.indexOf(String(i)) >= 0 ? 1 : 0)
        }
        exportButton.mSurfaceValue.setProcessValue(activeDevice, 1)
        exportButton.mSurfaceValue.setProcessValue(activeDevice, 0)
    }
}

deviceDriver.mOnActivate = function (activeDevice) {
    send(activeDevice, 0x10, 'Cubase MIDI Remote')
}

deviceDriver.mOnDeactivate = function (activeDevice) {
    send(activeDevice, 0x13, 'offline')
}
