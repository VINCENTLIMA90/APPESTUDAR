import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server/app.js';
import {lessons} from '../server/content.js';
import {verifySignature} from '../server/billing.js';

const configuration={enabled:true,persistent:true,secretKey:'sk_test_fixture',webhookSecret:'whsec_fixture',origin:'https://study.example.test',prices:{ccse:'price_ccse',dele:'price_dele',both:'price_both'}};
async function fixture(t,overrides={}){
  const directory=mkdtempSync(path.join(tmpdir(),'rumbo-billing-'));
  const state={requests:[],subscriptions:new Map(),sessions:new Map(),priceAmount:null,fail:false};
  async function provider(url,options={}){
    const parsed=new URL(url),route=parsed.pathname.replace('/v1',''),method=options.method||'GET',fields=new URLSearchParams(options.body);
    state.requests.push({route,method,fields});
    assert.equal(parsed.origin,'https://api.stripe.com');
    if(state.fail)return new Response('{}',{status:503});
    let result;
    if(route.startsWith('/prices/')){const id=route.split('/').at(-1);result={id,active:true,unit_amount:state.priceAmount??(id==='price_both'?2000:1500),currency:'eur',recurring:{interval:'month',interval_count:1,usage_type:'licensed'}};}
    else if(route==='/customers'&&method==='POST')result={id:'cus_'+state.requests.length};
    else if(route==='/subscriptions')result={data:[...state.subscriptions.values()].filter(s=>s.customer===parsed.searchParams.get('customer')),has_more:false};
    else if(route.startsWith('/subscriptions/')){result=state.subscriptions.get(route.split('/').at(-1));if(method==='DELETE')result.status='canceled';}
    else if(route==='/checkout/sessions'&&method==='POST'){const id='cs_'+state.requests.length;result={id,status:'open',url:'https://checkout.stripe.com/c/pay/'+id};state.sessions.set(id,result);}
    else if(route.startsWith('/checkout/sessions/')){const id=route.split('/')[3];result=state.sessions.get(id);if(route.endsWith('/expire'))result.status='expired';}
    else if(route==='/billing_portal/sessions')result={url:'https://billing.stripe.com/p/session/test'};
    else throw new Error('Unexpected Stripe call '+method+' '+route);
    assert.ok(result,'Stripe fixture must handle '+route);
    return new Response(JSON.stringify(result),{headers:{'content-type':'application/json'}});
  }
  const runtime=createApp({dataDir:directory,secure:false,billingConfig:{...configuration,...overrides},billingFetch:provider});
  const server=await new Promise(resolve=>{const listener=runtime.app.listen(0,'127.0.0.1',()=>resolve(listener));});
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));runtime.db.close();rmSync(directory,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+server.address().port;
  async function request(route,{body,cookie,method,headers={}}={}){
    const response=await fetch(base+'/api'+route,{method:method||(body===undefined?'GET':'POST'),headers:{...(body===undefined?{}:{'content-type':'application/json'}),...(cookie?{cookie}:{}),...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  async function account(email='learner@example.test'){const registered=await request('/auth/register',{body:{name:'Learner',email,password:'a-strong-test-password',language:'pt-PT'}});assert.equal(registered.status,201);return {id:registered.data.user.id,cookie:registered.cookie};}
  function subscription(user,plan='ccse',status='active',until=Math.floor(Date.now()/1000)+86400){
    const customer='cus_'+user.id,id='sub_'+user.id;
    runtime.db.prepare('INSERT OR REPLACE INTO billing_customers VALUES (?,?)').run(user.id,customer);
    const record={id,customer,status,cancel_at_period_end:false,items:{data:[{quantity:1,current_period_end:until,price:{id:configuration.prices[plan],unit_amount:plan==='both'?2000:1500,currency:'eur',recurring:{interval:'month',interval_count:1}}}]}};
    state.subscriptions.set(id,record);return record;
  }
  async function webhook(object,type='customer.subscription.updated',id='evt_'+Math.random().toString(16).slice(2)){
    const body=JSON.stringify({id,type,data:{object}}),timestamp=Math.floor(Date.now()/1000);
    const signature=createHmac('sha256',configuration.webhookSecret).update(timestamp+'.'+body).digest('hex');
    return request('/billing/webhook',{body,headers:{'stripe-signature':`t=${timestamp},v1=${signature}`}});
  }
  return {runtime,state,request,account,subscription,webhook};
}

test('48 lessons have seven titles; only c1, c2, d1 and d2 are free, and the catalogue cannot leak paid content',async t=>{
  const {request,account,runtime}=await fixture(t);
  const catalog=(await request('/catalog')).data;
  assert.equal(catalog.lessons.length,48);
  assert.deepEqual(catalog.lessons.filter(l=>l.free).map(l=>l.id),['c1','c2','d1','d2']);
  for(const module of ['ccse','dele'])assert.equal(catalog.lessons.filter(l=>l.module===module).length,24);
  for(const lesson of catalog.lessons){assert.equal(Object.keys(lesson.title).length,7);for(const field of ['sections','takeaway','activity','checkpoints'])assert.equal(lesson[field],undefined);}
  for(const id of ['c1','c2','d1','d2'])assert.equal((await request('/lessons/'+id)).status,200);
  assert.equal((await request('/lessons/c3')).status,402);
  const user=await account();
  assert.equal((await request('/lessons/c3/complete',{cookie:user.cookie,body:{paid:true,plan:'both'}})).status,402);
  assert.equal(runtime.db.prepare('SELECT COUNT(*) n FROM completions').get().n,0);
  assert.equal(lessons.filter(l=>l.activity).length,32);
  for(const lesson of lessons.filter(l=>l.activity)){assert.equal(lesson.sections.length,3);assert.ok(lesson.activity.instruction.length>50);assert.ok(lesson.checkpoints.length);}
});
test('verified single-module and combined subscriptions enforce ownership, expiry and cancellation',async t=>{
  const {request,account,subscription,webhook}=await fixture(t);
  const alice=await account(),bob=await account('bob@example.test');
  const sub=subscription(alice);
  assert.equal((await webhook(sub)).status,200);
  assert.equal((await request('/lessons/c24',{cookie:alice.cookie})).status,200);
  assert.equal((await request('/lessons/d24',{cookie:alice.cookie})).status,402);
  assert.equal((await request('/lessons/c24',{cookie:bob.cookie})).status,402);
  sub.cancel_at_period_end=true;
  await webhook(sub);
  assert.equal((await request('/lessons/c24',{cookie:alice.cookie})).status,200);
  assert.equal((await request('/billing',{cookie:alice.cookie})).data.subscriptions[0].cancelAtPeriodEnd,true);
  for(const status of ['past_due','unpaid','canceled','incomplete']){sub.status=status;await webhook(sub);assert.equal((await request('/lessons/c24',{cookie:alice.cookie})).status,402);}
  sub.status='active';sub.items.data[0].current_period_end=Math.floor(Date.now()/1000)-10;await webhook(sub);
  assert.equal((await request('/lessons/c24',{cookie:alice.cookie})).status,402);
  const both=subscription(alice,'both');await webhook(both);
  assert.equal((await request('/lessons/d24',{cookie:alice.cookie})).status,200);
  assert.equal((await request('/lessons/c24/complete',{cookie:alice.cookie,body:{}})).status,200);
});
test('billing cannot start without persistent storage or enabled provider configuration',async t=>{
  const {request,account,state}=await fixture(t,{persistent:false});const user=await account();
  assert.equal((await request('/billing')).data.checkoutAvailable,false);
  const response=await request('/billing/checkout',{cookie:user.cookie,body:{plan:'both'}});
  assert.equal(response.status,503);assert.equal(response.data.error,'billing_not_ready');assert.equal(state.requests.length,0);
});
test('checkout uses fixed server prices, reuses pending sessions and expires a replaced session',async t=>{
  const {request,account,state}=await fixture(t);const user=await account();
  const first=await request('/billing/checkout',{cookie:user.cookie,body:{plan:'both',amount:1,success_url:'https://evil.test'}});
  assert.equal(first.status,200);assert.match(first.data.url,/^https:\/\/checkout.stripe.com\//);
  const fields=state.requests.find(r=>r.route==='/checkout/sessions'&&r.method==='POST').fields;
  assert.equal(fields.get('line_items[0][price]'),'price_both');assert.equal(fields.get('mode'),'subscription');assert.equal(fields.get('success_url'),'https://study.example.test/?billing=success');
  assert.equal((await request('/lessons/c3',{cookie:user.cookie})).status,402);
  const second=await request('/billing/checkout',{cookie:user.cookie,body:{plan:'both'}});assert.equal(second.data.url,first.data.url);
  const changed=await request('/billing/checkout',{cookie:user.cookie,body:{plan:'dele'}});assert.equal(changed.status,200);assert.notEqual(changed.data.url,first.data.url);
  assert.equal([...state.sessions.values()].filter(s=>s.status==='open').length,1);
  assert.equal((await request('/billing/checkout',{cookie:user.cookie,body:{plan:'invented'}})).status,400);
});
test('price mismatch and provider errors do not create checkout sessions',async t=>{
  const {request,account,state}=await fixture(t);const user=await account();state.priceAmount=9900;
  const mismatch=await request('/billing/checkout',{cookie:user.cookie,body:{plan:'both'}});
  assert.equal(mismatch.status,503);assert.equal(mismatch.data.error,'billing_price_mismatch');assert.equal(state.sessions.size,0);
  state.fail=true;assert.equal((await request('/billing/checkout',{cookie:user.cookie,body:{plan:'ccse'}})).status,503);assert.equal(state.sessions.size,0);
});
test('webhooks reject tampering and replays, are idempotent and retrieve the latest provider state',async t=>{
  const {request,account,subscription,webhook,state,runtime}=await fixture(t);const user=await account();const sub=subscription(user);
  assert.equal((await request('/billing/webhook',{body:'{}',headers:{'stripe-signature':'t=1,v1=bad'}})).status,400);
  assert.equal((await request('/lessons/c3',{cookie:user.cookie})).status,402);
  await webhook(sub,'customer.subscription.updated','evt_unique');const before=state.requests.length;
  await webhook(sub,'customer.subscription.updated','evt_unique');assert.equal(state.requests.length,before);
  sub.status='canceled';
  await webhook({...sub,status:'active'}); // A delayed active event must not overwrite current cancellation.
  assert.equal((await request('/lessons/c3',{cookie:user.cookie})).status,402);
  const invalid=subscription(user);invalid.items.data[0].price.unit_amount=1;await webhook(invalid);
  assert.equal((await request('/lessons/c3',{cookie:user.cookie})).status,402);
  assert.equal(runtime.db.prepare('SELECT status FROM subscriptions WHERE user_id=?').get(user.id).status,'invalid');
  const raw=Buffer.from('{}'),stamp=Math.floor(Date.now()/1000)-600;
  const signed=createHmac('sha256',configuration.webhookSecret).update(stamp+'.').update(raw).digest('hex');
  assert.equal(verifySignature(raw,`t=${stamp},v1=${signed}`,configuration.webhookSecret),false);
  assert.equal(verifySignature(Buffer.from('{"changed":true}'),`t=${stamp},v1=${signed}`,configuration.webhookSecret),false);
  const fresh=Math.floor(Date.now()/1000),freshSignature=createHmac('sha256',configuration.webhookSecret).update(fresh+'.').update(raw).digest('hex');
  assert.equal(verifySignature(raw,`t=${fresh},v1=${freshSignature}`,configuration.webhookSecret),true);
  assert.equal(verifySignature(Buffer.from('{"changed":true}'),`t=${fresh},v1=${freshSignature}`,configuration.webhookSecret),false);
});
test('a failed webhook is retried and an existing subscription cannot be purchased again',async t=>{
  const {request,account,subscription,webhook,state}=await fixture(t);const user=await account();const sub=subscription(user,'dele');state.fail=true;
  assert.equal((await webhook(sub,'customer.subscription.created','evt_retry')).status,503);state.fail=false;
  assert.equal((await webhook(sub,'customer.subscription.created','evt_retry')).status,200);
  assert.equal((await request('/lessons/d3',{cookie:user.cookie})).status,200);
  const duplicate=await request('/billing/checkout',{cookie:user.cookie,body:{plan:'both'}});assert.equal(duplicate.status,409);assert.equal(duplicate.data.error,'subscription_exists');
  assert.equal((await request('/billing/portal',{cookie:user.cookie,body:{}})).status,200);
});
test('account deletion cancels provider subscriptions; a provider failure preserves the account',async t=>{
  const {request,account,subscription,webhook,state,runtime}=await fixture(t);const user=await account();const sub=subscription(user,'both');await webhook(sub);
  state.fail=true;const failure=await request('/me',{cookie:user.cookie,method:'DELETE',body:{}});assert.equal(failure.status,503);assert.equal(failure.data.error,'billing_delete_failed');assert.equal((await request('/me',{cookie:user.cookie})).data.user.id,user.id);
  state.fail=false;assert.equal((await request('/me',{cookie:user.cookie,method:'DELETE',body:{}})).status,200);assert.equal(sub.status,'canceled');assert.equal(runtime.db.prepare('SELECT COUNT(*) n FROM subscriptions').get().n,0);
});
test('deleting an account expires its unpaid checkout before removing its data',async t=>{
  const {request,account,state}=await fixture(t);const user=await account();
  assert.equal((await request('/billing/checkout',{cookie:user.cookie,body:{plan:'ccse'}})).status,200);
  assert.equal((await request('/me',{cookie:user.cookie,method:'DELETE',body:{}})).status,200);
  assert.equal([...state.sessions.values()][0].status,'expired');
  const expiration=state.requests.findIndex(r=>r.route.endsWith('/expire'));
  const list=state.requests.findIndex(r=>r.route==='/subscriptions');assert.ok(expiration<list);
});
