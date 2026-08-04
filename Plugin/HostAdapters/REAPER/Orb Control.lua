-- Orb REAPER adapter: track discovery and native stem rendering via ReaScript.
-- Install as a background/startup action. No screen capture or UI automation.

local sep = package.config:sub(1, 1)
local root = os.getenv("HOME") .. "/Library/Application Support/Orb/HostControl"
local request_path = root .. "/request-reaper.json"
local status_path = root .. "/status-reaper.json"
local exports_root = root .. "/Exports"
local last_request = ""

local function escape(value)
  return tostring(value or ""):gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n'):gsub('\r', '\\r')
end

local function write_file(path, contents)
  reaper.RecursiveCreateDirectory(root, 0)
  local tmp = path .. ".tmp"
  local file = io.open(tmp, "wb")
  if not file then return false end
  file:write(contents); file:close()
  os.remove(path)
  return os.rename(tmp, path)
end

local function read_file(path)
  local file = io.open(path, "rb")
  if not file then return nil end
  local value = file:read("*a"); file:close(); return value
end

local function json_string(source, key)
  return source:match('"' .. key .. '"%s*:%s*"(.-)"')
end

local function json_bool(source, key)
  return source:match('"' .. key .. '"%s*:%s*(true)') ~= nil
end

local function json_number(source, key)
  return tonumber(source:match('"' .. key .. '"%s*:%s*(-?%d+)'))
end

local function json_indices(source)
  local body = source:match('"trackIndices"%s*:%s*%[([^%]]*)%]') or ""
  local result = {}
  for number in body:gmatch('%-?%d+') do result[tonumber(number)] = true end
  return result
end

local function color_hex(track)
  local native = reaper.GetTrackColor(track)
  if native == 0 then return "" end
  local r, g, b = reaper.ColorFromNative(native)
  return string.format("#%02x%02x%02x", r, g, b)
end

local function tracks_json()
  local values = {}
  for index = 0, reaper.CountTracks(0) - 1 do
    local track = reaper.GetTrack(0, index)
    local _, name = reaper.GetTrackName(track)
    local guid = reaper.GetTrackGUID(track)
    values[#values + 1] = string.format(
      '{"id":"%s","index":%d,"name":"%s","selected":%s,"color":"%s"}',
      escape(guid), index, escape(name), reaper.IsTrackSelected(track) and "true" or "false", color_hex(track))
  end
  return table.concat(values, ",")
end

local function write_status()
  local rate = reaper.GetSetProjectInfo(0, "PROJECT_SRATE", 0, false)
  if rate <= 0 then rate = 48000 end
  local now = os.time() * 1000
  write_file(status_path, string.format(
    '{"hostName":"REAPER","adapter":"Orb REAPER (ReaScript)","connected":true,"trackListing":true,"exportMode":"native","updatedAtMs":%d,"sampleRate":%d,"bitDepth":24,"tracks":[%s]}',
    now, math.floor(rate), tracks_json()))
end

local function file_size(path)
  local file = io.open(path, "rb"); if not file then return 0 end
  local size = file:seek("end") or 0; file:close(); return size
end

local function safe_name(value)
  value = value:gsub('[\\/:*?"<>|%c]', '_'):gsub('^%s+', ''):gsub('%s+$', '')
  return value ~= "" and value or "Track"
end

local function export_stems(source, id)
  local selected = json_indices(source)
  local mode = json_string(source, "rangeMode") or "session"
  local output_dir = exports_root .. "/" .. id
  reaper.RecursiveCreateDirectory(output_dir, 0)

  local old_selected = {}
  for i = 0, reaper.CountTracks(0) - 1 do
    local track = reaper.GetTrack(0, i)
    old_selected[i] = reaper.IsTrackSelected(track)
    reaper.SetTrackSelected(track, selected[i] == true)
  end
  local _, old_file = reaper.GetSetProjectInfo_String(0, "RENDER_FILE", "", false)
  local _, old_pattern = reaper.GetSetProjectInfo_String(0, "RENDER_PATTERN", "", false)
  local _, old_format = reaper.GetSetProjectInfo_String(0, "RENDER_FORMAT", "", false)
  local old_settings = reaper.GetSetProjectInfo(0, "RENDER_SETTINGS", 0, false)
  local old_bounds = reaper.GetSetProjectInfo(0, "RENDER_BOUNDSFLAG", 0, false)
  local start_time, end_time = reaper.GetSet_LoopTimeRange2(0, false, false, 0, 0, false)
  if mode == "selection" and end_time <= start_time then error("Make a time selection in REAPER before sharing.") end

  reaper.GetSetProjectInfo_String(0, "RENDER_FILE", output_dir, true)
  reaper.GetSetProjectInfo_String(0, "RENDER_PATTERN", "$track", true)
  reaper.GetSetProjectInfo_String(0, "RENDER_FORMAT", "evaw", true)
  reaper.GetSetProjectInfo(0, "RENDER_SETTINGS", 2, true)
  reaper.GetSetProjectInfo(0, "RENDER_BOUNDSFLAG", mode == "selection" and 2 or 1, true)
  write_file(root .. "/export-" .. id .. ".json", '{"id":"' .. id .. '","status":"rendering","progress":0.15,"message":"Rendering REAPER stems"}')
  reaper.Main_OnCommand(42230, 0)

  reaper.GetSetProjectInfo_String(0, "RENDER_FILE", old_file, true)
  reaper.GetSetProjectInfo_String(0, "RENDER_PATTERN", old_pattern, true)
  reaper.GetSetProjectInfo_String(0, "RENDER_FORMAT", old_format, true)
  reaper.GetSetProjectInfo(0, "RENDER_SETTINGS", old_settings, true)
  reaper.GetSetProjectInfo(0, "RENDER_BOUNDSFLAG", old_bounds, true)
  for i = 0, reaper.CountTracks(0) - 1 do reaper.SetTrackSelected(reaper.GetTrack(0, i), old_selected[i]) end

  local files, index = {}, 0
  local rate = reaper.GetSetProjectInfo(0, "PROJECT_SRATE", 0, false); if rate <= 0 then rate = 48000 end
  while true do
    local name = reaper.EnumerateFiles(output_dir, index); if not name then break end
    if name:lower():match('%.wav$') then
      local path = output_dir .. "/" .. name
      files[#files + 1] = string.format('{"path":"%s","name":"%s","size":%d,"mimeType":"audio/wav","sampleRate":%d,"bitDepth":24,"sourceSamples":%d}',
        escape(path), escape(name), file_size(path), math.floor(rate), math.floor(start_time * rate))
    end
    index = index + 1
  end
  if #files == 0 then error("REAPER finished rendering but returned no WAV files.") end
  write_file(root .. "/export-" .. id .. ".json", string.format(
    '{"id":"%s","status":"complete","progress":1,"sampleRate":%d,"bitDepth":24,"files":[%s]}', id, math.floor(rate), table.concat(files, ",")))
end

local function handle_request(source)
  local id = json_string(source, "id") or ""
  if id == "" or id == last_request then return end
  last_request = id
  local action = json_string(source, "action")
  if action == "select" then
    local index = json_number(source, "trackIndex")
    if index then reaper.SetTrackSelected(reaper.GetTrack(0, index), json_bool(source, "selected")) end
  elseif action == "export" then
    local ok, message = xpcall(function() export_stems(source, id) end, debug.traceback)
    if not ok then write_file(root .. "/export-" .. id .. ".json", '{"id":"' .. escape(id) .. '","status":"error","progress":0,"message":"' .. escape(message) .. '"}') end
  end
end

local function loop()
  write_status()
  local source = read_file(request_path); if source then handle_request(source) end
  reaper.defer(loop)
end

reaper.atexit(function() os.remove(status_path) end)
loop()
