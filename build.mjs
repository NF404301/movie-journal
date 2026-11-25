import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
if (url || key) {
  if (!url || new URL(url).protocol !== 'https:' || !key?.startsWith('sb_publishable_')) {
    throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY together using a publishable key.');
  }
  await build({
    entryPoints: ['cloud-entry.js'],
    outfile: 'dist/cloud.js',
    bundle: true,
    minify: true,
    define: {
      SUPABASE_PROJECT_URL: JSON.stringify(url),
      SUPABASE_PUBLIC_KEY: JSON.stringify(key)
    }
  });
  const html = await readFile('public/index.html', 'utf8');
  await writeFile('dist/index.html', html.replace('<html ', '<html data-cloud ')
    .replace('<main ', '<main inert ')
    .replace('<nav ', '<nav inert ')
    .replace('</body>', '<script src="cloud.js"></script></body>'));
}
