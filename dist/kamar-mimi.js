import {makeScene} from './mimi-scene.js';
import {yarnGame} from './mimi-yarn.js';
const el=id=>document.getElementById(id),canvas=document.querySelector('canvas');
let scene;
try{scene=makeScene(canvas)}catch(error){console.warn('Kamar Mimi',error)}
el('fallback').hidden=!!scene;
const s={gait:0,stridePhase:0,tailPhase:0,impact:0,lookX:0,lookY:0,mode:'feed',catX:0,face:0,ballX:.9,ballY:.32,progress:0,drag:null,running:false,biting:false};
const modes={
 feed:['Seret biskuit ikan dari mangkuk ke mulut Mimi.','Suapi Mimi','Mimi mencium aroma ikan…'],
 wash:['Usap gelembung di bulu Mimi sampai bersih.','Usap bulu','Gelembungnya geli, hihi.'],
 chat:['Pilih cerita yang ingin kamu bagi dengan Mimi.','Pilih cerita','Sini, telinga Mimi siap.'],
 play:['Pegang benangnya, tarik pelan, lalu kibaskan. Coba buat Mimi meleset!','Kibaskan benang','Kuping Mimi mengarah ke benang…']
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
const say=words=>el('speech').textContent=words;
const yarn=yarnGame(s,say,()=>reward('Kena! Mimi mendekap benangnya ♡'));
let biteEnd=0,lastRub=null,activePointer=null;
let pet={lastMeal:0,bites:0,washed:0};
try{const old=JSON.parse(localStorage.getItem('mimi-care-v1')||'{}');for(const k of Object.keys(pet))if(Number.isFinite(old[k]))pet[k]=old[k]}catch{}
function savePet(){try{localStorage.setItem('mimi-care-v1',JSON.stringify(pet))}catch{}}
function select(mode){
 yarn.reset();activePointer=null;
 Object.assign(s,{mode,catX:0,face:0,progress:0,drag:null,running:false,biting:false,foam:new Set([0,1,2,3,4,5])});
 lastRub=null;biteEnd=0;
 const [hint,act,words]=modes[mode];el('hint').textContent=hint;el('action').textContent=act;el('action').hidden=false;say(words);options([]);
 document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
 if(mode==='chat')talk();
 if(mode==='wash'&&pet.washed&&Date.now()-pet.washed<3600000)say('Bulu Mimi masih wangi. Mau main busa lagi?');
 if(mode==='feed'&&full())say('Perut Mimi masih kenyang. Main benang, yuk?');
}
function full(){return Date.now()-pet.lastMeal<1800000&&pet.bites>=3}
function feed(){
 s.drag=null;if(full()){say('Mimi mengendus sebentar. Perutnya masih kenyang ♡');return}
 if(Date.now()-pet.lastMeal>=1800000)pet.bites=0;
 pet.lastMeal=Date.now();pet.bites++;savePet();biteEnd=performance.now()+800;
 reward(full()?'Nyam. Perut Mimi sudah kenyang ♡':'Kriuk! Kumis Mimi ikut bergerak.');
}
function rub(id){
 if(!s.foam.delete(id))return;
 if(!s.foam.size){pet.washed=Date.now();savePet();reward('Bersih! Mimi menggoyangkan telinganya.');el('action').textContent='Main busa lagi'}
 else say('Prrr… sisa '+s.foam.size+' gelembung.');
}
function washAt(p){
 for(const id of s.foam){const a=id*2.4;if(Math.hypot(p.x-s.catX-Math.cos(a)*.61,p.y-1.3-Math.sin(a)*.39)<.24){rub(id);break}}
}
el('action').onclick=()=>{
 if(s.mode==='feed')feed();
 if(s.mode==='wash'){if(s.foam.size)rub(s.foam.values().next().value);else select('wash')}
 if(s.mode==='chat'){talk();el('choices').firstChild.focus()}
 if(s.mode==='play')yarn.flick(s.ballX>0?-1:1);
};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>select(b.dataset.mode));
canvas.onpointerdown=e=>{
 if(!scene||activePointer!==null)return;
 activePointer=e.pointerId;canvas.setPointerCapture(e.pointerId);
 if(s.mode==='play'){const p=scene.world(e,1);yarn.grab(p.x,p.y,e.timeStamp)}
 if(s.mode==='feed'){const p=scene.world(e,1.21);if(Math.hypot(p.x-.82,p.y-.42)<.52)s.drag=p}
 if(s.mode==='wash')lastRub=scene.world(e,.64);
};
canvas.onpointermove=e=>{
 if(e.pointerId!==activePointer)return;
 if(s.mode==='play'){const p=scene.world(e,1);yarn.pull(p.x,p.y,e.timeStamp)}
 if(s.drag)s.drag=scene.world(e,1.21);
 if(lastRub){const p=scene.world(e,.64);if(Math.hypot(p.x-lastRub.x,p.y-lastRub.y)>.06){washAt(p);lastRub=p}}
};
function finish(e){
 if(e.pointerId!==activePointer)return;
 if(s.drag&&e.type==='pointerup'){const p=scene.world(e,.55);if(Math.hypot(p.x-s.catX,p.y-1.31)<.45)feed();else say('Dekatkan ikannya ke hidung Mimi, ya.')}
 yarn.release(e.timeStamp);s.drag=null;lastRub=null;activePointer=null;
}
canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=finish;
canvas.onkeydown=e=>{
 if(s.mode!=='play'||!['ArrowLeft','ArrowRight'].includes(e.key))return;
 e.preventDefault();yarn.flick(e.key==='ArrowLeft'?-1:1);
};
let lastFrame=null,clock=0;
document.addEventListener('visibilitychange',()=>{lastFrame=null});
function tick(now){
 requestAnimationFrame(tick);if(document.hidden)return;
 const dt=lastFrame===null?0:Math.min((now-lastFrame)/1000,.1);
 lastFrame=now;clock+=dt;s.biting=now<biteEnd;
 if(s.mode==='play'){
   const steps=Math.ceil(dt*120);
   for(let i=0;i<steps;i++)yarn.step(dt/steps,now-(steps-1-i)*dt/steps*1000);
 }
 s.gait+=((s.running?1:0)-s.gait)*(1-Math.exp(-10*dt));
 s.stridePhase+=13*dt;s.tailPhase+=(1.7+2.3*s.gait)*dt;
 if(s.drag)s.face+=(Math.max(-.4,Math.min(.4,s.drag.x*.55))-s.face)*(1-Math.exp(-13*dt));
 const focus=s.drag||(s.mode==='play'?{x:s.ballX,y:s.ballY}:null);
 const aimX=focus?Math.tanh((focus.x-s.catX)*1.5):Math.sin(now*.0007)*.18;
 const aimY=focus?Math.tanh(focus.y-1.35):.05;
 const follow=1-Math.exp(-10*dt);
 s.lookX+=(aimX-s.lookX)*follow;s.lookY+=(aimY-s.lookY)*follow;
 s.impact*=Math.exp(-9*dt);
 scene?.render(clock,s);
}
select('play');requestAnimationFrame(tick);
