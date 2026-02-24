import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

type ConfirmVariant = 'danger' | 'primary';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {options && (
        <ConfirmModal options={options} onClose={handleClose} />
      )}
    </ConfirmContext.Provider>
  );
}

function ConfirmModal({
  options,
  onClose,
}: {
  options: ConfirmOptions;
  onClose: (result: boolean) => void;
}) {
  const { title, message, confirmText = '확인', cancelText = '취소', variant = 'primary' } = options;
  const isDanger = variant === 'danger';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center animate-confirm-backdrop"
      onClick={() => onClose(false)}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* modal */}
      <div
        className="relative w-full sm:max-w-sm mx-auto bg-gray-800 border border-gray-700 rounded-t-2xl sm:rounded-2xl p-5 animate-confirm-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* icon + title */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-full ${isDanger ? 'bg-red-900/50' : 'bg-blue-900/50'}`}>
            {isDanger
              ? <AlertTriangle className="w-5 h-5 text-red-400" />
              : <HelpCircle className="w-5 h-5 text-blue-400" />
            }
          </div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>

        {/* message */}
        <p className="text-sm text-gray-300 mb-5 whitespace-pre-line pl-[44px]">{message}</p>

        {/* buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => onClose(false)}
            className="flex-1 px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium transition"
          >
            {cancelText}
          </button>
          <button
            onClick={() => onClose(true)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-medium transition ${
              isDanger
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return context;
}
