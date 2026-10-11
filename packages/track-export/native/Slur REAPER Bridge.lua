-- Slur REAPER bridge: lets the Slur plug-in list tracks, render selected track
-- stems and read item layouts in the open project, without satellite plug-ins.
-- Installed by packages/track-export/install.mjs as a REAPER startup script.
-- Local file IPC only (no sockets): ~/Library/Application Support/Slur/HostControl/reaper
-- Requests: request-<id>.json  →  responses: response-<id>.json (atomic rename).

local VERSION = 1
local root = os.getenv("HOME") .. "/Library/Application Support/Slur/HostControl/reaper"
local last_status = 0

-- ── tiny JSON ───────────────────────────────────────────────────────────────
local function esc(s)
  return (tostring(s or ""):gsub('[%c"\\]', function(c)
    local map = { ['"'] = '\\"', ['\\'] = '\\\\', ['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t' }
    return map[c] or string.format("\\u%04x", c:byte())
  end))
end
local function encode(v)
  local t = type(v)
  if t == "nil" then return "null" end
  if t == "boolean" then return v and "true" or "false" end
  if t == "number" then
    if v ~= v or v == math.huge or v == -math.huge then return "null" end
    if math.type and math.type(v) == "integer" then return tostring(v) end
    return string.format("%.17g", v)
  end
  if t == "string" then return '"' .. esc(v) .. '"' end
  if v[1] ~= nil or next(v) == nil and getmetatable(v) == "array" then
    local out = {}
    for i = 1, #v do out[i] = encode(v[i]) end
    return "[" .. table.concat(out, ",") .. "]"
  end
  local out = {}
  for k, x in pairs(v) do out[#out + 1] = '"' .. esc(k) .. '":' .. encode(x) end
  return "{" .. table.concat(out, ",") .. "}"
end
local function array(t) return setmetatable(t, { __metatable = "array" }) end

local function decode(s)
  local i = 1
  local function ws() i = s:find("[^ \t\r\n]", i) or #s + 1 end
  local value
  local function str()
    local out, j = {}, i + 1
    while true do
      local c = s:sub(j, j)
      if c == "" then error("bad json string") end
      if c == '"' then i = j + 1; return table.concat(out) end
      if c == "\\" then
        local n = s:sub(j + 1, j + 1)
        local map = { ['"'] = '"', ['\\'] = '\\', ['/'] = '/', b = '\b', f = '\f', n = '\n', r = '\r', t = '\t' }
        if n == "u" then out[#out + 1] = utf8.char(tonumber(s:sub(j + 2, j + 5), 16)); j = j + 6
        else out[#out + 1] = map[n] or n; j = j + 2 end
      else out[#out + 1] = c; j = j + 1 end
    end
  end
  function value()
    ws()
    local c = s:sub(i, i)
    if c == "{" then
      local t = {}; i = i + 1; ws()
      if s:sub(i, i) == "}" then i = i + 1; return t end
      while true do
        ws(); local k = str(); ws(); i = i + 1 -- ':'
        t[k] = value(); ws()
        local d = s:sub(i, i); i = i + 1
        if d == "}" then return t end
      end
    elseif c == "[" then
      local t = {}; i = i + 1; ws()
      if s:sub(i, i) == "]" then i = i + 1; return t end
      while true do
        t[#t + 1] = value(); ws()
        local d = s:sub(i, i); i = i + 1
        if d == "]" then return t end
      end
    elseif c == '"' then return str()
    elseif s:sub(i, i + 3) == "true" then i = i + 4; return true
    elseif s:sub(i, i + 4) == "false" then i = i + 5; return false
    elseif s:sub(i, i + 3) == "null" then i = i + 4; return nil
    else
      local num = s:match("^-?%d+%.?%d*[eE]?[-+]?%d*", i)
      if not num or num == "" then error("bad json") end
      i = i + #num; return tonumber(num)
    end
  end
  return value()
end

-- ── files ───────────────────────────────────────────────────────────────────
local function write_atomic(path, text)
  local tmp = path .. ".tmp"
  local f = io.open(tmp, "wb"); if not f then return false end
  f:write(text); f:close()
  os.remove(path)
  return os.rename(tmp, path)
end
local function read_all(path)
  local f = io.open(path, "rb"); if not f then return nil end
  local s = f:read("*a"); f:close(); return s
end

-- ── project facts ───────────────────────────────────────────────────────────
local function project_info()
  local _, path = reaper.EnumProjects(-1)
  local rate = reaper.GetSetProjectInfo(0, "PROJECT_SRATE", 0, false)
  if not rate or rate <= 0 then rate = tonumber(select(2, reaper.GetAudioDeviceInfo("SRATE"))) or 48000 end
  local ts, te = reaper.GetSet_LoopTimeRange2(0, false, false, 0, 0, false)
  return {
    path = path or "", name = reaper.GetProjectName(0, ""), sampleRate = math.floor(rate + 0.5),
    revision = reaper.GetProjectStateChangeCount(0), length = reaper.GetProjectLength(0),
    selection = (te > ts) and array({ ts, te }) or nil,
    playing = reaper.GetPlayState() & 1 == 1 or reaper.GetPlayState() & 4 == 4,
  }
end

local function track_list()
  local out = array({})
  for i = 0, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    local _, name = reaper.GetTrackName(tr)
    out[#out + 1] = {
      id = reaper.GetTrackGUID(tr), index = i, name = name,
      channels = math.floor(reaper.GetMediaTrackInfo_Value(tr, "I_NCHAN")),
      folder = reaper.GetMediaTrackInfo_Value(tr, "I_FOLDERDEPTH") > 0,
      selected = reaper.IsTrackSelected(tr), items = reaper.CountTrackMediaItems(tr),
    }
  end
  return out
end

local function item_list()
  local out = array({})
  for i = 0, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    local tguid = reaper.GetTrackGUID(tr)
    for j = 0, reaper.CountTrackMediaItems(tr) - 1 do
      local it = reaper.GetTrackMediaItem(tr, j)
      local take = reaper.GetActiveTake(it)
      local _, iguid = reaper.GetSetMediaItemInfo_String(it, "GUID", "", false)
      local entry = {
        id = iguid, trackId = tguid, position = reaper.GetMediaItemInfo_Value(it, "D_POSITION"),
        length = reaper.GetMediaItemInfo_Value(it, "D_LENGTH"), mute = reaper.GetMediaItemInfo_Value(it, "B_MUTE") ~= 0,
        loop = reaper.GetMediaItemInfo_Value(it, "B_LOOPSRC") ~= 0, volume = reaper.GetMediaItemInfo_Value(it, "D_VOL"),
        fadeIn = reaper.GetMediaItemInfo_Value(it, "D_FADEINLEN"), fadeOut = reaper.GetMediaItemInfo_Value(it, "D_FADEOUTLEN"),
      }
      if take then
        local src = reaper.GetMediaItemTake_Source(take)
        local kind = reaper.GetMediaSourceType(src, "")
        local file = reaper.GetMediaSourceFileName(src, "")
        local _, tname = reaper.GetSetMediaItemTakeInfo_String(take, "P_NAME", "", false)
        -- retval, offset, length, reversed
        local _, _, _, reversed = reaper.PCM_Source_GetSectionInfo(src)
        entry.name = tname; entry.sourceType = kind; entry.file = file
        entry.offset = reaper.GetMediaItemTakeInfo_Value(take, "D_STARTOFFS")
        entry.playrate = reaper.GetMediaItemTakeInfo_Value(take, "D_PLAYRATE")
        entry.pitch = reaper.GetMediaItemTakeInfo_Value(take, "D_PITCH")
        entry.takeVolume = reaper.GetMediaItemTakeInfo_Value(take, "D_VOL")
        entry.reversed = reversed == true
        entry.envelopes = reaper.CountTakeEnvelopes(take)
        entry.midi = reaper.TakeIsMIDI(take)
      end
      out[#out + 1] = entry
    end
  end
  return out
end

-- Offline stem render of the given tracks over [start, finish) seconds into dir.
-- Every project setting and the track selection are restored afterwards.
local function render(req)
  local dir, start, finish = req.dir, tonumber(req.start), tonumber(req.finish)
  if type(dir) ~= "string" or not dir:find("^/") or not start or not finish or finish <= start then error("Invalid render request.") end
  local wanted = {}
  for _, g in ipairs(req.trackIds or {}) do wanted[g] = true end
  local saved_sel, by_number = {}, {}
  for i = 0, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    saved_sel[i] = reaper.IsTrackSelected(tr)
  end
  local strings = { "RENDER_FILE", "RENDER_PATTERN", "RENDER_FORMAT" }
  local numbers = { "RENDER_SETTINGS", "RENDER_BOUNDSFLAG", "RENDER_STARTPOS", "RENDER_ENDPOS", "RENDER_TAILFLAG",
    "RENDER_SRATE", "RENDER_CHANNELS", "RENDER_ADDTOPROJ", "RENDER_DITHER", "RENDER_NORMALIZE" }
  local old = {}
  for _, k in ipairs(strings) do old[k] = select(2, reaper.GetSetProjectInfo_String(0, k, "", false)) end
  for _, k in ipairs(numbers) do old[k] = reaper.GetSetProjectInfo(0, k, 0, false) end
  local ok, err = pcall(function()
    reaper.PreventUIRefresh(1)
    local found = 0
    for i = 0, reaper.CountTracks(0) - 1 do
      local tr = reaper.GetTrack(0, i)
      local g = reaper.GetTrackGUID(tr)
      reaper.SetTrackSelected(tr, wanted[g] == true)
      if wanted[g] then found = found + 1; by_number[i + 1] = g end
    end
    reaper.PreventUIRefresh(-1)
    if found ~= #(req.trackIds or {}) then error("A selected track no longer exists. Refresh the track list.") end
    reaper.GetSetProjectInfo_String(0, "RENDER_FILE", dir, true)
    reaper.GetSetProjectInfo_String(0, "RENDER_PATTERN", "slur-$tracknumber", true)
    reaper.GetSetProjectInfo_String(0, "RENDER_FORMAT", "ZXZhdxgAAA==", true) -- WAV, 24-bit
    reaper.GetSetProjectInfo(0, "RENDER_SETTINGS", 2, true)        -- stems (selected tracks) only
    reaper.GetSetProjectInfo(0, "RENDER_BOUNDSFLAG", 0, true)      -- custom time range
    reaper.GetSetProjectInfo(0, "RENDER_STARTPOS", start, true)
    reaper.GetSetProjectInfo(0, "RENDER_ENDPOS", finish, true)
    reaper.GetSetProjectInfo(0, "RENDER_TAILFLAG", 0, true)        -- equal lengths, no tails
    reaper.GetSetProjectInfo(0, "RENDER_SRATE", 0, true)           -- project rate
    reaper.GetSetProjectInfo(0, "RENDER_CHANNELS", 2, true)
    reaper.GetSetProjectInfo(0, "RENDER_ADDTOPROJ", 0, true)
    reaper.GetSetProjectInfo(0, "RENDER_NORMALIZE", 0, true)
    reaper.Main_OnCommand(42230, 0) -- Render project, most recent settings, auto-close dialog
  end)
  for _, k in ipairs(strings) do reaper.GetSetProjectInfo_String(0, k, old[k], true) end
  for _, k in ipairs(numbers) do reaper.GetSetProjectInfo(0, k, old[k], true) end
  reaper.PreventUIRefresh(1)
  for i = 0, reaper.CountTracks(0) - 1 do
    if saved_sel[i] ~= nil then reaper.SetTrackSelected(reaper.GetTrack(0, i), saved_sel[i]) end
  end
  reaper.PreventUIRefresh(-1)
  if not ok then error(err) end
  local files = array({})
  local i = 0
  while true do
    local name = reaper.EnumerateFiles(dir, i); if not name then break end
    local n = tonumber(name:match("^slur%-(%d+)%.wav$"))
    if n and by_number[n] then files[#files + 1] = { trackId = by_number[n], path = dir .. "/" .. name } end
    i = i + 1
  end
  return { files = files }
end

local handlers = {
  tracks = function() return { project = project_info(), tracks = track_list() } end,
  items = function() return { project = project_info(), tracks = track_list(), items = item_list() } end,
  render = render,
}

local function handle(path, id)
  local text = read_all(path); os.remove(path)
  local ok, result = pcall(function()
    local req = decode(text or "")
    local fn = handlers[req.command or ""]
    if not fn then error("Unknown command.") end
    return fn(req)
  end)
  local body = ok and result or { error = tostring(result):gsub("^.-:%d+: ", "") }
  body.ok = ok
  write_atomic(root .. "/response-" .. id .. ".json", encode(body))
end

local function loop()
  local now = reaper.time_precise()
  if now - last_status > 1 then
    last_status = now
    write_atomic(root .. "/status.json", encode({ version = VERSION, heartbeatMs = math.floor(os.time() * 1000), pid = 0 }))
  end
  local i = 0
  while true do
    local name = reaper.EnumerateFiles(root, i); if not name then break end
    local id = name:match("^request%-([%w%-]+)%.json$")
    if id then handle(root .. "/" .. name, id); break end
    i = i + 1
  end
  reaper.defer(loop)
end

reaper.RecursiveCreateDirectory(root, 0)
reaper.atexit(function() os.remove(root .. "/status.json") end)
loop()
