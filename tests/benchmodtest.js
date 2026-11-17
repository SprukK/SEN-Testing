// Module Bench test (Module_Bench V1.0.0, BENCH-09 flight view).
// 1. The physics core block is still a verbatim copy of Main (every line found in Main's index.html).
// 2. Physics anchors: the copied core reproduces the Main anchors; the module's new physics (moment of
//    inertia, spin decay, Sg downrange, Reynolds, helix, epicycle) matches independent Python known answers.
// 3. Real DOM (jsdom + fake-indexeddb): reads Main's data read-only, never creates sen_main, A/B slots,
//    range scrubber, tail and assumed-BC inputs saved only in the Lab namespace, garbage settings cleaned,
//    and (with a Main checkout) the snapshot the real calculator saves.
// Usage: node benchmodtest.js <Module_Bench.html> <main index.html>   (needs jsdom + fake-indexeddb)
const {JSDOM}=require('jsdom'),fs=require('fs');
const {IDBFactory,IDBKeyRange}=require('fake-indexeddb');
const [MOD,MAINAPP]=process.argv.slice(2);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;
const chk=(n,ok,extra)=>{console.log((ok?'  PASS  ':'  FAIL  ')+n+(extra!=null?'   '+extra:''));ok?pass++:fail++;};
const near=(a,b,rel)=>Math.abs(a-b)<=Math.abs(b)*rel;
const src=fs.readFileSync(MOD,'utf8');

const FIX={
  rifles:[{id:'r1',name:'Mora .25',cal:'.25',twist:508,twistDir:'right',sight:44,mv:280,zero:50}],
  projectiles:[
    {id:'p1',name:'Altaros Queen .25',cal:'.25',type:'slug',diam:6.35,mass:60,oal:12.903,bcg7:0.128},
    {id:'p2',name:'Test slug with shape',cal:'.25',type:'slug',diam:6.35,mass:40,oal:14,bcg7:0.09,noseL:5,rtr:1,meplat:1.5,baseD:5.6},
    {id:'p3',name:'Test pellet',cal:'.25',type:'pellet',diam:6.35,mass:25.4,oal:7,bcg1:0.03}],
  weathers:[{id:'w1',name:'Ljubljana',temp:20,pres:1010,presType:'sea',alt:298,rh:65}],
  scopes:[],reticles:[],dopeCards:[],ranges:[],
  designs:[{id:'d1',name:'Test shape (not a SEN design)',diam:6.35,bearL:7,noseL:5,rtr:1,meplat:1.2,btL:2,baseD:5.5,hpD:0,hpDep:0,hpShape:'cyl',bcD:0,bcDep:0,bcShape:'dish',alloy:'pb',sb:0,dens:null}],
  schema:{rifles:1,projectiles:1,weathers:1,scopes:1,reticles:1,dopeCards:2},
  session:{rifleId:'r1',projId:'p1',curWxId:'w1',zeroWxId:'w1',zero_m:50,dist_m:100,drag:'g7'}
};
async function seed(idb,snap){await new Promise(res=>{const r=idb.open('sen_main',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');
  r.onsuccess=()=>{const t=r.result.transaction('kv','readwrite');t.objectStore('kv').put(JSON.stringify(snap),'db');t.oncomplete=()=>{r.result.close();res();};};});}
const rawMain=idb=>new Promise(res=>{const r=idb.open('sen_main');r.onsuccess=()=>{const db=r.result,q=db.transaction('kv','readonly').objectStore('kv').get('db');q.onsuccess=()=>{db.close();res(q.result);};};});
async function open(file,url,idb,ls){
  const dom=new JSDOM(fs.readFileSync(file,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url,
    beforeParse(w){w.indexedDB=idb;w.IDBKeyRange=IDBKeyRange;w.alert=()=>{};
      if(ls)for(const k in ls)w.localStorage.setItem(k,ls[k]);
      w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(t,k)=>k==='measureText'?()=>({width:10}):()=>{}});}});
  const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));
  await wait(900);return w;
}
const openMod=(idb,ls)=>open(MOD,'https://sprukk.github.io/SEN-Testing/Module_Bench.html',idb,ls);
const $=(w,id)=>w.document.getElementById(id);
const tileText=(w,slot)=>[...w.document.querySelectorAll('#slots > .panel')[slot].querySelectorAll('.sc')].map(t=>t.querySelector('.l').textContent+'='+t.querySelector('.v').textContent);
const notes=(w,slot)=>[...w.document.querySelectorAll('#slots > .panel')[slot].querySelectorAll('.note')].map(n=>n.textContent);   // [error, muzzle, BC]
const fire=(w,e,type)=>e.dispatchEvent(new w.Event(type,{bubbles:true}));

(async()=>{
console.log('=== MODULE BENCH TEST: '+MOD+(MAINAPP?' + '+MAINAPP:'')+' ===');

// 1. Core is a verbatim copy of Main.
const core=src.split('═══ Physics core')[1].split('═══ end of the copied core')[0].split('\n').slice(2,-1);
if(MAINAPP){const main=fs.readFileSync(MAINAPP,'utf8');const missing=core.filter(l=>l.trim()&&!main.includes(l));
  chk('physics core: all '+core.length+' lines verbatim in Main',missing.length===0,missing.length?'first missing: '+missing[0].slice(0,80):'');}
else console.log('  (skipped core identity — no Main checkout given)');
chk('no HTML sinks in the module',!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(src));

// 2. Physics anchors (the page's own functions, no Main data).
const w0=await openMod(new IDBFactory());
const E=s=>w0.eval(s);
chk('Miller = Berger: Queen 60 gr 0.508″ 1:20″ 853 fps 50 °F 980 hPa → 1.181',E(`calcSg(60,6.35,0.508*25.4,508,853*0.3048,millerC(6.35,0.508*25.4).c,10,980)`).toFixed(3)==='1.181');
chk('moist-air density, Ljubljana default 20 °C / 974.8 hPa / 65 % → 1.1516',E(`airDensity(20,974.8,65)`).toFixed(4)==='1.1516');
chk('BC penalty: Queen Sg 1.26 → ×0.933 (same function as Main)',E(`(bcEffSg(0.128,1.26)/0.128).toFixed(3)`)==='0.933');
const Ix=E(`axialInertia(benchGeom({diam:6.35,bearL:12.903,noseL:0,rtr:1,meplat:0,btL:0,baseD:0}),60*GR2KG)`);
chk('I_x of a solid cylinder = ½·m·r² (Python 1.959641e-8)',near(Ix,1.9596405363562495e-08,1e-6),Ix.toExponential(6));
const IxH=E(`axialInertia(benchGeom({diam:6.35,bearL:12.903,noseL:0,rtr:1,meplat:0,btL:0,baseD:0,bcD:3,bcDep:12.903,bcShape:'cyl'}),60*GR2KG)`);
chk('I_x of a hollow cylinder through its length = ½·m·(r²+c²) (Python 2.397033e-8)',IxH===null||isNaN(IxH)?false:near(IxH,2.39703317885625e-08,1e-4),IxH&&IxH.toExponential(6));
const dec100=E(`spinDecayFactor(1.1515667840334822,0.00635,1.9596405363562495e-08,-0.01,100)`),dec300=E(`spinDecayFactor(1.1515667840334822,0.00635,1.9596405363562495e-08,-0.01,300)`);
chk('spin decay exp(ρSd²C_lp·s/2I_x): 100 m → 0.963175, 300 m → 0.893543 (Python; ODE with falling V agrees to 3e-7)',near(dec100,0.963174765244313,1e-9)&&near(dec300,0.8935426508533086,1e-9),dec100.toFixed(6)+' / '+dec300.toFixed(6));
chk('Sg Miller downrange: same V and spin → muzzle value; V −20 % → ×1.5625',E(`sgMillerAt(1.26,280,280,1)`)===1.26&&near(E(`sgMillerAt(1.0,280,224,1)`),1.5625,1e-12));
chk('Sg Miller downrange: spin −10 % at the same V → ×0.81',near(E(`sgMillerAt(1.0,280,280,0.9)`),0.81,1e-12));
const mg0=E(`mcgyroAir({L:2.03,Ln:0.5,rtr:1,db:1,dm:0,rho:11.34},80,272,20,974.8,65).sg`),mgAt=E(`sgMcgyroAt({L:2.03,Ln:0.5,rtr:1,db:1,dm:0,rho:11.34},80,272,272,1,sos(20),airDensity(20,974.8,65))`);
chk('Sg McGyro downrange at the muzzle = McGyro at your air (Kolbe-anchored function)',near(mgAt,mg0,1e-12),mgAt.toFixed(4)+' = '+mg0.toFixed(4));
chk('Reynolds on Ø, 280 m/s, 20 °C, ρ 1.15157 → 1.12908e5 (Python, Sutherland μ 1.81341e-5)',near(E(`reynolds(1.1515667840334822,280,0.00635,20)`),112908.29935906743,1e-9));
chk('rifling helix .25 at 1:20″ → 2.2488°',E(`helixDeg(6.35,508)`).toFixed(4)==='2.2488');
chk('spin 280 m/s at 1:20″ → 551.18 rev/s',E(`spinRps(280,508)`).toFixed(2)==='551.18');
chk('epicycle Sg 2: fast:slow = 5.8284, first max = the assumed 1.0°',E(`epicycle(2).ratio`).toFixed(4)==='5.8284'&&E(`epicycle(2).maxDeg`).toFixed(6)==='1.000000');
chk('epicycle: Sg ≤ 1 → none (not stable)',E(`epicycle(1)`)===null&&E(`epicycle(0.8)`)===null);
chk('no Main data → says so and shows the Queen reference',/No calculator data on this device yet/.test($(w0,'mainstatus').textContent)&&/Queen/.test(w0.document.querySelector('#slots select').selectedOptions[0].textContent));
chk('…and creates no sen_main database',!(await w0.indexedDB.databases()).map(d=>d.name).includes('sen_main'));
chk('Queen reference at Ljubljana air: Sg Miller 1.26 muzzle, BC 0.1194 effective',/Sg Miller 1\.26/.test(notes(w0,0)[1])&&/0\.1194 effective/.test(notes(w0,0)[2]));

// 3. With Main data.
const idb=new IDBFactory();await seed(idb,FIX);const before=await rawMain(idb);
const w=await openMod(idb);
chk('reads the calculator data (1 design · 3 projectiles · 1 rifle)',/1 designs · 3 projectiles · 1 rifles/.test($(w,'mainstatus').textContent),$(w,'mainstatus').textContent);
chk('air from the current weather, sea level → station 974.8 hPa',$(w,'airP').value==='974.8'&&/sea-level reading converted/.test($(w,'airsrc').textContent),$(w,'airP').value);
const sel=w.document.querySelectorAll('#slots select')[0];
chk('designs and real projectiles in separate groups',[...sel.querySelectorAll('optgroup')].map(g=>g.label).join('|')==='Bench designs (theoretical)|Real projectiles');
chk('defaults to the rifle\'s twist, direction and MV',w.document.querySelectorAll('#slots input')[0].value==='20'&&w.document.querySelectorAll('#slots input')[1].value==='280');
chk('slot B hidden until Compare B',w.document.querySelectorAll('#slots > .panel')[1].classList.contains('hide'));
const r0=tileText(w,0).join(' ');
$(w,'range').value='150';fire(w,$(w,'range'),'input');
const r150=tileText(w,0).join(' ');
chk('range scrubber moves the readings (velocity at 150 m < muzzle)',r0!==r150&&/Velocity=2[45]\d\.\d/.test(r150),r150.slice(0,60));
chk('Sg is a band downrange and grows (Queen 1.26 at the muzzle)',/Sg Miller=1\.3\d–1\.\d\d/.test(r150),r150);
chk('gaps say what is assumed (C_lp) and illustrative',/C_lp = -0.01 is assumed/.test($(w,'gaps').textContent)&&/illustrative/.test($(w,'gaps').textContent));
// design + assumed BC
sel.value='d:d1';fire(w,sel,'change');
chk('design without BC → no range data, asks for an ASSUMED BC',/needs a BC/.test(w.document.querySelectorAll('#slots > .panel')[0].textContent)&&/ASSUMED G7 BC/.test($(w,'gaps').textContent));
const bcIn=w.document.querySelectorAll('#slots > .panel')[0].querySelectorAll('input')[4];bcIn.value='0.1';fire(w,bcIn,'change');
const st=JSON.parse(w.localStorage.getItem('sen_lab_bench_v1'));
chk('assumed BC kept in the Lab namespace only (sen_lab_bench_v1)',st.bcA.d1===0.1&&/ASSUMED/.test(notes(w,0)[2]));
chk('design mass from geometry (Main benchMass) shown',/Muzzle: 65\.8 gr/.test(notes(w,0)[1]),notes(w,0)[1].slice(0,40));
// projectile with base Ø: tail length gives the angle
$(w,'cmp').checked=true;fire(w,$(w,'cmp'),'change');
const selB=w.document.querySelectorAll('#slots select')[3];selB.value='p:p2';fire(w,selB,'change');
chk('compare B shows the second slot',!w.document.querySelectorAll('#slots > .panel')[1].classList.contains('hide'));
chk('profile with base Ø but no tail length → gap asks for it',/B: Profile has a base Ø but no tail length/.test($(w,'gaps').textContent));
const btL=w.document.querySelectorAll('#slots > .panel')[1].querySelectorAll('input')[2];btL.value='1.5';fire(w,btL,'change');
chk('tail length + base Ø → tail angle 14.0°',/14\.0° tail/.test(tileText(w,1).join(' ')),tileText(w,1).join(' '));
const btA=w.document.querySelectorAll('#slots > .panel')[1].querySelectorAll('input')[3];btA.value='20';fire(w,btA,'change');
chk('length + angle disagreeing with the profile base Ø → flagged, not silently picked',/B: Tail: tail length and angle give base Ø 5\.26 mm, the profile says 5\.60 mm/.test($(w,'gaps').textContent));
chk('McGyro computed for a profile with shape fields',/Sg McGyro=\d/.test(tileText(w,1).join(' ')));
selB.value='p:p3';fire(w,selB,'change');
chk('pellet → no Sg, drag-stabilised gap',/Sg Miller=—/.test(tileText(w,1).join(' '))&&/Pellet: drag-stabilised/.test($(w,'gaps').textContent));
const pick=w.document.querySelectorAll('#slots select')[1];pick.value='12|';fire(w,pick,'change');
chk('twist picker sets the Mora custom 1:12″',w.document.querySelectorAll('#slots input')[0].value==='12');
chk('chart drawn with bands and both slots',!!w.document.querySelector('#chartbox svg')&&w.document.querySelectorAll('#chartbox path').length>=4);
chk('Main data unchanged (read-only)',(await rawMain(idb))===before);
chk('no page errors',w.errs.length===0&&w0.errs.length===0,JSON.stringify(w.errs.concat(w0.errs)));

// 4. Garbage settings are cleaned on load.
const w2=await openMod(idb,{sen_lab_bench_v1:JSON.stringify({slots:[{src:'<img>',twistIn:'x',dir:'up',mv:1e9}],tails:{'bad id!':{btL:5},p2:{btL:99,btAng:-3}},bcA:{d1:'0.1'},clp:7,maxR:-5,model:'x'})});
const s2=w2.eval('JSON.stringify(SET)');const o2=JSON.parse(s2);
chk('garbage settings → clamped / dropped',o2.slots[0].dir==='right'&&o2.slots[0].mv===400&&o2.tails['bad id!']===undefined&&o2.tails.p2.btL===30&&o2.tails.p2.btAng===0&&o2.bcA.d1===undefined&&o2.clp===0&&o2.maxR===50&&o2.model==='miller',s2.slice(0,120));
chk('unknown source falls back to a real projectile',/^p:/.test(o2.slots[0].src));

// 5. The snapshot the real calculator saves.
if(MAINAPP){const idb3=new IDBFactory();
  const m=await open(MAINAPP,'https://sprukk.github.io/SEN-Balistic-Calculator/',idb3);m.eval('saveDB()');await wait(400);
  const np=+m.eval('DB.projectiles.length'),nr=+m.eval('DB.rifles.length');
  const w3=await openMod(idb3);
  chk('real Main snapshot: counts match ('+np+' projectiles, '+nr+' rifles)',new RegExp(np+' projectiles · '+nr+' rifles').test($(w3,'mainstatus').textContent),$(w3,'mainstatus').textContent);
  chk('real Main snapshot: no errors',w3.errs.length===0,JSON.stringify(w3.errs));}

console.log(`\nPASS ${pass} / FAIL ${fail}`);process.exit(fail?1:0);
})();
