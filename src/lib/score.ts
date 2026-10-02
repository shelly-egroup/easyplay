import { useCallback, useRef, useState } from 'react';
import { read, write } from './store';

// 有關卡的遊戲：分數一關一關累積成「總分」，存在裝置上，下次接著算。
// - 開始第 1 關：總分歸零
// - 開始第 2 關以後：從上一關結束時的總分繼續
// - 同一關重來：只扣回這一關剛得的分數
export function useRunScore(id: string) {
  const [base, setBase] = useState(0);
  const [points, setPoints] = useState(0);
  const baseRef = useRef(0);
  const pointsRef = useRef(0);

  const begin = useCallback(
    (level: number) => {
      const b = level <= 1 ? 0 : read(`${id}.total`, 0);
      if (level <= 1) write(`${id}.total`, 0);
      baseRef.current = b;
      pointsRef.current = 0;
      setBase(b);
      setPoints(0);
    },
    [id]
  );

  const add = useCallback((n: number) => {
    pointsRef.current = Math.max(-baseRef.current, pointsRef.current + Math.round(n));
    setPoints(pointsRef.current);
  }, []);

  /** 過關時把分數存起來，回傳這一關得幾分、總分、有沒有破紀錄 */
  const bank = useCallback(() => {
    const total = baseRef.current + pointsRef.current;
    write(`${id}.total`, total);
    const best = read(`${id}.bestTotal`, 0);
    if (total > best) write(`${id}.bestTotal`, total);
    return { gained: pointsRef.current, total, record: total > best && total > 0 };
  }, [id]);

  return { total: base + points, gained: points, begin, add, bank, current: () => baseRef.current + pointsRef.current };
}

export type Banked = { gained: number; total: number; record: boolean };
