module.exports = {
  apps: [
    {
      name: 'clinica-inteligente',
      script: 'npx',
      args: [
        'wrangler', 'pages', 'dev', './dist',
        '--d1', 'DB=SUBSTITUA_PELO_ID_GERADO',
        '--binding', 'ENVIRONMENT=development',
        '--binding', 'JWT_SECRET=dev-secret-jwt-clinica-2024',
        '--port', '3000',
        '--ip', '0.0.0.0',
      ],
      cwd: '/home/user/webapp',
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      out_file: '/home/user/webapp/logs/app-out.log',
      error_file: '/home/user/webapp/logs/app-err.log',
      merge_logs: true,
      env: {
        NODE_ENV: 'development',
      },
    }
  ]
}
