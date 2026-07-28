import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { LanguageProvider } from './i18n/LanguageContext'
import { installPastePolyfill } from './lib/pastePolyfill'
import { installKeyboardCaptureReporter } from './lib/keyboardCapture'

// Plugin host (DAW) usually swallows ⌘V before the WKWebView can see
// it, so the standard paste event never fires inside text inputs.
// Install a document-level keydown listener that reads the system
// clipboard via the JUCE native function and inserts the text manually.
// No-op outside the plugin (regular browsers handle paste natively).
installPastePolyfill()

// Tell the native key monitor when the page actually wants the keyboard
// (typing or a keyboard game) — every other keystroke, space included,
// passes through to the DAW transport.
installKeyboardCaptureReporter()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
)
