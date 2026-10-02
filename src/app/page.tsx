import Home from '@/components/Home';
import PageTransition from '@/components/PageTransition';

export default function Page() {
  return (
    <PageTransition>
      <Home />
    </PageTransition>
  );
}
