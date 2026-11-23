// Rejoins source videos that Git stores in parts because GitHub limits files to 100 MB.
// Runs automatically after `npm ci` and is safe to run again: a file that already
// matches its checksum is left alone.
import {createHash} from 'node:crypto';
import {createReadStream, existsSync} from 'node:fs';
import {open, readdir, readFile, rename, rm} from 'node:fs/promises';
import {basename, dirname, join} from 'node:path';

const files = [
  {
    path: 'source-media/recorded-journeys/parkland-uk.mp4',
    sha256: 'cc183b1151d75ab950fb3525b3da2e7994fc68d99a7c2d976428cf0e5e235644',
  },
];

async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

for (const {path, sha256: expected} of files) {
  if (existsSync(path) && (await sha256(path)) === expected) continue;

  const dir = dirname(path);
  const prefix = basename(path) + '.part-';
  const parts = existsSync(dir) ? (await readdir(dir)).filter((name) => name.startsWith(prefix)).sort() : [];
  if (!parts.length) {
    console.warn(`${path}: no parts found, skipped`);
    continue;
  }

  const partial = path + '.joining';
  const out = await open(partial, 'w');
  try {
    for (const part of parts) await out.write(await readFile(join(dir, part)));
  } finally {
    await out.close();
  }

  if ((await sha256(partial)) !== expected) {
    await rm(partial);
    console.error(`${path}: checksum mismatch after joining ${parts.length} parts; file not written`);
    continue;
  }
  await rename(partial, path);
  console.log(`Rebuilt ${path} from ${parts.length} parts`);
}
