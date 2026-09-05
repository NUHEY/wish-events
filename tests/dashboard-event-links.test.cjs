const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const jsx=(type,props)=>({type,props});
function load(file,modules={}) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>{if(!(id in modules))throw Error(id);return modules[id]}});
 return exports;
}
const permissions=load('src/lib/management-permissions.ts');
function links(node,result=[]) {
 if(Array.isArray(node))node.forEach(item=>links(item,result));
 else if(node&&typeof node==='object'){if(node.type==='Link')result.push(node);links(node.props?.children,result)}
 return result;
}
function label(node){if(Array.isArray(node))return node.map(label).join('');if(typeof node==='string')return node;return node&&typeof node==='object'?label(node.props?.children):''}
const shared={
 'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'next/link':{default:'Link'},
 'lucide-react':new Proxy({},{get:(_,key)=>String(key)}),
 '@/lib/management-permissions':permissions,
};
function navigation(access,locale='ja'){
 const {DashboardNav}=load('src/components/dashboard/dashboard-nav.tsx',{
  ...shared,react:{useState:()=>[false,()=>{}],useRef:()=>({current:null}),useEffect(){}},
  'next/navigation':{usePathname:()=>'/dashboard'},'@/lib/utils':{cn:()=>''},'@/lib/i18n/locale-provider':{useLocale:()=>locale}
 });
 return links(DashboardNav({access}));
}
test('management menu creation opens the new-event form and list stays a separate link in both languages',()=>{
 for(const [locale,create,list] of [['ja','イベント作成','イベント一覧'],['en','Create event','Event list']]) {
  const items=navigation({isRa:false,permissions:['events']},locale);
  for(const item of items.filter(item=>label(item)===create))assert.equal(item.props.href,'/events/new');
  assert.ok(items.some(item=>label(item)===create&&item.props.href==='/events/new'));
  assert.ok(items.some(item=>label(item)===list&&item.props.href==='/dashboard#managed-events'));
 }
});
test('event links remain hidden without event-management permission and are available to RAs',()=>{
 const denied=navigation({isRa:false,permissions:['schedules']});
 assert.ok(denied.some(item=>item.props.href==='/dashboard/schedules'));
 assert.equal(denied.some(item=>['/events/new','/dashboard#managed-events'].includes(item.props.href)),false);
 const ra=navigation({isRa:true,permissions:[]});assert.ok(ra.some(item=>item.props.href==='/events/new'));
});
test('overview exposes the creation button only to event managers',async()=>{
 for(const allowed of [false,true]) {
  const query={select(){return this},order(){return this},range(){return this},not(){return this},gte(){return this},then(resolve){return Promise.resolve({data:[],count:0,error:null}).then(resolve)}};
  const {default:DashboardPage}=load('src/app/dashboard/page.tsx',{
   ...shared,'@/lib/management-access':{getManagementAccess:async()=>({isRa:false,permissions:allowed?['events']:[]})},
   '@/components/ui/button':{buttonVariants:()=>''},'@/lib/supabase/server':{createClient:async()=>({from:()=>query})},
   '@/components/ui/card':{Card:'Card',CardContent:'CardContent'},'@/components/ui/badge':{},'@/lib/utils':{},'@/components/dashboard/event-actions-menu':{},
   '@/lib/i18n':{getLocale:async()=>'ja',getDictionary:()=>({dashboard:{eventListTitle:'イベント一覧'}})}
  });
  const items=links(await DashboardPage({searchParams:{}}));
  assert.equal(items.some(item=>item.props.href==='/events/new'&&label(item)==='イベント作成'),allowed);
 }
});
