import express from 'express';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';

export const plans = [
  {id:'ccse',modules:['ccse'],amount:1500,currency:'EUR',interval:'month'},
  {id:'dele',modules:['dele'],amount:1500,currency:'EUR',interval:'month'},
  {id:'both',modules:['ccse','dele'],amount:2000,currency:'EUR',interval:'month'}
];
export function billingConfig(env=process.env) {
  return {enabled:env.BILLING_ENABLED==='true',persistent:env.DATA_PERSISTENT==='true',
    secretKey:env.STRIPE_SECRET_KEY || '',webhookSecret:env.STRIPE_WEBHOOK_SECRET || '',
    origin:env.APP_URL || '',prices:{ccse:env.STRIPE_PRICE_CCSE || '',dele:env.STRIPE_PRICE_DELE || '',both:env.STRIPE_PRICE_BOTH || ''}};
}
export function verifySignature(raw,header,secret,now=Date.now()) {
  if(!secret||typeof header!=='string'||!Buffer.isBuffer(raw)) return false;
  const parts=header.split(',').map(part=>part.trim().split('='));
  const timestamp=parts.find(([key])=>key==='t')?.[1];
  if(!/^\d+$/.test(timestamp || '')||Math.abs(now/1000-Number(timestamp))>300) return false;
  const expected=createHmac('sha256',secret).update(timestamp+'.').update(raw).digest();
  return parts.filter(([key])=>key==='v1').some(([,value])=>/^[a-f0-9]{64}$/.test(value||'')&&timingSafeEqual(expected,Buffer.from(value,'hex')));
}

export function installBilling(app,db,{requireUser,config=billingConfig(),requester=fetch}={}) {
  db.exec(`CREATE TABLE IF NOT EXISTS billing_customers(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,customer_id TEXT UNIQUE NOT NULL);
    CREATE TABLE IF NOT EXISTS subscriptions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,customer_id TEXT NOT NULL,plan TEXT,status TEXT NOT NULL,paid_until INTEGER NOT NULL DEFAULT 0,cancel_at_period_end INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS billing_events(id TEXT PRIMARY KEY,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS billing_checkouts(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,session_id TEXT NOT NULL,plan TEXT NOT NULL,url TEXT NOT NULL);`);
  if(!db.prepare('PRAGMA table_info(subscriptions)').all().some(c=>c.name==='period_start'))db.exec('ALTER TABLE subscriptions ADD COLUMN period_start INTEGER NOT NULL DEFAULT 0');
  db.exec(`CREATE TABLE IF NOT EXISTS checkout_consents(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,version TEXT NOT NULL,accepted_at TEXT NOT NULL);`);
  const priceMap=config.prices || {};
  let origin='';
  try {const parsed=new URL(config.origin);if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&parsed.pathname==='/')origin=parsed.origin;}catch{/* missing configuration */}
  const configured=Boolean(config.enabled&&config.persistent&&config.secretKey&&config.webhookSecret&&origin&&plans.every(p=>priceMap[p.id])&&new Set(Object.values(priceMap)).size===3);
  async function stripe(route,method='GET',fields,idem) {
    const response=await requester('https://api.stripe.com/v1'+route,{method,signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+config.secretKey,'Stripe-Version':'2025-06-30.basil',...(fields?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(idem?{'Idempotency-Key':idem}:{})},...(fields?{body:new URLSearchParams(fields).toString()}:{})});
    if(!response.ok)throw new Error('billing_unavailable');
    return response.json();
  }
  function subscriptionRows(userId){return db.prepare('SELECT * FROM subscriptions WHERE user_id=? ORDER BY updated_at DESC').all(userId);}
  function entitled(row){return ['active','trialing'].includes(row.status)&&row.paid_until>Date.now()/1000&&plans.some(p=>p.id===row.plan);}
  function summary(userId){
    const subscriptions=userId?subscriptionRows(userId):[];
    const modules=[...new Set(subscriptions.filter(entitled).flatMap(row=>plans.find(p=>p.id===row.plan).modules))];
    return {plans,checkoutAvailable:configured,modules,subscriptions:subscriptions.map(({id,plan,status,paid_until,cancel_at_period_end})=>({id,plan,status,paidUntil:paid_until?new Date(paid_until*1000).toISOString():null,cancelAtPeriodEnd:Boolean(cancel_at_period_end)})),hasCustomer:Boolean(userId&&db.prepare('SELECT 1 FROM billing_customers WHERE user_id=?').get(userId))};
  }
  function canAccess(userId,lesson){return Boolean(userId)&&(lesson.free||summary(userId).modules.includes(lesson.module));}
  function catalog(lessons,userId){const modules=summary(userId).modules;return lessons.map(({id,module,category,minutes,title,intro,icon,position,free})=>({id,module,category,minutes,title,intro,icon,position,free,locked:!userId||(!free&&!modules.includes(module))}));}
  async function validatePrice(plan){
    const price=await stripe('/prices/'+encodeURIComponent(priceMap[plan.id]));
    if(price.tax_behavior!=='inclusive'||!price.active||price.unit_amount!==plan.amount||price.currency!=='eur'||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1||price.recurring?.usage_type!=='licensed')throw new Error('billing_price_mismatch');
  }
  const syncing=new Map();
  async function syncSubscription(subscriptionId){
    const previous=syncing.get(subscriptionId)||Promise.resolve();
    const current=previous.catch(()=>{}).then(()=>readSubscription(subscriptionId));
    syncing.set(subscriptionId,current);
    try{await current;}finally{if(syncing.get(subscriptionId)===current)syncing.delete(subscriptionId);}
  }
  async function readSubscription(subscriptionId){
    // Always retrieve current provider state: delayed events cannot restore a cancelled plan.
    const subscription=await stripe('/subscriptions/'+encodeURIComponent(subscriptionId));
    const customer=typeof subscription.customer==='string'?subscription.customer:subscription.customer?.id;
    const account=db.prepare('SELECT user_id FROM billing_customers WHERE customer_id=?').get(customer);
    if(!account)return;
    const items=subscription.items?.data || [];
    const item=items.length===1?items[0]:null;
    const price=typeof item?.price==='object'?item.price:null;
    const plan=plans.find(p=>priceMap[p.id]===price?.id);
    const valid=plan&&price.tax_behavior==='inclusive'&&price.unit_amount===plan.amount&&price.currency==='eur'&&price.recurring?.interval==='month'&&price.recurring?.interval_count===1&&item.quantity===1;
    const until=Number(item?.current_period_end || subscription.current_period_end || 0);
    db.prepare(`INSERT INTO subscriptions(id,user_id,customer_id,plan,status,paid_until,cancel_at_period_end,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET plan=excluded.plan,status=excluded.status,paid_until=excluded.paid_until,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=excluded.updated_at`).run(subscription.id,account.user_id,customer,valid?plan.id:null,valid?subscription.status:'invalid',Number.isFinite(until)?until:0,subscription.cancel_at_period_end?1:0,new Date().toISOString());
    db.prepare('UPDATE subscriptions SET period_start=? WHERE id=?').run(Number(item?.current_period_start||subscription.current_period_start||0),subscription.id);
  }
  // Register before the global JSON parser and browser-only CSRF middleware.
  app.post('/api/billing/webhook',express.raw({type:'application/json',limit:'256kb'}),async(req,res)=>{
    if(!configured)return res.status(503).json({error:'billing_unavailable'});
    if(!verifySignature(req.body,req.get('stripe-signature'),config.webhookSecret))return res.status(400).json({error:'invalid_signature'});
    let event;try{event=JSON.parse(req.body.toString('utf8'));}catch{return res.status(400).json({error:'invalid_event'});}
    if(typeof event.id!=='string'||!event.id.startsWith('evt_'))return res.status(400).json({error:'invalid_event'});
    if(db.prepare('SELECT 1 FROM billing_events WHERE id=?').get(event.id))return res.json({received:true});
    try{
      const object=event.data?.object;
      if(event.type?.startsWith('customer.subscription.')&&typeof object?.id==='string')await syncSubscription(object.id);
      if(event.type==='checkout.session.completed'&&typeof object?.subscription==='string')await syncSubscription(object.subscription);
      db.prepare('INSERT OR IGNORE INTO billing_events VALUES (?,?)').run(event.id,new Date().toISOString());
      return res.json({received:true});
    }catch{return res.status(503).json({error:'billing_unavailable'});}
  });
  const busy=new Set();
  function routes(){
    app.get('/api/billing',(req,res)=>res.json(summary(req.user?.id)));
    app.post('/api/billing/checkout',requireUser,async(req,res)=>{
      const plan=plans.find(p=>p.id===req.body.plan);
      if(!plan)return res.status(400).json({error:'invalid_plan'});
      if(!req.user.email_verified_at)return res.status(403).json({error:'email_verification_required'});
      if(req.body.termsAccepted!==true||req.body.immediateAccess!==true)return res.status(400).json({error:'checkout_consent_required'});
      if(!configured)return res.status(503).json({error:'billing_not_ready'});
      db.prepare('INSERT INTO checkout_consents VALUES (?,?,?,?)').run(randomUUID(),req.user.id,'draft-2026-10-15',new Date().toISOString());
      if(busy.has(req.user.id))return res.status(409).json({error:'billing_busy'});
      busy.add(req.user.id);
      try{
        let customer=db.prepare('SELECT customer_id FROM billing_customers WHERE user_id=?').get(req.user.id)?.customer_id;
        if(customer){
          const existing=await stripe('/subscriptions?customer='+encodeURIComponent(customer)+'&status=all&limit=100');
          if(existing.has_more||existing.data.some(s=>!['canceled','incomplete_expired'].includes(s.status)))return res.status(409).json({error:'subscription_exists'});
        }
        await validatePrice(plan);
        if(!customer){
          const created=await stripe('/customers','POST',{'metadata[rumbo_user_id]':req.user.id,email:req.user.email},'rumbo-customer-'+req.user.id);
          customer=created.id;
          db.prepare('INSERT INTO billing_customers VALUES (?,?)').run(req.user.id,customer);
        }
        const pending=db.prepare('SELECT * FROM billing_checkouts WHERE user_id=?').get(req.user.id);
        if(pending){
          const current=await stripe('/checkout/sessions/'+encodeURIComponent(pending.session_id));
          if(current.status==='complete')return res.status(409).json({error:'subscription_exists'});
          if(current.status==='open'){
            if(pending.plan===plan.id)return res.json({url:pending.url});
            await stripe('/checkout/sessions/'+encodeURIComponent(pending.session_id)+'/expire','POST',{});
          }
          db.prepare('DELETE FROM billing_checkouts WHERE user_id=?').run(req.user.id);
        }
        const checkout=await stripe('/checkout/sessions','POST',{mode:'subscription',customer,'line_items[0][price]':priceMap[plan.id],'line_items[0][quantity]':'1',client_reference_id:req.user.id,'subscription_data[metadata][rumbo_user_id]':req.user.id,success_url:origin+'/?billing=success',cancel_url:origin+'/?billing=cancel'},'rumbo-checkout-'+req.user.id+'-'+plan.id+'-'+(pending?.session_id||'first')+'-'+Math.floor(Date.now()/1800000));
        if(typeof checkout.url!=='string'||new URL(checkout.url).origin!=='https://checkout.stripe.com')throw new Error('billing_unavailable');
        db.prepare('INSERT INTO billing_checkouts VALUES (?,?,?,?)').run(req.user.id,checkout.id,plan.id,checkout.url);
        res.json({url:checkout.url});
      }catch(error){res.status(503).json({error:error.message==='billing_price_mismatch'?error.message:'billing_unavailable'});}finally{busy.delete(req.user.id);}
    });
    app.post('/api/billing/portal',requireUser,async(req,res)=>{
      if(!configured)return res.status(503).json({error:'billing_not_ready'});
      const account=db.prepare('SELECT customer_id FROM billing_customers WHERE user_id=?').get(req.user.id);
      if(!account)return res.status(404).json({error:'not_found'});
      try{
        const portal=await stripe('/billing_portal/sessions','POST',{customer:account.customer_id,return_url:origin+'/?billing=return'});
        if(typeof portal.url!=='string'||new URL(portal.url).origin!=='https://billing.stripe.com')throw new Error('billing_unavailable');
        res.json({url:portal.url});
      }catch{res.status(503).json({error:'billing_unavailable'});}
    });
  }
  async function cancelForDeletion(userId){
    if(busy.has(userId))throw new Error('billing_busy');
    busy.add(userId);
    try{
      const customer=db.prepare('SELECT customer_id FROM billing_customers WHERE user_id=?').get(userId);
      if(!customer)return;
      // Stop pending payments before listing subscriptions, including any just completed.
      const pending=db.prepare('SELECT session_id FROM billing_checkouts WHERE user_id=?').get(userId);
      if(pending){const session=await stripe('/checkout/sessions/'+encodeURIComponent(pending.session_id));if(session.status==='open')await stripe('/checkout/sessions/'+encodeURIComponent(pending.session_id)+'/expire','POST',{});}
      const all=await stripe('/subscriptions?customer='+encodeURIComponent(customer.customer_id)+'&status=all&limit=100');
      if(all.has_more)throw new Error('billing_unavailable');
      for(const sub of all.data)if(!['canceled','incomplete_expired'].includes(sub.status))await stripe('/subscriptions/'+encodeURIComponent(sub.id),'DELETE');
    }finally{busy.delete(userId);}
  }
  return {routes,canAccess,catalog,summary,cancelForDeletion};
}
