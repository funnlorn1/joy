const canvas=document.querySelector("#arena"),ctx=canvas.getContext("2d");
const $=id=>document.getElementById(id);
const W=180,H=120,COUNT=10,PALETTE=["#8df05a","#ff5578","#48c8ff","#bd83ff","#ffbd4a","#39e6c4","#ff7b35","#f05bdb","#a4c8ff","#d8ee4d","#ff8baf"];
const NAMES=["ТЫ","VEX","NOVA","PIXEL","KAI","ZED","MIRA","BOLT","ECHO","LUX","RUSH"];
const DIRS=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
const COUNTRIES=[
 {name:"СЕВЕРИЯ",x:30,y:22,rx:13,ry:9},{name:"ЭСТРАЛИЯ",x:78,y:19,rx:15,ry:10},
 {name:"ВЕСТМАРК",x:130,y:24,rx:14,ry:11},{name:"ЛЮМЕН",x:42,y:65,rx:15,ry:12},
 {name:"АРКАДИЯ",x:91,y:57,rx:16,ry:12},{name:"МИДГАРД",x:145,y:68,rx:14,ry:12},
 {name:"СОЛАРИС",x:24,y:101,rx:12,ry:8},{name:"НОВАРА",x:81,y:100,rx:16,ry:9},
 {name:"КРИСТАЛ",x:137,y:104,rx:14,ry:8}
];
let grid,countries,player,bots,running=false,paused=false,ended=false,desired={x:1,y:0};
let cellW=10,cellH=10,dpr=1,lastStep=0,stepMs=92,best=Number(localStorage.getItem("territoryRushBest")||0);
let camera={x:0,y:0},worldCanvas=null;
function key(x,y){return y*W+x}function inside(x,y){return x>=0&&y>=0&&x<W&&y<H}function own(x,y){return inside(x,y)?grid[key(x,y)]:-1}
function createCountries(){
 countries=COUNTRIES.map((c,index)=>{const cells=[];for(let y=Math.max(0,c.y-c.ry-2);y<Math.min(H,c.y+c.ry+3);y++)for(let x=Math.max(0,c.x-c.rx-2);x<Math.min(W,c.x+c.rx+3);x++){
 const dx=(x-c.x)/c.rx,dy=(y-c.y)/c.ry;
 // organic country silhouettes with a slightly uneven coastline
 const wobble=1+.10*Math.sin(x*.73+index)*Math.cos(y*.61-index);
 if(dx*dx+dy*dy<wobble)cells.push(key(x,y));
 }return {...c,cells,done:false}});
}
function base(x,y,id,r=3){for(let yy=y-r;yy<=y+r;yy++)for(let xx=x-r;xx<=x+r;xx++)if(inside(xx,yy))grid[key(xx,yy)]=id}
function startGame(){
 grid=new Int8Array(W*H).fill(-1);createCountries();
 player={x:14,y:59,dx:1,dy:0,trail:[],alive:true};
 base(player.x,player.y,0,3);
 bots=[];
 const spots=[[165,12],[165,57],[165,108],[92,8],[90,113],[8,10],[8,110],[48,42],[126,43],[125,91]];
 spots.forEach(([x,y],i)=>{base(x,y,i+1,3);bots.push({x,y,dx:i%2?0:1,dy:i%2?1:0,trail:[],alive:true,turn:0,seed:Math.random()*100})});
 desired={x:1,y:0};camera={x:0,y:0};running=true;paused=false;ended=false;
 $("overlay").classList.add("hidden");$("pauseBtn").textContent="Ⅱ ПАУЗА";updateUI();
}
function area(id){let n=0;for(const v of grid)if(v===id)n++;return n}
function pct(id){return area(id)/(W*H)*100}
function capture(id,path){
 // Drawn trail closes the loop and becomes a wall before the flood-fill.
 for(const [x,y] of path)if(inside(x,y))grid[key(x,y)]=id;
 const seen=new Uint8Array(grid.length),queue=new Int32Array(grid.length);let head=0,tail=0;
 const add=(x,y)=>{if(inside(x,y)){const k=key(x,y);if(grid[k]===-1&&!seen[k]){seen[k]=1;queue[tail++]=k}}};
 for(let x=0;x<W;x++){add(x,0);add(x,H-1)}for(let y=0;y<H;y++){add(0,y);add(W-1,y)}
 while(head<tail){const k=queue[head++],x=k%W,y=(k/W)|0;add(x+1,y);add(x-1,y);add(x,y+1);add(x,y-1)}
 let gain=0;for(let i=0;i<grid.length;i++)if(grid[i]===-1&&!seen[i]){grid[i]=id;gain++}
 if(id===0)checkCountries();
 return gain;
}
function checkCountries(){
 for(const c of countries){if(!c.done&&c.cells.every(k=>grid[k]===0)){c.done=true;}}
}
function updateUI(){
 const p=pct(0),sorted=Array.from({length:COUNT+1},(_,i)=>({i,p:pct(i)})).sort((a,b)=>b.p-a.p);
 $("areaStat").textContent=p.toFixed(1)+"%";$("bestStat").textContent=best.toFixed(1)+"%";
 $("rankStat").textContent=(sorted.findIndex(v=>v.i===0)+1)+" / "+(COUNT+1);
 $("goalProgress").style.width=Math.min(100,p/20*100)+"%";$("goalLabel").textContent=p.toFixed(1)+"% территории карты";
 $("leaderboard").innerHTML=sorted.map((v,n)=>`<div class="leader-row ${v.i===0?"me":""}"><span class="rank">${String(n+1).padStart(2,"0")}</span><span class="name"><i class="swatch" style="background:${PALETTE[v.i]};color:${PALETTE[v.i]}"></i>${NAMES[v.i]}</span><b>${v.p.toFixed(1)}%</b></div>`).join("");
 $("countryList").innerHTML=countries.map(c=>{const done=c.done||c.cells.every(k=>grid[k]===0),owned=c.cells.filter(k=>grid[k]===0).length,progress=owned/c.cells.length*100;return `<div class="country-row ${done?"done":""}"><span>${c.name} ${done?"✓":""}</span><b>${Math.round(progress)}%</b><div class="country-track"><i style="width:${progress}%"></i></div></div>`}).join("");
}
function overlay(title,text,button){$("overlayTitle").innerHTML=title;$("overlayText").textContent=text;$("startBtn").textContent=button;$("overlay").classList.remove("hidden")}
function lose(){if(!running)return;running=false;ended=true;const p=pct(0);showEnd("ТВОЙ СЛЕД<br><em>ПЕРЕРЕЗАН</em>",`Ты занял ${p.toFixed(1)}% карты. Попробуй ещё раз.`)}
function showEnd(t,m){overlay(t,m,"ИГРАТЬ СНОВА")}
function setTurn(ent,d){if(d.x===-ent.dx&&d.y===-ent.dy)return;ent.dx=d.x;ent.dy=d.y}
function move(ent,id){
 if(!ent.alive)return;const nx=ent.x+ent.dx,ny=ent.y+ent.dy;
 if(!inside(nx,ny)){if(id===0){lose();return}else{const opts=DIRS.filter(d=>!(d.x===-ent.dx&&d.y===-ent.dy));setTurn(ent,opts[Math.floor(Math.random()*opts.length)]);return}}
 const tile=own(nx,ny);
 if(tile===id){if(ent.trail.length){capture(id,ent.trail);ent.trail=[];if(id===0){best=Math.max(best,pct(0));localStorage.setItem("territoryRushBest",best.toFixed(1))}}}
 else{if(ent.trail.some(([x,y])=>x===nx&&y===ny)){if(id===0)lose();else ent.trail=[];return}ent.trail.push([nx,ny]);if(ent.trail.length>150){if(id===0)lose();else ent.trail=[];return}}
 ent.x=nx;ent.y=ny;
 // A player or bot can cut any opponent's exposed tail.
 if(id!==0){if(player.trail.some(([x,y])=>x===nx&&y===ny))lose()}
 else{for(let i=0;i<bots.length;i++){const b=bots[i];if(b.alive&&(b.x===nx&&b.y===ny)&&player.trail.length){lose();return}}}
}
function botAI(b,id){
 b.turn++;
 const opts=DIRS.filter(d=>!(d.x===-b.dx&&d.y===-b.dy)&&inside(b.x+d.x,b.y+d.y));
 if(!opts.length)return;
 let chosen=opts[0],scoreBest=Infinity;
 for(const d of opts){const x=b.x+d.x,y=b.y+d.y,insideOwn=own(x,y)===id;let score=Math.random()*4;
 if(b.trail.length>8){score+=insideOwn?-100:Math.abs(x-b.homeX)+Math.abs(y-b.homeY)}
 else score+=insideOwn?3:0;
 if(x<2||y<2||x>W-3||y>H-3)score+=12;
 // Keep bots away from other active trails when possible.
 if(player.trail.some(([tx,ty])=>tx===x&&ty===y))score-=25;
 if(score<scoreBest){scoreBest=score;chosen=d}}
 setTurn(b,chosen);
}
function updateCamera(){
 camera.x=Math.max(0,Math.min(W-1- canvas.width/cellW,player.x-canvas.width/cellW/2));
 camera.y=Math.max(0,Math.min(H-1-canvas.height/cellH,player.y-canvas.height/cellH/2));
}
function resize(){const r=canvas.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(r.width*dpr);canvas.height=Math.floor(r.height*dpr);cellW=canvas.width/Math.min(W,canvas.width/(9*dpr));cellH=cellW;updateCamera()}
function draw(){
 const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle="#111a2c";ctx.fillRect(0,0,w,h);
 const cols=Math.ceil(w/cellW)+2,rows=Math.ceil(h/cellH)+2,sx=Math.floor(camera.x),sy=Math.floor(camera.y),ox=-(camera.x-sx)*cellW,oy=-(camera.y-sy)*cellH;
 // Country silhouettes and names, drawn under claimed cells.
 ctx.save();ctx.globalAlpha=.12;ctx.fillStyle="#c4d2e8";
 for(const c of countries){const cx=(c.x-camera.x)*cellW,cy=(c.y-camera.y)*cellH;ctx.beginPath();ctx.ellipse(cx,cy,c.rx*cellW,c.ry*cellH,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.55;ctx.font=`bold ${Math.max(8,10*dpr)}px Inter`;ctx.textAlign="center";ctx.fillStyle="#dce8ff";ctx.fillText(c.name,cx,cy);ctx.globalAlpha=.12;ctx.fillStyle="#c4d2e8"}
 ctx.restore();
 for(let syi=0;syi<rows;syi++)for(let sxi=0;sxi<cols;sxi++){const x=sx+sxi,y=sy+syi;if(!inside(x,y))continue;const v=grid[key(x,y)];if(v>=0){const px=ox+sxi*cellW,py=oy+syi*cellH;ctx.globalAlpha=.31;ctx.fillStyle=PALETTE[v];ctx.fillRect(px,py,cellW+.4,cellH+.4);ctx.globalAlpha=.16;ctx.fillRect(px+1,py+1,cellW-2,cellH-2);ctx.globalAlpha=1}}
 ctx.strokeStyle="#b7d0ff12";ctx.lineWidth=1*dpr;for(let x=0;x<=cols;x++){ctx.beginPath();ctx.moveTo(ox+x*cellW,0);ctx.lineTo(ox+x*cellW,h);ctx.stroke()}for(let y=0;y<=rows;y++){ctx.beginPath();ctx.moveTo(0,oy+y*cellH);ctx.lineTo(w,oy+y*cellH);ctx.stroke()}
 const trailDraw=(points,id,e)=>{if(!points.length)return;ctx.save();ctx.strokeStyle=PALETTE[id];ctx.lineWidth=Math.max(3*dpr,cellW*.4);ctx.lineCap="round";ctx.lineJoin="round";ctx.shadowColor=PALETTE[id];ctx.shadowBlur=12*dpr;ctx.beginPath();ctx.moveTo((e.x-camera.x+.5)*cellW,(e.y-camera.y+.5)*cellH);for(const [x,y] of points)ctx.lineTo((x-camera.x+.5)*cellW,(y-camera.y+.5)*cellH);ctx.stroke();ctx.restore()};
 trailDraw(player.trail,0,player);bots.forEach((b,i)=>{if(b.alive)trailDraw(b.trail,i+1,b)});
 const drawPawn=(e,id)=>{const x=(e.x-camera.x+.5)*cellW,y=(e.y-camera.y+.5)*cellH,r=cellW*.36;ctx.save();ctx.shadowColor=PALETTE[id];ctx.shadowBlur=15*dpr;ctx.fillStyle=PALETTE[id];ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle="#152033";ctx.beginPath();ctx.arc(x-r*.28,y-r*.1,Math.max(1,dpr),0,Math.PI*2);ctx.arc(x+r*.28,y-r*.1,Math.max(1,dpr),0,Math.PI*2);ctx.fill();ctx.restore()};
 drawPawn(player,0);bots.forEach((b,i)=>{if(b.alive)drawPawn(b,i+1)});
}
function tick(now){if(running&&!paused&&now-lastStep>=stepMs){lastStep=now;setTurn(player,desired);move(player,0);bots.forEach((b,i)=>{if(b.alive){if(Math.random()<.22||b.turn%6===0)botAI(b,i+1);move(b,i+1)}});updateCamera();updateUI();if(pct(0)>=20){running=false;showEnd("ТЫ<br><em>ЗАХВАТИЛ КАРТУ!</em>","Ты контролируешь 20% всего мира. Отличная работа!")}}
 draw();requestAnimationFrame(tick)}
function pause(){if(!running)return;paused=!paused;$("pauseBtn").textContent=paused?"▶ ПРОДОЛЖИТЬ":"Ⅱ ПАУЗА";if(paused)overlay("ПАУЗА","Твой прогресс сохранён.","ПРОДОЛЖИТЬ");else $("overlay").classList.add("hidden")}
function setDir(name){const d={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}[name];if(d)desired=d}
document.addEventListener("keydown",e=>{const m={ArrowUp:"up",w:"up",W:"up",ArrowDown:"down",s:"down",S:"down",ArrowLeft:"left",a:"left",A:"left",ArrowRight:"right",d:"right",D:"right"};if(m[e.key]){e.preventDefault();setDir(m[e.key])}if(e.code==="Space"){e.preventDefault();pause()}});
document.querySelectorAll("[data-dir]").forEach(b=>{const f=e=>{e.preventDefault();setDir(b.dataset.dir)};b.addEventListener("pointerdown",f)});
$("startBtn").onclick=()=>{if(paused){paused=false;$("pauseBtn").textContent="Ⅱ ПАУЗА";$("overlay").classList.add("hidden")}else startGame()};
$("pauseBtn").onclick=pause;$("restartBtn").onclick=startGame;
$("soundBtn").onclick=()=>{$("soundBtn").textContent=$("soundBtn").textContent==="♫"?"♪":"♫"};
window.addEventListener("resize",resize);
resize();startGame();running=false;overlay("ЗАХВАТИ<br><em>КАРТУ</em>","Большой 2D-мир, 10 ботов и девять стран. Захватывай территории, чтобы заполнить каждую страну целиком.","НАЧАТЬ ИГРУ");requestAnimationFrame(tick);
