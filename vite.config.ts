/// <reference types="vitest/config" />
// file: vite.config.ts
// Vite build configuration with React and Tailwind CSS v4 plugins.
// Path alias @/ maps to src/ for clean imports.
// Dev server runs on https://localhost:5173.

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { z } from 'zod';

// Schema for validating projects.secret.json body before writing to disk (M3)
// WARNING: projects.secret.json must NEVER be deployed to production — it contains plaintext tokens
const ProjectConfigSchema = z.object({
  organizations: z.array(z.object({
    id: z.string(),
    name: z.string(),
    stack: z.string(),
    projects: z.array(z.object({
      id: z.string(),
      name: z.string(),
      token: z.string(),
    })),
  })),
  standaloneProjects: z.array(z.object({
    id: z.string(),
    name: z.string(),
    stack: z.string(),
    token: z.string(),
  })).optional(),
});

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
        // CSRF protection: only allow requests from localhost
        const origin = req.headers['origin'] ?? req.headers['referer'] ?? '';
        const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(origin);
        if (!isLocalhost) {
          res.statusCode = 403;
          res.end('Forbidden: only localhost requests allowed');
          return;
        }
        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        req.on('end', async () => {
          try {
            const raw = JSON.parse(body);
            // Validate against schema before writing to disk (M3)
            const parsed = ProjectConfigSchema.safeParse(raw);
            if (!parsed.success) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid project config', issues: parsed.error.issues }));
              return;
            }
            const { writeFile } = await import('fs/promises');
            await writeFile(
              resolve(__dirname, 'projects.secret.json'),
              JSON.stringify(parsed.data, null, 2),
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
