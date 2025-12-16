"""CryptoJS 호환 AES 복호화 모듈

seven-split의 crypto.ts와 동일한 방식으로 복호화
CryptoJS.AES.encrypt()는 OpenSSL 호환 형식 사용
"""
import base64
import hashlib
from typing import Optional
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad


def decrypt_aes(encrypted: str, passphrase: str) -> str:
    """CryptoJS AES 암호화 문자열 복호화

    CryptoJS는 OpenSSL 호환 형식 사용:
    - Base64(Salted__ + 8바이트 salt + 암호문)
    - 키/IV는 passphrase + salt로 파생
    """
    if not encrypted or not passphrase:
        return ""

    try:
        # Base64 디코딩
        data = base64.b64decode(encrypted)

        # "Salted__" 헤더 확인 (8바이트)
        if data[:8] != b"Salted__":
            # 레거시 Caesar 암호 시도
            return _decrypt_legacy(encrypted)

        # Salt 추출 (8바이트)
        salt = data[8:16]
        ciphertext = data[16:]

        # 키와 IV 파생 (OpenSSL EVP_BytesToKey 방식)
        key, iv = _evp_bytes_to_key(passphrase.encode(), salt, 32, 16)

        # AES-256-CBC 복호화
        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted = unpad(cipher.decrypt(ciphertext), AES.block_size)

        return decrypted.decode('utf-8')

    except Exception as e:
        print(f"[Crypto] AES 복호화 실패: {e}")
        # 레거시 시도
        try:
            return _decrypt_legacy(encrypted)
        except:
            return ""


def _evp_bytes_to_key(password: bytes, salt: bytes, key_len: int, iv_len: int) -> tuple[bytes, bytes]:
    """OpenSSL EVP_BytesToKey 구현 (MD5 기반)"""
    d = b""
    d_i = b""

    while len(d) < key_len + iv_len:
        d_i = hashlib.md5(d_i + password + salt).digest()
        d += d_i

    return d[:key_len], d[key_len:key_len + iv_len]


def _decrypt_legacy(encoded: str) -> str:
    """레거시 Caesar 암호 복호화 (마이그레이션용)"""
    SHIFT = 7
    try:
        shifted = base64.b64decode(encoded).decode('utf-8')
        return ''.join(chr(ord(c) - SHIFT) for c in shifted)
    except:
        return ""
