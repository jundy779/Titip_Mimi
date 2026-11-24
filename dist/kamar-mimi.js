import {makeScene} from './mimi-scene.js';
const el=id=>document.getElementById(id),canvas=document.querySelector('canvas');
let scene;
try{scene=makeScene(canvas)}catch(error){console.warn('Kamar Mimi',error)}
el('fallback').hidden=!!scene;
const s={mode:'feed',catX:0,face:0,ballX:.9,ballY:.32,progress:0,drag:null,running:false,biting:false};
const modes={
 feed:['Seret biskuit ikan dari mangkuk ke mulut Mimi.','Suapi Mimi','Mimi mencium aroma ikan…'],
 wash:['Usap gelembung di bulu Mimi sampai bersih.','Usap bulu','Gelembungnya geli, hihi.'],
 chat:['Pilih cerita yang ingin kamu bagi dengan Mimi.','Pilih cerita','Sini, telinga Mimi siap.'],
 play:['Sentuh karpet untuk melempar benang ke sana.','Lempar benang','Mimi siap menangkap!']
};
let hearts=0;
try{hearts=Math.max(0,Number(localStorage.getItem('mimi-room-hearts-v2'))||0)}catch{}
el('score').textContent=hearts;
function reward(words){el('speech').textContent=words;hearts++;el('score').textContent=hearts;try{localStorage.setItem('mimi-room-hearts-v2',String(hearts))}catch{}}
const stories=[
 ['Hari ini capek','Mimi geser sedikit, sini rebahan bareng.','Mau dielus','Prrr… Mimi temenin di sini.'],
 ['Ada kabar baik','Wah! Mimi sampai tegak kupingnya.','Rayakan bareng','Tos kecil dari Mimi buat kamu!'],
 ['Kangen Mimi','Mimi juga kangen. Mau duduk dekat?','Duduk bareng','Sini, tempat sebelah Mimi hangat.']
];
function options(items){el('choices').replaceChildren();for(const [label,go] of items){const b=document.createElement('button');b.textContent=label;b.onclick=go;el('choices').append(b)}}
function talk(){options(stories.map(([label,reply,next,end])=>[label,()=>{el('speech').textContent=reply;options([[next,()=>{reward(end);options([]);el('action').hidden=false;el('action').focus()}]]);el('choices').firstChild.focus()}]));el('action').hidden=true}
let flight=null,biteEnd=0,lastRub=null;
function select(mode){Object.assign(s,{mode,catX:0,face:0,progress:0,drag:null,running:false,biting:false,ballX:.9,ballY:.32});flight=null;lastRub=null;biteEnd=0;
 const [hint,act,words]=modes[mode];el('hint').textContent=hint;el('action').textContent=act;el('action').hidden=false;el('speech').textContent=words;options([]);
 document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));if(mode==='chat')talk()}
function feed(){s.drag=null;s.biting=true;biteEnd=performance.now()+750;reward('Kriuk! Mimi suka bagian ekornya ♡')}
function rub(){if(s.progress===6)s.progress=0;s.progress++;if(s.progress===6){reward('Wangi lagi! Mimi kasih sundulan kecil.');el('action').textContent='Mandi lagi'}else{el('speech').textContent='Prrr… sisa '+(6-s.progress)+' gelembung.';el('action').textContent='Usap lagi'}}
function toss(x){if(flight)return;const target=Math.max(-1.20,Math.min(1.20,x));flight={start:performance.now(),from:s.ballX,target};el('speech').textContent='Hup! Kejar, Mimi!'}
el('action').onclick=()=>{if(s.mode==='feed')feed();if(s.mode==='wash')rub();if(s.mode==='chat'){talk();el('choices').firstChild.focus()}if(s.mode==='play')toss(s.ballX>0?-1:1)};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>select(b.dataset.mode));
canvas.onpointerdown=e=>{if(!scene)return;const p=scene.world(e,1.21),cat=scene.world(e,.5);canvas.setPointerCapture(e.pointerId);
 if(s.mode==='feed'&&Math.hypot(p.x-.82,p.y-.42)<.52)s.drag=p;
 if(s.mode==='wash'&&Math.hypot(cat.x,cat.y-1.45)<.95){rub();lastRub=cat}
 if(s.mode==='play')toss(p.x)};
canvas.onpointermove=e=>{if(!scene)return;
 if(s.drag)s.drag=scene.world(e,1.21);
 if(lastRub&&e.buttons){const p=scene.world(e,.5);if(Math.hypot(p.x,p.y-1.45)<.96&&Math.hypot(p.x-lastRub.x,p.y-lastRub.y)>.19){rub();lastRub=s.progress===6?null:p}}};
canvas.onpointerup=e=>{if(s.drag){const p=scene.world(e,.55);if(Math.hypot(p.x-s.catX,p.y-1.31)<.45)feed();else el('speech').textContent='Dekatkan ikannya ke hidung Mimi, ya.'}s.drag=null;lastRub=null};
canvas.onpointercancel=()=>{s.drag=null;lastRub=null};
let lastFrame=-Infinity;
function tick(now){requestAnimationFrame(tick);if(document.hidden||now-lastFrame<32)return;lastFrame=now;
 s.biting=now<biteEnd;
 if(flight){const t=(now-flight.start)/1000;const {from,target}=flight;
 if(t<.66){const f=t/.66;s.ballX=from+(target-from)*f;s.ballY=.32+Math.sin(f*Math.PI)*.95}
 else if(t<1.42){const f=(t-.66)/.76;s.catX=target*f;s.face=Math.sign(target)*.45;s.running=true;s.ballY=.32}
 else if(t<2.22){const f=(t-1.42)/.8;s.catX=target*(1-f);s.face=-Math.sign(target)*.40;s.ballX=s.catX;s.ballY=1.35+Math.sin(t*16)*.025}
 else{flight=null;s.running=false;s.catX=s.face=0;s.ballX=.68;s.ballY=.32;reward('Dapat! Benangnya Mimi bawa pulang.')}}scene?.render(now/1000,s)}
select('feed');requestAnimationFrame(tick);
