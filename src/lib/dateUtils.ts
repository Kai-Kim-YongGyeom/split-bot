// KST (UTC+9) 기준 날짜/시간 포맷 유틸리티

/**
 * KST 기준 날짜/시간 포맷 (yyyy-MM-dd HH:mm:ss)
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';

  const kstOffset = 9 * 60; // KST = UTC+9
  const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
  const kstDate = new Date(utcTime + kstOffset * 60000);

  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');
  const hours = String(kstDate.getHours()).padStart(2, '0');
  const minutes = String(kstDate.getMinutes()).padStart(2, '0');
  const seconds = String(kstDate.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * KST 기준 짧은 날짜/시간 포맷 (MM-dd HH:mm)
 */
export function formatDateTimeShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';

  const kstOffset = 9 * 60;
  const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
  const kstDate = new Date(utcTime + kstOffset * 60000);

  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');
  const hours = String(kstDate.getHours()).padStart(2, '0');
  const minutes = String(kstDate.getMinutes()).padStart(2, '0');

  return `${month}-${day} ${hours}:${minutes}`;
}

/**
 * KST 기준 날짜만 포맷 (yyyy-MM-dd)
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';

  // 이미 yyyy-MM-dd 형식인 경우 그대로 반환
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';

  const kstOffset = 9 * 60;
  const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
  const kstDate = new Date(utcTime + kstOffset * 60000);

  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * 오늘 날짜를 KST 기준 yyyy-MM-dd 형식으로 반환
 */
export function getTodayKST(): string {
  const now = new Date();
  const kstOffset = 9 * 60;
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const kstDate = new Date(utcTime + kstOffset * 60000);

  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * N일 전 날짜를 KST 기준 yyyy-MM-dd 형식으로 반환
 */
export function getDateDaysAgoKST(daysAgo: number): string {
  const now = new Date();
  now.setDate(now.getDate() - daysAgo);
  const kstOffset = 9 * 60;
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const kstDate = new Date(utcTime + kstOffset * 60000);

  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
