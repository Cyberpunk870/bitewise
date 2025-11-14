import { useEffect, useState, useCallback } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      const bipEvent = event as BeforeInstallPromptEvent;
      setSupported(true);
      setPromptEvent(bipEvent);
    };

    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const result = await promptEvent.userChoice;
    setPromptEvent(null);
    return result.outcome === 'accepted';
  }, [promptEvent]);

  return {
    supported: supported || !!promptEvent,
    promptInstall,
  };
}
