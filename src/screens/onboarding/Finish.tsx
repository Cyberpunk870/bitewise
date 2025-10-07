import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useOnboarding from '../../store/onboarding';
import useAddress from '../../store/address';
import persistUtils from '../../store/persist';
import { saveProfile, setActivePhone } from '../../lib/profileStore';

export default function Finish() {
  const nav = useNavigate();
  const { name, addressLine, markComplete } = useOnboarding();
  const address = useAddress();

  useEffect(() => {
    const phone = sessionStorage.getItem('bw.session.phone') || '';

    // Normalize label (union -> string)
    const label =
      typeof address.label === 'string'
        ? address.label
        : address.label?.custom || undefined;

    saveProfile({
      phone,
      name,
      addressLine: address.addressLine ?? addressLine,
      addressLabel: label,
    });

    setActivePhone(phone);

    // Persist explicit completion so refresh always works
    persistUtils.save?.({
      complete: true,
      completed: true,
      phone,
      name,
      addressLine: address.addressLine ?? addressLine,
    });

    markComplete(); // keep your existing zustand completion too
    nav('/home', { replace: true });
  }, []);

  return null;
}
