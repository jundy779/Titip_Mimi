import {makeScene} from './mimi-scene.js';
import {yarnGame} from './mimi-yarn.js';
import {createLife,idleLines,moods} from './mimi-life.js';
import {makeVoice} from './mimi-sound.js';
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
const life=createLife(),voice=makeVoice();
function reward(words,kind){el('speech').textContent=words;hearts++;el('score').textContent=hearts;try{localStorage.setItem('mimi-room-hearts-v2',String(hearts))}catch{}if(kind)life.bond(kind)}
const soundButton=el('sound');
function showSound(){soundButton.setAttribute('aria-pressed',String(voice.enabled));soundButton.textContent=voice.enabled?'🔊 Suara nyala':'🔈 Suara mati'}
soundButton.onclick=()=>{voice.setEnabled(!voice.enabled);showSound();if(voice.enabled)voice.meow('happy')};
showSound();
let shownMood='';
function showMood(){const m=life.mood();if(m===shownMood)return;shownMood=m;el('mood').textContent=moods[m].icon+' '+moods[m].label}
const stories=[
 ['Hari ini capek','Mimi geser sedikit, sini rebahan bareng.','Mau dielus','Prrr… Mimi temenin di sini.'],
 ['Ada kabar baik','Wah! Mimi sampai tegak kupingnya.','Rayakan bareng','Tos kecil dari Mimi buat kamu!'],
 ['Kangen Mimi','Mimi juga kangen. Mau duduk dekat?','Duduk bareng','Sini, tempat sebelah Mimi hangat.']
];
function options(items){el('choices').replaceChildren();for(const [label,go] of items){const b=document.createElement('button');b.textContent=label;b.onclick=go;el('choices').append(b)}}
function talk(){options(stories.map(([label,reply,next,end])=>[label,()=>{el('speech').textContent=reply;options([[next,()=>{reward(end,'chat');voice.meow('soft');options([]);el('action').hidden=false;el('action').focus()}]]);el('choices').firstChild.focus()}]));el('action').hidden=true}
const say=words=>el('speech').textContent=words;
const yarn=yarnGame(s,say,()=>{reward('Kena! Mimi mendekap benangnya ♡','play');voice.meow('happy')});
let biteEnd=0,lastRub=null,activePointer=null,strokeStart=null,petEnd=0;
let gesture='idle',gestureEnd=0,petSide=0;
function gestureState(next,duration=0){
 gesture=next;gestureEnd=duration?performance.now()+duration:0;
 el('peek').textContent=next==='hide'?'Buka mata!':'Cilukba';
 el('five').textContent=next==='offer'?'Sambut tos!':'Tos Mimi';
}
function react(next,duration,words){
 if(s.mode==='play'&&s.motion!=='rest')yarn.reset();
 gestureState(next,duration);say(words);
}
let lastBond=0;
function stroke(side=0){
 if(performance.now()-lastBond>1500){lastBond=performance.now();life.bond('pet')}
 petSide=side;
 petEnd=performance.now()+1550;
 react('pet',1550,'Prrr… Mimi nyender ke tanganmu.');
}
el('pet').onclick=()=>stroke(.5);
el('peek').onclick=()=>{
 if(gesture==='hide'){react('reveal',1050,'Baaa! Ketemu Iqlima ♡');life.bond('peek');voice.meow('happy')}
 else react('hide',0,'Mimi tutup mata. Kamu sembunyi di mana?');
};
el('five').onclick=()=>{
 if(gesture==='offer'){react('highfive',850,'Plak! Tos kecil buat kamu.');life.bond('highfive');voice.chirp()}
 else react('offer',0,'Tos, yuk! Sentuh kaki depan Mimi.');
};
let pet={lastMeal:0,bites:0,washed:0};
try{const old=JSON.parse(localStorage.getItem('mimi-care-v1')||'{}');for(const k of Object.keys(pet))if(Number.isFinite(old[k]))pet[k]=old[k]}catch{}
function savePet(){try{localStorage.setItem('mimi-care-v1',JSON.stringify(pet))}catch{}}
function select(mode){
 gestureState('idle');yarn.reset();activePointer=null;
 Object.assign(s,{mode,catX:0,face:0,progress:0,drag:null,running:false,biting:false,foam:new Set([0,1,2,3,4,5])});
 lastRub=null;strokeStart=null;petEnd=0;biteEnd=0;
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
 reward(full()?'Nyam. Perut Mimi sudah kenyang ♡':'Kriuk! Kumis Mimi ikut bergerak.','feed');
 voice.crunch();life.setFull(full());if(full())voice.meow('soft');
}
function rub(id){
 if(!s.foam.delete(id))return;
 voice.pop();
 if(!s.foam.size){pet.washed=Date.now();savePet();reward('Bersih! Mimi menggoyangkan telinganya.','wash');voice.sparkle();voice.meow('happy');el('action').textContent='Main busa lagi'}
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
 const head=scene.world(e,.5);
 const onKitten=Math.abs(head.x-s.catX)<.85&&head.y>.24&&head.y<2.22;
 if(onKitten&&gesture==='offer'){el('five').click();return}
 if(onKitten&&gesture==='hide'){el('peek').click();return}
 if(s.mode==='play'){
   const p=scene.world(e,1);
   if(yarn.grab(p.x,p.y,e.timeStamp)){gestureState('idle');return}
 }
 if(s.mode==='feed'){
   const p=scene.world(e,1.21);
   if(Math.hypot(p.x-.82,p.y-.42)<.52){s.drag=p;return}
 }
 if(s.mode==='wash'){
   const p=scene.world(e,.64);
   const bubble=[...s.foam].some(id=>Math.hypot(p.x-s.catX-Math.cos(id*2.4)*.61,p.y-1.3-Math.sin(id*2.4)*.39)<.26);
   if(bubble){lastRub=p;return}
 }
 if(onKitten)strokeStart=head;
};
canvas.onpointermove=e=>{
 if(e.pointerId!==activePointer)return;
 if(s.mode==='play'){const p=scene.world(e,1);yarn.pull(p.x,p.y,e.timeStamp)}
 if(strokeStart){
   const p=scene.world(e,.5);
   if(Math.abs(p.x-s.catX)>.98||p.y<.15||p.y>2.35)strokeStart=null;
   else if(Math.hypot(p.x-strokeStart.x,p.y-strokeStart.y)>.075){
     stroke(Math.tanh((p.x-s.catX)*2));strokeStart=p;
   }
 }
 if(s.drag)s.drag=scene.world(e,1.21);
 if(lastRub){const p=scene.world(e,.64);if(Math.hypot(p.x-lastRub.x,p.y-lastRub.y)>.06){washAt(p);lastRub=p}}
};
function finish(e){
 if(e.pointerId!==activePointer)return;
 if(s.drag&&e.type==='pointerup'){const p=scene.world(e,.55);if(Math.hypot(p.x-s.catX,p.y-1.31)<.45)feed();else say('Dekatkan ikannya ke hidung Mimi, ya.')}
 yarn.release(e.timeStamp);s.drag=null;lastRub=null;strokeStart=null;activePointer=null;
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
 if(gestureEnd&&now>=gestureEnd)gestureState('idle');
 s.gesture=gesture;s.petted=gesture==='pet'&&now<petEnd;
 const followGesture=1-Math.exp(-14*dt);
 s.cover=(s.cover||0)+((gesture==='hide'?1:0)-(s.cover||0))*followGesture;
 s.wave=(s.wave||0)+((gesture==='offer'||gesture==='highfive'?1:0)-(s.wave||0))*followGesture;
 s.nuzzle=(s.nuzzle||0)+((s.petted?petSide:0)-(s.nuzzle||0))*followGesture;
 s.hop=gesture==='reveal'||gesture==='highfive'?.22*Math.sin(Math.PI*Math.min(1,((gesture==='reveal'?1050:850)-(gestureEnd-now))/450)):0;
 if(s.mode==='play'){
   const steps=Math.ceil(dt*120);
   for(let i=0;i<steps;i++)yarn.step(dt/steps,now-(steps-1-i)*dt/steps*1000);
 }
 life.update(dt,s,Date.now());
 if(life.started==='ask'){say(idleLines.ask);voice.meow('ask')}
 if(life.started==='sleep')say(idleLines.sleep);
 voice.purr(Boolean(s.petted||(s.habit==='sleep'&&s.habitT>.05)));
 showMood();
 s.gait+=((s.running?1:0)-s.gait)*(1-Math.exp(-10*dt));
 s.stridePhase+=13*dt;s.tailPhase+=(1.7+2.3*s.gait)*dt;
 if(s.drag)s.face+=(Math.max(-.4,Math.min(.4,s.drag.x*.55))-s.face)*(1-Math.exp(-13*dt));
 const focus=s.drag||(s.mode==='play'?{x:s.ballX,y:s.ballY}:null);
 const aimX=s.lookAt!=null?s.lookAt:focus?Math.tanh((focus.x-s.catX)*1.5):Math.sin(now*.0007)*.18;
 const aimY=s.habit==='ask'?.25:s.lookAt!=null?.05:focus?Math.tanh(focus.y-1.35):.05;
 const follow=1-Math.exp(-10*dt);
 s.lookX+=(aimX-s.lookX)*follow;s.lookY+=(aimY-s.lookY)*follow;
 s.impact*=Math.exp(-9*dt);
 scene?.render(clock,s);
}
// Sentuhan apa pun menghentikan kebiasaan Mimi; kalau sedang tidur, Mimi bangun dulu.
function poke(){if(life.poke()==='wake'){say(idleLines.wake);voice.meow('sleepy')}}
document.addEventListener('pointerdown',poke,true);
document.addEventListener('keydown',poke,true);
life.setFull(full());
select('play');say(life.greeting());showMood();
if(life.mood()==='kangen')setTimeout(()=>{react('reveal',1050,life.greeting())},400);
requestAnimationFrame(tick);
if(location.search.includes('mimi-debug'))globalThis.__life=life;
