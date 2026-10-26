// Wind lane (V1.4.0, CORE-17 preview): physics sanity of the illustrative lane model, station →
// lane-section mapping, live Calypso feed, storage sanitising, UI wiring, no HTML sinks.
// Usage: node lanetest.js <probe index.html>   (needs jsdom; see README.md)
const {JSDOM}=require('jsdom'),fs=require('fs');
const FILE=process.argv[2]||'../index.html',html=fs.readFileSync(FILE,'utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const chk=(n,ok,extra)=>{console.log((ok?'  PASS  ':'  FAIL  ')+n+(extra?'   '+extra:''));ok?pass++:fail++;};
function open(stored){
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',beforeParse(w){
    if(stored)w.localStorage.setItem('sen_lab_lane',stored);
    w.navigator.bluetooth={requestDevice:async()=>null,getAvailability:async()=>true};
    w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(t,k)=>k==='createLinearGradient'?()=>({addColorStop(){}}):()=>{}});
    w.alert=()=>{};}});
  const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));return w;
}
(async()=>{
console.log('=== WIND LANE TEST: '+FILE+' ===');
let w=open();await wait(150);const E=s=>w.eval(s);
const S=(f)=>E(`laneSolve(${f},100,280,0.128)`);
const uni=(wy)=>`(x=>[0,${wy}])`;

// physics
const calm=S(uni(0)),u3=S(uni(3));
chk('no wind: no sideways drift',Math.abs(calm.y)<1e-9);
const lag=3*(calm.t-100/280);
chk('uniform 3 m/s crosswind = lag-time rule w·(t − R/V0) within 1 %',Math.abs(u3.y-lag)/lag<0.01,`model ${(u3.y*1000).toFixed(2)} mm · lag rule ${(lag*1000).toFixed(2)} mm`);
chk('drift direction follows the wind (blows right → impact right)',u3.y>0&&S(uni(-3)).y<0&&Math.abs(S(uni(-3)).y+u3.y)<1e-9);
chk('time of flight plausible (Queen .25, 280 m/s, 100 m: 0.36–0.40 s)',calm.t>0.36&&calm.t<0.40,calm.t.toFixed(4)+' s');
const near=S('(x=>[0,x<50?3:0])'),far=S('(x=>[0,x>=50?3:0])');
chk('wind in the first half moves the impact more than the same wind in the second half',near.y>far.y&&Math.abs(near.y+far.y-u3.y)/u3.y<0.02,`${(near.y*1000).toFixed(1)} vs ${(far.y*1000).toFixed(1)} mm`);
const head=S('(x=>[-3,0])'),tail=S('(x=>[3,0])');
chk('pure headwind: no drift, longer flight; tailwind: shorter',Math.abs(head.y)<1e-9&&head.t>calm.t&&tail.t<calm.t);

// conventions + field
const v=JSON.parse(E('JSON.stringify([laneVec(3,90),laneVec(3,0),laneVec(3,270)])'));
chk('Calypso convention: 90° (from right) blows left, 0° is a headwind, 270° blows right',v[0][1]<-2.99&&Math.abs(v[0][0])<1e-9&&v[1][0]<-2.99&&v[2][1]>2.99);
const fld=JSON.parse(E(`JSON.stringify((()=>{const f=laneField([{x:10,wx:0,wy:1},{x:60,wx:0,wy:5}],'nearest'),g=laneField([{x:10,wx:0,wy:1},{x:60,wx:0,wy:5}],'blend');return[f(0)[1],f(34)[1],f(36)[1],f(100)[1],g(0)[1],g(35)[1],g(100)[1]];})())`));
chk('nearest: each station owns its half of the gap (boundary at 35 m)',fld[0]===1&&fld[1]===1&&fld[2]===5&&fld[3]===5);
chk('blend: constant outside the stations, linear between (3 m/s at 35 m)',fld[4]===1&&Math.abs(fld[5]-3)<1e-12&&fld[6]===5);
const same=JSON.parse(E(`JSON.stringify((()=>{const s=[{x:10,wx:0,wy:2},{x:60,wx:0,wy:2}];return[laneSolve(laneField(s,'nearest'),100,280,0.128).y,laneSolve(laneField(s,'blend'),100,280,0.128).y,laneSolve(x=>[0,2],100,280,0.128).y];})())`));
chk('both stations reading the same = one uniform wind (both modes, bit-identical)',same[0]===same[2]&&same[1]===same[2]);

// defaults, live feed, shares
E("LANE.st.forEach(s=>{s.gust=false;s.src='manual';});LANE.st[0].spd=3;LANE.st[0].dir=90;LANE.st[1].spd=3;LANE.st[1].dir=270;");
let r=JSON.parse(E('JSON.stringify(laneCompute(Date.now()))'));
chk('default layout: S1 left at 10 %, S2 right at 60 %',E("LANE.st[0].side==='L'&&LANE.st[0].pct===10&&LANE.st[1].side==='R'&&LANE.st[1].pct===60"));
chk('opposing winds: shares have opposite signs and add up to the total (±2 %)',r.share[0]<0&&r.share[1]>0&&Math.abs(r.share[0]+r.share[1]-r.sol.y)<0.02*Math.max(Math.abs(r.share[0]),Math.abs(r.share[1])),JSON.stringify(r.share.map(x=>+(x*1000).toFixed(2)))+' total '+(r.sol.y*1000).toFixed(2));
E(`DEVICES.push({n:7,label:'D7',name:'WDOT-E2896A',profile:'calypso',connected:true,st:{wind:{avg:6,dir:90,t:Date.now()}},ui:{}});LANE.st[1].src='7';`);
r=JSON.parse(E('JSON.stringify(laneCompute(Date.now()))'));
chk('live Calypso feeds its station (6 m/s from the right, state LIVE D7)',r.sw[1].spd===6&&r.sw[1].dir===90&&r.sw[1].state==='LIVE D7'&&r.sol.y<0);
E('DEVICES[DEVICES.length-1].st.wind.t=Date.now()-5000');
r=JSON.parse(E('JSON.stringify(laneCompute(Date.now()))'));
chk('stale live reading (>3 s) drops the station to calm, flagged LOST',r.sw[1].spd===0&&r.sw[1].state.startsWith('LOST'));
const g1=JSON.parse(E("LANE.st[0].gust=true;JSON.stringify([laneStationWind(LANE.st[0],0,1000),laneStationWind(LANE.st[0],0,4000)])"));
chk('gusts vary speed and direction around the slider values',g1[0].spd!==g1[1].spd&&g1[0].dir!==g1[1].dir&&g1[0].spd>0);

// UI
const d=w.document,click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
chk('five tabs incl. Lane; Lane hidden at start',['devices','capture','lane','log','data'].every(t=>d.getElementById('tb-'+t))&&d.getElementById('tab-lane').hidden);
click(d.getElementById('tb-lane'));await wait(400);
chk('Lane tab shows and animates (readouts filled)',!d.getElementById('tab-lane').hidden&&E('LV.on')&&/mm|\d/.test(d.getElementById('lnDrift').textContent)&&d.getElementById('lnDrift').textContent!=='—',d.getElementById('lnDrift').textContent);
chk('two station panels with a Live option for each connected Calypso',d.querySelectorAll('#lanest .panel').length===2&&[...d.querySelectorAll('.lnsrc')[0].options].some(o=>o.textContent.includes('D7 WDOT-E2896A')));
const len=d.getElementById('lnLen');len.value='50';len.dispatchEvent(new w.Event('input'));
const mode=d.getElementById('lnMode');mode.value='blend';mode.dispatchEvent(new w.Event('change'));
chk('lane settings saved to the Lab namespace',JSON.parse(w.localStorage.getItem('sen_lab_lane')).len===50&&JSON.parse(w.localStorage.getItem('sen_lab_lane')).mode==='blend');
click(d.getElementById('tb-log'));await wait(50);
chk('leaving the tab stops the animation',!E('LV.on'));
chk('no uncaught errors',w.errs.length===0,w.errs.join('; '));
w.close();

// storage sanitising
w=open(JSON.stringify({len:1e9,mv:'x',bc:-1,mode:'evil',st:[{name:'<img src=x onerror=alert(1)>'.repeat(3),side:'Q',pct:500,spd:-4,dir:999,src:7},{}]}));await wait(150);
const L=JSON.parse(w.eval('JSON.stringify(LANE)'));
chk('stored settings clamped and whitelisted',L.len===1000&&L.mv===280&&L.bc===0.02&&L.mode==='nearest'&&L.st[0].pct===99&&L.st[0].spd===0&&L.st[0].dir===359&&L.st[0].side==='L'&&L.st[0].src==='manual'&&L.st[0].name.length===16&&L.st[1].pct===60);
chk('no HTML sinks in the page script',!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(html.replace(/\/\*[\s\S]*?\*\//g,'')));
w.close();
console.log(`\nPASS ${pass}   FAIL ${fail}`);process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
