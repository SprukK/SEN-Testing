// Device profile test (Probe V1.7.0): Element Titan / Helix and AEA BC1500 rangefinders, LabRadar LX chronograph.
// Simulated devices replay the owner's real captures (2026-10-30/31):
//  · Element: Nordic UART, the five confirmed rangings 25.0 / 5.9 / 42.9 / 39.8 / 1134.5 m at −1 / −13 / +31 / +5 / +5°.
//  · AEA: DSPS, text lines split across notifications, yards, the "#point#" JSON line, a distance without its angle.
//  · LabRadar: checks the CRC of every frame the Lab sends (CRC written here independently), answers like the
//    real unit (0x86 info, 0x9A 00 only for the app key, event 0x27 series 57), then replays the three real
//    event-0x20 shot frames cut into 20-byte notifications plus one frame with a broken CRC.
// Values are checked against the LabRadar CSV export (Series57: V0 998.29 / 997.86 / 999.69 ft/s,
// V@25 m 887.87 / 889.06 / 894.55 ft/s, 25.3 gr). Rangefinders never receive a write; the LabRadar only with
// auto-initialise or the button. No HTML sinks.
// Usage: node profiletest.js <probe index.html>   (needs jsdom)
const {JSDOM}=require('jsdom'),fs=require('fs');
const FILE=process.argv[2]||'../index.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;
const chk=(n,ok,extra)=>{console.log((ok?'  PASS  ':'  FAIL  ')+n+(extra?'   '+extra:''));ok?pass++:fail++;};
const hex=s=>s.replace(/\s/g,'').match(/../g).map(x=>parseInt(x,16));
const NUS='6e400001-b5a3-f393-e0a9-e50e24dcca9e',NUS_TX='6e400003-b5a3-f393-e0a9-e50e24dcca9e',NUS_RX='6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const DSPS='0783b03e-8535-b5a0-7140-a304d2495cb7',DSPS_TX='0783b03e-8535-b5a0-7140-a304d2495cb8',DSPS_RX='0783b03e-8535-b5a0-7140-a304d2495cba';
const LR='da2b84f1-6279-48de-bdc0-afbea0226079',LR_CMD='bf03260c-7205-4c25-af43-93b1c299d159',LR_EVT='18cda784-4bd3-4370-85bb-bfed91ec86af',LR_EN='a87988b9-694c-479c-900e-95dfa6c00a24';
// Independent CRC (bitwise, MSB-first form of the reflected CCITT CRC: reflect in/out, poly 0x1021, init 0xBEEF reflected = 0xF77D,
// xorout 0xFFFF) — written differently from the app on purpose.
const rev=(x,n)=>{let r=0;for(let i=0;i<n;i++)if(x&(1<<i))r|=1<<(n-1-i);return r;};
function crcRef(bytes){let c=rev(0xBEEF,16);for(const b of bytes){c^=rev(b,8)<<8;for(let i=0;i<8;i++)c=(c&0x8000)?((c<<1)^0x1021)&0xffff:(c<<1)&0xffff;}return rev(c,16)^0xffff;}
const KEY=hex('72d564ce01f0e26a7b323b6c9c30a20a865b444908815e509c653c7f3b897f6f1134126c750d7ff1798577a156a02e2bf985523fa2a3c8e6a288f0e109524fe9');
const SHOTS=['012000000000004241c80000bf800000bf800000bf800000bf800000439823a043874f86bf800000bf800000bf800000bf80000041b3b4523fd1d8443cf548db3c7831810000390100012497',
  '012000000000004241c80000bf800000bf800000bf800000bf8000004398130c43877e2fbf800000bf800000bf800000bf80000041b3f24a3fd1d8443cfa10383c7c9aca00003902000160ea',
  '012000000000004241c80000bf800000bf800000bf800000bf80000043985a7343885483bf800000bf800000bf800000bf80000041b50ef03fd1d8443d03d11e3c84245e0000390300019f8f'].map(hex);
const CSV=[[998.29,887.87],[997.86,889.06],[999.69,894.55]];
function mkDev(name,id,svcDefs){
  const dev={name,id,ls:{},writes:[],addEventListener(t,f){(this.ls[t]=this.ls[t]||[]).push(f)},fire(t,e){(this.ls[t]||[]).forEach(f=>f(e))},watchAdvertisements:async function(){}};
  const svcs=svcDefs.map(sd=>{const svc={uuid:sd.uuid};svc.chars=sd.chars.map(cd=>({uuid:cd.uuid,properties:cd.props,service:svc,ls:[],
      addEventListener(t,f){this.ls.push(f)},async startNotifications(){},async readValue(){return new DataView(new Uint8Array([0]).buffer)},
      emit(bytes){const v=new DataView(new Uint8Array(bytes).buffer);this.ls.forEach(f=>f({target:{value:v}}))},
      async writeValueWithoutResponse(b){const a=Array.from(new Uint8Array(b.buffer||b));dev.writes.push({ch:cd.uuid,b:a});cd.onWrite&&cd.onWrite(a);},
      async writeValueWithResponse(b){return this.writeValueWithoutResponse(b);}}));
    svc.getCharacteristics=async()=>svc.chars;return svc;});
  dev.char=u=>svcs.flatMap(s=>s.chars).find(c=>c.uuid===u);
  dev.gatt={connected:false,async connect(){this.connected=true;return{getPrimaryServices:async()=>svcs}},disconnect(){this.connected=false;dev.fire('gattserverdisconnected')}};
  return dev;
}
const element=(name,id)=>mkDev(name,id,[{uuid:NUS,chars:[{uuid:NUS_TX,props:{notify:true}},{uuid:NUS_RX,props:{write:true,writeWithoutResponse:true}}]}]);
const aea=()=>mkDev('AEA-BC1500','idA',[{uuid:DSPS,chars:[{uuid:DSPS_TX,props:{notify:true}},{uuid:DSPS_RX,props:{write:true,writeWithoutResponse:true}}]}]);
function labradar(id,acceptKey){
  let d;const sim={bad:0,frames:[],enabled:false};
  const frame=(cmd,seq,p)=>{const f=[1,cmd,seq>>8,seq&255,0,0,(p.length>>8)&255,p.length&255,...p];const c=crcRef(f);return [...f,c>>8,c&255];};
  const send=f=>{const n=d.char(LR_EVT);setTimeout(()=>{for(let i=0;i<f.length;i+=20)n.emit(f.slice(i,i+20));},10);};
  const onCmd=b=>{
    if(b[0]!==1||crcRef(b.slice(0,-2))!==((b[b.length-2]<<8)|b[b.length-1])){sim.bad++;return;}
    const cmd=b[1],seq=(b[2]<<8)|b[3],p=b.slice(8,-2);sim.frames.push(cmd);
    if(!sim.enabled)return; // the real unit ignores commands before the enable byte (assumed — the app always sends it first)
    if(cmd===0x06)send(frame(0x86,seq,hex('00000000000000000104032001000020')));
    if(cmd===0x1a){const ok=acceptKey&&p.length===64&&p.every((x,i)=>x===KEY[i]);send(frame(0x9a,seq,[ok?0:1]));if(ok)setTimeout(()=>send(frame(0x27,0,[0,0x39])),30);}
    if(cmd===0x01)send(frame(0x81,seq,new Array(26).fill(0)));
  };
  d=mkDev('LLXA001Y6EP',id,[{uuid:LR,chars:[{uuid:LR_CMD,props:{write:true},onWrite:onCmd},{uuid:LR_EVT,props:{notify:true,indicate:true,read:true}},
    {uuid:LR_EN,props:{read:true,write:true},onWrite:b=>{if(b.length===1&&b[0]===1)sim.enabled=true;}}]}]);
  d.sim=sim;d.send=send;d.frame=frame;return d;
}
let queue=[];
function open(){
  const dom=new JSDOM(fs.readFileSync(FILE,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://sprukk.github.io/SEN-Testing/',beforeParse(w){
    w.navigator.bluetooth={requestDevice:async()=>queue.shift(),getAvailability:async()=>true,getDevices:async()=>[]};
    w.BluetoothDevice=function(){};w.BluetoothDevice.prototype.watchAdvertisements=function(){};w.alert=()=>{};w.confirm=()=>true;}});
  const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));return w;
}
(async()=>{
console.log('=== DEVICE PROFILE TEST: '+FILE+' ===');
const w=open();await sleep(150);
const d=w.document,$=id=>d.getElementById(id),click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const cards=()=>[...d.querySelectorAll('#devices .panel.dev')];
const prof=i=>cards()[i].querySelector('select').value;
const tileV=(card,l)=>{const t=[...card.querySelectorAll('.sc')].find(s=>s.querySelector('.l').textContent===l);return t?t.querySelector('.v').textContent:null;};
const rows=card=>[...card.querySelectorAll('table.shots tbody tr')].map(r=>[...r.children].map(c=>c.textContent));
const add=async dev=>{queue.push(dev);click($('addbtn'));await sleep(600);};
// ── Element ──────────────────────────────────────────────────────────────────────────────────────
const T=element('TITAN 3K','idT');await add(T);
chk('Element (NUS) → Element profile',prof(0)==='element');
for(const f of ['f5 00 fa ff','f5 00 3b f3','f5 01 ad 1f','f5 01 8e 05','f5 2c 51 05'])T.char(NUS_TX).emit(hex(f));
T.char(NUS_TX).emit(hex('aa 01 02'));await sleep(30);
const rT=rows(cards()[0]).reverse();
chk('five rangings decoded exactly as the display: 25.0 / 5.9 / 42.9 / 39.8 / 1134.5 m',rT.map(r=>r[2]).join(',')==='25.0,5.9,42.9,39.8,1134.5',rT.map(r=>r[2]).join(','));
chk('…angles −1 / −13 / +31 / +5 / +5°',rT.map(r=>r[4]).join(',')==='-1,-13,31,5,5');
chk('…yards column 1134.5 m = 1240.7 yd',rT[4][3]==='1240.7');
chk('a non-Element frame is logged, not counted',rT.length===5&&/not an Element ranging frame/.test($('log').textContent));
chk('tiles show the last ranging',tileV(cards()[0],'Distance')==='1134.5'&&tileV(cards()[0],'Angle')==='+5');
const H=element('Helix 1.5K','idH');await add(H);H.char(NUS_TX).emit(hex('f5 00 2e f0'));await sleep(20);
chk('Helix 1.5K → same profile, 4.6 m −16°',prof(1)==='element'&&rows(cards()[1])[0][2]==='4.6'&&rows(cards()[1])[0][4]==='-16');
// ── AEA ──────────────────────────────────────────────────────────────────────────────────────────
const A=aea();await add(A);
chk('AEA-BC1500 → AEA profile',prof(2)==='aea');
const tx=s=>A.char(DSPS_TX).emit([...Buffer.from(s)]);
tx('HTZGDDist :113.');tx('0m\r\nHTZGD');tx('Angle:+1\r\n');
tx('HTZGDDist :281.0m\r\nHTZGDAngle:+3\r\n');
tx('HTZGDDist :50.0y\r\n');tx('HTZGDDist :60.0m\r\nHTZGDAngle:-6\r\n'); // first distance never got its angle
tx('#point#{"distance":"96.0y","angle":5,"multiple":16,"compass":0,');tx('"longitude":0,"latitude":0}\r\n');
tx('#point#{broken json\r\n');await sleep(30);
const rA=rows(cards()[2]).reverse();
chk('text lines split across notifications: 113.0 m +1°, 281.0 m +3°',rA[0][2]==='113.0'&&rA[0][4]==='1'&&rA[1][2]==='281.0'&&rA[1][4]==='3',JSON.stringify(rA.slice(0,2)));
chk('a distance without its angle is kept with no angle (50.0 y = 45.7 m)',rA[2][2]==='45.7'&&rA[2][4]==='—'&&/50\.0y/.test(rA[2][5]));
chk('negative angle: 60.0 m −6°',rA[3][2]==='60.0'&&rA[3][4]==='-6');
chk('JSON #point# in yards: 96.0 y = 87.8 m, +5°, marked JSON',rA[4][2]==='87.8'&&rA[4][3]==='96.0'&&rA[4][4]==='5'&&/JSON/.test(rA[4][5]));
chk('broken JSON ignored, five rangings',rA.length===5);
chk('ZERO writes to the three rangefinders',T.writes.length+H.writes.length+A.writes.length===0);
// ── LabRadar ─────────────────────────────────────────────────────────────────────────────────────
chk('frame builder reproduces the app\'s real frames byte for byte (cmd 06 seq 010a, cmd 1a seq 010b with the key)',
  Array.from(w.eval('lrFrame(6,0x010a)')).join()===hex('0106010a000000001129').join()&&
  Array.from(w.eval('lrFrame(0x1a,0x010b,LR_KEY)')).join()===[...hex('011a010b00000040'),...KEY,0x30,0x31].join());
const L=labradar('idL',true);await add(L);await sleep(500);
const cL=cards()[3];
chk('LabRadar service → LabRadar profile',prof(3)==='labradar');
chk('start sequence: enable byte 01 first, then cmd 06, 1a, then the status poll 01; every frame CRC-valid',
  L.writes[0].ch===LR_EN&&L.sim.frames.slice(0,3).join()==='6,26,1'&&L.sim.bad===0,L.sim.frames.join(',')+' bad '+L.sim.bad);
chk('app key accepted (0x9A 00), series 57 from event 0x27',tileV(cL,'App key')==='accepted'&&tileV(cL,'Series')==='57'&&tileV(cL,'Status polls')==='1');
L.send(L.frame(0x25,0,[1]));await sleep(40);
chk('event 0x25 01 → armed',tileV(cL,'Radar')==='armed');
for(const f of SHOTS){L.send(f);await sleep(40);}
const broken=SHOTS[0].slice();broken[20]^=0xff;L.send(broken);await sleep(40);
const rL=rows(cL).reverse();
const ms=(fps)=>(fps*0.3048).toFixed(2);
chk('three shots, V0 = CSV × 0.3048: '+CSV.map(c=>ms(c[0])).join(' / ')+' m/s',rL.length===3&&rL.every((r,i)=>r[2]===ms(CSV[i][0])),rL.map(r=>r[2]).join(','));
chk('…V at 25 m = CSV: '+CSV.map(c=>ms(c[1])).join(' / '),rL.every((r,i)=>r[4]===ms(CSV[i][1])&&r[5]==='25.0'),rL.map(r=>r[4]).join(','));
chk('…mass 25.30 gr; series 57, shot 1/2/3 and power factor in the log',rL.every(r=>r[6]==='25.30')&&[1,2,3].every(i=>new RegExp('series 57 · shot '+i+' · PF 22\\.\\d\\d').test($('log').textContent)));
chk('frame with a broken CRC dropped and logged',/bad CRC dropped/.test($('log').textContent));
chk('shot stats: average and ES over the three',/^304\.\d\d$/.test(tileV(cL,'Average'))&&tileV(cL,'ES')==='0.56',tileV(cL,'ES'));
chk('the Lab sends no command other than 06, 1a, 01',L.sim.frames.every(c=>[6,26,1].includes(c)));
L.gatt.disconnect();await sleep(20);
chk('disconnect stops the status poll',w.eval('DEVICES[3].st.lrPoll')===null);
// ── auto-initialise off, wrong key ───────────────────────────────────────────────────────────────
const w2=open();await sleep(150);
const d2=w2.document,c2=()=>[...d2.querySelectorAll('#devices .panel.dev')];
d2.getElementById('optInit').checked=false;
const L2=labradar('idL2',false);queue.push(L2);d2.getElementById('addbtn').dispatchEvent(new w2.MouseEvent('click',{bubbles:true}));await sleep(700);
chk('auto-initialise off: ZERO writes to the LabRadar',L2.writes.length===0);
[...c2()[0].querySelectorAll('button')].find(b=>b.textContent==='Send start sequence').click();await sleep(500);
chk('"Send start sequence" by hand: unit that refuses the key → App key REJECTED, no status poll',tileV(c2()[0],'App key')==='REJECTED (1)'&&!L2.sim.frames.includes(1),tileV(c2()[0],'App key'));
const src=w.eval('[parseElement,aeaDist,aeaLine,lrCrc,lrFrame,lrTake,lrShot,buildRangeUI,addRange,renderRanges,lrTags,lrSend,lrStart,lrStartPoll,lrStopPoll,PROFILES.element.rx,PROFILES.aea.rx,PROFILES.labradar.rx,PROFILES.labradar.ui].map(String).join("")');
chk('no HTML sinks in the new code',!/innerHTML|insertAdjacentHTML|outerHTML|document\.write/.test(src));
const errs=[...w.errs,...w2.errs];
chk('ZERO uncaught errors',errs.length===0,errs.join(' | '));
console.log(`\nPASS ${pass}   FAIL ${fail}`);process.exit(fail?1:0);
})().catch(e=>{console.error('TEST CRASH:',e);process.exit(1);});
