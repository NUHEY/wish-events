const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const ts=require('typescript');
function load(file,modules={},globals={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:id=>{if(!(id in modules))throw Error(id);return modules[id]},...globals});return exports;
}
test('motion boot follows the OS initially and preserves the saved browser choice',()=>{
 const {motionInitScript}=load('src/lib/motion.ts');
 for(const [saved,os,expected] of [[null,true,'reduce'],[null,false,'full'],['true',false,'reduce'],['false',true,'full'],['invalid',true,'reduce']]){
  const document={documentElement:{dataset:{}}};
  vm.runInNewContext(motionInitScript,{document,localStorage:{getItem:()=>saved},window:{matchMedia:()=>({matches:os})}});
  assert.equal(document.documentElement.dataset.motion,expected);
 }
 const document={documentElement:{dataset:{}}};
 vm.runInNewContext(motionInitScript,{document,localStorage:{getItem:()=>{throw Error('blocked')}},window:{matchMedia:()=>({matches:true})}});
 assert.equal(document.documentElement.dataset.motion,'reduce');
});
test('motion setting immediately updates browser state, persists and stops running animations',()=>{
 const motion=load('src/lib/motion.ts');const saved=[],events=[];let stopped=0;
 const document={documentElement:{dataset:{}},getAnimations:()=>[{cancel(){stopped++}}]};
 const {ThemeProvider}=load('src/components/layout/theme-provider.tsx',{
  react:{createContext:()=>({Provider:'Provider'}),useState:value=>[value,()=>{}],useEffect(){},useCallback:fn=>fn},
  'react/jsx-runtime':{jsx:(type,props)=>({type,props})},'@/lib/theme':{THEME_STORAGE_KEY:'theme'},'@/lib/motion':motion
 },{document,localStorage:{setItem:(...args)=>saved.push(args)},window:{dispatchEvent:event=>events.push(event.type)},Event});
 const view=ThemeProvider({children:null});view.props.value.setReducedMotion(true);
 assert.equal(document.documentElement.dataset.motion,'reduce');assert.equal(saved[0][1],'true');assert.equal(stopped,1);assert.equal(events[0],motion.MOTION_CHANGE_EVENT);
 view.props.value.setReducedMotion(false);assert.equal(document.documentElement.dataset.motion,'full');assert.equal(saved[1][1],'false');
});
test('JS animation controllers disable when personal motion reduction is active',()=>{
 const enabled=[];
 const {useAutoAnimate}=load('src/components/layout/use-motion-auto-animate.ts',{
  react:{useSyncExternalStore:()=>true,useEffect:fn=>fn()},
  '@formkit/auto-animate/react':{useAutoAnimate:()=>[()=>{},value=>enabled.push(value)]},
  '@/lib/motion':{MOTION_CHANGE_EVENT:'motion',shouldReduceMotion:()=>true}
 });
 useAutoAnimate({duration:130});assert.deepEqual(enabled,[false]);
});
