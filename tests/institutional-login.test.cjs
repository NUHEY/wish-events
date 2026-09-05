const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function setup(env, { linked = false, adminAvailable = true, prepareError = false } = {}) {
 const calls = [];
 const email = 'desk@wish-events.local';
 const record = { id: 'account-id', email, app_metadata: { preserved: true }, user_metadata: { preserved: true } };
 const query = { select(){return this}, eq(){return this}, maybeSingle: async()=>({data:linked?record:null}),
  upsert: async(value)=>{ calls.push(['profile',value]); return {error:null}; } };
 const admin = { from:()=>query, auth:{admin:{
  getUserById: async()=>({data:{user:record},error:null}),
  listUsers: async()=>({data:{users:[]},error:null}),
  createUser: async(value)=>{calls.push(['create',value]);return {data:{user:prepareError?null:record},error:prepareError?{message:'fixture'}:null}},
  updateUserById: async(id,value)=>{calls.push(['update',value]);return {data:{user:record},error:null}}
 }}};
 const clientQuery={select(){return this},eq(){return this},maybeSingle:async()=>({data:null}),insert:async()=>({error:null})};
 const client={from:()=>clientQuery,auth:{signInWithPassword:async(value)=>{
  calls.push(['signIn',value]);return {data:{user:record,session:{access_token:'fixture-token',refresh_token:'fixture-refresh'}},error:null};
 },signOut:async()=>{calls.push(['signOut'])}}};
 const modules={
  'node:crypto':require('node:crypto'),
  '@/lib/supabase/server':{createClient:async()=>client},
  '@/lib/supabase/admin':{createAdminClient:()=>{calls.push(['admin']);return adminAvailable?admin:null}},
  '@/lib/i18n':{getLocale:async()=>'en'},
  '@/lib/institutional-accounts':{institutionalAccountEmail:()=>email,institutionalDisplayName:()=> 'Institution',institutionalAvatarUrl:()=>'/image.svg'}
 };
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/actions/institutional-login.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {exports,require:(id)=>{if(!modules[id])throw Error(id);return modules[id]},process:{env},Buffer,console:{error(){}}});
 return {login:exports.signInInstitutionalAccount,calls};
}
test('invalid type, missing configuration and wrong password cannot reach account administration', async()=>{
 for (const [env,kind,password,code] of [[{},'invalid','x','invalid_request'],[{},'service_desk','x','not_configured'],[{INSTITUTIONAL_SHARED_PASSWORD:'correct'},'service_desk','wrong','invalid_password']]) {
  const h=setup(env);assert.equal((await h.login(kind,password)).code,code);assert.equal(h.calls.length,0);
 }
});
for(const kind of ['service_desk','university_staff']) {
 test(`${kind}: account preparation assigns administrator-controlled account metadata`,async()=>{
  const h=setup({INSTITUTIONAL_SHARED_PASSWORD:'test-password'});
  assert.equal((await h.login(kind,'test-password')).success,true);
  const create=h.calls.find(([name])=>name==='create')[1];
  assert.equal(create.app_metadata.account_kind,kind);
  const profile=h.calls.find(([name])=>name==='profile')[1];
  assert.equal(profile.account_kind,kind);assert.equal(profile.role,'resident');
 });
}
test('shared and dedicated login aliases use one stable Auth password',async()=>{
 for(const password of ['dedicated-password','shared-password']) {
  const h=setup({INSTITUTIONAL_SERVICE_DESK_PASSWORD:'dedicated-password',INSTITUTIONAL_SHARED_PASSWORD:'shared-password'},{linked:true});
  assert.equal((await h.login('service_desk',password)).success,true);
  assert.equal(h.calls.find(([name])=>name==='update')[1].password,'dedicated-password');
  assert.equal(h.calls.find(([name])=>name==='signIn')[1].password,'dedicated-password');
  assert.equal(h.calls.find(([name])=>name==='update')[1].app_metadata.preserved,true);
 }
});
test('failed account preparation stops before attempting sign-in',async()=>{
 const h=setup({INSTITUTIONAL_SHARED_PASSWORD:'test-password'},{prepareError:true});
 assert.equal((await h.login('service_desk','test-password')).code,'account_prepare_failed');
 assert.equal(h.calls.some(([name])=>name==='signIn'),false);
});

test('pre-provisioned accounts without an admin key keep their supplied password',async()=>{
 const h=setup({INSTITUTIONAL_SERVICE_DESK_PASSWORD:'dedicated-password',INSTITUTIONAL_SHARED_PASSWORD:'shared-password'},{adminAvailable:false});
 assert.equal((await h.login('service_desk','shared-password')).success,true);
 assert.equal(h.calls.find(([name])=>name==='signIn')[1].password,'shared-password');
});


test('successful login relies on server cookies and does not return session secrets', async () => {
 const h = setup({INSTITUTIONAL_SHARED_PASSWORD:'test-password'});
 const result = await h.login('service_desk','test-password');
 assert.equal(result.success,true);
 assert.equal(result.accessToken,undefined);
 assert.equal(result.refreshToken,undefined);
});


test('internal account identity does not require a configured email address', () => {
 for (const configured of [undefined, '', '２階生活窓口']) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/institutional-accounts.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,
   {exports,process:{env:{INSTITUTIONAL_SERVICE_DESK_EMAIL:configured}}});
  assert.equal(exports.institutionalAccountEmail('service_desk'),'service-desk@wish-events.local');
  assert.equal(exports.institutionalDisplayName('service_desk'),'２階生活窓口');
  assert.equal(exports.institutionalDisplayName('university_staff'),'早稲田大学学生生活課');
 }
});
