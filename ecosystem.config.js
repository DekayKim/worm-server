module.exports = {
    apps : [{
      name: 'wormio-server',
      script: './bin/www',
      // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
      instances: 1,
      autorestart: true,
      ignore_watch : [".git", "logs", "node_modules", "views", "public", ".vscode"],
      max_memory_restart: '1G',
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      env: {
        NODE_ENV: 'development',
        watch: true
      },
      env_production: {
        NODE_ENV: 'production',
        watch: false
      },
      out_file: "./logs/out_log",
      error_file: "./logs/error_log"
    }]
  };
  