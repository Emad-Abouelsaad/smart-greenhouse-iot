// End-to-end test cases of the Smart Greenhouse System.
// The test case IDs (TC-01 ... TC-13) are the same as in Chapter 7 of the thesis.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const DEMO = { email: 'demo@greenhouse.local', password: 'Demo1234' };
const START = '/login?interval=1000';

async function login(page, email = DEMO.email, password = DEMO.password) {
  await page.goto(START);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('[data-testid=login-submit]');
}

async function loginOk(page) {
  await login(page);
  await expect(page).toHaveURL(/\/$/);
}

const nav = (page, name) => page.getByRole('navigation').getByRole('link', { name, exact: true }).click();

async function scenario(page, key) {
  await nav(page, 'Settings');
  await page.click(`[data-testid=scenario-${key}]`);
}

test.describe('TC-01 Login', () => {
  test('Step 1: the login page opens', async ({ page }) => {
    await page.goto(START);
    await expect(page.getByRole('heading', { name: 'Welcome to Smart Greenhouse' })).toBeVisible();
  });
  test('Step 2: correct email and password open the home page', async ({ page }) => {
    await loginOk(page);
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();
  });
  test('Step 3: wrong email shows a message to correct or reset the email', async ({ page }) => {
    await login(page, 'wrong@greenhouse.local', DEMO.password);
    await expect(page.getByTestId('login-error')).toContainText('No account was found');
  });
  test('Step 4: wrong password shows a message to correct or reset the password', async ({ page }) => {
    await login(page, DEMO.email, 'WrongPass1');
    await expect(page.getByTestId('login-error')).toContainText('password is incorrect');
  });
  test('Step 5: wrong email and wrong password show that the account is not available', async ({ page }) => {
    await login(page, 'nobody@greenhouse.local', 'WrongPass1');
    await expect(page.getByTestId('login-error')).toContainText('No account was found');
  });
  test('Step 6: empty fields are not accepted', async ({ page }) => {
    await page.goto(START);
    await page.click('[data-testid=login-submit]');
    await expect(page.getByTestId('login-error')).toContainText('Please enter your email and password');
  });
});

test.describe('TC-02 Sign up', () => {
  const user = { first: 'Test', last: 'User', email: 'new.user@greenhouse.local', pass: 'Secret123' };
  async function fill(page, confirm) {
    await page.goto('/signup?interval=1000');
    await page.fill('#firstName', user.first);
    await page.fill('#lastName', user.last);
    await page.fill('#email', user.email);
    await page.fill('#password', user.pass);
    await page.fill('#confirmPassword', confirm);
  }
  test('Steps 1-2: valid data creates the account and opens the login page', async ({ page }) => {
    await fill(page, user.pass);
    await page.click('[data-testid=signup-submit]');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('login-info')).toContainText('Account created');
  });
  test('Step 3: a wrong confirm password asks the user to enter the password again', async ({ page }) => {
    await fill(page, 'Different1');
    await page.click('[data-testid=signup-submit]');
    await expect(page.getByTestId('signup-error')).toContainText('Passwords do not match');
    await expect(page.locator('#confirmPassword')).toHaveValue('');
  });
  test('Step 4: the new account can log in', async ({ page }) => {
    await fill(page, user.pass);
    await page.click('[data-testid=signup-submit]');
    await expect(page).toHaveURL(/\/login$/);   // the sign-up page has an #email field too
    await page.fill('#email', user.email);
    await page.fill('#password', user.pass);
    await page.click('[data-testid=login-submit]');
    await expect(page.getByRole('heading', { name: 'Welcome, Test 👋' })).toBeVisible();
  });
  test('Step 5: an email that is already registered is rejected', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('#firstName', 'A'); await page.fill('#lastName', 'B');
    await page.fill('#email', DEMO.email); await page.fill('#password', 'Secret123'); await page.fill('#confirmPassword', 'Secret123');
    await page.click('[data-testid=signup-submit]');
    await expect(page.getByTestId('signup-error')).toContainText('already exists');
  });
});

test.describe('TC-03 Real-time monitoring', () => {
  test('sensor values are displayed and updated in real time', async ({ page }) => {
    await loginOk(page);
    await nav(page, 'Dashboard');
    for (const k of ['temperature', 'humidity', 'soilMoisture', 'lightLevel', 'airQuality']) {
      await expect(page.getByTestId(`value-${k}`)).not.toHaveText('--');
    }
    const first = await page.getByTestId('last-update').textContent();
    await expect(page.getByTestId('last-update')).not.toHaveText(first, { timeout: 5000 });
    await expect(page.getByTestId('sensor-chart').locator('canvas')).toBeVisible();
  });
});

test.describe('TC-04 Soil moisture', () => {
  test('Step 1: normal soil moisture is shown as Normal', async ({ page }) => {
    await loginOk(page);
    await nav(page, 'Dashboard');
    await expect(page.getByTestId('status-soilMoisture')).toHaveText('Normal');
  });
  test('Step 2: over-watered soil raises a warning', async ({ page }) => {
    await loginOk(page);
    await scenario(page, 'wetSoil');
    await nav(page, 'Dashboard');
    await expect(page.getByTestId('alert-soilMoisture')).toContainText('above the recommended range');
  });
  test('Step 3: dry soil raises an alert and the pump can be switched on', async ({ page }) => {
    await loginOk(page);
    await scenario(page, 'drySoil');
    await nav(page, 'Dashboard');
    await expect(page.getByTestId('alert-soilMoisture')).toContainText('Soil Moisture');
    await nav(page, 'Control Panel');
    await page.click('[data-testid=toggle-pump]');
    await expect(page.getByTestId('device-status-pump')).toHaveText('ON');
  });
});

test.describe('TC-05 Temperature and humidity', () => {
  test('Step 1: normal temperature and humidity are shown as Normal', async ({ page }) => {
    await loginOk(page);
    await nav(page, 'Dashboard');
    await expect(page.getByTestId('status-temperature')).toHaveText('Normal');
    await expect(page.getByTestId('status-humidity')).toHaveText('Normal');
  });
  test('Step 2: high temperature raises an alert and the fan can be switched on', async ({ page }) => {
    await loginOk(page);
    await scenario(page, 'hotDay');
    await nav(page, 'Dashboard');
    await expect(page.getByTestId('alert-temperature')).toBeVisible();
    await nav(page, 'Control Panel');
    await page.click('[data-testid=toggle-fan]');
    await expect(page.getByTestId('device-status-fan')).toHaveText('ON');
  });
  test('Step 3: low temperature raises an alert and the fan stays off', async ({ page }) => {
    await loginOk(page);
    await scenario(page, 'coldNight');
    await nav(page, 'Dashboard');
    await expect(page.getByTestId('alert-temperature')).toContainText('low');
    await nav(page, 'Control Panel');
    await expect(page.getByTestId('device-status-fan')).toHaveText('OFF');
  });
});

test.describe('TC-06 Light level', () => {
  test('Step 1: sufficient light is shown as Normal', async ({ page }) => {
    await loginOk(page);
    await nav(page, 'Dashboard');
    await expect(page.getByTestId('status-lightLevel')).toHaveText('Normal');
  });
  test('Step 2: low light raises an alert and the lights can be switched on', async ({ page }) => {
    await loginOk(page);
    await scenario(page, 'lowLight');
    await nav(page, 'Dashboard');
    await expect(page.getByTestId('alert-lightLevel')).toBeVisible({ timeout: 10_000 });
    await nav(page, 'Control Panel');
    await page.click('[data-testid=toggle-light]');
    await expect(page.getByTestId('device-status-light')).toHaveText('ON');
  });
});

test.describe('TC-07 Air quality', () => {
  test('poor ventilation raises an alert and the fan improves the air', async ({ page }) => {
    await loginOk(page);
    await scenario(page, 'poorAir');
    await nav(page, 'Dashboard');
    await expect(page.getByTestId('alert-airQuality')).toBeVisible();
    await nav(page, 'Control Panel');
    await page.click('[data-testid=toggle-fan]');
    await nav(page, 'Dashboard');
    await expect(page.getByTestId('status-airQuality')).toHaveText('Normal', { timeout: 30_000 });
  });
});

test.describe('TC-08 Manual device control', () => {
  test('fan, pump and lights can be switched on and off', async ({ page }) => {
    await loginOk(page);
    await nav(page, 'Control Panel');
    for (const d of ['fan', 'pump', 'light']) {
      await page.click(`[data-testid=toggle-${d}]`);
      await expect(page.getByTestId(`device-status-${d}`)).toHaveText('ON');
      await page.click(`[data-testid=toggle-${d}]`);
      await expect(page.getByTestId(`device-status-${d}`)).toHaveText('OFF');
    }
  });
});

test.describe('TC-09 Automatic mode', () => {
  test('the fan switches on automatically at high temperature', async ({ page }) => {
    await loginOk(page);
    await scenario(page, 'hotDay');
    await nav(page, 'Control Panel');
    await page.getByTestId('auto-switch').click();
    await expect(page.getByTestId('device-status-fan')).toHaveText('ON', { timeout: 5000 });
    await expect(page.getByTestId('toggle-fan')).toBeDisabled();
  });
});

test.describe('TC-10 Data history and export', () => {
  test('previous readings are stored and can be exported as CSV', async ({ page }) => {
    await loginOk(page);
    await page.waitForTimeout(3000);
    await nav(page, 'History');
    await expect(page.getByTestId('history-table').locator('tbody tr').first()).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid=export-csv]')]);
    const text = readFileSync(await download.path(), 'utf8');
    expect(text.split('\n')[0]).toContain('Temperature (°C)');
    expect(text.trim().split('\n').length).toBeGreaterThan(2);
  });
});

test.describe('TC-11 Settings', () => {
  test('a changed threshold is applied to the alerts', async ({ page }) => {
    await loginOk(page);
    await nav(page, 'Settings');
    await page.fill('[data-testid=th-temperature-max]', '20');
    await page.click('[data-testid=save-settings]');
    await expect(page.getByTestId('settings-message')).toHaveText('Settings saved.');
    await nav(page, 'Dashboard');
    await expect(page.getByTestId('alert-temperature')).toContainText('max 20');
  });
});

test.describe('TC-12 Access control', () => {
  test('pages cannot be opened without logging in, and logout works', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
    await loginOk(page);
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('TC-13 Responsive design', () => {
  test('the dashboard works on a mobile screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginOk(page);
    await nav(page, 'Dashboard');
    await expect(page.getByTestId('value-temperature')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
  });
});
