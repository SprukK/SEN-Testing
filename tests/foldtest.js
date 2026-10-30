// Fold layout test (Probe V1.6.0): the Lab on the unfolded Honor Magic V5 screen. Outer screen unchanged;
// unfolded: Devices → live log in the second pane; Capture → capture results (finder, byte-change table,
// GATT dump) with the log under them; Lane / Data → full width with a ◧ Log button; Log → full width in its
// own tab. Switch per tab, remembered; blocks moved (never copied) and back in their exact place; folding in
// the middle of a capture keeps the device connected and the capture recording; desktop two panes; landscape
// phone single column; garbage stored choices → defaults; no HTML sinks.
// Usage: node foldtest.js <probe index.html>   (needs jsdom)
const {JSDOM}=require('jsdom'),fs=require('fs');
const FILE=process.argv[2]||'../index.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;
const chk=(n,ok,extra)=>{console.log((ok?'  PASS  ':'  FAIL  ')+n+(extra?'   '+extra:''));ok?pass++:fail++;};
const B='-0000-1000-8000-00805f9b34fb';
const OUTER=[412,915],INNER=[784,724];
function mkDev(name,id){
  const dev={name,id,ls:{},writes:[],addEventListener(t,f){(this.ls[t]=this.ls[t]||[]).push(f)},fire(t,e){(this.ls[t]||[]).forEach(f=>f(e))},watchAdvertisements:async function(){}};
  const svc={uuid:'0000ffe0'+B};
  const ch={uuid:'0000ffe1'+B,properties:{notify:true},service:svc,ls:[],addEventListener(t,f){this.ls.push(f)},async startNotifications(){},
    emit(b){const v=new DataView(new Uint8Array(b).buffer);this.ls.forEach(f=>f({target:{value:v}}))}};
  svc.getCharacteristics=async()=>[ch];dev.ch=ch;
  dev.gatt={connected:false,async connect(){this.connected=true;return{getPrimaryServices:async()=>[svc]}},disconnect(){this.connected=false;dev.fire('gattserverdisconnected')}};
  return dev;
}
function setScreen(w,[W,H],coarse=true){
  Object.defineProperty(w,'innerWidth',{configurable:true,value:W});Object.defineProperty(w,'innerHeight',{configurable:true,value:H});
  w.matchMedia=q=>({matches:/pointer:\s*coarse/.test(q)?coarse:false,addEventListener(){},removeEventListener(){}});
}
let queue=[];
function open(screen,ls){
  const dom=new JSDOM(fs.readFileSync(FILE,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://sprukk.github.io/SEN-Testing/',beforeParse(w){
    setScreen(w,screen);if(ls)Object.entries(ls).forEach(([k,v])=>w.localStorage.setItem(k,v));
    w.navigator.bluetooth={requestDevice:async()=>queue.shift(),getAvailability:async()=>true,getDevices:async()=>[]};
    w.BluetoothDevice=function(){};w.BluetoothDevice.prototype.watchAdvertisements=function(){};w.alert=()=>{};w.confirm=()=>true;}});
  const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));return w;
}
const resize=async(w,screen,coarse)=>{setScreen(w,screen,coarse);w.dispatchEvent(new w.Event('resize'));await sleep(200);};
(async()=>{
console.log('=== LAB FOLD TEST: '+FILE+' ===');
const w=open(OUTER);await sleep(200);
const d=w.document,$=id=>d.getElementById(id),click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const fold=()=>d.documentElement.classList.contains('fold');
const paneIds=()=>[...$('lab-pane').children].map(e=>e.id).filter(x=>x&&x!=='pane-sw'&&x!=='strip-pane').join(',');
const sw=()=>[...$('pane-sw').querySelectorAll('button')].map(b=>b.textContent+(b.classList.contains('on')?'*':'')).join('|');
const capOrder=()=>[...$('tab-capture').querySelector('.panel').children].map(e=>e.id||e.className).join(',');
// 1. Outer screen.
const cap0=capOrder();
chk('outer screen: single column, pane empty, log in its own tab',!fold()&&paneIds()===''&&!!d.querySelector('#tab-log #log-panel'));
// 2. Unfold on Devices.
await resize(w,INNER);
chk('unfolded on Devices: two panes, the live log on the right, switch Log* | Capture results',fold()&&paneIds()==='log-panel'&&sw()==='Log*|Capture results',paneIds()+' · '+sw());
const D=mkDev('Paragon RF','idR');d.getElementById('optInit').checked=false;queue.push(D);click($('addbtn'));await sleep(900);
chk('adding a device: its card on the left, the log on the right shows it',!!d.querySelector('#tab-devices .dev')&&/Added "Paragon RF"/.test($('log').textContent)&&$('log').closest('#lab-pane')!==null);
chk('status strip also at the top of the pane',$('strip-pane').querySelectorAll('.chip').length===1&&$('strip').querySelectorAll('.chip').length===1);
// 3. Capture tab.
click($('tb-capture'));await sleep(30);
chk('Capture: pane holds finder, byte-change table, GATT dump, then the log; switch Capture results* | Log',paneIds()==='capfind,capsumwrap,capdump,log-panel'&&sw()==='Capture results*|Log'&&d.documentElement.classList.contains('pane-cap'),paneIds());
$('cappreset').value='rangefinder';$('cappreset').dispatchEvent(new w.Event('change'));click($('capstart'));await sleep(20);
D.ch.emit([0xaa,0x01,0xd2,0x04,0x1e,0x00]);await sleep(300);
chk('capture running: the byte-change table in the pane fills',$('capsum').closest('#lab-pane')!==null&&/ffe1/.test($('capsum').textContent),$('capsum').textContent.slice(0,60));
$('caprng').value='123.4';$('capang').value='3';click($('caprngbtn'));await sleep(50);
chk('Mark range on the left → finder result on the right',/distance/.test($('capfind').textContent)&&$('capfind').closest('#lab-pane')!==null);
// 4. Back to Devices: capture results go home in their exact place, the log stays.
click($('tb-devices'));await sleep(30);
chk('Devices again: log only in the pane; capture results back in the Capture tab in their exact order',paneIds()==='log-panel'&&capOrder()===cap0,capOrder());
[...$('pane-sw').querySelectorAll('button')].find(b=>b.textContent==='Capture results').click();await sleep(20);
chk('switch to Capture results on Devices → remembered',paneIds()==='capfind,capsumwrap,capdump,log-panel'&&JSON.parse(w.localStorage.getItem('sen_lab_panes')).devices==='cap');
click($('tb-lane'));await sleep(20);click($('tb-devices'));await sleep(20);
chk('…still Capture results after visiting another tab',paneIds()==='capfind,capsumwrap,capdump,log-panel');
[...$('pane-sw').querySelectorAll('button')].find(b=>b.textContent==='Log').click();await sleep(20);
// 5. Lane / Data / Log.
click($('tb-lane'));await sleep(20);
chk('Lane: full width, pane hidden, ◧ Log button shown',d.documentElement.classList.contains('pane-none')&&paneIds()===''&&$('pane-show').style.display==='');
click($('pane-show'));await sleep(20);
chk('◧ Log → the log beside the lane, switch Hide | Log*',paneIds()==='log-panel'&&sw()==='Hide|Log*'&&$('pane-show').style.display==='none');
[...$('pane-sw').querySelectorAll('button')].find(b=>b.textContent==='Hide').click();await sleep(20);
chk('Hide → full width again',paneIds()===''&&d.documentElement.classList.contains('pane-none'));
click($('tb-data'));await sleep(20);
chk('Data: full width',paneIds()===''&&d.documentElement.classList.contains('pane-none'));
click($('tb-log'));await sleep(20);
chk('Log tab: the log full width in its own tab, no switch, no ◧ button',!!d.querySelector('#tab-log #log-panel')&&paneIds()===''&&sw()===''&&$('pane-show').style.display==='none');
// 6. Fold in the middle of the capture.
click($('tb-capture'));await sleep(20);
await resize(w,OUTER);
chk('fold mid-capture: single column, every block home, no markers left',!fold()&&paneIds()===''&&capOrder()===cap0&&!!d.querySelector('#tab-log #log-panel')&&d.querySelectorAll('[data-pane-home]').length===0);
const n0=w.eval('CAP.events.length');D.ch.emit([0xaa,0x01,0x10,0x03,0x00,0x00]);await sleep(50);
chk('…device still connected, capture still recording',D.gatt.connected&&w.eval('CAP.on')===true&&w.eval('CAP.events.length')>n0);
await resize(w,INNER);
chk('unfold again: capture results back in the pane',paneIds()==='capfind,capsumwrap,capdump,log-panel');
const once=['log-panel','capfind','capsumwrap','capdump','log','capsum'].filter(id=>d.querySelectorAll('#'+id).length!==1);
chk('every moved block exists exactly once',once.length===0,once.join(','));
await resize(w,[1440,900],false);
chk('desktop 1440 × 900: two panes',fold()&&paneIds()==='capfind,capsumwrap,capdump,log-panel');
await resize(w,[915,412],true);
chk('landscape phone 915 × 412: single column',!fold()&&paneIds()==='');
// 7. Garbage stored choices.
const w2=open(INNER,{sen_lab_panes:'{"devices":"evil","capture":{"x":1}}',sen_lab_tab:'capture'});await sleep(200);
chk('garbage stored choices → each tab\'s default',[...w2.document.getElementById('lab-pane').children].map(e=>e.id).filter(x=>x&&x!=='pane-sw'&&x!=='strip-pane').join(',')==='capfind,capsumwrap,capdump,log-panel');
const w3=open(INNER,{sen_lab_panes:'not json'});await sleep(200);
chk('unreadable stored choices → defaults, no error',w3.document.documentElement.classList.contains('fold')&&w3.errs.length===0);
const src=w.eval('[applyPane,setPaneMode,paneIn,paneOut,applyLabLayout,renderStrip].map(String).join("")');
chk('no HTML sinks in the new code',!/innerHTML|insertAdjacentHTML|outerHTML|document\.write/.test(src));
const errs=[...w.errs,...w2.errs,...w3.errs];
chk('ZERO uncaught errors',errs.length===0,errs.join(' | '));
console.log(`\nPASS ${pass}   FAIL ${fail}`);process.exit(fail?1:0);
})().catch(e=>{console.error('TEST CRASH:',e);process.exit(1);});
