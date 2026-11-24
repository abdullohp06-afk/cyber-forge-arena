// Minimal ZIP writer (deflate, UTF-8 names), no dependencies. Usage: node scripts/zip.mjs <dir> <out.zip>
// Files go in relative to <dir>, so dist-yandex/index.html becomes index.html at the archive root (Yandex Games requires it).
import {readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {deflateRawSync} from 'node:zlib';

const [dir, out] = process.argv.slice(2);
const CRC = Array.from({length: 256}, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buf => { let c = 0xFFFFFFFF; for (const b of buf) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const DOS_DATE = (0 << 9) | (1 << 5) | 1;   // 1980-01-01: a valid date keeps every unzip tool happy

const parts = [], central = [];
let offset = 0;
const paths = walk(dir);
for (const path of paths) {
  const name = Buffer.from(relative(dir, path).split(sep).join('/'));
  const data = readFileSync(path), packed = deflateRawSync(data), crc = crc32(data);
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
  h.writeUInt16LE(0, 10); h.writeUInt16LE(DOS_DATE, 12); h.writeUInt32LE(crc, 14);
  h.writeUInt32LE(packed.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
  parts.push(h, name, packed);
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
  c.writeUInt16LE(0, 12); c.writeUInt16LE(DOS_DATE, 14); c.writeUInt32LE(crc, 16);
  c.writeUInt32LE(packed.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
  central.push(c, name);
  offset += 30 + name.length + packed.length;
}
const cd = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(paths.length, 8); end.writeUInt16LE(paths.length, 10);
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
writeFileSync(out, Buffer.concat([...parts, cd, end]));
console.log(`${out}: ${paths.length} files, ${((offset + cd.length + 22) / 1024).toFixed(0)} KB`);
