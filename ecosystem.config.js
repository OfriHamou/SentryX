const fs = require('fs');

// Helper to manually parse a .env file without needing external packages
function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return {};

    return fs.readFileSync(filePath, 'utf8').split('\n').reduce((acc, line) => {
        const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            // Remove any surrounding quotes
            acc[match[1]] = match[2].replace(/^['"](.*)['"]$/, '$1').trim();
        }
        return acc;
    }, {});
}

module.exports = {
    apps: [
        {
            name: 'backend',
            script: 'bash',
            args: '-c "npm install && npm run dev"',
            cwd: './backend',
            watch: false,
            env: {
                ...parseEnvFile('./.env'),
                NODE_ENV: 'development'
            }
        },
        {
            name: 'customer-app',
            script: 'bash',
            args: '-c "npm install && npm run dev"',
            cwd: './frontend/customer-app',
            watch: false,
            env: {
                ...parseEnvFile('./frontend/customer-app/.env'),
                NODE_ENV: 'development'
            }
        },
        {
            name: 'admin-app',
            script: 'bash',
            args: '-c "npm install && npm run dev"',
            cwd: './frontend/admin-app',
            watch: false,
            env: {
                ...parseEnvFile('./frontend/admin-app/.env'),
                NODE_ENV: 'development'
            }
        },
        {
            name: 'periodics',
            script: 'bash',
            args: '-c "npm install && npm run dev"',
            cwd: './periodics',
            watch: false,
            env: {
                ...parseEnvFile('./backend/.env'),
                NODE_ENV: 'development',
                RUN_CONCURRENTLY: 'true'          // Flips on the parallel engine feature we built!
            }
        }
        // {
        //   name: 'python-worker',
        //   script: 'python',
        //   args: 'worker.py --env-file="../.env"',
        //   cwd: './mq/worker',
        //   watch: false,
        //   // Since cwd is ./mq/worker, the sentryx root .env is at ../../.env from the script's dir,
        //   // but parseEnvFile runs from where `pm2` command is run (the root sentryx dir).
        //   // So if pm2 is run in sentryx folder, parseEnvFile('./.env') finds sentryx/.env
        //   env: parseEnvFile('./.env')
        // }
    ]
};