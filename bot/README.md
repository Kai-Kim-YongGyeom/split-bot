# Split Bot 운영 가이드

## 서비스 관리 명령어

```bash
# 시작
sudo systemctl start split-bot

# 중지
sudo systemctl stop split-bot

# 재시작
sudo systemctl restart split-bot

# 상태 확인
sudo systemctl status split-bot

# 부팅 시 자동 시작 활성화
sudo systemctl enable split-bot

# 부팅 시 자동 시작 비활성화
sudo systemctl disable split-bot
```

## 로그 확인

```bash
# 실시간 로그 (Ctrl+C로 종료)
sudo journalctl -u split-bot -f

# 최근 100줄
sudo journalctl -u split-bot -n 100

# 오늘 로그만
sudo journalctl -u split-bot --since today

# 에러만 보기
sudo journalctl -u split-bot -p err
```

## 수동 실행 (디버깅용)

```bash
cd ~/repo/bot
source venv/bin/activate
python main.py
```

## 코드 업데이트

```bash
cd ~/repo
git pull
sudo systemctl restart split-bot
```

## 서비스 파일 수정 후

```bash
sudo cp bot/split-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart split-bot
```

## 환경 변수 (.env)

```bash
# ~/repo/bot/.env 파일
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your-anon-key
```

## 주요 파일 위치

- 봇 코드: `~/repo/bot/`
- 서비스 파일: `/etc/systemd/system/split-bot.service`
- 환경 변수: `~/repo/bot/.env`
- 가상환경: `~/repo/bot/venv/`
