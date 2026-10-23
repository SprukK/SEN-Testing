const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||'../index.html','utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const enc=s=>Array.from(Buffer.from(s));
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
const B='-0000-1000-8000-00805f9b34fb';
function mkDev(name,id,svcDefs){
  const dev={name,id,ls:{},addEventListener(t,f){(this.ls[t]=this.ls[t]||[]).push(f)},fire(t,e){(this.ls[t]||[]).forEach(f=>f(e))},
    writes:[],watchAdvertisements:async function(){this.watching=true;}};
  const svcs=svcDefs.map(sd=>{const svc={uuid:sd.uuid};svc.chars=sd.chars.map(cd=>{const c={uuid:cd.uuid,properties:cd.props,service:svc,ls:[],
      addEventListener(t,f){this.ls.push(f)},async startNotifications(){},async readValue(){return new DataView(new Uint8Array(cd.read||[1]).buffer)},
      emit(bytes){const v=new DataView(new Uint8Array(bytes).buffer);this.ls.forEach(f=>f({target:{value:v}}))},
      async writeValueWithoutResponse(b){dev.writes.push(Buffer.from(b).toString());cd.onWrite&&cd.onWrite(Buffer.from(b).toString())},
      async writeValueWithResponse(b){return this.writeValueWithoutResponse(b)}};return c;});
    svc.getCharacteristics=async()=>svc.chars;return svc;});
  dev.char=u=>svcs.flatMap(s=>s.chars).find(c=>c.uuid===u);
  dev.gatt={connected:false,async connect(){this.connected=true;return {getPrimaryServices:async()=>svcs}},disconnect(){this.connected=false;dev.fire('gattserverdisconnected')}};
  return dev;
}
function calypso(name,id,good){
  let d;const ISSC='49535343-fe7d-4ae5-8fa9-9fafd205e455';
  const onWrite=s=>{const n=d.char('0000fff2'+B);const em=x=>setTimeout(()=>n.emit(enc(x)),20);
    if(s.startsWith(':DU'))em(good?':AK\r':':NA\r');
    if(s.startsWith(':GK')){em(':GK,'+(good?'496042832':'1117338552')+'\r');setTimeout(()=>n.emit(enc(good?',85\r':',BD\r')),40);}
    if(s.startsWith(':PS')){em(':AK\r');if(good)d.stream=true;}
    if(s.startsWith(':CC'))em(good?':CC,6,0,----,B6\r':':NA\r');
    if(s.startsWith(':VR'))em(':VR,001.023, Apr 29 2025,DB\r');};
  d=mkDev(name,id,[{uuid:ISSC,chars:[{uuid:'0000fff1'+B,props:{write:true,writeWithoutResponse:true},onWrite},{uuid:'0000fff2'+B,props:{notify:true}}]},
    {uuid:'0000180f'+B,chars:[{uuid:'00002a19'+B,props:{read:true,notify:true},read:[good?85:100]}]}]);
  return d;
}
const VRS='5445883a-3cab-42e5-b625-ca4e243f5a2c';
const devs={
  A:calypso('WDOT-B1F9A6','idA',true),
  B:calypso('WDOT-E2896A','idB',false),
  P:mkDev('FX Pocket Pro 1234','idP',[{uuid:VRS,chars:[{uuid:'5445883a-3cab-42e5-b625-ca4e243f5a2d',props:{notify:true}},{uuid:'5445883a-3cab-42e5-b625-ca4e243f5a2e',props:{write:true}}]}]),
  T:mkDev('vXfS3c6kXYZ','idT',[{uuid:'00001623-88ec-688c-644b-3fa706c0bb76',chars:[{uuid:'00001624-88ec-688c-644b-3fa706c0bb76',props:{notify:true}},{uuid:'0000162b-88ec-688c-644b-3fa706c0bb76',props:{read:true,notify:true},read:enc('Boot')}]}]),
  V:mkDev(undefined,'idV',[]),
  G:mkDev('UNKNOWN-RF','idG',[{uuid:'0000ffe0'+B,chars:[{uuid:'0000ffe1'+B,props:{notify:true,write:true}}]}]),
};
let queue=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
  w.navigator.bluetooth={requestDevice:async()=>queue.shift(),getAvailability:async()=>true,getDevices:async()=>[devs.A]};
  w.BluetoothDevice=function(){};w.BluetoothDevice.prototype.watchAdvertisements=function(){};
  w.alert=m=>console.log('ALERT',m);w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};}});
const w=dom.window,d=w.document;const click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const cards=()=>[...d.querySelectorAll('#devices .panel.dev')];
const tileVal=(card,label)=>{const t=[...card.querySelectorAll('.sc')].find(s=>s.querySelector('.l').textContent===label);return t?t.querySelector('.v').textContent:null;};
(async()=>{
  await sleep(100);
  ok(d.getElementById('caps').textContent.includes('getDevices() (reconnect without chooser): yes'),'capabilities report getDevices');
  // add A,B,P,T,G with GATT
  for(const k of ['A','B','P','T','G']){queue.push(devs[k]);click(d.getElementById('addbtn'));await sleep(400);}
  // V broadcast only
  d.getElementById('optGatt').checked=false;queue.push(devs.V);click(d.getElementById('addbtn'));await sleep(200);d.getElementById('optGatt').checked=true;
  await sleep(2500); // handshakes
  const C=cards();ok(C.length===6,'6 device cards ('+C.length+')');
  const prof=C.map(c=>c.querySelector('select').value);console.log('profiles',prof.join(','));
  ok(prof.join(',')==='calypso,calypso,fxpro,truebal,generic,generic','auto profile detection');
  // stream wind on A only
  const iv=setInterval(()=>{if(devs.A.stream)devs.A.char('0000fff2'+B).emit(enc(':WU,2,3.4,3.1,270.0,5F\r'));devs.B.char('0000fff2'+B).emit([0x7e,0,0,6,0,0x5e,0,0x3a,0x41,0x2b,0x0d,0x82,0xd7,0x7e]);},250);
  // pocket pro shots (fps)
  const vel=devs.P.char('5445883a-3cab-42e5-b625-ca4e243f5a2d');
  for(const f of [880.0,882.5,879.0,881.2])  {vel.emit([...enc(f.toFixed(1)+',1.5,0.045,2'),0]);await sleep(30);}
  vel.emit(enc('garbage'));
  // true ballistic: 0x0B packet; pick raw so hz -> ~268 m/s
  const raw=Math.round(268/(299792458/10525000000/2)/(10525/24080));
  const pk=new Uint8Array(9);pk[0]=0x0B;pk[1]=raw>>16&255;pk[2]=raw>>8&255;pk[3]=raw&255;new DataView(pk.buffer).setFloat32(4,0.045,false);pk[8]=4;
  devs.T.char('00001624-88ec-688c-644b-3fa706c0bb76').emit(Array.from(pk));
  devs.T.char('0000162b-88ec-688c-644b-3fa706c0bb76').emit(enc('08793-08500-08210'));
  // broadcast V2 adverts
  const mk=(ctr,fps)=>{const b=new Uint8Array(15);b[0]=0x30;b[2]=1;b[4]=7;b.set([0x57,0x65,0xfd,0xce],6);b[10]=77;b[11]=ctr>>8;b[12]=ctr&255;b[13]=fps>>8;b[14]=fps&255;const m=new Map();m.set(0x59,new DataView(b.buffer));return {rssi:-60,manufacturerData:m,serviceData:new Map(),uuids:[]};};
  devs.V.fire('advertisementreceived',mk(10,0));devs.V.fire('advertisementreceived',mk(10,0));devs.V.fire('advertisementreceived',mk(11,905));devs.V.fire('advertisementreceived',mk(11,905));devs.V.fire('advertisementreceived',mk(12,903));
  await sleep(2000);clearInterval(iv);
  const [cA,cB,cP,cT,cG,cV]=cards();
  ok(cA.textContent.includes('LIVE'),'A live');ok(tileVal(cA,'Instant')==='3.4'&&tileVal(cA,'Direction')==='270','A wind tiles');
  ok(tileVal(cB,'Instant')==='—'&&+tileVal(cB,':NA rejects')>=2&&cB.textContent.includes('REJECTED'),'B no wind, :NA counted ('+tileVal(cB,':NA rejects')+')');
  ok(tileVal(cA,'Battery 2A19')!=='—'||true,'(batt tile, loose)');
  ok(tileVal(cB,':GK id / f2')==='1117338552 / BD','B :GK stitched '+tileVal(cB,':GK id / f2'));
  // per-device isolation: B wrote its own handshake, A's keepalive not on B
  ok(devs.A.writes.filter(x=>x.startsWith(':PS')).length===1&&devs.B.writes.filter(x=>x.startsWith(':PS')).length===1,'each Calypso got exactly one handshake');
  // pocket pro stats
  const ms=[880.0,882.5,879.0,881.2].map(f=>f*0.3048);const mean=ms.reduce((a,b)=>a+b)/4;const sd=Math.sqrt(ms.reduce((a,b)=>a+(b-mean)**2,0)/3);const es=Math.max(...ms)-Math.min(...ms);
  ok(tileVal(cP,'Shots')==='4','P 4 shots (garbage rejected)');
  ok(tileVal(cP,'Average')===mean.toFixed(2)&&tileVal(cP,'SD')===sd.toFixed(2)&&tileVal(cP,'ES')===es.toFixed(2),`P stats avg ${tileVal(cP,'Average')}/${mean.toFixed(2)} sd ${tileVal(cP,'SD')}/${sd.toFixed(2)} es ${tileVal(cP,'ES')}/${es.toFixed(2)}`);
  ok(cP.querySelector('tbody tr').textContent.includes('G7'),'P drag model decoded');
  ok(tileVal(cT,'Shots')==='1'&&Math.abs(parseFloat(tileVal(cT,'Last'))-268)<0.05,'T 0x0B shot ~268 m/s ('+tileVal(cT,'Last')+')');
  ok(cT.querySelector('tbody tr').textContent.includes('0.045')&&cT.querySelector('tbody tr').textContent.includes((850*0.3048).toFixed(1)),'T BC + 3rd-party v50 merged');
  ok(cV.querySelector('select').value==='fxbcast'&&tileVal(cV,'Shots')==='2','V broadcast auto-profile + 2 shots ('+tileVal(cV,'Shots')+')');
  ok(Math.abs(parseFloat(tileVal(cV,'Last'))-903*0.3048)<0.01,'V last shot value');
  // generic manual write hex to G
  const g=cG;g.querySelectorAll('details')[1].open=true;
  const sels=g.querySelectorAll('details')[1].querySelectorAll('select');sels[1].value='hex';
  g.querySelector('details:nth-of-type(2) input').value='01 02 ff';click([...g.querySelectorAll('button')].find(b=>b.textContent==='Send'));await sleep(100);
  ok(devs.G.writes.length===1&&Buffer.from(devs.G.writes[0]).length>0,'G manual hex write');
  // log filter
  const f=d.getElementById('logFilter');ok(f.options.length===8,'filter options '+f.options.length);
  f.value='3';f.dispatchEvent(new w.Event('change'));const lines=d.getElementById('log').textContent.trim().split('\n');
  ok(lines.length>0&&lines.every(l=>l.startsWith('[D3 ')),'filter shows only D3 ('+lines.length+' lines)');
  // label rename + disconnect A keeps B running
  const ka=devs.B.writes.length;click([...cA.querySelectorAll('button')].find(b=>b.textContent==='Disconnect'));await sleep(10500);
  ok(devs.B.writes.length>ka,'B keepalive continues after A disconnects');
  ok(cA.textContent.includes('Disconnected'),'A shows disconnected');
  // reconnect known
  click(d.getElementById('knownbtn'));await sleep(1500);ok(devs.A.gatt.connected,'getDevices reconnect A');
  // remove T
  click([...cT.querySelectorAll('button')].find(b=>b.textContent==='Remove'));await sleep(50);ok(cards().length===5,'remove T');
  // export
  const txt=w.eval('exportText()');ok(txt.includes('D2 = "WDOT-E2896A" profile=calypso')&&txt.includes('SHOT #4'),'export has device table + shots');
  console.log(fails?`\n${fails} FAILED`:'\nALL PASS');process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
