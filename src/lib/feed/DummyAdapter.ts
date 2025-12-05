import { addNotice } from '../notifications';
import { emit } from '../events';
import { setLastAvailabilitySync } from '../dataSync';
import { getWatchlist } from '../../store/watchlist';

const DISHES = [
  'Paneer Butter Masala','Masala Dosa','Chicken Biryani','Veg Momos','Margherita Pizza'
];

function pick<T>(a: T[]) { return a[Math.floor(Math.random() * a.length)]; }
function rand(min: number, max: number) { return Math.floor(Math.random()*(max-min+1)) + min; }

export function startDummyFeed() {
  // Seed once if empty
  try {
    const inbox = JSON.parse(localStorage.getItem('bw.notifications.inbox') || '[]');
    if (!inbox?.length) {
      [
        { kind: 'price',     title: 'Price drop!',   body: `${pick(DISHES)} now ₹${rand(149,219)}.` },
        { kind: 'tasks',     title: 'Task due soon', body: 'Compare 5 dishes — due in ~1h.' },
        { kind: 'milestone', title: 'Level up 🎉',   body: 'You reached 50 Bits/Bites!' },
        { kind: 'savings',   title: 'Nice save!',    body: 'You saved ₹75 across 3 dishes.' },
      ].forEach(n => addNotice(n as any));
    }
  } catch {}

  // Immediately set a sync timestamp so UI isn't blank on first render
  setLastAvailabilitySync(Date.now());

  // Occasionally simulate rank drop to show leaderboard badge
  const rankNudge = () => {
    if (Math.random() < 0.25) {
      const curr = Number(localStorage.getItem('bw.leader.rank.curr') || 1);
      localStorage.setItem('bw.leader.rank.prev', String(curr));
      localStorage.setItem('bw.leader.rank.curr', String(curr + 1));
      emit('bw:badges:update');
    }
  };

  let id: number | null = null;
  const tick = () => {
    const kind = pick(['price','tasks','savings'] as const);
    if (kind === 'price') {
      const dish = pick(DISHES);
      const body = `${dish} now ₹${rand(129,229)} (limited time).`;
      addNotice({ kind, title: 'Price drop!', body });
      const watched = getWatchlist().some(
        (it) => it.kind === 'dish' && it.name.toLowerCase() === dish.toLowerCase()
      );
      if (watched) {
        addNotice({ kind: 'price', title: 'On your watchlist', body });
      }
    } else if (kind === 'tasks') {
      addNotice({ kind, title: 'Bonus opportunity', body: 'Make one search to earn +10 Bits.' });
    } else {
      addNotice({ kind, title: 'Savings recap', body: `This week: ₹${rand(40, 160)} saved.` });
      emit('bw:savings:added', {});
    }

    // mark sync so "Last updated" nudges forward even with dummy data
    setLastAvailabilitySync(Date.now());
    emit('bw:data:availabilitySync', Date.now());
    rankNudge();
    schedule();
  };
  const schedule = () => { id = window.setTimeout(tick, rand(90000, 150000)); };
  schedule();

  return () => { if (id) window.clearTimeout(id); };
}
