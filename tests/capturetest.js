// Tabs + capture test (Probe V1.3.0, LAB-03). Real page in jsdom with simulated BLE devices:
// four tabs as sections of one page (devices stay connected across tab switches, remembered tab),
// status strip, capture session with the FX angle-test markers, every notification recorded even
// when the log collapses it, byte-change detection since the last marker, poll/read-all, GATT
// dump, JSON + text export, stop, nothing written to devices, no HTML sinks.
// Usage: node capturetest.js <probe index.html>   (needs jsdom)
const {JSDOM}=require('jsdom'),fs=require('fs');
const FILE=process.argv[2]||'../index.html';
const html=fs.readFileSync(FILE,'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;
const chk=(n,ok,extra)=>{console.log((ok?'  PASS  ':'  FAIL  ')+n+(extra?'   '+extra:''));ok?pass++:fail++;};
const B='-0000-1000-8000-00805f9b34fb';
function mkDev(name,id,svcDefs){
  const dev={name,id,ls:{},writes:[],addEventListener(t,f){(this.ls[t]=this.ls[t]||[]).push(f)},fire(t,e){(this.ls[t]||[]).forEach(f=>f(e))},watchAdvertisements:async function(){}};
  const svcs=svcDefs.map(sd=>{const svc={uuid:sd.uuid};svc.chars=sd.chars.map(cd=>({uuid:cd.uuid,properties:cd.props,service:svc,ls:[],cd,
      addEventListener(t,f){this.ls.push(f)},async startNotifications(){},async readValue(){return new DataView(new Uint8Array(cd.read||[1]).buffer)},
      emit(bytes){const v=new DataView(new Uint8Array(bytes).buffer);this.ls.forEach(f=>f({target:{value:v}}))},
      async writeValueWithoutResponse(b){dev.writes.push(b)},async writeValueWithResponse(b){dev.writes.push(b)}}));
    svc.getCharacteristics=async()=>svc.chars;return svc;});
  dev.char=u=>svcs.flatMap(s=>s.chars).find(c=>c.uuid===u);
  dev.gatt={connected:false,async connect(){this.connected=true;return{getPrimaryServices:async()=>svcs}},disconnect(){this.connected=false;dev.fire('gattserverdisconnected')}};
  return dev;
}
const VRS='5445883a-3cab-42e5-b625-ca4e243f5a2c',VEL='5445883a-3cab-42e5-b625-ca4e243f5a2d',ANG='5445883a-3cab-42e5-b625-ca4e243f5a2f';
// FX Pocket Pro with an extra notify characteristic (stand-in for an undecoded angle/sensor stream) and a readable one (temperature-like)
const env={read:[0x14,0x00,0x41]};
const P=mkDev('FX Pocket Pro 1234','idP',[{uuid:VRS,chars:[{uuid:VEL,props:{notify:true}},{uuid:ANG,props:{notify:true}},{uuid:'5445883a-3cab-42e5-b625-ca4e243f5a2e',props:{write:true}}]},
  {uuid:'0000181a'+B,chars:[{uuid:'00002a6e'+B,props:{read:true},read:env.read}]}]);
const C=mkDev('WDOT-B1F9A6','idC',[{uuid:'49535343-fe7d-4ae5-8fa9-9fafd205e455',chars:[{uuid:'0000fff1'+B,props:{write:true,writeWithoutResponse:true}},{uuid:'0000fff2'+B,props:{notify:true}}]}]);
let queue=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://sprukk.github.io/SEN-Testing/',beforeParse(w){
  w.navigator.bluetooth={requestDevice:async()=>queue.shift(),getAvailability:async()=>true,getDevices:async()=>[]};
  w.BluetoothDevice=function(){};w.BluetoothDevice.prototype.watchAdvertisements=function(){};
  w.alert=()=>{};w.downloads=[];w.URL.createObjectURL=b=>{w.downloads.push(b);return 'blob:x';};w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){w.lastDownload=this.download;};}});
const w=dom.window,d=w.document;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));
const click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const $=id=>d.getElementById(id);
const shown=t=>!$('tab-'+t).hidden;
const sumRows=()=>[...d.querySelectorAll('#capsum tr')].map(r=>[...r.children].map(c=>c.textContent));
const blobText=b=>new Promise(r=>{const fr=new w.FileReader();fr.onload=()=>r(fr.result);fr.readAsText(b);});

(async()=>{
console.log('=== CAPTURE TEST: '+FILE+' ===');
await sleep(150);
// 1. Tabs.
chk('four tabs, Devices shown first, others hidden',['tb-devices','tb-capture','tb-log','tb-data'].every(id=>$(id))&&shown('devices')&&!shown('capture')&&!shown('log')&&!shown('data'));
d.getElementById('optInit').checked=false;   // no Calypso handshake writes in this test
for(const dv of [P,C]){queue.push(dv);click($('addbtn'));await sleep(900);}
const strip=()=>[...d.querySelectorAll('#strip .chip')].map(c=>c.textContent+(c.querySelector('.dot.on')?'+':''));
chk('status strip: both devices, connected',strip().join()==='D1+,D2+',strip().join());
click($('tb-log'));await sleep(20);
chk('Log tab shows the timeline, Devices hidden',shown('log')&&!shown('devices')&&/Added "FX Pocket Pro 1234"/.test($('log').textContent));
click($('tb-data'));click($('tb-capture'));await sleep(20);
chk('switching tabs keeps devices connected (one page, no navigation)',P.gatt.connected&&C.gatt.connected&&w.location.href==='https://sprukk.github.io/SEN-Testing/');
chk('tab remembered in the Lab namespace',w.localStorage.getItem('sen_lab_tab')==='capture');

// 2. Capture session with the FX angle-test preset.
chk('capture lists both devices, preset FX angle test, markers disabled until started',d.querySelectorAll('#capdevs input').length===2&&$('cappreset').value==='fxangle'&&[...d.querySelectorAll('#capmarks button')].every(b=>b.disabled));
d.querySelectorAll('#capdevs input')[1].checked=false;   // FX only
$('capname').value='FX angle test 1';click($('capstart'));await sleep(20);
const marks=[...d.querySelectorAll('#capmarks button')];
chk('started: 8 preset markers enabled, strip shows recording',marks.map(b=>b.textContent).join('|')==='Level|Pitch up ~10°|Pitch down ~10°|Level|Cant left ~10°|Cant right ~10°|Level|Shot'&&marks.every(b=>!b.disabled)&&/●/.test(strip()[0]));
const ang=P.char(ANG),vel=P.char(VEL);
ang.emit([0x00,0x00,0x10,0x27]);await sleep(10);
click(marks[0]);                                   // Level
ang.emit([0x00,0x00,0x10,0x27]);await sleep(10);
ang.emit([0xE8,0x03,0x10,0x27]);await sleep(300);   // pitch: bytes 0..1 change
let row=sumRows().find(r=>/^D1 5445883a…5a2f/.test(r[0])||/5a2f/.test(r[0]));
chk('after "Level", pitching changes bytes 0,1 of the unknown characteristic',row&&row[3]==='bytes 0,1'&&row[1]==='3',JSON.stringify(row));
click(marks[1]);ang.emit([0xE8,0x03,0x10,0x27]);await sleep(300);
row=sumRows().find(r=>/5a2f/.test(r[0]));
chk('…holding the new position after "Pitch up" → same',row&&row[3]==='same',JSON.stringify(row));
// FX shot on the velocity characteristic still decodes AND is recorded
vel.emit(Array.from(Buffer.from('880.5,1.2,0.025,1')));await sleep(300);
chk('shot still decoded on the device card and recorded in the capture',w.eval("DEVICES[0].shots.length")===1&&sumRows().some(r=>/VRS velocity/.test(r[0])));
// Calypso (not ticked) traffic is not recorded
C.char('0000fff2'+B).emit([0x7e,0x3a,0x41,0x2b,0x0d,0x7e]);await sleep(300);
chk('unticked device not recorded',!sumRows().some(r=>/^D2/.test(r[0])));

// 3. Read all + poll + GATT dump.
click($('capreadbtn'));await sleep(450);
chk('Read all records readable characteristics',sumRows().some(r=>/2a6e \(read\)/.test(r[0])&&r[2]==='14 00 41'));
click($('capdumpbtn'));await sleep(20);
chk('GATT dump lists services, characteristics and properties',/SVC 5445883a-3cab-42e5-b625-ca4e243f5a2c/.test($('capdump').textContent)&&/CHR 5445883a-3cab-42e5-b625-ca4e243f5a2f \[notify\] subscribed/.test($('capdump').textContent)&&/CHR 00002a6e-0000-1000-8000-00805f9b34fb \[read\]/.test($('capdump').textContent));
$('capmarktxt').value='Rifle on bipod';click($('capmarkbtn'));

// 4. Stop + export.
click($('capstart'));await sleep(20);
const nEv=w.eval('CAP.events.length');ang.emit([1,2,3,4]);await sleep(50);
chk('stop: no more recording, markers disabled',w.eval('CAP.events.length')===nEv&&[...d.querySelectorAll('#capmarks button')].every(b=>b.disabled)&&!/●/.test(strip()[0]));
click($('capsavebtn'));await sleep(20);
const js=JSON.parse(await blobText(w.downloads[w.downloads.length-1]));
chk('JSON export: session, device with services/characteristics, markers in order, events',js.session==='FX angle test 1'&&js.version===w.eval('VERSION')&&js.devices.length===1&&js.devices[0].characteristics.length===4&&
  js.markers.map(m=>m.text).join('|')==='Start|Level|Pitch up ~10°|Rifle on bipod|Stop'&&js.events.some(e=>e.kind==='rx'&&e.hex==='e8 03 10 27')&&/^sen-capture-.*\.json$/.test(w.lastDownload),js.markers.map(m=>m.text).join('|'));
click($('captxtbtn'));await sleep(20);
const tx=await blobText(w.downloads[w.downloads.length-1]);
chk('text export: chronological with marker lines',/===== Level =====/.test(tx)&&tx.indexOf('===== Level =====')<tx.indexOf('e8 03 10 27')&&/\.txt$/.test(w.lastDownload));

// 5. Safety.
chk('capture never wrote to a device',P.writes.length===0&&C.writes.length===0);
chk('no innerHTML in the page script',!/\.innerHTML\s*=/.test(html));
w.eval("CAP.on=true;CAP.devs=[DEVICES[0].n]");$('capmarktxt').value='<img src=x id=pwn>';click($('capmarkbtn'));w.eval('capRenderSummary();CAP.on=false');
chk('marker text is text, not HTML',!d.getElementById('pwn'));
chk('ZERO uncaught errors',w.errs.length===0,w.errs.slice(0,3).join(' / '));
console.log('\nPASS '+pass+'   FAIL '+fail);
process.exit(fail?1:0);
})().catch(e=>{console.error('TEST CRASH:',e);process.exit(1);});
