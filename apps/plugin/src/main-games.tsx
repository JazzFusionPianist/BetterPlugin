import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { installPastePolyfill } from './lib/pastePolyfill'
import { installKeyboardCaptureReporter } from './lib/keyboardCapture'
import { ChatSession } from '@orb/core/components/ChatSession.tsx'
import { LanguageProvider } from './i18n/LanguageContext'
import Account from './Account'
import GamesPage from './pages/GamesPage'

/*  Slur Games' own page: the door, then the arcade. Built from games.html (VITE_PRODUCT=games) and carried inside the plugin. */
installPastePolyfill()
installKeyboardCaptureReporter()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <Account>{(client, user) => <ChatSession client={client} userId={user.id}><GamesPage supabase={client} user={user} /></ChatSession>}</Account>
    </LanguageProvider>
  </StrictMode>,
)
