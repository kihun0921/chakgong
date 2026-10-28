// PM2 설정 (docs/DEPLOY.md). 올케어안전플랫폼과 포트가 겹치지 않도록 3001을 쓴다.
module.exports = {
  apps: [
    {
      name: "chakgong",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3001",
      cwd: __dirname,
      instances: 1, // 용역비 동시 요청 직렬 처리가 프로세스 안에서 이뤄지므로 1개로 둔다(Supabase 전환 후 늘릴 수 있음)
      autorestart: true,
      max_memory_restart: "800M",
      env: { NODE_ENV: "production" }, // 나머지 비밀 값은 서버의 .env.production에 둔다(GitHub에 올리지 않음)
    },
  ],
};
