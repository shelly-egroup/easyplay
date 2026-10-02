import type { Metadata } from 'next';
import PageTransition from '@/components/PageTransition';
import PopGame from '@/games/pop/PopGame';

export const metadata: Metadata = { title: '消消樂' };

export default function Page() {
  return (
    <PageTransition>
      <PopGame />
    </PageTransition>
  );
}
