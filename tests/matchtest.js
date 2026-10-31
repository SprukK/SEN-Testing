// Profile match test (Probe V1.6.1): the Calypso profile is chosen by name (WDOT-…) only. A device with the
// same stock ISSC FFF1/FFF2 layout but another name (the Vector Paragon SCRF-S24 rangefinder) or no name gets
// the generic profile and receives ZERO writes with "Auto-initialise known profiles" ticked. A real Calypso still
// auto-handshakes with its own :DU token; choosing the Calypso profile by hand still sends it (deliberate). The
// Garmin multi-link service is named in the chooser with and without the wide service net.
// Usage: node matchtest.js <probe index.html>   (needs jsdom)
const {JSDOM}=require('jsdom'),fs=require('fs');
const FILE=process.argv[2]||'../index.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;
const chk=(n,ok,extra)=>{console.log((ok?'  PASS  ':'  FAIL  ')+n+(extra?'   '+extra:''));ok?pass++:fail++;};
const B='-0000-1000-8000-00805f9b34fb',ISSC='49535343-fe7d-4ae5-8fa9-9fafd205e455';
const GARMIN='6a4e2800-667b-11e3-949a-0800200c9a66';
function mkIssc(name,id){
  const dev={name,id,ls:{},writes:[],addEventListener(t,f){(this.ls[t]=this.ls[t]||[]).push(f)},fire(t,e){(this.ls[t]||[]).forEach(f=>f(e))},watchAdvertisements:async function(){}};
  const svc={uuid:ISSC};
  const mk=(u,props)=>({uuid:u,properties:props,service:svc,ls:[],addEventListener(t,f){this.ls.push(f)},async startNotifications(){},
    async readValue(){return new DataView(new Uint8Array([1]).buffer)},
    async writeValueWithoutResponse(b){dev.writes.push(Buffer.from(b).toString())},async writeValueWithResponse(b){dev.writes.push(Buffer.from(b).toString())}});
  svc.chars=[mk('0000fff1'+B,{write:true,writeWithoutResponse:true}),mk('0000fff2'+B,{notify:true})];
  svc.getCharacteristics=async()=>svc.chars;
  dev.gatt={connected:false,async connect(){this.connected=true;return{getPrimaryServices:async()=>[svc]}},disconnect(){this.connected=false;dev.fire('gattserverdisconnected')}};
  return dev;
}
const VEC=mkIssc('SCRF-S24-001301','idV'),NONAME=mkIssc(undefined,'idN'),CAL=mkIssc('WDOT-B1F9A6','idC');
let queue=[],opts=[];
const dom=new JSDOM(fs.readFileSync(FILE,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://sprukk.github.io/SEN-Testing/',beforeParse(w){
  w.navigator.bluetooth={requestDevice:async o=>{opts.push(o);return queue.shift();},getAvailability:async()=>true,getDevices:async()=>[]};
  w.BluetoothDevice=function(){};w.BluetoothDevice.prototype.watchAdvertisements=function(){};w.alert=()=>{};w.confirm=()=>true;}});
const w=dom.window,d=w.document;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));
const $=id=>d.getElementById(id),click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const card=n=>[...d.querySelectorAll('#devices .panel.dev')].find(c=>c.textContent.includes(n));
(async()=>{
console.log('=== PROFILE MATCH TEST: '+FILE+' ===');
await sleep(150);
chk('"Auto-initialise known profiles" ticked (the risky setting)',$('optInit').checked);
queue.push(VEC);click($('addbtn'));await sleep(500);
queue.push(NONAME);click($('addbtn'));await sleep(500);
queue.push(CAL);click($('addbtn'));await sleep(2500);
const profs=[...d.querySelectorAll('#devices .panel.dev')].map(c=>c.querySelector('select').value);
chk('Vector Paragon (SCRF-S24, ISSC FFF1/FFF2) → generic profile',profs[0]==='generic',profs.join(','));
chk('unnamed device with FFF1/FFF2 → generic profile',profs[1]==='generic');
chk('Calypso WDOT-B1F9A6 → Calypso profile',profs[2]==='calypso');
chk('ZERO writes to the Vector',VEC.writes.length===0,VEC.writes.join(' '));
chk('ZERO writes to the unnamed device',NONAME.writes.length===0,NONAME.writes.join(' '));
chk('the Calypso still auto-handshakes with its own :DU token first',CAL.writes[0]&&CAL.writes[0].startsWith(':DU,1668647648,A7'),CAL.writes.slice(0,2).join(' | '));
// Manual choice is deliberate: picking Calypso by hand still initialises.
const sel=card('SCRF-S24').querySelector('select');sel.value='calypso';sel.dispatchEvent(new w.Event('change'));await sleep(1500);
chk('choosing Calypso by hand on the Vector sends the handshake (deliberate, logged as manual)',VEC.writes.length>0&&/Calypso Mini \(wind\) \(manual\)/.test($('log').textContent));
// Garmin service named in the chooser, wide net on and off.
const has=o=>o.optionalServices.map(x=>String(x).toLowerCase()).includes(GARMIN);
chk('Garmin multi-link service named in the chooser (wide net on)',opts.every(has));
$('optWide').checked=false;queue.push(mkIssc('X','idX'));click($('addbtn'));await sleep(400);
chk('…and with the wide net off',has(opts[opts.length-1]));
chk('ZERO uncaught errors',w.errs.length===0,w.errs.join(' | '));
console.log(`\nPASS ${pass}   FAIL ${fail}`);process.exit(fail?1:0);
})().catch(e=>{console.error('TEST CRASH:',e);process.exit(1);});
