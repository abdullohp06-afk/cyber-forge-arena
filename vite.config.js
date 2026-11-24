import {defineConfig} from 'vite';

// Relative asset paths: the same build runs inside the Capacitor WebView and from a Yandex Games sub-folder.
// `vite build --mode yandex` also loads the Yandex Games SDK, which the platform serves at /sdk.js.
export default defineConfig(({mode}) => ({
  base: './',
  // `--mode server`: the self-hosted build with accounts (.env.server sets VITE_CLOUD=on), served by server/server.mjs.
  build: mode === 'yandex' ? {outDir: 'dist-yandex'} : mode === 'server' ? {outDir: 'dist-server'} : {},
  plugins: mode === 'yandex' ? [{
    name: 'yandex-games-sdk',
    transformIndexHtml: html => html.replace('</head>', '  <script src="/sdk.js"></script>\n</head>'),
  }] : [],
}));
