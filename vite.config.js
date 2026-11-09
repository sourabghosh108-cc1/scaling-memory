import { defineConfig } from 'vite';
import { spawn } from 'child_process';

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    {
      name: 'local-api-search-handler',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/api/search')) {
            try {
              const url = new URL(req.url, 'http://localhost:3000');
              const q = url.searchParams.get('q') || url.searchParams.get('query');
              if (!q) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: 'Query parameter "q" is required' }));
              }

              const py = spawn('python', ['api/search.py', q]);
              let stdout = '';
              let stderr = '';
              py.stdout.on('data', (d) => { stdout += d; });
              py.stderr.on('data', (d) => { stderr += d; });

              py.on('close', (code) => {
                if (code === 0 && stdout) {
                  try {
                    const parsed = JSON.parse(stdout);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    return res.end(JSON.stringify(parsed));
                  } catch {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    return res.end(JSON.stringify({
                      query: q,
                      rawText: stdout,
                      provider: 'Orange-B Research Engine v3.0'
                    }));
                  }
                } else {
                  next();
                }
              });
              return;
            } catch {
              next();
            }
          }
          next();
        });
      }
    }
  ],
  build: {
    target: 'esnext',
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['cactus-needle'],
  },
});
