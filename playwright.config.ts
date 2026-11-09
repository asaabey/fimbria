import {defineConfig} from '@playwright/test';
const port = Number(process.env.TEST_PORT || 3000);
const baseURL = `http://localhost:${port}`;
export default defineConfig({
  testDir: 'tests/browser',
  use: {baseURL},
  webServer: {
    command: `TEACHER_PASSWORD=browser-test-password DB_PATH=data/browser.sqlite npm run teacher && PORT=${port} PUBLIC_BASE_URL=${baseURL} DB_PATH=data/browser.sqlite npm run dev`,
    url: baseURL + '/api/health',
    reuseExistingServer: false,
  },
});
