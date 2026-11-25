const { spawnSync } = require('node:child_process');
const env = {...process.env, APP_MODE:'preview', NODE_ENV:'development', NEXT_PUBLIC_SUPABASE_URL:'', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'', SUPABASE_SECRET_KEY:'', NEXT_PUBLIC_SITE_URL:'http://localhost:3000'};
const result = spawnSync(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--hostname','127.0.0.1'],{env,stdio:'inherit'});
process.exit(result.status ?? 1);
