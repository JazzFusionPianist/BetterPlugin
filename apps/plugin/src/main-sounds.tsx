import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { installPastePolyfill } from './lib/pastePolyfill'
import { installKeyboardCaptureReporter } from './lib/keyboardCapture'
import SoundsPage from './pages/SoundsPage'

/*  Patch on Slur's own page: the wall and nothing else. Built from sounds.html (VITE_PRODUCT=sounds) and carried inside
    the plugin — so a release of Patch on Slur holds only what the wall is made of, whatever the other products are doing. */
installPastePolyfill()
installKeyboardCaptureReporter()
createRoot(document.getElementById('root')!).render(<StrictMode><SoundsPage /></StrictMode>)
