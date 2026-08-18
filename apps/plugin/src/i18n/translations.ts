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
  'common.back':   { en: 'back',   ko: '뒤로',   ja: '戻る',     zh: '返回',  es: 'atrás',     de: 'zurück',    fr: 'retour',  hi: 'वापस' },
  'common.close':  { en: 'close',  ko: '닫기',   ja: '閉じる',   zh: '关闭',  es: 'cerrar',    de: 'schließen', fr: 'fermer',  hi: 'बंद करें' },
  'common.cancel': { en: 'cancel', ko: '취소',   ja: 'キャンセル', zh: '取消',  es: 'cancelar',  de: 'abbrechen', fr: 'annuler', hi: 'रद्द करें' },
  'common.save':   { en: 'save',   ko: '저장',   ja: '保存',     zh: '保存',  es: 'guardar',   de: 'speichern', fr: 'enregistrer', hi: 'सहेजें' },
  'common.send':   { en: 'send',   ko: '보내기', ja: '送信',     zh: '发送',  es: 'enviar',    de: 'senden',    fr: 'envoyer', hi: 'भेजें' },
  'common.delete': { en: 'delete', ko: '삭제',   ja: '削除',     zh: '删除',  es: 'eliminar',  de: 'löschen',   fr: 'supprimer', hi: 'हटाएं' },
  'common.loading':{ en: 'loading…', ko: '불러오는 중…', ja: '読み込み中…', zh: '加载中…', es: 'cargando…', de: 'lädt…', fr: 'chargement…', hi: 'लोड हो रहा है…' },
  'common.yes':    { en: 'yes', ko: '예',  ja: 'はい', zh: '是', es: 'sí',  de: 'ja',   fr: 'oui', hi: 'हाँ' },
  'common.no':     { en: 'no',  ko: '아니오', ja: 'いいえ', zh: '否', es: 'no', de: 'nein', fr: 'non', hi: 'नहीं' },
  'common.online': { en: 'online',  ko: '온라인', ja: 'オンライン', zh: '在线', es: 'en línea', de: 'online', fr: 'en ligne', hi: 'ऑनलाइन' },
  'common.offline':{ en: 'offline', ko: '오프라인', ja: 'オフライン', zh: '离线', es: 'sin conexión', de: 'offline', fr: 'hors ligne', hi: 'ऑफ़लाइन' },

  // ───── Settings ─────────────────────────────────────────────────────────
  'settings.findPeople':   { en: 'find people',  ko: '사용자 찾기', ja: 'ユーザーを探す', zh: '查找用户',   es: 'buscar personas', de: 'Leute finden', fr: 'trouver des personnes', hi: 'लोगों को खोजें' },
  'settings.display':      { en: 'display',      ko: '디스플레이', ja: '表示',         zh: '显示',      es: 'pantalla',        de: 'Anzeige',      fr: 'affichage',           hi: 'डिस्प्ले' },
  'settings.userInfo':     { en: 'user info',    ko: '사용자 정보', ja: 'ユーザー情報',  zh: '用户信息',   es: 'información',     de: 'Benutzerinfo', fr: 'profil',              hi: 'उपयोगकर्ता जानकारी' },
  'settings.notifications':{ en: 'notifications', ko: '알림',     ja: '通知',          zh: '通知',      es: 'notificaciones',  de: 'Benachrichtigungen', fr: 'notifications', hi: 'सूचनाएं' },
  'settings.language':     { en: 'language',     ko: '언어',     ja: '言語',          zh: '语言',      es: 'idioma',          de: 'Sprache',      fr: 'langue',              hi: 'भाषा' },
  'settings.signOut':      { en: 'sign out',     ko: '로그아웃', ja: 'サインアウト',   zh: '退出登录',  es: 'cerrar sesión',   de: 'abmelden',     fr: 'se déconnecter',      hi: 'साइन आउट' },

  // ───── Language picker ──────────────────────────────────────────────────
  'language.title': { en: 'language', ko: '언어', ja: '言語', zh: '语言', es: 'idioma', de: 'Sprache', fr: 'langue', hi: 'भाषा' },

  // ───── Notifications settings ───────────────────────────────────────────
  'notifSettings.follow':       { en: 'new follower',     ko: '새 팔로워',   ja: '新しいフォロワー', zh: '新粉丝',     es: 'nuevo seguidor',     de: 'neuer Follower', fr: 'nouvel abonné',  hi: 'नया फॉलोअर' },
  'notifSettings.followDesc':   { en: 'when someone follows you', ko: '누군가 당신을 팔로우할 때', ja: 'フォローされたとき', zh: '当有人关注你时', es: 'cuando alguien te sigue', de: 'wenn dir jemand folgt', fr: 'lorsque quelqu’un vous suit', hi: 'जब कोई आपको फॉलो करे' },
  'notifSettings.message':      { en: 'new message',      ko: '새 메시지',   ja: '新しいメッセージ', zh: '新消息',     es: 'nuevo mensaje',      de: 'neue Nachricht', fr: 'nouveau message', hi: 'नया संदेश' },
  'notifSettings.messageDesc':  { en: 'when someone sends you a chat', ko: '누군가 채팅을 보낼 때', ja: 'チャットが届いたとき', zh: '当有人给你发消息时', es: 'cuando alguien te envía un chat', de: 'wenn dir jemand schreibt', fr: 'lorsque quelqu’un vous écrit', hi: 'जब कोई आपको चैट भेजे' },
  'notifSettings.gameTurn':     { en: 'game turn alert',  ko: '게임 차례 알림', ja: 'ゲームのターン通知', zh: '游戏轮次提醒', es: 'alerta de turno de juego', de: 'Spielzug-Hinweis', fr: 'alerte de tour de jeu', hi: 'गेम टर्न अलर्ट' },
  'notifSettings.gameTurnDesc': { en: 'when it\'s your turn', ko: '당신 차례일 때', ja: 'あなたの番になったとき', zh: '轮到你时', es: 'cuando sea tu turno', de: 'wenn du am Zug bist', fr: 'lorsque c’est à votre tour', hi: 'जब आपकी बारी हो' },

  // ───── Follow alert cards ("{name}" is replaced with the follower) ──────
  'notif.followsYou': { en: '{name} follows you', ko: '{name}님이 팔로우했어요', ja: '{name}さんにフォローされました', zh: '{name} 关注了你', es: '{name} te sigue', de: '{name} folgt dir jetzt', fr: '{name} vous suit', hi: '{name} ने आपको फ़ॉलो किया' },
  'notif.followBack': { en: 'follow back', ko: '맞팔로우', ja: 'フォローバック', zh: '回关', es: 'seguir también', de: 'zurückfolgen', fr: 'suivre en retour', hi: 'फ़ॉलो बैक' },
  'notif.mutual':     { en: 'you follow each other', ko: '서로 팔로우 중', ja: '相互フォロー中', zh: '互相关注', es: 'os seguís mutuamente', de: 'ihr folgt einander', fr: 'vous vous suivez', hi: 'आप एक-दूसरे को फ़ॉलो करते हैं' },

  // ───── Header sub-bar (chat) ────────────────────────────────────────────
  'chat.headerOnLive':  { en: '● live',  ko: '● 라이브',  ja: '● ライブ', zh: '● 直播',  es: '● en vivo', de: '● live',  fr: '● en direct', hi: '● लाइव' },
  'chat.joinLive':      { en: 'join',    ko: '참여',     ja: '参加',     zh: '加入',    es: 'unirse',    de: 'beitreten', fr: 'rejoindre', hi: 'जुड़ें' },

  // ───── Friends list ─────────────────────────────────────────────────────
  'friends.onLive':         { en: 'live', ko: '라이브 중', ja: 'ライブ中', zh: '直播中', es: 'en directo', de: 'live', fr: 'en direct', hi: 'लाइव' },
  'friends.empty':          { en: 'no one here yet', ko: '아직 아무도 없어요', ja: 'まだ誰もいません', zh: '这里还没有人', es: 'aún no hay nadie', de: 'noch niemand hier', fr: 'personne pour l’instant', hi: 'अभी यहाँ कोई नहीं' },
  'friends.emptyHint':      { en: 'follow people to see them here', ko: '사람들을 팔로우하면 여기에 보여요', ja: 'フォローするとここに表示されます', zh: '关注的人会出现在这里', es: 'sigue a gente para verla aquí', de: 'folge Leuten, um sie hier zu sehen', fr: 'suivez des gens pour les voir ici', hi: 'लोगों को फ़ॉलो करें, वे यहाँ दिखेंगे' },
  'friends.noResults':      { en: 'no results', ko: '검색 결과 없음', ja: '結果がありません', zh: '没有结果', es: 'sin resultados', de: 'keine Ergebnisse', fr: 'aucun résultat', hi: 'कोई परिणाम नहीं' },

  // ───── Live viewer / panel ──────────────────────────────────────────────
  'live.connecting':    { en: 'connecting…',     ko: '연결 중…',  ja: '接続中…', zh: '连接中…', es: 'conectando…', de: 'verbinden…', fr: 'connexion…', hi: 'कनेक्ट हो रहा है…' },
  'live.connectionError':{ en: 'connection lost. try rejoining.', ko: '연결이 끊겼어요. 다시 참여해 보세요.', ja: '接続が切れました。もう一度参加してみてください。', zh: '连接断开，请尝试重新加入。', es: 'conexión perdida. intenta volver a unirte.', de: 'Verbindung verloren. tritt erneut bei.', fr: 'connexion perdue. essayez de rejoindre à nouveau.', hi: 'कनेक्शन टूट गया। फिर से जुड़ने की कोशिश करें।' },
  'live.audioOnly':     { en: 'audio only',      ko: '오디오 전용', ja: '音声のみ', zh: '仅音频', es: 'solo audio', de: 'nur Audio', fr: 'audio uniquement', hi: 'केवल ऑडियो' },
  'live.thankYou':      { en: 'thanks for watching', ko: '시청해 주셔서 감사합니다', ja: 'ご視聴ありがとうございました', zh: '感谢观看', es: 'gracias por ver', de: 'danke fürs Zuschauen', fr: 'merci d’avoir regardé', hi: 'देखने के लिए धन्यवाद' },
  'live.streamEnded':   { en: 'the stream has ended.', ko: '방송이 종료되었습니다.', ja: '配信は終了しました。', zh: '直播已结束。', es: 'la transmisión ha terminado.', de: 'der Stream ist beendet.', fr: 'la diffusion est terminée.', hi: 'स्ट्रीम समाप्त हो गई है।' },
  'live.streamTitlePlaceholder': { en: 'name the session (optional)', ko: '세션 이름 (선택)', ja: 'セッション名（任意）', zh: '给直播起个名字（可选）', es: 'nombra la sesión (opcional)', de: 'Session benennen (optional)', fr: 'nommez la session (facultatif)', hi: 'सेशन का नाम (वैकल्पिक)' },
  'live.videoSource':   { en: 'video source', ko: '비디오 소스', ja: 'ビデオソース', zh: '视频源', es: 'fuente de video', de: 'Videoquelle', fr: 'source vidéo', hi: 'वीडियो स्रोत' },
  'live.microphone':    { en: 'microphone', ko: '마이크', ja: 'マイク', zh: '麦克风', es: 'micrófono', de: 'Mikrofon', fr: 'microphone', hi: 'माइक्रोफ़ोन' },
  'live.goLive':        { en: 'go live', ko: '라이브 시작', ja: 'ライブ開始', zh: '开始直播', es: 'empezar', de: 'live gehen', fr: 'démarrer le direct', hi: 'लाइव जाएं' },
  'live.pickSource':    { en: 'pick a video source and start streaming to your friends.', ko: '비디오 소스를 선택하고 친구들에게 스트리밍하세요.', ja: 'ビデオソースを選んで友達にライブ配信しましょう。', zh: '选择视频源并向好友直播。', es: 'elige una fuente de video y empieza a transmitir a tus amigos.', de: 'wähle eine Videoquelle und streame zu deinen Freunden.', fr: 'choisissez une source vidéo et diffusez à vos amis.', hi: 'वीडियो स्रोत चुनें और दोस्तों को स्ट्रीम करें।' },

  // ───── Chat ─────────────────────────────────────────────────────────────
  'chat.placeholder':   { en: 'message',  ko: '메시지', ja: 'メッセージ', zh: '消息', es: 'mensaje', de: 'Nachricht', fr: 'message', hi: 'संदेश' },
  'chat.fileExpired':   { en: 'expired — files last 7 days', ko: '만료됨 — 파일은 7일 동안 보관돼요', ja: '期限切れ — ファイルの保存期間は7日です', zh: '已过期 — 文件保留 7 天', es: 'expirado — los archivos duran 7 días', de: 'abgelaufen — Dateien halten 7 Tage', fr: 'expiré — les fichiers durent 7 jours', hi: 'समाप्त — फ़ाइलें 7 दिन रहती हैं' },
  'chat.messageWith':   { en: 'message {name}…', ko: '{name}에게 메시지…', ja: '{name}にメッセージ…', zh: '给 {name} 发消息…', es: 'mensaje a {name}…', de: 'Nachricht an {name}…', fr: 'message à {name}…', hi: '{name} को संदेश…' },
  'chat.noMessages':    { en: 'no messages yet — say hi', ko: '아직 메시지가 없어요 — 인사를 건네 보세요', ja: 'まだメッセージがありません — 声をかけてみて', zh: '还没有消息 — 打个招呼吧', es: 'aún no hay mensajes — saluda', de: 'noch keine Nachrichten — sag hallo', fr: 'pas encore de messages — dites bonjour', hi: 'अभी कोई संदेश नहीं — हाय कहें' },
  'chat.sendFailed':    { en: 'message didn\'t send. try again.', ko: '메시지가 전송되지 않았어요. 다시 시도해 주세요.', ja: 'メッセージを送信できませんでした。もう一度お試しください。', zh: '消息未发送，请重试。', es: 'el mensaje no se envió. inténtalo de nuevo.', de: 'Nachricht nicht gesendet. versuch es erneut.', fr: 'le message n’est pas parti. réessayez.', hi: 'संदेश नहीं भेजा गया। फिर से कोशिश करें।' },
  'chat.attachFile':    { en: 'attach file', ko: '파일 첨부', ja: 'ファイルを添付', zh: '附加文件', es: 'adjuntar archivo', de: 'Datei anhängen', fr: 'joindre un fichier', hi: 'फ़ाइल संलग्न करें' },
  'chat.attachPhoto':   { en: 'photo', ko: '사진', ja: '写真', zh: '照片', es: 'foto', de: 'Foto', fr: 'photo', hi: 'फ़ोटो' },
  'chat.attachVideo':   { en: 'video', ko: '동영상', ja: '動画', zh: '视频', es: 'video', de: 'Video', fr: 'vidéo', hi: 'वीडियो' },
  'chat.attachAudio':   { en: 'audio', ko: '오디오', ja: '音声', zh: '音频', es: 'audio', de: 'Audio', fr: 'audio', hi: 'ऑडियो' },
  'chat.dateToday':     { en: 'today', ko: '오늘', ja: '今日', zh: '今天', es: 'hoy', de: 'heute', fr: 'aujourd’hui', hi: 'आज' },

  // ───── Conversations panel ──────────────────────────────────────────────
  'conv.tabAll':         { en: 'all', ko: '전체', ja: 'すべて', zh: '全部', es: 'todo', de: 'alle', fr: 'tout', hi: 'सभी' },
  'conv.tabFavorites':   { en: 'favorites', ko: '즐겨찾기', ja: 'お気に入り', zh: '收藏', es: 'favoritos', de: 'Favoriten', fr: 'favoris', hi: 'पसंदीदा' },
  'conv.emptyAll':       { en: 'no conversations yet — say hi from the orbit', ko: '아직 대화가 없어요 — 궤도에서 인사를 건네 보세요', ja: 'まだ会話がありません — オービットから声をかけてみて', zh: '还没有对话 — 在轨道上打个招呼吧', es: 'aún no hay conversaciones — saluda desde la órbita', de: 'noch keine Gespräche — sag hallo aus dem Orbit', fr: 'pas encore de conversations — dites bonjour depuis l’orbite', hi: 'अभी कोई बातचीत नहीं — ऑर्बिट से हाय कहें' },
  'conv.emptyFavorites': { en: 'no favorite conversations', ko: '즐겨찾기한 대화가 없습니다', ja: 'お気に入りの会話がありません', zh: '没有收藏的对话', es: 'no hay conversaciones favoritas', de: 'keine Favoritengespräche', fr: 'aucune conversation favorite', hi: 'कोई पसंदीदा बातचीत नहीं' },
  'conv.youSentPhoto':   { en: 'you sent a photo', ko: '사진을 보냈습니다', ja: '写真を送信しました', zh: '你发送了照片', es: 'enviaste una foto', de: 'du hast ein Foto gesendet', fr: 'vous avez envoyé une photo', hi: 'आपने एक फ़ोटो भेजी' },
  'conv.sentPhoto':      { en: 'sent a photo', ko: '사진을 보냈습니다', ja: '写真を送信しました', zh: '发送了照片', es: 'envió una foto', de: 'hat ein Foto gesendet', fr: 'a envoyé une photo', hi: 'फ़ोटो भेजी' },
  'conv.youSentVideo':   { en: 'you sent a video', ko: '동영상을 보냈습니다', ja: '動画を送信しました', zh: '你发送了视频', es: 'enviaste un video', de: 'du hast ein Video gesendet', fr: 'vous avez envoyé une vidéo', hi: 'आपने एक वीडियो भेजा' },
  'conv.sentVideo':      { en: 'sent a video', ko: '동영상을 보냈습니다', ja: '動画を送信しました', zh: '发送了视频', es: 'envió un video', de: 'hat ein Video gesendet', fr: 'a envoyé une vidéo', hi: 'वीडियो भेजा' },
  'conv.youSentAudio':   { en: 'you sent audio', ko: '오디오를 보냈습니다', ja: '音声を送信しました', zh: '你发送了音频', es: 'enviaste audio', de: 'du hast Audio gesendet', fr: 'vous avez envoyé de l’audio', hi: 'आपने ऑडियो भेजा' },
  'conv.sentAudio':      { en: 'sent audio', ko: '오디오를 보냈습니다', ja: '音声を送信しました', zh: '发送了音频', es: 'envió audio', de: 'hat Audio gesendet', fr: 'a envoyé de l’audio', hi: 'ऑडियो भेजा' },
  'conv.youPrefix':      { en: 'you: {content}', ko: '나: {content}', ja: 'あなた: {content}', zh: '你: {content}', es: 'tú: {content}', de: 'du: {content}', fr: 'vous : {content}', hi: 'आप: {content}' },

  // ───── Display panel ────────────────────────────────────────────────────
  'display.darkMode':       { en: 'dark mode', ko: '다크 모드', ja: 'ダークモード', zh: '深色模式', es: 'modo oscuro', de: 'dunkler Modus', fr: 'mode sombre', hi: 'डार्क मोड' },
  'display.setWallpaper':   { en: 'set wallpaper', ko: '배경 설정', ja: '壁紙を設定', zh: '设置壁纸', es: 'establecer fondo', de: 'Hintergrund festlegen', fr: 'définir le fond', hi: 'वॉलपेपर सेट करें' },
  'display.choose':         { en: 'choose', ko: '선택', ja: '選択', zh: '选择', es: 'elegir', de: 'wählen', fr: 'choisir', hi: 'चुनें' },
  'display.removeWallpaper':{ en: 'remove wallpaper', ko: '배경 제거', ja: '壁紙を削除', zh: '移除壁纸', es: 'quitar fondo', de: 'Hintergrund entfernen', fr: 'retirer le fond', hi: 'वॉलपेपर हटाएं' },
  'display.remove':         { en: 'remove', ko: '제거', ja: '削除', zh: '移除', es: 'quitar', de: 'entfernen', fr: 'retirer', hi: 'हटाएं' },
  'display.screenSize':     { en: 'screen size', ko: '화면 크기', ja: '画面サイズ', zh: '屏幕大小', es: 'tamaño de pantalla', de: 'Bildschirmgröße', fr: 'taille d\'écran', hi: 'स्क्रीन आकार' },
  'display.size.small':     { en: 'small', ko: '작게', ja: '小', zh: '小', es: 'pequeño', de: 'klein', fr: 'petit', hi: 'छोटा' },
  'display.size.large':     { en: 'large', ko: '크게', ja: '大', zh: '大', es: 'grande', de: 'groß', fr: 'grand', hi: 'बड़ा' },

  // ───── Find people / AddFriend ──────────────────────────────────────────
  'addFriend.search':        { en: 'search by name…', ko: '이름으로 검색…', ja: '名前で検索…', zh: '按姓名搜索…', es: 'buscar por nombre…', de: 'nach Name suchen…', fr: 'rechercher par nom…', hi: 'नाम से खोजें…' },
  'addFriend.searchHint':    { en: 'search for someone to follow', ko: '팔로우할 사람을 검색하세요', ja: 'フォローしたい人を検索', zh: '搜索要关注的人', es: 'busca a alguien para seguir', de: 'suche jemanden zum Folgen', fr: 'rechercher quelqu’un à suivre', hi: 'फॉलो करने के लिए कोई खोजें' },
  'addFriend.mutual':        { en: 'mutual', ko: '상호 팔로우', ja: '相互フォロー', zh: '互相关注', es: 'mutuo', de: 'gegenseitig', fr: 'mutuel', hi: 'पारस्परिक' },
  'addFriend.followsYou':    { en: 'follows you', ko: '나를 팔로우', ja: 'フォロー中', zh: '关注了你', es: 'te sigue', de: 'folgt dir', fr: 'vous suit', hi: 'आपको फॉलो करता है' },
  'addFriend.mutualBtn':     { en: 'mutual ✓', ko: '상호 ✓', ja: '相互 ✓', zh: '互相 ✓', es: 'mutuo ✓', de: 'gegenseitig ✓', fr: 'mutuel ✓', hi: 'पारस्परिक ✓' },
  'addFriend.following':     { en: 'following', ko: '팔로잉', ja: 'フォロー中', zh: '关注中', es: 'siguiendo', de: 'folge ich', fr: 'suivi', hi: 'फॉलो कर रहे हैं' },
  'addFriend.follow':        { en: '+ follow', ko: '+ 팔로우', ja: '+ フォロー', zh: '+ 关注', es: '+ seguir', de: '+ folgen', fr: '+ suivre', hi: '+ फॉलो' },
  'addFriend.followBack':    { en: '+ follow back', ko: '+ 맞팔로우', ja: '+ フォローバック', zh: '+ 回关', es: '+ seguir también', de: '+ zurückfolgen', fr: '+ suivre en retour', hi: '+ वापस फॉलो करें' },
  'addFriend.unfollow':      { en: 'unfollow', ko: '언팔로우', ja: 'フォロー解除', zh: '取消关注', es: 'dejar de seguir', de: 'entfolgen', fr: 'ne plus suivre', hi: 'अनफॉलो' },
  'addFriend.loadMore':      { en: 'load more', ko: '더 보기', ja: 'もっと見る', zh: '加载更多', es: 'cargar más', de: 'mehr laden', fr: 'charger plus', hi: 'और लोड करें' },

  // ───── Game list ────────────────────────────────────────────────────────
  'game.chess':              { en: 'chess',          ko: '체스',          ja: 'チェス',         zh: '国际象棋',  es: 'ajedrez',        de: 'Schach',          fr: 'échecs',         hi: 'शतरंज' },
  'game.fallingBlocks':      { en: 'falling blocks', ko: '폴링 블록',     ja: 'フォーリングブロック', zh: '方块下落',  es: 'bloques que caen', de: 'fallende Blöcke', fr: 'blocs qui tombent', hi: 'गिरते ब्लॉक' },
  'game.poker':              { en: 'poker',          ko: '포커',          ja: 'ポーカー',        zh: '扑克',     es: 'póker',          de: 'Poker',           fr: 'poker',          hi: 'पोकर' },
  'game.chessDesc':          { en: 'play vs a friend', ko: '친구와 대결', ja: '友達と対戦', zh: '与好友对战', es: 'juega contra un amigo', de: 'spiele gegen einen Freund', fr: 'jouez contre un ami', hi: 'दोस्त के साथ खेलें' },
  'game.fallingBlocksDesc':  { en: 'battle 2-4 players', ko: '2-4인 대전', ja: '2〜4人で対戦', zh: '2-4 人对战', es: '2-4 jugadores', de: '2–4 Spieler', fr: '2-4 joueurs', hi: '2-4 खिलाड़ी' },
  'game.pokerDesc':          { en: "texas hold'em · 2-6 players", ko: '텍사스 홀덤 · 2-6인', ja: 'テキサスホールデム · 2〜6人', zh: '德州扑克 · 2-6 人', es: 'texas hold’em · 2-6 jugadores', de: 'Texas Hold’em · 2–6 Spieler', fr: 'texas hold’em · 2-6 joueurs', hi: 'टेक्सास होल्ड’एम · 2-6 खिलाड़ी' },

  // ───── Game lobby / common ──────────────────────────────────────────────
  'game.readyToPlay':        { en: 'start a game', ko: '게임을 시작해 보세요', ja: 'ゲームを始めよう', zh: '开始一局游戏', es: 'empieza una partida', de: 'starte ein Spiel', fr: 'lancez une partie', hi: 'एक गेम शुरू करें' },
  'game.inviteFriend':       { en: 'invite a friend',  ko: '친구 초대',      ja: '友達を招待',     zh: '邀请好友',  es: 'invitar a un amigo', de: 'Freund einladen', fr: 'inviter un ami', hi: 'मित्र को आमंत्रित करें' },
  'game.inviteFriends':      { en: 'invite friends',   ko: '친구 초대',      ja: '友達を招待',     zh: '邀请好友',  es: 'invitar amigos',     de: 'Freunde einladen', fr: 'inviter des amis', hi: 'मित्रों को आमंत्रित करें' },
  'game.playComputer':       { en: 'play the computer', ko: '컴퓨터와 대전', ja: 'コンピューターと対戦', zh: '与电脑对战', es: 'jugar contra la computadora', de: 'gegen den Computer spielen', fr: 'jouer contre l’ordinateur', hi: 'कंप्यूटर से खेलें' },
  'game.computerCount':      { en: 'computer opponents', ko: '컴퓨터 상대 수', ja: 'コンピューター人数', zh: '电脑对手数量', es: 'oponentes de computadora', de: 'Computergegner', fr: 'adversaires ordinateur', hi: 'कंप्यूटर प्रतिद्वंद्वी' },
  'game.invite':             { en: 'invite',           ko: '초대',           ja: '招待',          zh: '邀请',     es: 'invitar',           de: 'einladen',        fr: 'inviter',        hi: 'आमंत्रित' },
  'game.invited':            { en: 'invited ✓',        ko: '초대됨 ✓',       ja: '招待済み ✓',    zh: '已邀请 ✓',  es: 'invitado ✓',         de: 'eingeladen ✓',    fr: 'invité ✓',       hi: 'आमंत्रित ✓' },
  'game.noFriendsToInvite':  { en: 'no friends to invite.', ko: '초대할 친구가 없습니다.', ja: '招待できる友達がいません。', zh: '没有可邀请的好友。', es: 'no hay amigos para invitar.', de: 'keine Freunde zum Einladen.', fr: 'aucun ami à inviter.', hi: 'आमंत्रित करने के लिए कोई मित्र नहीं।' },
  'game.noMatch':            { en: 'no friends match "{q}".', ko: '"{q}"와 일치하는 친구가 없습니다.', ja: '"{q}"に一致する友達がいません。', zh: '没有匹配 "{q}" 的好友。', es: 'no hay amigos que coincidan con "{q}".', de: 'keine Freunde stimmen mit „{q}“ überein.', fr: 'aucun ami ne correspond à « {q} ».', hi: '"{q}" से मेल खाने वाला कोई मित्र नहीं।' },
  'game.searchFriends':      { en: 'search friends…', ko: '친구 검색…', ja: '友達を検索…', zh: '搜索好友…', es: 'buscar amigos…', de: 'Freunde suchen…', fr: 'rechercher des amis…', hi: 'मित्र खोजें…' },

  // ───── Game invite via chat ─────────────────────────────────────────────
  'game.invitedYouToPlay':  { en: 'invited you to play {game}', ko: '{game} 게임에 초대했습니다', ja: '{game} に招待しました', zh: '邀请你玩 {game}', es: 'te invitó a jugar {game}', de: 'hat dich zu {game} eingeladen', fr: 'vous a invité à jouer à {game}', hi: 'आपको {game} खेलने के लिए आमंत्रित किया' },
  'game.youInvitedToPlay':  { en: 'you invited everyone to play {game}', ko: '{game} 게임에 모두를 초대했습니다', ja: '{game} に全員を招待しました', zh: '你邀请大家玩 {game}', es: 'invitaste a todos a jugar {game}', de: 'du hast alle zu {game} eingeladen', fr: 'vous avez invité tout le monde à jouer à {game}', hi: 'आपने सभी को {game} खेलने के लिए आमंत्रित किया' },
  'game.joinGame':          { en: 'join game', ko: '게임 참여', ja: 'ゲームに参加', zh: '加入游戏', es: 'unirse al juego', de: 'Spiel beitreten', fr: 'rejoindre la partie', hi: 'खेल में शामिल हों' },
  'game.roomFull':          { en: 'room is full', ko: '방이 꽉 찼습니다', ja: '部屋は満員です', zh: '房间已满', es: 'la sala está llena', de: 'Raum ist voll', fr: 'la salle est pleine', hi: 'कमरा भरा हुआ है' },
  'game.roomExpired':       { en: 'this room has expired', ko: '이미 만료된 방입니다', ja: 'この部屋は期限切れです', zh: '这个房间已过期', es: 'esta sala ha caducado', de: 'dieser Raum ist abgelaufen', fr: 'cette salle a expiré', hi: 'यह कमरा समाप्त हो चुका है' },
  'game.alreadyJoined':     { en: 'already in the game', ko: '이미 참여 중', ja: '既に参加中', zh: '已加入', es: 'ya estás en el juego', de: 'bereits dabei', fr: 'déjà dans la partie', hi: 'पहले से शामिल' },
  'conv.youSentGameInvite': { en: 'you sent a game invite', ko: '게임 초대를 보냈습니다', ja: 'ゲーム招待を送信しました', zh: '你发送了游戏邀请', es: 'enviaste una invitación de juego', de: 'du hast eine Spieleinladung gesendet', fr: 'vous avez envoyé une invitation de jeu', hi: 'आपने एक गेम आमंत्रण भेजा' },
  'conv.sentGameInvite':    { en: 'sent a game invite',  ko: '게임 초대를 보냈습니다', ja: 'ゲーム招待を送信しました', zh: '发送了游戏邀请', es: 'envió una invitación de juego', de: 'hat eine Spieleinladung gesendet', fr: 'a envoyé une invitation de jeu', hi: 'गेम आमंत्रण भेजा' },

  // ───── Common state / lobby ─────────────────────────────────────────────
  'common.ready':         { en: 'ready',      ko: '준비',     ja: '準備OK',     zh: '准备',     es: 'listo',     de: 'bereit',     fr: 'prêt',      hi: 'तैयार' },
  'common.rematch':       { en: 'rematch',    ko: '다시 하기', ja: '再戦',      zh: '再来一局', es: 'revancha',  de: 'Revanche',   fr: 'revanche',  hi: 'रीमैच' },
  'common.notReady':      { en: 'not ready',  ko: '준비 안됨', ja: '準備未完',   zh: '未准备',   es: 'no listo',  de: 'nicht bereit', fr: 'pas prêt', hi: 'तैयार नहीं' },
  'common.readyCheck':    { en: '✓ ready',    ko: '✓ 준비',   ja: '✓ 準備OK',  zh: '✓ 准备',   es: '✓ listo',   de: '✓ bereit',   fr: '✓ prêt',    hi: '✓ तैयार' },
  'common.you':           { en: 'you',        ko: '나',       ja: 'あなた',    zh: '你',       es: 'tú',        de: 'du',         fr: 'vous',      hi: 'आप' },
  'common.me':            { en: 'me',         ko: '나',       ja: '自分',      zh: '我',       es: 'yo',        de: 'ich',        fr: 'moi',       hi: 'मैं' },
  'common.opponent':      { en: 'opponent',   ko: '상대',     ja: '対戦相手',  zh: '对手',     es: 'oponente',  de: 'Gegner',     fr: 'adversaire', hi: 'प्रतिद्वंद्वी' },
  'common.waiting':       { en: 'waiting…',   ko: '대기 중…', ja: '待機中…',   zh: '等待中…',   es: 'esperando…', de: 'warte…',    fr: 'en attente…', hi: 'प्रतीक्षा…' },
  'common.joining':       { en: 'joining…',   ko: '입장 중…', ja: '参加中…',   zh: '加入中…',   es: 'uniéndose…', de: 'beitreten…', fr: 'rejoindre…', hi: 'जुड़ रहे…' },
  'common.done':          { en: 'done',       ko: '완료',     ja: '完了',      zh: '完成',     es: 'listo',     de: 'fertig',     fr: 'terminé',   hi: 'पूर्ण' },
  'common.thinking':      { en: 'thinking…',  ko: '생각 중…', ja: '考え中…',   zh: '思考中…',   es: 'pensando…', de: 'denkt…',    fr: 'réfléchit…', hi: 'सोच रहे…' },
  'common.goBack':        { en: 'go back',    ko: '뒤로',     ja: '戻る',      zh: '返回',     es: 'volver',    de: 'zurück',     fr: 'retour',    hi: 'वापस' },

  // ───── Chess in-progress ────────────────────────────────────────────────
  'chess.resign':         { en: 'resign',       ko: '기권',      ja: '投了',     zh: '认输',     es: 'rendirse',  de: 'aufgeben',  fr: 'abandonner', hi: 'हार स्वीकार' },
  'chess.resignConfirm':  { en: 'resign this game? your opponent wins.', ko: '이 게임을 기권하시겠습니까? 상대방이 승리합니다.', ja: 'この対局を投了しますか？ 相手の勝利になります。', zh: '认输这局？ 对手将获胜。', es: '¿rendirse en esta partida? tu oponente gana.', de: 'diese Partie aufgeben? dein Gegner gewinnt.', fr: 'abandonner cette partie ? votre adversaire gagne.', hi: 'इस गेम में हार मानें? आपका प्रतिद्वंद्वी जीतता है।' },
  'chess.draw':           { en: 'draw?',        ko: '무승부?',   ja: '引き分け？', zh: '和棋？',   es: '¿tablas?',  de: 'Remis?',     fr: 'nulle ?',   hi: 'ड्रॉ?' },
  'chess.drawOffered':    { en: 'draw offered', ko: '무승부 제안됨', ja: '引き分け提案中', zh: '已提议和棋', es: 'tablas ofrecidas', de: 'Remis angeboten', fr: 'nulle proposée', hi: 'ड्रॉ प्रस्तावित' },
  'chess.acceptDraw':     { en: 'accept draw',  ko: '무승부 수락', ja: '引き分けを受諾', zh: '接受和棋', es: 'aceptar tablas', de: 'Remis annehmen', fr: 'accepter nulle', hi: 'ड्रॉ स्वीकार' },
  'chess.offerDraw':      { en: 'offer draw',   ko: '무승부 제안', ja: '引き分けを提案', zh: '提议和棋', es: 'ofrecer tablas', de: 'Remis anbieten', fr: 'proposer une nulle', hi: 'ड्रॉ प्रस्ताव' },
  'chess.opponentOffered':{ en: 'opponent offered a draw — accept?', ko: '상대가 무승부를 제안했습니다 — 수락하시겠습니까?', ja: '対戦相手が引き分けを提案 — 受諾？', zh: '对手提议和棋 — 接受？', es: 'el oponente ofreció tablas — ¿aceptar?', de: 'Gegner bietet Remis — annehmen?', fr: 'l’adversaire propose une nulle — accepter ?', hi: 'प्रतिद्वंद्वी ने ड्रॉ का प्रस्ताव दिया — स्वीकार?' },
  'chess.yourTurn':       { en: 'your turn',  ko: '내 차례',    ja: 'あなたの番', zh: '该你了',   es: 'tu turno',  de: 'du bist dran', fr: 'à vous',  hi: 'आपकी बारी' },
  'chess.youWon':         { en: 'you won',   ko: '승리',     ja: '勝利',    zh: '你赢了', es: 'ganaste', de: 'gewonnen',  fr: 'gagné',   hi: 'जीत' },
  'chess.youLost':        { en: 'you lost',   ko: '패배',      ja: '敗北',      zh: '你输了',   es: 'perdiste',  de: 'verloren',   fr: 'perdu',     hi: 'हार' },
  'chess.drawResult':     { en: 'draw',       ko: '무승부',    ja: '引き分け',   zh: '和棋',     es: 'tablas',    de: 'Remis',      fr: 'nulle',     hi: 'ड्रॉ' },
  'chess.waitingForFriend':{ en: 'waiting for friend…', ko: '친구를 기다리는 중…', ja: '友達を待っています…', zh: '等待好友…', es: 'esperando al amigo…', de: 'warten auf den Freund…', fr: 'en attente d’un ami…', hi: 'दोस्त की प्रतीक्षा…' },
  'chess.readyCount':     { en: '{n} / 2 ready', ko: '{n} / 2 준비', ja: '{n} / 2 準備完了', zh: '{n} / 2 已准备', es: '{n} / 2 listos', de: '{n} / 2 bereit', fr: '{n} / 2 prêts', hi: '{n} / 2 तैयार' },
  'chess.inviteCta':      { en: 'invite a friend', ko: '친구 초대', ja: '友達を招待', zh: '邀请好友', es: 'invitar a un amigo', de: 'Freund einladen', fr: 'inviter un ami', hi: 'मित्र को आमंत्रित' },
  'chess.playAgain':      { en: 'play again', ko: '한 판 더', ja: 'もう一局', zh: '再来一局', es: 'jugar otra vez', de: 'noch eine Partie', fr: 'rejouer', hi: 'फिर से खेलें' },
  'chess.endGame':        { en: 'end game', ko: '게임 종료', ja: 'ゲーム終了', zh: '结束游戏', es: 'terminar', de: 'Spiel beenden', fr: 'terminer', hi: 'गेम समाप्त' },
  'chess.record':         { en: 'vs {name} · {w}W {d}D {l}L', ko: '{name} 상대 전적 · {w}승 {d}무 {l}패', ja: '対 {name} · {w}勝 {d}分 {l}敗', zh: '对 {name} · {w}胜 {d}和 {l}负', es: 'vs {name} · {w}G {d}E {l}P', de: 'gegen {name} · {w}S {d}U {l}N', fr: 'vs {name} · {w}V {d}N {l}D', hi: '{name} के विरुद्ध · {w}जीत {d}ड्रॉ {l}हार' },

  // ───── Poker in-progress ────────────────────────────────────────────────
  'poker.fold':           { en: 'fold',     ko: '폴드',     ja: 'フォールド',  zh: '弃牌',     es: 'pasar',     de: 'passen',     fr: 'se coucher', hi: 'फोल्ड' },
  'poker.check':          { en: 'check',    ko: '체크',     ja: 'チェック',    zh: '让牌',     es: 'pasar',     de: 'schieben',   fr: 'check',     hi: 'चेक' },
  'poker.call':           { en: 'call {amount}', ko: '콜 {amount}', ja: 'コール {amount}', zh: '跟注 {amount}', es: 'igualar {amount}', de: 'mitgehen {amount}', fr: 'suivre {amount}', hi: 'कॉल {amount}' },
  'poker.callAllInChips': { en: 'all-in ({chips})', ko: '올인 ({chips})', ja: 'オールイン ({chips})', zh: '全下 ({chips})', es: 'all-in ({chips})', de: 'all-in ({chips})', fr: 'all-in ({chips})', hi: 'ऑल-इन ({chips})' },
  'poker.raise':          { en: 'raise',    ko: '레이즈',   ja: 'レイズ',      zh: '加注',     es: 'subir',     de: 'erhöhen',    fr: 'relancer',  hi: 'रेज़' },
  'poker.min':            { en: 'min',      ko: '최소',     ja: 'ミニマム',    zh: '最小',     es: 'mín',       de: 'min',        fr: 'min',       hi: 'न्यूनतम' },
  'poker.pot':            { en: 'pot',      ko: '팟',       ja: 'ポット',     zh: '底池',     es: 'bote',      de: 'Pot',        fr: 'pot',       hi: 'पॉट' },
  'poker.allInShort':     { en: 'all-in',   ko: '올인',     ja: 'オールイン',  zh: '全下',     es: 'all-in',    de: 'all-in',     fr: 'all-in',    hi: 'ऑल-इन' },
  'poker.folded':         { en: 'folded',   ko: '폴드함',   ja: 'フォールド済', zh: '已弃牌',  es: 'pasado',    de: 'gepasst',    fr: 'couché',    hi: 'फोल्डेड' },
  'poker.gameOver':       { en: 'game over', ko: '게임 종료', ja: 'ゲーム終了', zh: '游戏结束', es: 'fin del juego', de: 'Spiel vorbei', fr: 'partie terminée', hi: 'गेम समाप्त' },
  'poker.youWon':         { en: 'you won',  ko: '승리',    ja: '勝利',     zh: '你赢了', es: 'ganaste',  de: 'gewonnen', fr: 'gagné',   hi: 'जीत' },
  'poker.youLost':        { en: 'you lost',  ko: '패배',     ja: '敗北',       zh: '你输了',   es: 'perdiste',   de: 'verloren',  fr: 'perdu',     hi: 'हार' },
  'poker.playerWon':      { en: '{name} won', ko: '{name} 승리', ja: '{name} の勝ち', zh: '{name} 获胜', es: '{name} ganó', de: '{name} hat gewonnen', fr: '{name} a gagné', hi: '{name} जीते' },
  'poker.forfeit':        { en: 'forfeit',   ko: '포기',     ja: '棄権',       zh: '弃赛',     es: 'abandonar', de: 'aufgeben',   fr: 'abandonner', hi: 'त्याग' },
  'poker.forfeitTip':     { en: 'forfeit (end the game and let the other player win)', ko: '게임을 포기하고 상대 승리로 종료합니다', ja: '棄権（ゲームを終了し対戦相手の勝利にする）', zh: '弃赛（结束游戏并让对手获胜）', es: 'abandonar (terminar el juego y dejar ganar al otro)', de: 'aufgeben (Spiel beenden und Gegner gewinnen lassen)', fr: 'abandonner (terminer la partie et laisser gagner l’autre)', hi: 'त्याग (खेल समाप्त करें और दूसरे को जीतने दें)' },
  'poker.playerThinking': { en: '{name} thinking…', ko: '{name} 생각 중…', ja: '{name} 考え中…', zh: '{name} 思考中…', es: '{name} pensando…', de: '{name} denkt…', fr: '{name} réfléchit…', hi: '{name} सोच रहे…' },
  'poker.showdown':       { en: 'showdown', ko: '쇼다운', ja: 'ショーダウン', zh: '摊牌', es: 'showdown', de: 'Showdown', fr: 'abattage', hi: 'शोडाउन' },
  'poker.handNumber':     { en: 'hand #{n}', ko: '핸드 #{n}', ja: 'ハンド #{n}', zh: '第 {n} 手牌', es: 'mano #{n}', de: 'Hand #{n}', fr: 'main n°{n}', hi: 'हैंड #{n}' },
  'poker.handComplete':   { en: 'hand complete', ko: '핸드 종료', ja: 'ハンド終了', zh: '本手结束', es: 'mano completa', de: 'Hand beendet', fr: 'main terminée', hi: 'हैंड पूरा' },
  'poker.youWinPot':      { en: 'you win +{amount}', ko: '승리 +{amount}', ja: '勝利 +{amount}', zh: '你赢了 +{amount}', es: 'ganas +{amount}', de: 'du gewinnst +{amount}', fr: 'vous gagnez +{amount}', hi: 'आप जीते +{amount}' },
  'poker.playerWinsPot':  { en: '{name} wins +{amount}', ko: '{name} 승리 +{amount}', ja: '{name} の勝ち +{amount}', zh: '{name} 获胜 +{amount}', es: '{name} gana +{amount}', de: '{name} gewinnt +{amount}', fr: '{name} gagne +{amount}', hi: '{name} जीते +{amount}' },
  'poker.splitPot':       { en: '{names} split +{amount}', ko: '{names} 팟 분배 +{amount}', ja: '{names} が分け取り +{amount}', zh: '{names} 平分 +{amount}', es: '{names} reparten +{amount}', de: '{names} teilen +{amount}', fr: '{names} partagent +{amount}', hi: '{names} बाँटते हैं +{amount}' },
  'poker.winner':         { en: 'winner', ko: '승자', ja: '勝者', zh: '赢家', es: 'ganador', de: 'Gewinner', fr: 'gagnant', hi: 'विजेता' },
  'poker.revealed':       { en: 'revealed', ko: '공개', ja: '公開', zh: '已亮牌', es: 'revelado', de: 'aufgedeckt', fr: 'révélé', hi: 'दिखाया' },
  'poker.holeCards':      { en: 'hole', ko: '패', ja: '手札', zh: '底牌', es: 'cartas', de: 'Hand', fr: 'privées', hi: 'होल' },
  'poker.bestFive':       { en: 'best 5', ko: '베스트 5장', ja: 'ベスト5枚', zh: '最佳5张', es: 'mejores 5', de: 'beste 5', fr: 'meilleures 5', hi: 'सर्वश्रेष्ठ 5' },
  'poker.rankHighCard':   { en: 'high card', ko: '하이 카드', ja: 'ハイカード', zh: '高牌', es: 'carta alta', de: 'High Card', fr: 'carte haute', hi: 'हाई कार्ड' },
  'poker.rankPair':       { en: 'pair', ko: '원 페어', ja: 'ワンペア', zh: '一对', es: 'pareja', de: 'Paar', fr: 'paire', hi: 'पेयर' },
  'poker.rankTwoPair':    { en: 'two pair', ko: '투 페어', ja: 'ツーペア', zh: '两对', es: 'doble pareja', de: 'Zwei Paare', fr: 'double paire', hi: 'दो पेयर' },
  'poker.rankTrips':      { en: 'three of a kind', ko: '트리플', ja: 'スリーカード', zh: '三条', es: 'trío', de: 'Drilling', fr: 'brelan', hi: 'तीन एक जैसे' },
  'poker.rankStraight':   { en: 'straight', ko: '스트레이트', ja: 'ストレート', zh: '顺子', es: 'escalera', de: 'Straight', fr: 'quinte', hi: 'स्ट्रेट' },
  'poker.rankFlush':      { en: 'flush', ko: '플러시', ja: 'フラッシュ', zh: '同花', es: 'color', de: 'Flush', fr: 'couleur', hi: 'फ्लश' },
  'poker.rankFullHouse':  { en: 'full house', ko: '풀 하우스', ja: 'フルハウス', zh: '葫芦', es: 'full house', de: 'Full House', fr: 'full', hi: 'फुल हाउस' },
  'poker.rankQuads':      { en: 'four of a kind', ko: '포카드', ja: 'フォーカード', zh: '四条', es: 'póker', de: 'Vierling', fr: 'carré', hi: 'चार एक जैसे' },
  'poker.rankStraightFlush': { en: 'straight flush', ko: '스트레이트 플러시', ja: 'ストレートフラッシュ', zh: '同花顺', es: 'escalera de color', de: 'Straight Flush', fr: 'quinte flush', hi: 'स्ट्रेट फ्लश' },
  'poker.rankRoyalFlush': { en: 'royal flush', ko: '로열 플러시', ja: 'ロイヤルフラッシュ', zh: '皇家同花顺', es: 'escalera real', de: 'Royal Flush', fr: 'quinte flush royale', hi: 'रॉयल फ्लश' },

  // ───── Falling Blocks in-progress ───────────────────────────────────────
  // ───── In-chat calendar ─────────────────────────────────────────────────
  'chatcal.title':    { en: 'calendar', ko: '캘린더', ja: 'カレンダー', zh: '日历', es: 'calendario', de: 'Kalender', fr: 'calendrier', hi: 'कैलेंडर' },
  'chatcal.addChip':  { en: 'add to calendar', ko: '캘린더에 추가', ja: 'カレンダーに追加', zh: '添加到日历', es: 'añadir al calendario', de: 'in den Kalender', fr: 'ajouter au calendrier', hi: 'कैलेंडर में जोड़ें' },
  'chatcal.reading':  { en: 'reading…', ko: '읽는 중…', ja: '読み取り中…', zh: '解析中…', es: 'leyendo…', de: 'liest…', fr: 'lecture…', hi: 'पढ़ रहा है…' },
  'chatcal.noEvents': { en: 'no plans found', ko: '일정을 못 찾았어요', ja: '予定が見つかりません', zh: '未找到日程', es: 'no se encontraron planes', de: 'keine Termine gefunden', fr: 'aucun plan trouvé', hi: 'कोई योजना नहीं मिली' },
  'chatcal.save':     { en: 'save', ko: '저장', ja: '保存', zh: '保存', es: 'guardar', de: 'speichern', fr: 'enregistrer', hi: 'सहेजें' },
  'chatcal.saved':    { en: 'noted ✓', ko: '저장됨 ✓', ja: '保存済み ✓', zh: '已保存 ✓', es: 'anotado ✓', de: 'notiert ✓', fr: 'noté ✓', hi: 'सहेजा गया ✓' },
  'stems.files':      { en: 'files', ko: '파일', ja: 'ファイル', zh: '文件', es: 'archivos', de: 'Dateien', fr: 'fichiers', hi: 'फ़ाइलें' },
  'stems.dropGuide':  {
    en: 'drop DAW regions or audio files here, or use files to import several at once.',
    ko: 'DAW 리전이나 오디오 파일을 드롭하거나, 파일에서 여러 개를 한 번에 가져오세요.',
    ja: 'DAWのリージョンや音声ファイルをドロップするか、ファイルから複数まとめて読み込めます。',
    zh: '拖放 DAW 片段或音频文件，或通过文件一次导入多个。',
    es: 'suelta regiones del DAW o archivos de audio, o usa archivos para importar varios a la vez.',
    de: 'DAW-Regionen oder Audiodateien ablegen, oder über Dateien mehrere auf einmal importieren.',
    fr: 'déposez des régions du DAW ou des fichiers audio, ou importez-en plusieurs via fichiers.',
    hi: 'DAW regions या audio files यहाँ छोड़ें, या files से कई एक साथ import करें.',
  },

  'fb.score':       { en: 'score',      ko: '점수',     ja: 'スコア',     zh: '分数',    es: 'puntos',    de: 'Punkte',     fr: 'score',     hi: 'स्कोर' },
  'fb.lines':       { en: 'lines',      ko: '라인',     ja: 'ライン',     zh: '行数',    es: 'líneas',    de: 'Reihen',     fr: 'lignes',    hi: 'लाइनें' },
  'fb.incoming':    { en: 'incoming',   ko: '받는 줄',  ja: '受信',       zh: '来袭',    es: 'entrante',  de: 'eingehend',  fr: 'entrant',   hi: 'आगामी' },
  'fb.next':        { en: 'next',       ko: '다음',     ja: '次',         zh: '下一个',  es: 'siguiente', de: 'nächstes',   fr: 'suivant',   hi: 'अगला' },
  'fb.toppedOut':   { en: 'topped out', ko: '게임 오버', ja: 'ゲームオーバー', zh: '顶满',    es: 'eliminado', de: 'Spiel verloren', fr: 'plein',  hi: 'टॉप आउट' },
  'fb.youAreOut':   { en: "you're out", ko: '탈락',     ja: '脱落',       zh: '你出局了', es: 'has perdido', de: 'ausgeschieden', fr: 'vous êtes éliminé', hi: 'आप बाहर' },
  'fb.gameOver':    { en: 'game over',  ko: '게임 종료', ja: 'ゲーム終了', zh: '游戏结束', es: 'fin del juego', de: 'Spiel vorbei', fr: 'partie terminée', hi: 'गेम समाप्त' },
  'fb.playerWon':   { en: '{name} won', ko: '{name} 승리', ja: '{name} の勝ち', zh: '{name} 获胜', es: '{name} ganó', de: '{name} hat gewonnen', fr: '{name} a gagné', hi: '{name} जीते' },
  'fb.hold':        { en: 'hold',       ko: '홀드',     ja: 'ホールド',   zh: '暂存',    es: 'reserva',   de: 'halten',     fr: 'réserve',   hi: 'होल्ड' },
  'fb.combo':       { en: 'combo',      ko: '콤보',     ja: 'コンボ',     zh: '连击',    es: 'combo',     de: 'Combo',      fr: 'combo',     hi: 'कॉम्बो' },
  'fb.level':       { en: 'level',      ko: '레벨',     ja: 'レベル',     zh: '等级',    es: 'nivel',     de: 'Level',      fr: 'niveau',    hi: 'स्तर' },

  // ───── Pinball ──────────────────────────────────────────────────────────
  'pb.ball':        { en: 'ball',        ko: '볼',        ja: 'ボール',    zh: '球',      es: 'bola',      de: 'Kugel',      fr: 'bille',     hi: 'बॉल' },
  'pb.gameOver':    { en: 'game over',   ko: '게임 종료',  ja: 'ゲーム終了', zh: '游戏结束', es: 'fin del juego', de: 'Spiel vorbei', fr: 'partie terminée', hi: 'गेम समाप्त' },
  'pb.leaderboard': { en: 'world ranking', ko: '월드 랭킹', ja: '世界ランキング', zh: '世界排名', es: 'ranking mundial', de: 'Weltrangliste', fr: 'classement mondial', hi: 'विश्व रैंकिंग' },
  'pb.yourBest':    { en: 'your best',   ko: '내 최고 기록', ja: '自己ベスト', zh: '你的最佳', es: 'tu récord', de: 'dein Rekord', fr: 'ton record', hi: 'आपका सर्वश्रेष्ठ' },
  'pb.newBest':     { en: 'new best',   ko: '신기록',    ja: '自己ベスト更新', zh: '新纪录', es: 'nuevo récord', de: 'neuer Rekord', fr: 'nouveau record', hi: 'नया रिकॉर्ड' },
  'pb.playAgain':   { en: 'play again',  ko: '다시 하기',  ja: 'もう一度',   zh: '再玩一次', es: 'jugar de nuevo', de: 'nochmal', fr: 'rejouer', hi: 'फिर खेलें' },
  'pb.start':       { en: 'play',        ko: '시작',      ja: 'プレイ',     zh: '开始',    es: 'jugar',     de: 'spielen',    fr: 'jouer',     hi: 'खेलें' },
  'pb.hintKeys':    { en: '← → flippers · space to launch', ko: '← → 플리퍼 · 스페이스로 발사', ja: '← → フリッパー・スペースで発射', zh: '← → 挡板 · 空格发射', es: '← → flippers · espacio para lanzar', de: '← → Flipper · Leertaste zum Start', fr: '← → flippers · espace pour lancer', hi: '← → फ्लिपर · स्पेस से लॉन्च' },
  'pb.hintTouch':   { en: 'tap left / right half · pull the plunger', ko: '왼쪽/오른쪽 탭 · 플런저 당겨서 발사', ja: '左右タップ・プランジャーを引く', zh: '点按左/右 · 拉动弹射器', es: 'toca izquierda/derecha · tira del lanzador', de: 'links/rechts tippen · Abzug ziehen', fr: 'touchez gauche/droite · tirez le lanceur', hi: 'बाएँ/दाएँ टैप करें · प्लंजर खींचें' },
  'pb.rank':        { en: 'rank',        ko: '순위',      ja: '順位',       zh: '排名',    es: 'puesto',    de: 'Rang',       fr: 'rang',      hi: 'रैंक' },
  'pb.reset':       { en: 'reset',       ko: '리셋',      ja: 'リセット',   zh: '重置',    es: 'reiniciar', de: 'Neustart',   fr: 'réinitialiser', hi: 'रीसेट' },
  'pb.end':         { en: 'end game',    ko: '게임 종료',  ja: 'ゲーム終了', zh: '结束游戏', es: 'terminar',  de: 'beenden',    fr: 'terminer',  hi: 'गेम समाप्त' },
  'pb.endConfirm':  { en: 'end the game now and record the score?', ko: '지금 게임을 끝내고 점수를 기록할까?', ja: '今すぐ終了してスコアを記録しますか？', zh: '现在结束游戏并记录分数？', es: '¿terminar ahora y registrar la puntuación?', de: 'jetzt beenden und den Punktestand speichern?', fr: 'terminer maintenant et enregistrer le score ?', hi: 'अभी गेम समाप्त करें और स्कोर दर्ज करें?' },
  'pb.resetConfirm': { en: 'restart the game? the current score is lost.', ko: '게임을 다시 시작할까? 지금 점수는 사라져.', ja: 'ゲームをやり直しますか？現在のスコアは失われます。', zh: '重新开始游戏？当前分数将丢失。', es: '¿reiniciar la partida? se pierde la puntuación actual.', de: 'Spiel neu starten? der aktuelle Punktestand geht verloren.', fr: 'recommencer ? le score actuel sera perdu.', hi: 'गेम फिर से शुरू करें? वर्तमान स्कोर खो जाएगा।' },
  'y.roll':         { en: 'roll',        ko: '굴리기',    ja: 'ロール',     zh: '掷骰',    es: 'tirar',     de: 'würfeln',    fr: 'lancer',    hi: 'रोल' },
  'y.yourTurn':     { en: 'your turn',   ko: '내 차례',    ja: 'あなたの番', zh: '你的回合', es: 'tu turno',  de: 'du bist dran', fr: 'à toi', hi: 'आपकी बारी' },
  'y.turnOf':       { en: "{name}'s turn", ko: '{name} 차례', ja: '{name}の番', zh: '{name} 的回合', es: 'turno de {name}', de: '{name} ist dran', fr: 'tour de {name}', hi: '{name} की बारी' },
  'y.round':        { en: 'round',       ko: '라운드',    ja: 'ラウンド',   zh: '回合',    es: 'ronda',     de: 'Runde',      fr: 'manche',    hi: 'राउंड' },
  'y.bonus':        { en: 'bonus',       ko: '보너스',    ja: 'ボーナス',   zh: '奖励',    es: 'bono',      de: 'Bonus',      fr: 'bonus',     hi: 'बोनस' },
  'y.write':        { en: 'write it down', ko: '기입하기',  ja: '記入する',   zh: '记分',    es: 'anotar',    de: 'eintragen',  fr: 'noter',     hi: 'लिखें' },
  'y.keep':         { en: 'keep',        ko: '킵',        ja: 'キープ',     zh: '保留',    es: 'guardar',   de: 'halten',     fr: 'garder',    hi: 'रखें' },
  'y.keepHint':     { en: 'tap a die to keep it', ko: '주사위를 탭해서 아껴두기', ja: 'ダイスをタップでキープ', zh: '点按骰子以保留', es: 'toca un dado para guardarlo', de: 'Würfel antippen zum Halten', fr: 'touche un dé pour le garder', hi: 'पासा रखने के लिए टैप करें' },
  'y.ledger':       { en: 'the ledger',  ko: '점수 원장',  ja: 'スコア台帳', zh: '记分册',  es: 'el libro',  de: 'das Blatt',  fr: 'le registre', hi: 'स्कोर बही' },
  'y.total':        { en: 'total',       ko: '합계',      ja: '合計',       zh: '总分',    es: 'total',     de: 'Summe',      fr: 'total',     hi: 'कुल' },
  'fb.playSolo':    { en: 'play solo',   ko: '혼자 하기',  ja: 'ソロプレイ', zh: '单人游戏', es: 'jugar solo', de: 'solo spielen', fr: 'jouer en solo', hi: 'अकेले खेलें' },

  // ───── Information Panel ────────────────────────────────────────────────
  'info.yourName':         { en: 'your name', ko: '이름', ja: '名前', zh: '你的名字', es: 'tu nombre', de: 'dein Name', fr: 'votre nom', hi: 'आपका नाम' },
  'info.email':            { en: 'email', ko: '이메일', ja: 'メール', zh: '邮箱', es: 'correo', de: 'E-Mail', fr: 'e-mail', hi: 'ईमेल' },
  'info.changePassword':   { en: 'change password', ko: '비밀번호 변경', ja: 'パスワードを変更', zh: '修改密码', es: 'cambiar contraseña', de: 'Passwort ändern', fr: 'modifier le mot de passe', hi: 'पासवर्ड बदलें' },
  'info.currentPw':        { en: 'current password', ko: '현재 비밀번호', ja: '現在のパスワード', zh: '当前密码', es: 'contraseña actual', de: 'aktuelles Passwort', fr: 'mot de passe actuel', hi: 'वर्तमान पासवर्ड' },
  'info.newPw':            { en: 'new password', ko: '새 비밀번호', ja: '新しいパスワード', zh: '新密码', es: 'nueva contraseña', de: 'neues Passwort', fr: 'nouveau mot de passe', hi: 'नया पासवर्ड' },
  'info.confirmPw':        { en: 'confirm new password', ko: '새 비밀번호 확인', ja: '新しいパスワードを確認', zh: '确认新密码', es: 'confirmar nueva contraseña', de: 'neues Passwort bestätigen', fr: 'confirmer le mot de passe', hi: 'नया पासवर्ड पुष्टि' },
  'info.updatePassword':   { en: 'change password', ko: '비밀번호 변경', ja: 'パスワードを変更', zh: '修改密码', es: 'cambiar contraseña', de: 'Passwort ändern', fr: 'modifier le mot de passe', hi: 'पासवर्ड बदलें' },
  'info.verifying':        { en: 'verifying…', ko: '확인 중…', ja: '確認中…', zh: '验证中…', es: 'verificando…', de: 'überprüfen…', fr: 'vérification…', hi: 'सत्यापित कर रहे…' },
  'info.deleteAccount':    { en: 'delete account', ko: '계정 삭제', ja: 'アカウントを削除', zh: '删除账号', es: 'eliminar cuenta', de: 'Konto löschen', fr: 'supprimer le compte', hi: 'खाता हटाएं' },
  'info.deleteWarning':    { en: 'this will permanently delete your account and all data. type DELETE to confirm.', ko: '계정과 모든 데이터가 영구 삭제됩니다. 확인하려면 DELETE를 입력하세요.', ja: 'アカウントとすべてのデータが完全に削除されます。確認のため DELETE と入力してください。', zh: '这将永久删除你的账号和所有数据。输入 DELETE 确认。', es: 'esto eliminará permanentemente tu cuenta y todos los datos. escribe DELETE para confirmar.', de: 'dies löscht dein Konto und alle Daten dauerhaft. tippe DELETE zur Bestätigung.', fr: 'cela supprimera définitivement votre compte et toutes les données. tapez DELETE pour confirmer.', hi: 'यह आपका खाता और सारा डेटा स्थायी रूप से हटा देगा। पुष्टि के लिए DELETE टाइप करें।' },
  'info.deleteMyAccount':  { en: 'delete my account', ko: '내 계정 삭제', ja: '自分のアカウントを削除', zh: '删除我的账号', es: 'eliminar mi cuenta', de: 'Konto löschen', fr: 'supprimer mon compte', hi: 'मेरा खाता हटाएं' },
  'info.deleting':         { en: 'deleting…', ko: '삭제 중…', ja: '削除中…', zh: '删除中…', es: 'eliminando…', de: 'löschen…', fr: 'suppression…', hi: 'हटाया जा रहा…' },

  // ───── Profile panel ────────────────────────────────────────────────────
  'profile.members':       { en: 'members',   ko: '멤버',     ja: 'メンバー',   zh: '成员',    es: 'miembros',   de: 'Mitglieder', fr: 'membres',   hi: 'सदस्य' },
  'profile.following':     { en: 'following', ko: '팔로잉',   ja: 'フォロー中', zh: '关注',    es: 'siguiendo',  de: 'folge ich',  fr: 'abonné',    hi: 'फॉलोइंग' },
  'profile.changePhoto':   { en: 'change photo', ko: '사진 변경', ja: '写真を変更', zh: '更换照片', es: 'cambiar foto', de: 'Foto ändern', fr: 'changer la photo', hi: 'फ़ोटो बदलें' },

  // ───── Live panel — broadcaster side ────────────────────────────────────
  'live.streamEndedTitle': { en: 'stream ended', ko: '방송 종료', ja: '配信終了', zh: '直播结束', es: 'transmisión finalizada', de: 'Stream beendet', fr: 'diffusion terminée', hi: 'स्ट्रीम समाप्त' },
  'live.duration':         { en: 'duration', ko: '시간', ja: '時間', zh: '时长', es: 'duración', de: 'Dauer', fr: 'durée', hi: 'अवधि' },
  'live.totalViewers':     { en: 'total viewers', ko: '총 시청자', ja: '合計視聴者', zh: '总观看', es: 'espectadores totales', de: 'Gesamt-Zuschauer', fr: 'spectateurs totaux', hi: 'कुल दर्शक' },
  'live.peakViewers':      { en: 'peak viewers', ko: '최고 시청자', ja: 'ピーク視聴者', zh: '最高观看', es: 'pico de espectadores', de: 'Spitzen-Zuschauer', fr: 'spectateurs max.', hi: 'अधिकतम दर्शक' },
  'live.endStream':        { en: 'end stream', ko: '방송 종료', ja: '配信を終了', zh: '结束直播', es: 'terminar', de: 'Stream beenden', fr: 'terminer le direct', hi: 'स्ट्रीम समाप्त' },
  'live.liveNow':          { en: 'live now', ko: '라이브 중', ja: 'ライブ中', zh: '正在直播', es: 'en vivo', de: 'jetzt live', fr: 'en direct', hi: 'अभी लाइव' },
  'live.watch':            { en: 'watch', ko: '시청', ja: '視聴', zh: '观看', es: 'ver', de: 'ansehen', fr: 'regarder', hi: 'देखें' },

  // ───── Confirm / alert dialogs (native browser popups) ──────────────────
  'confirm.forfeitPoker':  { en: 'forfeit this game? the other player wins.', ko: '이 게임을 포기하시겠습니까? 상대 플레이어가 승리합니다.', ja: 'このゲームを棄権しますか？ 対戦相手の勝利になります。', zh: '弃赛？ 对手将获胜。', es: '¿abandonar la partida? el otro jugador gana.', de: 'Spiel aufgeben? der andere Spieler gewinnt.', fr: 'abandonner la partie ? l’autre joueur gagne.', hi: 'इस गेम को छोड़ें? दूसरा खिलाड़ी जीतता है।' },
  'confirm.forfeitFb':     { en: 'forfeit this game? the other player wins.', ko: '이 게임을 포기하시겠습니까? 상대 플레이어가 승리합니다.', ja: 'このゲームを棄権しますか？ 対戦相手の勝利になります。', zh: '弃赛？ 对手将获胜。', es: '¿abandonar la partida? el otro jugador gana.', de: 'Spiel aufgeben? der andere Spieler gewinnt.', fr: 'abandonner la partie ? l’autre joueur gagne.', hi: 'इस गेम को छोड़ें? दूसरा खिलाड़ी जीतता है।' },
  'alert.maxFileSize5mb':  { en: 'maximum file size is 5 MB.', ko: '파일 크기는 최대 5MB입니다.', ja: 'ファイルサイズは最大 5MB です。', zh: '文件大小最大 5 MB。', es: 'el tamaño máximo del archivo es 5 MB.', de: 'maximale Dateigröße ist 5 MB.', fr: 'taille maximale du fichier : 5 Mo.', hi: 'अधिकतम फ़ाइल आकार 5 MB है।' },

  // ───── Toasts / inline status messages ─────────────────────────────────
  'info.saved':              { en: 'saved',           ko: '저장됨',          ja: '保存しました',  zh: '已保存',    es: 'guardado',         de: 'gespeichert',     fr: 'enregistré',       hi: 'सहेजा गया' },
  'info.passwordChanged':    { en: 'password changed', ko: '비밀번호 변경됨',  ja: 'パスワードを変更しました', zh: '密码已修改',    es: 'contraseña cambiada', de: 'Passwort geändert', fr: 'mot de passe modifié', hi: 'पासवर्ड बदला गया' },
  'info.typeDeleteToConfirm':{ en: 'type DELETE to confirm', ko: '확인하려면 DELETE 입력', ja: '確認するには DELETE と入力', zh: '输入 DELETE 确认', es: 'escribe DELETE para confirmar', de: 'DELETE eingeben zum Bestätigen', fr: 'tapez DELETE pour confirmer', hi: 'पुष्टि के लिए DELETE टाइप करें' },

  // ───── Misc remaining UI strings ───────────────────────────────────────
  'liveChat.placeholder':  { en: 'say something…', ko: '메시지를 남겨주세요…', ja: '何か書いてみる…', zh: '说点什么…', es: 'di algo…', de: 'sag etwas…', fr: 'dites quelque chose…', hi: 'कुछ कहें…' },
  'chat.dropToAttach':     { en: 'drop to attach', ko: '여기에 놓아 첨부', ja: 'ドロップして添付', zh: '拖放以添加附件', es: 'soltar para adjuntar', de: 'loslassen zum Anhängen', fr: 'déposez pour joindre', hi: 'जोड़ने के लिए छोड़ें' },
  'chat.releaseToCancel':  { en: 'release to cancel', ko: '취소하려면 놓기', ja: '離してキャンセル', zh: '释放以取消', es: 'soltar para cancelar', de: 'loslassen zum Abbrechen', fr: 'relâcher pour annuler', hi: 'रद्द करने के लिए छोड़ें' },

  // ───── Ear Training Duel ────────────────────────────────────────────────
  'game.earTraining':       { en: 'ear training', ko: '청음 훈련', ja: '聴音トレーニング', zh: '听音训练', es: 'entrenamiento auditivo', de: 'Gehörbildung', fr: 'entraînement auditif', hi: 'कान का अभ्यास' },
  'game.earTrainingDesc':   { en: 'identify intervals & chords', ko: '음정과 화음 알아맞히기', ja: '音程と和音を当てる', zh: '识别音程和和弦', es: 'identifica intervalos y acordes', de: 'Intervalle und Akkorde erkennen', fr: 'identifier intervalles et accords', hi: 'अंतराल और कॉर्ड पहचानें' },
  'game.pinball':           { en: 'pinball', ko: '핀볼', ja: 'ピンボール', zh: '弹球', es: 'pinball', de: 'Flipper', fr: 'flipper', hi: 'पिनबॉल' },
  'game.yacht':             { en: 'yacht dice', ko: '야추 다이스', ja: 'ヨットダイス', zh: '快艇骰子', es: 'yacht', de: 'Yacht', fr: 'yacht', hi: 'यॉट डाइस' },
  'game.yachtDesc':         { en: 'roll · hold · score', ko: '굴리고 · 킵하고 · 채우고', ja: '振って・残して・埋める', zh: '掷骰 · 保留 · 计分', es: 'tira · guarda · anota', de: 'würfeln · halten · punkten', fr: 'lance · garde · marque', hi: 'रोल · होल्ड · स्कोर' },
  'game.orbMerge':  { en: 'orb merge',    ko: '오브 머지',   ja: 'オーブマージ', zh: '合并球',    es: 'fusión de orbes', de: 'Orb-Fusion', fr: 'fusion d’orbes', hi: 'ऑर्ब मर्ज' },
  'game.orbMergeDesc': { en: 'drop & merge the orbs', ko: '오브를 떨어뜨려 합쳐', ja: 'オーブを落として合体', zh: '掉落并合并球', es: 'suelta y fusiona los orbes', de: 'Orbs fallen lassen & fusionieren', fr: 'lâche et fusionne les orbes', hi: 'ऑर्ब गिराओ और मिलाओ' },
  'om.hint':        { en: 'move to aim · tap to drop', ko: '움직여 조준 · 탭해서 드롭', ja: '動かして狙い、タップで落とす', zh: '移动瞄准 · 点击落下', es: 'mueve para apuntar · toca para soltar', de: 'bewegen zum Zielen · tippen zum Fallen', fr: 'bouge pour viser · tape pour lâcher', hi: 'निशाना लगाओ · टैप से गिराओ' },
  'game.pinballDesc':       { en: 'solo · world ranking', ko: '혼자서 · 월드 랭킹', ja: 'ソロ・世界ランキング', zh: '单人 · 世界排名', es: 'solo · ranking mundial', de: 'solo · Weltrangliste', fr: 'solo · classement mondial', hi: 'सोलो · विश्व रैंकिंग' },
  'et.round':               { en: 'round {n} / {total}', ko: '라운드 {n} / {total}', ja: 'ラウンド {n} / {total}', zh: '回合 {n} / {total}', es: 'ronda {n} / {total}', de: 'Runde {n} / {total}', fr: 'manche {n} / {total}', hi: 'राउंड {n} / {total}' },
  'et.play':                { en: 'play', ko: '재생', ja: '再生', zh: '播放', es: 'reproducir', de: 'abspielen', fr: 'jouer', hi: 'चलाएं' },
  'et.replaysLeft':         { en: '{n} replays left', ko: '재생 {n}회 남음', ja: '残り {n} 回', zh: '剩余 {n} 次', es: '{n} repeticiones restantes', de: 'Noch {n} Wiederh.', fr: '{n} relectures restantes', hi: '{n} रिप्ले शेष' },
  'et.whatInterval':        { en: 'what interval did you hear?', ko: '어떤 음정이 들렸나요?', ja: 'どの音程でしたか？', zh: '听到的是什么音程？', es: '¿qué intervalo escuchaste?', de: 'welches Intervall hast du gehört?', fr: 'quel intervalle avez-vous entendu ?', hi: 'आपने कौन सा अंतराल सुना?' },
  'et.whatChord':           { en: 'what chord did you hear?', ko: '어떤 화음이 들렸나요?', ja: 'どの和音でしたか？', zh: '听到的是什么和弦？', es: '¿qué acorde escuchaste?', de: 'welchen Akkord hast du gehört?', fr: 'quel accord avez-vous entendu ?', hi: 'आपने कौन सा कॉर्ड सुना?' },
  'et.correct':             { en: 'correct', ko: '정답', ja: '正解', zh: '正确', es: 'correcto', de: 'richtig', fr: 'correct', hi: 'सही' },
  'et.wrong':               { en: 'wrong — it was {ans}', ko: '오답 — 정답은 {ans}', ja: '不正解 — 正解は {ans}', zh: '错误 — 答案是 {ans}', es: 'incorrecto — era {ans}', de: 'falsch — es war {ans}', fr: 'faux — c’était {ans}', hi: 'गलत — सही था {ans}' },
  'et.timeUp':              { en: 'time’s up — it was {ans}', ko: '시간 초과 — 정답은 {ans}', ja: '時間切れ — 正解は {ans}', zh: '时间到 — 答案是 {ans}', es: 'tiempo agotado — era {ans}', de: 'Zeit abgelaufen — es war {ans}', fr: 'temps écoulé — c’était {ans}', hi: 'समय समाप्त — सही था {ans}' },
  'et.waitingOpponent':     { en: 'waiting for opponent…', ko: '상대를 기다리는 중…', ja: '相手を待っています…', zh: '等待对手…', es: 'esperando al oponente…', de: 'warten auf Gegner…', fr: 'en attente de l’adversaire…', hi: 'प्रतिद्वंद्वी की प्रतीक्षा…' },
  'et.modes':               { en: 'modes', ko: '모드', ja: 'モード', zh: '模式', es: 'modos', de: 'Modi', fr: 'modes', hi: 'मोड' },
  'et.modeInterval':        { en: 'intervals', ko: '음정', ja: '音程', zh: '音程', es: 'intervalos', de: 'Intervalle', fr: 'intervalles', hi: 'अंतराल' },
  'et.modeChord':           { en: 'chords', ko: '화음', ja: '和音', zh: '和弦', es: 'acordes', de: 'Akkorde', fr: 'accords', hi: 'कॉर्ड' },
  'et.difficulty':          { en: 'difficulty', ko: '난이도', ja: '難易度', zh: '难度', es: 'dificultad', de: 'Schwierigkeit', fr: 'difficulté', hi: 'कठिनाई' },
  'et.basic':               { en: 'basic',        ko: '초급', ja: '初級', zh: '基础', es: 'básico',  de: 'einfach',  fr: 'facile', hi: 'सरल' },
  'et.intermediate':        { en: 'intermediate', ko: '중급', ja: '中級', zh: '中级', es: 'intermedio', de: 'mittel', fr: 'moyen', hi: 'मध्यम' },
  'et.advanced':            { en: 'advanced',     ko: '고급', ja: '上級', zh: '高级', es: 'avanzado', de: 'schwer', fr: 'avancé', hi: 'कठिन' },
  'et.score':               { en: 'score', ko: '점수', ja: 'スコア', zh: '分数', es: 'puntos', de: 'Punkte', fr: 'score', hi: 'स्कोर' },
  'et.forfeit':             { en: 'forfeit', ko: '포기', ja: '棄権', zh: '弃赛', es: 'abandonar', de: 'aufgeben', fr: 'abandonner', hi: 'त्याग' },
  'et.forfeitConfirm':      { en: 'forfeit this game? the other player wins.', ko: '이 게임을 포기하시겠습니까? 상대 플레이어가 승리합니다.', ja: 'このゲームを棄権しますか？ 対戦相手の勝利になります。', zh: '弃赛？ 对手将获胜。', es: '¿abandonar la partida? el otro jugador gana.', de: 'Spiel aufgeben? der andere Spieler gewinnt.', fr: 'abandonner la partie ? l’autre joueur gagne.', hi: 'इस गेम को छोड़ें? दूसरा खिलाड़ी जीतता है।' },
  'et.bothPicking':         { en: 'waiting for both to lock in…', ko: '두 사람의 선택을 기다리는 중…', ja: '二人の選択を待っています…', zh: '等待两人选择…', es: 'esperando a que ambos elijan…', de: 'warten auf beide…', fr: 'en attente des deux joueurs…', hi: 'दोनों के चुनने का इंतज़ार…' },
  'et.answerWas':           { en: 'answer: {ans}', ko: '정답: {ans}', ja: '正解: {ans}', zh: '答案: {ans}', es: 'respuesta: {ans}', de: 'Antwort: {ans}', fr: 'réponse : {ans}', hi: 'उत्तर: {ans}' },
  'et.noAnswer':            { en: '—', ko: '—', ja: '—', zh: '—', es: '—', de: '—', fr: '—', hi: '—' },
  'et.skipped':             { en: 'no pick', ko: '미선택', ja: '未選択', zh: '未选', es: 'sin elegir', de: 'keine Wahl', fr: 'pas choisi', hi: 'चुना नहीं' },
} as const

export type TKey = keyof typeof T

/** Resolve a key to a string in the requested language, with English fallback. */
export function lookup (key: TKey, lang: Lang): string {
  const row = T[key] as TranslationRecord
  return row[lang] ?? row.en
}
