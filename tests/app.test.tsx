import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';

describe('App shell', () => {
  it('renders core panels for the simulation workflow', () => {
    render(<App />);

    expect(screen.getByText('Narrative and Team Updates')).toBeInTheDocument();
    expect(screen.getByText('Monitor and Status')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Task Queue')).toBeInTheDocument();
    expect(screen.getByText('Debrief')).toBeInTheDocument();
  });
});
