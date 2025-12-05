/**
 * @jest-environment jsdom
 */
import React from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PermLocation from '../screens/onboarding/PermLocation';
import PermNotifications from '../screens/onboarding/PermNotifications';
import PermMic from '../screens/onboarding/PermMic';
import { clearPermPrefs } from '../lib/permPrefs';

// Silence analytics during tests.
jest.mock('../lib/track', () => ({ track: jest.fn() }));

// Avoid geolocation network prompts.
jest.mock('../lib/location', () => ({
  ...jest.requireActual('../lib/location'),
  getCurrentPosition: jest.fn().mockResolvedValue({ coords: { latitude: 0, longitude: 0 } }),
}));

function buildRouter(start: string) {
  return createMemoryRouter(
    [
      { path: '/onboarding/perm/location', element: <PermLocation /> },
      { path: '/onboarding/perm/notifications', element: <PermNotifications /> },
      { path: '/onboarding/perm/mic', element: <PermMic /> },
      { path: '/onboarding/setpasskey', element: <div data-testid="passkey-page" /> },
    ],
    { initialEntries: [start] }
  );
}

describe('Onboarding permission smoke flows', () => {
  beforeEach(() => {
    clearPermPrefs();
    jest.useRealTimers();
  });

  it('walks the happy path to passkey setup when all perms are granted', async () => {
    const router = buildRouter('/onboarding/perm/location');
    render(<RouterProvider router={router} />);

    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /always allow/i }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/onboarding/perm/notifications')
    );

    await user.click(screen.getByRole('button', { name: /always allow/i }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/onboarding/perm/mic')
    );

    await user.click(screen.getByRole('button', { name: /always allow/i }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/onboarding/setpasskey')
    );
    expect(screen.getByTestId('passkey-page')).toBeInTheDocument();
  });

  it('lets users deny permissions and still continue forward', async () => {
    const router = buildRouter('/onboarding/perm/location');
    render(<RouterProvider router={router} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /don’t allow/i }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/onboarding/perm/notifications')
    );

    await user.click(screen.getByRole('button', { name: /don’t allow/i }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/onboarding/perm/mic')
    );

    await user.click(screen.getByRole('button', { name: /don’t allow/i }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/onboarding/setpasskey')
    );
  });
});
