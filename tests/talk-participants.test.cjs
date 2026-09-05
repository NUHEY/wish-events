const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
function load(file,modules,globals={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>{if(!(id in modules))throw Error(id);return modules[id]},...globals});
 return exports;
}
function actionFixture(registrations,profiles,failedCall){
 const calls=[];
 const {getEventTalkParticipants}=load('src/actions/event-community.ts',{
  'next/cache':{},'next/headers':{},'@/lib/message-cursor':{},'@/lib/management-access':{},'@/lib/management-permissions':{},'@/lib/auth':{},
  '@/lib/supabase/server':{createClient:async()=>({rpc:name=>({returns:async()=>{
   calls.push(name);return {error:failedCall===name?{message:'network'}:null,data:name==='event_registration_user_ids'?registrations:profiles};
  }})})}
 });
 return {get:getEventTalkParticipants,calls};
}
test('participant loading preserves registration order and exact total',async()=>{
 const h=actionFixture([{user_id:'b'},{user_id:'a'}],[{id:'a',full_name:'A'},{id:'b',full_name:'B'}]);
 const result=await h.get('event');assert.equal(result.total,2);assert.deepEqual(Array.from(result.participants,p=>p.id),['b','a']);
});
test('failed or incomplete participant loading raises a retryable page error rather than showing an empty list',async()=>{
 for(const failedCall of ['event_registration_user_ids','event_community_profiles_v3']){
  const h=actionFixture([{user_id:'a'}],[{id:'a'}],failedCall);await assert.rejects(h.get('event'));
 }
 const partial=actionFixture([{user_id:'a'},{user_id:'b'}],[{id:'a'}]);await assert.rejects(partial.get('event'));
 const empty=actionFixture([],[]);assert.equal((await empty.get('event')).total,0);assert.equal(empty.calls.length,1);
});
test('participant dialog portals to body, exposes all names, and restores focus when closed',()=>{
 const body={style:{overflow:'hidden'}},effects=[],states=[];let portaled;
 const jsx=(type,props)=>({type,props});
 const {TalkParticipantsButton}=load('src/components/community/talk-participants-button.tsx',{
  'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'Fragment'},
  react:{useState:()=>[true,value=>states.push(value)],useId:()=> 'participant-title',useRef:()=>({current:null}),useEffect:fn=>effects.push(fn)},
  'react-dom':{createPortal:(node,target)=>{portaled={node,target};return node}},
  'next/image':{},'lucide-react':{},'@/components/community/avatar-stack':{},'@/components/profile/avatar-ring':{},
  '@/lib/media-defaults':{DEFAULT_AVATAR_IMAGE_URL:'/avatar.svg'},
  '@/lib/i18n/locale-provider':{useLocale:()=> 'en',useDict:()=>({common:{close:'Close'},talks:{residentFallback:'Resident'}})}
 },{document:{body}});
 const tree=TalkParticipantsButton({participants:[{id:'a',full_name:'A long participant name',role:'ra',avatar_url:null}],total:1});
 assert.equal(portaled.target,body);
 const nodes=[];function walk(node){if(Array.isArray(node))return node.forEach(walk);if(!node||typeof node!=='object')return;nodes.push(node);walk(node.props?.children)}walk(tree);
 const dialog=nodes.find(n=>n.type==='dialog');assert.equal(dialog.props['aria-labelledby'],'participant-title');
 assert.ok(nodes.find(n=>n.type==='li'));
 const trigger=nodes.find(n=>n.type==='button'&&n.props['aria-haspopup']==='dialog');assert.equal(trigger.props['aria-label'],'Participants (1)');
 let opened=0,closed=0,focused=0;
 dialog.props.ref.current={showModal(){opened++},close(){closed++}};trigger.props.ref.current={focus(){focused++}};
 const cleanup=effects[0]();assert.equal(opened,1);
 dialog.props.onCancel();assert.deepEqual(states,[false]);cleanup();assert.equal(closed,1);assert.equal(focused,1);assert.equal(body.style.overflow,'hidden');
});
