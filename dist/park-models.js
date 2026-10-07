/* Illustrative landmark/vegetation meshes. Navigation never uses model dimensions. */
(function(root){'use strict';
const ORIGIN=[2.7782,48.8695],SX=111195*Math.cos(ORIGIN[1]*Math.PI/180),SY=111195;
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);}
function build(scene,rides){const v=[...(scene.roofMeshes?.vertices||[])];const tri=(a,b,c,color)=>{const u=b.map((x,i)=>x-a[i]),w=c.map((x,i)=>x-a[i]),n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],len=Math.hypot(...n)||1,shade=.72+.28*Math.max(0,(n[0]*-.4+n[1]*-.25+n[2]*.88)/len),co=rgb(color).map(x=>x*shade);for(const p of [a,b,c])v.push(...p,...co);};
 const quad=(a,b,c,d,color)=>{tri(a,b,c,color);tri(a,c,d,color);};
 const box=(x,y,z,w,d,h,color)=>{const a=[x-w/2,y-d/2,z],b=[x+w/2,y-d/2,z],c=[x+w/2,y+d/2,z],d1=[x-w/2,y+d/2,z],up=p=>[p[0],p[1],z+h],A=up(a),B=up(b),C=up(c),D=up(d1);quad(a,b,B,A,color);quad(b,c,C,B,color);quad(c,d1,D,C,color);quad(d1,a,A,D,color);quad(A,B,C,D,color);};
 const cone=(x,y,z,r,h,color,sides=10,top=0)=>{for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2,A=[x+Math.cos(a)*r,y+Math.sin(a)*r,z],B=[x+Math.cos(b)*r,y+Math.sin(b)*r,z],C=[x+Math.cos(b)*top,y+Math.sin(b)*top,z+h],D=[x+Math.cos(a)*top,y+Math.sin(a)*top,z+h];quad(A,B,C,D,color);if(top)tri([x,y,z+h],D,C,color);}};
 const xy=p=>[(p[0]-ORIGIN[0])*SX,(p[1]-ORIGIN[1])*SY];
 for(const t of scene.trees||[]){const [x,y]=xy(t),h=5+t[2]%6,r=2+(t[2]%9)/10;cone(x,y,0,.35,3,'#92764f',5,.3);cone(x,y,2,r,h*.7,t[2]%2?'#668e67':'#7b9e6c',7,0);cone(x,y,h*.4,r*.72,h*.7,'#86aa76',7,0);}
 const center=name=>{const r=rides.find(r=>r.name===name);return r?xy([r.attractionLocation?.[1]??r.latlng[1],r.attractionLocation?.[0]??r.latlng[0]]):null;};
 for(const l of scene.landmarks||[]){const center=xy([l.latlng[1],l.latlng[0]]),a=l.modelAngle??l.angle,ca=Math.cos(a),sa=Math.sin(a),pt=(x,y)=>[center[0]+x*ca-y*sa,center[1]+x*sa+y*ca];
 const block=(x,y,z,w,d,h,color)=>{const q=[[x-w/2,y-d/2],[x+w/2,y-d/2],[x+w/2,y+d/2],[x-w/2,y+d/2]].map(p=>{const q=pt(...p);return [...q,z];}),up=q.map(p=>[p[0],p[1],z+h]);for(let i=0;i<4;i++)quad(q[i],q[(i+1)%4],up[(i+1)%4],up[i],color);quad(...up,color);};
 const turret=(x,y,z,r,h,color,sides=12,top=0)=>{const p=pt(x,y);cone(p[0],p[1],z,r,h,color,sides,top);};
 const gable=(x,y,z,w,d,h,color)=>{const ps=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2],[0,-d/2],[0,d/2]].map(([u,v],i)=>{const p=pt(x+u,y+v);return [...p,z+(i>=4?h:0)];});quad(ps[0],ps[3],ps[5],ps[4],color);quad(ps[1],ps[2],ps[5],ps[4],color);tri(ps[0],ps[1],ps[4],color);tri(ps[3],ps[2],ps[5],color);};
 if(l.kind==='castle')castleMesh(tri,quad,pt,l,scene.modelDetail==='compact');
 if(l.kind==='balloon')balloonMesh(tri,quad,pt,l,scene.modelDetail==='compact');
 if(l.kind==='tower')towerMesh(tri,quad,pt,l,scene.modelDetail==='compact');
 if(['entry','waterTower','station','chessy'].includes(l.kind))parkDetailMesh(tri,quad,pt,l,scene.modelDetail==='compact');
 if(l.kind==='space'){const r=Math.min(l.length,l.width)*.48;turret(0,0,0,r,8,'#a3ab9b',40,r);const rings=7,sides=40;for(let j=0;j<rings;j++){const t1=j/rings*Math.PI/2,t2=(j+1)/rings*Math.PI/2;for(let k=0;k<sides;k++){const t=k/sides*Math.PI*2,u=(k+1)/sides*Math.PI*2;const q=(ang,el)=>{const p=pt(Math.cos(ang)*r*Math.cos(el),Math.sin(ang)*r*Math.cos(el));return [...p,8+21*Math.sin(el)];};quad(q(t,t1),q(u,t1),q(u,t2),q(t,t2),k%5===0?'#c8ae6a':'#6e9294');}}turret(0,0,28,3.4,4,'#bd9a5d',12,1.2);block(0,-r-7,4,9,26,7,'#78918d');gable(0,-r-7,11,9,26,3,'#b3aa82');}
 if(l.kind==='arendelle'){block(0,0,0,9,12,13,'#e4d6bc');gable(0,0,13,9,12,6,'#527d91');for(const [x,y,h] of [[-4,-4,19],[4,3,22],[0,2,21]]){turret(x,y,0,1.8,h,'#e8decc',10,1.8);turret(x,y,h,2.4,26-h,'#53839b',12,.1);}}
 }
 for(const flag of scene.roofFlags||[]){const [x,y,z,h]=flag.pole;cone(x,y,z,.065,h,'#ded8ba',6,.065);}
 linearDetailMesh(tri,quad,scene,scene.modelDetail==='compact');
 return new Float32Array(v);
}
function balloonMesh(tri,quad,pt,l,compact=false){
 const floor=l.basketHeight||80,r=(l.diameter||22.5)/2,center=floor+23.75,sides=compact?24:40,bands=compact?12:20;
 const p=(x,y,z)=>[...pt(x,y),z],body=(a,b)=>p(r*Math.cos(b)*Math.cos(a),r*Math.cos(b)*Math.sin(a),center+r*Math.sin(b));
 const rail=(a,b,width,color)=>{const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),u=length>.001?[-dy/length*width,dx/length*width,0]:[width,0,0],v=[0,0,width];quad(a.map((n,i)=>n-u[i]),a.map((n,i)=>n+u[i]),b.map((n,i)=>n+u[i]),b.map((n,i)=>n-u[i]),color);quad(a.map((n,i)=>n-v[i]),a.map((n,i)=>n+v[i]),b.map((n,i)=>n+v[i]),b.map((n,i)=>n-v[i]),color);};
 for(let j=0;j<bands;j++)for(let i=0;i<sides;i++){
  const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2,lo=-Math.PI/2+j/bands*Math.PI,hi=-Math.PI/2+(j+1)/bands*Math.PI;
  const color=lo<-.55?'#273956':lo<-.25?'#e8c95d':Math.floor(i/(sides/8))%2?'#eee8dc':'#3e547d';
  quad(body(a,lo),body(b,lo),body(b,hi),body(a,hi),color);
 }
 // Fine seam lines emphasize the inflated globe without external textures.
 for(let i=0;i<8;i++)for(let j=0;j<bands;j++){const a=i/8*Math.PI*2,lo=-Math.PI/2+j/bands*Math.PI,hi=-Math.PI/2+(j+1)/bands*Math.PI;rail(body(a,lo),body(a,hi),.018,'#d7cfa9');}
 // Open circular passenger gondola with guard rails and suspension lines.
 for(let i=0;i<sides;i++){
  const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2,point=(radius,angle,z)=>p(radius*Math.cos(angle),radius*Math.sin(angle),z);
  quad(point(2.1,a,floor),point(3.5,a,floor),point(3.5,b,floor),point(2.1,b,floor),'#bc654d');
  quad(point(3.5,a,floor),point(3.5,b,floor),point(3.5,b,floor+.8),point(3.5,a,floor+.8),'#b44b43');
  rail(point(3.5,a,floor+2.4),point(3.5,b,floor+2.4),.06,'#d6bd77');
  if(i%Math.max(1,sides/8)===0){rail(point(3.5,a,floor),point(3.5,a,floor+2.4),.045,'#d6bd77');rail(point(3.5,a,floor+2.4),body(a,-.9),.025,'#cfceb7');}
 }
 rail(p(0,0,.25),p(0,0,floor),.045,'#899b9c');
 // Mooring platform stays at the surveyed ground position beneath the balloon.
 for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2;tri(p(0,0,.28),p(11.5*Math.cos(a),11.5*Math.sin(a),.28),p(11.5*Math.cos(b),11.5*Math.sin(b),.28),'#789b9b');}
}
// Geometry follows the Disney photo reference: stone gate, asymmetric pink spires,
// slate-blue segmented caps, gold finials. All dimensions remain decorative.
function castleMesh(tri,quad,pt,landmark,compact=false){
 const roundSides=compact?12:24,bodySides=compact?12:20,ballSides=compact?12:16,ballBands=compact?6:8,posts=compact?8:16;
 const stone='#aaa9a1',trim='#e0d4bf',pink='#e9aabc',lightPink='#f1c1c6',deepPink='#d98fa8',gold='#dfbb61';
 const world=p=>[...pt(p[0],p[1]),p[2]],face=(a,b,c,color)=>tri(world(a),world(b),world(c),color),panel=(a,b,c,d,color)=>quad(world(a),world(b),world(c),world(d),color);
 const box=(x,y,z,w,d,h,color)=>{const a=[x-w/2,y-d/2,z],b=[x+w/2,y-d/2,z],c=[x+w/2,y+d/2,z],e=[x-w/2,y+d/2,z],up=p=>[p[0],p[1],z+h];panel(a,b,up(b),up(a),color);panel(b,c,up(c),up(b),color);panel(c,e,up(e),up(c),color);panel(e,a,up(a),up(e),color);panel(up(a),up(b),up(c),up(e),color);};
 const ring=(x,y,z,r,h,color,top=r,sides=bodySides)=>{for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2;panel([x+Math.cos(a)*r,y+Math.sin(a)*r,z],[x+Math.cos(b)*r,y+Math.sin(b)*r,z],[x+Math.cos(b)*top,y+Math.sin(b)*top,z+h],[x+Math.cos(a)*top,y+Math.sin(a)*top,z+h],color);face([x,y,z+h],[x+Math.cos(a)*top,y+Math.sin(a)*top,z+h],[x+Math.cos(b)*top,y+Math.sin(b)*top,z+h],color);}};
 const ellipsoid=(x,y,z,rx,ry,rz,color,sides=ballSides,bands=ballBands)=>{const p=(a,b)=>[x+rx*Math.cos(b)*Math.cos(a),y+ry*Math.cos(b)*Math.sin(a),z+rz*Math.sin(b)];for(let j=0;j<bands;j++){const b=-Math.PI/2+j/bands*Math.PI,c=-Math.PI/2+(j+1)/bands*Math.PI;for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,d=(i+1)/sides*Math.PI*2;panel(p(a,b),p(d,b),p(d,c),p(a,c),color);}}};
 const tube=(path,radii,color,sides=8)=>{const rows=path.map((p,i)=>{const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],d=b.map((v,k)=>v-a[k]),length=Math.hypot(...d)||1,t=d.map(v=>v/length),n=Math.abs(t[2])>.95?[1,0,0]:[-t[1],t[0],0],nl=Math.hypot(...n);for(let k=0;k<3;k++)n[k]/=nl;const w=[t[1]*n[2]-t[2]*n[1],t[2]*n[0]-t[0]*n[2],t[0]*n[1]-t[1]*n[0]];return Array.from({length:sides},(_,j)=>p.map((v,k)=>v+radii[i]*(n[k]*Math.cos(j/sides*Math.PI*2)+w[k]*Math.sin(j/sides*Math.PI*2))));});for(let i=0;i<rows.length-1;i++)for(let j=0;j<sides;j++)panel(rows[i][j],rows[i][(j+1)%sides],rows[i+1][(j+1)%sides],rows[i+1][j],color);};
 const roof=(x,y,z,r,h)=>{const profile=[[0,1],[.1,.97],[.3,.75],[.6,.42],[.86,.16],[1,.015]],colors=['#315a73','#376a85','#40778f','#34637e'];for(let j=0;j<profile.length-1;j++)for(let i=0;i<roundSides;i++){const a=i/roundSides*Math.PI*2,b=(i+1)/roundSides*Math.PI*2,[lo,lr]=profile[j],[hi,hr]=profile[j+1],p=(ang,f,rad)=>[x+Math.cos(ang)*r*rad,y+Math.sin(ang)*r*rad,z+f*h];panel(p(a,lo,lr),p(b,lo,lr),p(b,hi,hr),p(a,hi,hr),colors[(i+j)%colors.length]);}ring(x,y,z-.12,r,.18,trim,r,roundSides);ring(x,y,z+h,.10,.48,gold,.01,8);};
 const windows=(x,y,z,r,h,count=8)=>{for(let i=0;i<count;i++){const a=(i+.5)/count*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a),t=[-sa,ca],q=(side,up)=>[x+ca*(r+.025)+t[0]*side,y+sa*(r+.025)+t[1]*side,z+up];panel(q(-.18,0),q(.18,0),q(.18,h*.72),q(-.18,h*.72),'#394753');face(q(-.18,h*.72),q(.18,h*.72),q(0,h),'#394753');}};
 const balcony=(x,y,z,r)=>{ring(x,y,z,r+.38,.3,trim,r+.38);ring(x,y,z+.3,r+.28,.35,gold,r+.23);for(let i=0;i<posts;i++){const a=i/posts*Math.PI*2;box(x+Math.cos(a)*(r+.16),y+Math.sin(a)*(r+.16),z-.65,.24,.24,.65,trim);box(x+Math.cos(a)*(r+.29),y+Math.sin(a)*(r+.29),z+.65,.18,.18,.8,trim);}};
 const spire=(x,y,base,r,shaft,cap,color=pink)=>{ring(x,y,base,r,shaft,color,r*.9,bodySides);ring(x,y,base+shaft*.32,r*.98,.23,lightPink,r*.98,bodySides);windows(x,y,base+shaft*.54,r*.945,Math.min(2,shaft*.19));balcony(x,y,base+shaft-.65,r*.94);roof(x,y,base+shaft+.25,r*1.32,cap);};
 // Sculpted rocky foundation is wider on the west, where the dragon cave lies.
 for(const [x,y,rx,ry,rz,c] of [[-11,4,8,6,3.2,'#a6a59a'],[-5,7,7,5,2.8,'#999e92'],[9,5,5,5,2.4,'#b1afa0'],[-16,0,4,4,2.2,'#949a91']]){ellipsoid(x,y,rz*.55,rx,ry,rz*.65,c,12,5);ellipsoid(x,y+1,rz*1.03,rx*.74,ry*.7,.3,'#698f64',12,3);}
 // Open passage under the castle: no solid block is placed in the gateway.
 box(-8,0,0,5,16,7.5,stone);box(8,0,0,5,16,7.5,stone);box(0,0,7.5,13,13,4,stone);
 for(const x of [-5.8,5.8]){ring(x,-8.4,0,2.3,8.6,stone,2.3,roundSides);for(let z=.7;z<7.2;z+=.7)ring(x,-8.4,z,2.31,.045,'#8e938c',2.31,roundSides);ring(x,-8.4,7.3,2.4,.55,trim,2.65,roundSides);balcony(x,-8.4,8.3,2.4);ring(x,-8.4,9.3,2.25,3,pink,2.0,roundSides);windows(x,-8.4,10.1,2.13,1.1);roof(x,-8.4,12.4,2.65,5.8);}
 for(const x of [-10.1,10.1]){ring(x,-5.3,0,1.55,7.3,stone,1.55);ring(x,-5.3,7.3,1.55,3.3,lightPink,1.45);roof(x,-5.3,10.6,1.95,5.2);}
 const gateY=-9.8,curve=x=>3+3.35*Math.pow(1-Math.abs(x)/2.35,.7);
 box(-3.65,gateY,0,2.6,1.5,7.8,stone);box(3.65,gateY,0,2.6,1.5,7.8,stone);
 for(let i=0;i<16;i++){const x=-2.35+i/16*4.7,n=-2.35+(i+1)/16*4.7,a=curve(x),b=curve(n);panel([x,gateY-.8,a],[n,gateY-.8,b],[n,gateY-.8,8],[x,gateY-.8,8],stone);panel([x,gateY-.83,a],[n,gateY-.83,b],[n,gateY-.84,b+.38],[x,gateY-.84,a+.38],trim);panel([x,gateY-.8,a],[n,gateY-.8,b],[n,gateY+.8,b],[x,gateY+.8,a],trim);}
 box(-2.48,gateY-.85,0,.3,.15,3,trim);box(2.48,gateY-.85,0,.3,.15,3,trim);
 // Main Street stone bridge, central pitched hall and its large oval rose window.
 box(0,-13.1,.12,5.3,6.2,.32,trim);for(const x of [-2.85,2.85]){box(x,-13.1,.15,.35,6.2,1,stone);for(let j=0;j<6;j++)box(x,-15.8+j*1.05,1.15,.45,.38,.32,trim);}
 box(0,-3.9,11.5,7.1,5.9,9.2,pink);box(0,2.4,11.5,11.5,7.7,7,deepPink);
 const roofRidge=(x,y,z,w,d,h)=>{const a=[x-w/2,y-d/2,z],b=[x+w/2,y-d/2,z],c=[x+w/2,y+d/2,z],e=[x-w/2,y+d/2,z],A=[x,y-d/2,z+h],B=[x,y+d/2,z+h];panel(a,e,B,A,'#3b6f88');panel(b,c,B,A,'#467c95');face(a,b,A,pink);face(e,c,B,lightPink);tube([A,B],[.07,.07],gold,5);};
 roofRidge(0,-3.9,20.7,7.8,6.4,5.6);roofRidge(0,2.4,18.5,12.3,8.1,5.5);
 const rose=(x,y,z,rx,rz)=>{for(let i=0;i<32;i++){const a=i/32*Math.PI*2,b=(i+1)/32*Math.PI*2,p=(t,s)=>[x+Math.cos(t)*rx*s,y,z+Math.sin(t)*rz*s];face([x,y+.04,z],p(a,.81),p(b,.81),'#344963');panel(p(a,.81),p(b,.81),p(b,1),p(a,1),gold);}tube([[x,y-.025,z-rz*.8],[x,y-.025,z+rz*.8]],[.045,.045],trim,5);tube([[x-rx*.8,y-.025,z],[x+rx*.8,y-.025,z]],[.045,.045],trim,5);};
 rose(0,-6.92,19.4,1.15,1.7);box(0,-7.0,15.5,5.0,.5,.35,trim);
 // Different heights and off-centre placement reproduce the recognisable silhouette.
 spire(-7.6,4.7,6.8,2.1,14,7.5,lightPink);spire(7.4,4.8,7,2.05,17.8,7.6,pink);
 spire(-3.8,1.5,16.3,1.4,10.1,6.3,deepPink);spire(5.6,.7,16.4,1.15,10.8,6.3,lightPink);
 spire(-3,-3.7,17.3,.82,7.1,6.4,pink);spire(3.1,-3.3,16.8,.72,6.4,6.2,lightPink);
 ring(1.25,3.25,18.5,2.0,11.6,pink,1.75,roundSides);windows(1.25,3.25,24,1.85,3,10);balcony(1.25,3.25,29.55,1.85);
 ring(1.25,3.25,31.05,1.28,6.7,lightPink,1.12,roundSides);windows(1.25,3.25,34.1,1.20,1.8,8);roof(1.25,3.25,37.75,1.48,4.77);rose(1.25,1.97,36.65,.64,.72);
 // Narrow gilded pinnacles and small metal pennants instead of large billboard logos.
 for(const [x,y,z,h] of [[-1.9,-3.0,25.3,8.2],[3.7,1.1,30.1,6.0],[-5.2,4,27,4.7]]){ring(x,y,z,.17,h,gold,.02,8);face([x,y,z+h-.35],[x+1.0,y,z+h-.7],[x,y,z+h-1.05],gold);}
 if(landmark.dragon){
  const base=landmark.dragon.offset||[-17.3,-1.1],D=p=>[p[0]+base[0],p[1]+base[1],p[2]],ball=(p,r,c)=>ellipsoid(...D(p),...r,c,ballSides,ballBands),line=(ps,rs,c,s=8)=>tube(ps.map(D),rs,c,s),skin='#658863',belly='#b1aa7b';
  // The visible low cave recess is illustrative; the pin stays at the real entrance.
  ball([0,1.8,.4],[3.7,4.5,.35],'#6d786a');ball([-2.0,2.3,1.25],[1,3.1,1.45],'#89968b');ball([2.3,2.6,1.25],[1,3,1.6],'#949b8c');
  ball([0,1.25,1.65],[1.72,3.0,1.45],skin);ball([0,-.5,1.15],[1.1,1.5,.6],belly);
  line([[.15,.2,2],[.2,-1.1,2.5],[.6,-2.1,2.0],[.65,-3.2,1.5]],[.72,.69,.53,.4],skin,12);
  ball([.65,-3.35,1.45],[.82,1.1,.55],skin);ball([.65,-4.05,1.20],[.62,.85,.28],belly);
  line([[-.9,3.1,1.65],[-2.3,4.2,1.25],[-3.1,3.8,.8],[-3.6,2.3,.55],[-3.0,.5,.4],[-1.95,-1.0,.3]],[.66,.53,.36,.25,.13,.015],skin,10);
  for(const x of [-1.2,1.2]){ball([x,-.65,1.0],[.7,1.2,.7],skin);ball([x,-1.5,.45],[.72,1.1,.35],belly);for(let j=0;j<3;j++)line([[x+(j-1)*.25,-2.1,.5],[x+(j-1)*.25,-2.55,.35]],[.11,.015],'#e4dcc0',6);}
  for(const side of [-1,1]){const wing=[[side*.45,.7,2.75],[side*2.6,2.15,4.05],[side*2.8,3.5,2.3],[side*.65,3.15,2.55]].map(D);panel(...wing,'#a57270');for(let j=1;j<4;j++)line([[side*.45,.7,2.75],[side*(j===1?2.6:j===2?2.8:.65),j===1?2.15:j===2?3.5:3.15,j===1?4.05:j===2?2.3:2.55]],[.09,.035],'#638060',6);}
  for(let i=0;i<6;i++){const y=.2+i*.52,z=2.9+.15*Math.sin(i);face(D([-.1,y,z]),D([.1,y,z]),D([0,y+.12,z+.38]),'#bfb389');}
  for(const side of [-1,1]){ball([.65+side*.56,-3.63,1.7],[.14,.21,.11],'#e9b653');ball([.65+side*.64,-3.7,1.72],[.04,.10,.065],'#253525');line([[.65+side*.55,-2.95,1.8],[.65+side*.85,-2.6,2.3],[.65+side*.86,-2.3,2.45]],[.14,.08,.008],'#ded0a5',8);}
 }
}

// Photo-informed architecture, still one static vertex buffer. No routing geometry.
function detailTools(tri,quad,pt,compact){
 const P=p=>[...pt(p[0],p[1]),p[2]],face=(a,b,c,col)=>tri(P(a),P(b),P(c),col),panel=(a,b,c,d,col)=>quad(P(a),P(b),P(c),P(d),col),sides=compact?12:24;
 const box=(x,y,z,w,d,h,col)=>{const a=[x-w/2,y-d/2,z],b=[x+w/2,y-d/2,z],c=[x+w/2,y+d/2,z],e=[x-w/2,y+d/2,z],up=p=>[p[0],p[1],z+h];panel(a,b,up(b),up(a),col);panel(b,c,up(c),up(b),col);panel(c,e,up(e),up(c),col);panel(e,a,up(a),up(e),col);panel(up(a),up(b),up(c),up(e),col);};
 const ring=(x,y,z,r,h,col,top=r,n=sides)=>{for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,p=(t,R,Z)=>[x+Math.cos(t)*R,y+Math.sin(t)*R,Z];panel(p(a,r,z),p(b,r,z),p(b,top,z+h),p(a,top,z+h),col);face([x,y,z+h],p(a,top,z+h),p(b,top,z+h),col);}};
 const beam=(a,b,r,col)=>{const v=b.map((x,i)=>x-a[i]),len=Math.hypot(...v);if(len<.001)return;const t=v.map(x=>x/len),n=Math.abs(t[2])>.95?[1,0,0]:[-t[1],t[0],0],nl=Math.hypot(...n);for(let i=0;i<3;i++)n[i]/=nl;const w=[t[1]*n[2]-t[2]*n[1],t[2]*n[0]-t[0]*n[2],t[0]*n[1]-t[1]*n[0]],corners=p=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>p.map((x,i)=>x+r*(n[i]*u+w[i]*v))),A=corners(a),B=corners(b);for(let i=0;i<4;i++)panel(A[i],A[(i+1)%4],B[(i+1)%4],B[i],col);};
 const disc=(x,y,z,r,d,col)=>{for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2,p=(t,Y)=>[x+Math.cos(t)*r,Y,z+Math.sin(t)*r];face([x,y-d/2,z],p(a,y-d/2),p(b,y-d/2),col);face([x,y+d/2,z],p(a,y+d/2),p(b,y+d/2),col);panel(p(a,y-d/2),p(b,y-d/2),p(b,y+d/2),p(a,y+d/2),col);}};
 const arch=(x,y,r,spring,top,depth,col,trim)=>{box(x-r-.35,y,0,.7,depth,spring,col);box(x+r+.35,y,0,.7,depth,spring,col);const count=compact?12:24,curve=X=>spring+Math.sqrt(Math.max(0,r*r-X*X));for(let i=0;i<count;i++){const a=-r+i/count*r*2,b=-r+(i+1)/count*r*2,A=curve(a),B=curve(b);for(const yy of [y-depth/2,y+depth/2]){panel([x+a,yy,A],[x+b,yy,B],[x+b,yy,top],[x+a,yy,top],col);panel([x+a,yy-.025,A],[x+b,yy-.025,B],[x+b,yy-.025,B+.24],[x+a,yy-.025,A+.24],trim);}panel([x+a,y-depth/2,A],[x+b,y-depth/2,B],[x+b,y+depth/2,B],[x+a,y+depth/2,A],trim);}};
 const ridge=(x,y,z,w,d,h,col)=>{const a=[x-w/2,y-d/2,z],b=[x+w/2,y-d/2,z],c=[x+w/2,y+d/2,z],e=[x-w/2,y+d/2,z],A=[x,y-d/2,z+h],B=[x,y+d/2,z+h];panel(a,e,B,A,col);panel(b,c,B,A,col);face(a,b,A,col);face(e,c,B,col);};
 const window=(x,y,z,w,h,frame='#cec3a4',glass='#33464c')=>{panel([x-w/2,y,z],[x+w/2,y,z],[x+w/2,y,z+h],[x-w/2,y,z+h],glass);for(const X of [x-w/2,x,x+w/2])beam([X,y-.035,z],[X,y-.035,z+h],.045,frame);for(const Z of [z,z+h*.48,z+h])beam([x-w/2,y-.035,Z],[x+w/2,y-.035,Z],.055,frame);};
 const fence=(x1,x2,y,h,col='#315d54',ornate=false,base=0)=>{for(const z of [.25,h*.6,h])beam([x1,y,z+base],[x2,y,z+base],.055,col);const step=compact?.7:.38;for(let x=x1;x<=x2;x+=step){beam([x,y,.05+base],[x,y,h+base+(ornate?.18:0)],.038,col);if(ornate){face([x-.075,y,h+base],[x+.075,y,h+base],[x,y,h+base+.32],'#b9a360');}}};
 const clock=(x,y,z,r)=>{disc(x,y,z,r,.1,'#ece5c7');for(let i=0;i<12;i++){const a=i/12*Math.PI*2;beam([x+Math.sin(a)*r*.75,y-.08,z+Math.cos(a)*r*.75],[x+Math.sin(a)*r*.88,y-.08,z+Math.cos(a)*r*.88],.025,'#273b3b');}beam([x,y-.11,z],[x-r*.45,y-.11,z+r*.15],.035,'#273b3b');beam([x,y-.11,z],[x+r*.18,y-.11,z+r*.65],.025,'#273b3b');};
 return {box,ring,beam,disc,arch,ridge,window,fence,clock,panel,face,sides};
}
function towerMesh(tri,quad,pt,l,compact){
 const {box,ring,beam,ridge,window,panel}=detailTools(tri,quad,pt,compact),d=l.length*.22,wall='#b5a68d',edge='#d0bca0',dark='#595b50';
 box(0,-d,0,23,19,47,wall);box(-11,-d+4,0,8,17,32,'#c5b493');box(11,-d+5,0,8,17,36,'#b9ad96');
 // Projecting upper wings, stepped Pueblo Deco cornices and a domed pinnacle.
 box(-8,-d,45,8.5,19.6,8.1,'#bbae96');box(8,-d,46,8,19.6,8.8,'#c0b297');box(0,-d+2,47,11,12,8,'#c5b596');
 for(const [x,y,z,w,depth] of [[-8,-d,53.1,9.2,20.4],[8,-d,54.8,8.8,20.4],[0,-d+2,55,11.5,12.5]]){box(x,y,z,w,depth,.42,edge);box(x,y,z+.5,w-.25,depth-.25,.5,'#988e78');for(let X=x-w/2+.25;X<x+w/2;X+=.65)box(X,y-depth/2-.03,z-1.1,.14,.1,1.1,'#908974');}
 box(0,-d+2,56,7.7,8.4,1.2,'#c0b397');ring(0,-d+2,57.2,3.1,.8,'#b3aa92',2.3);ring(0,-d+2,58,2.3,1,'#a3a28c',.08);
 for(const z of [14,23,31,44.5])box(0,-d-9.68,z,23.5,.45,.3,'#938875');
 const spacing=compact?6:4;for(let z=12;z<45;z+=4.25)for(let x=-8;x<=8;x+=spacing){window(x,-d-9.56,z,1.13,2.15,edge,(Math.floor(z)+x)%3?'#4b5350':'#778077');box(x,-d-9.7,z-.12,1.45,.36,.2,edge);}
 for(const x of [-8,8])for(let z=47;z<52.5;z+=2.45)window(x,-d-9.88,z,1.2,1.55,edge,dark);
 for(let z=12;z<44;z+=5.5)for(const x of [-11.53,11.53])for(const Y of [-d-5,-d+1,-d+6]){const side=x<0?-1:1;panel([x,Y-.55,z],[x,Y+.55,z],[x,Y+.55,z+2],[x,Y-.55,z+2],dark);beam([x+side*.05,Y-.68,z-.12],[x+side*.05,Y+.68,z-.12],.10,edge);}
 // Exposed broken lift-bay masonry and weathering, rather than pristine flat blocks.
 box(0,-d-9.9,7,7,.7,18,'#6f7164');for(const x of [-3.7,3.7])box(x,-d-10.05,5,.55,.6,22,'#8a8873');for(let z=8;z<24;z+=3.3){box(0,-d-10.1,z,7.4,.65,.3,'#a5977c');box(-.5+(Math.floor(z)%2),-d-10.15,z+.6,2.1,.1,1.8,'#434b49');}
 for(let i=0;i<(compact?18:38);i++){const x=-10+(i*7.91%20),z=12+(i*5.43%32),w=.3+(i%3)*.19,h=.45+(i%4)*.4;panel([x,-d-9.58,z],[x+w,-d-9.58,z],[x+w,-d-9.58,z+h],[x,-d-9.58,z+h],i%2?'#a29880':'#918c76');}
 box(0,-d-10.12,35.5,13.8,.3,7,'#8b8876');
 for(const [x,y,z,w,depth] of [[-11,-d+4,32,8,17],[11,-d+5,36,8,17]])ridge(x,y,z,w,depth,2,'#887862');
}
function parkDetailMesh(tri,quad,pt,l,compact){
 const {box,ring,beam,disc,arch,ridge,window,fence,clock,panel,face,sides}=detailTools(tri,quad,pt,compact),cream='#e3d2ad',green='#305b50',gold='#baa160';
 if(l.kind==='waterTower'){
  for(const x of [-2.8,2.8])for(const y of [-2.8,2.8]){box(x,y,0,1,1,.7,'#918e7c');beam([x,y,.7],[x*.73,y*.73,24],.18,'#d6d0b5');}
  for(const z of [7,15,23]){const r=2.8-z*.027;for(const sign of [-1,1]){beam([-r,sign*r,z],[r,sign*r,z],.08,'#b9bca4');beam([sign*r,-r,z],[sign*r,r,z],.08,'#b9bca4');}}
  for(const [lo,hi] of [[.8,7],[7,15],[15,23]])for(const y of [-2.7,2.7]){beam([-2.6,y,lo],[2.3,y*.83,hi],.045,'#bac0a9');beam([2.6,y,lo],[-2.3,y*.83,hi],.045,'#bac0a9');}
  ring(0,0,22.7,.75,1.6,cream,3.45);ring(0,0,24.3,3.45,4.1,'#e5d8b4',3.45);ring(0,0,28.4,3.52,.32,'#a8afa1',3.55);ring(0,0,28.72,3.55,.8,'#4b5553',1.1);ring(0,0,23.95,4.15,.25,'#b7b79f',4.15);
  for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2;beam([Math.cos(a)*4.05,Math.sin(a)*4.05,24.2],[Math.cos(a)*4.05,Math.sin(a)*4.05,25.0],.035,'#a2aaa0');beam([Math.cos(a)*4.05,Math.sin(a)*4.05,25.0],[Math.cos(b)*4.05,Math.sin(b)*4.05,25.0],.035,'#a2aaa0');}
  for(const x of [-3.75,3.75])disc(x,.25,30.3,2.7,.28,'#222b2c');
  // Access ladder is kept distinct from the diagonal structural braces.
  for(const x of [-.35,.35])beam([x,-2.75,1],[x,-2.75,24],.04,'#8f9c92');for(let z=1;z<24;z+=compact?1.1:.55)beam([-.35,-2.75,z],[.35,-2.75,z],.035,'#aeb8a4');
 }
 if(l.kind==='entry'){
  const orange='#d6a467',light='#e4b572',radius=4.55,spring=6.5;
  arch(0,0,radius,spring,15.8,3.0,orange,cream);
  for(const x of [-5.45,5.45]){box(x,0,0,1.55,3.5,14.7,orange);box(x,0,0,1.62,3.62,2.5,'#8e5d49');for(const z of [2.5,8.4,12.8,14.7]){box(x,0,z,1.95,3.85,.32,cream);box(x,0,z+.33,1.72,3.6,.18,'#bcb391');}for(let z=.3;z<2.4;z+=.5)for(const X of [-.45,.45]){beam([x+X-.23,-1.825,z],[x+X+.23,-1.825,z+.5],.018,'#c5a17e');beam([x+X+.23,-1.825,z],[x+X-.23,-1.825,z+.5],.018,'#c5a17e');}}
  // Curved crown follows the photo, with several relief bands instead of a flat roof.
  const wave=x=>15.4+1.05*Math.cos(x/6.4*Math.PI/2);for(let i=0;i<(compact?14:28);i++){const a=-6.4+i/(compact?14:28)*12.8,b=-6.4+(i+1)/(compact?14:28)*12.8;panel([a,-1.65,14.4],[b,-1.65,14.4],[b,-1.65,wave(b)],[a,-1.65,wave(a)],orange);for(const offset of [0,.25,.5])panel([a,-1.8-offset*.15,wave(a)+offset],[b,-1.8-offset*.15,wave(b)+offset],[b,-1.8-offset*.15,wave(b)+offset+.16],[a,-1.8-offset*.15,wave(a)+offset+.16],cream);panel([a,-1.65,wave(a)+.65],[b,-1.65,wave(b)+.65],[b,1.65,wave(b)+.65],[a,1.65,wave(a)+.65],cream);}
  for(const side of [-1,1]){
   const centers=[10.2,17.1,24];for(const X of centers){const x=side*X;arch(x,0,2.7,3.2,10.8,3.2,light,cream);box(x,0,10.8,6.8,3.5,.55,cream);box(x,0,11.35,7,3.65,.2,'#c2b99a');for(let i=0;i<9;i++){const a=i/9*Math.PI,b=(i+1)/9*Math.PI;face([x,-1.66,3.4],[x+Math.cos(a)*2.6,-1.66,3.4+Math.sin(a)*2.6],[x+Math.cos(b)*2.6,-1.66,3.4+Math.sin(b)*2.6],i%2?gold:green);}for(let i=0;i<=10;i++){const a=i/10*Math.PI;beam([x,-1.7,3.4],[x+Math.cos(a)*2.6,-1.7,3.4+Math.sin(a)*2.6],.045,cream);}for(const xx of [-2.15,2.15])beam([x+xx,0,0],[x+xx,0,3.6],.09,green);for(const xx of [-1.65,0,1.65]){box(x+xx,.7,0,.32,.65,.95,'#7b9881');beam([x+xx-.3,.1,.8],[x+xx+.3,.1,.8],.035,'#d3cbbb');} }
  }
  // Central wrought-iron leaves, sunburst, sweeping scrolls and wall lanterns.
  fence(-4.4,4.4,-1.8,4.9,green,true);for(const s of [-1,1]){beam([s*4.3,-1.87,.7],[0,-1.87,6.1],.1,gold);for(const z of [1.0,3.1,5.1])beam([s*4.3,-1.9,z],[0,-1.9,z+1],.045,green);for(let i=0;i<12;i++){const a=i/12*Math.PI*2,b=(i+1)/12*Math.PI*2;beam([s*.63+Math.cos(a)*.65,-1.92,5.95+Math.sin(a)*.65],[s*.63+Math.cos(b)*.65,-1.92,5.95+Math.sin(b)*.65],.055,green);}}
  disc(0,-1.95,4.6,.65,.07,gold);for(const x of [-6.3,6.3,-13.7,13.7,-20.6,20.6]){box(x,-1.82,5.7,.32,.35,1.2,'#685c43');box(x,-2.02,5.85,.21,.16,.82,'#e7c173');beam([x,-1.85,5.7],[x,-1.85,7.0],.035,green);}
 }
 if(l.kind==='station'){
  const W=l.length,platform=4.3;
  // Elevated open pedestrian underpasses, side stairs and metal train canopy.
  box(0,0,platform-.45,W,22,.45,'#c9b894');for(const x of [-W/2+2,-14,-6,6,14,W/2-2]){box(x,0,0,1.5,14,platform-.45,'#bda783');box(x,-7.15,3.2,2.2,.8,.65,cream);}
  for(const side of [-1,1])for(let i=0;i<11;i++)box(side*(W/2+1+i*.45),-3,0,.5,5,(11-i)/11*platform,'#bbaa88');
  for(const y of [-11,10.5])fence(-W/2,W/2,y,1.1,green,false,platform);
  for(let x=-W/2+2;x<W/2;x+=5.8){beam([x,4,platform],[x,4,9.5],.09,green);beam([x,-3,platform],[x,-3,9.5],.09,green);beam([x,-4,9.5],[x,8,9.5],.08,green);}
  for(let x=-W/2;x<W/2;x+=3.8)for(let y=-8;y<8;y+=2){panel([x,y,9.55],[Math.min(x+3.7,W/2),y,9.55],[Math.min(x+3.7,W/2),y+1.92,9.8],[x,y+1.92,9.8],((Math.floor(x)+Math.floor(y))%2)?'#9ab3af':'#b5c9bb');}
  box(0,-9,platform,28,2.7,5.2,'#dec99e');box(0,-9,9.5,28.9,3.3,.4,cream);ridge(0,-9,9.9,29.5,3.5,2.2,'#7b806c');
  for(const x of [-10,-5,5,10]){window(x,-10.39,5.15,2.25,3.7,green,'#5d6455');disc(x,-10.45,8.2,.65,.06,'#a36a64');ring(x,-10.6,platform,.18,5.4,cream,.18,8);}
  box(0,-9,platform,6.0,3.2,7.2,cream);ridge(0,-9,11.5,7.5,4.0,3.7,'#717a69');clock(0,-11.05,12.8,.83);for(const x of [-3.2,3.2]){ring(x,-10.9,4.3,.22,7.4,cream,.22,8);ring(x,-10.9,11.7,.34,1.2,gold,.015,8);}ring(0,-9,15.2,.18,.8,gold,.01,8);
  for(const [center,r] of [[-10,3.4],[0,5],[10,3.4]])for(let j=0;j<12;j++){const a=-r+j/12*r*2,b=-r+(j+1)/12*r*2,A=3+.72*Math.sqrt(1-(a/r)**2),B=3+.72*Math.sqrt(1-(b/r)**2);for(const y of [-10.95,10.95])panel([center+a,y,A],[center+b,y,B],[center+b,y,4.28],[center+a,y,4.28],cream);}
  for(const center of [-8.5,8.5])for(let i=0;i<12;i++){const a=i/12,b=(i+1)/12,x=u=>center+(u-.5)*8,z=u=>9.65-.65*Math.sin(u*Math.PI);panel([x(a),-10.43,z(a)],[x(b),-10.43,z(b)],[x(b),-10.43,z(b)-.25],[x(a),-10.43,z(a)-.25],gold);}
  for(let x=-14;x<=14;x+=2.6)ring(x,-10.8,10.1,.08,.55,gold,.01,6);
 }
 if(l.kind==='chessy'){
  const W=l.length,D=l.width,glass='#6d9898',metal='#819890';
  box(0,0,0,W,D,5.8,'#a7aba2');
  // Long glazed hall with ribs, red stone columns and the recognisable arched entry.
  const bands=compact?12:24,span=D/2;for(let j=0;j<bands;j++){const a=-Math.PI/2+j/bands*Math.PI,b=-Math.PI/2+(j+1)/bands*Math.PI,Y=t=>Math.sin(t)*span,Z=t=>6+Math.cos(t)*10.5;for(let x=-W/2;x<W/2;x+=compact?12:6){panel([x,Y(a),Z(a)],[Math.min(x+(compact?12:6)-.12,W/2),Y(a),Z(a)],[Math.min(x+(compact?12:6)-.12,W/2),Y(b),Z(b)],[x,Y(b),Z(b)],j%4===0?'#84aaa7':glass);}beam([-W/2,Y(a),Z(a)+.08],[W/2,Y(a),Z(a)+.08],.065,metal);}
  for(let x=-W/2;x<=W/2;x+=compact?12:6)for(let j=0;j<bands;j++){const a=-Math.PI/2+j/bands*Math.PI,b=-Math.PI/2+(j+1)/bands*Math.PI;beam([x,Math.sin(a)*span,6+Math.cos(a)*10.5+.12],[x,Math.sin(b)*span,6+Math.cos(b)*10.5+.12],.075,'#c3cdc0');}
  for(const side of [-1,1]){const y=side*(D/2+.35);for(let x=-W/2+2;x<W/2;x+=5.8)window(x,y,1,4.8,4.4,metal,'#608c89');}
  const {ring:entryRing,beam:entryBeam,face:entryFace,clock:entryClock}=detailTools(tri,quad,(u,v)=>pt(W/2-v,u),compact),front=-2.5;for(const x of [-10.8,10.8]){entryRing(x,front,0,1.45,12.8,'#b47d7b',1.45);entryRing(x,front,12.8,1.75,2.4,'#879080',.03);}
  const r=9.4,base=4;for(let i=0;i<(compact?16:32);i++){const a=i/(compact?16:32)*Math.PI,b=(i+1)/(compact?16:32)*Math.PI;entryFace([0,front-.1,base],[Math.cos(a)*r,front-.1,base+Math.sin(a)*r],[Math.cos(b)*r,front-.1,base+Math.sin(b)*r],i%2?glass:'#7ba49c');entryBeam([Math.cos(a)*r,front-.18,base+Math.sin(a)*r],[Math.cos(b)*r,front-.18,base+Math.sin(b)*r],.1,'#d3d6c6');}
  for(const x of [-8,-6,-4,-2,0,2,4,6,8])entryBeam([x,front-.21,0],[x,front-.21,base+Math.sqrt(r*r-x*x)],.07,'#b9ccc0');for(const z of [2,4,6,8,10]){const w=z<base?r:Math.sqrt(Math.max(0,r*r-(z-base)**2));entryBeam([-w,front-.22,z],[w,front-.22,z],.065,'#b9ccc0');}entryClock(0,front-.28,11.7,.95);
 }
}
function linearDetailMesh(tri,quad,scene,compact){
 const xy=p=>[(p[0]-ORIGIN[0])*SX,(p[1]-ORIGIN[1])*SY],{beam,panel}=detailTools(tri,quad,(x,y)=>[x,y],compact);
 for(const railway of scene.railways||[]){const ps=railway.points.map(p=>[...xy(p),p[2]??.12]);const gauge=railway.gauge||.914;
  let next=0,along=0;for(let i=0;i<ps.length-1;i++){const a=ps[i],b=ps[i+1],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length<.05)continue;const nx=-dy/length,ny=dx/length,at=(t,offset,z=0)=>[a[0]+dx*t+nx*offset,a[1]+dy*t+ny*offset,a[2]+(b[2]-a[2])*t+z];
   if(railway.type!=='tram')panel(at(0,-gauge*.9,-.035),at(1,-gauge*.9,-.035),at(1,gauge*.9,-.035),at(0,gauge*.9,-.035),'#858779');
   for(const side of [-1,1]){const offset=side*gauge/2;panel(at(0,offset-.055,.1),at(1,offset-.055,.1),at(1,offset+.055,.1),at(0,offset+.055,.1),'#afb3ac');if(!compact)panel(at(0,offset-.045),at(1,offset-.045),at(1,offset-.045,.1),at(0,offset-.045,.1),'#5a655f');}
   if(railway.type!=='tram')while(next<=along+length){const t=(next-along)/length;if(t>=0){const step=.20/length;panel(at(Math.max(0,t-step),-gauge*.85,.025),at(Math.min(1,t+step),-gauge*.85,.025),at(Math.min(1,t+step),gauge*.85,.025),at(Math.max(0,t-step),gauge*.85,.025),'#725f49');}next+=compact?3.2:1.4;}along+=length;
  }
 }
 for(const fence of scene.fences||[]){const ps=fence.points.map(xy);for(let i=0;i<ps.length-1;i++){const a=ps[i],b=ps[i+1],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length<.05)continue;for(const z of [.35,1.3,1.8])beam([...a,z],[...b,z],.025,'#476454');for(let t=0;t<=length;t+=compact?2:1)beam([a[0]+dx*t/length,a[1]+dy*t/length,0],[a[0]+dx*t/length,a[1]+dy*t/length,1.9],.035,'#3b5b4b');}}
}

function modelMatrix(matrix,mercator,scale){const out=new Float32Array(16);for(let r=0;r<4;r++){out[r]=matrix[r]*scale;out[4+r]=-matrix[4+r]*scale;out[8+r]=matrix[8+r]*scale;out[12+r]=matrix[r]*mercator.x+matrix[4+r]*mercator.y+matrix[8+r]*mercator.z+matrix[12+r];}return out;}
function layer(lib,scene,rides,onDiagnostic){const note=(name,error)=>{try{onDiagnostic?.({name,vertices:vertices.length/6,bufferBytes:vertices.byteLength,...(error?{message:error.message||String(error),errorName:error.name||'Error'}:{})});}catch{}};const vertices=build(scene,rides);return {id:'park-landmarks',type:'custom',renderingMode:'3d',onAdd(map,gl){this.map=map;const oldVao=gl.getParameter(gl.VERTEX_ARRAY_BINDING),oldBuffer=gl.getParameter(gl.ARRAY_BUFFER_BINDING);this.disabled=false;this.shaders=[];try{this.origin=lib.MercatorCoordinate.fromLngLat(ORIGIN,0);this.scale=this.origin.meterInMercatorCoordinateUnits();const shader=(type,source)=>{const s=gl.createShader(type);this.shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};const vs=shader(gl.VERTEX_SHADER,'#version 300 es\nin vec3 a_pos;in vec3 a_color;uniform mat4 u_matrix;out vec3 v_color;void main(){v_color=a_color;gl_Position=u_matrix*vec4(a_pos,1.0);}'),fs=shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;in vec3 v_color;out vec4 fragColor;void main(){fragColor=vec4(v_color,1.0);}');this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);this.shaders=[];if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('3D shader');this.vao=gl.createVertexArray();this.buffer=gl.createBuffer();gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);for(const [name,offset] of [['a_pos',0],['a_color',12]]){const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,24,offset);}gl.bindVertexArray(null);this.uniform=gl.getUniformLocation(this.program,'u_matrix');note('mesh-ready');}catch(error){this.disabled=true;note('mesh-error',error);console.warn('3D landmark shader:',error);}finally{for(const shader of this.shaders)gl.deleteShader(shader);this.shaders=[];gl.bindVertexArray(oldVao);gl.bindBuffer(gl.ARRAY_BUFFER,oldBuffer);}},render(gl,{defaultProjectionData}){if(this.disabled||gl.isContextLost?.()||(this.map?.getZoom?.()??18)<14)return;const vao=gl.getParameter(gl.VERTEX_ARRAY_BINDING),program=gl.getParameter(gl.CURRENT_PROGRAM),cull=gl.isEnabled(gl.CULL_FACE);try{gl.disable(gl.CULL_FACE);gl.useProgram(this.program);gl.bindVertexArray(this.vao);gl.uniformMatrix4fv(this.uniform,false,modelMatrix(defaultProjectionData.mainMatrix,this.origin,this.scale));gl.drawArrays(gl.TRIANGLES,0,vertices.length/6);}catch(error){this.disabled=true;note('mesh-error',error);console.warn('3D landmark draw:',error);}finally{gl.bindVertexArray(vao);gl.useProgram(program);if(cull)gl.enable(gl.CULL_FACE);}},onRemove(map,gl){if(this.buffer)gl.deleteBuffer(this.buffer);if(this.vao)gl.deleteVertexArray(this.vao);if(this.program)gl.deleteProgram(this.program);}};}
function markLines(name){const known={'The Twilight Zone Tower of Terror':['THE HOLLYWOOD','TOWER HOTEL'],'Star Wars Hyperspace Mountain':['STAR WARS','HYPERSPACE MOUNTAIN'],"Ratatouille : L'Aventure totalement toquée de Rémy":['RATATOUILLE',"L’AVENTURE DE RÉMY"],'Avengers Assemble: Flight Force':['AVENGERS','FLIGHT FORCE'],'Sleeping Beauty Castle':['LE CHÂTEAU','DE LA BELLE AU BOIS DORMANT'],'Frozen Ever After':['FROZEN','EVER AFTER']};if(known[name])return known[name];const words=name.replace(/[®™]/g,'').toUpperCase().split(/\s+/),lines=[''];for(const word of words){const i=lines.length-1;if(lines[i]&&lines[i].length+word.length>19&&lines.length<3)lines.push(word);else lines[i]+=(lines[i]?' ':'')+word;}return lines.slice(0,3);}
function mark(ride){const name=ride.name,lines=markLines(name),ink=/Tower/.test(name)?'#76513a':/Frozen/.test(name)?'#357691':/Star Wars/.test(name)?'#474f68':'#234477',accent=/Tower/.test(name)?'#e1bd74':/Frozen/.test(name)?'#b7e3ee':'#e5bd63',escape=t=>String(t).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');const h=66;return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="${h}" viewBox="0 0 160 ${h}"><rect x="2" y="2" width="156" height="62" rx="10" fill="${ink}" stroke="${accent}" stroke-width="2"/><path d="M16 12h128M16 54h128" stroke="${accent}" opacity=".65"/>${lines.map((line,i)=>`<text x="80" y="${lines.length===1?37:lines.length===2?29+i*18:23+i*14}" fill="#fffaf0" font-family="Arial,sans-serif" font-size="${i===0?12:9}" font-weight="bold" text-anchor="middle" textLength="${Math.min(135,line.length*(i===0?7:5))}" lengthAdjust="spacingAndGlyphs">${escape(line)}</text>`).join('')}</svg>`);}
function signLayer(lib,scene,onDiagnostic,roof=false,flag=false){
 const signs=roof?scene.roofLettering?.labels||[]:scene.facadeSigns||[];if(!signs.length)return null;
 const cols=roof?8:4,cw=flag?192:256,ch=flag?64:96,width=cols*cw,height=Math.ceil(signs.length/cols)*ch,vertices=[];
 for(const [i,s] of signs.entries()){if(s.vertices){for(let j=0;j<s.vertices.length;j+=5){vertices.push(...s.vertices.slice(j,j+3),(i%cols+s.vertices[j+3])/cols,(Math.floor(i/cols)+s.vertices[j+4])/Math.ceil(signs.length/cols));if(flag)vertices.push(s.vertices[j+3]);}continue;}const col=i%cols,row=Math.floor(i/cols),u0=col/cols,u1=(col+1)/cols,v0=row*ch/height,v1=(row+1)*ch/height;const p=(side,up)=>[s.center[0]+s.axis[0]*s.width/2*side,s.center[1]+s.axis[1]*s.width/2*side,s.center[2]+s.height/2*up],a=p(-1,-1),b=p(1,-1),c=p(1,1),d=p(-1,1);for(const [p,u,v] of [[a,u0,v1],[b,u1,v1],[c,u1,v0],[a,u0,v1],[c,u1,v0],[d,u0,v0]])vertices.push(...p,u,v);}
 const stride=flag?6:5,data=new Float32Array(vertices),note=(name,error)=>{try{onDiagnostic?.({name,vertices:data.length/stride,bufferBytes:data.byteLength,width,height,...(error?{message:error.message||String(error),errorName:error.name||'Error'}:{})});}catch{}};
 return {id:flag?'park-roof-flags':roof?'park-roof-lettering':'park-facade-signs',type:'custom',renderingMode:'3d',onAdd(map,gl){this.map=map;this.disabled=false;this.shaders=[];const vao=gl.getParameter(gl.VERTEX_ARRAY_BINDING),buffer=gl.getParameter(gl.ARRAY_BUFFER_BINDING),active=gl.getParameter(gl.ACTIVE_TEXTURE),flip=gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);gl.activeTexture(gl.TEXTURE0);const texture=gl.getParameter(gl.TEXTURE_BINDING_2D);try{
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Facade lettering canvas');for(const [i,s] of signs.entries()){const x=i%cols*cw,y=Math.floor(i/cols)*ch,lines=s.lines?.length?s.lines:markLines(s.name);if(!roof&&s.plaque!==false){ctx.fillStyle=s.color||(/Tower/.test(s.name)?'#664531':'#25446f');ctx.fillRect(x,y,cw,ch);ctx.strokeStyle='#e4c785';ctx.lineWidth=3;ctx.strokeRect(x+4,y+4,cw-8,ch-8);}ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=s.ink||'#fff9e8';for(const [j,line] of lines.entries()){ctx.font=s.textStyle==='hotel'?`${j===0||j===lines.length-1?'italic':'bold'} ${j===0||j===lines.length-1?17:24}px Georgia`:s.textStyle==='water'?`${j===0?'italic':'bold'} ${j===0?16:24}px Georgia`:`bold ${roof?Math.min(38,72/lines.length):j===0?24:17}px Arial`;if(roof||s.plaque===false){ctx.strokeStyle='#213045';ctx.lineWidth=1.5;ctx.strokeText(line,x+cw/2,y+ch/2+(j-(lines.length-1)/2)*25,cw-22);}ctx.fillText(line,x+cw/2,y+ch/2+(j-(lines.length-1)/2)*25,cw-22);}}
  if(width>gl.getParameter(gl.MAX_TEXTURE_SIZE)||height>gl.getParameter(gl.MAX_TEXTURE_SIZE))throw Error('Facade lettering exceeds texture limit');
  this.origin=lib.MercatorCoordinate.fromLngLat(ORIGIN,0);this.scale=this.origin.meterInMercatorCoordinateUnits();const shader=(type,source)=>{const s=gl.createShader(type);this.shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};const vs=shader(gl.VERTEX_SHADER,`#version 300 es\nin vec3 a_pos;in vec2 a_uv;uniform mat4 u_matrix;${flag?'in float a_wave;uniform float u_time;':''}out vec2 v_uv;void main(){v_uv=a_uv;vec3 p=a_pos;${flag?'p.y+=.3*a_wave*sin(u_time*2.2+a_wave*6.0);p.z+=.08*a_wave*sin(u_time*1.6+a_wave*4.0);':''}gl_Position=u_matrix*vec4(p,1.0);}`),fs=shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;in vec2 v_uv;uniform sampler2D u_signs;out vec4 fragColor;void main(){fragColor=texture(u_signs,v_uv);if(fragColor.a<0.4)discard;fragColor.a=1.0;}');this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('Facade lettering shader');this.vao=gl.createVertexArray();this.buffer=gl.createBuffer();gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);for(const [name,size,offset] of [['a_pos',3,0],['a_uv',2,12]]){const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,stride*4,offset);}if(flag){const loc=gl.getAttribLocation(this.program,'a_wave');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,1,gl.FLOAT,false,24,20);this.time=gl.getUniformLocation(this.program,'u_time');}this.uniform=gl.getUniformLocation(this.program,'u_matrix');this.sampler=gl.getUniformLocation(this.program,'u_signs');this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);canvas.width=canvas.height=1;note(roof?'roof-lettering-ready':'signs-ready');
 }catch(error){this.disabled=true;note(roof?'roof-lettering-error':'signs-error',error);}finally{for(const s of this.shaders)gl.deleteShader(s);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,flip);gl.bindTexture(gl.TEXTURE_2D,texture);gl.activeTexture(active);}},render(gl,{defaultProjectionData}){if(this.disabled||gl.isContextLost?.()||(this.map?.getZoom?.()??18)<14)return;const vao=gl.getParameter(gl.VERTEX_ARRAY_BINDING),program=gl.getParameter(gl.CURRENT_PROGRAM),active=gl.getParameter(gl.ACTIVE_TEXTURE),cull=gl.isEnabled(gl.CULL_FACE);gl.activeTexture(gl.TEXTURE0);const texture=gl.getParameter(gl.TEXTURE_BINDING_2D);try{gl.disable(gl.CULL_FACE);gl.useProgram(this.program);gl.bindVertexArray(this.vao);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(this.sampler,0);gl.uniformMatrix4fv(this.uniform,false,modelMatrix(defaultProjectionData.mainMatrix,this.origin,this.scale));if(flag)gl.uniform1f?.(this.time,Date.now()/1000%1000);gl.drawArrays(gl.TRIANGLES,0,data.length/stride);if(flag&&this.map?.triggerRepaint&&!this.paintTimer&&!this.map.getContainer?.()?.hidden)this.paintTimer=setTimeout(()=>{this.paintTimer=null;this.map.triggerRepaint();},70);}catch(error){this.disabled=true;note(roof?'roof-lettering-error':'signs-error',error);}finally{gl.bindVertexArray(vao);gl.useProgram(program);gl.bindTexture(gl.TEXTURE_2D,texture);gl.activeTexture(active);if(cull)gl.enable(gl.CULL_FACE);}},onRemove(map,gl){if(this.paintTimer)clearTimeout(this.paintTimer);if(this.texture)gl.deleteTexture(this.texture);if(this.buffer)gl.deleteBuffer(this.buffer);if(this.vao)gl.deleteVertexArray(this.vao);if(this.program)gl.deleteProgram(this.program);}};
}

function flagLayer(lib,scene,onDiagnostic){return signLayer(lib,{facadeSigns:scene.roofFlags||[]},onDiagnostic,false,true);}
function roofLayer(lib,scene,onDiagnostic){return signLayer(lib,scene,onDiagnostic,true);}
root.DisneyModels={build,modelMatrix,layer,signLayer,roofLayer,flagLayer,mark,markLines,ORIGIN};if(typeof module!=='undefined')module.exports=root.DisneyModels;
})(typeof globalThis!=='undefined'?globalThis:this);
