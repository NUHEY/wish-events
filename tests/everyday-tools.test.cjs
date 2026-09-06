const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');const fs=require('node:fs');const vm=require('node:vm');
function load(file){ const output={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:output,URL});return output; }
const {splitBill,makeGroups}=load('src/lib/everyday-tools.ts');
const {isSafeNotificationLink}=load('src/lib/notification-links.ts');
test('splits exactly including remainder and invalid inputs',()=>{for(const [total,n] of [[1000,3],[0,2],[99,100],[1200,4]]){const r=splitBill(total,n);assert.equal(r.base*n+r.extra,total);assert(r.extra<n);} assert.equal(splitBill(5,0),null);assert.equal(splitBill(5.2,2),null);assert.equal(splitBill(10,101),null);});
test('group assignment preserves everyone and balances sizes',()=>{const people=['A','B','C','D','E','F','G'];const result=makeGroups(people,3,()=>0.3);assert.equal(result.flat().sort().join(','),people.join(','));assert.equal(people.join(','),'A,B,C,D,E,F,G');assert(Math.max(...result.map(r=>r.length))-Math.min(...result.map(r=>r.length))<=1);assert.equal(makeGroups(people,8).length,0);});
test('notification URLs permit web links and reject executable/ambiguous URLs',()=>{for(const url of ['/','/events?id=abc#details','https://example.com/form?a=1','http://example.com']) assert.equal(isSafeNotificationLink(url),true,url);for(const url of ['javascript:alert(1)','data:text/html,test','//evil.example','/\\evil.example','https://user:pass@example.com','https://example.com\n','https://','/ bad']) assert.equal(isSafeNotificationLink(url),false,url);});
