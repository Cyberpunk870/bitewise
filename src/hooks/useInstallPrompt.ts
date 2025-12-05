import { useEffect, useState, useCallback } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type Options = { enabled?: boolean };

export function useInstallPrompt(options: Options = {}) {
  const { enabled = true } = options;
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      const bipEvent = event as BeforeInstallPromptEvent;
      setSupported(true);
      if (!enabled) return;
      event.preventDefault();
      setPromptEvent(bipEvent);
    };

    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, [enabled]);

  const promptInstall = useCallback(async () => {
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const result = await promptEvent.userChoice;
    setPromptEvent(null);
    return result.outcome === 'accepted';
  }, [promptEvent]);

  const resetPrompt = useCallback(() => {
    setPromptEvent(null);
  }, []);

  return {
    supported: supported || !!promptEvent,
    promptInstall,
    resetPrompt,
  };
}
