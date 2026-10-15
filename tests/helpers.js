import {DatabaseSync} from 'node:sqlite';
import {aiConfiguration} from '../server/access.js';
export const testAIConfig={...aiConfiguration({}),provider:'openai',key:'test-key-never-store',model:'fixture-model',transcribeModel:'fixture-transcriber'};
// Test-only entitlements; no HTTP endpoint can grant these.
export function grantPlan(db,userId,plan='both',start=Math.floor(Date.now()/1000)-3600,end=Math.floor(Date.now()/1000)+86400*29){
 db.prepare('INSERT OR REPLACE INTO subscriptions(id,user_id,customer_id,plan,status,paid_until,cancel_at_period_end,updated_at,period_start) VALUES (?,?,?,?,?,?,?,?,?)').run('fixture-'+userId,userId,'fixture-customer-'+userId,plan,'active',end,0,new Date().toISOString(),start);
}
export async function grantBrowserPlan(page,plan='both'){
 const response=await page.request.get('/api/me'),{user}=await response.json();
 const db=new DatabaseSync('/tmp/rumbo-e2e/rumbo.sqlite');try{grantPlan(db,user.id,plan);}finally{db.close();}
 await page.reload();
}
