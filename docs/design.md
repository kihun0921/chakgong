> 출처: `C:\AI_SERVICE\acplatform\specs\001-user-roles-permissions\design.md` (2026-08-29)를 그대로 가져왔다.
> 착공계 자동화는 이 문서의 색상·타이포·간격·컴포넌트·상태(Loading/Empty/Error/Unauthorized) 규칙·접근성 규칙을 쓴다.
> 올케어안전플랫폼 전용 화면(공고 검색, 계획서 작성 마법사, 회원·구독 화면)은 적용하지 않는다. 착공계는 관리자 전용 화면(7장 관리자 Navigation, 8장 Page Header)을 기준으로 한다.
> 서비스명은 "착공계 자동화"로 표기한다(원문의 "올케어안전플랫폼" 표기 규칙은 이 서비스에 적용하지 않는다).

---

# 올케어안전플랫폼 - 디자인 문서

**Feature Branch**: `001-user-roles-permissions`  
**Status**: Approved from Claude Design (원본 프리뷰 아티팩트 기준)  
**Created**: 2026-08-29  
**Last Updated**: 2026-08-29  

> ⚠️ 본 문서는 사용자가 첨부한 프리뷰 아티팩트(Main.dc.html 등)의 실제 마크업·CSS 변수를 그대로 추출하여 작성되었습니다. 이전 버전(Omelette 디자인 시스템 기반)은 아티팩트 편집기 자체의 내부 테마를 잘못 참조한 것으로, 전량 폐기되었습니다.

---

## 1. 디자인 콘셉트와 목표

건설사 공무·업무 담당자가 공공조달 공고를 기반으로 **안전보건관리계획서를 빠르고 정확하게 작성**하는 B2B SaaS의 디자인입니다.

### 핵심 가치
- **공고 연동**: 나라장터 API로 실제 공고 데이터를 조회
- **자동화**: 공고 첨부 양식에서 필수 항목을 자동 인식
- **단계별 마법사**: 사용자 친화적인 순차 작성 프로세스
- **신뢰성**: 데이터 보호, 권한 기반 접근 제어

### 설계 원칙
1. **기준선 유지** (Constitution Principle I): 메인 페이지의 색상·타이포·컴포넌트 재사용
2. **일관성** (Constitution Principle III): 전 화면에 걸친 동일한 레이아웃·패턴
3. **접근성**: 색상만 아닌 텍스트 + 아이콘, aria-label 속성, 키보드 네비게이션
4. **반응형**: 데스크톱(1200px+) / 태블릿(960px) / 모바일(640px)

---

## 2. 브랜드 이름과 핵심 문구

**공식 서비스명**: 올케어안전플랫폼

| 항목 | 내용 |
|------|------|
| **로고** | 방패 + 체크 아이콘 (SVG, `--font-display` 20px Bold) |
| **히어로 문구** | "공고에 맞는 안전보건관리계획서,\n자동으로 완성하세요" (44px, line-height 1.32) |
| **부제** | "나라장터 공고문을 분석해 요구하는 항목을 자동으로 파악하고, 단계별 절차에 따라 계획서를 작성한 뒤 PDF 또는 DOCX로 바로 다운로드하세요." |
| **히어로 배지** | "나라장터 연동 자동화 서비스" (primary-soft 배경, primary 텍스트, pill) |
| **주요 CTA** | "무료로 시작하기" (`{{accentColor}}` 배경, 기본값 #c2410c) |

**주의**: 모든 화면에서 축약형("올케어") 대신 "올케어안전플랫폼" 전체 표기 사용

---

## 3. 화면의 정보 구조 (사이트맵)

```
올케어안전플랫폼
├─ 메인 페이지 (공개)
│  ├─ 히어로 검색
│  ├─ 공고 리스트 미리보기 (로그인 여부에 따라 샘플/실 데이터)
│  ├─ 이용방법 4단계
│  ├─ 특징 하이라이트
│  └─ 내 문서함 미리보기 위젯
├─ 로그인 안내 (비회원이 보호된 화면 접근 시)
├─ 로그인
├─ 회원가입
├─ 공고 검색·목록 (회원 전용)
│  └─ 공고 상세 (첨부 서식 확인)
│      └─ 계획서 작성 마법사 (4단계 모달)
├─ 내 문서함 (작성중 / 완료 탭)
│  └─ 다운로드 (PDF·DOCX 선택)
├─ 마이페이지
├─ 구독·결제 안내 (미구독 회원 진입)
├─ 문의하기 (목록 + 작성)
│  └─ 문의 상세 (답변 확인, 잠금 상태)
└─ 관리자 영역
    ├─ 관리자 로그인 (별도 경로)
    ├─ 대시보드
    ├─ 회원 관리 (테이블 필터)
    ├─ API 인증정보 관리
    ├─ 구독료 결제창 관리
    └─ 문의 관리·답변
```

---

## 4. 화면별 레이아웃

### 4.1 메인 페이지 (Main.dc.html)

| 영역 | 설명 | 규칙 |
|------|------|------|
| **Header (고정)** | 로고 + 네비게이션 + 로그인/CTA | sticky, z-index 50 |
| **Hero** | 왼쪽: 제목/검색, 오른쪽: 완료된 계획서 카드 | 2열 그리드, 600px+ 간격 |
| **검색 영역** | 검색창 + 카테고리 필터 버튼 | 560px 최대폭 |
| **공고 리스트** | 카드형 (배지+제목+메타+액션 버튼) | gap: 14px, 색상 필터 적용 시 조건부 |
| **상태 표시** | Empty: "검색 조건에 맞는 공고가 없습니다" / Error: "공고 조회에 실패했습니다" | sc-if 조건 렌더링 |
| **이용방법 섹션** | 4단계 카드 그리드 | 4열(데스크톱) / 2열(태블릿) / 1열(모바일) |
| **특징 섹션** | 3개 카드 (아이콘 + 제목 + 설명) | 3열 그리드, 프라이머리-소프트 배경 |
| **문서함 위젯** | 탭(작성중/완료) + 진행률 표시 | 640px 최대폭 |
| **마법사 모달** | 4단계 (공고 확인 → 분석 결과 → 입력 폼 → 다운로드) | max-width: 640px, max-height: 88vh |

### 4.2 로그인 안내 (LoginGuide.dc.html)

| 영역 | 설명 |
|------|------|
| **보호된 콘텐츠** | 절대 노출하지 않음 |
| **메시지** | "로그인이 필요한 페이지입니다" (64px 아이콘 + 제목 + 설명) |
| **CTA** | 로그인 / 회원가입 버튼 |

### 4.3 공고 상세 (AnnouncementDetail.dc.html)

| 영역 | 설명 | 상태 |
|------|------|------|
| **공고 메타** | 배지(카테고리/D-day) + 제목 + 상세정보(2열 그리드) | 항상 표시 |
| **첨부 양식** | hasAttachments=true: 서식 리스트 / hasAttachments=false: "첨부된 양식이 없습니다" + 문의 링크 | sc-if 조건 |
| **CTA** | "계획서 작성 시작" 버튼 | accent-color |

### 4.3-1 양식 선택 화면 (TemplateSelection.dc.html)

사용자가 "계획서 작성 시작" 클릭 후, 어떤 양식을 사용할지 선택하는 화면. 자동 양식 경로가 사전에 확인되고, 사용 가능한 옵션만 표시됨.

| 영역 | 설명 | 표시 조건 |
|------|------|---------|
| **공고 정보** | 공고명 + 발주처 (상단 배너) | 항상 표시 |
| **양식 선택 옵션** | | |
| 1️⃣ 공고 첨부 샘플 | "이 공고에 첨부된 안전보건관리계획서 샘플을 사용합니다" (기본 선택) | 공고.attachments.length > 0 |
| 2️⃣ 발주처 표준 양식 | "발주처 표준 양식: [발주처명]" | 발주처 표준 양식 등록됨 |
| 3️⃣ 범용 기본 양식 | "일반적인 안전보건관리계획서 기본 양식을 사용합니다" | 항상 표시 (폴백) |
| 4️⃣ 직접 업로드 | "PDF, DOCX, HWP 파일을 업로드하면 자동으로 필드를 추출합니다" | 항상 표시 (폴백) |
| **설명 텍스트** | 각 옵션별 예상 항목 수와 파싱 상태 표시 | |
| **CTA** | "다음 단계로" 버튼 (선택된 옵션) / "직접 업로드" (드래그 앤 드롭) | 선택 후 활성화 |

**파싱 상태 표시**:
- ✓ 정상: "15개 필드 추출됨"
- ⚠️ 부분 실패: "10개 필드 추출됨, 파싱 실패한 부분은 수동 입력 가능"
- ✗ 실패: "파일 파싱 실패. 수동으로 필드를 입력하시거나 다른 양식을 선택하세요"

### 4.4 내 문서함 (MyDocuments.dc.html)

| 영역 | 설명 |
|------|------|
| **탭** | "작성중 (N)" / "완료 (M)" 라디오 버튼 스타일 |
| **작성중 카드** | 제목 + 발주처 + "X% 작성중" (진행률 바 + 텍스트) |
| **완료 카드** | 제목 + 발주처 + 완료일 + PDF/DOCX 다운로드 버튼 |

### 4.5 문의하기 (InquiryList.dc.html)

| 영역 | 설명 |
|------|------|
| **작성 폼** | textarea (4행) + 등록 버튼 |
| **문의 목록** | 제목 + 작성일 + 상태 배지 ("답변 완료" / "답변 대기") |

### 4.6 문의 상세 (InquiryDetail.dc.html)

| 영역 | 설명 | 상태 |
|------|------|------|
| **질문** | 제목 + 상태 배지 + 작성일 + 질문 내용 | 항상 표시 |
| **답변** | 관리자 답변 + 작성일 (프라이머리-소프트 배경) | hasAnswer=true인 경우 |
| **잠금 안내** | 잠금 아이콘 + "이 문의는 더 이상 수정·삭제할 수 없습니다" | hasAnswer=true인 경우 |

### 4.7 관리자 페이지들

| 페이지 | 특징 |
|--------|------|
| **AdminLogin.dc.html** | "관리자 전용" 배지로 구분, 일반 로그인과 별도 경로 |
| **AdminDashboard.dc.html** | 4개 메트릭 카드 (숫자 + 설명 + 상태 표시) + API 연동 상태 + 최근 문의 |
| **MemberManagement.dc.html** | 테이블 (건설사/담당자/이메일/가입일/구독/상태) + 탭 필터 |
| **ApiCredentials.dc.html** | API 목록 (발주처/키 마스킹/연동상태/마지막조회) + 신규 등록 폼 |
| **SubscriptionBilling.dc.html** | 결제수단 설정(좌) + 구독조건 설정(우) + 결제이력 테이블 |
| **InquiryManagement.dc.html** | 문의 목록 + 탭 필터 + 답변 작성 폼 (조건부) |

---

## 5. 화면 간 이동

### 데이터 흐름
```
메인 페이지 (샘플 공고)
  ↓
로그인 / 회원가입
  ↓
공고 검색·목록 (실 데이터)
  ↓
공고 상세 → 계획서 작성 마법사
  ↓
내 문서함 (작성중/완료)
  ↓
다운로드 (PDF/DOCX)
```

### 권한별 접근
| 경로 | 비회원 | 회원 | 관리자 |
|------|--------|------|--------|
| 메인 페이지 | ✓ | ✓ | ✓ |
| 공고 검색 | 로그인 안내 | ✓ | ✓ |
| 내 문서함 | 로그인 안내 | ✓ (본인만) | ✗ |
| 문의하기 | 로그인 안내 | ✓ | ✗ |
| 관리자 영역 | ✗ | ✗ | ✓ |

---

## 6. 회원과 관리자 상태 차이

### 회원 상태 표시
- **Header**: 프로필 아이콘(초성 배지) + "담당자님" + 로그아웃
- **색상**: 프라이머리 컬러 사용 (헤더 그대로)

### 관리자 상태 표시
- **Header**: 어두운 프라이머리 배경 + 흰색 텍스트 + "관리자" 배지
- **로그인 경로**: admin-login.html (별도 URL)
- **네비게이션**: 관리자 전용 메뉴 (대시보드 / 회원관리 / API관리 / 결제관리 / 문의관리)

---

## 7. Header와 Navigation 규칙

### 고정 Header (모든 페이지)
```html
<header style="position:sticky;top:0;z-index:50;background:var(--surface);border-bottom:1px solid var(--border);">
  <!-- 높이: 72px -->
  <!-- 콘텐츠: 로고 + 네비게이션 + 사용자/관리자 정보 -->
</header>
```

### 회원 Navigation (데스크톱)
- 공고검색 (링크)
- 내 문서함 (링크)
- 문의하기 (링크)

### 회원 Navigation (모바일 960px 이하)
- `.nav-links` 숨김
- 햄버거 버튼 표시
- 탭 시 fixed 드로어 노출 (right: 0, width: min(320px, 85vw))

### 관리자 Navigation
- 배경: 프라이머리 컬러 (테라코타)
- 텍스트: 흰색
- 높이: 64px
- 메뉴: 대시보드 / 회원관리 / API관리 / 결제관리 / 문의관리

---

## 8. Page Header 규칙

### 패턴
```html
<h1 style="font-family:var(--font-display);font-size:28px;font-weight:700;">페이지 제목</h1>
<p style="font-size:14px;color:var(--text-secondary);">설명 또는 상태 안내 (선택사항)</p>
```

### 예시
- 공고 상세: 제목 + 배지(카테고리/D-day) → h1
- 내 문서함: "내 문서함" → h1
- 마이페이지: "마이페이지" → h1
- 관리자 페이지: "대시보드" / "회원 관리" 등 → h1

---

## 9. 메인 Hero 구조

### 좌측 컨텐츠 (55%)
```
배지: "나라장터 연동 자동화 서비스" (프라이머리-소프트 배경)
  ↓
제목: "공고에 맞는 안전보건관리계획서,\n자동으로 완성하세요"
  ↓
설명: 서비스 가치 설명 (3줄)
  ↓
검색 입력: 
  - 검색창 + 검색 버튼 (accent-color)
  - placeholder: "공고명, 발주기관, 공고번호로 검색"
  ↓
특징 아이콘 리스트:
  - ✓ PDF · DOCX 지원
  - ✓ 공고 요구 항목 자동 매칭
```

### 우측 시각 요소 (45%)
```
카드 (샘플 계획서):
  - 파일 아이콘 + "안전보건관리계획서.pdf"
  - 하위 텍스트: "OO초등학교 증축공사"
  - 상태 배지: "작성 완료" (초록색)
  
체크리스트:
  - 4개 항목, 각각 ✓ 아이콘 + "자동 인식" 라벨
  
진행률 바:
  - 100% 채워짐 (accent-color)
  - "4/4 단계 완료" + "PDF · DOCX 다운로드 가능"

상태 인디케이터 (우상단 떠 있음):
  - ● 실시간 공고 분석 중 (성공색)
```

### 반응형
- **960px 이하**: 좌우 순서 유지, hero-grid 1열로
- **640px 이하**: 우측 시각 요소 축소

---

## 10. Loading, Empty, Error, Unauthorized 상태

### Loading 상태
**위치**: 공고 조회 시  
**표시**: 상태 인디케이터 (실시간 공고 분석 중)

```html
<div style="position:absolute;top:-16px;right:-16px;...">
  <span style="width:8px;height:8px;background:var(--success);border-radius:999px;"></span>
  <span>실시간 공고 분석 중</span>
</div>
```

### Empty 상태
**위치**: 공고 검색 결과  
**메시지**: "검색 조건에 맞는 공고가 없습니다"  
**스타일**: 중앙 정렬, 회색 텍스트, padding 48px

```html
<div style="text-align:center;padding:48px;color:var(--text-secondary);">
  검색 조건에 맞는 공고가 없습니다.
</div>
```

### Error 상태 (API 오류)
**위치**: 공고 검색 실패  
**표시**: 빨간 배지 + 아이콘 + 오류 메시지 + 다시시도 버튼

```html
<sc-if value="{{apiError}}">
  <div style="text-align:center;padding:48px;background:var(--surface);border:1px solid var(--danger);border-radius:12px;">
    <svg width="40" stroke="var(--danger)">⚠ 아이콘</svg>
    <div style="font-size:15px;font-weight:700;">공고 조회에 실패했습니다</div>
    <div style="font-size:14px;color:var(--text-secondary);">나라장터 API가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해주세요.</div>
    <button onClick="{{retrySearch}}">다시 시도</button>
  </div>
</sc-if>
```

### Unauthorized 상태 (로그인 필요)
**페이지**: LoginGuide.dc.html  
**표시**: 64px 아이콘(잠금) + h1(제목) + 설명 + CTA(로그인/가입)

```html
<div style="width:64px;height:64px;background:var(--primary-soft);border-radius:16px;">
  <!-- 잠금 아이콘 -->
</div>
<h1>로그인이 필요한 페이지입니다</h1>
<p>계획서 작성, 내 문서함, 문의하기 등은 로그인한 회원만 이용할 수 있습니다.</p>
<!-- 로그인 / 가입 버튼 -->
```

### Locked 상태 (문의 답변 완료)
**위치**: InquiryDetail.dc.html  
**표시**: 잠금 아이콘 + 텍스트 + 회색 배경

```html
<div style="display:flex;align-items:center;gap:10px;background:var(--surface-alt);">
  <svg>🔒 잠금 아이콘</svg>
  <span>관리자가 답변을 등록해 이 문의는 더 이상 수정하거나 삭제할 수 없습니다.</span>
</div>
```

---

## 11. 디자인 토큰 (원본 프리뷰에서 추출한 실제 값)

### 색상 시스템
```css
:root {
  --bg: oklch(98% 0.004 250);            /* 페이지 배경 (아주 밝은 회색) */
  --surface: oklch(100% 0 0);            /* 카드/표면 배경 (흰색) */
  --surface-alt: oklch(96.5% 0.006 250); /* 대체 배경 (약간 어두운 회색) */
  --border: oklch(90% 0.006 250);        /* 테두리 색상 */

  /* 텍스트 */
  --text: oklch(22% 0.015 255);          /* 주 텍스트 (검정에 가까움) */
  --text-secondary: oklch(46% 0.012 255);/* 보조 텍스트 (진회색) */
  --text-muted: oklch(60% 0.008 255);    /* 약한 텍스트 (옅은 회색) */

  /* 역할 색상 */
  --primary: oklch(33% 0.09 255);        /* 네이비 (헤더, 텍스트, 배지 배경) */
  --primary-strong: oklch(24% 0.09 255); /* 더 어두운 네이비 (hover) */
  --primary-soft: oklch(94% 0.02 255);   /* 밝은 네이비 (배경/배지) */

  --success: oklch(58% 0.13 150);        /* 초록색 (완료, 성공) */
  --success-soft: oklch(94% 0.035 150);  /* 밝은 초록색 */

  --warn: oklch(63% 0.13 75);            /* 앰버색 (경고, D-day) */
  --warn-soft: oklch(94% 0.035 80);      /* 밝은 앰버색 */

  --danger: oklch(56% 0.17 25);          /* 빨강색 (오류, 위험) */
  --danger-soft: oklch(94% 0.03 25);     /* 밝은 빨강색 */
}
```

이 값들은 첨부된 프리뷰 아티팩트의 `Main.dc.html` `<style>` 블록에서 **그대로 추출**되었습니다 (임의 변경 없음).

### Accent Color (기본값: accent-color = #c2410c, 앰버)
- 주요 CTA 버튼: `background-color: {{accentColor}}`
- 선택 가능 Variants: #c2410c(amber) / #0f766e(teal) / #b91c1c(red) / #7c3aed(purple)

---

## 12. 타이포그래피 계층

### 폰트 패밀리
```css
/* 착공계 자동화는 제목·본문 모두 맑은 고딕을 쓴다(2026-10-17 변경, 원문은 Noto 계열) */
--font-display: 'Malgun Gothic', '맑은 고딕', sans-serif;   /* 헤드라인용 */
--font-body: 'Malgun Gothic', '맑은 고딕', system-ui, -apple-system, sans-serif;
```

### 크기·가중치 계층

| 용도 | 크기 | 가중치 | 폰트 | 사용처 |
|------|------|--------|------|--------|
| 히어로 타이틀 | 44px | 700 | display | Hero h1 |
| 페이지 제목 (h1) | 26px | 700 | display | Page Header |
| 섹션 제목 (h2) | 29px | 700 | display | 섹션 헤더 |
| 카드 제목 | 16.5px | 700 | body | 공고 목록 |
| 일반 제목 | 15px | 700 | body | 카드 헤더 |
| 기본 텍스트 | 14px-15px | 400-500 | body | 본문 |
| 보조 텍스트 | 12.5px-13.5px | 500-600 | body | 라벨, 설명 |
| 약한 텍스트 | 11.5px-13px | 400-700 | body | 타임스탬프, 배지, 힌트 |

### 줄 높이
- 제목: 1.32
- 본문: 1.6-1.7
- 짧은 텍스트: 1.5

---

## 13. 색상 역할

### Primary Color (네이비)
- **용도**: 헤더 배경(관리자), 링크, 주요 배지 배경, 히어로 배지, 기본 텍스트
- **사용처**: 로고, 관리자 헤더, "나라장터 연동 자동화 서비스" 배지, 공고 카테고리 배지
- **Contrast**: WCAG AAA (텍스트 크기 14px 이상)

### Secondary / Accent Color
- **기본값**: Amber (#c2410c)
- **용도**: 주요 CTA 버튼("무료로 시작하기", "검색"), 진행률 바
- **Variants**: Teal (#0f766e), Red (#b91c1c), Purple (#7c3aed)

### Success Color (초록)
- **용도**: "완료", "작성 완료", "다운로드 가능" 배지, 체크리스트 아이콘
- **RGB**: oklch(58% 0.13 150)
- **배경**: oklch(94% 0.035 150) (배지/칩)

### Warning Color (앰버/황색)
- **용도**: D-day 배지, "답변 대기" 상태
- **RGB**: oklch(63% 0.13 75)
- **배경**: oklch(94% 0.035 80)

### Danger Color (빨강)
- **용도**: "필수" 표시(*), 오류 메시지, API 연동 실패, 위험 수치
- **RGB**: oklch(56% 0.17 25)
- **배경**: oklch(94% 0.03 25)

### Neutral Colors
- **Text**: oklch(22% 0.015 255) - 기본 텍스트
- **Text-Secondary**: oklch(46% 0.012 255) - 보조 텍스트
- **Text-Muted**: oklch(60% 0.008 255) - 약한 텍스트 (힌트, 타임스탬프)

### 금지 사항
- **색상만으로 상태 전달 금지**: 항상 텍스트 + 아이콘 병행

---

## 14. 간격과 최대 콘텐츠 폭

### 최대 콘텐츠 폭
```css
max-width: 1200px;  /* 대부분의 페이지 */
margin: 0 auto;
padding: 0 40px;    /* 데스크톱 좌우 여백 */
```

### 패딩 규칙
- **섹션 상하**: 76px-88px (히어로, 공고 섹션, CTA, 푸터)
- **메인 콘텐츠 상하**: 48px-56px
- **Header 높이**: 72px (회원) / 64px (관리자)

### 간격 (gap)
```css
gap: 8px    /* 인라인 요소들 사이 */
gap: 10px   /* 카드/리스트 아이템 내부 */
gap: 12px   /* 폼 필드, 작은 컴포넌트 */
gap: 14px   /* 카드/리스트 사이 */
gap: 16px   /* 섹션 내 블록 요소 */
gap: 20px-24px  /* 큰 컴포넌트 사이 */
gap: 28px-40px  /* 섹션 간 */
gap: 64px   /* 히어로 좌우 */
```

### 라운드 (border-radius)
```css
border-radius: 8px    /* 버튼, 작은 요소 */
border-radius: 12px   /* 카드, 인풋 필드 */
border-radius: 16px   /* 큰 아이콘 배경 */
border-radius: 20px   /* 시각적 강조 요소 */
border-radius: 999px  /* 완전 라운드 (배지, 아바타) */
```

---

## 15. Shadow와 Elevation

```css
--shadow-sm: 0 1px 2px rgba(20, 20, 19, 0.04);
--shadow-sm: 0 1px 3px rgba(20, 20, 19, 0.06);
--shadow-md: 0 4px 6px rgba(20, 20, 19, 0.06);
--shadow-lg: 0 10px 15px rgba(20, 20, 19, 0.08);
--shadow-xl: 0 24px 48px rgba(15, 12, 8, 0.16), 0 8px 16px rgba(15, 12, 8, 0.08);
```

---

## 16. 반응형 설계

### 데스크톱 (1200px+)
- Full sidebar navigation
- Grid layouts with 3-4 columns
- Full spacing and padding

### 태블릿 (960px)
- Hamburger menu
- 2-column grid layouts
- Adjusted padding/gap

### 모바일 (640px)
- Hamburger menu (fixed drawer)
- Single-column layout
- Compact spacing
- Stacked buttons

---

## 17. 상태 표시 (Badges & Status)

### 배지 (Badge) 유형
| 유형 | 배경색 | 텍스트색 | 사용처 |
|------|--------|----------|--------|
| Primary | var(--primary-soft) | var(--primary) | 카테고리, 서비스명 |
| Success | rgba(85, 138, 66, 0.12) | #558a42 | "완료", "작성 완료" |
| Warning | rgba(201, 168, 45, 0.12) | #c9a82d | D-day, "답변 대기" |
| Error | rgba(166, 50, 68, 0.12) | #a63244 | "필수", 오류 |
| Neutral | var(--surface-alt) | var(--text-secondary) | 일반 상태 |

---

## 18. Animation과 Transition

### 기본 Transition
```css
transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease;
```

### Hover 상태
```css
button:hover {
  background-color: var(--primary-strong);
  transition: background-color 150ms ease;
}
```

### Disabled 상태
```css
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: var(--surface-alt);
}
```

---

## 19. 접근성 (Accessibility)

### 색상 대비
- 텍스트 vs 배경: 최소 4.5:1 (WCAG AA)
- 큰 텍스트(18px+): 최소 3:1

### 키보드 네비게이션
- Tab으로 포커스 가능한 모든 요소에 도달 가능
- focus-visible 상태 명확히 표시

### ARIA 속성
- 모든 버튼에 aria-label 지정
- form 필드에 label 태그 또는 aria-label 지정
- 아이콘 버튼은 aria-label 필수

### prefers-reduced-motion
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

**Last Updated**: 2026-08-29  
**Status**: 올케어안전플랫폼 공식 디자인 문서 (원본 프리뷰 아티팩트 기준, oklch 네이비+앰버 시스템)
