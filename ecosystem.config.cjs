// ============================================================
// PM2 Ecosystem — Clínica Inteligente
// Wrangler pages dev lê .dev.vars automaticamente
// ============================================================

const fs   = require('fs')
const path = require('path')

// Ler .dev.vars para injetar como env no PM2
function readDevVars() {
  const devVarsPath = path.join(__dirname, '.dev.vars')
  if (!fs.existsSync(devVarsPath)) return {}

  const vars = {}
  const lines = fs.readFileSync(devVarsPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [key, ...rest] = trimmed.split('=')
    if (key && rest.length) {
      vars[key.trim()] = rest.join('=').trim()
    }
  }
  return vars
}

const devVars = readDevVars()

module.exports = {
  apps: [
    {
      name:       'clinica-inteligente',
      script:     'npx',
      args: [
        'wrangler', 'pages', 'dev', './dist',
        '--d1', 'DB=SUBSTITUA_PELO_ID_GERADO',
        '--port', '3000',
        '--ip', '0.0.0.0',
      ],
      cwd:           '/home/user/webapp',
      watch:         false,
      instances:     1,
      exec_mode:     'fork',
      autorestart:   true,
      restart_delay: 3000,
      max_restarts:  10,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      out_file:      '/home/user/webapp/logs/app-out.log',
      error_file:    '/home/user/webapp/logs/app-err.log',
      merge_logs:    true,
      env: {
        NODE_ENV: 'development',
        ...devVars,   // injeta JWT_SECRET, OPENAI_API_KEY, OPENAI_MODEL, etc.
      },
    }
  ]
}
