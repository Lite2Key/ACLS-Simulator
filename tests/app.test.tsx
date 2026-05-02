import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';

describe('App shell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('opens on the light Training Hub with case cards', () => {
    render(<App />);

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.getByText('Training Hub')).toBeInTheDocument();
    expect(screen.getByText('Lead the Room')).toBeInTheDocument();
    expect(screen.getByTestId('case-card-unstable-bradycardia-v1')).toBeInTheDocument();
    expect(screen.getByTestId('case-card-septic-shock-v1')).toBeInTheDocument();
    expect(screen.getByTestId('start-case')).toBeInTheDocument();
  });

  it('selects septic shock from the Training Hub and launches the simulator', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('case-card-septic-shock-v1'));
    await user.click(screen.getByTestId('home-mode-instructor'));
    await user.click(screen.getByTestId('start-case'));

    expect(screen.getByTestId('mode-select')).toHaveValue('instructor');
    expect(screen.getByText('Septic Shock')).toBeInTheDocument();
    expect(screen.getByTestId('monitor-panel')).toHaveTextContent('ED MONITOR');
    await user.click(screen.getByRole('tab', { name: 'Intervene' }));
    expect(screen.getByTestId('action-give_fluid_bolus')).toBeInTheDocument();
    expect(screen.getByTestId('action-start_norepinephrine')).toBeInTheDocument();
  });

  it('returns from the simulator to the case library', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('start-case'));
    await user.click(screen.getByTestId('back-library'));

    expect(screen.getByText('Case Library')).toBeInTheDocument();
    expect(screen.getByTestId('case-card-unstable-bradycardia-v1')).toBeInTheDocument();
  });
});
