import { test, expect } from '@playwright/test';

test('home, careers, and college search smoke flow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Find a career path/i })).toBeVisible();

  await page.getByRole('button', { name: 'Careers', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: /Curiosity is a good/i })).toBeVisible();

  await page.getByRole('button', { name: 'Colleges', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: /Compare options/i })).toBeVisible();
  await page.getByRole('button', { name: /Prepare my search/i }).click();
  await expect(page.getByText(/No cutoff records|Search profile:/i).first()).toBeVisible();
  await page.getByLabel('Entrance exam').selectOption('JEE Advanced');
  await expect(page.getByText(/JoSAA records cover All India/i)).toBeVisible();
  await expect(page.getByLabel(/Preferred region/i)).toBeDisabled();
});

test('career imagery and feature cards remain usable on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/careers');
  const careerImage = page.locator('.career-card-visual').first();
  await careerImage.scrollIntoViewIfNeeded();
  await expect(careerImage).toHaveAttribute('alt', 'Illustrative photo for Technology');
  await expect.poll(() => careerImage.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth)).toBe(true);

  await page.goto('/features');
  await expect(page.locator('.extra-feature-number')).toHaveCount(11);
  await expect(page.locator('.extra-feature-number').nth(9)).toHaveText('10');
  await expect(page.locator('.extra-feature-number').nth(10)).toHaveText('11');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth)).toBe(true);

  await page.setViewportSize({ width: 320, height: 780 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth)).toBe(true);
});

test('registration form submits credentials and accepts the API session', async ({ page }) => {
  let submittedCredentials: Record<string, string> | undefined;
  await page.route('**/api/v1/auth/register', async route => {
    submittedCredentials = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: {
        access_token: 'playwright-session-token',
        token_type: 'bearer',
        user: { id: 1, name: 'Playwright Student', email: 'playwright@example.com' },
      },
    });
  });
  await page.route('**/api/v1/roadmap/tasks', route => route.fulfill({ json: [] }));
  await page.route('**/api/v1/bookmarks', route => route.fulfill({ json: [] }));

  await page.goto('/register');
  await page.getByLabel('Full name').fill('Playwright Student');
  await page.getByLabel('Email address').fill('playwright@example.com');
  await page.getByLabel('Password').fill('StrongPass123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(submittedCredentials).toEqual({
    name: 'Playwright Student',
    email: 'playwright@example.com',
    password: 'StrongPass123!',
  });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('careercompass_access_token'))).toBe('playwright-session-token');
});

test('login shows when OAuth provider credentials are not configured', async ({ page }) => {
  await page.route('**/api/v1/auth/oauth/providers', route => route.fulfill({ json: { google: false } }));
  await page.goto('/login');

  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Google sign-in needs client credentials configured in backend/.env.');
});

test('college matches show an attributed map after an explicit location lookup', async ({ page }) => {
  let geocodeRequestCount = 0;
  let geocodeQuery = '';
  await page.route('**/api/v1/colleges/search', route => route.fulfill({
    json: {
      status: 'ok',
      message: 'Found one historical cutoff match.',
      received_filters: {},
      matches: [{
        college_name: 'Example Institute',
        course: 'Computer Science',
        state: 'Karnataka',
        year: 2025,
        category: 'GM',
        quota: 'AI',
        round: '1',
        historical_closing_rank: 1200,
        source_url: 'https://example.org/source',
        source_checked_on: '2025-01-01',
        advisory_band: 'Moderate',
      }],
    },
  }));
  await page.route('**/api/v1/colleges/geocode', route => {
    geocodeRequestCount += 1;
    geocodeQuery = route.request().postDataJSON().query;
    return route.fulfill({
      json: {
        provider: 'Nominatim',
        results: [
          { name: 'Example Institute, Bengaluru, India', latitude: 12.9716, longitude: 77.5946, type: 'university' },
          { name: 'Example Institute alternative, Bengaluru, India', latitude: 12.97, longitude: 77.59, type: 'college' },
        ],
        disclaimer: 'Approximate coordinates returned by OpenStreetMap Nominatim.',
      },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Colleges', exact: true }).first().click();
  await page.getByRole('button', { name: /Prepare my search/i }).click();
  await expect(page.getByText('Example Institute', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View map' })).toBeVisible();
  expect(geocodeRequestCount).toBe(0);

  await page.getByRole('button', { name: 'View map' }).click();
  await expect(page.getByText('Approximate map location', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Choose a matching location')).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.getByText('Approximate coordinates returned by OpenStreetMap Nominatim.')).toBeVisible();
  await expect(page.getByText('contributors')).toBeVisible();
  expect(geocodeQuery).toBe('Example Institute, Karnataka');
  expect(geocodeRequestCount).toBe(1);
  await page.locator('.leaflet-marker-icon').click();
  await expect(page.locator('.leaflet-popup-content')).toContainText('Example Institute, Bengaluru, India');
  await page.getByLabel('Choose a matching location').selectOption('1');
  await page.locator('.leaflet-marker-icon').click();
  await expect(page.locator('.leaflet-popup-content')).toContainText('Example Institute alternative, Bengaluru, India');

  await page.getByRole('button', { name: 'View map' }).click();
  await expect.poll(() => geocodeRequestCount).toBe(1);
});

test('NEET search clearly marks synthetic demo matches', async ({ page }) => {
  let searchFilters: Record<string, unknown> = {};
  await page.route('**/api/v1/colleges/search', route => {
    searchFilters = route.request().postDataJSON();
    return route.fulfill({
      json: {
        status: 'demo_matches',
        message: 'Illustrative NEET demo only: rank references are synthetic and are not MCC allotment or historical cutoff data.',
        received_filters: searchFilters,
        matches: [{
          college_name: 'Example Medical Institute',
          course: 'MBBS',
          state: 'Delhi',
          year: null,
          category: 'SC',
          quota: 'AIQ-style demo',
          round: 'Illustrative demo',
          historical_closing_rank: null,
          demo_rank_reference: 5000,
          advisory_band: 'Demo',
          source_url: '',
          source_checked_on: null,
          is_demo: true,
        }],
      },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Colleges', exact: true }).first().click();
  await page.getByLabel('Entrance exam').selectOption('NEET UG');
  await page.getByLabel(/Entrance-exam rank/i).fill('5000');
  await page.getByLabel('Category (optional)').fill('SC');
  await page.getByRole('button', { name: /Prepare my search/i }).click();

  await expect(page.getByRole('heading', { name: 'Illustrative NEET demo examples' })).toBeVisible();
  await expect(page.getByText('SYNTHETIC DEMO · NOT OFFICIAL')).toBeVisible();
  await expect(page.getByText('Demo only · no admission estimate')).toBeVisible();
  await expect(page.locator('.college-match-list').getByRole('link', { name: /Source/i })).toHaveCount(0);
  expect(searchFilters).toMatchObject({
    exam: 'NEET UG',
    rank: '5000',
    region: 'All India',
    category: 'SC',
    quota: 'AIQ',
  });
});

test('job-role explorer filters by field and searches live listings', async ({ page }) => {
  await page.route('**/api/v1/jobs*', route => route.fulfill({
    json: {
      status: 'live',
      provider: 'Remotive',
      message: 'Mock listing for the browser test.',
      items: [{
        id: 'embedded-role-demo',
        title: 'Embedded Systems Engineer',
        company: 'Example Systems',
        location: 'Remote',
        category: 'Engineering',
        skills: ['C/C++', 'Embedded'],
        type: 'Full-time',
        url: 'https://example.org/jobs/embedded',
        is_demo: false,
        source: 'Remotive',
        match_score: 100,
        matched_skills: ['Embedded'],
      }],
    },
  }));

  await page.goto('/jobs');
  await page.getByLabel('Study field').selectOption('ECE');
  await expect(page.locator('.job-role-grid').getByRole('heading', { name: 'Embedded Systems Engineer' })).toBeVisible();
  await expect(page.locator('.job-role-grid').getByRole('heading', { name: 'Software Engineer' })).toHaveCount(0);
  await page.getByLabel('Salary estimate location').selectOption('Chennai, Tamil Nadu');
  await expect(page.locator('.job-role-card').filter({ hasText: 'Embedded Systems Engineer' }).getByText('₹3.5–10 LPA')).toBeVisible();
  await page.getByRole('button', { name: 'Search live listings for Embedded Systems Engineer' }).click();
  await expect(page.getByPlaceholder('Search roles or skills')).toHaveValue('Embedded Systems Engineer');
  await expect(page.getByText('Example Systems')).toBeVisible();
});

test('idea lab offers six ideas for each selected interest area', async ({ page }) => {
  await page.route('**/api/v1/business-ideas*', route => {
    const interest = new URL(route.request().url()).searchParams.get('interest') || 'technology';
    const items = Array.from({ length: 6 }, (_, index) => ({
      id: `${interest}-${index + 1}`,
      title: `${interest} idea ${index + 1}`,
      interest,
      budget: index === 0 ? 'under-5000' : '5000-20000',
      time: index === 0 ? 'weekends' : 'planned',
      description: 'A small experiment to validate with potential users.',
      test: 'Ask potential users for feedback before spending.',
    }));
    return route.fulfill({ json: { items, source_note: 'Starter ideas for validation.' } });
  });

  await page.goto('/ideas');
  await expect(page.getByLabel('Interest area').locator('option')).toHaveCount(11);
  await expect(page.locator('.idea-card')).toHaveCount(6);
  await page.getByLabel('Interest area').selectOption('agriculture');
  await expect(page.locator('.idea-card')).toHaveCount(6);
  await expect(page.getByRole('heading', { name: 'agriculture idea 1' })).toBeVisible();
  await expect(page.getByText(/fewer than six ideas/i)).toBeVisible();
  await expect(page.getByRole('option', { name: 'Environment and sustainability' })).toHaveCount(1);
});
