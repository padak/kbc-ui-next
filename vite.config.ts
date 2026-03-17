/// <reference types="vitest/config" />
// file: vite.config.ts
// Vite build configuration with React and Tailwind CSS v4 plugins.
// Path alias @/ maps to src/ for clean imports.
// Dev server runs on https://localhost:5173.

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

function saveProjectsPlugin(): Plugin {
  return {
    name: 'save-projects',
    configureServer(server) {
      server.middlewares.use('/__save-projects', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }
        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const { writeFile } = await import('fs/promises');
            await writeFile(
              resolve(__dirname, 'projects.secret.json'),
              JSON.stringify(data, null, 2),
            );
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), saveProjectsPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
