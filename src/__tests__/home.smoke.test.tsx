/**
 * @jest-environment jsdom
 */
import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomeDishGrid from '../screens/home/HomeDishGrid';
import { DISH_CATALOG } from '../data/dishCatalog';

jest.mock('../lib/track', () => ({ track: jest.fn() }));
jest.mock('../lib/images', () => ({
  getPictureSources: () => ({ fallback: 'about:blank' }),
  getDishImage: () => 'about:blank',
  placeholderDishUrl: () => 'about:blank',
}));

function GridHarness({ query }: { query: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [itemsMap, setItemsMap] = useState<Record<string, { qty: number; name: string }>>({});

  const onAdd = ({ id, name }: { id: string; name: string }) => {
    setItemsMap((m) => {
      const nextQty = (m[id]?.qty || 0) + 1;
      return { ...m, [id]: { name, qty: nextQty } };
    });
  };

  const onDec = (id: string) => {
    setItemsMap((m) => {
      if (!m[id]) return m;
      const nextQty = Math.max(0, (m[id]?.qty || 0) - 1);
      const next = { ...m, [id]: { ...m[id], qty: nextQty } };
      return next;
    });
  };

  const cartCount = Object.values(itemsMap).reduce((sum, item) => sum + (item.qty || 0), 0);

  return (
    <div>
      <HomeDishGrid
        activeTab="all"
        query={query}
        filters={null}
        locationKey="test"
        itemsMap={itemsMap}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
        onAdd={onAdd}
        onDec={onDec}
      />
      <div data-testid="cart-count">{cartCount}</div>
    </div>
  );
}

describe('Home search/cart smoke flow', () => {
  it('filters dishes by search and adds to cart', async () => {
    const targetDish = DISH_CATALOG[0];
    render(<GridHarness query={targetDish.name.slice(0, 4)} />);

    const card = await screen.findByText(targetDish.name);
    await userEvent.click(card);

    await userEvent.click(screen.getByRole('button', { name: /add to cart/i }));
    expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
  });
});
