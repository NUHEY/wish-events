const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function compile(file, modules) {
 const exports = {};
 const source = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require(id){if(!(id in modules)) throw Error(id);return modules[id]},console:{error(){}},Date});
 return exports;
}
const permissions = compile('src/lib/management-permissions.ts',{});
function accessFor(profile, result={data:null,error:null}) {
 let reads=0;
 const query={select(){return this},eq(){return this},maybeSingle:async()=>result};
 const access=compile('src/lib/management-access.ts',{
  react:{cache:fn=>fn},'next/navigation':{redirect:path=>{throw Error('redirect:'+path)}},
  '@/lib/auth':{getCurrentProfile:async()=>profile},
  '@/lib/supabase/server':{createClient:async()=>{reads++;return{from:()=>query}}},
  '@/lib/management-permissions':permissions
 });
 return {access,reads:()=>reads};
}
test('only real active RA receives all management modules without a permissions query',async()=>{
 const h=accessFor({role:'ra',account_kind:'resident'});
 const a=await h.access.getManagementAccess();assert.equal(a.isRa,true);assert.equal(a.permissions.length,12);assert.equal(h.reads(),0);
 assert.equal(permissions.MANAGEMENT_KEYS.includes('ra_rooms'),false);
 assert.equal(permissions.MANAGEMENT_KEYS.includes('permissions'),false);
});
test('residents cannot gain privileges by a fabricated grant row',async()=>{
 const h=accessFor({role:'resident',account_kind:'resident'},{data:{permissions:['events']},error:null});
 assert.equal((await h.access.getManagementAccess()).permissions.length,0);assert.equal(h.reads(),0);
 await assert.rejects(h.access.requireManagement('events'),/access-denied/);
});
test('institutional grants are scoped and unknown keys are discarded',async()=>{
 for(const kind of ['service_desk','university_staff']) {
  const h=accessFor({role:'resident',account_kind:kind},{data:{permissions:['announcements','unknown']},error:null});
  const a=await h.access.getManagementAccess();assert.equal(a.isRa,false);assert.equal(a.permissions.join(','),'announcements');
  assert.equal(permissions.canManage(a,'events'),false);
  assert.equal((await h.access.requireManagement('announcements')).account_kind,kind);
  await assert.rejects(h.access.requireManagement('residents'),/access-denied/);
 }
});
test('missing rows, query errors and malformed RA staff identity fail closed',async()=>{
 for(const result of [{data:null,error:null},{data:{permissions:['events']},error:{code:'network'}}]) {
  const h=accessFor({role:'ra',account_kind:'service_desk'},result);
  assert.equal((await h.access.getManagementAccess()).permissions.length,0);
  await assert.rejects(h.access.requireDashboard(),/redirect:\//);
 }
});
function saving({profile={id:'ra-id',role:'ra',account_kind:'resident'},result={data:{updated_at:'new-time'},error:null}}={}) {
 const calls=[];
 const q={update(v){calls.push(['update',v]);return this},eq(k,v){calls.push(['eq',k,v]);return this},select(){return this},maybeSingle:async()=>result};
 return {calls,action:compile('src/actions/management-permissions.ts',{
  'next/cache':{revalidatePath:(...args)=>calls.push(['revalidate',...args])},
  '@/lib/auth':{requireRa:async()=>{if(profile.role!=='ra')throw Error('forbidden');return profile}},
  '@/lib/supabase/server':{createClient:async()=>({from:()=>q})},
  '@/lib/i18n':{getLocale:async()=>'en'},'@/lib/management-permissions':permissions
 }).saveInstitutionalPermissions};
}
test('saving rejects non-RA, unknown kinds, unknown permissions and institutional RA identity',async()=>{
 const noRa=saving({profile:{role:'resident',account_kind:'resident'}});await assert.rejects(noRa.action('service_desk',['events'],'old'),/forbidden/);assert.equal(noRa.calls.length,0);
 for(const args of [['resident',['events'],'old'],['service_desk',['admin'],'old'],['service_desk','events','old'],['service_desk',['events'],null]]){const h=saving();assert.ok((await h.action(...args)).error);assert.equal(h.calls.length,0)}
 const h=saving({profile:{id:'bad',role:'ra',account_kind:'service_desk'}});assert.ok((await h.action('service_desk',['events'],'old')).error);assert.equal(h.calls.length,0);
});
test('saving deduplicates grants, attributes actor and uses optimistic concurrency',async()=>{
 const h=saving();assert.equal((await h.action('service_desk',['events','events'],'old-time')).success,true);
 const update=h.calls.find(c=>c[0]==='update')[1];assert.equal(update.permissions.join(),'events');assert.equal(update.updated_by,'ra-id');
 assert.ok(h.calls.some(c=>c[0]==='eq'&&c[1]==='account_kind'&&c[2]==='service_desk'));
 assert.ok(h.calls.some(c=>c[0]==='eq'&&c[1]==='updated_at'&&c[2]==='old-time'));
 assert.ok(h.calls.some(c=>c[0]==='revalidate'));
});
test('concurrent updates and database errors cannot report a successful save',async()=>{
 for(const result of [{data:null,error:null},{data:null,error:{code:'42501'}}]) {
  const h=saving({result});assert.ok((await h.action('university_staff',[],'old-time')).error);assert.ok(!h.calls.some(c=>c[0]==='revalidate'));
 }
});
