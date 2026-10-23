// Main-data test (Probe V1.2.0, CORE-09): the Lab reads the SEN calculator's data read-only over
// the shared sprukk.github.io origin. Runs the real Lab page and the real Main app in two jsdom
// windows sharing one IndexedDB: no Main data → says so and creates nothing; Main saves → Lab shows
// identical counts and the active session; the Lab never changes Main's data or blocks a Main
// database upgrade; localStorage fallback; newer schemas refused; chrono average vs profile MV;
// re-read on returning to the app.
// Usage: node maindatatest.js <lab index.html> <main index.html>   (needs jsdom + fake-indexeddb)
const {JSDOM}=require('jsdom'),fs=require('fs');
const {IDBFactory,IDBKeyRange}=require('fake-indexeddb');
const [LAB,MAINAPP]=process.argv.slice(2);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;
const chk=(n,ok,extra)=>{console.log((ok?'  PASS  ':'  FAIL  ')+n+(extra?'   '+extra:''));ok?pass++:fail++;};
const all=[];
async function open(file,url,idb,ls){
  const dom=new JSDOM(fs.readFileSync(file,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url,
    beforeParse(w){w.indexedDB=idb;w.IDBKeyRange=IDBKeyRange;w.alert=()=>{};
      if(ls)for(const k in ls)w.localStorage.setItem(k,ls[k]);
      w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(t,k)=>k==='measureText'?()=>({width:10}):()=>{}});}});
  const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));
  await wait(800);all.push(w);return w;
}
const openLab=(idb,ls)=>open(LAB,'https://sprukk.github.io/SEN-Testing/',idb,ls);
const openMain=idb=>open(MAINAPP,'https://sprukk.github.io/SEN-Balistic-Calculator/',idb);
const status=w=>w.document.getElementById('mainstatus').textContent;
const tiles=w=>[...w.document.querySelectorAll('#mainsession .sc')].map(t=>t.querySelector('.l').textContent+'='+t.querySelector('.v').textContent);
const dbNames=async idb=>(await idb.databases()).map(d=>d.name);
const rawMain=async idb=>new Promise(res=>{const r=idb.open('sen_main');r.onsuccess=()=>{const db=r.result,q=db.transaction('kv','readonly').objectStore('kv').get('db');q.onsuccess=()=>{db.close();res(q.result);};};});

(async()=>{
console.log('=== MAIN DATA TEST: '+LAB+' + '+MAINAPP+' ===');
const idb=new IDBFactory();

// 1. Lab first, no Main data on the phone.
const lab=await openLab(idb);
chk('no Main data → says so',/No SEN calculator data on this phone yet/.test(status(lab)),status(lab));
chk('…and creates no sen_main database',!(await dbNames(idb)).includes('sen_main'),JSON.stringify(await dbNames(idb)));

// 2. Main opens, sets a session and saves.
const main=await openMain(idb);
main.eval(`const r=DB.rifles[0];r.mv=262.5;Bus.setRifle(r.id);Bus.setProj(DB.projectiles.find(p=>/Queen/.test(p.name)&&p.bcg7>0).id);Bus.setWx('cur',DB.weathers[0].id);saveDB();`);
await wait(300);
const M=JSON.parse(main.eval(`JSON.stringify({r:DB.rifles.length,p:DB.projectiles.length,s:DB.scopes.length,w:DB.weathers.length,d:DB.dopeCards.length,rifle:getRifle().name,proj:getProj().name,bc:getProj().bcg7,wx:DB.weathers[0].name})`));
const before=await rawMain(idb);

// 3. The Lab reads it (Refresh button).
lab.document.getElementById('mainbtn').click();await wait(300);
chk('Lab finds Main data in IndexedDB with identical counts',status(lab)===`Found in IndexedDB · ${M.r} rifles · ${M.p} projectiles · ${M.s} scopes · ${M.w} weathers · ${M.d} dope cards`,status(lab));
const T=tiles(lab);
chk('active session shown: rifle, profile MV, projectile, BC G7, weather',T.includes('Rifle='+M.rifle)&&T.includes('Profile MV=262.5')&&T.includes('Projectile='+M.proj)&&T.includes('BC G7='+M.bc.toFixed(4))&&T.includes('Weather='+M.wx),T.join(' | '));

// 4. Read-only: nothing changed, no upgrade blocked, no write path in the reader.
chk("Main's stored snapshot unchanged after the Lab read it",(await rawMain(idb))===before);
chk('reader has no write path (read-only transactions only)',!/readwrite|\.put\(|\.delete\(|\.add\(|setItem/.test(lab.eval('SenMainData.readIdb.toString()+SenMainData.read.toString()')));

// 5. Chrono average vs Main profile MV.
lab.eval(`window.__d={shots:[],ui:{}};window.__box=document.createElement('div');document.body.append(__box);buildShotUI(__d,__box,[]);
  [265.1,265.5,265.4].forEach(v=>__d.shots.push({ms:v,t:'00:00:00',extra:[]}));renderShots(__d);`);
const mv=lab.eval('__box.querySelector(".mvcmp").textContent');
chk('chrono card: average vs profile MV (265.33 vs 262.5 → +2.83 m/s, +1.1 %)',mv===`vs Main profile MV (${M.rifle}): 262.5 m/s → average +2.83 m/s (+1.1 %)`,mv);

// 6. Re-read when the user comes back to the Lab app.
main.eval(`DB.rifles[0].mv=270;saveDB();`);await wait(300);
lab.document.dispatchEvent(new lab.Event('visibilitychange'));await wait(300);
chk('returning to the Lab re-reads Main data (new MV shown)',tiles(lab).includes('Profile MV=270.0')&&/\+−?|−/.test(lab.eval('__box.querySelector(".mvcmp").textContent')),tiles(lab).join(' | '));

// 7. The Lab keeps no connection open: with Main's own connection closed, a future Main database
//    upgrade (version 2) proceeds immediately instead of being blocked by the Lab.
main.eval('_idb.close()');
const up=await new Promise(res=>{const r=idb.open('sen_main',2);r.onblocked=()=>res('blocked');r.onupgradeneeded=()=>{};r.onsuccess=()=>{r.result.close();res('ok');};r.onerror=()=>res('error');});
chk('Lab holds no connection: a future Main database upgrade is not blocked',up==='ok',up);

// 8. localStorage fallback and the schema guard (separate phone: empty IndexedDB).
const ok=JSON.stringify({rifles:[{id:'r',name:'LS rifle',mv:250}],projectiles:[],weathers:[],scopes:[],reticles:[],dopeCards:[],schema:{rifles:1,dopeCards:2},session:{rifleId:'r'}});
const ls=await openLab(new IDBFactory(),{sen_platform_v1:ok});
chk('Main running on localStorage → Lab reads that copy',/^Found in localStorage · 1 rifles/.test(status(ls))&&tiles(ls).includes('Rifle=LS rifle'),status(ls));
const nw=await openLab(new IDBFactory(),{sen_platform_v1:ok.replace('"dopeCards":2','"dopeCards":3')});
chk('newer schema refused with a reason',/newer than this probe understands \(dopeCards v3\)/.test(status(nw))&&tiles(nw).length===0,status(nw));
const bad=await openLab(new IDBFactory(),{sen_platform_v1:'{broken'});
chk('unreadable data reported, not thrown',/^⚠ Main app data unreadable/.test(status(bad)),status(bad));

const errs=all.flatMap(x=>x.errs);
chk('ZERO uncaught errors',errs.length===0,errs.slice(0,3).join(' / '));
console.log('\nPASS '+pass+'   FAIL '+fail);
process.exit(fail?1:0);
})().catch(e=>{console.error('TEST CRASH:',e);process.exit(1);});
