import {test,expect} from '@playwright/test';
import {grantBrowserPlan} from './helpers.js';
import {translate,locales} from '../src/i18n.js';
async function register(page){await page.locator('.auth-top').click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Nome',{exact:true}).fill('Ana');await dialog.getByLabel('Email',{exact:true}).fill('journey-'+Date.now()+'@example.test');await dialog.getByLabel('Palavra-passe',{exact:true}).fill('test-password-123');await dialog.getByRole('button',{name:'Criar conta',exact:true}).click();await expect(dialog).toHaveCount(0);}
test.afterEach(async({page})=>{await page.request.delete('/api/me',{data:{}});});
test('nationality recommendation covers yes, no and unsure, stays in the browser and starts the CCSE study goal',async({page})=>{
 const requests=[];page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r);});await page.goto('/');const block=page.locator('.exam-requirements');await expect(block).toContainText('Que exames precisas?');
 const before=requests.length;await block.getByRole('button',{name:'Sim',exact:true}).click();await expect(block).toContainText('Só precisas do CCSE');await expect(page.locator('.pricing-card.featured h3')).toHaveText('CCSE');
 await block.getByRole('button',{name:'Não',exact:true}).click();await expect(block).toContainText('Precisas do CCSE e do DELE A2');await expect(page.locator('.pricing-card.featured h3')).toHaveText('CCSE + DELE A2');
 await block.getByRole('button',{name:'Não sei',exact:true}).click();await expect(block.locator('details')).toHaveAttribute('open','');await expect(block).toContainText('Guiné Equatorial');await expect(block).toContainText('Confirma sempre os requisitos');expect(requests.length).toBe(before);
 await block.getByRole('button',{name:'Sim',exact:true}).click();await page.reload();await expect(block.getByRole('button',{name:'Sim',exact:true})).toHaveAttribute('aria-pressed','true');
 const sent=page.waitForRequest(r=>r.url().endsWith('/api/auth/register'));await register(page);const body=(await sent).postDataJSON();expect(body.initialGoal).toBe('ccse');expect(body.nationality).toBeUndefined();expect(body.answer).toBeUndefined();
 await grantBrowserPlan(page);await page.getByRole('button',{name:'Plano de estudo',exact:true}).click();await expect(page.getByLabel('Quero preparar',{exact:true})).toHaveValue('ccse');
});
test('complete free offer and nationality selector render in all seven languages at 375px and with localStorage unavailable',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(key==='rumbo-exam-requirements')throw Error('disabled');return get.call(this,key);};Storage.prototype.setItem=function(key,value){if(key==='rumbo-exam-requirements')throw Error('disabled');return set.call(this,key,value);};});await page.goto('/');await expect(page.locator('.free-offer-list li')).toHaveCount(4);
 for(const language of Object.keys(locales)){await page.locator('.language-picker select').selectOption(language);await expect(page.locator('.welcome-closing')).toContainText(translate(language,'freeLessons'));await expect(page.locator('.exam-requirements h2')).toHaveText(translate(language,'whichExams'));await page.locator('.requirements-options button').first().click();await expect(page.locator('.requirements-result')).toContainText(translate(language,'needCCSE'));expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBeFalsy();}
 await page.screenshot({path:'/tmp/rumbo-v05-offer-mobile.png',fullPage:true});
});
test('topic test at the end of a free lesson gives immediate feedback for each question and saves its result',async({page})=>{
 await page.goto('/');await register(page);await page.getByRole('button',{name:'Aulas',exact:true}).click();await page.locator('.lesson-card').first().click();await page.locator('.reader-actions').getByRole('button',{name:'Teste do tema',exact:true}).click();await expect(page.locator('.quiz-page')).toBeVisible();
 const count=await page.locator('.question-dots button').count();expect(count).toBeGreaterThanOrEqual(5);expect(count).toBeLessThanOrEqual(8);
 for(let i=0;i<count;i++){await page.locator('.answer-option').first().click();await page.getByRole('button',{name:'Confirmar resposta',exact:true}).click();await expect(page.locator('.theme-feedback p')).toBeVisible();await expect(page.locator('.answer-option').first()).toBeDisabled();if(i<count-1)await page.getByRole('button',{name:'Seguinte',exact:true}).click();}
 await page.getByRole('button',{name:'Terminar teste',exact:true}).click();await expect(page.locator('.result-hero')).toBeVisible();const progress=await (await page.request.get('/api/progress')).json();expect(progress.results[0].mode).toBe('theme');expect(progress.facts).toHaveLength(5);
});
test('checkout has two independently required boxes and email recovery has a 60 second resend countdown',async({page})=>{
 await page.goto('/');await register(page);await page.getByRole('button',{name:'Planos e subscrição',exact:true}).click();const inputs=page.locator('.checkout-consent input');await expect(inputs).toHaveCount(2);await inputs.first().check();await expect(inputs.nth(1)).not.toBeChecked();await inputs.nth(1).check();await inputs.first().uncheck();await expect(inputs.nth(1)).toBeChecked();await expect(page.locator('.checkout-consent .legal-links button')).toHaveCount(3);
 const me=await (await page.request.get('/api/me')).json();await page.request.post('/api/auth/logout',{data:{}});await page.reload();await page.locator('.visitor-login').click();await page.getByRole('dialog').getByRole('button',{name:'Esqueci-me da palavra-passe',exact:true}).click();await page.getByRole('dialog').getByLabel('Email',{exact:true}).fill(me.user.email);await page.getByRole('button',{name:'Enviar instruções',exact:true}).click();await expect(page.locator('.email-notice')).toContainText('Verifica também o spam');await expect(page.locator('.email-notice button')).toBeDisabled();await expect(page.locator('.email-notice button')).toContainText('Reenviar em');
 // The test clock advances the resend UI without waiting one real minute.
 await page.clock.install();await page.clock.fastForward(61000);await expect(page.locator('.email-notice button')).toBeEnabled();
 // Clean up with a password login; the recovery response never grants a session.
 await page.request.post('/api/auth/login',{data:{email:me.user.email,password:'test-password-123'}});
});
test('free simulations ask for verification and offer resend; the external official manual step can be completed',async({page})=>{
 await page.goto('/');await register(page);await page.getByRole('button',{name:'Testes e prática',exact:true}).click();await page.locator('.practice-card').nth(1).click();await expect(page.locator('.verification-notice')).toContainText('Confirma o teu email para fazer o simulado grátis');await expect(page.locator('.verification-notice button')).toContainText('Reenviar');
 await page.getByRole('button',{name:'Aulas',exact:true}).click();const link=page.locator('.manual-step a').first();await expect(link).toHaveAttribute('target','_blank');await expect(link).toHaveAttribute('href',/cervantes\.es\/.*\.pdf$/);await expect(page.locator('iframe,embed')).toHaveCount(0);await page.locator('.manual-step button').click();await expect(page.locator('.manual-step button')).toHaveText(/Concluída/);await page.reload();await page.getByRole('button',{name:'Aulas',exact:true}).click();await expect(page.locator('.manual-step button')).toBeDisabled();
});

test('Google appears on login and registration only when the server reports configuration',async({page})=>{
 await page.goto('/');await page.locator('.visitor-login').click();await expect(page.locator('.google-login')).toHaveCount(0);await page.locator('.modal-close').click();
 await page.route('**/api/auth/options',route=>route.fulfill({json:{google:true}}));await page.reload();
 for(const selector of ['.visitor-login','.auth-top']){await page.locator(selector).click();await expect(page.locator('.google-login')).toHaveText('Continuar com Google');await expect(page.locator('.google-login')).toHaveAttribute('href',/^\/api\/auth\/google\?/);await page.locator('.modal-close').click();}
});
