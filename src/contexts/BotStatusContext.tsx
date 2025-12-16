import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { getBotConfig, updateBotConfig } from '../lib/api';

interface BotStatusContextType {
  botRunning: boolean | null;
  serverAlive: boolean | null;
  toggling: boolean;
  toggleBot: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const BotStatusContext = createContext<BotStatusContextType | null>(null);

export function BotStatusProvider({ children }: { children: ReactNode }) {
  const [botRunning, setBotRunning] = useState<boolean | null>(null);
  const [serverAlive, setServerAlive] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  const checkStatus = useCallback(async () => {
    const config = await getBotConfig();
    if (config) {
      setBotRunning(config.is_running);

      // 하트비트 체크 (60초 이내면 서버 살아있음)
      const heartbeat = config.last_heartbeat;
      if (heartbeat) {
        const lastTime = new Date(heartbeat).getTime();
        const now = Date.now();
        const diffSec = (now - lastTime) / 1000;
        setServerAlive(diffSec < 60);
      } else {
        setServerAlive(false);
      }
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
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
    <BotStatusContext.Provider value={{ botRunning, serverAlive, toggling, toggleBot, refreshStatus }}>
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
