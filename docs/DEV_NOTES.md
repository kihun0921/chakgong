# 개발 환경 메모

## Node와 npm 설치 (이 PC에서만 해당)

- 이 PC의 Node 24에서 `npm install`이 큰 패키지를 받을 때 `ERR_SSL_CIPHER_OPERATION_FAILED`로 실패한다. Node 20으로 바꿔도 같다. `curl`로는 정상 다운로드된다.
- 그래서 **패키지 파일을 curl로 받아 npm 캐시에 넣은 뒤 설치**하는 스크립트를 쓴다.
  ```bash
  # 프로젝트 폴더에서 (Git Bash)
  bash /c/AI_SERVICE/_tools/npm-safe-install.sh            # 전체 설치
  bash /c/AI_SERVICE/_tools/npm-safe-install.sh -D vitest   # 패키지 추가
  ```
  스크립트는 `--legacy-peer-deps`로 설치한다(npm 10.8의 의존성 계산 오류를 피하기 위함).
- Node는 서버(NHN)와 같은 **Node 20**을 쓴다. 이 PC에는 `C:\AI_SERVICE\_tools\node-v20.20.2-win-x64`에 압축을 풀어 두었다. 새 터미널에서는 먼저 PATH에 추가한다.
  ```bash
  export PATH="/c/AI_SERVICE/_tools/node-v20.20.2-win-x64:$PATH"
  node -v   # v20.20.2
  ```
- 다른 PC에서 개발하면 위 문제가 없을 수 있다. 그때는 일반 `npm install`을 쓴다.

## 주요 명령

| 명령 | 용도 |
| --- | --- |
| `npm run dev` | 개발 서버(http://localhost:3000) |
| `npm run build` | 운영 빌드 |
| `npm run test:run` | 시험 한 번 실행 |
| `npm test` | 시험 감시 모드 |
| `npm run typecheck` | 타입 검사 |
| `npm run lint` | 코드 검사 |

## Next.js 버전 주의

이 프로젝트의 Next.js는 학습된 버전과 다르다(16.4, `cacheComponents`·`partialPrefetching` 켜진 상태로 생성됨). 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 문서를 읽는다(`AGENTS.md` 규칙).

## 배포 (Wave 6 때 상세화)

올케어안전플랫폼과 같은 NHN 서버를 쓴다. 플랫폼은 3000번 포트를 쓰므로 이 서비스는 3001번을 쓴다. 절차는 플랫폼 `DEPLOY.md`와 같다(`git pull` → `npm ci` → `npm run build` → PM2 → Nginx). 단 NHN 서버에서는 Node 20 + 일반 `npm ci`를 쓴다.

## Wave 2 메모
- PDF 출력 글꼴은 `assets/fonts/NotoSansKR-*.otf`(OFL)이다. 서버는 `process.cwd()` 기준으로 이 폴더를 읽으므로 PM2는 프로젝트 폴더에서 실행해야 한다(`ecosystem.config.js`의 cwd).
- Nginx 업로드 한도는 서버 설정(`client_max_body_size`)을 100MB 이상으로 올려야 한다.
