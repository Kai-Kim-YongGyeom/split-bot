import { useState, useEffect, useMemo } from 'react';
import { Calendar, TrendingUp, TrendingDown, DollarSign, BarChart3, Search } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
  Treemap,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { getCurrentUserId, getDailySnapshots } from '../lib/api';
import type { DailySnapshot } from '../lib/api';
import { formatDate, getTodayKST, getDateDaysAgoKST } from '../lib/dateUtils';
import type { Purchase } from '../types';

interface KPIData {
  totalBuyAmount: number;
  totalBuyCount: number;
  totalSellAmount: number;
  totalSellCount: number;
  realizedProfit: number;
  profitRate: number;
}

interface DailySummary {
  date: string;
  buyAmount: number;
  sellAmount: number;
  profit: number;
  profitRate: number;
  buyCount: number;
  sellCount: number;
  totalAssets: number;  // 해당일 총자산
  realizedReturnRate: number;  // 실현수익률 (실현손익/총자산)
  cumulativeProfit: number;  // 누적 실현손익
  cumulativeReturnRate: number;  // 누적 실현수익률
}

interface MonthlySummary {
  month: string;
  buyAmount: number;
  sellAmount: number;
  profit: number;
  profitRate: number;
  buyCount: number;
  sellCount: number;
  totalAssets: number;
  realizedReturnRate: number;
  cumulativeProfit: number;
  cumulativeReturnRate: number;
}

type TabType = 'current' | 'daily' | 'monthly' | 'cumulative';
type TradeFilter = 'all' | 'buy' | 'sell';

// 파이차트/트리맵 색상
const CHART_COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7', '#22C55E', '#0EA5E9', '#FBBF24',
];

function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: {
  startDate: string;
  endDate: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
}) {
  const presets = [
    { label: '오늘', days: 0 },
    { label: '7일', days: 7 },
    { label: '30일', days: 30 },
    { label: '90일', days: 90 },
    { label: '전체', days: -1 },
  ];

  const handlePreset = (days: number) => {
    onEndChange(getTodayKST());

    if (days === -1) {
      onStartChange('2020-01-01');
    } else {
      onStartChange(getDateDaysAgoKST(days));
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
          <span className="text-gray-400 text-sm">기간</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={e => onStartChange(e.target.value)}
            className="flex-1 md:flex-none bg-gray-700 border border-gray-600 rounded px-2 py-2 text-sm"
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            value={endDate}
            onChange={e => onEndChange(e.target.value)}
            className="flex-1 md:flex-none bg-gray-700 border border-gray-600 rounded px-2 py-2 text-sm"
          />
        </div>
        <div className="flex gap-1 md:gap-2">
          {presets.map(preset => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset.days)}
              className="flex-1 md:flex-none px-2 md:px-2.5 py-1.5 text-xs md:text-sm bg-gray-700 hover:bg-gray-600 rounded transition"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
        active
          ? 'bg-gray-800 text-white border-t border-l border-r border-gray-700'
          : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800/50'
      }`}
    >
      {children}
    </button>
  );
}

function KPICard({
  title,
  value,
  subValue,
  icon: Icon,
  colorClass,
}: {
  title: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
  colorClass: string;
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
      <div className="flex items-center gap-2 md:gap-3">
        <div className={`p-2 md:p-3 rounded-lg ${colorClass}`}>
          <Icon className="w-5 h-5 md:w-6 md:h-6" />
        </div>
        <div className="min-w-0">
          <p className="text-gray-400 text-xs md:text-sm">{title}</p>
          <p className="text-lg md:text-2xl font-bold truncate">{value}</p>
          {subValue && <p className="text-gray-500 text-xs md:text-sm">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}

function formatAmount(value: number): string {
  if (Math.abs(value) >= 100000000) {
    return `${(value / 100000000).toFixed(1)}억`;
  } else if (Math.abs(value) >= 10000) {
    return `${(value / 10000).toFixed(0)}만`;
  }
  return value.toLocaleString();
}

function DailyChart({ data }: { data: DailySummary[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        해당 기간에 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 매수/매도 금액 차트 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-4">일자별 매수/매도 금액</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={(value) => value.slice(5)}
              />
              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={formatAmount}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                formatter={(value) => [`${Number(value).toLocaleString()}원`, '']}
                labelFormatter={(label) => `${label}`}
              />
              <Legend />
              <Bar dataKey="buyAmount" name="매수금액" fill="#3B82F6" />
              <Bar dataKey="sellAmount" name="매도금액" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 실현손익 추이 차트 (일별 + 누적) */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-4">일자별 실현손익 추이</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={(value) => value.slice(5)}
              />
              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={formatAmount}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                formatter={(value, name) => {
                  const num = Number(value);
                  const label = name === 'cumulativeProfit' ? '누적 손익' : '일별 손익';
                  return [`${num >= 0 ? '+' : ''}${num.toLocaleString()}원`, label];
                }}
                labelFormatter={(label) => `${label}`}
              />
              <Legend formatter={(value) => value === 'cumulativeProfit' ? '누적 손익' : '일별 손익'} />
              <Line
                type="monotone"
                dataKey="cumulativeProfit"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ fill: '#10B981', strokeWidth: 2, r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ fill: '#F59E0B', strokeWidth: 2, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 실현수익률 추이 차트 (별도 카드) */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-4">일자별 실현수익률 추이 (총자산 대비)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={(value) => value.slice(5)}
              />
              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={(value) => `${value.toFixed(2)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                formatter={(value, name) => {
                  const num = Number(value);
                  const label = name === 'cumulativeReturnRate' ? '누적 수익률' : '일별 수익률';
                  return [`${num >= 0 ? '+' : ''}${num.toFixed(3)}%`, label];
                }}
                labelFormatter={(label) => `${label}`}
              />
              <Legend formatter={(value) => value === 'cumulativeReturnRate' ? '누적 수익률' : '일별 수익률'} />
              <Line
                type="monotone"
                dataKey="cumulativeReturnRate"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="realizedReturnRate"
                stroke="#EC4899"
                strokeWidth={2}
                dot={{ fill: '#EC4899', strokeWidth: 2, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 일자별 테이블 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-4">일자별 상세</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 px-3">날짜</th>
                <th className="text-right py-2 px-3">매수금액</th>
                <th className="text-right py-2 px-3">매도금액</th>
                <th className="text-right py-2 px-3">실현손익</th>
                <th className="text-right py-2 px-3">누적손익</th>
                <th className="text-right py-2 px-3">수익률</th>
                <th className="text-right py-2 px-3">누적수익률</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.date} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 px-3">{row.date}</td>
                  <td className="py-2 px-3 text-right text-blue-400">
                    {row.buyAmount > 0 ? `${row.buyAmount.toLocaleString()}원` : '-'}
                    {row.buyCount > 0 && <span className="text-gray-500 text-xs ml-1">({row.buyCount}건)</span>}
                  </td>
                  <td className="py-2 px-3 text-right text-purple-400">
                    {row.sellAmount > 0 ? `${row.sellAmount.toLocaleString()}원` : '-'}
                    {row.sellCount > 0 && <span className="text-gray-500 text-xs ml-1">({row.sellCount}건)</span>}
                  </td>
                  <td className={`py-2 px-3 text-right font-bold ${
                    row.profit === 0 ? 'text-gray-500' : row.profit > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {row.profit !== 0 ? `${row.profit >= 0 ? '+' : ''}${row.profit.toLocaleString()}원` : '-'}
                  </td>
                  <td className={`py-2 px-3 text-right ${
                    row.cumulativeProfit === 0 ? 'text-gray-500' : row.cumulativeProfit > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {row.cumulativeProfit !== 0 ? `${row.cumulativeProfit >= 0 ? '+' : ''}${row.cumulativeProfit.toLocaleString()}원` : '-'}
                  </td>
                  <td className={`py-2 px-3 text-right ${
                    row.realizedReturnRate === 0 ? 'text-gray-500' : row.realizedReturnRate > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {row.realizedReturnRate !== 0 ? `${row.realizedReturnRate >= 0 ? '+' : ''}${row.realizedReturnRate.toFixed(3)}%` : '-'}
                  </td>
                  <td className={`py-2 px-3 text-right ${
                    row.cumulativeReturnRate === 0 ? 'text-gray-500' : row.cumulativeReturnRate > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {row.cumulativeReturnRate !== 0 ? `${row.cumulativeReturnRate >= 0 ? '+' : ''}${row.cumulativeReturnRate.toFixed(3)}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MonthlyChart({ data }: { data: MonthlySummary[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        해당 기간에 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 월별 매수/매도 금액 차트 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-4">월별 매수/매도 금액</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={formatAmount} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                formatter={(value) => [`${Number(value).toLocaleString()}원`, '']}
              />
              <Legend />
              <Bar dataKey="buyAmount" name="매수금액" fill="#3B82F6" />
              <Bar dataKey="sellAmount" name="매도금액" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 월별 누적 수익 추이 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-4">월별 실현손익 추이</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={formatAmount} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                formatter={(value, name) => {
                  const num = Number(value);
                  const label = name === 'cumulativeProfit' ? '누적 손익' : '월간 손익';
                  return [`${num >= 0 ? '+' : ''}${num.toLocaleString()}원`, label];
                }}
              />
              <Legend formatter={(value) => value === 'cumulativeProfit' ? '누적 손익' : '월간 손익'} />
              <Line
                type="monotone"
                dataKey="cumulativeProfit"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ fill: '#10B981', strokeWidth: 2, r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ fill: '#F59E0B', strokeWidth: 2, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 월별 실현수익률 추이 차트 (별도 카드) */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-4">월별 실현수익률 추이 (총자산 대비)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={(value) => `${value.toFixed(2)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                formatter={(value, name) => {
                  const num = Number(value);
                  const label = name === 'cumulativeReturnRate' ? '누적 수익률' : '월별 수익률';
                  return [`${num >= 0 ? '+' : ''}${num.toFixed(3)}%`, label];
                }}
              />
              <Legend formatter={(value) => value === 'cumulativeReturnRate' ? '누적 수익률' : '월별 수익률'} />
              <Line
                type="monotone"
                dataKey="cumulativeReturnRate"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="realizedReturnRate"
                stroke="#EC4899"
                strokeWidth={2}
                dot={{ fill: '#EC4899', strokeWidth: 2, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 월별 테이블 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-4">월별 상세</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 px-3">월</th>
                <th className="text-right py-2 px-3">매수금액</th>
                <th className="text-right py-2 px-3">매도금액</th>
                <th className="text-right py-2 px-3">실현손익</th>
                <th className="text-right py-2 px-3">누적손익</th>
                <th className="text-right py-2 px-3">수익률</th>
                <th className="text-right py-2 px-3">누적수익률</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.month} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 px-3 font-medium">{row.month}</td>
                  <td className="py-2 px-3 text-right text-blue-400">
                    {row.buyAmount > 0 ? `${row.buyAmount.toLocaleString()}원` : '-'}
                    {row.buyCount > 0 && <span className="text-gray-500 text-xs ml-1">({row.buyCount}건)</span>}
                  </td>
                  <td className="py-2 px-3 text-right text-purple-400">
                    {row.sellAmount > 0 ? `${row.sellAmount.toLocaleString()}원` : '-'}
                    {row.sellCount > 0 && <span className="text-gray-500 text-xs ml-1">({row.sellCount}건)</span>}
                  </td>
                  <td className={`py-2 px-3 text-right font-bold ${
                    row.profit === 0 ? 'text-gray-500' : row.profit > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {row.profit !== 0 ? `${row.profit >= 0 ? '+' : ''}${row.profit.toLocaleString()}원` : '-'}
                  </td>
                  <td className={`py-2 px-3 text-right ${
                    row.cumulativeProfit === 0 ? 'text-gray-500' : row.cumulativeProfit > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {row.cumulativeProfit !== 0 ? `${row.cumulativeProfit >= 0 ? '+' : ''}${row.cumulativeProfit.toLocaleString()}원` : '-'}
                  </td>
                  <td className={`py-2 px-3 text-right ${
                    row.realizedReturnRate === 0 ? 'text-gray-500' : row.realizedReturnRate > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {row.realizedReturnRate !== 0 ? `${row.realizedReturnRate >= 0 ? '+' : ''}${row.realizedReturnRate.toFixed(3)}%` : '-'}
                  </td>
                  <td className={`py-2 px-3 text-right ${
                    row.cumulativeReturnRate === 0 ? 'text-gray-500' : row.cumulativeReturnRate > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {row.cumulativeReturnRate !== 0 ? `${row.cumulativeReturnRate >= 0 ? '+' : ''}${row.cumulativeReturnRate.toFixed(3)}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 누적 KPI 데이터 인터페이스
interface CumulativeStockData {
  name: string;
  code: string;
  buyAmount: number;      // 총 매수금액
  sellAmount: number;     // 총 매도금액
  profit: number;         // 실현손익
  profitRate: number;     // 수익률
  tradeCount: number;     // 거래 횟수
  winCount: number;       // 수익 횟수
  lossCount: number;      // 손실 횟수
  winRate: number;        // 승률
  avgProfit: number;      // 평균 수익
  holdingValue: number;   // 현재 보유 평가액
}

interface CumulativeKPI {
  totalBuyCount: number;      // 총 매수 건수
  totalBuyAmount: number;     // 총 매수 금액
  totalSellCount: number;     // 총 매도 건수
  totalSellAmount: number;    // 총 매도 금액
  totalProfit: number;
  totalProfitRate: number;
  avgProfitPerTrade: number;
  bestStock: CumulativeStockData | null;
  worstStock: CumulativeStockData | null;
  stockData: CumulativeStockData[];
}

// 트리맵 커스텀 컨텐츠
const TreemapContent = (props: any) => {
  const { x, y, width, height, name, profit, profitRate } = props;
  if (width < 50 || height < 30) return null;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: profit >= 0 ? '#10B981' : '#EF4444',
          stroke: '#1F2937',
          strokeWidth: 2,
          opacity: 0.8,
        }}
      />
      <text
        x={x + width / 2}
        y={y + height / 2 - 8}
        textAnchor="middle"
        fill="#fff"
        fontSize={width < 80 ? 10 : 12}
        fontWeight="bold"
      >
        {name?.length > 8 ? name.substring(0, 8) + '...' : name}
      </text>
      <text
        x={x + width / 2}
        y={y + height / 2 + 10}
        textAnchor="middle"
        fill="#fff"
        fontSize={width < 80 ? 9 : 11}
      >
        {profitRate >= 0 ? '+' : ''}{profitRate?.toFixed(1)}%
      </text>
    </g>
  );
};

function CumulativeChart({ data }: { data: CumulativeKPI }) {
  const {
    stockData, totalBuyCount, totalBuyAmount, totalSellCount, totalSellAmount,
    totalProfit, totalProfitRate, avgProfitPerTrade, bestStock, worstStock
  } = data;

  const [expandedChart, setExpandedChart] = useState<'profit' | 'trade' | 'treemap' | null>(null);

  if (stockData.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        매도 데이터가 없습니다.
      </div>
    );
  }

  // 파이차트 데이터 (수익 기준)
  const profitPieData = stockData
    .filter(s => s.profit !== 0)
    .map(s => ({
      name: s.name,
      value: Math.abs(s.profit),
      profit: s.profit,
      profitRate: s.profitRate,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // 거래량 파이차트 데이터
  const tradePieData = stockData
    .filter(s => s.tradeCount > 0)
    .map(s => ({
      name: s.name,
      value: s.tradeCount,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // 트리맵 데이터 (수익률 기준)
  const treemapData = stockData
    .filter(s => s.sellAmount > 0)
    .map(s => ({
      name: s.name,
      size: s.sellAmount,
      profit: s.profit,
      profitRate: s.profitRate,
    }));

  // 확대 모달
  const ChartModal = ({ onClose, children, title }: { onClose: () => void; children: React.ReactNode; title: string }) => (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );

  // 파이차트 렌더링 (모바일 최적화 - 라벨 제거, 범례 사용)
  const renderProfitPieChart = (height: number, showLegend = false) => (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={profitPieData}
          cx="50%"
          cy="50%"
          innerRadius={height > 300 ? 60 : 35}
          outerRadius={height > 300 ? 100 : 60}
          paddingAngle={2}
          dataKey="value"
        >
          {profitPieData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.profit >= 0 ? CHART_COLORS[index % CHART_COLORS.length] : '#EF4444'}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#1F2937',
            border: '1px solid #374151',
            borderRadius: '8px',
          }}
          formatter={(_value, _name, props: any) => [
            `${props.payload.profit >= 0 ? '+' : ''}${props.payload.profit.toLocaleString()}원 (${props.payload.profitRate >= 0 ? '+' : ''}${props.payload.profitRate.toFixed(2)}%)`,
            props.payload.name
          ]}
        />
        {showLegend && <Legend />}
      </PieChart>
    </ResponsiveContainer>
  );

  const renderTradePieChart = (height: number, showLegend = false) => (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={tradePieData}
          cx="50%"
          cy="50%"
          innerRadius={height > 300 ? 60 : 35}
          outerRadius={height > 300 ? 100 : 60}
          paddingAngle={2}
          dataKey="value"
        >
          {tradePieData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#1F2937',
            border: '1px solid #374151',
            borderRadius: '8px',
          }}
          formatter={(value) => [`${value}회`, '거래 횟수']}
        />
        {showLegend && <Legend />}
      </PieChart>
    </ResponsiveContainer>
  );

  const renderTreemap = (height: number) => (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap
        data={treemapData}
        dataKey="size"
        aspectRatio={4 / 3}
        stroke="#1F2937"
        content={<TreemapContent />}
      >
        <Tooltip
          contentStyle={{
            backgroundColor: '#1F2937',
            border: '1px solid #374151',
            borderRadius: '8px',
          }}
          formatter={(_value, _name, props: any) => [
            `${props.payload.profit >= 0 ? '+' : ''}${props.payload.profit.toLocaleString()}원`,
            '실현손익'
          ]}
          labelFormatter={(label) => label}
        />
      </Treemap>
    </ResponsiveContainer>
  );

  return (
    <div className="space-y-4">
      {/* 확대 모달 */}
      {expandedChart === 'profit' && (
        <ChartModal onClose={() => setExpandedChart(null)} title="종목별 수익 비중">
          <div className="h-96">
            {renderProfitPieChart(400, true)}
          </div>
          <div className="mt-4 space-y-2">
            {profitPieData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.profit >= 0 ? CHART_COLORS[index % CHART_COLORS.length] : '#EF4444' }}
                  />
                  <span>{item.name}</span>
                </div>
                <span className={item.profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {item.profit >= 0 ? '+' : ''}{item.profit.toLocaleString()}원
                </span>
              </div>
            ))}
          </div>
        </ChartModal>
      )}
      {expandedChart === 'trade' && (
        <ChartModal onClose={() => setExpandedChart(null)} title="종목별 거래 횟수">
          <div className="h-96">
            {renderTradePieChart(400, true)}
          </div>
          <div className="mt-4 space-y-2">
            {tradePieData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  <span>{item.name}</span>
                </div>
                <span>{item.value}회</span>
              </div>
            ))}
          </div>
        </ChartModal>
      )}
      {expandedChart === 'treemap' && (
        <ChartModal onClose={() => setExpandedChart(null)} title="종목별 수익률 트리맵">
          <div className="h-96">
            {renderTreemap(400)}
          </div>
          <p className="text-xs text-gray-500 mt-2">* 박스 크기: 매도금액, 색상: 초록=수익/빨강=손실</p>
        </ChartModal>
      )}

      {/* KPI 요약 카드 - 3x2 그리드 (모바일 2x3) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
        {/* 총 매수 */}
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <p className="text-gray-400 text-xs mb-1">총 매수</p>
          <p className="text-lg md:text-xl font-bold text-blue-400">{totalBuyCount}건</p>
          <p className="text-xs text-gray-500">{totalBuyAmount.toLocaleString()}원</p>
        </div>
        {/* 총 매도 */}
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <p className="text-gray-400 text-xs mb-1">총 매도</p>
          <p className="text-lg md:text-xl font-bold text-purple-400">{totalSellCount}건</p>
          <p className="text-xs text-gray-500">{totalSellAmount.toLocaleString()}원</p>
        </div>
        {/* 총 실현손익 */}
        <div className={`rounded-lg p-3 border ${totalProfit >= 0 ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'}`}>
          <p className="text-gray-400 text-xs mb-1">총 실현손익</p>
          <p className={`text-lg md:text-xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()}원
          </p>
          <p className={`text-xs ${totalProfitRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ({totalProfitRate >= 0 ? '+' : ''}{totalProfitRate.toFixed(2)}%)
          </p>
        </div>
        {/* 건당 평균 수익 */}
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <p className="text-gray-400 text-xs mb-1">건당 평균</p>
          <p className={`text-lg md:text-xl font-bold ${avgProfitPerTrade >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {avgProfitPerTrade >= 0 ? '+' : ''}{Math.round(avgProfitPerTrade).toLocaleString()}원
          </p>
        </div>
        {/* 최고 수익 종목 */}
        {bestStock && (
          <div className="bg-green-900/20 rounded-lg p-3 border border-green-800">
            <p className="text-gray-400 text-xs mb-1">🏆 최고 수익</p>
            <p className="font-bold text-white text-sm truncate">{bestStock.name}</p>
            <p className="text-green-400 text-sm font-bold">
              +{bestStock.profit.toLocaleString()}원
            </p>
          </div>
        )}
        {/* 최저 수익 종목 */}
        {worstStock && (
          <div className="bg-red-900/20 rounded-lg p-3 border border-red-800">
            <p className="text-gray-400 text-xs mb-1">📉 최저 수익</p>
            <p className="font-bold text-white text-sm truncate">{worstStock.name}</p>
            <p className={`text-sm font-bold ${worstStock.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {worstStock.profit >= 0 ? '+' : ''}{worstStock.profit.toLocaleString()}원
            </p>
          </div>
        )}
      </div>

      {/* 차트들 - 클릭 시 확대 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 종목별 수익 비중 */}
        <div
          className="bg-gray-800 rounded-lg border border-gray-700 p-3 cursor-pointer hover:border-gray-600 transition"
          onClick={() => setExpandedChart('profit')}
        >
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-400">종목별 수익 비중</h3>
            <span className="text-xs text-gray-500">터치하여 확대</span>
          </div>
          <div className="h-48">
            {renderProfitPieChart(192)}
          </div>
        </div>

        {/* 종목별 거래 횟수 */}
        <div
          className="bg-gray-800 rounded-lg border border-gray-700 p-3 cursor-pointer hover:border-gray-600 transition"
          onClick={() => setExpandedChart('trade')}
        >
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-400">종목별 거래 횟수</h3>
            <span className="text-xs text-gray-500">터치하여 확대</span>
          </div>
          <div className="h-48">
            {renderTradePieChart(192)}
          </div>
        </div>
      </div>

      {/* 트리맵 */}
      {treemapData.length > 0 && (
        <div
          className="bg-gray-800 rounded-lg border border-gray-700 p-3 cursor-pointer hover:border-gray-600 transition"
          onClick={() => setExpandedChart('treemap')}
        >
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-400">종목별 수익률 트리맵</h3>
            <span className="text-xs text-gray-500">터치하여 확대</span>
          </div>
          <div className="h-56">
            {renderTreemap(224)}
          </div>
          <p className="text-xs text-gray-500 mt-2">* 박스 크기: 매도금액, 색상: 초록=수익/빨강=손실</p>
        </div>
      )}

      {/* 종목별 상세 테이블 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-3">
        <h3 className="text-sm font-medium text-gray-400 mb-3">종목별 누적 실적</h3>
        {/* 모바일 카드 뷰 */}
        <div className="md:hidden space-y-2">
          {stockData
            .sort((a, b) => b.profit - a.profit)
            .map(stock => (
              <div key={stock.code} className="bg-gray-700/50 rounded p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-sm">{stock.name}</p>
                    <p className="text-xs text-gray-500">{stock.code}</p>
                  </div>
                  <span className={`text-sm font-bold ${stock.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.profit >= 0 ? '+' : ''}{stock.profit.toLocaleString()}원
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">거래</p>
                    <p>{stock.tradeCount}회</p>
                  </div>
                  <div>
                    <p className="text-gray-500">매수</p>
                    <p className="text-blue-400">{formatAmount(stock.buyAmount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">수익률</p>
                    <p className={stock.profitRate >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {stock.profitRate >= 0 ? '+' : ''}{stock.profitRate.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
        </div>
        {/* 데스크탑 테이블 뷰 */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 px-3">종목</th>
                <th className="text-right py-2 px-3">거래수</th>
                <th className="text-right py-2 px-3">매수금액</th>
                <th className="text-right py-2 px-3">매도금액</th>
                <th className="text-right py-2 px-3">실현손익</th>
                <th className="text-right py-2 px-3">수익률</th>
              </tr>
            </thead>
            <tbody>
              {stockData
                .sort((a, b) => b.profit - a.profit)
                .map(stock => (
                  <tr key={stock.code} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 px-3">
                      <span className="font-medium">{stock.name}</span>
                      <span className="text-gray-500 text-xs ml-2">{stock.code}</span>
                    </td>
                    <td className="py-2 px-3 text-right">{stock.tradeCount}회</td>
                    <td className="py-2 px-3 text-right text-blue-400">
                      {stock.buyAmount.toLocaleString()}원
                    </td>
                    <td className="py-2 px-3 text-right text-purple-400">
                      {stock.sellAmount.toLocaleString()}원
                    </td>
                    <td className={`py-2 px-3 text-right font-bold ${
                      stock.profit === 0 ? 'text-gray-500' : stock.profit > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {stock.profit !== 0 ? `${stock.profit >= 0 ? '+' : ''}${stock.profit.toLocaleString()}원` : '-'}
                    </td>
                    <td className={`py-2 px-3 text-right ${
                      stock.profitRate === 0 ? 'text-gray-500' : stock.profitRate > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {stock.profitRate !== 0 ? `${stock.profitRate >= 0 ? '+' : ''}${stock.profitRate.toFixed(2)}%` : '-'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function KPI() {
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('current');
  const [startDate, setStartDate] = useState(() => getDateDaysAgoKST(30));
  const [endDate, setEndDate] = useState(() => getTodayKST());

  // 현재탭 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>('all');

  useEffect(() => {
    fetchData();
  }, []);

  // 스냅샷 데이터 로드 (기간 변경 시)
  useEffect(() => {
    const loadSnapshots = async () => {
      try {
        const data = await getDailySnapshots('daily', startDate, endDate);
        setSnapshots(data);
      } catch (e) {
        console.error('Error loading snapshots:', e);
      }
    };
    loadSnapshots();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);

    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('No user logged in');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('bot_purchases')
      .select('*, bot_stocks(name, code)')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching purchases:', error);
    } else {
      setPurchases(data || []);
    }

    setLoading(false);
  };

  const kpiData = useMemo<KPIData>(() => {
    // 매수 집계: date(매수일) 기준
    const buyInPeriod = purchases.filter(p => {
      const date = formatDate(p.date);
      return date >= startDate && date <= endDate;
    });

    const buyData = buyInPeriod.reduce(
      (acc, p) => ({
        amount: acc.amount + p.price * p.quantity,
        count: acc.count + 1,
      }),
      { amount: 0, count: 0 }
    );

    // 매도 집계: sold_date(매도일) 기준 (purchases 전체에서 필터링)
    const soldInPeriod = purchases.filter(p => {
      if (p.status !== 'sold' || !p.sold_date) return false;
      const soldDate = p.sold_date.split('T')[0].split(' ')[0];
      return soldDate >= startDate && soldDate <= endDate;
    });

    const sellData = soldInPeriod.reduce(
      (acc, p) => ({
        amount: acc.amount + (p.sold_price || 0) * p.quantity,
        count: acc.count + 1,
      }),
      { amount: 0, count: 0 }
    );

    // 실현손익 (매도된 것의 수익)
    const realizedProfit = soldInPeriod.reduce((acc, p) => {
      if (p.sold_price) {
        return acc + (p.sold_price - p.price) * p.quantity;
      }
      return acc;
    }, 0);

    // 수익률 계산
    const buyCost = soldInPeriod.reduce((acc, p) => acc + p.price * p.quantity, 0);
    const profitRate = buyCost > 0 ? (realizedProfit / buyCost) * 100 : 0;

    return {
      totalBuyAmount: buyData.amount,
      totalBuyCount: buyData.count,
      totalSellAmount: sellData.amount,
      totalSellCount: sellData.count,
      realizedProfit,
      profitRate,
    };
  }, [purchases, startDate, endDate]);

  // 스냅샷 데이터를 날짜별 맵으로 변환
  const snapshotByDate = useMemo(() => {
    const map: Record<string, number> = {};
    snapshots.forEach(s => {
      map[s.date] = s.total_asset;
    });
    return map;
  }, [snapshots]);

  // 일자별 데이터 집계
  const dailySummary = useMemo<DailySummary[]>(() => {
    const byDate: Record<string, Omit<DailySummary, 'cumulativeProfit' | 'cumulativeReturnRate'>> = {};

    // 기간 내 모든 매수 건 집계
    purchases.forEach(p => {
      const date = formatDate(p.date);
      if (date < startDate || date > endDate) return;

      if (!byDate[date]) {
        byDate[date] = {
          date,
          buyAmount: 0,
          sellAmount: 0,
          profit: 0,
          profitRate: 0,
          buyCount: 0,
          sellCount: 0,
          totalAssets: snapshotByDate[date] || 0,
          realizedReturnRate: 0,
        };
      }
      byDate[date].buyAmount += p.price * p.quantity;
      byDate[date].buyCount += 1;
    });

    // 매도 집계 (sold_date 기준)
    purchases.forEach(p => {
      if (p.status !== 'sold' || !p.sold_date || !p.sold_price) return;
      const soldDate = p.sold_date.split('T')[0].split(' ')[0];
      if (soldDate < startDate || soldDate > endDate) return;

      if (!byDate[soldDate]) {
        byDate[soldDate] = {
          date: soldDate,
          buyAmount: 0,
          sellAmount: 0,
          profit: 0,
          profitRate: 0,
          buyCount: 0,
          sellCount: 0,
          totalAssets: snapshotByDate[soldDate] || 0,
          realizedReturnRate: 0,
        };
      }
      const sellAmount = p.sold_price * p.quantity;
      const buyCost = p.price * p.quantity;
      const profit = sellAmount - buyCost;

      byDate[soldDate].sellAmount += sellAmount;
      byDate[soldDate].profit += profit;
      byDate[soldDate].sellCount += 1;
    });

    // 수익률 계산
    Object.values(byDate).forEach(day => {
      if (day.sellAmount > 0) {
        const buyCost = day.sellAmount - day.profit;
        day.profitRate = buyCost > 0 ? (day.profit / buyCost) * 100 : 0;
      }
      // 총자산 대비 실현수익률
      if (!day.totalAssets) {
        day.totalAssets = snapshotByDate[day.date] || 0;
      }
      if (day.totalAssets > 0 && day.profit !== 0) {
        day.realizedReturnRate = (day.profit / day.totalAssets) * 100;
      }
    });

    // 날짜순 정렬 후 누적 계산
    const sorted = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

    let cumulativeProfit = 0;
    const firstTotalAssets = sorted.length > 0 ? (sorted[0].totalAssets || snapshots[0]?.total_asset || 0) : 0;

    return sorted.map(day => {
      cumulativeProfit += day.profit;
      const cumulativeReturnRate = firstTotalAssets > 0 ? (cumulativeProfit / firstTotalAssets) * 100 : 0;
      return {
        ...day,
        cumulativeProfit,
        cumulativeReturnRate,
      };
    });
  }, [purchases, startDate, endDate, snapshotByDate, snapshots]);

  // 월별 스냅샷 (해당 월 마지막 날 총자산)
  const monthlySnapshotMap = useMemo(() => {
    const map: Record<string, number> = {};
    snapshots.forEach(s => {
      const month = s.date.slice(0, 7);
      map[month] = s.total_asset; // 마지막 날짜 값이 덮어씀
    });
    return map;
  }, [snapshots]);

  // 월별 데이터 집계
  const monthlySummary = useMemo<MonthlySummary[]>(() => {
    const byMonth: Record<string, Omit<MonthlySummary, 'cumulativeProfit' | 'cumulativeReturnRate'>> = {};

    // 기간 내 모든 매수 건 집계
    purchases.forEach(p => {
      const date = formatDate(p.date);
      if (date < startDate || date > endDate) return;

      const month = date.slice(0, 7); // YYYY-MM
      if (!byMonth[month]) {
        byMonth[month] = {
          month,
          buyAmount: 0,
          sellAmount: 0,
          profit: 0,
          profitRate: 0,
          buyCount: 0,
          sellCount: 0,
          totalAssets: monthlySnapshotMap[month] || 0,
          realizedReturnRate: 0,
        };
      }
      byMonth[month].buyAmount += p.price * p.quantity;
      byMonth[month].buyCount += 1;
    });

    // 매도 집계 (sold_date 기준)
    purchases.forEach(p => {
      if (p.status !== 'sold' || !p.sold_date || !p.sold_price) return;
      const soldDate = p.sold_date.split('T')[0].split(' ')[0];
      if (soldDate < startDate || soldDate > endDate) return;

      const month = soldDate.slice(0, 7);
      if (!byMonth[month]) {
        byMonth[month] = {
          month,
          buyAmount: 0,
          sellAmount: 0,
          profit: 0,
          profitRate: 0,
          buyCount: 0,
          sellCount: 0,
          totalAssets: monthlySnapshotMap[month] || 0,
          realizedReturnRate: 0,
        };
      }
      const sellAmount = p.sold_price * p.quantity;
      const buyCost = p.price * p.quantity;
      const profit = sellAmount - buyCost;

      byMonth[month].sellAmount += sellAmount;
      byMonth[month].profit += profit;
      byMonth[month].sellCount += 1;
    });

    // 수익률 계산
    Object.values(byMonth).forEach(m => {
      if (m.sellAmount > 0) {
        const buyCost = m.sellAmount - m.profit;
        m.profitRate = buyCost > 0 ? (m.profit / buyCost) * 100 : 0;
      }
      // 총자산 대비 실현수익률
      if (!m.totalAssets) {
        m.totalAssets = monthlySnapshotMap[m.month] || 0;
      }
      if (m.totalAssets > 0 && m.profit !== 0) {
        m.realizedReturnRate = (m.profit / m.totalAssets) * 100;
      }
    });

    // 월순 정렬 후 누적 계산
    const sorted = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));

    let cumulativeProfit = 0;
    const firstTotalAssets = sorted.length > 0 ? (sorted[0].totalAssets || snapshots[0]?.total_asset || 0) : 0;

    return sorted.map(m => {
      cumulativeProfit += m.profit;
      const cumulativeReturnRate = firstTotalAssets > 0 ? (cumulativeProfit / firstTotalAssets) * 100 : 0;
      return {
        ...m,
        cumulativeProfit,
        cumulativeReturnRate,
      };
    });
  }, [purchases, startDate, endDate, monthlySnapshotMap, snapshots]);

  // 종목별 실현손익
  const stockProfits = useMemo(() => {
    const soldInPeriod = purchases.filter(p => {
      if (p.status !== 'sold' || !p.sold_date) return false;
      const soldDate = p.sold_date.split('T')[0].split(' ')[0];
      return soldDate >= startDate && soldDate <= endDate;
    });

    const byStock: Record<string, { name: string; profit: number; count: number }> = {};

    soldInPeriod.forEach(p => {
      const stockInfo = (p as any).bot_stocks;
      const stockName = stockInfo?.name || 'Unknown';
      const profit = p.sold_price ? (p.sold_price - p.price) * p.quantity : 0;

      if (!byStock[stockName]) {
        byStock[stockName] = { name: stockName, profit: 0, count: 0 };
      }
      byStock[stockName].profit += profit;
      byStock[stockName].count += 1;
    });

    return Object.values(byStock).sort((a, b) => b.profit - a.profit);
  }, [purchases, startDate, endDate]);

  // 누적 KPI 데이터 계산
  const cumulativeKPI = useMemo<CumulativeKPI>(() => {
    // 전체 기간 매도 건
    const soldPurchases = purchases.filter(p => {
      if (p.status !== 'sold' || !p.sold_date || !p.sold_price) return false;
      const soldDate = p.sold_date.split('T')[0].split(' ')[0];
      return soldDate >= startDate && soldDate <= endDate;
    });

    // 종목별 집계
    const byStock: Record<string, CumulativeStockData> = {};

    soldPurchases.forEach(p => {
      const stockInfo = (p as any).bot_stocks;
      const stockCode = stockInfo?.code || 'UNKNOWN';
      const stockName = stockInfo?.name || 'Unknown';

      if (!byStock[stockCode]) {
        byStock[stockCode] = {
          name: stockName,
          code: stockCode,
          buyAmount: 0,
          sellAmount: 0,
          profit: 0,
          profitRate: 0,
          tradeCount: 0,
          winCount: 0,
          lossCount: 0,
          winRate: 0,
          avgProfit: 0,
          holdingValue: 0,
        };
      }

      const buyAmt = p.price * p.quantity;
      const sellAmt = (p.sold_price || 0) * p.quantity;
      const profit = sellAmt - buyAmt;

      byStock[stockCode].buyAmount += buyAmt;
      byStock[stockCode].sellAmount += sellAmt;
      byStock[stockCode].profit += profit;
      byStock[stockCode].tradeCount += 1;
      if (profit > 0) {
        byStock[stockCode].winCount += 1;
      } else if (profit < 0) {
        byStock[stockCode].lossCount += 1;
      }
    });

    // 각 종목 수익률 및 승률 계산
    Object.values(byStock).forEach(stock => {
      stock.profitRate = stock.buyAmount > 0 ? (stock.profit / stock.buyAmount) * 100 : 0;
      stock.winRate = stock.tradeCount > 0 ? (stock.winCount / stock.tradeCount) * 100 : 0;
      stock.avgProfit = stock.tradeCount > 0 ? stock.profit / stock.tradeCount : 0;
    });

    const stockData = Object.values(byStock);
    const totalSellCount = stockData.reduce((sum, s) => sum + s.tradeCount, 0);
    const totalProfit = stockData.reduce((sum, s) => sum + s.profit, 0);
    const totalBuyAmt = stockData.reduce((sum, s) => sum + s.buyAmount, 0);
    const totalSellAmt = stockData.reduce((sum, s) => sum + s.sellAmount, 0);

    // 매수 건수 계산 (기간 내 매수)
    const buyInPeriod = purchases.filter(p => {
      const date = formatDate(p.date);
      return date >= startDate && date <= endDate;
    });
    const totalBuyCount = buyInPeriod.length;
    const totalBuyAmount = buyInPeriod.reduce((sum, p) => sum + p.price * p.quantity, 0);

    const sortedByProfit = [...stockData].sort((a, b) => b.profit - a.profit);
    const bestStock = sortedByProfit[0] || null;
    const worstStock = sortedByProfit[sortedByProfit.length - 1] || null;

    return {
      totalBuyCount,
      totalBuyAmount,
      totalSellCount,
      totalSellAmount: totalSellAmt,
      totalProfit,
      totalProfitRate: totalBuyAmt > 0 ? (totalProfit / totalBuyAmt) * 100 : 0,
      avgProfitPerTrade: totalSellCount > 0 ? totalProfit / totalSellCount : 0,
      bestStock,
      worstStock,
      stockData,
    };
  }, [purchases, startDate, endDate]);

  // 필터된 거래 내역
  const filteredPurchases = useMemo(() => {
    let filtered: Purchase[] = [];

    // 매수/매도 필터에 따라 다른 날짜 기준 적용
    if (tradeFilter === 'buy') {
      // 보유중인 것만 (매수일 기준)
      filtered = purchases.filter(p => {
        if (p.status !== 'holding') return false;
        const pDate = formatDate(p.date);
        return pDate >= startDate && pDate <= endDate;
      });
    } else if (tradeFilter === 'sell') {
      // 매도된 것만 (매도일 기준)
      filtered = purchases.filter(p => {
        if (p.status !== 'sold' || !p.sold_date) return false;
        const soldDate = p.sold_date.split('T')[0].split(' ')[0];
        return soldDate >= startDate && soldDate <= endDate;
      });
    } else {
      // 전체: 매수일 또는 매도일이 기간 내인 것
      filtered = purchases.filter(p => {
        const buyDate = formatDate(p.date);
        const isBuyInPeriod = buyDate >= startDate && buyDate <= endDate;

        if (p.status === 'sold' && p.sold_date) {
          const soldDate = p.sold_date.split('T')[0].split(' ')[0];
          const isSellInPeriod = soldDate >= startDate && soldDate <= endDate;
          return isBuyInPeriod || isSellInPeriod;
        }
        return isBuyInPeriod;
      });
    }

    // 검색어 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => {
        const stockInfo = (p as any).bot_stocks;
        const stockName = stockInfo?.name?.toLowerCase() || '';
        const stockCode = stockInfo?.code?.toLowerCase() || '';
        return stockName.includes(query) || stockCode.includes(query);
      });
    }

    return filtered.slice(0, 50);
  }, [purchases, startDate, endDate, searchQuery, tradeFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-xl md:text-2xl font-bold">KPI 조회</h1>

      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onStartChange={setStartDate}
        onEndChange={setEndDate}
      />

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 border-b border-gray-700">
        <TabButton active={activeTab === 'current'} onClick={() => setActiveTab('current')}>
          현재
        </TabButton>
        <TabButton active={activeTab === 'daily'} onClick={() => setActiveTab('daily')}>
          일자별
        </TabButton>
        <TabButton active={activeTab === 'monthly'} onClick={() => setActiveTab('monthly')}>
          월별
        </TabButton>
        <TabButton active={activeTab === 'cumulative'} onClick={() => setActiveTab('cumulative')}>
          누적
        </TabButton>
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === 'current' && (
        <>
          {/* 검색 및 필터 */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-3">
            <div className="flex flex-col md:flex-row gap-3">
              {/* 검색 */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="종목명 또는 코드 검색..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              {/* 매수/매도 필터 */}
              <div className="flex gap-1">
                <button
                  onClick={() => setTradeFilter('all')}
                  className={`px-3 py-2 text-sm rounded-lg transition ${
                    tradeFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  전체
                </button>
                <button
                  onClick={() => setTradeFilter('buy')}
                  className={`px-3 py-2 text-sm rounded-lg transition ${
                    tradeFilter === 'buy'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  매수만
                </button>
                <button
                  onClick={() => setTradeFilter('sell')}
                  className={`px-3 py-2 text-sm rounded-lg transition ${
                    tradeFilter === 'sell'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  매도만
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
            <KPICard
              title="총 매수금액"
              value={`${kpiData.totalBuyAmount.toLocaleString()}원`}
              subValue={`${kpiData.totalBuyCount}건`}
              icon={TrendingDown}
              colorClass="bg-blue-900/50 text-blue-400"
            />
            <KPICard
              title="총 매도금액"
              value={`${kpiData.totalSellAmount.toLocaleString()}원`}
              subValue={`${kpiData.totalSellCount}건`}
              icon={TrendingUp}
              colorClass="bg-purple-900/50 text-purple-400"
            />
            <KPICard
              title="실현손익"
              value={`${kpiData.realizedProfit >= 0 ? '+' : ''}${kpiData.realizedProfit.toLocaleString()}원`}
              icon={DollarSign}
              colorClass={kpiData.realizedProfit >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}
            />
            <KPICard
              title="수익률"
              value={`${kpiData.profitRate >= 0 ? '+' : ''}${kpiData.profitRate.toFixed(2)}%`}
              icon={BarChart3}
              colorClass={kpiData.profitRate >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}
            />
          </div>

          {/* 종목별 실현손익 */}
          {stockProfits.length > 0 && (
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 md:p-4">
              <h2 className="text-base md:text-lg font-bold mb-3 md:mb-4">종목별 실현손익</h2>
              <div className="space-y-2">
                {stockProfits.map(stock => (
                  <div
                    key={stock.name}
                    className="flex items-center justify-between p-2 md:p-3 bg-gray-700/50 rounded"
                  >
                    <div>
                      <span className="font-bold text-sm md:text-base">{stock.name}</span>
                      <span className="text-gray-400 text-xs md:text-sm ml-2">{stock.count}건</span>
                    </div>
                    <span
                      className={`font-bold text-sm md:text-base ${
                        stock.profit >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {stock.profit >= 0 ? '+' : ''}
                      {stock.profit.toLocaleString()}원
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 거래 내역 - 모바일은 카드, 데스크탑은 테이블 */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 md:p-4">
            <h2 className="text-base md:text-lg font-bold mb-3 md:mb-4">기간 내 거래 내역</h2>

            {filteredPurchases.length === 0 ? (
              <p className="text-gray-500 text-center py-8">해당 기간에 거래 내역이 없습니다.</p>
            ) : (
              <>
                {/* 모바일 카드 뷰 */}
                <div className="md:hidden space-y-2">
                  {filteredPurchases.map(p => {
                    const stockInfo = (p as any).bot_stocks;
                    const profit = p.sold_price ? (p.sold_price - p.price) * p.quantity : null;
                    return (
                      <div key={p.id} className="bg-gray-700/50 rounded p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold">{stockInfo?.name || '-'}</p>
                            <p className="text-xs text-gray-400">{p.round}차 · {formatDate(p.date)}</p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              p.status === 'holding'
                                ? 'bg-blue-900/50 text-blue-400'
                                : 'bg-green-900/50 text-green-400'
                            }`}
                          >
                            {p.status === 'holding' ? '보유' : '매도'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-gray-400">매수가</p>
                            <p>{p.price.toLocaleString()}원</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">수량</p>
                            <p>{p.quantity}주</p>
                          </div>
                          {p.sold_price && (
                            <>
                              <div>
                                <p className="text-xs text-gray-400">매도가</p>
                                <p>{p.sold_price.toLocaleString()}원</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">손익</p>
                                <p className={profit && profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                                  {profit !== null ? `${profit >= 0 ? '+' : ''}${profit.toLocaleString()}원` : '-'}
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 데스크탑 테이블 뷰 */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-700">
                        <th className="text-left py-2 px-3">종목</th>
                        <th className="text-left py-2 px-3">차수</th>
                        <th className="text-right py-2 px-3">매수가</th>
                        <th className="text-right py-2 px-3">수량</th>
                        <th className="text-left py-2 px-3">매수일</th>
                        <th className="text-left py-2 px-3">상태</th>
                        <th className="text-right py-2 px-3">매도가</th>
                        <th className="text-right py-2 px-3">손익</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPurchases.map(p => {
                        const stockInfo = (p as any).bot_stocks;
                        const profit = p.sold_price ? (p.sold_price - p.price) * p.quantity : null;
                        return (
                          <tr key={p.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                            <td className="py-2 px-3">{stockInfo?.name || '-'}</td>
                            <td className="py-2 px-3">{p.round}차</td>
                            <td className="py-2 px-3 text-right">{p.price.toLocaleString()}원</td>
                            <td className="py-2 px-3 text-right">{p.quantity}주</td>
                            <td className="py-2 px-3">{formatDate(p.date)}</td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-xs ${
                                  p.status === 'holding'
                                    ? 'bg-blue-900/50 text-blue-400'
                                    : 'bg-green-900/50 text-green-400'
                                }`}
                              >
                                {p.status === 'holding' ? '보유' : '매도'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              {p.sold_price ? `${p.sold_price.toLocaleString()}원` : '-'}
                            </td>
                            <td
                              className={`py-2 px-3 text-right font-bold ${
                                profit === null
                                  ? 'text-gray-500'
                                  : profit >= 0
                                  ? 'text-green-400'
                                  : 'text-red-400'
                              }`}
                            >
                              {profit !== null
                                ? `${profit >= 0 ? '+' : ''}${profit.toLocaleString()}원`
                                : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {activeTab === 'daily' && <DailyChart data={dailySummary} />}
      {activeTab === 'monthly' && <MonthlyChart data={monthlySummary} />}
      {activeTab === 'cumulative' && <CumulativeChart data={cumulativeKPI} />}
    </div>
  );
}
