import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
    it('renders without crashing', () => {
        render(<App />);
        // Check for a known element, e.g., the "API Key Required" screen since mock data usually requires auth/key or defaults to login
        // Or if we are in mock mode, check for something else.
        // Based on App.tsx, initial state !hasApiKey -> "API Key Required"

        // We can just check that the wrapper exists or some text
        expect(screen.getByText(/Sign in to KubeOptima Platform/i)).toBeInTheDocument();
    });
});
