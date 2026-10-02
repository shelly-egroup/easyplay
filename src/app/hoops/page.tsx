import type { Metadata } from 'next';
import PageTransition from '@/components/PageTransition';
import HoopsGame from '@/games/hoops/HoopsGame';

export const metadata: Metadata = { title: '投籃' };

export default function Page() {
  return (
    <PageTransition>
      <HoopsGame />
    </PageTransition>
  );
}
