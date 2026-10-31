// Rangefinder prep test (Probe V1.5.0, LAB-04 / LAB-05). The simulated browser behaves like Chrome: a
// device's services are reachable only when named in optionalServices before connecting. Two simulated
// rangefinders: "Binary RF" on a 16-bit FFE0 service (distance uint16 LE ×10, angle int16 LE ×10) and
// "ASCII RF" on an unlisted 128-bit service that it advertises ("D:0123.4m A:+03.0"). Checks: wide service
// net in the chooser (and off when unticked), binary RF reachable through it, ASCII RF hidden until its
// advertised service is added with one tap (kept for next time), rangefinder capture preset, "Mark range"
// markers, the number finder (encoding, byte position, unit, matched on every ranging, yards), JSON export,
// nothing written to any device, no HTML sinks.
// Usage: node rftest.js <probe index.html>   (needs jsdom)
const {JSDOM}=require('jsdom'),fs=require('fs');
const FILE=process.argv[2]||'../index.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;
const chk=(n,ok,extra)=>{console.log((ok?'  PASS  ':'  FAIL  ')+n+(extra?'   '+extra:''));ok?pass++:fail++;};
const B='-0000-1000-8000-00805f9b34fb';
const full=u=>typeof u==='number'?u.toString(16).padStart(8,'0')+B:String(u).toLowerCase();
const ASVC='d0611e78-bbb4-4591-a5f8-487910ae4366',ACHR='d0611e78-bbb4-4591-a5f8-487910ae4367';
function mkDev(name,id,svcDefs,advUuids){
  const dev={name,id,ls:{},writes:[],allowed:[],addEventListener(t,f){(this.ls[t]=this.ls[t]||[]).push(f)},fire(t,e){(this.ls[t]||[]).forEach(f=>f(e))},watchAdvertisements:async function(){}};
  const svcs=svcDefs.map(sd=>{const svc={uuid:sd.uuid};svc.chars=sd.chars.map(cd=>({uuid:cd.uuid,properties:cd.props,service:svc,ls:[],
      addEventListener(t,f){this.ls.push(f)},async startNotifications(){},async readValue(){return new DataView(new Uint8Array([1]).buffer)},
      emit(bytes){const v=new DataView(new Uint8Array(bytes).buffer);this.ls.forEach(f=>f({target:{value:v}}))},
      async writeValueWithoutResponse(b){dev.writes.push(b)},async writeValueWithResponse(b){dev.writes.push(b)}}));
    svc.getCharacteristics=async()=>svc.chars;return svc;});
  dev.char=u=>svcs.flatMap(s=>s.chars).find(c=>c.uuid===u);
  // Chrome: only services named in optionalServices are exposed.
  dev.gatt={connected:false,async connect(){this.connected=true;return{getPrimaryServices:async()=>svcs.filter(s=>dev.allowed.includes(s.uuid))}},disconnect(){this.connected=false;dev.fire('gattserverdisconnected')}};
  dev.advert=()=>dev.fire('advertisementreceived',{rssi:-58,uuids:advUuids||[],manufacturerData:new Map(),serviceData:new Map()});
  return dev;
}
const V=mkDev('Paragon RF','idV',[{uuid:full(0xffe0),chars:[{uuid:full(0xffe1),props:{notify:true}}]}]);
const A=mkDev('ASCII-RF','idA',[{uuid:ASVC,chars:[{uuid:ACHR,props:{notify:true}}]}],[ASVC]);
const binRange=(m,ang)=>{const d=Math.round(m*10),a=Math.round(ang*10)&0xffff;return[0xaa,0x01,d&255,d>>8,a&255,a>>8,0x55];};
let queue=[],lastOpts=null;
const dom=new JSDOM(fs.readFileSync(FILE,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://sprukk.github.io/SEN-Testing/',beforeParse(w){
  w.navigator.bluetooth={requestDevice:async o=>{lastOpts=o;const dv=queue.shift();dv.allowed=(o.optionalServices||[]).map(full);return dv;},getAvailability:async()=>true,getDevices:async()=>[]};
  w.BluetoothDevice=function(){};w.BluetoothDevice.prototype.watchAdvertisements=function(){};
  w.alert=()=>{};w.confirm=()=>true;w.downloads=[];w.URL.createObjectURL=b=>{w.downloads.push(b);return 'blob:x';};w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){w.lastDownload=this.download;};}});
const w=dom.window,d=w.document;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));
const click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const $=id=>d.getElementById(id);
const findRows=()=>[...d.querySelectorAll('#capfind tbody tr')].map(r=>[...r.children].map(c=>c.textContent).join(' | ')+(r.classList.contains('hit')?' ✓':''));
const blobText=b=>new Promise(r=>{const fr=new w.FileReader();fr.onload=()=>r(fr.result);fr.readAsText(b);});
(async()=>{
console.log('=== RANGEFINDER PREP TEST: '+FILE+' ===');
await sleep(150);
// 1. Wide service net.
chk('"Wide service net" option, ticked by default',$('optWide')&&$('optWide').checked);
queue.push(V);click($('addbtn'));await sleep(900);
const os=lastOpts.optionalServices.map(full);
chk('chooser names every 16-bit service 1800–18FF, FE00–FEFF, FF00–FFFF plus the BLE-serial modules, no duplicates',[0x1800,0x18ff,0xfe00,0xfeff,0xff00,0xffe0,0xffff].every(u=>os.includes(full(u)))&&os.includes('0783b03e-8535-b5a0-7140-a304d2495cb7')&&new Set(os).size===os.length&&os.length>=768,os.length+' services');
chk('Binary RF: FFE0 reachable through the net and FFE1 subscribed',/ffe0/.test(d.querySelector('.dev .disco').textContent)&&/Subscribed|subscribed/.test($('log').textContent));
// 2. ASCII RF: unlisted 128-bit service → hidden, advertised → one tap → reachable next time.
queue.push(A);click($('addbtn'));await sleep(900);
const cardA=[...d.querySelectorAll('.dev')].find(c=>/ASCII-RF/.test(c.textContent));
chk('ASCII RF: its 128-bit service is not reachable on the first connect (not named)',!cardA.querySelector('.disco').textContent.includes(ASVC));
A.advert();await sleep(50);
const advBtn=[...cardA.querySelectorAll('button')].find(b=>/Add them to the service list/.test(b.textContent));
chk('…its advert shows the service as "advertised but not reachable" with a one-tap fix',/Advertised but not reachable yet: d0611e78-bbb4-4591-a5f8-487910ae4366/.test(cardA.textContent)&&!!advBtn);
click(advBtn);
chk('tap → added to the extra service list and kept for next time',$('extraSvc').value.includes(ASVC)&&w.localStorage.getItem('sen_lab_extrasvc').includes(ASVC));
click([...cardA.querySelectorAll('button')].find(b=>b.textContent==='Remove'));await sleep(50);
queue.push(A);click($('addbtn'));await sleep(900);
const cardA2=[...d.querySelectorAll('.dev')].find(c=>/ASCII-RF/.test(c.textContent));
chk('added again → the 128-bit service and its notify characteristic are reachable',cardA2.querySelector('.disco').textContent.includes(ASVC)&&cardA2.querySelector('.disco').textContent.includes(ACHR));
// 3. Capture with the rangefinder preset.
click($('tb-capture'));await sleep(20);
$('cappreset').value='rangefinder';$('cappreset').dispatchEvent(new w.Event('change'));await sleep(20);
const marks=[...d.querySelectorAll('#capmarks button')].map(b=>b.textContent);
chk('Rangefinder preset with its markers',marks.includes('Ranged near target')&&marks.includes('Unit button m↔yd')&&marks.includes('Bluetooth button'),marks.join(','));
chk('"Mark range" disabled until the capture starts',$('caprngbtn').disabled);
click($('capstart'));await sleep(20);
const rangeOnce=async(m,ang,typed,unit)=>{V.char(full(0xffe1)).emit(binRange(m,ang));A.char(ACHR).emit([...Buffer.from('D:'+m.toFixed(1).padStart(6,'0')+'m A:'+(ang>=0?'+':'-')+Math.abs(ang).toFixed(1).padStart(4,'0')+'\r\n')]);
  await sleep(30);$('caprng').value=String(typed);$('caprngu').value=unit;$('capang').value=String(ang);click($('caprngbtn'));await sleep(30);};
await rangeOnce(123.4,3.0,123.4,'m');
chk('Mark range adds a "RANGE 123.4 m · angle +3°" marker',/MARK "RANGE 123\.4 m · angle \+3°"/.test($('log').textContent));
let rows=findRows();
chk('one ranging: candidates listed, with the hint to range a second distance',rows.length>0&&/range a second, different distance/.test($('capfind').textContent),rows.slice(0,3).join(' // '));
await rangeOnce(87.6,-2.5,87.6,'m');
rows=findRows();
const has=re=>rows.some(r=>re.test(r));
chk('Binary RF distance found: FFE1 bytes 2–3, uint16 LE ×10, m, 2 of 2',has(/^distance \| D1 · ffe1 \| bytes 2–3 \| uint16 LE ×10 · m \| 2 of 2 ✓$/),rows.join(' // '));
chk('Binary RF angle found: bytes 4–5, int16 LE ×10, 2 of 2',has(/^angle \| D1 · ffe1 \| bytes 4–5 \| int16 LE ×10 · ° \| 2 of 2 ✓$/));
chk('ASCII RF distance found as text at bytes 2–7, 2 of 2 (example shown)',has(/^distance \| D\d · d0611e78…4367 \| bytes 2–7 \| ASCII \(e\.g\. "0\d{3}\.\d"\) · m \| 2 of 2 ✓$/),rows.join(' // '));
chk('ASCII RF angle found at the same digits for +3.0 and −2.5 (sign ignored for position), 2 of 2',has(/^angle \| D\d · d0611e78…4367 \| bytes 13–16 \| ASCII \(e\.g\. "0\d\.\d"\) · ° \| 2 of 2 ✓$/),rows.join(' // '));
chk('the consistent positions come first',/2 of 2 ✓$/.test(rows[0]));
// 4. A rangefinder set to yards: typed in yd, sends metres → still found (other unit).
await rangeOnce(100.0,0.5,109.4,'yd');
rows=findRows();
chk('typed in yards (109.4 yd), device sends metres: found via the other unit, 3 of 3',has(/^distance \| D1 · ffe1 \| bytes 2–3 \| uint16 LE ×10 · m \| 3 of 3 ✓$/),rows.slice(0,4).join(' // '));
// 5. Export, nothing written, no sinks.
click($('capstart'));await sleep(20);
click($('capsavebtn'));await sleep(20);
const j=JSON.parse(await blobText(w.downloads[w.downloads.length-1]));
chk('JSON export carries the ranges and the finder result',j.ranges.length===3&&j.ranges[0].v===123.4&&j.found.some(f=>f.what==='distance'&&f.ch==='ffe1'&&f.off===2&&f.n===3));
chk('nothing was written to either rangefinder',V.writes.length===0&&A.writes.length===0);
const src=w.eval('[capFindIn,capMarkRange,capFindAll,capRenderFind,advCheck,extraSave].map(String).join("")');
chk('no HTML sinks in the new code',!/innerHTML|insertAdjacentHTML|outerHTML|document\.write/.test(src));
chk('ZERO uncaught errors',w.errs.length===0,w.errs.join(' | '));
console.log(`\nPASS ${pass}   FAIL ${fail}`);process.exit(fail?1:0);
})().catch(e=>{console.error('TEST CRASH:',e);process.exit(1);});
