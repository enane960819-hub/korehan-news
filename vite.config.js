import { defineConfig } from 'vite';
import { readdirSync, copyFileSync, mkdirSync, existsSync, cpSync } from 'fs';
import { resolve } from 'path';

// Collect all HTML files in korehan/ as entry points (multi-page app)
function getHtmlEntries() {
  const dir = resolve(__dirname, 'korehan');
  const entries = {};
  readdirSync(dir).forEach(file => {
    if (file.endsWith('.html')) {
      entries[file.replace('.html', '')] = resolve(dir, file);
    }
  });
  return entries;
}

// Plugin: copy static files that Vite doesn't process (JS loaded at runtime, _headers, etc.)
function copyStaticPlugin() {
  return {
    name: 'copy-static',
    closeBundle() {
      const dist = resolve(__dirname, 'dist');
      const src = resolve(__dirname, 'korehan');
      // Copy standalone JS files (loaded via <script src> in HTML)
      const jsFiles = readdirSync(src).filter(f => f.endsWith('.js'));
      jsFiles.forEach(f => copyFileSync(resolve(src, f), resolve(dist, f)));
      // Copy _headers for Cloudflare
      if (existsSync(resolve(src, '_headers')))
        copyFileSync(resolve(src, '_headers'), resolve(dist, '_headers'));
      // Copy assets directory — use cpSync with recursive so subdirectories
      // (e.g. assets/room/, assets/shop/) copy cleanly. copyFileSync would
      // throw EISDIR the moment anyone adds a subfolder.
      const assetsDir = resolve(src, 'assets');
      const distAssets = resolve(dist, 'assets');
      if (existsSync(assetsDir)) {
        if (!existsSync(distAssets)) mkdirSync(distAssets, { recursive: true });
        readdirSync(assetsDir).forEach(f =>
          cpSync(resolve(assetsDir, f), resolve(distAssets, f), { recursive: true })
        );
      }
      // Copy js/ directory (split modules — kept for reference). Recursive
      // copy here too so any future js subfolder doesn't break the build.
      const jsDir = resolve(src, 'js');
      const distJs = resolve(dist, 'js');
      if (existsSync(jsDir)) {
        if (!existsSync(distJs)) mkdirSync(distJs, { recursive: true });
        readdirSync(jsDir).forEach(f =>
          cpSync(resolve(jsDir, f), resolve(distJs, f), { recursive: true })
        );
      }
    }
  };
}

export default defineConfig({
  root: 'korehan',
  publicDir: false,  // We handle static files via plugin
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: getHtmlEntries(),
    },
    // Don't hash JS/CSS filenames — keep original names for cache busting via ?v= params
    assetsDir: 'assets',
    minify: false,
    sourcemap: false,
  },
  server: {
    port: 3000,
  },
  plugins: [copyStaticPlugin()],
});
