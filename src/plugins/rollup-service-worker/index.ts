// @ts-nocheck
import source from './service-worker?raw'

export function rollupServiceWorkerPlugin() {
  let isBuild = false
  return {
    name: 'rollup-service-worker-plugin',
    configResolved(config) {
      isBuild = config.command === 'build'
    },
    generateBundle() {
      if (isBuild) {
        this.emitFile({
          type: 'asset',
          fileName: 'repl-service-worker.js',
          source,
        })
      }
    },
    transformIndexHtml(html) {
      return html.replace(
        '</body>',
        `<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/repl-service-worker.js')
    .then(registration => {
      console.info('Service Worker registered with scope:', registration.scope);
    })
    .catch(error => {
      console.info('Service Worker registration failed:', error);
    });
}
</script>
</body>`,
      )
    },
    configureServer(server) {
      if (!isBuild) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/repl-service-worker.js') {
            res.setHeader('Content-Type', 'application/javascript')
            res.end(source)
          } else {
            next()
          }
        })
      }
    },
  }
}
