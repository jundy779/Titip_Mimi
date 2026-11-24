// The toy and Mimi advance independently. A pounce locks its direction at takeoff.
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function yarnGame(s,announce,caught){
  let held=false,awake=false,vx=0,vy=0,phase='watch',clock=0,launch=0,lastMove=0;
  function reset(){
    held=awake=false;vx=vy=clock=0;phase='watch';
    Object.assign(s,{ballX:.84,ballY:.32,lift:0,crouch:0,reach:0,running:false});
  }
  function grab(x,y,time){
    if((phase==='hold'||phase==='settle')||Math.hypot(x-s.ballX,y-s.ballY)>.48)return false;
    held=awake=true;vx=vy=0;lastMove=time;return true;
  }
  function pull(x,y,time){
    if(!held)return;
    const dt=clamp((time-lastMove)/1000,.012,.12);
    x=clamp(x,-1.30,1.30);y=clamp(y,.32,2.28);
    vx=clamp((x-s.ballX)/dt,-4,4);vy=clamp((y-s.ballY)/dt,-4,4);
    s.ballX=x;s.ballY=y;lastMove=time;
  }
  function release(time){if(!held)return;held=false;if(time-lastMove>100)vx=vy=0}
  function flick(direction){
    if(phase==='hold'||phase==='settle')return;
    awake=true;held=false;vx=direction*2.8;vy=2.9;
  }
  function step(dt,time){
    if(!awake)return;
    clock+=dt;
    if(!held&&phase!=='hold'&&phase!=='settle'){
      vy-=7*dt;s.ballY+=vy*dt;s.ballX+=vx*dt;
      if(s.ballY<=.32){s.ballY=.32;vy=Math.abs(vy)>.5?-vy*.42:0;vx*=Math.exp(-3.5*dt)}
      if(Math.abs(s.ballX)>1.32){s.ballX=clamp(s.ballX,-1.32,1.32);vx*=-.58}
    }
    const gap=s.ballX-s.catX;
    if(phase==='settle'){
      s.lift=Math.max(0,s.lift-dt*(1.4+7*clock));
      s.ballX=s.catX;s.ballY=.52+s.lift;
      if(!s.lift){s.impact=1;phase='hold';clock=0}
      return;
    }
    if(phase==='hold'){
      if(clock>.95){reset();s.ballX=clamp(s.catX+(s.catX>0?-.72:.72),-1.3,1.3);announce('Mimi melepaskan benangnya. Giliranmu lagi.')}
      return;
    }
    if(phase==='jump'){
      const f=Math.min(1,clock/.48);s.lift=Math.sin(Math.PI*f)*.67;s.reach=Math.sin(Math.PI*f);
      s.catX=clamp(s.catX+launch*dt,-1.32,1.32);
      if(Math.abs(s.ballX-s.catX)<.34 && Math.abs(s.ballY-(.55+s.lift))<.44){
        phase='settle';clock=0;held=false;s.crouch=0;s.reach=.35;s.ballX=s.catX;s.ballY=.52+s.lift;caught();return;
      }
      if(f===1){s.impact=1;phase='watch';clock=0;s.reach=0;announce('Hampir! Tadi lolos dari cakar Mimi.')}
      return;
    }
    s.face+=(Math.sign(gap)*.49-s.face)*Math.min(1,6*dt);
    const speed=held&&time-lastMove>100?0:Math.hypot(vx,vy);
    s.running=Math.abs(gap)>.58;
    if(s.running)s.catX+=Math.sign(gap)*Math.min(Math.abs(gap)-.55,dt*(speed>1?1.65:.66));
    s.crouch=Math.min(1,clock*1.5);
    if(Math.abs(gap)<.94&&clock>(speed>1?.34:.85)&&s.ballY<1.91){
      phase='jump';launch=clamp((s.ballX+vx*.12-s.catX)/.34,-2.65,2.65);clock=0;
      s.running=false;s.crouch=0;announce('Hup!');
    }
  }
  reset();return {reset,grab,pull,release,flick,step};
}
