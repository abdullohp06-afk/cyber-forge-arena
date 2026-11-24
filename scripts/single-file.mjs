// dist/ → one self-contained HTML (JS, CSS and woff2 fonts inlined) that opens from a link, a file or a messenger.
// No dependencies: run after `vite build` (npm run build:single).
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';

const dist = 'dist', out = 'dist-single/cyber-forge-arena.html';
let html = readFileSync(join(dist, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet"[^>]*href="\.?\/?([^"]+\.css)"[^>]*>/, (_, href) => {
  const cssPath = join(dist, href);
  const css = readFileSync(cssPath, 'utf8')
    .replace(/,\s*url\([^)]+?\.woff\)\s*format\(["']woff["']\)/g, '')            // woff2 is enough for every current browser
    .replace(/url\(([^)]+?\.woff2)\)/g, (_, f) =>
      `url(data:font/woff2;base64,${readFileSync(join(dirname(cssPath), f.replace(/^["']|["']$/g, ''))).toString('base64')})`);
  return `<style>${css}</style>`;
});
html = html.replace(/<script type="module"[^>]*src="\.?\/?([^"]+\.js)"[^>]*><\/script>/, (_, src) =>
  `<script type="module">${readFileSync(join(dist, src), 'utf8').replace(/<\/script/gi, '<\\/script')}</script>`);

if (/src="\.?\/?assets\/|href="\.?\/?assets\//.test(html)) throw new Error('an asset was not inlined');
mkdirSync(dirname(out), {recursive: true});
writeFileSync(out, html);
console.log(`${out}: ${(html.length / 1024).toFixed(0)} KB`);

// Same game without the <html>/<head>/<body> shell, for hosts that add their own (a claude.ai artifact link).
const script = html.match(/<script type="module">[\s\S]*?<\/script>/)[0];
const page = [html.match(/<title>[\s\S]*?<\/title>/)[0], ...html.match(/<style>[\s\S]*?<\/style>/g),
              html.match(/<body>([\s\S]*?)<\/body>/)[1].replace(script, ''), script].join('\n');
writeFileSync('dist-single/play.html', page);
