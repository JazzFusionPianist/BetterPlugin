import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../../../Plugin/RemoteScripts/Cubase/orb_orb_control.js', import.meta.url), 'utf8');
const header = [0xf0, 0x7d, 0x4f, 0x52, 0x42];
function packet(command, payload = '') {
  return [...header, command, ...Buffer.from(encodeURIComponent(payload)), 0xf7];
}
function boot() {
  const sent = [], selections = [], commands = [], channels = [];
  const input = {};
  const chain = new Proxy({}, { get: () => () => chain });
  const zone = {
    excludeInputChannels() { return this; },
    excludeOutputChannels() { return this; },
    setFollowVisibility() { return this; },
    makeMixerBankChannel() {
      const channel = { mValue: { mSelected: {} } };
      channels.push(channel);
      return channel;
    },
  };
  const driver = {
    mPorts: {
      makeMidiInput: () => input,
      makeMidiOutput: () => ({ sendMidi: (_, bytes) => sent.push(Array.from(bytes)) }),
    },
    makeDetectionUnit: () => chain,
    mSurface: { makeButton: () => ({ mSurfaceValue: {
      mMidiBinding: chain,
      setProcessValue: (_, value) => selections.push(value),
    } }) },
    mMapping: { makePage: () => ({
      mHostAccess: { mMixConsole: { makeMixerBankZone: () => zone } },
      makeValueBinding: () => chain,
      makeCommandBinding: (...args) => commands.push(args),
    }) },
  };
  vm.runInNewContext(source, { require: name => {
    assert.equal(name, 'midiremote_api_v1');
    return { makeDeviceDriver: () => driver };
  } });
  return { input, sent, selections, commands, channels };
}

test('remote never registers a GUI export command', () => {
  assert.deepEqual(boot().commands, []);
});

test('old export requests are rejected without changing DAW selection', () => {
  const remote = boot();
  for (const payload of ['session|0,1', 'selection|3', '', 'session|bad']) {
    remote.input.mOnSysex({}, packet(0x04, payload));
    assert.deepEqual(remote.sent.at(-1), packet(0x14, 'error:background-export-unavailable'));
  }
  assert.deepEqual(remote.selections, []);
});

test('track metadata remains available including Unicode names', () => {
  const remote = boot();
  remote.channels[0].mOnTitleChange({}, {}, '피아노');
  remote.channels[1].mOnTitleChange({}, {}, 'Drums');
  remote.sent.length = 0;
  remote.input.mOnSysex({}, packet(0x01));
  assert.deepEqual(remote.sent, [
    packet(0x10, 'Cubase MIDI Remote'),
    packet(0x11, '0|피아노|0'),
    packet(0x11, '1|Drums|0'),
  ]);
  assert.deepEqual(remote.selections, []);
});

test('explicit track selection still works independently of export', () => {
  const remote = boot();
  remote.input.mOnSysex({}, packet(0x03, '1|1'));
  assert.deepEqual(remote.selections, [1]);
});

test('unrelated SysEx cannot trigger a response or selection', () => {
  const remote = boot();
  remote.input.mOnSysex({}, [0xf0, 0x01, 0x04, 0xf7]);
  assert.deepEqual(remote.sent, []);
  assert.deepEqual(remote.selections, []);
});
