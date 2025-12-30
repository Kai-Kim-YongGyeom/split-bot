import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { getBotConfig, updateBotConfig } from '../lib/api';
import type { KisAccountInfo } from '../types';

interface BotStatusContextType {
  botRunning: boolean | null;
  serverAlive: boolean | null;
  toggling: boolean;
  availableCash: number | null;       // 주문가능현금
  availableAmount: number | null;     // 매수가능금액
  d2Deposit: number | null;           // D+2 예수금
  // KIS 계좌 정보 (대시보드 비교용)
  kisAccountInfo: KisAccountInfo | null;
  toggleBot: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const BotStatusContext = createContext<BotStatusContextType | null>(null);

export function BotStatusProvider({ children }: { children: ReactNode }) {
  const [botRunning, setBotRunning] = useState<boolean | null>(null);
  const [serverAlive, setServerAlive] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);
  const [availableCash, setAvailableCash] = useState<number | null>(null);
  const [availableAmount, setAvailableAmount] = useState<number | null>(null);
  const [d2Deposit, setD2Deposit] = useState<number | null>(null);
  const [kisAccountInfo, setKisAccountInfo] = useState<KisAccountInfo | null>(null);

  const checkStatus = useCallback(async () => {
    const config = await getBotConfig();
    if (config) {
      setBotRunning(config.is_running);

      // 예수금 정보 업데이트
      setAvailableCash(config.available_cash ?? null);
      setAvailableAmount(config.available_amount ?? null);
      setD2Deposit(config.d2_deposit ?? null);

      // KIS 계좌 정보 업데이트
      setKisAccountInfo({
        availableCash: config.available_cash ?? 0,
        availableAmount: config.available_amount ?? 0,
        d2Deposit: config.d2_deposit ?? 0,
        totalBuyAmt: config.kis_total_buy_amt ?? 0,
        totalEvalAmt: config.kis_total_eval_amt ?? 0,
        totalEvalProfit: config.kis_total_eval_profit ?? 0,
        totalEvalProfitRate: config.kis_total_eval_profit_rate ?? 0,
        totalRealizedProfit: config.kis_total_realized_profit ?? 0,
        updatedAt: config.balance_updated_at,
      });

      // 하트비트 체크 (45초 이내면 서버 살아있음 - 봇은 30초마다 전송)
      const heartbeat = config.last_heartbeat;
      if (heartbeat) {
        const lastTime = new Date(heartbeat).getTime();
        const now = Date.now();
        const diffSec = (now - lastTime) / 1000;
        setServerAlive(diffSec < 45);
      } else {
        setServerAlive(false);
      }
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 15000);  // 15초마다 체크
    return () => clearInterval(interval);
  }, [checkStatus]);

  const toggleBot = async () => {
    if (toggling) return;
    setToggling(true);

    const newStatus = !botRunning;
    const success = await updateBotConfig({
      is_running: newStatus,
      ...(newStatus && { last_started_at: new Date().toISOString() }),
    });

    if (success) {
      setBotRunning(newStatus);
    }
    setToggling(false);
  };

  const refreshStatus = async () => {
    await checkStatus();
  };

  return (
    <BotStatusContext.Provider value={{
      botRunning,
      serverAlive,
      toggling,
      availableCash,
      availableAmount,
      d2Deposit,
      kisAccountInfo,
      toggleBot,
      refreshStatus
    }}>
      {children}
    </BotStatusContext.Provider>
  );
}

export function useBotStatus() {
  const context = useContext(BotStatusContext);
  if (!context) {
    throw new Error('useBotStatus must be used within BotStatusProvider');
  }
  return context;
}
