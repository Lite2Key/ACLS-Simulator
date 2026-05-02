import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';

describe('App shell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders the cockpit workflow in default dark realistic mode', () => {
    render(<App />);

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByText('ED Case Lab')).toBeInTheDocument();
    expect(screen.getByTestId('mode-select')).toHaveValue('realistic');
    expect(screen.getByTestId('case-select')).toHaveValue('unstable-bradycardia-v1');
    expect(screen.getByText('ED MONITOR')).toBeInTheDocument();
    expect(screen.getByText('Active Workflow')).toBeInTheDocument();
    expect(screen.getByText('Command')).toBeInTheDocument();
    expect(screen.getByText('Team Updates')).toBeInTheDocument();
    expect(screen.getByTestId('action-start_pacing_mode')).toBeInTheDocument();
    expect(screen.getAllByText('needs pads').length).toBeGreaterThan(0);
    expect(screen.queryByText('Debrief')).not.toBeInTheDocument();
  });

  it('switches from the bradycardia flagship to the septic shock case', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByTestId('case-select'), 'septic-shock-v1');

    expect(screen.getByText('Septic Shock: Early Resuscitation and Reassessment')).toBeInTheDocument();
    expect(screen.getAllByText('General EM Resuscitation').length).toBeGreaterThan(0);
    expect(screen.getByTestId('action-give_fluid_bolus')).toBeInTheDocument();
    expect(screen.getByTestId('action-start_norepinephrine')).toBeInTheDocument();
  });

  it('toggles and persists the theme choice', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('theme-toggle'));

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('acls-sim-theme')).toBe('light');
  });
});
