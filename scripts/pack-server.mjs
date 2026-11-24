// Packs the self-hosted game for an Orange Pi: cyberforge-server.zip = dist-server/ + server/. Run via `npm run pack:server`.
import {cpSync, rmSync, mkdirSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

if (!existsSync('dist-server/index.html')) throw new Error('No dist-server/: run `vite build --mode server` first');
const out = 'pack/cyberforge';
rmSync('pack', {recursive: true, force: true});
mkdirSync(`${out}/server`, {recursive: true});
cpSync('dist-server', `${out}/dist-server`, {recursive: true});
for (const f of ['server.mjs', 'cyberforge.service', 'README-ru.md']) cpSync(`server/${f}`, `${out}/server/${f}`);
execFileSync(process.execPath, ['scripts/zip.mjs', out, 'cyberforge-server.zip'], {stdio: 'inherit'});
