import type { Metadata } from 'next';
import PageTransition from '@/components/PageTransition';
import BricksGame from '@/games/bricks/BricksGame';

export const metadata: Metadata = { title: '補磚塊' };

export default function Page() {
  return (
    <PageTransition>
      <BricksGame />
    </PageTransition>
  );
}
