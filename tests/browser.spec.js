import { test, expect } from '@playwright/test';
async function createAccount(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Nome', { exact: true }).fill('Rita');
  await modal.getByLabel('Email', { exact: true }).fill(`rita-${Date.now()}@example.test`);
  await modal.getByLabel('Palavra-passe', { exact: true }).fill('test-password-123');
  await modal.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(modal).toHaveCount(0);
}
test.afterEach(async ({ page }) => { await page.request.delete('/api/me', { data: {} }); });
test('account, lesson completion and progress survive page reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await createAccount(page);
  await page.getByRole('button', { name: 'Aulas', exact: true }).click();
  await page.getByRole('button').filter({ hasText: 'A Constituição e os teus direitos' }).click();
  await expect(page.getByRole('heading', { name: 'La Constitución de 1978' })).toBeVisible();
  await page.getByRole('button', { name: 'Concluir aula', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Concluída', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Olá, Rita ☀' })).toBeVisible();
  await expect(page.locator('.stat-value').first()).toContainText('1');
  await page.getByRole('button', { name: 'O meu progresso', exact: true }).click();
  await expect(page.locator('.history-row')).toHaveCount(1);
  expect(errors).toEqual([]);
});
test('initial assessment, server results, writing and history work end to end', async ({ page }) => {
  await createAccount(page);
  await page.getByRole('button', { name: 'Avaliação inicial', exact: true }).click();
  await page.locator('.assessment-step').first().getByRole('button').click();
  await expect(page.locator('.question-box')).toBeVisible();
  for (let index = 0; index < 12; index++) {
    await page.locator('.answer-option').first().click();
    await page.getByRole('button', { name: index === 11 ? 'Terminar teste' : 'Seguinte', exact: true }).click();
  }
  await expect(page.locator('.result-hero')).toBeVisible();
  await expect(page.locator('.answer-review>section')).toHaveCount(12);
  await page.locator('.assessment-followup').getByRole('button', { name: 'Expressão escrita' }).click();
  await page.getByLabel('Expressão escrita', { exact: true }).fill('Hola, amigo. Vivo en Madrid y quiero invitarte a mi casa. Podemos ir al parque y cocinar juntos. Puedes venir en tren. Un abrazo.');
  await page.locator('.self-rubric input').first().check();
  await page.getByRole('button', { name: 'Guardar resposta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Progresso guardado', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'O meu progresso', exact: true }).click();
  await expect(page.locator('.history-row')).toHaveCount(2);
  await expect(page.locator('.history-row').first()).toContainText('Expressão escrita');
});
test('microphone recording is saved and replayable after navigating away', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await createAccount(page);
  await page.getByRole('button', { name: 'Avaliação inicial', exact: true }).click();
  await page.locator('.assessment-step').nth(2).getByRole('button').click();
  await page.getByRole('button', { name: 'Gravar resposta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Parar gravação', exact: true })).toBeVisible();
  await page.waitForTimeout(1300);
  await page.getByRole('button', { name: 'Parar gravação', exact: true }).click();
  await expect(page.locator('.recorded-audio audio')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar resposta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Progresso guardado', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'O meu progresso', exact: true }).click();
  const audio = page.locator('.history-row audio');
  await expect(audio).toHaveCount(1);
  const response = await page.request.get(await audio.getAttribute('src'));
  expect(response.ok()).toBeTruthy(); expect((await response.body()).length).toBeGreaterThan(100);
});
test('seven interface languages and mobile Arabic layout render without overflow', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('.hero')).toBeVisible();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  for (const lang of ['pt-BR', 'en', 'fr', 'de', 'es', 'ar', 'pt-PT']) {
    await page.locator('.language-picker select').selectOption(lang);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('.hero h2')).not.toBeEmpty();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBeFalsy();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.language-picker select').selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBeFalsy();
  await page.screenshot({ path: '/tmp/rumbo-mobile-arabic.png', fullPage: true });
  await page.getByRole('button', { name: 'مساحة الدراسة', exact: true }).click();
  await expect(page.locator('.sidebar')).toHaveClass(/is-open/);
  await page.locator('.sidebar nav').getByRole('button', { name: 'الدروس', exact: true }).click();
  await expect(page.locator('.lesson-grid .lesson-card')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBeFalsy();
  expect(errors).toEqual([]);
});
