import {test,expect} from '@playwright/test';
async function register(page){await page.goto('/');await page.locator('.auth-top').click();const dialog=page.getByRole('dialog');await expect(dialog.locator('.legal-links button')).toHaveCount(3);await dialog.getByLabel('Nome',{exact:true}).fill('Rita');await dialog.getByLabel('Email',{exact:true}).fill('free-'+Date.now()+'@example.test');await dialog.getByLabel('Palavra-passe',{exact:true}).fill('test-password-123');await dialog.getByRole('button',{name:'Criar conta',exact:true}).click();await expect(dialog).toHaveCount(0);}
test.afterEach(async({page})=>{await page.request.delete('/api/me',{data:{}});});
test('visitor header has no app navigation at 375px, including Arabic and legal links',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto('/');await expect(page.locator('.welcome-page')).toBeVisible();await expect(page.locator('.sidebar')).toHaveCount(0);await expect(page.locator('.topbar .brand')).toBeVisible();
 await expect(page.locator('.visitor-login')).toHaveText('Entrar');expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBeFalsy();
 await page.locator('.language-picker select').selectOption('ar');await expect(page.locator('html')).toHaveAttribute('dir','rtl');expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBeFalsy();
 await page.locator('.language-picker select').selectOption('pt-PT');await page.locator('.footer .legal-links button').first().click();await expect(page.locator('.legal-page')).toContainText('[A REVER POR JURISTA]');
});
test('free tools show locks and plan benefits include VAT, cancellation and no AI in the CCSE card',async({page})=>{
 await register(page);await page.getByRole('button',{name:'Testes e prática',exact:true}).click();await expect(page.locator('.practice-card .locked-badge')).toHaveCount(2);
 await page.locator('.practice-card').first().click();await expect(page.locator('.pricing-grid')).toBeVisible();
 const cards=page.locator('.pricing-card');await expect(cards).toHaveCount(3);await expect(cards.nth(0)).toContainText('25 perguntas, 45 min');await expect(cards.nth(0)).not.toContainText('IA');await expect(cards.nth(1)).toContainText('30 correções');await expect(cards.nth(2)).toContainText('Poupas 10 € por mês');
 for(const card of await cards.all()){await expect(card).toContainText('IVA incluído');await expect(card).toContainText('Cancela quando quiseres');}
 await expect(page.locator('.checkout-consent')).toContainText('[A REVER POR JURISTA]');await expect(page.locator('.checkout-consent input')).toHaveCount(2);for(const input of await page.locator('.checkout-consent input').all())await expect(input).not.toBeChecked();
 await page.getByRole('button',{name:'Definições',exact:true}).click();await expect(page.locator('input[type=password]')).toHaveCount(0);await expect(page.locator('.main-content')).not.toContainText('Chave de API');
 const blocked=await page.request.get('/api/exams');expect(blocked.status()).toBe(402);
});
test('replacement of a session informs the learner and opens login',async({page,browser})=>{
 await register(page);
 const me=await (await page.request.get('/api/me')).json();
 const other=await browser.newContext({baseURL:'http://127.0.0.1:4173'});await other.request.post('/api/auth/login',{data:{email:me.user.email,password:'test-password-123'}});
 // The old page still has the old user until a protected request or focus check runs.
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('status')).toContainText('A tua conta foi aberta noutro dispositivo');await other.request.delete('/api/me',{data:{}});await other.close();
});
