import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 12) return "A senha deve ter pelo menos 12 caracteres.";
  if (password.length > 128) return "A senha deve ter no máximo 128 caracteres.";
  if (!/[a-z]/.test(password)) return "A senha deve conter uma letra minúscula.";
  if (!/[A-Z]/.test(password)) return "A senha deve conter uma letra maiúscula.";
  if (!/\d/.test(password)) return "A senha deve conter um número.";
  if (!/[^A-Za-z0-9]/.test(password)) return "A senha deve conter um caractere especial.";
  return null;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64url"), derivedKey.toString("base64url")].join("$");
}

export function verifyPassword(password: string, encoded: string): boolean {
  try {
    const [algorithm, n, r, p, saltValue, hashValue] = encoded.split("$");
    if (algorithm !== "scrypt" || !n || !r || !p || !saltValue || !hashValue) return false;
    const expected = Buffer.from(hashValue, "base64url");
    const actual = scryptSync(password, Buffer.from(saltValue, "base64url"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export const DUMMY_PASSWORD_HASH = hashPassword("InvalidPassword!123");
