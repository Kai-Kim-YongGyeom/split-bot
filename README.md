# Split Bot Web - 물타기 봇 관리 웹

Split Bot의 종목/매수기록을 관리하는 웹 프론트엔드입니다.

## 기능

- 대시보드: 전체 종목 현황, 보유 차수, 투자금액 확인
- 종목 관리: 종목 추가/수정/삭제, 물타기/목표 비율 설정
- 1차 매수 기록: 수동 1차 매수 기록 추가
- 설정: .env 설정 가이드

## 설치 및 실행

### 1. 의존성 설치

```bash
cd split-bot-web
npm install
```

### 2. 환경 설정

```bash
cp .env.example .env
```

`.env` 파일 수정:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Supabase 테이블 생성

Supabase 대시보드 → SQL Editor에서 `supabase-schema.sql` 실행

### 4. 개발 서버 실행

```bash
npm run dev
```

http://localhost:5173 에서 확인

### 5. 빌드 (배포용)

```bash
npm run build
```

`dist/` 폴더 생성 → Vercel, Netlify 등에 배포 가능

## 사용 흐름

```
1. 웹에서 종목 추가 (코드, 이름, 물타기/목표 비율 설정)
2. 웹에서 1차 매수 기록 추가 (매수가, 수량, 날짜)
3. split-bot 실행 → DB에서 종목 로드
4. 봇이 실시간 시세 모니터링
5. 조건 도달 시 자동 매수/매도 → DB 업데이트
6. 웹에서 실시간 확인 가능
```

## 기술 스택

- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router
- Supabase (PostgreSQL)

## 파일 구조

```
split-bot-web/
├── src/
│   ├── components/     # 공통 컴포넌트
│   │   └── Layout.tsx
│   ├── pages/          # 페이지 컴포넌트
│   │   ├── Dashboard.tsx
│   │   ├── Stocks.tsx
│   │   └── Settings.tsx
│   ├── hooks/          # React 훅
│   │   └── useStocks.ts
│   ├── lib/            # 유틸리티
│   │   ├── supabase.ts
│   │   └── api.ts
│   ├── types/          # TypeScript 타입
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── supabase-schema.sql # DB 스키마
├── .env.example
└── README.md
```

## 라이선스

MIT License
