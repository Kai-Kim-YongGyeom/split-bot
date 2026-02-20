import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Plus, ChevronDown, ChevronUp, Info } from 'lucide-react';
import * as api from '../lib/api';
import { formatDateTime } from '../lib/dateUtils';
import type { StockAnalysisRequest, StockAnalysisResult, AnalysisRequestForm, AlgoAnalysisRequest, AlgoAnalysisResult, AlgoAnalysisRequestForm } from '../types';
import { useToast } from '../components/Toast';

// 숫자 입력 시 포커스되면 전체 선택
const handleNumberFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.select();
};

// 추천 등급 배지
function RecommendationBadge({ recommendation }: { recommendation: string }) {
  const styles = {
    strong: 'bg-green-900/50 text-green-400 border-green-700',
    good: 'bg-blue-900/50 text-blue-400 border-blue-700',
    neutral: 'bg-gray-700/50 text-gray-400 border-gray-600',
    weak: 'bg-red-900/50 text-red-400 border-red-700',
  };
  const labels = {
    strong: '강력 추천',
    good: '추천',
    neutral: '보통',
    weak: '비추천',
  };
  const style = styles[recommendation as keyof typeof styles] || styles.neutral;
  const label = labels[recommendation as keyof typeof labels] || recommendation;

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${style}`}>
      {label}
    </span>
  );
}

// 점수 상세 컴포넌트
function ScoreBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  return (
    <div className="pt-3 border-t border-gray-700">
      <p className="text-gray-400 text-xs mb-2">점수 상세</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="text-center">
          <p className="text-gray-500">변동성</p>
          <p className="font-bold">{breakdown.volatility ?? 0}/25</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500">회복력</p>
          <p className="font-bold">{breakdown.recovery ?? 0}/30</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500">추세</p>
          <p className="font-bold">{breakdown.trend ?? 0}/25</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500">유동성</p>
          <p className="font-bold">{breakdown.liquidity ?? 0}/20</p>
        </div>
      </div>
    </div>
  );
}

// 점수 막대 그래프
function ScoreBar({ score, maxScore = 100, color = 'blue' }: { score: number; maxScore?: number; color?: string }) {
  const percent = Math.min(100, (score / maxScore) * 100);
  const colorClass = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  }[color] || 'bg-blue-500';

  return (
    <div className="w-full bg-gray-700 rounded-full h-2">
      <div
        className={`h-2 rounded-full ${colorClass}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// 분석 결과 카드
function AnalysisResultCard({
  result,
  onAddStock,
  adding,
  isRegistered,
}: {
  result: StockAnalysisResult;
  onAddStock: (result: StockAnalysisResult) => void;
  adding: boolean;
  isRegistered: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="p-3 md:p-4">
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-left flex-1"
          >
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">{result.stock_name}</h3>
                {isRegistered && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/50 text-green-400 border border-green-700">
                    등록됨
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-gray-400 text-xs">{result.stock_code}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  result.market === 'kospi' ? 'bg-blue-900/50 text-blue-400' : 'bg-purple-900/50 text-purple-400'
                }`}>
                  {result.market?.toUpperCase()}
                </span>
                <span className="text-white font-medium text-sm">
                  {result.current_price.toLocaleString()}원
                </span>
              </div>
            </div>
          </button>
          <div className="flex flex-col items-end gap-1">
            <RecommendationBadge recommendation={result.recommendation} />
            <span className="text-lg font-bold text-white">{result.suitability_score.toFixed(0)}점</span>
          </div>
        </div>

        {/* 주요 지표 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
          <div className="bg-gray-700/30 rounded p-2 text-center">
            <p className="text-gray-400">변동성</p>
            <p className="font-bold">{result.volatility_score.toFixed(1)}%</p>
          </div>
          <div className="bg-gray-700/30 rounded p-2 text-center">
            <p className="text-gray-400">회복횟수</p>
            <p className="font-bold">{result.recovery_count}회</p>
          </div>
          <div className="bg-gray-700/30 rounded p-2 text-center">
            <p className="text-gray-400">3개월</p>
            <p className={`font-bold ${result.trend_3m >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
              {result.trend_3m >= 0 ? '+' : ''}{result.trend_3m.toFixed(1)}%
            </p>
          </div>
          <div className="bg-gray-700/30 rounded p-2 text-center">
            <p className="text-gray-400">거래대금</p>
            <p className="font-bold">{(result.avg_trading_value / 100000000).toFixed(0)}억</p>
          </div>
        </div>

        {/* 점수 바 */}
        <div className="mb-3">
          <ScoreBar
            score={result.suitability_score}
            color={result.suitability_score >= 75 ? 'green' : result.suitability_score >= 55 ? 'blue' : result.suitability_score >= 35 ? 'yellow' : 'red'}
          />
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-end">
          {isRegistered ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 rounded-lg text-sm text-gray-400 cursor-not-allowed">
              이미 등록됨
            </span>
          ) : (
            <button
              onClick={() => onAddStock(result)}
              disabled={adding}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 rounded-lg hover:bg-blue-500 transition text-sm disabled:opacity-50"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              종목 추가
            </button>
          )}
        </div>
      </div>

      {/* 상세 정보 */}
      {expanded && (
        <div className="border-t border-gray-700 p-3 md:p-4 bg-gray-800/50 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-400 text-xs mb-1">시가총액</p>
              <p className="font-bold">{result.market_cap.toLocaleString()}억원</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">현재가</p>
              <p className="font-bold">{result.current_price.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">평균 회복기간</p>
              <p className="font-bold">{result.avg_recovery_days.toFixed(1)}일</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">회복 성공률</p>
              <p className="font-bold">{result.recovery_success_rate.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">6개월 수익률</p>
              <p className={`font-bold ${result.trend_6m >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                {result.trend_6m >= 0 ? '+' : ''}{result.trend_6m.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">1년 수익률</p>
              <p className={`font-bold ${result.trend_1y >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                {result.trend_1y >= 0 ? '+' : ''}{result.trend_1y.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* 점수 상세 */}
          {result.analysis_detail && 'score_breakdown' in result.analysis_detail && result.analysis_detail.score_breakdown ? (
            <ScoreBreakdown
              breakdown={result.analysis_detail.score_breakdown as Record<string, number>}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

// 상수 정의
const ANALYSIS_POLL_INTERVAL_MS = 3000;
const ANALYSIS_TIMEOUT_MS = 300000; // 5분

function SplitRecommendContent() {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<AnalysisRequestForm>({
    market: 'kospi200',
    min_market_cap: 5000,
    min_volume: 50,
    stock_type: 'common',
    analysis_period: 365,
    min_price: 0,
    max_price: 0,
  });

  const [status, setStatus] = useState<'idle' | 'requesting' | 'processing' | 'completed' | 'failed'>('idle');
  const [currentRequest, setCurrentRequest] = useState<StockAnalysisRequest | null>(null);
  const [results, setResults] = useState<StockAnalysisResult[]>([]);
  const [message, setMessage] = useState('');
  const [addingStock, setAddingStock] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'volatility' | 'recovery' | 'trend'>('score');
  const [registeredCodes, setRegisteredCodes] = useState<Set<string>>(new Set());

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<string>('idle');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // 등록된 종목 목록 로드
  const loadRegisteredStocks = async () => {
    const stocks = await api.getStocks();
    setRegisteredCodes(new Set(stocks.map(s => s.code)));
  };

  useEffect(() => {
    // 페이지 로드 시 최근 분석 결과와 등록된 종목 로드
    loadLatestAnalysis();
    loadRegisteredStocks();
    return () => cleanup();
  }, []);

  const cleanup = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const loadLatestAnalysis = async () => {
    const request = await api.getLatestAnalysisRequest();
    if (request) {
      setCurrentRequest(request);
      if (request.status === 'completed') {
        setStatus('completed');
        const analysisResults = await api.getAnalysisResults(request.id);
        setResults(analysisResults);
      } else if (request.status === 'processing' || request.status === 'pending') {
        setStatus('processing');
        setMessage('이전 분석이 진행중입니다...');
        startPolling(request.id);
      } else if (request.status === 'failed') {
        setStatus('failed');
        setMessage(request.result_message || '분석 실패');
      }
    }
  };

  const startPolling = (requestId: string) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const request = await api.getAnalysisRequest(requestId);
        if (request) {
          setCurrentRequest(request);
          if (request.status === 'completed') {
            cleanup();
            setStatus('completed');
            setMessage(`${request.total_analyzed}개 종목 분석 완료`);
            const analysisResults = await api.getAnalysisResults(request.id);
            setResults(analysisResults);
          } else if (request.status === 'failed') {
            cleanup();
            setStatus('failed');
            setMessage(request.result_message || '분석 실패');
          }
        }
      } catch (err) {
        console.error('Analysis polling error:', err);
      }
    }, ANALYSIS_POLL_INTERVAL_MS);

    timeoutRef.current = setTimeout(() => {
      cleanup();
      if (statusRef.current === 'processing') {
        setStatus('failed');
        setMessage('타임아웃 - 분석이 너무 오래 걸립니다.');
      }
    }, ANALYSIS_TIMEOUT_MS);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    cleanup();

    setStatus('requesting');
    setResults([]);
    setMessage('');

    const request = await api.createAnalysisRequest(formData);
    if (!request) {
      setStatus('failed');
      setMessage('분석 요청 생성 실패');
      return;
    }

    setCurrentRequest(request);
    setStatus('processing');
    setMessage('봇에서 종목을 분석하고 있습니다...');
    startPolling(request.id);
  };

  const handleAddStock = async (result: StockAnalysisResult) => {
    setAddingStock(result.stock_code);
    try {
      const stock = await api.createStock({
        code: result.stock_code,
        name: result.stock_name,
        buy_amount: 100000,
        buy_mode: 'amount',
        buy_quantity: 1,
        max_rounds: 10,
        split_rates: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
        target_rates: [50, 3, 3, 3, 3, 3, 3, 3, 3, 3],
        stop_loss_rate: 0,
      });
      if (stock) {
        // 등록 성공 시 목록 갱신
        setRegisteredCodes(prev => new Set([...prev, result.stock_code]));
        showToast(`${result.stock_name} 종목이 추가되었습니다.`, 'success');
      } else {
        showToast('종목 추가에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
      }
    } catch (err) {
      console.error('Stock creation error:', err);
      showToast('종목 추가 중 오류가 발생했습니다.', 'error');
    }
    setAddingStock(null);
  };

  // 정렬된 결과
  const sortedResults = [...results].sort((a, b) => {
    switch (sortBy) {
      case 'volatility':
        return b.volatility_score - a.volatility_score;
      case 'recovery':
        return b.recovery_count - a.recovery_count;
      case 'trend':
        return b.trend_3m - a.trend_3m;
      default:
        return b.suitability_score - a.suitability_score;
    }
  });

  // 추천 등급별 개수
  const countByRecommendation = {
    strong: results.filter(r => r.recommendation === 'strong').length,
    good: results.filter(r => r.recommendation === 'good').length,
    neutral: results.filter(r => r.recommendation === 'neutral').length,
    weak: results.filter(r => r.recommendation === 'weak').length,
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 안내 */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-200">
            <p className="font-medium mb-1">물타기 적합 종목 분석</p>
            <p className="text-blue-300/80">
              시가총액 상위 종목의 1년간 일봉 데이터를 분석하여 물타기 전략에 적합한 종목을 추천합니다.
              변동성(2~5%가 이상적), 하락 후 회복력, 추세, 거래량을 종합 평가합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 분석 요청 폼 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h2 className="font-bold mb-4">분석 조건 설정</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">시장</label>
              <select
                value={formData.market}
                onChange={e => setFormData({ ...formData, market: e.target.value as AnalysisRequestForm['market'] })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                <option value="kospi200">KOSPI200</option>
                <option value="kospi">KOSPI</option>
                <option value="kosdaq">KOSDAQ</option>
                <option value="all">전체</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">최소 시가총액</label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.min_market_cap}
                  onChange={e => setFormData({ ...formData, min_market_cap: Number(e.target.value) })}
                  onFocus={handleNumberFocus}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 pr-8"
                  min="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">억</span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">최소 거래대금</label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.min_volume}
                  onChange={e => setFormData({ ...formData, min_volume: Number(e.target.value) })}
                  onFocus={handleNumberFocus}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 pr-8"
                  min="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">억</span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">종목 유형</label>
              <select
                value={formData.stock_type}
                onChange={e => setFormData({ ...formData, stock_type: e.target.value as AnalysisRequestForm['stock_type'] })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                <option value="common">보통주</option>
                <option value="preferred">우선주</option>
                <option value="all">전체</option>
              </select>
            </div>
          </div>

          {/* 현재가 필터 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">최소 현재가</label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.min_price || ''}
                  onChange={e => setFormData({ ...formData, min_price: Number(e.target.value) || 0 })}
                  onFocus={handleNumberFocus}
                  placeholder="0 (제한없음)"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 pr-8"
                  min="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">원</span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">최대 현재가</label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.max_price || ''}
                  onChange={e => setFormData({ ...formData, max_price: Number(e.target.value) || 0 })}
                  onFocus={handleNumberFocus}
                  placeholder="0 (제한없음)"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 pr-8"
                  min="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">원</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-500">
              분석 기간: {formData.analysis_period}일 (약 {Math.round(formData.analysis_period / 365 * 12)}개월)
            </p>
            <button
              type="submit"
              disabled={status === 'requesting' || status === 'processing'}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition disabled:opacity-50"
            >
              {(status === 'requesting' || status === 'processing') ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              분석 시작
            </button>
          </div>
        </form>
      </div>

      {/* 처리 상태 */}
      {(status === 'requesting' || status === 'processing') && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex flex-col items-center justify-center mb-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
            <p className="text-gray-400">{message}</p>
            {currentRequest && (
              <p className="text-xs text-gray-500 mt-2">
                진행중: {currentRequest.total_analyzed || 0}개 종목 분석됨
              </p>
            )}
          </div>
          <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 text-center">
            <p className="text-blue-300 text-sm">
              📱 분석이 완료되면 <b>텔레그램</b>으로 알림을 보내드립니다.
            </p>
            <p className="text-blue-400/70 text-xs mt-1">
              페이지를 닫아도 분석은 계속 진행됩니다.
            </p>
          </div>
        </div>
      )}

      {/* 실패 */}
      {status === 'failed' && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
          <p className="text-red-400">{message}</p>
          <button
            onClick={() => setStatus('idle')}
            className="mt-3 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 text-sm"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 결과 */}
      {status === 'completed' && results.length > 0 && (
        <div className="space-y-4">
          {/* 요약 */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold">분석 결과</h2>
                {currentRequest?.completed_at && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDateTime(currentRequest.completed_at)} 분석 완료
                  </p>
                )}
              </div>
              <span className="text-sm text-gray-400">{results.length}개 종목</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-sm">
              <div className="bg-green-900/20 border border-green-800 rounded p-2">
                <p className="text-green-400 font-bold text-lg">{countByRecommendation.strong}</p>
                <p className="text-green-400/70 text-xs">강력 추천</p>
              </div>
              <div className="bg-blue-900/20 border border-blue-800 rounded p-2">
                <p className="text-blue-400 font-bold text-lg">{countByRecommendation.good}</p>
                <p className="text-blue-400/70 text-xs">추천</p>
              </div>
              <div className="bg-gray-700/50 border border-gray-600 rounded p-2">
                <p className="text-gray-400 font-bold text-lg">{countByRecommendation.neutral}</p>
                <p className="text-gray-500 text-xs">보통</p>
              </div>
              <div className="bg-red-900/20 border border-red-800 rounded p-2">
                <p className="text-red-400 font-bold text-lg">{countByRecommendation.weak}</p>
                <p className="text-red-400/70 text-xs">비추천</p>
              </div>
            </div>
          </div>

          {/* 정렬 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">정렬:</span>
            <div className="flex gap-1">
              {[
                { key: 'score', label: '점수순' },
                { key: 'volatility', label: '변동성순' },
                { key: 'recovery', label: '회복력순' },
                { key: 'trend', label: '추세순' },
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => setSortBy(item.key as typeof sortBy)}
                  className={`px-3 py-1 rounded text-sm transition ${
                    sortBy === item.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 종목 리스트 */}
          <div className="space-y-3">
            {sortedResults.map(result => (
              <AnalysisResultCard
                key={result.id}
                result={result}
                onAddStock={handleAddStock}
                adding={addingStock === result.stock_code}
                isRegistered={registeredCodes.has(result.stock_code)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 결과 없음 */}
      {status === 'completed' && results.length === 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 text-center">
          <p className="text-gray-400">분석 결과가 없습니다.</p>
          <p className="text-xs text-gray-500 mt-1">필터 조건을 조정해 보세요.</p>
        </div>
      )}
    </div>
  );
}

// ==================== 알고리즘 점수 상세 ====================

function AlgoScoreBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  return (
    <div className="pt-3 border-t border-gray-700">
      <p className="text-gray-400 text-xs mb-2">점수 상세</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="text-center">
          <p className="text-gray-500">모멘텀</p>
          <p className="font-bold">{breakdown.momentum ?? 0}/30</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500">변동성(ATR)</p>
          <p className="font-bold">{breakdown.volatility ?? 0}/25</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500">거래량</p>
          <p className="font-bold">{breakdown.volume ?? 0}/20</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500">추세</p>
          <p className="font-bold">{breakdown.trend ?? 0}/25</p>
        </div>
      </div>
    </div>
  );
}

// ==================== 알고리즘 분석 결과 카드 ====================

function AlgoAnalysisResultCard({
  result,
  onAddStock,
  adding,
  isRegistered,
}: {
  result: AlgoAnalysisResult;
  onAddStock: (result: AlgoAnalysisResult) => void;
  adding: boolean;
  isRegistered: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="p-3 md:p-4">
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-left flex-1"
          >
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">{result.stock_name}</h3>
                {isRegistered && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/50 text-green-400 border border-green-700">
                    등록됨
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-gray-400 text-xs">{result.stock_code}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  result.market === 'kospi' ? 'bg-blue-900/50 text-blue-400' : 'bg-purple-900/50 text-purple-400'
                }`}>
                  {result.market?.toUpperCase()}
                </span>
                <span className="text-white font-medium text-sm">
                  {result.current_price.toLocaleString()}원
                </span>
              </div>
            </div>
          </button>
          <div className="flex flex-col items-end gap-1">
            <RecommendationBadge recommendation={result.recommendation} />
            <span className="text-lg font-bold text-white">{result.algo_suitability_score.toFixed(0)}점</span>
          </div>
        </div>

        {/* 주요 지표 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
          <div className="bg-gray-700/30 rounded p-2 text-center">
            <p className="text-gray-400">모멘텀</p>
            <p className="font-bold">{result.momentum_score.toFixed(1)}/30</p>
          </div>
          <div className="bg-gray-700/30 rounded p-2 text-center">
            <p className="text-gray-400">ATR적합도</p>
            <p className="font-bold">{result.atr_percent.toFixed(1)}%</p>
          </div>
          <div className="bg-gray-700/30 rounded p-2 text-center">
            <p className="text-gray-400">돌파횟수</p>
            <p className="font-bold">{result.breakout_frequency}회</p>
          </div>
          <div className="bg-gray-700/30 rounded p-2 text-center">
            <p className="text-gray-400">3개월</p>
            <p className={`font-bold ${result.return_3m >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
              {result.return_3m >= 0 ? '+' : ''}{result.return_3m.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* 점수 바 */}
        <div className="mb-3">
          <ScoreBar
            score={result.algo_suitability_score}
            color={result.algo_suitability_score >= 75 ? 'green' : result.algo_suitability_score >= 55 ? 'blue' : result.algo_suitability_score >= 35 ? 'yellow' : 'red'}
          />
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-end">
          {isRegistered ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 rounded-lg text-sm text-gray-400 cursor-not-allowed">
              이미 등록됨
            </span>
          ) : (
            <button
              onClick={() => onAddStock(result)}
              disabled={adding}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 rounded-lg hover:bg-blue-500 transition text-sm disabled:opacity-50"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              알고리즘 종목 추가
            </button>
          )}
        </div>
      </div>

      {/* 상세 정보 */}
      {expanded && (
        <div className="border-t border-gray-700 p-3 md:p-4 bg-gray-800/50 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-400 text-xs mb-1">시가총액</p>
              <p className="font-bold">{result.market_cap.toLocaleString()}억원</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">MA 대비 강도</p>
              <p className={`font-bold ${result.ma_trend_strength >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                {result.ma_trend_strength >= 0 ? '+' : ''}{result.ma_trend_strength.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">거래량 스파이크</p>
              <p className="font-bold">{result.volume_spike_count}일</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">추세 일관성</p>
              <p className="font-bold">{(result.trend_consistency * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">1개월 수익률</p>
              <p className={`font-bold ${result.return_1m >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                {result.return_1m >= 0 ? '+' : ''}{result.return_1m.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">6개월 수익률</p>
              <p className={`font-bold ${result.return_6m >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                {result.return_6m >= 0 ? '+' : ''}{result.return_6m.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">일평균 거래대금</p>
              <p className="font-bold">{(result.avg_trading_value / 100000000).toFixed(0)}억</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">ATR 비율</p>
              <p className="font-bold">{result.atr_percent.toFixed(2)}%</p>
            </div>
          </div>

          {/* 점수 상세 */}
          {result.analysis_detail && 'score_breakdown' in result.analysis_detail && result.analysis_detail.score_breakdown ? (
            <AlgoScoreBreakdown
              breakdown={result.analysis_detail.score_breakdown as Record<string, number>}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

// ==================== 알고리즘 추천 콘텐츠 ====================

function AlgoRecommendContent() {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<AlgoAnalysisRequestForm>({
    market: 'kospi200',
    min_market_cap: 5000,
    min_volume: 50,
    stock_type: 'common',
    analysis_period: 365,
    min_price: 0,
    max_price: 0,
  });

  const [status, setStatus] = useState<'idle' | 'requesting' | 'processing' | 'completed' | 'failed'>('idle');
  const [currentRequest, setCurrentRequest] = useState<AlgoAnalysisRequest | null>(null);
  const [results, setResults] = useState<AlgoAnalysisResult[]>([]);
  const [message, setMessage] = useState('');
  const [addingStock, setAddingStock] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'momentum' | 'volatility' | 'trend'>('score');
  const [registeredCodes, setRegisteredCodes] = useState<Set<string>>(new Set());

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<string>('idle');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const loadRegisteredAlgoStocks = async () => {
    const stocks = await api.getAlgoStocks();
    setRegisteredCodes(new Set(stocks.map(s => s.code)));
  };

  useEffect(() => {
    loadLatestAnalysis();
    loadRegisteredAlgoStocks();
    return () => cleanup();
  }, []);

  const cleanup = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const loadLatestAnalysis = async () => {
    const request = await api.getLatestAlgoAnalysisRequest();
    if (request) {
      setCurrentRequest(request);
      if (request.status === 'completed') {
        setStatus('completed');
        const analysisResults = await api.getAlgoAnalysisResults(request.id);
        setResults(analysisResults);
      } else if (request.status === 'processing' || request.status === 'pending') {
        setStatus('processing');
        setMessage('이전 분석이 진행중입니다...');
        startPolling(request.id);
      } else if (request.status === 'failed') {
        setStatus('failed');
        setMessage(request.result_message || '분석 실패');
      }
    }
  };

  const startPolling = (requestId: string) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const request = await api.getAlgoAnalysisRequest(requestId);
        if (request) {
          setCurrentRequest(request);
          if (request.status === 'completed') {
            cleanup();
            setStatus('completed');
            setMessage(`${request.total_analyzed}개 종목 분석 완료`);
            const analysisResults = await api.getAlgoAnalysisResults(request.id);
            setResults(analysisResults);
          } else if (request.status === 'failed') {
            cleanup();
            setStatus('failed');
            setMessage(request.result_message || '분석 실패');
          }
        }
      } catch (err) {
        console.error('Algo analysis polling error:', err);
      }
    }, ANALYSIS_POLL_INTERVAL_MS);

    timeoutRef.current = setTimeout(() => {
      cleanup();
      if (statusRef.current === 'processing') {
        setStatus('failed');
        setMessage('타임아웃 - 분석이 너무 오래 걸립니다.');
      }
    }, ANALYSIS_TIMEOUT_MS);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    cleanup();

    setStatus('requesting');
    setResults([]);
    setMessage('');

    const request = await api.createAlgoAnalysisRequest(formData);
    if (!request) {
      setStatus('failed');
      setMessage('분석 요청 생성 실패');
      return;
    }

    setCurrentRequest(request);
    setStatus('processing');
    setMessage('봇에서 종목을 분석하고 있습니다...');
    startPolling(request.id);
  };

  const handleAddAlgoStock = async (result: AlgoAnalysisResult) => {
    setAddingStock(result.stock_code);
    try {
      const stock = await api.createAlgoStock({
        code: result.stock_code,
        name: result.stock_name,
        buy_amount: 100000,
        max_positions: 1,
        ma_period: 20,
        breakout_period: 20,
        volume_ratio: 1.5,
        atr_period: 14,
        atr_multiplier: 2.0,
        stop_loss_atr_multiplier: 3.0,
      });
      if (stock) {
        setRegisteredCodes(prev => new Set([...prev, result.stock_code]));
        showToast(`${result.stock_name} 알고리즘 종목이 추가되었습니다.`, 'success');
      } else {
        showToast('종목 추가에 실패했습니다.', 'error');
      }
    } catch (err) {
      console.error('Algo stock creation error:', err);
      showToast('종목 추가 중 오류가 발생했습니다.', 'error');
    }
    setAddingStock(null);
  };

  const sortedResults = [...results].sort((a, b) => {
    switch (sortBy) {
      case 'momentum':
        return b.momentum_score - a.momentum_score;
      case 'volatility':
        return b.volatility_score - a.volatility_score;
      case 'trend':
        return b.return_3m - a.return_3m;
      default:
        return b.algo_suitability_score - a.algo_suitability_score;
    }
  });

  const countByRecommendation = {
    strong: results.filter(r => r.recommendation === 'strong').length,
    good: results.filter(r => r.recommendation === 'good').length,
    neutral: results.filter(r => r.recommendation === 'neutral').length,
    weak: results.filter(r => r.recommendation === 'weak').length,
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 안내 */}
      <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-200">
            <p className="font-medium mb-1">모멘텀 + ATR 트레일링스탑 적합 종목 분석</p>
            <p className="text-green-300/80">
              상승 모멘텀이 강하고 ATR 트레일링스탑 전략에 적합한 종목을 추천합니다.
              MA 추세 강도, N일 신고가 돌파 빈도, ATR 적합도, 거래량 패턴을 종합 평가합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 분석 요청 폼 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h2 className="font-bold mb-4">분석 조건 설정</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">시장</label>
              <select
                value={formData.market}
                onChange={e => setFormData({ ...formData, market: e.target.value as AlgoAnalysisRequestForm['market'] })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                <option value="kospi200">KOSPI200</option>
                <option value="kospi">KOSPI</option>
                <option value="kosdaq">KOSDAQ</option>
                <option value="all">전체</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">최소 시가총액</label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.min_market_cap}
                  onChange={e => setFormData({ ...formData, min_market_cap: Number(e.target.value) })}
                  onFocus={handleNumberFocus}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 pr-8"
                  min="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">억</span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">최소 거래대금</label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.min_volume}
                  onChange={e => setFormData({ ...formData, min_volume: Number(e.target.value) })}
                  onFocus={handleNumberFocus}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 pr-8"
                  min="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">억</span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">종목 유형</label>
              <select
                value={formData.stock_type}
                onChange={e => setFormData({ ...formData, stock_type: e.target.value as AlgoAnalysisRequestForm['stock_type'] })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                <option value="common">보통주</option>
                <option value="preferred">우선주</option>
                <option value="all">전체</option>
              </select>
            </div>
          </div>

          {/* 현재가 필터 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">최소 현재가</label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.min_price || ''}
                  onChange={e => setFormData({ ...formData, min_price: Number(e.target.value) || 0 })}
                  onFocus={handleNumberFocus}
                  placeholder="0 (제한없음)"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 pr-8"
                  min="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">원</span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">최대 현재가</label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.max_price || ''}
                  onChange={e => setFormData({ ...formData, max_price: Number(e.target.value) || 0 })}
                  onFocus={handleNumberFocus}
                  placeholder="0 (제한없음)"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 pr-8"
                  min="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">원</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-500">
              분석 기간: {formData.analysis_period}일 (약 {Math.round(formData.analysis_period / 365 * 12)}개월)
            </p>
            <button
              type="submit"
              disabled={status === 'requesting' || status === 'processing'}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 transition disabled:opacity-50"
            >
              {(status === 'requesting' || status === 'processing') ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              분석 시작
            </button>
          </div>
        </form>
      </div>

      {/* 처리 상태 */}
      {(status === 'requesting' || status === 'processing') && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex flex-col items-center justify-center mb-4">
            <Loader2 className="w-8 h-8 animate-spin text-green-500 mb-4" />
            <p className="text-gray-400">{message}</p>
            {currentRequest && (
              <p className="text-xs text-gray-500 mt-2">
                진행중: {currentRequest.total_analyzed || 0}개 종목 분석됨
              </p>
            )}
          </div>
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 text-center">
            <p className="text-green-300 text-sm">
              📱 분석이 완료되면 <b>텔레그램</b>으로 알림을 보내드립니다.
            </p>
            <p className="text-green-400/70 text-xs mt-1">
              페이지를 닫아도 분석은 계속 진행됩니다.
            </p>
          </div>
        </div>
      )}

      {/* 실패 */}
      {status === 'failed' && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
          <p className="text-red-400">{message}</p>
          <button
            onClick={() => setStatus('idle')}
            className="mt-3 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 text-sm"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 결과 */}
      {status === 'completed' && results.length > 0 && (
        <div className="space-y-4">
          {/* 요약 */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold">분석 결과</h2>
                {currentRequest?.completed_at && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDateTime(currentRequest.completed_at)} 분석 완료
                  </p>
                )}
              </div>
              <span className="text-sm text-gray-400">{results.length}개 종목</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-sm">
              <div className="bg-green-900/20 border border-green-800 rounded p-2">
                <p className="text-green-400 font-bold text-lg">{countByRecommendation.strong}</p>
                <p className="text-green-400/70 text-xs">강력 추천</p>
              </div>
              <div className="bg-blue-900/20 border border-blue-800 rounded p-2">
                <p className="text-blue-400 font-bold text-lg">{countByRecommendation.good}</p>
                <p className="text-blue-400/70 text-xs">추천</p>
              </div>
              <div className="bg-gray-700/50 border border-gray-600 rounded p-2">
                <p className="text-gray-400 font-bold text-lg">{countByRecommendation.neutral}</p>
                <p className="text-gray-500 text-xs">보통</p>
              </div>
              <div className="bg-red-900/20 border border-red-800 rounded p-2">
                <p className="text-red-400 font-bold text-lg">{countByRecommendation.weak}</p>
                <p className="text-red-400/70 text-xs">비추천</p>
              </div>
            </div>
          </div>

          {/* 정렬 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">정렬:</span>
            <div className="flex gap-1">
              {[
                { key: 'score', label: '적합도순' },
                { key: 'momentum', label: '모멘텀순' },
                { key: 'volatility', label: 'ATR순' },
                { key: 'trend', label: '추세순' },
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => setSortBy(item.key as typeof sortBy)}
                  className={`px-3 py-1 rounded text-sm transition ${
                    sortBy === item.key
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 종목 리스트 */}
          <div className="space-y-3">
            {sortedResults.map(result => (
              <AlgoAnalysisResultCard
                key={result.id}
                result={result}
                onAddStock={handleAddAlgoStock}
                adding={addingStock === result.stock_code}
                isRegistered={registeredCodes.has(result.stock_code)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 결과 없음 */}
      {status === 'completed' && results.length === 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 text-center">
          <p className="text-gray-400">분석 결과가 없습니다.</p>
          <p className="text-xs text-gray-500 mt-1">필터 조건을 조정해 보세요.</p>
        </div>
      )}
    </div>
  );
}

// ==================== 종목 추천 탭 래퍼 ====================

type RecommendTabType = 'split' | 'algo';

export function StockRecommend() {
  const [activeTab, setActiveTab] = useState<RecommendTabType>('split');

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold">종목 추천</h1>
      </div>

      {/* 전략 선택 탭 */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('split')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'split'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          세븐스플릿
        </button>
        <button
          onClick={() => setActiveTab('algo')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'algo'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          알고리즘
        </button>
      </div>

      {activeTab === 'split' ? <SplitRecommendContent /> : <AlgoRecommendContent />}
    </div>
  );
}
