const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, modules = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('exports','require',code)(exports,id=>{if(!(id in modules))throw new Error(id);return modules[id];});
  return exports;
}
const config=load('src/lib/feature-flag-keys.ts');
const cache=fn=>{const results=new Map();return (...args)=>{const key=JSON.stringify(args);if(!results.has(key))results.set(key,fn(...args));return results.get(key);};};
test('flags share one read and preserve existing public tools until configured',async()=>{
 let reads=0;
 const flags=load('src/lib/feature-flags.ts',{'react':{cache},'@/lib/feature-flag-keys':config,'@/lib/supabase/server':{createClient:async()=>({from:()=>({select:async()=>{reads++;return {data:[{key:'split_bill',state:'hidden'},{key:'world_clock',state:'beta'}],error:null};}})})}});
 assert.deepEqual(await Promise.all(['share_qr','split_bill','world_clock','friend_dm','resident_directory'].map(flags.getFeatureFlagState)),['public','hidden','beta','hidden','public']);
 assert.equal(reads,1);
});
test('unreadable publication settings fail closed even for established utilities',async()=>{
 const flags=load('src/lib/feature-flags.ts',{'react':{cache},'@/lib/feature-flag-keys':config,'@/lib/supabase/server':{createClient:async()=>({from:()=>({select:async()=>({data:null,error:new Error('offline')})})})}});
 assert.equal(await flags.getFeatureFlagState('share_qr'),'hidden');
});
test('all new utilities save with feature permission and invalidate direct routes',async()=>{
 const writes=[],paths=[],permissions=[];
 const actions=load('src/actions/feature-flags.ts',{'@/lib/feature-flag-keys':config,'@/lib/feature-flags':config,'@/lib/management-access':{requireManagement:async key=>{permissions.push(key);return{id:'operator'};}},'next/cache':{revalidatePath:(...args)=>paths.push(args)},'@/lib/supabase/server':{createClient:async()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async row=>{writes.push(row);return{error:null};}})})}});
 for(const key of ['resident_directory','share_qr','split_bill','group_shuffle','world_clock'])assert.equal((await actions.updateFeatureFlag(key,'hidden')).success,true);
 assert.equal(writes.length,5);
 assert.ok(writes.every(row=>row.state==='hidden'&&row.show_on_home===true&&row.updated_by==='operator'));
 assert.ok(permissions.every(p=>p==='features'));
 assert.ok(paths.some(([path,type])=>path==='/tools'&&type==='layout'));
 assert.ok(paths.some(([path])=>path==='/directory'));
 assert.ok((await actions.updateFeatureFlag('unexpected','public')).error);
 assert.equal(writes.length,5);
});
test('hidden utilities deny residents at direct URLs and keep RA previews',async()=>{
 let role='resident',state='hidden';
 const access=load('src/lib/tool-access.ts',{'next/navigation':{notFound:()=>{throw Error('404');}},'@/lib/auth':{getCurrentProfile:async()=>({role})},'@/lib/feature-flags':{getFeatureFlagState:async()=>state}});
 await assert.rejects(access.requirePublishedTool('split_bill'),/404/);
 role='ra';assert.equal((await access.requirePublishedTool('split_bill')).role,'ra');
 role='resident';state='beta';assert.equal((await access.requirePublishedTool('split_bill')).role,'resident');
});
