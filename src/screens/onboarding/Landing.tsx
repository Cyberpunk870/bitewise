// file: src/screens/onboarding/Landing.tsx
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const nav = useNavigate();
  return (
    <div className="min-h-[75dvh] grid place-items-center p-6">
      <div className="text-center space-y-6">
        <div>
          <div className="text-5xl font-extrabold text-white tracking-tight">BiteWise</div>
          <div className="text-white/90 text-lg -mt-1">Eat. Save. Repeat.</div>
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={() => nav('/name')} className="px-5 py-2 rounded-xl bg-white text-black font-medium">Signup</button>
          <button onClick={() => nav('/auth/phone')} className="px-5 py-2 rounded-xl bg-white/20 text-white font-medium border border-white/40">Login</button>
        </div>
      </div>
    </div>
  );
}
