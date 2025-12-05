// src/screens/onboarding/Finish.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useOnboarding from '../../store/onboarding';
import useAddress from '../../store/address';
import persistUtils from '../../store/persist';
import { saveProfile, setActivePhone } from '../../lib/profileStore';
import { track } from '../../lib/track';

export default function Finish() {
  const nav = useNavigate();
  const { name, addressLine, markComplete } = useOnboarding();
  const address = useAddress();

  useEffect(() => {
    const phone =
      sessionStorage.getItem('bw.session.phone') || '';

    // Normalize label from address store:
    // address.label may be string OR { custom: string }
    const rawLabel: any = (address as any).label;
    const normLabel =
      typeof rawLabel === 'string'
        ? rawLabel
        : rawLabel?.custom || undefined;

    saveProfile({
      phone,
      name,
      addressLine: address.addressLine ?? addressLine,
      addressLabel: normLabel,
    });

    setActivePhone(phone);

    // Persist explicit completion so refresh always works
    // Cast to any here to avoid TS complaining about keys
    const patch: any = {
      complete: true,
      completed: true,
      phone,
      name,
      addressLine: address.addressLine ?? addressLine,
    };
    try {
      persistUtils.save?.(patch);
    } catch {}

    markComplete(); // keep your existing zustand completion too
    track('onboarding_complete', { address_added: Boolean(address.addressLine || addressLine) });
    nav('/home', { replace: true });
  }, [name, addressLine, markComplete, address, nav]);

  return null;
}
