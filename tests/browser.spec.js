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
  await expect(page.locator('.lesson-grid .lesson-card')).toHaveCount(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBeFalsy();
  expect(errors).toEqual([]);
});
test('study plan recalculates and spaced review survives navigation',async({page})=>{
 await createAccount(page);await page.getByRole('button',{name:'Plano de estudo',exact:true}).first().click();
 await expect(page.locator('.forecast-card h2')).toBeVisible();const before=Number((await page.locator('.forecast-card h2').innerText()).split('–')[0]);
 await page.getByLabel('Sessões por semana',{exact:true}).selectOption('6');await page.getByLabel('Minutos por sessão',{exact:true}).selectOption('60');
 await page.locator('.plan-form').getByRole('button',{name:'Guardar',exact:true}).click();
 await expect.poll(async()=>Number((await page.locator('.forecast-card h2').innerText()).split('–')[0])).toBeLessThan(before);
 await page.screenshot({path:'/tmp/rumbo-study-plan.png',fullPage:true});
 await page.getByRole('button',{name:'Revisão inteligente',exact:true}).click();await expect(page.locator('.flashcard h2')).toBeVisible();const word=await page.locator('.flashcard h2').innerText();
 await page.getByRole('button',{name:'Ver resposta',exact:true}).click();await expect(page.locator('.flashcard-answer')).toBeVisible();await page.getByRole('button',{name:'Lembrei-me',exact:true}).click();
 await expect(page.locator('.flashcard h2')).not.toHaveText(word);
 await page.getByRole('button',{name:'O meu progresso',exact:true}).click();await expect(page.locator('.competency-card')).toHaveCount(8);
 await page.reload();await page.getByRole('button',{name:'Plano de estudo',exact:true}).first().click();await expect(page.getByLabel('Sessões por semana',{exact:true})).toHaveValue('6');
 await page.setViewportSize({width:390,height:844});await page.locator('.language-picker select').selectOption('ar');expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBeFalsy();
});
test('full DELE model resumes answers and covers all five timed stages',async({page})=>{
 page.on('dialog',dialog=>dialog.accept());await createAccount(page);
 await page.getByRole('button',{name:'Testes e prática',exact:true}).click();await page.locator('.module-tabs').getByRole('button',{name:'DELE A2',exact:true}).click();await page.locator('.full-exam-banner').getByRole('button',{name:'Começar agora',exact:true}).click();
 await page.getByRole('button',{name:'Começar percurso completo',exact:true}).click();await expect(page.locator('.official-answer-grid fieldset')).toHaveCount(5);
 const saved=page.waitForResponse(r=>r.url().endsWith('/answers')&&r.request().method()==='PATCH'&&r.status()===200);await page.locator('.official-answer-grid fieldset').first().getByRole('radio',{name:'C',exact:true}).check();await saved;
 await page.reload();await page.getByRole('button',{name:'Testes e prática',exact:true}).click();await page.locator('.module-tabs').getByRole('button',{name:'DELE A2',exact:true}).click();await page.locator('.full-exam-banner').getByRole('button').click();await page.getByRole('button',{name:'Continuar percurso',exact:true}).click();await expect(page.locator('.official-answer-grid fieldset').first().getByRole('radio',{name:'C',exact:true})).toBeChecked();
 await page.getByRole('button',{name:'Terminar esta parte',exact:true}).click();await expect(page.locator('.natural-audio audio')).toHaveAttribute('src',/A2_0220_CA_Audio_T1.mp3/);await page.locator('.exam-task-tabs button').nth(3).click();await expect(page.locator('.official-answer-grid fieldset')).toHaveCount(7);await expect(page.locator('.official-answer-grid fieldset').first().getByRole('radio',{name:'K',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Terminar esta parte',exact:true}).click();await expect(page.getByLabel('Expressão escrita',{exact:true})).toBeVisible();await page.getByLabel('Expressão escrita',{exact:true}).fill('Hola, amigo. Vivo en una ciudad muy bonita. Trabajo en una tienda y comparto casa con dos personas muy amables. Me gusta mucho vivir aquí. Puedes visitarme el próximo fin de semana. Un abrazo.');await page.getByRole('button',{name:'Guardar resposta',exact:true}).click();await expect(page.getByRole('button',{name:'Progresso guardado',exact:true})).toBeDisabled();
 await page.locator('.exam-task-tabs button').nth(1).click();await expect(page.getByLabel('Expressão escrita',{exact:true})).toHaveValue('');await page.locator('.exam-task-tabs button').first().click();await expect(page.getByLabel('Expressão escrita',{exact:true})).toHaveValue(/Hola, amigo\./);
 await page.getByRole('button',{name:'Terminar esta parte',exact:true}).click();await expect(page.locator('.oral-preparation')).toBeVisible();await page.getByRole('button',{name:'Terminar esta parte',exact:true}).click();await page.locator('.exam-task-tabs button').nth(1).click();await expect(page.locator('.task-prompt a')).toHaveAttribute('href',/T2_T3.pdf/);await page.getByRole('button',{name:'Terminar esta parte',exact:true}).click();await expect(page.locator('.model-scores>div')).toHaveCount(2);await expect(page.locator('.official-response-list .history-row')).toHaveCount(5);
});
test('tutor UI sends explicit consent and keeps a simulated API key only in memory',async({page})=>{
 await createAccount(page);await page.getByRole('button',{name:'Tutor de espanhol',exact:true}).click();
 await page.getByLabel('Chave de API',{exact:true}).fill('test-ui-key-not-a-real-secret');await page.locator('.settings-card').getByRole('button',{name:'Guardar',exact:true}).click();
 await page.route('**/api/tutor/chat',async route=>{const body=route.request().postDataJSON();expect(body.consent).toBe(true);expect(body.key).toBe('test-ui-key-not-a-real-secret');await route.fulfill({json:{id:'mock-conversation',mode:'conversation',messages:[{role:'user',content:body.message},{role:'assistant',content:{reply:'¡Muy bien! Vamos a practicar.',correction:'Usa «fui» para hablar de ayer.',question:'¿Con quién fuiste?',focus:'Pasado'}}]}});});
 await page.locator('.tutor-form textarea').fill('Ayer voy al parque.');await page.locator('.tutor-form input[type=checkbox]').check();await page.getByRole('button',{name:'Enviar ao tutor',exact:true}).click();await expect(page.locator('.tutor-question')).toHaveText('¿Con quién fuiste?');expect(await page.evaluate(()=>JSON.stringify(localStorage).includes('test-ui-key-not-a-real-secret'))).toBeFalsy();
 await page.reload();await page.getByRole('button',{name:'Tutor de espanhol',exact:true}).click();await expect(page.getByLabel('Chave de API',{exact:true})).toHaveValue('');
});
