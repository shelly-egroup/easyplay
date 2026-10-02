'use client';

import { useEffect, useState } from 'react';
import { onToast, type ToastMessage } from '@/lib/toast';

export default function Toaster() {
  const [msg, setMsg] = useState<ToastMessage | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => onToast((next) => {
    if (next) setMsg(next);
    setVisible(!!next);
  }), []);

  useEffect(() => {
    if (!msg || !visible) return;
    const id = setTimeout(() => setVisible(false), msg.ms);
    return () => clearTimeout(id);
  }, [msg, visible]);

  return (
    <div className={visible ? 'toast is-on' : 'toast'} role="status" aria-live="polite">
      {msg?.content}
    </div>
  );
}
