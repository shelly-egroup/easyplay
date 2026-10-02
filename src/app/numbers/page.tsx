import type { Metadata } from 'next';
import PageTransition from '@/components/PageTransition';
import NumbersGame from '@/games/numbers/NumbersGame';

export const metadata: Metadata = { title: '數字點點' };

export default function Page() {
  return (
    <PageTransition>
      <NumbersGame />
    </PageTransition>
  );
}
