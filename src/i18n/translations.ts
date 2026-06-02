import type { Lang } from './types'

/**
 * Translation dictionary. Each key maps to a Partial<Record<Lang, string>>
 * — 'en' is required (enforced via TKey type below), other languages are
 * optional and fall back to English at runtime.
 *
 * Key naming convention:
 *   <surface>.<thing>   e.g. settings.title, chat.sendButton
 *   common.<thing>      shared across multiple surfaces
 *
 * Add new keys here as you wire t() into more components. Phase 1 covers
 * the core navigation surfaces — Settings, Notifications, chat / friends
 * / live headers, common buttons. Game UIs, error toasts, and other
 * long-tail strings get added in later phases.
 */

type TranslationRecord = { en: string } & Partial<Record<Lang, string>>

export const T = {
  // ───── Common buttons / actions ─────────────────────────────────────────
  'common.back':   { en: 'Back',   ko: '뒤로',   ja: '戻る',     zh: '返回',  es: 'Atrás',     de: 'Zurück',    fr: 'Retour',  hi: 'वापस' },
  'common.close':  { en: 'Close',  ko: '닫기',   ja: '閉じる',   zh: '关闭',  es: 'Cerrar',    de: 'Schließen', fr: 'Fermer',  hi: 'बंद करें' },
  'common.cancel': { en: 'Cancel', ko: '취소',   ja: 'キャンセル', zh: '取消',  es: 'Cancelar',  de: 'Abbrechen', fr: 'Annuler', hi: 'रद्द करें' },
  'common.save':   { en: 'Save',   ko: '저장',   ja: '保存',     zh: '保存',  es: 'Guardar',   de: 'Speichern', fr: 'Enregistrer', hi: 'सहेजें' },
  'common.send':   { en: 'Send',   ko: '보내기', ja: '送信',     zh: '发送',  es: 'Enviar',    de: 'Senden',    fr: 'Envoyer', hi: 'भेजें' },
  'common.delete': { en: 'Delete', ko: '삭제',   ja: '削除',     zh: '删除',  es: 'Eliminar',  de: 'Löschen',   fr: 'Supprimer', hi: 'हटाएं' },
  'common.loading':{ en: 'Loading…', ko: '불러오는 중…', ja: '読み込み中…', zh: '加载中…', es: 'Cargando…', de: 'Lädt…', fr: 'Chargement…', hi: 'लोड हो रहा है…' },
  'common.yes':    { en: 'Yes', ko: '예',  ja: 'はい', zh: '是', es: 'Sí',  de: 'Ja',   fr: 'Oui', hi: 'हाँ' },
  'common.no':     { en: 'No',  ko: '아니오', ja: 'いいえ', zh: '否', es: 'No', de: 'Nein', fr: 'Non', hi: 'नहीं' },
  'common.online': { en: 'online',  ko: '온라인', ja: 'オンライン', zh: '在线', es: 'en línea', de: 'online', fr: 'en ligne', hi: 'ऑनलाइन' },
  'common.offline':{ en: 'offline', ko: '오프라인', ja: 'オフライン', zh: '离线', es: 'sin conexión', de: 'offline', fr: 'hors ligne', hi: 'ऑफ़लाइन' },

  // ───── Settings ─────────────────────────────────────────────────────────
  'settings.findPeople':   { en: 'Find people',  ko: '사용자 찾기', ja: 'ユーザーを探す', zh: '查找用户',   es: 'Buscar personas', de: 'Leute finden', fr: 'Trouver des personnes', hi: 'लोगों को खोजें' },
  'settings.display':      { en: 'Display',      ko: '디스플레이', ja: '表示',         zh: '显示',      es: 'Pantalla',        de: 'Anzeige',      fr: 'Affichage',           hi: 'डिस्प्ले' },
  'settings.userInfo':     { en: 'User info',    ko: '사용자 정보', ja: 'ユーザー情報',  zh: '用户信息',   es: 'Información',     de: 'Benutzerinfo', fr: 'Profil',              hi: 'उपयोगकर्ता जानकारी' },
  'settings.notifications':{ en: 'Notifications', ko: '알림',     ja: '通知',          zh: '通知',      es: 'Notificaciones',  de: 'Benachrichtigungen', fr: 'Notifications', hi: 'सूचनाएं' },
  'settings.language':     { en: 'Language',     ko: '언어',     ja: '言語',          zh: '语言',      es: 'Idioma',          de: 'Sprache',      fr: 'Langue',              hi: 'भाषा' },
  'settings.signOut':      { en: 'Sign out',     ko: '로그아웃', ja: 'サインアウト',   zh: '退出登录',  es: 'Cerrar sesión',   de: 'Abmelden',     fr: 'Se déconnecter',      hi: 'साइन आउट' },

  // ───── Language picker ──────────────────────────────────────────────────
  'language.title': { en: 'Language', ko: '언어', ja: '言語', zh: '语言', es: 'Idioma', de: 'Sprache', fr: 'Langue', hi: 'भाषा' },

  // ───── Notifications settings ───────────────────────────────────────────
  'notifSettings.follow':       { en: 'New follower',     ko: '새 팔로워',   ja: '新しいフォロワー', zh: '新粉丝',     es: 'Nuevo seguidor',     de: 'Neuer Follower', fr: 'Nouvel abonné',  hi: 'नया फॉलोअर' },
  'notifSettings.followDesc':   { en: 'When someone follows you', ko: '누군가 당신을 팔로우할 때', ja: 'フォローされたとき', zh: '当有人关注你时', es: 'Cuando alguien te sigue', de: 'Wenn dir jemand folgt', fr: 'Lorsque quelqu’un vous suit', hi: 'जब कोई आपको फॉलो करे' },
  'notifSettings.message':      { en: 'New message',      ko: '새 메시지',   ja: '新しいメッセージ', zh: '新消息',     es: 'Nuevo mensaje',      de: 'Neue Nachricht', fr: 'Nouveau message', hi: 'नया संदेश' },
  'notifSettings.messageDesc':  { en: 'When someone sends you a chat', ko: '누군가 채팅을 보낼 때', ja: 'チャットが届いたとき', zh: '当有人给你发消息时', es: 'Cuando alguien te envía un chat', de: 'Wenn dir jemand schreibt', fr: 'Lorsque quelqu’un vous écrit', hi: 'जब कोई आपको चैट भेजे' },
  'notifSettings.gameTurn':     { en: 'Game turn alert',  ko: '게임 차례 알림', ja: 'ゲームのターン通知', zh: '游戏轮次提醒', es: 'Alerta de turno de juego', de: 'Spielzug-Hinweis', fr: 'Alerte de tour de jeu', hi: 'गेम टर्न अलर्ट' },
  'notifSettings.gameTurnDesc': { en: 'When it\'s your turn', ko: '당신 차례일 때', ja: 'あなたの番になったとき', zh: '轮到你时', es: 'Cuando sea tu turno', de: 'Wenn du am Zug bist', fr: 'Lorsque c’est à votre tour', hi: 'जब आपकी बारी हो' },

  // ───── Header sub-bar (chat) ────────────────────────────────────────────
  'chat.headerOnLive':  { en: '● LIVE',  ko: '● 라이브',  ja: '● ライブ', zh: '● 直播',  es: '● EN VIVO', de: '● LIVE',  fr: '● EN DIRECT', hi: '● लाइव' },
  'chat.joinLive':      { en: 'Join',    ko: '참여',     ja: '参加',     zh: '加入',    es: 'Unirse',    de: 'Beitreten', fr: 'Rejoindre', hi: 'जुड़ें' },

  // ───── Friends list ─────────────────────────────────────────────────────
  'friends.onLive':         { en: 'On Live', ko: '라이브 중', ja: 'ライブ中', zh: '直播中', es: 'En directo', de: 'Live', fr: 'En direct', hi: 'लाइव' },
  'friends.empty':          { en: 'No friends yet', ko: '아직 친구가 없습니다', ja: 'まだ友達がいません', zh: '还没有好友', es: 'Aún no hay amigos', de: 'Noch keine Freunde', fr: 'Pas encore d’amis', hi: 'अभी कोई दोस्त नहीं' },
  'friends.emptyHint':      { en: 'Use the + button above to add friends', ko: '위의 + 버튼으로 친구를 추가하세요', ja: '上の + ボタンで友達を追加', zh: '点击上方 + 添加好友', es: 'Usa el botón + arriba para añadir amigos', de: 'Über das + oben Freunde hinzufügen', fr: 'Utilisez le bouton + en haut pour ajouter des amis', hi: 'दोस्तों को जोड़ने के लिए ऊपर + बटन का उपयोग करें' },
  'friends.noResults':      { en: 'No results', ko: '검색 결과 없음', ja: '結果がありません', zh: '没有结果', es: 'Sin resultados', de: 'Keine Ergebnisse', fr: 'Aucun résultat', hi: 'कोई परिणाम नहीं' },

  // ───── Live viewer / panel ──────────────────────────────────────────────
  'live.connecting':    { en: 'Connecting…',     ko: '연결 중…',  ja: '接続中…', zh: '连接中…', es: 'Conectando…', de: 'Verbinden…', fr: 'Connexion…', hi: 'कनेक्ट हो रहा है…' },
  'live.connectionError':{ en: 'Connection error', ko: '연결 오류', ja: '接続エラー', zh: '连接错误', es: 'Error de conexión', de: 'Verbindungsfehler', fr: 'Erreur de connexion', hi: 'कनेक्शन त्रुटि' },
  'live.audioOnly':     { en: 'Audio only',      ko: '오디오 전용', ja: '音声のみ', zh: '仅音频', es: 'Solo audio', de: 'Nur Audio', fr: 'Audio uniquement', hi: 'केवल ऑडियो' },
  'live.thankYou':      { en: 'Thank you for watching!', ko: '시청해 주셔서 감사합니다!', ja: 'ご視聴ありがとうございました！', zh: '感谢观看！', es: '¡Gracias por ver!', de: 'Danke fürs Zuschauen!', fr: 'Merci d’avoir regardé !', hi: 'देखने के लिए धन्यवाद!' },
  'live.streamEnded':   { en: 'The stream has ended.', ko: '방송이 종료되었습니다.', ja: '配信は終了しました。', zh: '直播已结束。', es: 'La transmisión ha terminado.', de: 'Der Stream ist beendet.', fr: 'La diffusion est terminée.', hi: 'स्ट्रीम समाप्त हो गई है।' },
  'live.streamTitlePlaceholder': { en: 'Stream title (optional)', ko: '방송 제목 (선택)', ja: '配信タイトル（任意）', zh: '直播标题（可选）', es: 'Título de la transmisión (opcional)', de: 'Stream-Titel (optional)', fr: 'Titre du flux (facultatif)', hi: 'स्ट्रीम शीर्षक (वैकल्पिक)' },
  'live.videoSource':   { en: 'Video source', ko: '비디오 소스', ja: 'ビデオソース', zh: '视频源', es: 'Fuente de video', de: 'Videoquelle', fr: 'Source vidéo', hi: 'वीडियो स्रोत' },
  'live.microphone':    { en: 'Microphone', ko: '마이크', ja: 'マイク', zh: '麦克风', es: 'Micrófono', de: 'Mikrofon', fr: 'Microphone', hi: 'माइक्रोफ़ोन' },
  'live.goLive':        { en: 'Go Live', ko: '라이브 시작', ja: 'ライブ開始', zh: '开始直播', es: 'Empezar', de: 'Live gehen', fr: 'Démarrer le direct', hi: 'लाइव जाएं' },
  'live.pickSource':    { en: 'Pick a video source and start streaming to your friends.', ko: '비디오 소스를 선택하고 친구들에게 스트리밍하세요.', ja: 'ビデオソースを選んで友達にライブ配信しましょう。', zh: '选择视频源并向好友直播。', es: 'Elige una fuente de video y empieza a transmitir a tus amigos.', de: 'Wähle eine Videoquelle und streame zu deinen Freunden.', fr: 'Choisissez une source vidéo et diffusez à vos amis.', hi: 'वीडियो स्रोत चुनें और दोस्तों को स्ट्रीम करें।' },

  // ───── Chat ─────────────────────────────────────────────────────────────
  'chat.placeholder':   { en: 'Message',  ko: '메시지', ja: 'メッセージ', zh: '消息', es: 'Mensaje', de: 'Nachricht', fr: 'Message', hi: 'संदेश' },
  'chat.fileExpired':   { en: 'File expired (7 days)', ko: '파일 만료됨 (7일)', ja: 'ファイルの有効期限切れ (7日)', zh: '文件已过期 (7天)', es: 'Archivo expirado (7 días)', de: 'Datei abgelaufen (7 Tage)', fr: 'Fichier expiré (7 jours)', hi: 'फ़ाइल समाप्त (7 दिन)' },
} as const

export type TKey = keyof typeof T

/** Resolve a key to a string in the requested language, with English fallback. */
export function lookup (key: TKey, lang: Lang): string {
  const row = T[key] as TranslationRecord
  return row[lang] ?? row.en
}
