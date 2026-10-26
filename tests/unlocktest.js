// V1.3.1: per-unit Calypso :DU unlock tokens (CAL_UNLOCK) + empty-service discovery retry.
// Simulated units only accept their own :DU; :CC and the :WU stream stay locked (:NA) until then,
// matching both real units (HCI snoop + probe logs, 2026-10-26).
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||'../index.html','utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const enc=s=>Array.from(Buffer.from(s));
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
const B='-0000-1000-8000-00805f9b34fb',ISSC='49535343-fe7d-4ae5-8fa9-9fafd205e455';
const T1=':DU,1668647648,A7',T2=':DU,1802347072,AF';
function calypso(name,id,accept,battEmptyFirst){
  const dev={name,id,ls:{},writes:[],unlocked:false,addEventListener(t,f){(this.ls[t]=this.ls[t]||[]).push(f)},fire(t,e){(this.ls[t]||[]).forEach(f=>f(e))}};
  const mkC=(uuid,props,extra)=>Object.assign({uuid,properties:props,ls:[],addEventListener(t,f){this.ls.push(f)},async startNotifications(){},
    async readValue(){return new DataView(new Uint8Array([90]).buffer)},emit(b){const v=new DataView(new Uint8Array(b).buffer);this.ls.forEach(f=>f({target:{value:v}}))}},extra);
  const fff2=mkC('0000fff2'+B,{notify:true});
  const em=x=>setTimeout(()=>fff2.emit(enc(x)),20);
  const fff1=mkC('0000fff1'+B,{write:true,writeWithoutResponse:true},{async writeValueWithoutResponse(b){
    const s=Buffer.from(b).toString();dev.writes.push(s);
    if(s.startsWith(':DU')){if(accept&&s.startsWith(accept)){dev.unlocked=true;em(':AK\r');}else em(':NA\r');}
    else if(s.startsWith(':CC'))em(dev.unlocked?':CC,6,0,----,B6\r':':NA\r');
    else if(s.startsWith(':GK')){em(':GK,1\r');setTimeout(()=>fff2.emit(enc(',85\r')),40);}
    else if(s.startsWith(':VR'))em(':VR,001.023, Apr 29 2025,DB\r');
    else em(':AK\r');},async writeValueWithResponse(b){return this.writeValueWithoutResponse(b)}});
  const batt=mkC('00002a19'+B,{read:true,notify:true});
  let battCalls=0;
  const svcs=[{uuid:ISSC,getCharacteristics:async()=>[fff1,fff2]},
    {uuid:'0000180f'+B,getCharacteristics:async()=>(battEmptyFirst&&battCalls++===0)?[]:[batt]}];
  fff1.service=fff2.service=svcs[0];batt.service=svcs[1];
  dev.fff2=fff2;dev.batt=batt;
  dev.gatt={connected:false,async connect(){this.connected=true;return {getPrimaryServices:async()=>svcs}},disconnect(){this.connected=false;dev.fire('gattserverdisconnected')}};
  return dev;
}
const devs=[
  calypso('WDOT-B1F9A6','u1',T1,false),   // unit #1: own token
  calypso('WDOT-E2896A','u2',T2,true),    // unit #2: own token; battery service empty on first discovery (seen on device)
  calypso('WDOT-123456','u3',T2,false),   // unlisted unit that happens to take a known token -> fallback
  calypso('WDOT-FFFFFF','u4',null,false), // unlisted unit, no token works
];
let queue=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
  w.navigator.bluetooth={requestDevice:async()=>queue.shift(),getAvailability:async()=>true,getDevices:async()=>[]};
  w.alert=m=>console.log('ALERT',m);w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};}});
const w=dom.window,d=w.document;const click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const cards=()=>[...d.querySelectorAll('#devices .panel.dev')];
const tileVal=(card,label)=>{const t=[...card.querySelectorAll('.sc')].find(s=>s.querySelector('.l').textContent===label);return t?t.querySelector('.v').textContent:null;};
const du=dev=>dev.writes.filter(s=>s.startsWith(':DU')).map(s=>s.trim());
(async()=>{
  await sleep(100);
  ok(w.eval('VERSION')==='1.3.1','version 1.3.1');
  for(const dv of devs){queue.push(dv);click(d.getElementById('addbtn'));await sleep(300);}
  await sleep(5000); // handshakes incl. fallback waits
  const iv=setInterval(()=>devs.forEach(dv=>{if(dv.unlocked)dv.fff2.emit(enc(':WU,2,3.4,3.1,270.0,5F\r'));}),250);
  devs[1].batt.emit([77]);
  await sleep(1200);clearInterval(iv);
  const [c1,c2,c3,c4]=cards();const logTxt=d.getElementById('log').textContent;
  if(process.env.DBG)console.log(logTxt);
  ok(du(devs[0]).join('|')===T1,'unit #1 sends only its own token ('+du(devs[0]).join('|')+')');
  ok(du(devs[1]).join('|')===T2,'unit #2 sends only its own token ('+du(devs[1]).join('|')+')');
  ok(c1.textContent.includes('LIVE')&&c2.textContent.includes('LIVE'),'both known units LIVE at the same time');
  ok(tileVal(c2,'Instant')==='3.4'&&tileVal(c2,'Direction')==='270','unit #2 wind tiles');
  ok(devs[0].writes.filter(s=>s.startsWith(':CC')).length>=1&&+tileVal(c1,':NA rejects')===0&&+tileVal(c2,':NA rejects')===0,'keepalive accepted after unlock (no :NA)');
  ok(du(devs[2]).join('|')===T1+'|'+T2&&c3.textContent.includes('LIVE'),'unlisted unit: fallback tries tokens until :AK');
  ok(logTxt.includes('add "WDOT-123456" to CAL_UNLOCK'),'fallback hit tells you to add the unit');
  ok(du(devs[3]).length===2&&!devs[3].unlocked&&c4.textContent.includes('REJECTED'),'no token works: every known token tried once, card REJECTED');
  ok(logTxt.includes('No known :DU token unlocks "WDOT-FFFFFF"'),'no-token hint logged');
  ok(devs.every(dv=>dv.writes.filter(s=>s.startsWith(':PS')).length===1),'rest of handshake still sent once per unit');
  ok(logTxt.includes('empty on first try, retried: 1 char(s)')&&tileVal(c2,'Battery 2A19')==='77','empty battery service retried, 2A19 subscribed');
  const steps=[...c2.querySelectorAll('.steps button')].map(b=>b.textContent);
  ok(steps[0]==='1 '+T2&&steps.length===7,'unit #2 step 1 button is its own token');
  ok(/innerHTML/.test(html.replace(/\/\*[\s\S]*?\*\//g,''))===false,'no innerHTML sinks');
  console.log(fails?`\n${fails} FAILED`:'\nALL PASS');process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
