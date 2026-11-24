// Coordinates are in room units. Positive z points towards the player.
export function makeScene(canvas) {
  const gl=canvas.getContext('webgl',{alpha:false,antialias:true});
  const ctx=gl?null:canvas.getContext('2d');
  if(!gl&&!ctx)return null;
  let queue=[],group=[0,0,0,0],vx,vy;
  const stamps=new Map();
  let drawingFur=false;
  function materialStamp(shape,col,fur){
    const key=shape+col+fur;
    if(stamps.has(key))return stamps.get(key);
    const stamp=document.createElement('canvas');
    stamp.width=stamp.height=fur?256:128;
    const brush=stamp.getContext('2d');
    brush.translate(stamp.width/2,stamp.height/2);
    brush.scale(stamp.width/2.08,stamp.height/2.08);
      const gradient=brush.createRadialGradient(-.35,-.45,.05,.1,.12,1.44);
      gradient.addColorStop(0,col);gradient.addColorStop(.68,col);gradient.addColorStop(1,'rgb('+[1,3,5].map(k=>Math.round(parseInt(col.slice(k,k+2),16)*.80)).join(',')+')');
      brush.fillStyle=gradient;brush.beginPath();
      if(shape==='box')brush.roundRect(-1,-1,2,2,.09);
      else if(shape==='ear'){brush.moveTo(-.92,.84);brush.quadraticCurveTo(-.67,-.18,-.11,-.94);brush.quadraticCurveTo(.08,-1.12,.26,-.77);brush.quadraticCurveTo(.83,.14,.96,.78);brush.quadraticCurveTo(0,1.12,-.92,.84)}
      else brush.arc(0,0,1,0,Math.PI*2);
      brush.fill();
    if(fur&&shape==='ball'){
      let seed=71;
      const random=()=>(seed=seed*16807%2147483647)/2147483647;
      brush.lineCap='round';
      for(let i=0;i<1650;i++){
        const angle=random()*Math.PI*2,r=Math.sqrt(random());
        const x=Math.cos(angle)*r,y=Math.sin(angle)*r;
        brush.strokeStyle=i%3?'rgba(255,253,241,.34)':'rgba(158,112,87,.15)';
        brush.lineWidth=.004+random()*.004;
        brush.beginPath();brush.moveTo(x,y);
        brush.quadraticCurveTo(x+x*.016,y+.017,x+x*.028,y+.024+r*.009);
        brush.stroke();
      }
    }
    stamps.set(key,stamp);return stamp;
  }
  // On devices without WebGL, project the same animated room and character into Canvas.
  function paintScene(){
    const w=canvas.width,h=canvas.height,u=w/(2*vx);
    ctx.fillStyle='#f5d8d0';ctx.fillRect(0,0,w,h);
    queue.sort((a,b)=>a.depth-b.depth);
    for(const item of queue){
      const {shape,x,y,a,b,col,tilt}=item;
      ctx.save();ctx.translate(w/2+x*u,h/2-y*u);ctx.rotate(tilt);ctx.scale(a*u,b*u);
      ctx.drawImage(materialStamp(shape,col,item.furry),-1.04,-1.04,2.08,2.08);ctx.restore();
    }
  }
  const vertex=`attribute vec3 p,n;uniform vec3 pos,size,rot,base;uniform vec2 view;uniform float yaw;
  varying vec3 normal;varying vec3 surface;mat3 ry(float a){return mat3(cos(a),0.,-sin(a),0.,1.,0.,sin(a),0.,cos(a));}
  void main(){float a=rot.z,b=rot.x;mat3 r=ry(rot.y)*mat3(cos(a),sin(a),0.,-sin(a),cos(a),0.,0.,0.,1.)*mat3(1.,0.,0.,0.,cos(b),sin(b),0.,-sin(b),cos(b));
  surface=p;vec3 w=ry(yaw)*(r*(p*size)+pos)+base; normal=ry(yaw)*r*(n/size);
  gl_Position=vec4(w.x/view.x,((w.y-1.38)*.965-w.z*.262)/view.y,(-w.z*.965-w.y*.262)/16.,1.);}`;
  const frag=`precision mediump float;varying vec3 normal;varying vec3 surface;uniform float fur;uniform vec3 color;void main(){vec3 N=normalize(normal);float d=dot(N,normalize(vec3(-.45,.8,.65)));float lit=.79+.21*d;float grain=sin(surface.x*181.+surface.y*15.+sin(surface.y*33.+surface.z*20.)*1.4)*cos(surface.z*119.+surface.y*22.);
  float rim=pow(1.-abs(N.z),3.);
  gl_FragColor=vec4(color*(lit+fur*(grain*.028+rim*.065))+.055*pow(max(0.,dot(N,normalize(vec3(-.35,.65,1.)))),12.),1.);}`;
  function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
  let loc,ap,an,meshes;const colors=new Map();
  if(gl){
  const prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,frag));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));gl.useProgram(prog);
  loc=Object.fromEntries(['pos','size','rot','base','view','yaw','color','fur'].map(k=>[k,gl.getUniformLocation(prog,k)]));
  ap=gl.getAttribLocation(prog,'p');an=gl.getAttribLocation(prog,'n');gl.enableVertexAttribArray(ap);gl.enableVertexAttribArray(an);
  function mesh(shape){
    const points=[],idx=[],cols=32,rows=20;
    const power=(x,e)=>Math.sign(x)*Math.pow(Math.abs(x),e);
    function at(i,j){let u=i/cols*2*Math.PI,v=(j/rows-.5)*Math.PI;
      const e=shape==='box'?.15:1,h=Math.sin(v),c=Math.cos(v);
      const taper=shape==='ear'?(1-h)*.62:1;
      return [power(c,e)*power(Math.cos(u),e)*taper,power(h,e),power(c,e)*power(Math.sin(u),e)*taper]}
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const p=at(i,j),du=at(i+.02,j).map((v,k)=>v-at(i-.02,j)[k]),dv=at(i,Math.min(rows,j+.02)).map((v,k)=>v-at(i,Math.max(0,j-.02))[k]);
      let n=[dv[1]*du[2]-dv[2]*du[1],dv[2]*du[0]-dv[0]*du[2],dv[0]*du[1]-dv[1]*du[0]];
      if(j===0||j===rows)n=[0,j?1:-1,0];const l=Math.hypot(...n)||1;points.push(...p,...n.map(v=>v/l));
      if(i<cols&&j<rows){const k=j*(cols+1)+i;idx.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1)}}
    const buf=gl.createBuffer(),inds=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,inds);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idx),gl.STATIC_DRAW);return {buf,inds,count:idx.length}}
  meshes={ball:mesh('ball'),box:mesh('box'),ear:mesh('ear')};
  }

  function object(shape,x,y,z,a,b,c,col,rz=0,rx=0,ry=0){if(!gl){const [gx,gy,gz,yaw]=group,wx=gx+x*Math.cos(yaw)+z*Math.sin(yaw),wz=gz+z*Math.cos(yaw)-x*Math.sin(yaw),wy=y+gy;
      let depth=wz*.965+wy*.262;
      if(a>8&&y<0)depth=-15;
      if(a>8&&y>0)depth=-16;
      if(y<.13&&a>.5)depth=-2.1+y;
      queue.push({shape,x:wx,y:(wy-1.38)*.965-wz*.262,a,b:Math.hypot(.965*b,.262*c),col,furry:drawingFur&&col===cream,tilt:-rz,depth});return}
    const m=meshes[shape];gl.bindBuffer(gl.ARRAY_BUFFER,m.buf);gl.vertexAttribPointer(ap,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(an,3,gl.FLOAT,false,24,12);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.inds);
    if(!colors.has(col))colors.set(col,[1,3,5].map(i=>parseInt(col.slice(i,i+2),16)/255));
    gl.uniform1f(loc.fur,drawingFur&&col===cream?1:0);gl.uniform3fv(loc.color,colors.get(col));gl.uniform3f(loc.pos,x,y,z);gl.uniform3f(loc.size,a,b,c);gl.uniform3f(loc.rot,rx,ry,rz);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_SHORT,0)}
  const ball=(...p)=>object('ball',...p),box=(...p)=>object('box',...p),ear=(...p)=>object('ear',...p);
  const cream='#fff0df',pink='#ef90a1',inner='#f3b1ae',eye='#523043',white='#fffafa',wood='#b7806b';
  function origin(x=0,y=0,z=0,yaw=0){group=[x,y,z,yaw];if(!gl)return;gl.uniform3f(loc.base,x,y,z);gl.uniform1f(loc.yaw,yaw)}
  function room(){
    box(0,-.13,0,12,.12,10,'#e8b799');box(0,3,-3,12,3,.12,'#f5d8d0');
    for(let i=-9;i<10;i++)box(i*.59,2.6,-2.86,.036,2.6,.012,'#f0cbc6');
    box(0,.22,-2.75,10,.17,.09,'#ffe6d3');
    for(let z=-2;z<6;z+=.92)box(0,-.003,z,9,.009,.012,'#d5a88d');
    // Sash window, blue glass, clouds, gathered curtains.
    box(-1.45,2.35,-2.68,1.08,1.01,.09,cream);box(-1.45,2.35,-2.55,.94,.87,.03,'#a7d6dc');
    ball(-1.76,2.77,-2.48,.35,.10,.02,white);ball(-1.89,2.84,-2.48,.16,.14,.02,white);
    ball(-1.01,2.91,-2.48,.19,.19,.025,'#ffdc94');
    box(-1.45,2.35,-2.42,.035,.86,.035,cream);box(-1.45,2.3,-2.4,.96,.036,.035,cream);
    for(const sign of [-1,1])for(let j=0;j<3;j++)ball(-1.45+sign*(.91-j*.105),2.56,-2.32,.11,.86-j*.11,.09,['#d28fa1','#e7acb8','#f0bfca'][j],sign*-.13);
    box(-1.45,1.39,-2.39,1.16,.075,.2,cream);
    box(1.64,1.66,-2.5,.85,.06,.19,wood);
    for(let i=0;i<4;i++)box(1.14+i*.13,1.93,-2.44,.057,.23-i*.018,.11,['#b7c8b3','#df9bb0','#efd09b','#a8c7c4'][i],i===3?-.15:0);
    ball(2.15,1.89,-2.42,.16,.23,.14,'#f4dec2');for(let i=0;i<3;i++)ball(2.15+(i-1)*.09,2.17,-2.42,.05,.17,.05,'#96b49a',(1-i)*.48);
    ball(0,.015,.1,2.72,.045,1.8,'#c88596');ball(0,.055,.1,2.60,.035,1.70,'#f4cfcb');ball(0,.085,.1,2.40,.014,1.53,'#eebfbb');
  }
  function cat(t,s){
    const step=s.running?Math.sin(t*13):0;
    const breath=Math.sin(t*2.35)*.019;
    const compress=s.crouch*.11+s.impact*.15;
    const base=.11+s.lift+Math.abs(step)*.036;
    origin(s.catX,base,0,s.face);
    // A tapered tail swings from its root. The tip follows with a delay.
    for(let i=0;i<9;i++){
      const f=i/8,swing=Math.sin(t*(s.running?4:1.7)-f*1.6);
      ball(-.40-.43*Math.sin(f*1.8)+.12*f*swing,.31+.72*f,-.25+.16*f*swing,
        .17-.065*f,.17-.055*f,.16-.055*f,cream);
    }
    ball(0,.64-compress,-.06,.52+compress*.21,.64-compress*.45,.48,cream);
    for(const side of [-1,1]){
      const stride=step*side;
      ball(side*.37,.34-compress*.5,-.09,.24,.32,.25,cream);
      ball(side*.39,.15+Math.max(0,stride)*.09,.18+stride*.07,.22,.14,.26,cream);
      const pawY=.16+Math.max(0,-stride)*.12+s.reach*.45;
      const pawX=side*(.245+s.reach*.06);
      ball(pawX,(pawY+.70-compress)/2,.34,.132,(.76-compress-pawY)/2+.08,.145,cream,side*.06);
      ball(pawX,pawY,.43+s.reach*.18,.155,.143,.174,cream);
      for(let j=-1;j<=1;j++)ball(pawX+j*.062,pawY-.035,.55+s.reach*.18,.058,.072,.06,cream);
    }
    const nod=breath-compress+(s.biting?-.085*Math.abs(Math.sin(t*12)):0);
    const y=1.45+nod;
    origin(s.catX+.035*s.lookX,base,0,s.face+s.lookX*.21);
    for(const side of [-1,1]){
      ear(side*.52,y+.46,-.01,.36,.43,.24,cream,-side*.39);
      ear(side*.52,y+.49,.12,.24,.31,.13,inner,-side*.39);}
    ball(0,y,0,.80,.68,.56,cream);
    for(const side of [-1,1]){
      for(let j=0;j<2;j++)ear(side*(.67-j*.025),y-.11-j*.13,.03,.14,.24,.14,cream,-side*(1.48+j*.28));
      ball(side*.48,y-.13,.43,.17,.083,.04,'#efaeb2',side*.15);
      const blink=Math.max(.09,1-Math.max(0,1-Math.abs(t%4.9-4.6)/.13));
      const irisX=side*.29+s.lookX*.036,irisY=y+.05+s.lookY*.034;
      ball(side*.29,y+.05,.49,.135,.164*blink,.072,eye,side*.08);
      if(blink>.5){
        ball(irisX,irisY,.551,.095,.117*blink,.032,'#996547');
        ball(irisX,irisY+.007,.576,.058,.099*blink,.022,'#392730');
        ball(irisX-.031,irisY+.05,.601,.032,.035,.012,white);
        ball(irisX+.032,irisY-.022,.60,.013,.013,.009,white);
      }
      ball(side*.094,y-.098,.535,.110,.067,.052,'#fff4df');
      for(let j=0;j<2;j++)ball(side*.59,y-.15-j*.08,.39,.135,.012,.016,'#ab857c',side*(.13-j*.25));}
    ball(0,y-.068,.563,.063,.042,.038,'#d98791');
    for(const side of [-1,1])ball(side*.034,y-.127,.551,.048,.015,.018,eye,side*.32);
    if(s.biting||s.mode==='chat')ball(0,y-.154,.557,.034,.029,.018,'#d78992');
    for(const side of [-1,1]){
      ball(.43+side*.15,y+.51,.32,.20,.14,.10,pink,side*.42);
      ball(.43+side*.16,y+.51,.405,.096,.046,.016,'#cf748a',side*.42);
      box(.43+side*.075,y+.36,.31,.051,.12,.032,pink,side*.38);}
    ball(.43,y+.51,.42,.087,.09,.075,'#e78098');
  }
  function render(t,s){const d=Math.min(devicePixelRatio||1,1.6),w=Math.round(canvas.clientWidth*d),h=Math.round(canvas.clientHeight*d);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}queue=[];vy=Math.max(1.89,1.56*h/w);vx=vy*w/h;if(gl){gl.viewport(0,0,w,h);gl.uniform2f(loc.view,vx,vy);gl.enable(gl.DEPTH_TEST);gl.clearColor(.97,.85,.81,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT)}origin();room();
    const shade=1-s.lift*.4;ball(s.catX,.11,0,.60*shade,.02,.40*shade,'#d5aaa2');drawingFur=true;cat(t,s);drawingFur=false;origin();
    if(s.mode==='feed'){ball(.82,.22,1.15,.39,.14,.31,'#cb8191');ball(.82,.31,1.15,.32,.07,.25,'#fae8d5');
      const x=s.drag?.x??.82,y=s.drag?.y??.44;ball(x,y,1.21,.17,.09,.08,'#e5ae69');ear(x-.16,y,1.21,.08,.105,.055,'#dda165',1.57);ball(x+.09,y+.025,1.28,.016,.016,.014,eye)}
    if(s.mode==='wash'){for(const i of s.foam){let a=i*2.4;ball(s.catX+Math.cos(a)*.61,1.3+Math.sin(a)*.39,.64,.105,.105,.09,'#bce3ea');ball(s.catX+Math.cos(a)*.61-.034,1.34+Math.sin(a)*.39,.71,.031,.031,.016,white)}}
    if(s.mode==='play'){const x=s.ballX,y=s.ballY;ball(x,.12,1,.19,.02,.14,'#d39e99');ball(x,y,1,.20,.20,.20,'#c38aab');for(let j=-1;j<=1;j++)ball(x+j*.06,y,1.17,.012,.114,.016,'#e6b5c9',-.32)}
    if(!gl)paintScene();
  }
  function world(event,z=0){const r=canvas.getBoundingClientRect();return {x:((event.clientX-r.left)/r.width*2-1)*vx,y:((1-(event.clientY-r.top)/r.height*2)*vy+z*.262)/.965+1.38}}
  return {render,world};
}
