# 배포 안내 (NHN Cloud 서버, Wave 6)

> 지금은 **로컬 파일 저장소**로 동작한다. 배포 직전에 Supabase 연결(저장소 교체)을 먼저 끝낸 뒤 아래 순서로 올린다.
> 이 문서의 서버 작업은 개발 PC에서는 실행할 수 없어, 서버에서 처음 해 볼 때 확인한다.

## 0. 올리기 전에 (맨 나중에 하기로 한 것)
1. Supabase 새 프로젝트(서울 리전, 무료) 만들고 저장소 구현 교체: `src/lib/ports/*.local.ts` → Supabase 구현. `src/lib/ports/index.ts`만 바꾼다.
2. 후이즈에서 `chakgong` A 레코드를 서버 IP로 추가.
3. GitHub 저장소 연결, 나라장터 API 키 발급.
4. Supabase 시험을 다시 실행: RLS, 리전, 무료 한도(DB 500MB·파일 1GB), 백업, Auth 세션.

## 1. 서버 준비 (한 번)
- Node 20 LTS, Nginx, PM2 (`npm i -g pm2`) — 올케어안전플랫폼 서버에 이미 있으면 재사용.
- 폴더 예: `/srv/chakgong` (GitHub에서 clone). `npm ci && npm run build`.
- 서버의 `.env.production` (GitHub에 올리지 않음, 권한 600). `.env.example` 항목을 채운다:
  `SESSION_SECRET`(32자 이상 랜덤), `FIELD_ENCRYPTION_KEY`(랜덤), Supabase 키들, `NARA_SERVICE_KEY`.
  **`FIELD_ENCRYPTION_KEY`를 잃으면 암호화된 주민번호·파일을 복구할 수 없다. 서버 밖(금고)에도 보관한다.**
- 관리자 계정: `node scripts/create-admin.mjs <아이디> <비밀번호>` (Supabase 전환 후에는 같은 계정을 DB에 넣는다).

## 2. 실행 (PM2, 포트 3001)
```
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```
- 포트 3001은 올케어안전플랫폼과 겹치지 않게 정했다. 이미 쓰고 있으면 `ecosystem.config.cjs`의 `-p`를 바꾸고 Nginx도 맞춘다.
- 상태 확인: `curl http://127.0.0.1:3001/api/health` → `{"status":"ok"}` (로그인 없이 상태만 돌려줌).

## 3. Nginx + HTTPS (chakgong.allcaresolution.net)
- `deploy/nginx-chakgong.conf`를 `/etc/nginx/conf.d/`에 복사. 업로드 한도(`client_max_body_size 120m`)와 TLS 1.2 이상이 들어 있다.
- 인증서: `certbot --nginx -d chakgong.allcaresolution.net` (A 레코드가 먼저 서버를 가리켜야 한다).
- `nginx -t && systemctl reload nginx`.

## 4. 백업 (SR-NF-11: 일 1회, RPO 24시간)
- 로컬 파일 단계: `node scripts/backup.mjs <백업폴더> 14` — `.data`를 시각별 폴더로 복사하고 14개만 남긴다.
  cron 예: `0 3 * * * cd /srv/chakgong && node scripts/backup.mjs /srv/backups/chakgong 14`
  백업 폴더는 **서버 밖(다른 디스크·저장소)에도 한 벌** 둔다.
- 복구: 서비스를 멈추고 `node scripts/restore.mjs <백업폴더/시각>` (기존 `.data`는 `.data.before-restore-…`로 보관). 복구 시험은 `backup.test.ts`가 자동으로 한다.
- Supabase 전환 후: 무료 요금제는 자동 백업이 없으므로 `pg_dump` + Storage 복사를 같은 cron에 넣거나, 유료(Pro) 일일 백업으로 올린다. **전환 후 복구 시험을 다시 한다.**

## 5. 점검 목록 (배포 직후)
- [ ] `https://chakgong.allcaresolution.net/login` 열림, `http://`는 https로 이동
- [ ] 로그인하지 않고 `/projects`, `/api/projects` 접근 → 로그인 화면 / 401
- [ ] 50MB 이상 PDF 업로드, 합본 PDF 생성 (Nginx 한도·시간 확인)
- [ ] 대시보드의 알림 영역 확인, `/api/health` 응답
- [ ] 월 가용성(SR-NF-06 99.5%)은 외부 업타임 모니터(예: `/api/health` 5분 간격)로 측정

## 6. 알림 (SR-NF-27~31)
- 대시보드 맨 위에 표시: 이력 기록 실패(즉시), 성능 한도 연속 3회 초과, 개인정보 1시간 20건 초과, 용역비 상태·납품 불일치, 입금 중복 시도.
- 메일·메신저로 바로 받는 채널은 배포 때 `Alert` 목록(`src/lib/monitor/alerts.ts`)을 보내도록 붙인다(발송 계정 필요).
- 나라장터 API 연속 실패 → 파일 첨부 안내 전환(SR-NF-29)은 API 연결 단계에서 만든다.
