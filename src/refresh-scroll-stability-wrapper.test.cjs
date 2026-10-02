const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');

function harness(path){
  const source=readFileSync(path,'utf8');
  const scripts=[...source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(m=>!path.endsWith('/ui-stability-wrapper.js')||m[1].includes('alyzia-ui-stability-nav-js')).map(m=>m[2]);
  const listeners={},timers=[];
  let now=0,detail=false,nextDetail=null,offset=0,resolveFetch;
  const pending=new Promise(resolve=>{resolveFetch=resolve});
  const context={console,URL,innerHeight:700,location:{origin:'https://ops.test'},
    Date:{now:()=>now},setTimeout:(fn,delay=0)=>{const t={fn,at:now+delay};timers.push(t);return t},
    clearTimeout:t=>{if(t)t.cancelled=true},requestAnimationFrame:fn=>context.setTimeout(fn,16),
    MutationObserver:class{observe(){}disconnect(){}},
    renderHome:()=>{offset+=100},render:()=>{offset+=100;if(nextDetail!==null)detail=nextDetail},
  };
  const rows=Array.from({length:12},(_,i)=>({
    querySelector:selector=>({textContent:selector.includes('flight')?'TK'+i:'IST'}),
    getAttribute:name=>name==='data-flight-index'?String(i):'',
    getBoundingClientRect:()=>({top:i*300+offset-context.scrollY,bottom:(i+1)*300+offset-context.scrollY,height:300})
  }));
  Object.assign(context,{scrollY:600,fetch:()=>pending,addEventListener:(type,fn)=>{(listeners[type]??=[]).push(fn)},
    scrollBy:({top})=>{context.scrollY+=top},scrollTo:(arg,y)=>{context.scrollY=typeof arg==='number'?y:arg.top},
    document:{querySelector:selector=>selector.includes('flight-head')&&detail?{}:null,
      querySelectorAll:()=>rows,getElementById:()=>({}),addEventListener:(type,fn)=>{(listeners[type]??=[]).push(fn)}}});
  context.window=context;
  vm.createContext(context);
  scripts.forEach(script=>vm.runInContext(script,context));
  const advance=ms=>{const end=now+ms;let passes=0;while(true){timers.sort((a,b)=>a.at-b.at);const t=timers.find(t=>!t.cancelled&&t.at<=end);if(!t)break;t.cancelled=true;now=t.at;t.fn();if(++passes>1000)throw Error('timer loop')}now=end};
  return {context,advance,respond:()=>resolveFetch({ok:true}),gesture:()=>listeners.wheel?.forEach(fn=>fn({})),detail:on=>{detail=on},renderTo:on=>{nextDetail=on;context.render()}};
}

const path=process.env.SCROLL_WRAPPER_UNDER_TEST||__dirname+'/refresh-scroll-stability-wrapper.js';
test('a late empty refresh cannot undo scrolling while the request was pending',async()=>{
  const h=harness(path),request=h.context.fetch('/api/flights?since=123');
  h.gesture();h.context.scrollY=1050;
  h.respond();await request;h.advance(1900);
  assert.equal(h.context.scrollY,1050);
});
test('a real list render keeps the visible flight at the same pixel',()=>{
  const h=harness(path);h.context.renderHome();
  assert.equal(h.context.scrollY,700);
  h.advance(1900);assert.equal(h.context.scrollY,700);
});
test('a user gesture cancels all delayed scroll corrections',()=>{
  const h=harness(path);h.context.renderHome();h.gesture();h.context.scrollY=1100;
  h.advance(1900);assert.equal(h.context.scrollY,1100);
});
test('rendering a detail does not activate the list scroll anchor',()=>{
  const h=harness(path);h.detail(true);h.context.render();h.advance(1900);
  assert.equal(h.context.scrollY,600);
});
test('a render that stays on the list does not scroll to the top',()=>{
  const h=harness(__dirname+'/ui-stability-wrapper.js');h.renderTo(false);h.advance(200);
  assert.equal(h.context.scrollY,600);
});
test('explicit list-to-detail navigation still starts at the top',()=>{
  const h=harness(__dirname+'/ui-stability-wrapper.js');h.renderTo(true);h.advance(200);
  assert.equal(h.context.scrollY,0);
});
