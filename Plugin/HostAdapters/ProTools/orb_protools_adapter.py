#!/usr/bin/env python3
"""Orb's local Pro Tools PTSL adapter. No UI or screen automation is used."""

from __future__ import annotations

import json
import os
import re
import socket
import time
from pathlib import Path

import ptsl
from ptsl import PTSL_pb2 as pt
from ptsl.ops.operation import Operation


class CId_BounceTrack(Operation):
    pass


ROOT = Path.home() / "Library" / "Application Support" / "Orb" / "HostControl"
REQUEST = ROOT / "request-protools.json"
STATUS = ROOT / "status-protools.json"
EXPORTS = ROOT / "Exports"
SUPPORTED_TYPES = {pt.AudioTrack, pt.Instrument, pt.Aux, pt.RoutingFolder}


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    os.replace(temporary, path)


def safe_name(name: str) -> str:
    cleaned = re.sub(r"[\\/:*?\"<>|\x00-\x1f]", "_", name).strip(" .")
    return cleaned[:120] or "Track"


def selected(track) -> bool:
    return track.track_attributes.is_selected in (
        pt.SetExplicitly, pt.SetImplicitly, pt.SetExplicitlyAndImplicitly)


def status_payload(engine, tracks) -> dict:
    return {
        "hostName": "Pro Tools",
        "adapter": "Orb Pro Tools (PTSL)",
        "connected": True,
        "trackListing": True,
        "exportMode": "native",
        "updatedAtMs": int(time.time() * 1000),
        "sampleRate": engine.session_sample_rate() or 48000,
        "bitDepth": engine.session_bit_depth() or 24,
        "sessionOpen": True,
        "tracks": [
            {
                "id": track.id,
                "index": track.index,
                "name": track.name,
                "selected": selected(track),
                "color": track.color,
            }
            for track in tracks if track.type in SUPPORTED_TYPES
        ],
    }


def no_session_status() -> dict:
    return {
        "hostName": "Pro Tools",
        "adapter": "Orb Pro Tools (PTSL)",
        "connected": True,
        "trackListing": False,
        "exportMode": "native",
        "sessionOpen": False,
        "message": "Open a Pro Tools session to read its tracks.",
        "updatedAtMs": int(time.time() * 1000),
        "sampleRate": 48000,
        "bitDepth": 24,
        "tracks": [],
    }


def timecode_samples(value: str, rate, sample_rate: int) -> int:
    numbers = [int(part) for part in re.findall(r"\d+", value)]
    if len(numbers) < 4:
        return 0
    hours, minutes, seconds, frames = numbers[-4:]
    rates = {
        pt.STCR_Fps23976: (24, 24000 / 1001, 0), pt.STCR_Fps24: (24, 24, 0),
        pt.STCR_Fps25: (25, 25, 0), pt.STCR_Fps2997: (30, 30000 / 1001, 0),
        pt.STCR_Fps2997Drop: (30, 30000 / 1001, 2), pt.STCR_Fps30: (30, 30, 0),
        pt.STCR_Fps30Drop: (30, 30, 2), pt.STCR_Fps47952: (48, 48000 / 1001, 0),
        pt.STCR_Fps48: (48, 48, 0), pt.STCR_Fps50: (50, 50, 0),
        pt.STCR_Fps5994: (60, 60000 / 1001, 0), pt.STCR_Fps5994Drop: (60, 60000 / 1001, 4),
        pt.STCR_Fps60: (60, 60, 0), pt.STCR_Fps60Drop: (60, 60, 4),
    }
    nominal, actual, drop = rates.get(rate, (30, 30, 0))
    total_minutes = hours * 60 + minutes
    frame_number = ((hours * 3600 + minutes * 60 + seconds) * nominal + frames)
    if drop:
        frame_number -= drop * (total_minutes - total_minutes // 10)
    return max(0, round(frame_number / actual * sample_rate))


def timeline_range(engine, mode: str):
    if mode != "selection":
        sample_rate = engine.session_sample_rate() or 48000
        return None, None, timecode_samples(
            engine.session_start_time(), engine.session_timecode_rate(), sample_rate)
    start, end = engine.get_timeline_selection(format=pt.TLType_Samples)
    if int(end or 0) <= int(start or 0):
        raise RuntimeError("Make an Edit Selection in Pro Tools before sharing.")
    return (
        pt.TimelineLocation(location=str(start), time_type=pt.TLType_Samples),
        pt.TimelineLocation(location=str(end), time_type=pt.TLType_Samples),
        int(start),
    )


def bounce_tracks(engine, request: dict, tracks) -> None:
    request_id = request["id"]
    response_path = ROOT / f"export-{request_id}.json"
    indices = {int(value) for value in request.get("trackIndices", [])}
    targets = [track for track in tracks if track.index in indices and track.type in SUPPORTED_TYPES]
    if not targets:
        raise RuntimeError("No exportable Pro Tools tracks were selected.")

    sample_rate = engine.session_sample_rate() or 48000
    bit_depth = engine.session_bit_depth() or 24
    bit_depth_enum = {16: pt.Bit16, 24: pt.Bit24, 32: pt.Bit32Float}.get(bit_depth, pt.Bit24)
    output_dir = EXPORTS / request_id
    output_dir.mkdir(parents=True, exist_ok=True)
    in_location, out_location, source_samples = timeline_range(engine, request.get("rangeMode", "session"))
    files = []

    for number, track in enumerate(targets, start=1):
        write_json(response_path, {
            "id": request_id, "status": "rendering",
            "progress": (number - 1) / len(targets),
            "message": f"Bouncing {track.name}",
        })
        kwargs = {
            "file_name_prefix": safe_name(track.name),
            "file_type": pt.EM_WAV,
            "audio_info": pt.EM_AudioInfo(
                compression_type=pt.CT_PCM,
                export_format=pt.EF_Interleaved,
                bit_depth=bit_depth_enum,
                sample_rate=sample_rate,
                pad_to_frame_boundary=pt.TB_False,
                delivery_format=pt.EM_DF_SingleFile,
            ),
            "location_info": pt.EM_LocationInfo(
                import_after_bounce=pt.TB_False,
                file_destination=pt.EM_FD_Directory,
                directory=str(output_dir),
            ),
            "offline_bounce": pt.TB_True,
            "src_track_id": track.id,
            "automation_options": pt.RenderAutomationOptions(
                render_volume_automation=True, render_pan_automation=True),
        }
        if in_location is not None:
            kwargs["in_location"] = in_location
            kwargs["out_location"] = out_location
        operation = CId_BounceTrack(**kwargs)
        engine.client.run(operation)
        for file_path in operation.response.file_paths:
            path = Path(file_path)
            if path.is_file():
                files.append({
                    "path": str(path), "name": path.name, "size": path.stat().st_size,
                    "mimeType": "audio/wav", "sampleRate": sample_rate,
                    "bitDepth": bit_depth, "sourceSamples": source_samples,
                })

    if not files:
        raise RuntimeError("Pro Tools finished the bounce but returned no audio files.")
    write_json(response_path, {
        "id": request_id, "status": "complete", "progress": 1,
        "sampleRate": sample_rate, "bitDepth": bit_depth, "files": files,
    })


def handle_request(engine, request: dict, tracks) -> None:
    if request.get("action") == "select":
        target = next((track for track in tracks if track.index == int(request.get("trackIndex", -1))), None)
        if target:
            engine.select_tracks_by_name([target.name], mode=pt.SM_Add if request.get("selected") else pt.SM_Subtract)
    elif request.get("action") == "export":
        bounce_tracks(engine, request, tracks)


def run() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    last_request = ""
    while True:
        try:
            try:
                with socket.create_connection(("127.0.0.1", 31416), timeout=0.25):
                    pass
            except OSError:
                STATUS.unlink(missing_ok=True)
                time.sleep(2)
                continue
            with ptsl.open_engine(company_name="Orb", application_name="Orb Pro Tools Adapter") as engine:
                while True:
                    try:
                        tracks = engine.track_list()
                    except Exception as error:
                        if "PT_NoOpenedSession" not in str(error):
                            raise
                        write_json(STATUS, no_session_status())
                        time.sleep(0.75)
                        continue
                    write_json(STATUS, status_payload(engine, tracks))
                    if REQUEST.is_file():
                        request = json.loads(REQUEST.read_text(encoding="utf-8"))
                        request_id = str(request.get("id", ""))
                        if request_id and request_id != last_request:
                            last_request = request_id
                            try:
                                handle_request(engine, request, tracks)
                            except Exception as error:
                                if request.get("action") == "export":
                                    write_json(ROOT / f"export-{request_id}.json", {
                                        "id": request_id, "status": "error", "progress": 0,
                                        "message": str(error),
                                    })
                    time.sleep(0.75)
        except Exception:
            try:
                STATUS.unlink(missing_ok=True)
            except OSError:
                pass
            time.sleep(2)


if __name__ == "__main__":
    run()
