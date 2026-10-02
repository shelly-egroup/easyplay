import type { Metadata } from 'next';
import PageTransition from '@/components/PageTransition';
import MoleGame from '@/games/mole/MoleGame';

export const metadata: Metadata = { title: '打地鼠' };

export default function Page() {
  return (
    <PageTransition>
      <MoleGame />
    </PageTransition>
  );
}
