import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { installPastePolyfill } from './lib/pastePolyfill'
import { installKeyboardCaptureReporter } from './lib/keyboardCapture'
import { ChatSession } from '@orb/core/components/ChatSession.tsx'
import { LanguageProvider } from './i18n/LanguageContext'
import Account from './Account'
import StudioShell from './pages/StudioShell'

/*  Slur's own page: the door, then the studio. Built from chat.html (VITE_PRODUCT=chat) and carried inside the Slur plugin. */
installPastePolyfill()
installKeyboardCaptureReporter()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <Account>{(client, user) => <ChatSession client={client} userId={user.id}><StudioShell supabase={client} user={user} panel={false} /></ChatSession>}</Account>
    </LanguageProvider>
  </StrictMode>,
)
