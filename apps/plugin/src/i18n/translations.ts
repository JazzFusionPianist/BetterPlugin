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

  // ───── Follow alert cards ("{name}" is replaced with the follower) ──────
  'notif.followsYou': { en: '{name} follows you', ko: '{name}님이 팔로우했어요', ja: '{name}さんにフォローされました', zh: '{name} 关注了你', es: '{name} te sigue', de: '{name} folgt dir jetzt', fr: '{name} vous suit', hi: '{name} ने आपको फ़ॉलो किया' },
  'notif.followBack': { en: 'follow back', ko: '맞팔로우', ja: 'フォローバック', zh: '回关', es: 'seguir también', de: 'zurückfolgen', fr: 'suivre en retour', hi: 'फ़ॉलो बैक' },
  'notif.mutual':     { en: 'you follow each other', ko: '서로 팔로우 중', ja: '相互フォロー中', zh: '互相关注', es: 'os seguís mutuamente', de: 'ihr folgt einander', fr: 'vous vous suivez', hi: 'आप एक-दूसरे को फ़ॉलो करते हैं' },

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
  'chat.messageWith':   { en: 'message {name}…', ko: '{name}에게 메시지…', ja: '{name}にメッセージ…', zh: '给 {name} 发消息…', es: 'mensaje a {name}…', de: 'Nachricht an {name}…', fr: 'message à {name}…', hi: '{name} को संदेश…' },
  'chat.noMessages':    { en: 'No messages yet', ko: '아직 메시지가 없습니다', ja: 'まだメッセージがありません', zh: '还没有消息', es: 'Aún no hay mensajes', de: 'Noch keine Nachrichten', fr: 'Pas encore de messages', hi: 'अभी कोई संदेश नहीं' },
  'chat.sendFailed':    { en: 'Failed to send. Please try again.', ko: '전송에 실패했습니다. 다시 시도해 주세요.', ja: '送信に失敗しました。もう一度お試しください。', zh: '发送失败，请重试。', es: 'No se pudo enviar. Inténtalo de nuevo.', de: 'Senden fehlgeschlagen. Bitte erneut versuchen.', fr: 'Échec de l’envoi. Veuillez réessayer.', hi: 'भेजना विफल। पुनः प्रयास करें।' },
  'chat.attachFile':    { en: 'Attach file', ko: '파일 첨부', ja: 'ファイルを添付', zh: '附加文件', es: 'Adjuntar archivo', de: 'Datei anhängen', fr: 'Joindre un fichier', hi: 'फ़ाइल संलग्न करें' },
  'chat.attachPhoto':   { en: 'Photo', ko: '사진', ja: '写真', zh: '照片', es: 'Foto', de: 'Foto', fr: 'Photo', hi: 'फ़ोटो' },
  'chat.attachVideo':   { en: 'Video', ko: '동영상', ja: '動画', zh: '视频', es: 'Video', de: 'Video', fr: 'Vidéo', hi: 'वीडियो' },
  'chat.attachAudio':   { en: 'Audio', ko: '오디오', ja: '音声', zh: '音频', es: 'Audio', de: 'Audio', fr: 'Audio', hi: 'ऑडियो' },
  'chat.dateToday':     { en: 'today', ko: '오늘', ja: '今日', zh: '今天', es: 'hoy', de: 'heute', fr: 'aujourd’hui', hi: 'आज' },

  // ───── Conversations panel ──────────────────────────────────────────────
  'conv.tabAll':         { en: 'All', ko: '전체', ja: 'すべて', zh: '全部', es: 'Todo', de: 'Alle', fr: 'Tout', hi: 'सभी' },
  'conv.tabFavorites':   { en: 'Favorites', ko: '즐겨찾기', ja: 'お気に入り', zh: '收藏', es: 'Favoritos', de: 'Favoriten', fr: 'Favoris', hi: 'पसंदीदा' },
  'conv.emptyAll':       { en: 'No conversations yet', ko: '아직 대화가 없습니다', ja: 'まだ会話がありません', zh: '还没有对话', es: 'Aún no hay conversaciones', de: 'Noch keine Gespräche', fr: 'Pas encore de conversations', hi: 'अभी कोई बातचीत नहीं' },
  'conv.emptyFavorites': { en: 'No favorite conversations', ko: '즐겨찾기한 대화가 없습니다', ja: 'お気に入りの会話がありません', zh: '没有收藏的对话', es: 'No hay conversaciones favoritas', de: 'Keine Favoritengespräche', fr: 'Aucune conversation favorite', hi: 'कोई पसंदीदा बातचीत नहीं' },
  'conv.youSentPhoto':   { en: 'You sent a photo', ko: '사진을 보냈습니다', ja: '写真を送信しました', zh: '你发送了照片', es: 'Enviaste una foto', de: 'Du hast ein Foto gesendet', fr: 'Vous avez envoyé une photo', hi: 'आपने एक फ़ोटो भेजी' },
  'conv.sentPhoto':      { en: 'Sent a photo', ko: '사진을 보냈습니다', ja: '写真を送信しました', zh: '发送了照片', es: 'Envió una foto', de: 'Hat ein Foto gesendet', fr: 'A envoyé une photo', hi: 'फ़ोटो भेजी' },
  'conv.youSentVideo':   { en: 'You sent a video', ko: '동영상을 보냈습니다', ja: '動画を送信しました', zh: '你发送了视频', es: 'Enviaste un video', de: 'Du hast ein Video gesendet', fr: 'Vous avez envoyé une vidéo', hi: 'आपने एक वीडियो भेजा' },
  'conv.sentVideo':      { en: 'Sent a video', ko: '동영상을 보냈습니다', ja: '動画を送信しました', zh: '发送了视频', es: 'Envió un video', de: 'Hat ein Video gesendet', fr: 'A envoyé une vidéo', hi: 'वीडियो भेजा' },
  'conv.youSentAudio':   { en: 'You sent an audio', ko: '오디오를 보냈습니다', ja: '音声を送信しました', zh: '你发送了音频', es: 'Enviaste un audio', de: 'Du hast eine Audio gesendet', fr: 'Vous avez envoyé un audio', hi: 'आपने एक ऑडियो भेजा' },
  'conv.sentAudio':      { en: 'Sent an audio', ko: '오디오를 보냈습니다', ja: '音声を送信しました', zh: '发送了音频', es: 'Envió un audio', de: 'Hat eine Audio gesendet', fr: 'A envoyé un audio', hi: 'ऑडियो भेजा' },
  'conv.youPrefix':      { en: 'You: {content}', ko: '나: {content}', ja: 'あなた: {content}', zh: '你: {content}', es: 'Tú: {content}', de: 'Du: {content}', fr: 'Vous : {content}', hi: 'आप: {content}' },

  // ───── Display panel ────────────────────────────────────────────────────
  'display.darkMode':       { en: 'Dark mode', ko: '다크 모드', ja: 'ダークモード', zh: '深色模式', es: 'Modo oscuro', de: 'Dunkler Modus', fr: 'Mode sombre', hi: 'डार्क मोड' },
  'display.setWallpaper':   { en: 'Set wallpaper', ko: '배경 설정', ja: '壁紙を設定', zh: '设置壁纸', es: 'Establecer fondo', de: 'Hintergrund festlegen', fr: 'Définir le fond', hi: 'वॉलपेपर सेट करें' },
  'display.choose':         { en: 'Choose', ko: '선택', ja: '選択', zh: '选择', es: 'Elegir', de: 'Wählen', fr: 'Choisir', hi: 'चुनें' },
  'display.removeWallpaper':{ en: 'Remove wallpaper', ko: '배경 제거', ja: '壁紙を削除', zh: '移除壁纸', es: 'Quitar fondo', de: 'Hintergrund entfernen', fr: 'Retirer le fond', hi: 'वॉलपेपर हटाएं' },
  'display.remove':         { en: 'Remove', ko: '제거', ja: '削除', zh: '移除', es: 'Quitar', de: 'Entfernen', fr: 'Retirer', hi: 'हटाएं' },
  'display.screenSize':     { en: 'Screen size', ko: '화면 크기', ja: '画面サイズ', zh: '屏幕大小', es: 'Tamaño de pantalla', de: 'Bildschirmgröße', fr: 'Taille d\'écran', hi: 'स्क्रीन आकार' },
  'display.size.small':     { en: 'Small', ko: '작게', ja: '小', zh: '小', es: 'Pequeño', de: 'Klein', fr: 'Petit', hi: 'छोटा' },
  'display.size.large':     { en: 'Large', ko: '크게', ja: '大', zh: '大', es: 'Grande', de: 'Groß', fr: 'Grand', hi: 'बड़ा' },

  // ───── Find people / AddFriend ──────────────────────────────────────────
  'addFriend.search':        { en: 'search by name…', ko: '이름으로 검색…', ja: '名前で検索…', zh: '按姓名搜索…', es: 'buscar por nombre…', de: 'nach Name suchen…', fr: 'rechercher par nom…', hi: 'नाम से खोजें…' },
  'addFriend.searchHint':    { en: 'Search for someone to follow', ko: '팔로우할 사람을 검색하세요', ja: 'フォローしたい人を検索', zh: '搜索要关注的人', es: 'Busca a alguien para seguir', de: 'Suche jemanden zum Folgen', fr: 'Rechercher quelqu’un à suivre', hi: 'फॉलो करने के लिए कोई खोजें' },
  'addFriend.mutual':        { en: 'mutual', ko: '상호 팔로우', ja: '相互フォロー', zh: '互相关注', es: 'mutuo', de: 'gegenseitig', fr: 'mutuel', hi: 'पारस्परिक' },
  'addFriend.followsYou':    { en: 'follows you', ko: '나를 팔로우', ja: 'フォロー中', zh: '关注了你', es: 'te sigue', de: 'folgt dir', fr: 'vous suit', hi: 'आपको फॉलो करता है' },
  'addFriend.mutualBtn':     { en: 'Mutual ✓', ko: '상호 ✓', ja: '相互 ✓', zh: '互相 ✓', es: 'Mutuo ✓', de: 'Gegenseitig ✓', fr: 'Mutuel ✓', hi: 'पारस्परिक ✓' },
  'addFriend.following':     { en: 'Following', ko: '팔로잉', ja: 'フォロー中', zh: '关注中', es: 'Siguiendo', de: 'Folge ich', fr: 'Suivi', hi: 'फॉलो कर रहे हैं' },
  'addFriend.follow':        { en: '+ Follow', ko: '+ 팔로우', ja: '+ フォロー', zh: '+ 关注', es: '+ Seguir', de: '+ Folgen', fr: '+ Suivre', hi: '+ फॉलो' },
  'addFriend.followBack':    { en: '+ Follow back', ko: '+ 맞팔로우', ja: '+ フォローバック', zh: '+ 回关', es: '+ Seguir también', de: '+ Zurückfolgen', fr: '+ Suivre en retour', hi: '+ वापस फॉलो करें' },
  'addFriend.unfollow':      { en: 'Unfollow', ko: '언팔로우', ja: 'フォロー解除', zh: '取消关注', es: 'Dejar de seguir', de: 'Entfolgen', fr: 'Ne plus suivre', hi: 'अनफॉलो' },
  'addFriend.loadMore':      { en: 'Load More', ko: '더 보기', ja: 'もっと見る', zh: '加载更多', es: 'Cargar más', de: 'Mehr laden', fr: 'Charger plus', hi: 'और लोड करें' },

  // ───── Game list ────────────────────────────────────────────────────────
  'game.chess':              { en: 'Chess',          ko: '체스',          ja: 'チェス',         zh: '国际象棋',  es: 'Ajedrez',        de: 'Schach',          fr: 'Échecs',         hi: 'शतरंज' },
  'game.fallingBlocks':      { en: 'Falling Blocks', ko: '폴링 블록',     ja: 'フォーリングブロック', zh: '方块下落',  es: 'Bloques que caen', de: 'Fallende Blöcke', fr: 'Blocs qui tombent', hi: 'गिरते ब्लॉक' },
  'game.poker':              { en: 'Poker',          ko: '포커',          ja: 'ポーカー',        zh: '扑克',     es: 'Póker',          de: 'Poker',           fr: 'Poker',          hi: 'पोकर' },
  'game.chessDesc':          { en: 'Play vs a friend', ko: '친구와 대결', ja: '友達と対戦', zh: '与好友对战', es: 'Juega contra un amigo', de: 'Spiele gegen einen Freund', fr: 'Jouez contre un ami', hi: 'दोस्त के साथ खेलें' },
  'game.fallingBlocksDesc':  { en: 'Battle 2-4 players', ko: '2-4인 대전', ja: '2〜4人で対戦', zh: '2-4 人对战', es: '2-4 jugadores', de: '2–4 Spieler', fr: '2-4 joueurs', hi: '2-4 खिलाड़ी' },
  'game.pokerDesc':          { en: "Texas Hold'em · 2-6 players", ko: '텍사스 홀덤 · 2-6인', ja: 'テキサスホールデム · 2〜6人', zh: '德州扑克 · 2-6 人', es: 'Texas Hold’em · 2-6 jugadores', de: 'Texas Hold’em · 2–6 Spieler', fr: 'Texas Hold’em · 2-6 joueurs', hi: 'टेक्सास होल्ड’एम · 2-6 खिलाड़ी' },

  // ───── Game lobby / common ──────────────────────────────────────────────
  'game.readyToPlay':        { en: 'Ready to play?', ko: '준비됐나요?', ja: 'プレイ準備はOK？', zh: '准备好了吗？', es: '¿Listo para jugar?', de: 'Bereit zu spielen?', fr: 'Prêt à jouer ?', hi: 'खेलने को तैयार?' },
  'game.inviteFriend':       { en: 'Invite a Friend',  ko: '친구 초대',      ja: '友達を招待',     zh: '邀请好友',  es: 'Invitar a un amigo', de: 'Freund einladen', fr: 'Inviter un ami', hi: 'मित्र को आमंत्रित करें' },
  'game.inviteFriends':      { en: 'Invite Friends',   ko: '친구 초대',      ja: '友達を招待',     zh: '邀请好友',  es: 'Invitar amigos',     de: 'Freunde einladen', fr: 'Inviter des amis', hi: 'मित्रों को आमंत्रित करें' },
  'game.playComputer':       { en: 'Play with Computer', ko: '컴퓨터와 대전', ja: 'コンピューターと対戦', zh: '与电脑对战', es: 'Jugar contra la computadora', de: 'Gegen Computer spielen', fr: 'Jouer contre l’ordinateur', hi: 'कंप्यूटर से खेलें' },
  'game.computerCount':      { en: 'Computer opponents', ko: '컴퓨터 상대 수', ja: 'コンピューター人数', zh: '电脑对手数量', es: 'Oponentes de computadora', de: 'Computergegner', fr: 'Adversaires ordinateur', hi: 'कंप्यूटर प्रतिद्वंद्वी' },
  'game.invite':             { en: 'Invite',           ko: '초대',           ja: '招待',          zh: '邀请',     es: 'Invitar',           de: 'Einladen',        fr: 'Inviter',        hi: 'आमंत्रित' },
  'game.invited':            { en: 'Invited ✓',        ko: '초대됨 ✓',       ja: '招待済み ✓',    zh: '已邀请 ✓',  es: 'Invitado ✓',         de: 'Eingeladen ✓',    fr: 'Invité ✓',       hi: 'आमंत्रित ✓' },
  'game.noFriendsToInvite':  { en: 'No friends to invite.', ko: '초대할 친구가 없습니다.', ja: '招待できる友達がいません。', zh: '没有可邀请的好友。', es: 'No hay amigos para invitar.', de: 'Keine Freunde zum Einladen.', fr: 'Aucun ami à inviter.', hi: 'आमंत्रित करने के लिए कोई मित्र नहीं।' },
  'game.noMatch':            { en: 'No friends match "{q}".', ko: '"{q}"와 일치하는 친구가 없습니다.', ja: '"{q}"に一致する友達がいません。', zh: '没有匹配 "{q}" 的好友。', es: 'No hay amigos que coincidan con "{q}".', de: 'Keine Freunde stimmen mit „{q}“ überein.', fr: 'Aucun ami ne correspond à « {q} ».', hi: '"{q}" से मेल खाने वाला कोई मित्र नहीं।' },
  'game.searchFriends':      { en: 'Search friends…', ko: '친구 검색…', ja: '友達を検索…', zh: '搜索好友…', es: 'Buscar amigos…', de: 'Freunde suchen…', fr: 'Rechercher des amis…', hi: 'मित्र खोजें…' },

  // ───── Game invite via chat ─────────────────────────────────────────────
  'game.invitedYouToPlay':  { en: 'invited you to play {game}', ko: '{game} 게임에 초대했습니다', ja: '{game} に招待しました', zh: '邀请你玩 {game}', es: 'te invitó a jugar {game}', de: 'hat dich zu {game} eingeladen', fr: 'vous a invité à jouer à {game}', hi: 'आपको {game} खेलने के लिए आमंत्रित किया' },
  'game.youInvitedToPlay':  { en: 'You invited everyone to play {game}', ko: '{game} 게임에 모두를 초대했습니다', ja: '{game} に全員を招待しました', zh: '你邀请大家玩 {game}', es: 'Invitaste a todos a jugar {game}', de: 'Du hast alle zu {game} eingeladen', fr: 'Vous avez invité tout le monde à jouer à {game}', hi: 'आपने सभी को {game} खेलने के लिए आमंत्रित किया' },
  'game.joinGame':          { en: 'Join Game', ko: '게임 참여', ja: 'ゲームに参加', zh: '加入游戏', es: 'Unirse al juego', de: 'Spiel beitreten', fr: 'Rejoindre la partie', hi: 'खेल में शामिल हों' },
  'game.roomFull':          { en: 'Room is full', ko: '방이 꽉 찼습니다', ja: '部屋は満員です', zh: '房间已满', es: 'La sala está llena', de: 'Raum ist voll', fr: 'La salle est pleine', hi: 'कमरा भरा हुआ है' },
  'game.roomExpired':       { en: 'This room has expired', ko: '이미 만료된 방입니다', ja: 'この部屋は期限切れです', zh: '这个房间已过期', es: 'Esta sala ha caducado', de: 'Dieser Raum ist abgelaufen', fr: 'Cette salle a expiré', hi: 'यह कमरा समाप्त हो चुका है' },
  'game.alreadyJoined':     { en: 'Already in the game', ko: '이미 참여 중', ja: '既に参加中', zh: '已加入', es: 'Ya estás en el juego', de: 'Bereits dabei', fr: 'Déjà dans la partie', hi: 'पहले से शामिल' },
  'conv.youSentGameInvite': { en: 'You sent a game invite', ko: '게임 초대를 보냈습니다', ja: 'ゲーム招待を送信しました', zh: '你发送了游戏邀请', es: 'Enviaste una invitación de juego', de: 'Du hast eine Spieleinladung gesendet', fr: 'Vous avez envoyé une invitation de jeu', hi: 'आपने एक गेम आमंत्रण भेजा' },
  'conv.sentGameInvite':    { en: 'Sent a game invite',  ko: '게임 초대를 보냈습니다', ja: 'ゲーム招待を送信しました', zh: '发送了游戏邀请', es: 'Envió una invitación de juego', de: 'Hat eine Spieleinladung gesendet', fr: 'A envoyé une invitation de jeu', hi: 'गेम आमंत्रण भेजा' },

  // ───── Common state / lobby ─────────────────────────────────────────────
  'common.ready':         { en: 'Ready',      ko: '준비',     ja: '準備OK',     zh: '准备',     es: 'Listo',     de: 'Bereit',     fr: 'Prêt',      hi: 'तैयार' },
  'common.rematch':       { en: 'Rematch',    ko: '다시 하기', ja: '再戦',      zh: '再来一局', es: 'Revancha',  de: 'Revanche',   fr: 'Revanche',  hi: 'रीमैच' },
  'common.notReady':      { en: 'Not ready',  ko: '준비 안됨', ja: '準備未完',   zh: '未准备',   es: 'No listo',  de: 'Nicht bereit', fr: 'Pas prêt', hi: 'तैयार नहीं' },
  'common.readyCheck':    { en: '✓ Ready',    ko: '✓ 준비',   ja: '✓ 準備OK',  zh: '✓ 准备',   es: '✓ Listo',   de: '✓ Bereit',   fr: '✓ Prêt',    hi: '✓ तैयार' },
  'common.you':           { en: 'You',        ko: '나',       ja: 'あなた',    zh: '你',       es: 'Tú',        de: 'Du',         fr: 'Vous',      hi: 'आप' },
  'common.me':            { en: 'Me',         ko: '나',       ja: '自分',      zh: '我',       es: 'Yo',        de: 'Ich',        fr: 'Moi',       hi: 'मैं' },
  'common.opponent':      { en: 'Opponent',   ko: '상대',     ja: '対戦相手',  zh: '对手',     es: 'Oponente',  de: 'Gegner',     fr: 'Adversaire', hi: 'प्रतिद्वंद्वी' },
  'common.waiting':       { en: 'Waiting…',   ko: '대기 중…', ja: '待機中…',   zh: '等待中…',   es: 'Esperando…', de: 'Warte…',    fr: 'En attente…', hi: 'प्रतीक्षा…' },
  'common.joining':       { en: 'Joining…',   ko: '입장 중…', ja: '参加中…',   zh: '加入中…',   es: 'Uniéndose…', de: 'Beitreten…', fr: 'Rejoindre…', hi: 'जुड़ रहे…' },
  'common.done':          { en: 'Done',       ko: '완료',     ja: '完了',      zh: '完成',     es: 'Listo',     de: 'Fertig',     fr: 'Terminé',   hi: 'पूर्ण' },
  'common.thinking':      { en: 'thinking…',  ko: '생각 중…', ja: '考え中…',   zh: '思考中…',   es: 'pensando…', de: 'denkt…',    fr: 'réfléchit…', hi: 'सोच रहे…' },
  'common.goBack':        { en: 'Go back',    ko: '뒤로',     ja: '戻る',      zh: '返回',     es: 'Volver',    de: 'Zurück',     fr: 'Retour',    hi: 'वापस' },

  // ───── Chess in-progress ────────────────────────────────────────────────
  'chess.resign':         { en: 'Resign',       ko: '기권',      ja: '投了',     zh: '认输',     es: 'Rendirse',  de: 'Aufgeben',  fr: 'Abandonner', hi: 'हार स्वीकार' },
  'chess.resignConfirm':  { en: 'Resign this game? Your opponent wins.', ko: '이 게임을 기권하시겠습니까? 상대방이 승리합니다.', ja: 'この対局を投了しますか？ 相手の勝利になります。', zh: '认输这局？ 对手将获胜。', es: '¿Rendirse en esta partida? Tu oponente gana.', de: 'Diese Partie aufgeben? Dein Gegner gewinnt.', fr: 'Abandonner cette partie ? Votre adversaire gagne.', hi: 'इस गेम में हार मानें? आपका प्रतिद्वंद्वी जीतता है।' },
  'chess.draw':           { en: 'Draw?',        ko: '무승부?',   ja: '引き分け？', zh: '和棋？',   es: '¿Tablas?',  de: 'Remis?',     fr: 'Nulle ?',   hi: 'ड्रॉ?' },
  'chess.drawOffered':    { en: 'Draw offered', ko: '무승부 제안됨', ja: '引き分け提案中', zh: '已提议和棋', es: 'Tablas ofrecidas', de: 'Remis angeboten', fr: 'Nulle proposée', hi: 'ड्रॉ प्रस्तावित' },
  'chess.acceptDraw':     { en: 'Accept Draw',  ko: '무승부 수락', ja: '引き分けを受諾', zh: '接受和棋', es: 'Aceptar tablas', de: 'Remis annehmen', fr: 'Accepter nulle', hi: 'ड्रॉ स्वीकार' },
  'chess.offerDraw':      { en: 'Offer draw',   ko: '무승부 제안', ja: '引き分けを提案', zh: '提议和棋', es: 'Ofrecer tablas', de: 'Remis anbieten', fr: 'Proposer une nulle', hi: 'ड्रॉ प्रस्ताव' },
  'chess.opponentOffered':{ en: 'Opponent offered a draw — accept?', ko: '상대가 무승부를 제안했습니다 — 수락하시겠습니까?', ja: '対戦相手が引き分けを提案 — 受諾？', zh: '对手提议和棋 — 接受？', es: 'El oponente ofreció tablas — ¿aceptar?', de: 'Gegner bietet Remis — annehmen?', fr: 'L’adversaire propose une nulle — accepter ?', hi: 'प्रतिद्वंद्वी ने ड्रॉ का प्रस्ताव दिया — स्वीकार?' },
  'chess.yourTurn':       { en: 'Your turn',  ko: '내 차례',    ja: 'あなたの番', zh: '该你了',   es: 'Tu turno',  de: 'Du bist dran', fr: 'À vous',  hi: 'आपकी बारी' },
  'chess.youWon':         { en: 'You won!',   ko: '승리!',     ja: '勝利！',    zh: '你赢了！', es: '¡Ganaste!', de: 'Gewonnen!',  fr: 'Gagné !',   hi: 'जीत!' },
  'chess.youLost':        { en: 'You lost',   ko: '패배',      ja: '敗北',      zh: '你输了',   es: 'Perdiste',  de: 'Verloren',   fr: 'Perdu',     hi: 'हार' },
  'chess.drawResult':     { en: 'Draw',       ko: '무승부',    ja: '引き分け',   zh: '和棋',     es: 'Tablas',    de: 'Remis',      fr: 'Nulle',     hi: 'ड्रॉ' },
  'chess.waitingForFriend':{ en: 'Waiting for friend…', ko: '친구를 기다리는 중…', ja: '友達を待っています…', zh: '等待好友…', es: 'Esperando al amigo…', de: 'Warten auf den Freund…', fr: 'En attente d’un ami…', hi: 'दोस्त की प्रतीक्षा…' },
  'chess.readyCount':     { en: '{n} / 2 ready', ko: '{n} / 2 준비', ja: '{n} / 2 準備完了', zh: '{n} / 2 已准备', es: '{n} / 2 listos', de: '{n} / 2 bereit', fr: '{n} / 2 prêts', hi: '{n} / 2 तैयार' },
  'chess.inviteCta':      { en: 'Invite a Friend', ko: '친구 초대', ja: '友達を招待', zh: '邀请好友', es: 'Invitar a un amigo', de: 'Freund einladen', fr: 'Inviter un ami', hi: 'मित्र को आमंत्रित' },
  'chess.playAgain':      { en: 'Play again', ko: '한 판 더', ja: 'もう一局', zh: '再来一局', es: 'Jugar otra vez', de: 'Noch eine Partie', fr: 'Rejouer', hi: 'फिर से खेलें' },
  'chess.endGame':        { en: 'end game', ko: '게임 종료', ja: 'ゲーム終了', zh: '结束游戏', es: 'terminar', de: 'Spiel beenden', fr: 'terminer', hi: 'गेम समाप्त' },
  'chess.record':         { en: 'vs {name} · {w}W {d}D {l}L', ko: '{name} 상대 전적 · {w}승 {d}무 {l}패', ja: '対 {name} · {w}勝 {d}分 {l}敗', zh: '对 {name} · {w}胜 {d}和 {l}负', es: 'vs {name} · {w}G {d}E {l}P', de: 'gegen {name} · {w}S {d}U {l}N', fr: 'vs {name} · {w}V {d}N {l}D', hi: '{name} के विरुद्ध · {w}जीत {d}ड्रॉ {l}हार' },

  // ───── Poker in-progress ────────────────────────────────────────────────
  'poker.fold':           { en: 'Fold',     ko: '폴드',     ja: 'フォールド',  zh: '弃牌',     es: 'Pasar',     de: 'Passen',     fr: 'Se coucher', hi: 'फोल्ड' },
  'poker.check':          { en: 'Check',    ko: '체크',     ja: 'チェック',    zh: '让牌',     es: 'Pasar',     de: 'Schieben',   fr: 'Check',     hi: 'चेक' },
  'poker.call':           { en: 'Call {amount}', ko: '콜 {amount}', ja: 'コール {amount}', zh: '跟注 {amount}', es: 'Igualar {amount}', de: 'Mitgehen {amount}', fr: 'Suivre {amount}', hi: 'कॉल {amount}' },
  'poker.callAllInChips': { en: 'All-in ({chips})', ko: '올인 ({chips})', ja: 'オールイン ({chips})', zh: '全下 ({chips})', es: 'All-in ({chips})', de: 'All-in ({chips})', fr: 'All-in ({chips})', hi: 'ऑल-इन ({chips})' },
  'poker.raise':          { en: 'Raise',    ko: '레이즈',   ja: 'レイズ',      zh: '加注',     es: 'Subir',     de: 'Erhöhen',    fr: 'Relancer',  hi: 'रेज़' },
  'poker.min':            { en: 'Min',      ko: '최소',     ja: 'ミニマム',    zh: '最小',     es: 'Mín',       de: 'Min',        fr: 'Min',       hi: 'न्यूनतम' },
  'poker.pot':            { en: 'Pot',      ko: '팟',       ja: 'ポット',     zh: '底池',     es: 'Bote',      de: 'Pot',        fr: 'Pot',       hi: 'पॉट' },
  'poker.allInShort':     { en: 'All-in',   ko: '올인',     ja: 'オールイン',  zh: '全下',     es: 'All-in',    de: 'All-in',     fr: 'All-in',    hi: 'ऑल-इन' },
  'poker.folded':         { en: 'Folded',   ko: '폴드함',   ja: 'フォールド済', zh: '已弃牌',  es: 'Pasado',    de: 'Gepasst',    fr: 'Couché',    hi: 'फोल्डेड' },
  'poker.gameOver':       { en: 'Game over', ko: '게임 종료', ja: 'ゲーム終了', zh: '游戏结束', es: 'Fin del juego', de: 'Spiel vorbei', fr: 'Partie terminée', hi: 'गेम समाप्त' },
  'poker.youWon':         { en: 'You won!',  ko: '승리!',    ja: '勝利！',     zh: '你赢了！', es: '¡Ganaste!',  de: 'Gewonnen!', fr: 'Gagné !',   hi: 'जीत!' },
  'poker.youLost':        { en: 'You lost',  ko: '패배',     ja: '敗北',       zh: '你输了',   es: 'Perdiste',   de: 'Verloren',  fr: 'Perdu',     hi: 'हार' },
  'poker.playerWon':      { en: '{name} won', ko: '{name} 승리', ja: '{name} の勝ち', zh: '{name} 获胜', es: '{name} ganó', de: '{name} hat gewonnen', fr: '{name} a gagné', hi: '{name} जीते' },
  'poker.forfeit':        { en: 'Forfeit',   ko: '포기',     ja: '棄権',       zh: '弃赛',     es: 'Abandonar', de: 'Aufgeben',   fr: 'Abandonner', hi: 'त्याग' },
  'poker.forfeitTip':     { en: 'Forfeit (end the game and let the other player win)', ko: '게임을 포기하고 상대 승리로 종료합니다', ja: '棄権（ゲームを終了し対戦相手の勝利にする）', zh: '弃赛（结束游戏并让对手获胜）', es: 'Abandonar (terminar el juego y dejar ganar al otro)', de: 'Aufgeben (Spiel beenden und Gegner gewinnen lassen)', fr: 'Abandonner (terminer la partie et laisser gagner l’autre)', hi: 'त्याग (खेल समाप्त करें और दूसरे को जीतने दें)' },
  'poker.playerThinking': { en: '{name} thinking…', ko: '{name} 생각 중…', ja: '{name} 考え中…', zh: '{name} 思考中…', es: '{name} pensando…', de: '{name} denkt…', fr: '{name} réfléchit…', hi: '{name} सोच रहे…' },
  'poker.showdown':       { en: 'Showdown', ko: '쇼다운', ja: 'ショーダウン', zh: '摊牌', es: 'Showdown', de: 'Showdown', fr: 'Abattage', hi: 'शोडाउन' },
  'poker.handNumber':     { en: 'Hand #{n}', ko: '핸드 #{n}', ja: 'ハンド #{n}', zh: '第 {n} 手牌', es: 'Mano #{n}', de: 'Hand #{n}', fr: 'Main n°{n}', hi: 'हैंड #{n}' },
  'poker.handComplete':   { en: 'Hand complete', ko: '핸드 종료', ja: 'ハンド終了', zh: '本手结束', es: 'Mano completa', de: 'Hand beendet', fr: 'Main terminée', hi: 'हैंड पूरा' },
  'poker.youWinPot':      { en: 'You win +{amount}', ko: '승리 +{amount}', ja: '勝利 +{amount}', zh: '你赢了 +{amount}', es: 'Ganas +{amount}', de: 'Du gewinnst +{amount}', fr: 'Vous gagnez +{amount}', hi: 'आप जीते +{amount}' },
  'poker.playerWinsPot':  { en: '{name} wins +{amount}', ko: '{name} 승리 +{amount}', ja: '{name} の勝ち +{amount}', zh: '{name} 获胜 +{amount}', es: '{name} gana +{amount}', de: '{name} gewinnt +{amount}', fr: '{name} gagne +{amount}', hi: '{name} जीते +{amount}' },
  'poker.splitPot':       { en: '{names} split +{amount}', ko: '{names} 팟 분배 +{amount}', ja: '{names} が分け取り +{amount}', zh: '{names} 平分 +{amount}', es: '{names} reparten +{amount}', de: '{names} teilen +{amount}', fr: '{names} partagent +{amount}', hi: '{names} बाँटते हैं +{amount}' },
  'poker.winner':         { en: 'Winner', ko: '승자', ja: '勝者', zh: '赢家', es: 'Ganador', de: 'Gewinner', fr: 'Gagnant', hi: 'विजेता' },
  'poker.revealed':       { en: 'Revealed', ko: '공개', ja: '公開', zh: '已亮牌', es: 'Revelado', de: 'Aufgedeckt', fr: 'Révélé', hi: 'दिखाया' },
  'poker.holeCards':      { en: 'Hole', ko: '패', ja: '手札', zh: '底牌', es: 'Cartas', de: 'Hand', fr: 'Privées', hi: 'होल' },
  'poker.bestFive':       { en: 'Best 5', ko: '베스트 5장', ja: 'ベスト5枚', zh: '最佳5张', es: 'Mejores 5', de: 'Beste 5', fr: 'Meilleures 5', hi: 'सर्वश्रेष्ठ 5' },
  'poker.rankHighCard':   { en: 'High Card', ko: '하이 카드', ja: 'ハイカード', zh: '高牌', es: 'Carta alta', de: 'High Card', fr: 'Carte haute', hi: 'हाई कार्ड' },
  'poker.rankPair':       { en: 'Pair', ko: '원 페어', ja: 'ワンペア', zh: '一对', es: 'Pareja', de: 'Paar', fr: 'Paire', hi: 'पेयर' },
  'poker.rankTwoPair':    { en: 'Two Pair', ko: '투 페어', ja: 'ツーペア', zh: '两对', es: 'Doble pareja', de: 'Zwei Paare', fr: 'Double paire', hi: 'दो पेयर' },
  'poker.rankTrips':      { en: 'Three of a Kind', ko: '트리플', ja: 'スリーカード', zh: '三条', es: 'Trío', de: 'Drilling', fr: 'Brelan', hi: 'तीन एक जैसे' },
  'poker.rankStraight':   { en: 'Straight', ko: '스트레이트', ja: 'ストレート', zh: '顺子', es: 'Escalera', de: 'Straight', fr: 'Quinte', hi: 'स्ट्रेट' },
  'poker.rankFlush':      { en: 'Flush', ko: '플러시', ja: 'フラッシュ', zh: '同花', es: 'Color', de: 'Flush', fr: 'Couleur', hi: 'फ्लश' },
  'poker.rankFullHouse':  { en: 'Full House', ko: '풀 하우스', ja: 'フルハウス', zh: '葫芦', es: 'Full house', de: 'Full House', fr: 'Full', hi: 'फुल हाउस' },
  'poker.rankQuads':      { en: 'Four of a Kind', ko: '포카드', ja: 'フォーカード', zh: '四条', es: 'Póker', de: 'Vierling', fr: 'Carré', hi: 'चार एक जैसे' },
  'poker.rankStraightFlush': { en: 'Straight Flush', ko: '스트레이트 플러시', ja: 'ストレートフラッシュ', zh: '同花顺', es: 'Escalera de color', de: 'Straight Flush', fr: 'Quinte flush', hi: 'स्ट्रेट फ्लश' },
  'poker.rankRoyalFlush': { en: 'Royal Flush', ko: '로열 플러시', ja: 'ロイヤルフラッシュ', zh: '皇家同花顺', es: 'Escalera real', de: 'Royal Flush', fr: 'Quinte flush royale', hi: 'रॉयल फ्लश' },

  // ───── Falling Blocks in-progress ───────────────────────────────────────
  // ───── In-chat calendar ─────────────────────────────────────────────────
  'chatcal.title':    { en: 'calendar', ko: '캘린더', ja: 'カレンダー', zh: '日历', es: 'calendario', de: 'Kalender', fr: 'calendrier', hi: 'कैलेंडर' },
  'chatcal.addChip':  { en: 'add to calendar', ko: '캘린더에 추가', ja: 'カレンダーに追加', zh: '添加到日历', es: 'añadir al calendario', de: 'in den Kalender', fr: 'ajouter au calendrier', hi: 'कैलेंडर में जोड़ें' },
  'chatcal.reading':  { en: 'reading…', ko: '읽는 중…', ja: '読み取り中…', zh: '解析中…', es: 'leyendo…', de: 'liest…', fr: 'lecture…', hi: 'पढ़ रहा है…' },
  'chatcal.noEvents': { en: 'no plans found', ko: '일정을 못 찾았어요', ja: '予定が見つかりません', zh: '未找到日程', es: 'no se encontraron planes', de: 'keine Termine gefunden', fr: 'aucun plan trouvé', hi: 'कोई योजना नहीं मिली' },
  'chatcal.save':     { en: 'save', ko: '저장', ja: '保存', zh: '保存', es: 'guardar', de: 'speichern', fr: 'enregistrer', hi: 'सहेजें' },
  'chatcal.saved':    { en: 'noted ✓', ko: '저장됨 ✓', ja: '保存済み ✓', zh: '已保存 ✓', es: 'anotado ✓', de: 'notiert ✓', fr: 'noté ✓', hi: 'सहेजा गया ✓' },

  'fb.score':       { en: 'Score',      ko: '점수',     ja: 'スコア',     zh: '分数',    es: 'Puntos',    de: 'Punkte',     fr: 'Score',     hi: 'स्कोर' },
  'fb.lines':       { en: 'Lines',      ko: '라인',     ja: 'ライン',     zh: '行数',    es: 'Líneas',    de: 'Reihen',     fr: 'Lignes',    hi: 'लाइनें' },
  'fb.incoming':    { en: 'Incoming',   ko: '받는 줄',  ja: '受信',       zh: '来袭',    es: 'Entrante',  de: 'Eingehend',  fr: 'Entrant',   hi: 'आगामी' },
  'fb.next':        { en: 'Next',       ko: '다음',     ja: '次',         zh: '下一个',  es: 'Siguiente', de: 'Nächstes',   fr: 'Suivant',   hi: 'अगला' },
  'fb.toppedOut':   { en: 'Topped out', ko: '게임 오버', ja: 'ゲームオーバー', zh: '顶满',    es: 'Eliminado', de: 'Spiel verloren', fr: 'Plein',  hi: 'टॉप आउट' },
  'fb.youAreOut':   { en: "You're out", ko: '탈락',     ja: '脱落',       zh: '你出局了', es: 'Has perdido', de: 'Ausgeschieden', fr: 'Vous êtes éliminé', hi: 'आप बाहर' },
  'fb.gameOver':    { en: 'Game over',  ko: '게임 종료', ja: 'ゲーム終了', zh: '游戏结束', es: 'Fin del juego', de: 'Spiel vorbei', fr: 'Partie terminée', hi: 'गेम समाप्त' },
  'fb.playerWon':   { en: '{name} won', ko: '{name} 승리', ja: '{name} の勝ち', zh: '{name} 获胜', es: '{name} ganó', de: '{name} hat gewonnen', fr: '{name} a gagné', hi: '{name} जीते' },
  'fb.hold':        { en: 'Hold',       ko: '홀드',     ja: 'ホールド',   zh: '暂存',    es: 'Reserva',   de: 'Halten',     fr: 'Réserve',   hi: 'होल्ड' },
  'fb.combo':       { en: 'Combo',      ko: '콤보',     ja: 'コンボ',     zh: '连击',    es: 'Combo',     de: 'Combo',      fr: 'Combo',     hi: 'कॉम्बो' },
  'fb.level':       { en: 'Level',      ko: '레벨',     ja: 'レベル',     zh: '等级',    es: 'Nivel',     de: 'Level',      fr: 'Niveau',    hi: 'स्तर' },

  // ───── Pinball ──────────────────────────────────────────────────────────
  'pb.ball':        { en: 'Ball',        ko: '볼',        ja: 'ボール',    zh: '球',      es: 'Bola',      de: 'Kugel',      fr: 'Bille',     hi: 'बॉल' },
  'pb.gameOver':    { en: 'Game over',   ko: '게임 종료',  ja: 'ゲーム終了', zh: '游戏结束', es: 'Fin del juego', de: 'Spiel vorbei', fr: 'Partie terminée', hi: 'गेम समाप्त' },
  'pb.leaderboard': { en: 'World ranking', ko: '월드 랭킹', ja: '世界ランキング', zh: '世界排名', es: 'Ranking mundial', de: 'Weltrangliste', fr: 'Classement mondial', hi: 'विश्व रैंकिंग' },
  'pb.yourBest':    { en: 'Your best',   ko: '내 최고 기록', ja: '自己ベスト', zh: '你的最佳', es: 'Tu récord', de: 'Dein Rekord', fr: 'Ton record', hi: 'आपका सर्वश्रेष्ठ' },
  'pb.newBest':     { en: 'New best!',   ko: '신기록!',    ja: '自己ベスト更新!', zh: '新纪录!', es: '¡Nuevo récord!', de: 'Neuer Rekord!', fr: 'Nouveau record !', hi: 'नया रिकॉर्ड!' },
  'pb.playAgain':   { en: 'Play again',  ko: '다시 하기',  ja: 'もう一度',   zh: '再玩一次', es: 'Jugar de nuevo', de: 'Nochmal', fr: 'Rejouer', hi: 'फिर खेलें' },
  'pb.start':       { en: 'Play',        ko: '시작',      ja: 'プレイ',     zh: '开始',    es: 'Jugar',     de: 'Spielen',    fr: 'Jouer',     hi: 'खेलें' },
  'pb.hintKeys':    { en: '← → flippers · space to launch', ko: '← → 플리퍼 · 스페이스로 발사', ja: '← → フリッパー・スペースで発射', zh: '← → 挡板 · 空格发射', es: '← → flippers · espacio para lanzar', de: '← → Flipper · Leertaste zum Start', fr: '← → flippers · espace pour lancer', hi: '← → फ्लिपर · स्पेस से लॉन्च' },
  'pb.hintTouch':   { en: 'tap left / right half · pull the plunger', ko: '왼쪽/오른쪽 탭 · 플런저 당겨서 발사', ja: '左右タップ・プランジャーを引く', zh: '点按左/右 · 拉动弹射器', es: 'toca izquierda/derecha · tira del lanzador', de: 'links/rechts tippen · Abzug ziehen', fr: 'touchez gauche/droite · tirez le lanceur', hi: 'बाएँ/दाएँ टैप करें · प्लंजर खींचें' },
  'pb.rank':        { en: 'Rank',        ko: '순위',      ja: '順位',       zh: '排名',    es: 'Puesto',    de: 'Rang',       fr: 'Rang',      hi: 'रैंक' },
  'pb.reset':       { en: 'Reset',       ko: '리셋',      ja: 'リセット',   zh: '重置',    es: 'Reiniciar', de: 'Neustart',   fr: 'Réinitialiser', hi: 'रीसेट' },
  'pb.end':         { en: 'End game',    ko: '게임 종료',  ja: 'ゲーム終了', zh: '结束游戏', es: 'Terminar',  de: 'Beenden',    fr: 'Terminer',  hi: 'गेम समाप्त' },
  'pb.endConfirm':  { en: 'End the game now and record the score?', ko: '지금 게임을 끝내고 점수를 기록할까?', ja: '今すぐ終了してスコアを記録しますか？', zh: '现在结束游戏并记录分数？', es: '¿Terminar ahora y registrar la puntuación?', de: 'Jetzt beenden und den Punktestand speichern?', fr: 'Terminer maintenant et enregistrer le score ?', hi: 'अभी गेम समाप्त करें और स्कोर दर्ज करें?' },
  'pb.resetConfirm': { en: 'Restart the game? The current score is lost.', ko: '게임을 다시 시작할까? 지금 점수는 사라져.', ja: 'ゲームをやり直しますか？現在のスコアは失われます。', zh: '重新开始游戏？当前分数将丢失。', es: '¿Reiniciar la partida? Se pierde la puntuación actual.', de: 'Spiel neu starten? Der aktuelle Punktestand geht verloren.', fr: 'Recommencer ? Le score actuel sera perdu.', hi: 'गेम फिर से शुरू करें? वर्तमान स्कोर खो जाएगा।' },
  'y.roll':         { en: 'Roll',        ko: '굴리기',    ja: 'ロール',     zh: '掷骰',    es: 'Tirar',     de: 'Würfeln',    fr: 'Lancer',    hi: 'रोल' },
  'y.yourTurn':     { en: 'your turn',   ko: '내 차례',    ja: 'あなたの番', zh: '你的回合', es: 'tu turno',  de: 'du bist dran', fr: 'à toi', hi: 'आपकी बारी' },
  'y.turnOf':       { en: "{name}'s turn", ko: '{name} 차례', ja: '{name}の番', zh: '{name} 的回合', es: 'turno de {name}', de: '{name} ist dran', fr: 'tour de {name}', hi: '{name} की बारी' },
  'y.round':        { en: 'round',       ko: '라운드',    ja: 'ラウンド',   zh: '回合',    es: 'ronda',     de: 'Runde',      fr: 'manche',    hi: 'राउंड' },
  'y.bonus':        { en: 'bonus',       ko: '보너스',    ja: 'ボーナス',   zh: '奖励',    es: 'bono',      de: 'Bonus',      fr: 'bonus',     hi: 'बोनस' },
  'y.write':        { en: 'Write it down', ko: '기입하기',  ja: '記入する',   zh: '记分',    es: 'Anotar',    de: 'Eintragen',  fr: 'Noter',     hi: 'लिखें' },
  'y.keep':         { en: 'keep',        ko: '킵',        ja: 'キープ',     zh: '保留',    es: 'guardar',   de: 'halten',     fr: 'garder',    hi: 'रखें' },
  'y.keepHint':     { en: 'tap a die to keep it', ko: '주사위를 탭해서 아껴두기', ja: 'ダイスをタップでキープ', zh: '点按骰子以保留', es: 'toca un dado para guardarlo', de: 'Würfel antippen zum Halten', fr: 'touche un dé pour le garder', hi: 'पासा रखने के लिए टैप करें' },
  'y.ledger':       { en: 'the ledger',  ko: '점수 원장',  ja: 'スコア台帳', zh: '记分册',  es: 'el libro',  de: 'das Blatt',  fr: 'le registre', hi: 'स्कोर बही' },
  'y.total':        { en: 'total',       ko: '합계',      ja: '合計',       zh: '总分',    es: 'total',     de: 'Summe',      fr: 'total',     hi: 'कुल' },
  'fb.playSolo':    { en: 'Play solo',   ko: '혼자 하기',  ja: 'ソロプレイ', zh: '单人游戏', es: 'Jugar solo', de: 'Solo spielen', fr: 'Jouer en solo', hi: 'अकेले खेलें' },

  // ───── Information Panel ────────────────────────────────────────────────
  'info.yourName':         { en: 'your name', ko: '이름', ja: '名前', zh: '你的名字', es: 'tu nombre', de: 'dein Name', fr: 'votre nom', hi: 'आपका नाम' },
  'info.email':            { en: 'Email', ko: '이메일', ja: 'メール', zh: '邮箱', es: 'Correo', de: 'E-Mail', fr: 'E-mail', hi: 'ईमेल' },
  'info.changePassword':   { en: 'Change Password', ko: '비밀번호 변경', ja: 'パスワードを変更', zh: '修改密码', es: 'Cambiar contraseña', de: 'Passwort ändern', fr: 'Modifier le mot de passe', hi: 'पासवर्ड बदलें' },
  'info.currentPw':        { en: 'current password', ko: '현재 비밀번호', ja: '現在のパスワード', zh: '当前密码', es: 'contraseña actual', de: 'aktuelles Passwort', fr: 'mot de passe actuel', hi: 'वर्तमान पासवर्ड' },
  'info.newPw':            { en: 'new password', ko: '새 비밀번호', ja: '新しいパスワード', zh: '新密码', es: 'nueva contraseña', de: 'neues Passwort', fr: 'nouveau mot de passe', hi: 'नया पासवर्ड' },
  'info.confirmPw':        { en: 'confirm new password', ko: '새 비밀번호 확인', ja: '新しいパスワードを確認', zh: '确认新密码', es: 'confirmar nueva contraseña', de: 'neues Passwort bestätigen', fr: 'confirmer le mot de passe', hi: 'नया पासवर्ड पुष्टि' },
  'info.updatePassword':   { en: 'Update password', ko: '비밀번호 변경', ja: 'パスワードを更新', zh: '更新密码', es: 'Actualizar contraseña', de: 'Passwort aktualisieren', fr: 'Mettre à jour', hi: 'पासवर्ड अपडेट' },
  'info.verifying':        { en: 'verifying…', ko: '확인 중…', ja: '確認中…', zh: '验证中…', es: 'verificando…', de: 'überprüfen…', fr: 'vérification…', hi: 'सत्यापित कर रहे…' },
  'info.deleteAccount':    { en: 'Delete Account', ko: '계정 삭제', ja: 'アカウントを削除', zh: '删除账号', es: 'Eliminar cuenta', de: 'Konto löschen', fr: 'Supprimer le compte', hi: 'खाता हटाएं' },
  'info.deleteWarning':    { en: 'This will permanently delete your account and all data. Type DELETE to confirm.', ko: '계정과 모든 데이터가 영구 삭제됩니다. 확인하려면 DELETE를 입력하세요.', ja: 'アカウントとすべてのデータが完全に削除されます。確認のため DELETE と入力してください。', zh: '这将永久删除你的账号和所有数据。输入 DELETE 确认。', es: 'Esto eliminará permanentemente tu cuenta y todos los datos. Escribe DELETE para confirmar.', de: 'Dies löscht dein Konto und alle Daten dauerhaft. Tippe DELETE zur Bestätigung.', fr: 'Cela supprimera définitivement votre compte et toutes les données. Tapez DELETE pour confirmer.', hi: 'यह आपका खाता और सारा डेटा स्थायी रूप से हटा देगा। पुष्टि के लिए DELETE टाइप करें।' },
  'info.deleteMyAccount':  { en: 'Delete my account', ko: '내 계정 삭제', ja: '自分のアカウントを削除', zh: '删除我的账号', es: 'Eliminar mi cuenta', de: 'Konto löschen', fr: 'Supprimer mon compte', hi: 'मेरा खाता हटाएं' },
  'info.deleting':         { en: 'deleting…', ko: '삭제 중…', ja: '削除中…', zh: '删除中…', es: 'eliminando…', de: 'löschen…', fr: 'suppression…', hi: 'हटाया जा रहा…' },

  // ───── Profile panel ────────────────────────────────────────────────────
  'profile.members':       { en: 'members',   ko: '멤버',     ja: 'メンバー',   zh: '成员',    es: 'miembros',   de: 'Mitglieder', fr: 'membres',   hi: 'सदस्य' },
  'profile.following':     { en: 'following', ko: '팔로잉',   ja: 'フォロー中', zh: '关注',    es: 'siguiendo',  de: 'folge ich',  fr: 'abonné',    hi: 'फॉलोइंग' },
  'profile.changePhoto':   { en: 'Change photo', ko: '사진 변경', ja: '写真を変更', zh: '更换照片', es: 'Cambiar foto', de: 'Foto ändern', fr: 'Changer la photo', hi: 'फ़ोटो बदलें' },

  // ───── Live panel — broadcaster side ────────────────────────────────────
  'live.streamEndedTitle': { en: 'Stream ended', ko: '방송 종료', ja: '配信終了', zh: '直播结束', es: 'Transmisión finalizada', de: 'Stream beendet', fr: 'Diffusion terminée', hi: 'स्ट्रीम समाप्त' },
  'live.duration':         { en: 'Duration', ko: '시간', ja: '時間', zh: '时长', es: 'Duración', de: 'Dauer', fr: 'Durée', hi: 'अवधि' },
  'live.totalViewers':     { en: 'Total viewers', ko: '총 시청자', ja: '合計視聴者', zh: '总观看', es: 'Espectadores totales', de: 'Gesamt-Zuschauer', fr: 'Spectateurs totaux', hi: 'कुल दर्शक' },
  'live.peakViewers':      { en: 'Peak viewers', ko: '최고 시청자', ja: 'ピーク視聴者', zh: '最高观看', es: 'Pico de espectadores', de: 'Spitzen-Zuschauer', fr: 'Spectateurs max.', hi: 'अधिकतम दर्शक' },
  'live.endStream':        { en: 'End Stream', ko: '방송 종료', ja: '配信を終了', zh: '结束直播', es: 'Terminar', de: 'Stream beenden', fr: 'Terminer le direct', hi: 'स्ट्रीम समाप्त' },
  'live.liveNow':          { en: 'Live Now', ko: '라이브 중', ja: 'ライブ中', zh: '正在直播', es: 'En vivo', de: 'Jetzt live', fr: 'En direct', hi: 'अभी लाइव' },
  'live.watch':            { en: 'Watch', ko: '시청', ja: '視聴', zh: '观看', es: 'Ver', de: 'Ansehen', fr: 'Regarder', hi: 'देखें' },

  // ───── Confirm / alert dialogs (native browser popups) ──────────────────
  'confirm.forfeitPoker':  { en: 'Forfeit this game? The other player will win.', ko: '이 게임을 포기하시겠습니까? 상대 플레이어가 승리합니다.', ja: 'このゲームを棄権しますか？ 対戦相手の勝利になります。', zh: '弃赛？ 对手将获胜。', es: '¿Abandonar la partida? El otro jugador ganará.', de: 'Spiel aufgeben? Der andere Spieler gewinnt.', fr: 'Abandonner la partie ? L’autre joueur gagne.', hi: 'इस गेम को छोड़ें? दूसरा खिलाड़ी जीतेगा।' },
  'confirm.forfeitFb':     { en: 'Forfeit the game? The other player wins.', ko: '게임을 포기하시겠습니까? 상대 플레이어가 승리합니다.', ja: 'ゲームを棄権しますか？ 対戦相手の勝利になります。', zh: '弃赛？ 对手将获胜。', es: '¿Abandonar la partida? El otro jugador gana.', de: 'Spiel aufgeben? Der andere Spieler gewinnt.', fr: 'Abandonner la partie ? L’autre joueur gagne.', hi: 'गेम छोड़ें? दूसरा खिलाड़ी जीतता है।' },
  'alert.maxFileSize5mb':  { en: 'Maximum file size is 5 MB.', ko: '파일 크기는 최대 5MB입니다.', ja: 'ファイルサイズは最大 5MB です。', zh: '文件大小最大 5 MB。', es: 'El tamaño máximo del archivo es 5 MB.', de: 'Maximale Dateigröße ist 5 MB.', fr: 'Taille maximale du fichier : 5 Mo.', hi: 'अधिकतम फ़ाइल आकार 5 MB है।' },

  // ───── Toasts / inline status messages ─────────────────────────────────
  'info.saved':              { en: 'saved',           ko: '저장됨',          ja: '保存しました',  zh: '已保存',    es: 'guardado',         de: 'gespeichert',     fr: 'enregistré',       hi: 'सहेजा गया' },
  'info.passwordChanged':    { en: 'password changed', ko: '비밀번호 변경됨',  ja: 'パスワードを変更しました', zh: '密码已修改',    es: 'contraseña cambiada', de: 'Passwort geändert', fr: 'mot de passe modifié', hi: 'पासवर्ड बदला गया' },
  'info.typeDeleteToConfirm':{ en: 'type DELETE to confirm', ko: '확인하려면 DELETE 입력', ja: '確認するには DELETE と入力', zh: '输入 DELETE 确认', es: 'escribe DELETE para confirmar', de: 'DELETE eingeben zum Bestätigen', fr: 'tapez DELETE pour confirmer', hi: 'पुष्टि के लिए DELETE टाइप करें' },

  // ───── Misc remaining UI strings ───────────────────────────────────────
  'liveChat.placeholder':  { en: 'Say something…', ko: '메시지를 남겨주세요…', ja: '何か書いてみる…', zh: '说点什么…', es: 'Di algo…', de: 'Sag etwas…', fr: 'Dites quelque chose…', hi: 'कुछ कहें…' },
  'chat.dropToAttach':     { en: 'Drop to attach', ko: '여기에 놓아 첨부', ja: 'ドロップして添付', zh: '拖放以添加附件', es: 'Soltar para adjuntar', de: 'Loslassen zum Anhängen', fr: 'Déposez pour joindre', hi: 'जोड़ने के लिए छोड़ें' },
  'chat.releaseToCancel':  { en: 'Release to cancel', ko: '취소하려면 놓기', ja: '離してキャンセル', zh: '释放以取消', es: 'Soltar para cancelar', de: 'Loslassen zum Abbrechen', fr: 'Relâcher pour annuler', hi: 'रद्द करने के लिए छोड़ें' },

  // ───── Ear Training Duel ────────────────────────────────────────────────
  'game.earTraining':       { en: 'Ear Training', ko: '청음 훈련', ja: '聴音トレーニング', zh: '听音训练', es: 'Entrenamiento auditivo', de: 'Gehörbildung', fr: 'Entraînement auditif', hi: 'कान का अभ्यास' },
  'game.earTrainingDesc':   { en: 'Identify intervals & chords', ko: '음정과 화음 알아맞히기', ja: '音程と和音を当てる', zh: '识别音程和和弦', es: 'Identifica intervalos y acordes', de: 'Intervalle und Akkorde erkennen', fr: 'Identifier intervalles et accords', hi: 'अंतराल और कॉर्ड पहचानें' },
  'game.pinball':           { en: 'Pinball', ko: '핀볼', ja: 'ピンボール', zh: '弹球', es: 'Pinball', de: 'Flipper', fr: 'Flipper', hi: 'पिनबॉल' },
  'game.yacht':             { en: 'Yacht Dice', ko: '야추 다이스', ja: 'ヨットダイス', zh: '快艇骰子', es: 'Yacht', de: 'Yacht', fr: 'Yacht', hi: 'यॉट डाइस' },
  'game.yachtDesc':         { en: 'Roll · hold · score', ko: '굴리고 · 킵하고 · 채우고', ja: '振って・残して・埋める', zh: '掷骰 · 保留 · 计分', es: 'Tira · guarda · anota', de: 'Würfeln · halten · punkten', fr: 'Lance · garde · marque', hi: 'रोल · होल्ड · स्कोर' },
  'game.orbMerge':  { en: 'orb merge',    ko: '오브 머지',   ja: 'オーブマージ', zh: '合并球',    es: 'fusión de orbes', de: 'Orb-Fusion', fr: 'fusion d’orbes', hi: 'ऑर्ब मर्ज' },
  'game.orbMergeDesc': { en: 'drop & merge the orbs', ko: '오브를 떨어뜨려 합쳐', ja: 'オーブを落として合体', zh: '掉落并合并球', es: 'suelta y fusiona los orbes', de: 'Orbs fallen lassen & fusionieren', fr: 'lâche et fusionne les orbes', hi: 'ऑर्ब गिराओ और मिलाओ' },
  'om.hint':        { en: 'move to aim · tap to drop', ko: '움직여 조준 · 탭해서 드롭', ja: '動かして狙い、タップで落とす', zh: '移动瞄准 · 点击落下', es: 'mueve para apuntar · toca para soltar', de: 'bewegen zum Zielen · tippen zum Fallen', fr: 'bouge pour viser · tape pour lâcher', hi: 'निशाना लगाओ · टैप से गिराओ' },
  'game.sketch':    { en: 'sketch',       ko: '스케치',      ja: 'スケッチ',     zh: '你画我猜',  es: 'boceto', de: 'Skizze', fr: 'croquis', hi: 'स्केच' },
  'game.sketchDesc': { en: 'draw & guess with friends', ko: '그리고 맞히는 친구 게임', ja: '描いて当てる友達ゲーム', zh: '和朋友画画猜词', es: 'dibuja y adivina con amigos', de: 'zeichnen & raten mit Freunden', fr: 'dessine et devine entre amis', hi: 'दोस्तों संग बनाओ और बूझो' },
  'sk.rules':       { en: 'one player draws the secret word — everyone else races to guess it in chat. faster guesses score more; the drawer scores per solver.', ko: '한 명이 제시어를 그리면 나머지가 채팅으로 맞혀. 빨리 맞힐수록 점수가 크고, 그린 사람도 맞힌 사람 수만큼 점수를 받아.', ja: '一人が単語を描き、他の人がチャットで当てる。早いほど高得点、描き手も当てられた分だけ得点。', zh: '一人画出词语，其他人在聊天里抢答。越快越高分，画的人也按猜中人数得分。', es: 'uno dibuja la palabra secreta y el resto compite por adivinarla en el chat.', de: 'einer zeichnet das Wort — die anderen raten im Chat um die Wette.', fr: 'un joueur dessine le mot secret — les autres devinent dans le chat.', hi: 'एक खिलाड़ी शब्द बनाता है — बाकी चैट में बूझते हैं।' },
  'sk.choose':      { en: 'pick a word',  ko: '단어를 골라', ja: '単語を選んで', zh: '选一个词',  es: 'elige una palabra', de: 'wähl ein Wort', fr: 'choisis un mot', hi: 'शब्द चुनो' },
  'sk.choosing':    { en: '{name} is picking a word…', ko: '{name} 단어 고르는 중…', ja: '{name}が単語を選んでいる…', zh: '{name}正在选词…', es: '{name} elige palabra…', de: '{name} wählt ein Wort…', fr: '{name} choisit un mot…', hi: '{name} शब्द चुन रहा है…' },
  'sk.yourWord':    { en: 'your word',    ko: '네 단어',     ja: 'あなたの単語', zh: '你的词',    es: 'tu palabra', de: 'dein Wort', fr: 'ton mot', hi: 'तुम्हारा शब्द' },
  'sk.guessPh':     { en: 'type your guess…', ko: '정답 입력…', ja: '答えを入力…', zh: '输入答案…', es: 'escribe tu respuesta…', de: 'rate hier…', fr: 'tape ta réponse…', hi: 'जवाब लिखो…' },
  'sk.guess':       { en: 'guess',        ko: '제출',        ja: '回答',         zh: '提交',      es: 'adivinar', de: 'raten', fr: 'deviner', hi: 'बूझो' },
  'sk.gotIt':       { en: 'got it!',      ko: '정답!',       ja: '正解！',       zh: '答对了！',  es: '¡acertaste!', de: 'richtig!', fr: 'trouvé !', hi: 'सही!' },
  'sk.reveal':      { en: 'the word was', ko: '정답은',      ja: '正解は',       zh: '答案是',    es: 'la palabra era', de: 'das Wort war', fr: 'le mot était', hi: 'शब्द था' },
  'sk.skip':        { en: 'skip turn',    ko: '턴 넘기기',   ja: 'ターンをスキップ', zh: '跳过回合', es: 'saltar turno', de: 'Zug überspringen', fr: 'passer le tour', hi: 'बारी छोड़ो' },
  'game.pinballDesc':       { en: 'Solo · world ranking', ko: '혼자서 · 월드 랭킹', ja: 'ソロ・世界ランキング', zh: '单人 · 世界排名', es: 'Solo · ranking mundial', de: 'Solo · Weltrangliste', fr: 'Solo · classement mondial', hi: 'सोलो · विश्व रैंकिंग' },
  'et.round':               { en: 'Round {n} / {total}', ko: '라운드 {n} / {total}', ja: 'ラウンド {n} / {total}', zh: '回合 {n} / {total}', es: 'Ronda {n} / {total}', de: 'Runde {n} / {total}', fr: 'Manche {n} / {total}', hi: 'राउंड {n} / {total}' },
  'et.play':                { en: 'Play', ko: '재생', ja: '再生', zh: '播放', es: 'Reproducir', de: 'Abspielen', fr: 'Jouer', hi: 'चलाएं' },
  'et.replaysLeft':         { en: '{n} replays left', ko: '재생 {n}회 남음', ja: '残り {n} 回', zh: '剩余 {n} 次', es: '{n} repeticiones restantes', de: 'Noch {n} Wiederh.', fr: '{n} relectures restantes', hi: '{n} रिप्ले शेष' },
  'et.whatInterval':        { en: 'What interval did you hear?', ko: '어떤 음정이 들렸나요?', ja: 'どの音程でしたか？', zh: '听到的是什么音程？', es: '¿Qué intervalo escuchaste?', de: 'Welches Intervall hast du gehört?', fr: 'Quel intervalle avez-vous entendu ?', hi: 'आपने कौन सा अंतराल सुना?' },
  'et.whatChord':           { en: 'What chord did you hear?', ko: '어떤 화음이 들렸나요?', ja: 'どの和音でしたか？', zh: '听到的是什么和弦？', es: '¿Qué acorde escuchaste?', de: 'Welchen Akkord hast du gehört?', fr: 'Quel accord avez-vous entendu ?', hi: 'आपने कौन सा कॉर्ड सुना?' },
  'et.correct':             { en: 'Correct!', ko: '정답!', ja: '正解！', zh: '正确！', es: '¡Correcto!', de: 'Richtig!', fr: 'Correct !', hi: 'सही!' },
  'et.wrong':               { en: 'Wrong — it was {ans}', ko: '오답 — 정답은 {ans}', ja: '不正解 — 正解は {ans}', zh: '错误 — 答案是 {ans}', es: 'Incorrecto — era {ans}', de: 'Falsch — es war {ans}', fr: 'Faux — c’était {ans}', hi: 'गलत — सही था {ans}' },
  'et.timeUp':              { en: 'Time’s up — it was {ans}', ko: '시간 초과 — 정답은 {ans}', ja: '時間切れ — 正解は {ans}', zh: '时间到 — 答案是 {ans}', es: 'Tiempo agotado — era {ans}', de: 'Zeit abgelaufen — es war {ans}', fr: 'Temps écoulé — c’était {ans}', hi: 'समय समाप्त — सही था {ans}' },
  'et.waitingOpponent':     { en: 'Waiting for opponent…', ko: '상대를 기다리는 중…', ja: '相手を待っています…', zh: '等待对手…', es: 'Esperando al oponente…', de: 'Warten auf Gegner…', fr: 'En attente de l’adversaire…', hi: 'प्रतिद्वंद्वी की प्रतीक्षा…' },
  'et.modes':               { en: 'Modes', ko: '모드', ja: 'モード', zh: '模式', es: 'Modos', de: 'Modi', fr: 'Modes', hi: 'मोड' },
  'et.modeInterval':        { en: 'Intervals', ko: '음정', ja: '音程', zh: '音程', es: 'Intervalos', de: 'Intervalle', fr: 'Intervalles', hi: 'अंतराल' },
  'et.modeChord':           { en: 'Chords', ko: '화음', ja: '和音', zh: '和弦', es: 'Acordes', de: 'Akkorde', fr: 'Accords', hi: 'कॉर्ड' },
  'et.difficulty':          { en: 'Difficulty', ko: '난이도', ja: '難易度', zh: '难度', es: 'Dificultad', de: 'Schwierigkeit', fr: 'Difficulté', hi: 'कठिनाई' },
  'et.basic':               { en: 'Basic',        ko: '초급', ja: '初級', zh: '基础', es: 'Básico',  de: 'Einfach',  fr: 'Facile', hi: 'सरल' },
  'et.intermediate':        { en: 'Intermediate', ko: '중급', ja: '中級', zh: '中级', es: 'Intermedio', de: 'Mittel', fr: 'Moyen', hi: 'मध्यम' },
  'et.advanced':            { en: 'Advanced',     ko: '고급', ja: '上級', zh: '高级', es: 'Avanzado', de: 'Schwer', fr: 'Avancé', hi: 'कठिन' },
  'et.score':               { en: 'Score', ko: '점수', ja: 'スコア', zh: '分数', es: 'Puntos', de: 'Punkte', fr: 'Score', hi: 'स्कोर' },
  'et.forfeit':             { en: 'Forfeit', ko: '포기', ja: '棄権', zh: '弃赛', es: 'Abandonar', de: 'Aufgeben', fr: 'Abandonner', hi: 'त्याग' },
  'et.forfeitConfirm':      { en: 'Forfeit this game? The other player wins.', ko: '이 게임을 포기하시겠습니까? 상대방이 승리합니다.', ja: 'このゲームを棄権しますか？相手の勝利になります。', zh: '弃赛？对手将获胜。', es: '¿Abandonar la partida? El otro jugador gana.', de: 'Spiel aufgeben? Der andere Spieler gewinnt.', fr: 'Abandonner la partie ? L’autre joueur gagne.', hi: 'इस गेम को छोड़ें? दूसरा खिलाड़ी जीतता है।' },
  'et.bothPicking':         { en: 'Waiting for both to lock in…', ko: '두 사람의 선택을 기다리는 중…', ja: '二人の選択を待っています…', zh: '等待两人选择…', es: 'Esperando a que ambos elijan…', de: 'Warten auf beide…', fr: 'En attente des deux joueurs…', hi: 'दोनों के चुनने का इंतज़ार…' },
  'et.answerWas':           { en: 'Answer: {ans}', ko: '정답: {ans}', ja: '正解: {ans}', zh: '答案: {ans}', es: 'Respuesta: {ans}', de: 'Antwort: {ans}', fr: 'Réponse : {ans}', hi: 'उत्तर: {ans}' },
  'et.noAnswer':            { en: '—', ko: '—', ja: '—', zh: '—', es: '—', de: '—', fr: '—', hi: '—' },
  'et.skipped':             { en: 'no pick', ko: '미선택', ja: '未選択', zh: '未选', es: 'sin elegir', de: 'keine Wahl', fr: 'pas choisi', hi: 'चुना नहीं' },
} as const

export type TKey = keyof typeof T

/** Resolve a key to a string in the requested language, with English fallback. */
export function lookup (key: TKey, lang: Lang): string {
  const row = T[key] as TranslationRecord
  return row[lang] ?? row.en
}
