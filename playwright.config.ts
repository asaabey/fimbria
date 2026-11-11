import {defineConfig} from '@playwright/test';
const port = Number(process.env.TEST_PORT || 3000);
const baseURL = `http://localhost:${port}`;
export default defineConfig({
  testDir: 'tests/browser',
  use: {baseURL},
  projects: [
    {name: 'main', testIgnore: /end-all-sessions/},
    // Ends every session on the shared test server, so it must not run alongside other tests.
    {name: 'end-all', testMatch: /end-all-sessions/, dependencies: ['main']},
  ],
  webServer: {
    command: `TEACHER_PASSWORD=browser-test-password DB_PATH=data/browser.sqlite npm run teacher && LOGIN_ATTEMPTS_PER_MINUTE=100 PORT=${port} PUBLIC_BASE_URL=${baseURL} DB_PATH=data/browser.sqlite npm run dev`,
    url: baseURL + '/api/health',
    reuseExistingServer: false,
  },
});
