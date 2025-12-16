// AES 암호화 (crypto-js 사용)
import CryptoJS from 'crypto-js';

const getEncryptionKey = (): string => {
  const key = import.meta.env.VITE_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('암호화 키 환경변수가 설정되지 않았습니다.');
  }
  return key;
};

export function encrypt(text: string): string {
  if (!text) return '';
  try {
    const key = getEncryptionKey();
    return CryptoJS.AES.encrypt(text, key).toString();
  } catch (e) {
    console.error('암호화 실패:', e);
    return '';
  }
}

export function decrypt(encoded: string): string {
  if (!encoded) return '';

  // 먼저 기존 Caesar 암호로 시도 (마이그레이션용)
  // Caesar 암호는 Base64로 시작하므로 U2Fsd로 시작하지 않으면 Caesar일 가능성 높음
  if (!encoded.startsWith('U2Fsd')) {
    try {
      const legacy = decryptLegacy(encoded);
      if (legacy) return legacy;
    } catch {
      // Caesar 실패, AES 시도
    }
  }

  // AES 복호화 시도
  try {
    const key = getEncryptionKey();
    const bytes = CryptoJS.AES.decrypt(encoded, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (decrypted) return decrypted;
  } catch {
    // AES 실패
  }

  // 둘 다 실패하면 빈 문자열
  console.warn('복호화 실패:', encoded.substring(0, 20) + '...');
  return '';
}

// 기존 Caesar 암호 복호화 (마이그레이션용)
function decryptLegacy(encoded: string): string {
  const SHIFT = 7;
  const shifted = atob(encoded);
  return shifted
    .split('')
    .map((char) => String.fromCharCode(char.charCodeAt(0) - SHIFT))
    .join('');
}
