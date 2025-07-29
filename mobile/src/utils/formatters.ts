// 안전한 숫자 포맷팅 유틸리티
export const safeToFixed = (value: number | undefined | null, decimals: number = 2): string => {
  const num = Number(value);
  return isNaN(num) ? '0.00' : num.toFixed(decimals);
};

// 안전한 숫자 더하기 (reduce 등에서 사용)
export const safeAdd = (a: number | undefined | null, b: number | undefined | null): number => {
  const numA = Number(a) || 0;
  const numB = Number(b) || 0;
  return numA + numB;
};

// 통화 포맷팅
export const formatCurrency = (value: number | undefined | null, currency: string = 'USDC'): string => {
  return `$${safeToFixed(value)} ${currency}`;
};

// 퍼센트 포맷팅
export const formatPercent = (value: number | undefined | null, decimals: number = 1): string => {
  return `${safeToFixed(value, decimals)}%`;
}; 