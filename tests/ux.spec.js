import {test,expect} from '@playwright/test';
import {locales,translate} from '../src/i18n.js';

async function register(page){
  await page.locator('.auth-top').click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Nome',{exact:true}).fill('Rita');
  await dialog.getByLabel('Email',{exact:true}).fill(`ux-${Date.now()}@example.test`);
  await dialog.getByLabel('Palavra-passe',{exact:true}).fill('test-password-123');
  await dialog.getByRole('button',{name:'Criar conta',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.stats-grid')).toBeVisible();
}
test.afterEach(async({page})=>{await page.request.delete('/api/me',{data:{}});});

async function readable(page,minimum){
  const issues=await page.evaluate(minimum=>{
    const rgb=value=>(value.match(/[\d.]+/g)||[]).map(Number);
    const luminance=values=>values.slice(0,3).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
    const blend=(front,back,alpha=front[3]??1)=>front.slice(0,3).map((n,i)=>n*alpha+back[i]*(1-alpha));
    const failures=[];let checked=0;
    const walker=document.createTreeWalker(document.querySelector('main'),NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const node=walker.currentNode,element=node.parentElement,text=node.textContent.trim();
      if(!text||element.closest('svg,.brand,.hero-stamp,.assessment-decoration,[disabled]'))continue;
      const style=getComputedStyle(element),range=document.createRange();range.selectNodeContents(node);
      if(!range.getBoundingClientRect().width||!range.getBoundingClientRect().height||style.visibility!=='visible')continue;
      const ancestors=[];for(let current=element;current;current=current.parentElement)ancestors.unshift(current);
      let background=[255,255,255],opacity=1;
      for(const ancestor of ancestors){const s=getComputedStyle(ancestor);background=blend(rgb(s.backgroundColor),background);opacity*=Number(s.opacity);}
      const foreground=blend(rgb(style.color),background,(rgb(style.color)[3]??1)*opacity);
      const a=luminance(foreground),b=luminance(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      checked++;
      if(parseFloat(style.fontSize)<minimum||ratio<4.5)failures.push({text:text.slice(0,65),size:style.fontSize,ratio:Number(ratio.toFixed(2)),color:style.color});
    }
    return {checked,failures};
  },minimum);
  expect(issues.checked).toBeGreaterThan(15);
  expect(issues.failures).toEqual([]);
}

test('visitors see benefits, informational prices and FAQ; every plan opens registration without checkout',async({page})=>{
  const payments=[];page.on('request',request=>{if(request.url().includes('/billing/checkout'))payments.push(request.url());});
  await page.goto('/');await expect(page.locator('.welcome-page')).toBeVisible();
  await expect(page.locator('h1')).toContainText('nacionalidade espanhola');
  await expect(page.locator('.stats-grid')).toHaveCount(0);
  await expect(page.locator('.welcome-benefit')).toHaveCount(4);
  await expect(page.locator('.plan-price strong')).toHaveText(['15 €','15 €','20 €']);
  for(const button of await page.locator('.pricing-card button').all()){
    await button.click();await expect(page.getByRole('dialog').getByRole('heading',{name:'Criar conta',exact:true})).toBeVisible();
    await page.locator('.modal-close').click();
  }
  await page.getByRole('button',{name:'Já tenho conta',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Entrar',exact:true})).toBeVisible();await page.locator('.modal-close').click();
  await page.locator('.welcome-faq summary').last().click();
  await expect(page.locator('.welcome-faq details').last()).toContainText('Não é uma app oficial do Instituto Cervantes');
  await readable(page,15);expect(payments).toEqual([]);
  await page.screenshot({path:'/tmp/rumbo-ux-welcome-desktop.png',fullPage:true});
});

test('signed-in dashboard, module cards and catalogue use the same response for lesson totals',async({page})=>{
  await page.route('**/api/catalog',async route=>{
    const response=await route.fetch(),data=await response.json();
    data.lessons=[...data.lessons.filter(l=>l.module==='ccse').slice(0,3),...data.lessons.filter(l=>l.module==='dele').slice(0,2)];
    await route.fulfill({json:data});
  });
  await page.goto('/');await register(page);
  await expect(page.locator('.welcome-page')).toHaveCount(0);
  await expect(page.locator('.stat-card')).toHaveCount(3);
  await expect(page.locator('.stat-subtitle').first()).toHaveText('de 5 aulas no percurso');
  await expect(page.locator('.stat-card').nth(1)).toContainText('Faz o teu primeiro teste');
  await expect(page.locator('.module-card.ccse .module-progress')).toContainText('0 / 3');
  await expect(page.locator('.module-card.dele .module-progress')).toContainText('0 / 2');
  await expect(page.getByText('Pequenos passos, grandes mudanças',{exact:true})).toHaveCount(1);
  await expect(page.getByText('Pequenos passos, grandes mudanças',{exact:true})).toBeVisible();
  for(const label of await page.locator('.stat-label').all())expect(await label.evaluate(el=>el.getBoundingClientRect().height<parseFloat(getComputedStyle(el).fontSize)*2)).toBeTruthy();
  await readable(page,15);
  await page.locator('.module-card.ccse').click();await expect(page.locator('.course-overview strong')).toHaveText('3 aulas · CCSE');await expect(page.locator('.lesson-card')).toHaveCount(3);
  await page.locator('.module-tabs').getByRole('button',{name:'DELE A2',exact:true}).click();await expect(page.locator('.course-overview strong')).toHaveText('2 aulas · DELE A2');await expect(page.locator('.lesson-card')).toHaveCount(2);
});

test('375px presentation and dashboard stay readable in seven languages and Arabic RTL, without a blank gap',async({page})=>{
  await page.setViewportSize({width:375,height:812});await page.goto('/');
  for(const language of Object.keys(locales)){
    await page.locator('.language-picker select').selectOption(language);
    await expect(page.locator('.welcome-page h1')).toHaveText(translate(language,'welcomeTitle'));
    await expect(page.locator('html')).toHaveAttribute('dir',language==='ar'?'rtl':'ltr');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBeFalsy();
    await readable(page,14);
  }
  await page.locator('.language-picker select').selectOption('pt-PT');await page.screenshot({path:'/tmp/rumbo-ux-welcome-375.png',fullPage:true});
  await register(page);
  await expect(page.locator('.assessment-card')).toBeVisible();await expect(page.locator('.official-mini')).toBeVisible();
  const gap=await page.evaluate(()=>document.querySelector('.dashboard-rail').getBoundingClientRect().top-document.querySelector('.recommended-list').getBoundingClientRect().bottom);
  expect(gap).toBeGreaterThanOrEqual(16);expect(gap).toBeLessThanOrEqual(32);
  await readable(page,14);await page.screenshot({path:'/tmp/rumbo-ux-dashboard-375.png',fullPage:true});
  await page.locator('.language-picker select').selectOption('ar');await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBeFalsy();await readable(page,14);
  await page.screenshot({path:'/tmp/rumbo-ux-dashboard-arabic-375.png',fullPage:true});
});

test('exam date uses the existing study plan, survives reload and follows Madrid calendar days',async({page})=>{
  await page.goto('/');await register(page);
  await page.locator('.exam-countdown').getByRole('button',{name:'Define a data do teu exame',exact:true}).click();
  const target=await page.evaluate(()=>{const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+9);return date.toISOString().slice(0,10);});
  await page.getByLabel('Data do exame (opcional)',{exact:true}).fill(target);
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/plan')&&r.request().method()==='PUT'&&r.status()===200);
  await page.locator('.plan-form').getByRole('button',{name:'Guardar',exact:true}).click();await saved;
  await page.reload();await expect(page.locator('.exam-countdown h2')).toHaveText('Faltam 9 dias para o teu exame');
  // At 23:30 UTC two UTC dates before the target, Madrid is already one calendar day before it.
  await page.clock.setFixedTime(new Date(Date.parse(target+'T00:00:00Z')-24.5*3600000));
  await page.reload();await expect(page.locator('.exam-countdown h2')).toHaveText('Falta 1 dia para o teu exame');
  await page.clock.setFixedTime(new Date(target+'T12:00:00Z'));await page.reload();await expect(page.locator('.exam-countdown h2')).toHaveText('O teu exame é hoje');
  await page.clock.setFixedTime(new Date(Date.parse(target+'T12:00:00Z')+86400000));await page.reload();await expect(page.locator('.exam-countdown h2')).toHaveText('A data do teu exame já passou');
  await page.locator('.exam-countdown button').click();await page.getByLabel('Data do exame (opcional)',{exact:true}).fill('');
  const cleared=page.waitForResponse(r=>r.url().endsWith('/api/plan')&&r.request().method()==='PUT'&&r.status()===200);await page.locator('.plan-form').getByRole('button',{name:'Guardar',exact:true}).click();await cleared;
  await page.reload();await expect(page.locator('.exam-countdown h2')).toHaveText('Define a data do teu exame');
});
