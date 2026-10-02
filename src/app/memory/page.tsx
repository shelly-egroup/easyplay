import type { Metadata } from 'next';
import PageTransition from '@/components/PageTransition';
import MemoryGame from '@/games/memory/MemoryGame';

export const metadata: Metadata = { title: '翻牌配對' };

export default function Page() {
  return (
    <PageTransition>
      <MemoryGame />
    </PageTransition>
  );
}
