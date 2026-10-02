// 把說明唸出來：用裝置內建的中文語音
export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function speak(text: string) {
  if (!canSpeak()) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-TW';
    u.rate = 0.85;
    const voices = speechSynthesis.getVoices();
    const voice = voices.find((v) => /zh[-_]TW/i.test(v.lang)) ?? voices.find((v) => /^zh/i.test(v.lang));
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  } catch {
    // 沒有中文語音的裝置就安靜略過
  }
}

export function hush() {
  if (!canSpeak()) return;
  try {
    speechSynthesis.cancel();
  } catch {
    // 忽略
  }
}
