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
  'game.invite':             { en: 'Invite',           ko: '초대',           ja: '招待',          zh: '邀请',     es: 'Invitar',           de: 'Einladen',        fr: 'Inviter',        hi: 'आमंत्रित' },
  'game.invited':            { en: 'Invited ✓',        ko: '초대됨 ✓',       ja: '招待済み ✓',    zh: '已邀请 ✓',  es: 'Invitado ✓',         de: 'Eingeladen ✓',    fr: 'Invité ✓',       hi: 'आमंत्रित ✓' },
  'game.noFriendsToInvite':  { en: 'No friends to invite.', ko: '초대할 친구가 없습니다.', ja: '招待できる友達がいません。', zh: '没有可邀请的好友。', es: 'No hay amigos para invitar.', de: 'Keine Freunde zum Einladen.', fr: 'Aucun ami à inviter.', hi: 'आमंत्रित करने के लिए कोई मित्र नहीं।' },
  'game.noMatch':            { en: 'No friends match "{q}".', ko: '"{q}"와 일치하는 친구가 없습니다.', ja: '"{q}"に一致する友達がいません。', zh: '没有匹配 "{q}" 的好友。', es: 'No hay amigos que coincidan con "{q}".', de: 'Keine Freunde stimmen mit „{q}“ überein.', fr: 'Aucun ami ne correspond à « {q} ».', hi: '"{q}" से मेल खाने वाला कोई मित्र नहीं।' },
  'game.searchFriends':      { en: 'Search friends…', ko: '친구 검색…', ja: '友達を検索…', zh: '搜索好友…', es: 'Buscar amigos…', de: 'Freunde suchen…', fr: 'Rechercher des amis…', hi: 'मित्र खोजें…' },
} as const

export type TKey = keyof typeof T

/** Resolve a key to a string in the requested language, with English fallback. */
export function lookup (key: TKey, lang: Lang): string {
  const row = T[key] as TranslationRecord
  return row[lang] ?? row.en
}
