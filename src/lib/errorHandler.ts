/**
 * 공통 에러 핸들러 유틸리티
 */

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface AppError {
  message: string;
  code?: string;
  severity: ErrorSeverity;
  originalError?: unknown;
}

/**
 * 에러 메시지 추출
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return '알 수 없는 오류가 발생했습니다.';
}

/**
 * API 에러 코드를 한글 메시지로 변환
 */
export function translateApiError(error: unknown): string {
  const message = getErrorMessage(error);

  // Supabase 인증 에러
  if (message.includes('Invalid login credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }
  if (message.includes('Email not confirmed')) {
    return '이메일 인증이 필요합니다.';
  }
  if (message.includes('User already registered')) {
    return '이미 가입된 이메일입니다.';
  }

  // 네트워크 에러
  if (message.includes('fetch') || message.includes('network')) {
    return '네트워크 연결을 확인해주세요.';
  }
  if (message.includes('timeout')) {
    return '요청 시간이 초과되었습니다. 다시 시도해주세요.';
  }

  // Supabase DB 에러
  if (message.includes('duplicate key')) {
    return '이미 존재하는 데이터입니다.';
  }
  if (message.includes('foreign key')) {
    return '연관된 데이터가 존재합니다.';
  }
  if (message.includes('permission denied') || message.includes('RLS')) {
    return '접근 권한이 없습니다.';
  }

  // 기본 반환
  return message;
}

/**
 * 에러를 콘솔에 로깅
 */
export function logError(context: string, error: unknown): void {
  console.error(`[${context}]`, error);
}

/**
 * 에러 핸들링 래퍼 함수
 * API 호출을 감싸서 일관된 에러 처리를 제공
 */
export async function handleApiCall<T>(
  apiCall: () => Promise<T>,
  context: string
): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await apiCall();
    return { data, error: null };
  } catch (error) {
    logError(context, error);
    return { data: null, error: translateApiError(error) };
  }
}

/**
 * 에러 표시용 토스트 메시지 생성
 */
export function createErrorToast(error: unknown): { title: string; message: string } {
  return {
    title: '오류',
    message: translateApiError(error),
  };
}
