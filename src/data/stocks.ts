// 주요 KOSPI/KOSDAQ 종목 리스트
export interface StockInfo {
  code: string;
  name: string;
  market: 'KOSPI' | 'KOSDAQ';
}

export const STOCK_LIST: StockInfo[] = [
  // KOSPI 대형주
  { code: '005930', name: '삼성전자', market: 'KOSPI' },
  { code: '000660', name: 'SK하이닉스', market: 'KOSPI' },
  { code: '373220', name: 'LG에너지솔루션', market: 'KOSPI' },
  { code: '207940', name: '삼성바이오로직스', market: 'KOSPI' },
  { code: '005380', name: '현대차', market: 'KOSPI' },
  { code: '006400', name: '삼성SDI', market: 'KOSPI' },
  { code: '051910', name: 'LG화학', market: 'KOSPI' },
  { code: '000270', name: '기아', market: 'KOSPI' },
  { code: '035420', name: 'NAVER', market: 'KOSPI' },
  { code: '005490', name: 'POSCO홀딩스', market: 'KOSPI' },
  { code: '035720', name: '카카오', market: 'KOSPI' },
  { code: '068270', name: '셀트리온', market: 'KOSPI' },
  { code: '012330', name: '현대모비스', market: 'KOSPI' },
  { code: '028260', name: '삼성물산', market: 'KOSPI' },
  { code: '105560', name: 'KB금융', market: 'KOSPI' },
  { code: '055550', name: '신한지주', market: 'KOSPI' },
  { code: '066570', name: 'LG전자', market: 'KOSPI' },
  { code: '003670', name: '포스코퓨처엠', market: 'KOSPI' },
  { code: '096770', name: 'SK이노베이션', market: 'KOSPI' },
  { code: '086790', name: '하나금융지주', market: 'KOSPI' },
  { code: '034730', name: 'SK', market: 'KOSPI' },
  { code: '032830', name: '삼성생명', market: 'KOSPI' },
  { code: '003550', name: 'LG', market: 'KOSPI' },
  { code: '015760', name: '한국전력', market: 'KOSPI' },
  { code: '017670', name: 'SK텔레콤', market: 'KOSPI' },
  { code: '030200', name: 'KT', market: 'KOSPI' },
  { code: '009150', name: '삼성전기', market: 'KOSPI' },
  { code: '018260', name: '삼성에스디에스', market: 'KOSPI' },
  { code: '033780', name: 'KT&G', market: 'KOSPI' },
  { code: '010130', name: '고려아연', market: 'KOSPI' },
  { code: '011200', name: 'HMM', market: 'KOSPI' },
  { code: '000810', name: '삼성화재', market: 'KOSPI' },
  { code: '024110', name: '기업은행', market: 'KOSPI' },
  { code: '316140', name: '우리금융지주', market: 'KOSPI' },
  { code: '009540', name: '한국조선해양', market: 'KOSPI' },
  { code: '010950', name: 'S-Oil', market: 'KOSPI' },
  { code: '036570', name: '엔씨소프트', market: 'KOSPI' },
  { code: '011170', name: '롯데케미칼', market: 'KOSPI' },
  { code: '034020', name: '두산에너빌리티', market: 'KOSPI' },
  { code: '003490', name: '대한항공', market: 'KOSPI' },
  { code: '090430', name: '아모레퍼시픽', market: 'KOSPI' },
  { code: '251270', name: '넷마블', market: 'KOSPI' },
  { code: '011070', name: 'LG이노텍', market: 'KOSPI' },
  { code: '010140', name: '삼성중공업', market: 'KOSPI' },
  { code: '267250', name: '현대중공업', market: 'KOSPI' },
  { code: '004020', name: '현대제철', market: 'KOSPI' },
  { code: '047050', name: '포스코인터내셔널', market: 'KOSPI' },
  { code: '000100', name: '유한양행', market: 'KOSPI' },
  { code: '139480', name: '이마트', market: 'KOSPI' },
  { code: '161390', name: '한국타이어앤테크놀로지', market: 'KOSPI' },

  // KOSDAQ 주요 종목
  { code: '247540', name: '에코프로비엠', market: 'KOSDAQ' },
  { code: '086520', name: '에코프로', market: 'KOSDAQ' },
  { code: '263750', name: '펄어비스', market: 'KOSDAQ' },
  { code: '293490', name: '카카오게임즈', market: 'KOSDAQ' },
  { code: '196170', name: '알테오젠', market: 'KOSDAQ' },
  { code: '403870', name: 'HPSP', market: 'KOSDAQ' },
  { code: '145020', name: '휴젤', market: 'KOSDAQ' },
  { code: '112040', name: '위메이드', market: 'KOSDAQ' },
  { code: '041510', name: '에스엠', market: 'KOSDAQ' },
  { code: '035900', name: 'JYP Ent.', market: 'KOSDAQ' },
  { code: '352820', name: '하이브', market: 'KOSPI' },
  { code: '028300', name: 'HLB', market: 'KOSDAQ' },
  { code: '091990', name: '셀트리온헬스케어', market: 'KOSDAQ' },
  { code: '257720', name: '실리콘투', market: 'KOSDAQ' },
  { code: '039030', name: '이오테크닉스', market: 'KOSDAQ' },
  { code: '095340', name: 'ISC', market: 'KOSDAQ' },
  { code: '240810', name: '원익IPS', market: 'KOSDAQ' },
  { code: '005290', name: '동진쎄미켐', market: 'KOSDAQ' },
  { code: '078600', name: '대주전자재료', market: 'KOSDAQ' },
  { code: '357780', name: '솔브레인', market: 'KOSDAQ' },
  { code: '299030', name: '하나마이크론', market: 'KOSDAQ' },
  { code: '377300', name: '카카오페이', market: 'KOSPI' },
  { code: '259960', name: '크래프톤', market: 'KOSPI' },
  { code: '361610', name: 'SK아이이테크놀로지', market: 'KOSPI' },
  { code: '402340', name: 'SK스퀘어', market: 'KOSPI' },
  { code: '383220', name: 'F&F', market: 'KOSPI' },
  { code: '180640', name: '한진칼', market: 'KOSPI' },
  { code: '069500', name: 'KODEX 200', market: 'KOSPI' },
  { code: '102110', name: 'TIGER 200', market: 'KOSPI' },
  { code: '229200', name: 'KODEX 코스닥150', market: 'KOSPI' },
  { code: '114800', name: 'KODEX 인버스', market: 'KOSPI' },
  { code: '122630', name: 'KODEX 레버리지', market: 'KOSPI' },
  { code: '252670', name: 'KODEX 200선물인버스2X', market: 'KOSPI' },
  { code: '233740', name: 'KODEX 코스닥150레버리지', market: 'KOSPI' },
];

// 종목 검색 함수
export function searchStocks(query: string): StockInfo[] {
  if (!query || query.length < 1) return [];

  const lowerQuery = query.toLowerCase();

  return STOCK_LIST.filter(stock =>
    stock.name.toLowerCase().includes(lowerQuery) ||
    stock.code.includes(query)
  ).slice(0, 10); // 최대 10개
}
