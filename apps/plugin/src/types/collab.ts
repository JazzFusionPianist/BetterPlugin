export interface Profile {
  id: string
  display_name: string
  /** Unique lowercase handle (3-20 chars); shown as @username. */
  username?: string | null
  avatar_color: string
  avatar_url?: string | null
  initials: string
  isOnline: boolean
  is_verified: boolean
  is_admin: boolean
  /** Signup-order membership number (#000001 = first user). */
  member_no?: number | null
  /** Short self-description (≤160 chars), shown on the profile page. */
  bio?: string | null
}

export type AttachType =
  | 'image' | 'video' | 'audio' | 'multi-audio'
  /** Special chat bubble for in-chat game invites. `attachment_url`
   *  holds the room id and `attachment_name` holds the game type
   *  ('chess' | 'falling_blocks' | 'poker' | 'ear_training'). */
  | 'game_invite'
  /** Generic non-media attachment (e.g. the studio's "send as zip"
   *  bundle) — renders as the plain file card. */
  | 'file'

export interface TempoMapPoint {
  ppq: number
  bpm: number
}

export interface TimeSignatureMapPoint {
  ppq: number
  numerator: number
  denominator: number
}

/** Host transport/cycle state frozen at the drop. Logic stamps a
 *  promise-exported region relative to the CYCLE start while the cycle
 *  is on, not project zero — the loop locators let ingestion translate
 *  the stamp back into an absolute project position. Kept verbatim so
 *  display logic can evolve without re-uploading. */
export interface DawDropAnchor {
  /** Host cycle/loop enabled at the drop. Absent → old plug-in binary
   *  that never reported loop state (basis stays 'unknown'). */
  is_looping?: boolean
  /** Cycle left/right locators in quarter notes from project zero. */
  loop_start_ppq?: number
  loop_end_ppq?: number
  /** Playhead ppq + samples read in the SAME processBlock — one
   *  consistent instant, usable as a seconds↔ppq anchor. */
  ppq?: number
  samples?: number
  /** The playhead's OWN bar grid at the same instant: the host's bar
   *  count and the quarter-note position of that bar's start
   *  (ppqPositionOfLastBarStart), plus the meter it was counted in.
   *  Bar numbering is anchored HERE — bar_of(x) = (bar_count + 1) +
   *  floor((x − bar_ppq) / barLength) — so no assumption about where
   *  ppq zero sits (count-in / project-start offsets included) is ever
   *  needed. Absent on older records → display falls back to the old
   *  zero-anchored reading. */
  bar_count?: number
  bar_ppq?: number
  tnum?: number
  tden?: number
}

export interface AttachmentTimelineMetadata {
  schema_version: 1
  position: {
    /** Absolute source timestamp in samples when the audio carries one. */
    source_samples?: number
    sample_rate?: number
    bit_depth?: number
    seconds?: number
    ppq?: number
    bar?: number
    beat?: number
    /** Project-absolute quarter-note position, computed at ingestion
     *  from the raw stamp + the drop-time anchor (see `basis`). */
    absolute_ppq?: number
    /** What the file's stamp was measured against when absolute_ppq
     *  was derived: 'cycle' (Logic's cycle was on — stamp counts from
     *  the left locator), 'project' (stamp counts from project zero),
     *  or 'unknown' (no anchor — display falls back to the relative
     *  reading and says so). */
    basis?: 'cycle' | 'project' | 'unknown'
    /** Set when the file was padded with silence to project bar 1 on
     *  upload (studio FILES tab): the project-absolute quarter-note
     *  position the audio ORIGINALLY started at — the padding's musical
     *  length — so nothing about the source position is lost. */
    aligned_from_ppq?: number
    source: 'bwf' | 'ixml' | 'daw_playhead' | 'ptsl' | 'luna'
    confidence: 'exact' | 'estimated'
  }
  tempo_map?: TempoMapPoint[]
  time_signature_map?: TimeSignatureMapPoint[]
  /** Host transport tempo/meter at capture — lets a receiver compute
   *  which bar a sample-exact stem starts at without a full tempo map. */
  bpm?: number
  time_sig_num?: number
  time_sig_den?: number
  /** Raw host snapshot the absolute position was derived from. */
  anchor?: DawDropAnchor
  captured_at: string
}

export interface Message {
  id: string
  /** Owning conversation. Drives realtime filtering, RLS, and unread
   *  bookkeeping. Replaces the legacy `receiver_id` column — for DMs
   *  the partner is now derived via `conversation_members`. */
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  attachment_url?: string | null
  attachment_type?: AttachType | null
  attachment_name?: string | null
  attachment_metadata?: AttachmentTimelineMetadata | null
  attachment_expires_at?: string | null   // ISO timestamp, 7 days after upload
  attachment_expired?: boolean            // true once storage object is deleted
}

export type ConversationKind = 'dm' | 'group'

export interface Conversation {
  id: string
  kind: ConversationKind
  title: string | null      // group display name; null for DMs
  created_by: string
  created_at: string
  /** User IDs of every member. Always populated by `useConversations`
   *  — DMs are exactly two, groups are 2..16. */
  member_ids: string[]
}

/** What chat the user has open — a DM with a specific friend, a group
 *  identified by conversation_id, or nothing. Threaded through
 *  useMessages and ChatView so both surfaces stay agnostic about
 *  which kind is active. */
export type ChatTarget =
  | { kind: 'dm';    otherUserId:    string; conversationId?: string }
  | { kind: 'group'; conversationId: string }

export interface AppNotification {
  id: string
  type: 'follow' | 'game_invite'
  read: boolean
  created_at: string
  actor: {
    id: string
    display_name: string
    avatar_color: string
    avatar_url?: string | null
  }
  metadata?: { room_id?: string; game_type?: string } | null
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
}

// ── Poker (Texas Hold'em) ────────────────────────────────────────────────

export type PokerRound = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'hand_end'

export interface PokerHandEvalSnapshot {
  user_id: string
  rank_name: string         // e.g. "Two Pair", "Flush"
  best_cards: string[]      // 5-card best hand
  hole_cards: string[]      // hole cards revealed
}

export interface PokerRoomState {
  hand_number: number
  dealer_index: number              // index in player_ids
  betting_round: PokerRound
  deck: string[]                    // remaining cards in deck
  community_cards: string[]         // up to 5
  pot: number
  current_bet: number               // amount required to call this round
  min_raise: number
  current_player_index: number      // whose turn to act
  small_blind: number
  big_blind: number
  last_aggressor_index: number      // for end-of-betting-round detection
  // Populated at showdown — public reveal of contesting players' hands
  showdown?: PokerHandEvalSnapshot[]
  hand_winner_ids?: string[]        // winners of the most recent hand (for split pots)
  hand_winner_amount?: number       // chips each winner got
}

export interface PokerRoom {
  id: string
  host_id: string
  player_count: 2 | 3 | 4 | 5 | 6
  status: 'lobby' | 'playing' | 'finished'
  player_ids: string[]              // host first
  ready_ids: string[]
  state: PokerRoomState | Record<string, never>  // {} during lobby
  winner_id: string | null          // last player standing
  created_at: string
  updated_at: string
}

export interface PokerPlayerState {
  room_id: string
  user_id: string
  chips: number
  current_bet: number
  folded: boolean
  all_in: boolean
  acted: boolean
}

export interface PokerHoleCards {
  room_id: string
  user_id: string
  cards: string[]                   // ["AS", "KH"] — 2 cards
}

export interface FallingBlocksRoom {
  id: string
  host_id: string
  player_count: 2 | 3 | 4
  status: 'lobby' | 'playing' | 'finished'
  player_ids: string[]    // host is always [0]
  ready_ids: string[]
  winner_id: string | null
  created_at: string
  updated_at: string
}

export interface FallingBlocksPlayerState {
  room_id: string
  user_id: string
  board: (string | null)[][]   // 20 rows × 10 cols, cell holds piece type ('I','O',...) or null
  score: number
  lines: number
  top_out: boolean
  garbage_pending: number
  updated_at: string
}

export interface YachtState {
  turn: number                 // index into player_ids
  round: number                // 1..12
  dice: number[]               // 5 dice; 0 = not yet rolled this turn
  held: boolean[]
  rollsLeft: number            // 3 → 0 per turn
  cards: Record<string, (number | null)[]>   // per-player 12-slot scorecard
}

export interface YachtRoom {
  id: string
  host_id: string
  player_count: 2 | 3 | 4
  status: 'lobby' | 'playing' | 'finished'
  player_ids: string[]    // host is always [0]
  ready_ids: string[]
  state: YachtState | Record<string, never>   // {} during lobby
  winner_id: string | null
  created_at: string
  updated_at: string
}

export interface EarTrainingRoom {
  id: string
  player1_id: string
  player2_id: string | null
  status: 'lobby' | 'playing' | 'finished'
  player1_ready: boolean
  player2_ready: boolean
  player1_score: number
  player2_score: number
  current_round: number
  total_rounds: number
  player1_answer: string | null
  player2_answer: string | null
  round_started_at: string | null
  config: {
    modes: ('interval' | 'chord')[]
    difficulty: 'basic' | 'intermediate' | 'advanced'
  }
  winner_id: string | null
  created_at: string
  updated_at: string
}

export interface GameRoom {
  id: string
  game_type: 'chess'
  host_id: string
  guest_id: string | null
  status: 'lobby' | 'playing' | 'finished'
  board: (string | null)[][] | null   // ChessBoard serialized
  turn: 'white' | 'black'
  host_color: 'white' | 'black'
  winner_id: string | null
  draw_offered_by: string | null
  captured: { white: string[]; black: string[] }
  move_history: string[]   // algebraic notation
  /** Last move's squares ([row, col]) — synced so BOTH players see the highlight. */
  last_from?: [number, number] | null
  last_to?: [number, number] | null
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean }
  en_passant: [number, number] | null
  halfmove: number
  host_ready: boolean
  guest_ready: boolean
  created_at: string
  updated_at: string
}

/** connect4 / gomoku / reversi — one shared room shape (board_rooms).
 *  Seats are host / guest; `turn` and `first_player` name a seat. The
 *  board is a plain grid of 'h' | 'g' | null (see lib/boardGames). */
export type BoardGameType = 'connect4' | 'gomoku' | 'reversi'
export type BoardSeat = 'host' | 'guest'
export interface BoardRoom {
  id: string
  game_type: BoardGameType
  host_id: string
  guest_id: string | null
  status: 'lobby' | 'playing' | 'finished'
  board: (string | null)[][] | null
  turn: BoardSeat
  first_player: BoardSeat
  computer: boolean
  winner_id: string | null
  last_move: [number, number] | null
  move_count: number
  host_ready: boolean
  guest_ready: boolean
  created_at: string
  updated_at: string
}
