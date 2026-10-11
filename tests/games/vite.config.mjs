import {defineConfig} from '../../apps/plugin/node_modules/vite/dist/node/index.js'
import react from '../../apps/plugin/node_modules/@vitejs/plugin-react/dist/index.js'
import {fileURLToPath} from 'node:url'
export default defineConfig({
  root:fileURLToPath(new URL('.',import.meta.url)),
  plugins:[react()],
  resolve:{alias:{'@':fileURLToPath(new URL('../../apps/web',import.meta.url)),
    '@orb/core':fileURLToPath(new URL('../../packages/core',import.meta.url)),
    'react-dom':fileURLToPath(new URL('../../apps/plugin/node_modules/react-dom',import.meta.url)),
    react:fileURLToPath(new URL('../../apps/plugin/node_modules/react',import.meta.url))},dedupe:['react','react-dom']},
  optimizeDeps:{include:['react','react-dom/client','react/jsx-runtime']},
  define:{__BUILD_ID__:JSON.stringify('games-qa'),__APP_VERSION__:JSON.stringify('qa'),'process.env.NODE_ENV':JSON.stringify('development')},
  server:{host:'127.0.0.1',port:5191,strictPort:true,fs:{allow:[fileURLToPath(new URL('../..',import.meta.url))]}},
})
