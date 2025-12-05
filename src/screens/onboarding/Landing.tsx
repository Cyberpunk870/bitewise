// file: src/screens/onboarding/Landing.tsx
import { useNavigate } from 'react-router-dom';
import BitewiseLogo from '../../components/BitewiseLogo';

export default function Landing() {
  const nav = useNavigate();
  return (
    <div
      className="min-h-screen grid place-items-center p-6"
      style={{
        background:
          'radial-gradient(circle at 15% 20%, rgba(124,58,237,0.18), transparent 32%), radial-gradient(circle at 80% 10%, rgba(252,211,77,0.16), transparent 28%), linear-gradient(145deg, #0b1120 0%, #111827 35%, #0f172a 100%)',
      }}
    >
      <div className="w-full max-w-3xl">
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl shadow-black/40 p-8 sm:p-12 text-center space-y-8">
          <div className="flex flex-col items-center gap-3">
            <BitewiseLogo showTagline showMark={false} />
            <p className="text-sm sm:text-base text-white/70 max-w-xl">
              The smartest way to decide where to order—compare prices, delivery times, and offers across platforms.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={() => nav('/name')}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-300 via-pink-300 to-violet-400 text-slate-900 font-semibold shadow-lg shadow-pink-500/30"
            >
              Get started
            </button>
            <button
              onClick={() => nav('/auth/phone')}
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-white/30 bg-white/5 text-white font-semibold hover:bg-white/10 transition"
            >
              Log in
            </button>
          </div>
          <div className="text-xs text-white/60 tracking-[0.22em] uppercase">Eat • Save • Repeat</div>
        </div>
      </div>
    </div>
  );
}
