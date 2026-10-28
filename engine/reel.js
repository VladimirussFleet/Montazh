/* Шаблон рилса 1080×1920 — общий движок.
   Его используют render.py (через engine/reel.html) и страница «Монтажный стол» (примерочная стиля и живой черновик),
   поэтому то, что человек видит на странице, совпадает с готовым роликом.
   const E = ReelEngine(canvas, {fonts: "local" | "css", asset: path => url, meImage: async t => Image, recImage: async (name, recSeconds) => Image|Video});
   await E.init({tl, brand, frames, dir}); await E.frame(t); E.warnings()
   Всё, что меняется от ролика к ролику, лежит в work/<ролик>/tl.json, а стиль — в brand/brand.json. */
(function(root){
function ReelEngine(canvas,opts){

const W=1080,H=1920;let g=canvas.getContext("2d");
const OPT=Object.assign({fonts:"local",asset:null,meImage:null,recImage:null},opts||{});
const cl=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),lerp=(a,b,t)=>a+(b-a)*t;
const eOut3=t=>1-Math.pow(1-cl(t),3),eIO=t=>{t=cl(t);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2},
      eBack=t=>{t=cl(t);const a=1.7,c=a+1;return 1+c*Math.pow(t-1,3)+a*Math.pow(t-1,2)};
function rr(c,x,y,w,h,r){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
const pad4=i=>String(i).padStart(4,"0");
function pw(m,t){if(t<=m[0][0])return m[0][1];for(let i=1;i<m.length;i++)if(t<=m[i][0]){const a=m[i-1],b=m[i];return lerp(a[1],b[1],(t-a[0])/Math.max(1e-6,b[0]-a[0]))}return m[m.length-1][1]}
const WARN=new Set();function warn(s){if(!WARN.has(s)){WARN.add(s);console.log("WARN "+s)}}

// ---------- brand defaults (brand/brand.json overrides any of these) ----------
const DEF={
  fonts:{head:"montserrat",body:"manrope"},
  colors:{accent:"#FFCF4D",caption:"#FFFFFF",plate:"#FFFFFF",plate_text:"#111111",card:"#FFFFFF",card_text:"#141414",
          card_accent:"#C98A00",ui:"#D9B25B",panel_bg:"#0C0C0E",panel_glow:"#C9A24B",panel_frame:"#FCFCFC"},
  captions:{mode:"phrase",case:"as_is",style:"shadow",size:94,y:1530,split_y:null,max_width:940},
  hook:{style:"plate",y:280,size:82},
  cards:{top:1100},
  safe_top:140,face_y:740,
  split:{shift:270,dots:true},
  labels:{result:"РЕЗУЛЬТАТ",comment:"твой комментарий",follow:"Подписаться",followed:"Вы подписаны"}
};
function merge(a,b){if(b===undefined||b===null)return a;if(typeof a!=="object"||Array.isArray(a))return b;const o={...a};for(const k in b)o[k]=merge(a[k],b[k]);return o}

// ---------- fonts: any @fontsource family from package.json, latin + cyrillic ----------
const LAT="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const CYR="U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116";
async function loadFace(alias,pkg,w){
  for(const ww of [w,w-100,w+100,w-200,800,700,600,400]){
    try{const fs=[];for(const[sub,rng]of[["latin",LAT],["cyrillic",CYR]]){
        const f=new FontFace(alias,`url(/node_modules/@fontsource/${pkg}/files/${pkg}-${sub}-${ww}-normal.woff2)`,{weight:String(w),unicodeRange:rng});await f.load();fs.push(f)}
      fs.forEach(f=>document.fonts.add(f));if(ww!==w)warn(`font ${pkg} ${w} -> ${ww}`);return}catch(e){}}
  warn(`font ${pkg} ${w} missing`)}
const EMO='"Noto Color Emoji"';
// family name, display weight, size factor (script fonts look smaller at the same px size)
const FONT_META={montserrat:["Montserrat",900,1],unbounded:["Unbounded",900,0.94],onest:["Onest",900,1],"golos-text":["Golos Text",900,1],rubik:["Rubik",900,1],
  manrope:["Manrope",800,1],inter:["Inter",900,1],"playfair-display":["Playfair Display",900,1],"jetbrains-mono":["JetBrains Mono",800,0.95],
  nunito:["Nunito",900,1],comfortaa:["Comfortaa",700,0.98],oswald:["Oswald",700,1.12],"dela-gothic-one":["Dela Gothic One",400,0.92],"russo-one":["Russo One",400,1],
  caveat:["Caveat",700,1.25],"shantell-sans":["Shantell Sans",800,1],pangolin:["Pangolin",400,1.05],neucha:["Neucha",400,1.15],"playpen-sans":["Playpen Sans",800,0.98],"amatic-sc":["Amatic SC",700,1.35],
  pacifico:["Pacifico",400,0.92],lobster:["Lobster",400,1.05],"marck-script":["Marck Script",400,1.25],"bad-script":["Bad Script",400,1.12],"great-vibes":["Great Vibes",400,1.4],"comforter-brush":["Comforter Brush",400,1.45],
  "yeseva-one":["Yeseva One",400,1],prata:["Prata",400,0.98],"cormorant-garamond":["Cormorant Garamond",700,1.12],kurale:["Kurale",400,1.05]};
const FAMILY=Object.fromEntries(Object.entries(FONT_META).map(([k,v])=>[k,v[0]]));
const fm=pkg=>FONT_META[pkg]||FONT_META.montserrat;
let HFN="HF",BFN="BF",CFN="CF",KFN="KF",NFN="NF",HW=900,HK=1,CWT=900,CK=1,KW=900,KK=1,NW=700,NK=1.25;
// hook: head font; cards and numbers: cards font; subtitles: captions font (both default to head)
const fH=(w,s)=>`${HW} ${Math.round(s*HK)}px ${HFN}, ${BFN}, ${EMO}`, fB=(w,s)=>`${w} ${s}px ${BFN}, ${EMO}`,
      fC=(w,s)=>`${CWT} ${Math.round(s*CK)}px ${CFN}, ${BFN}, ${EMO}`, fK=(w,s)=>`${KW} ${Math.round(s*KK)}px ${KFN}, ${BFN}, ${EMO}`, fN=s=>`${NW} ${Math.round(s*NK)}px ${NFN}, ${BFN}, ${EMO}`;
async function loadFonts(){
  const head=B.fonts.head,cap=B.fonts.captions||head,crd=B.fonts.cards||head,body=B.fonts.body,nts=B.fonts.notes||"caveat";[,HW,HK]=fm(head);[,CWT,CK]=fm(cap);[,KW,KK]=fm(crd);[,NW,NK]=fm(nts);
  if(OPT.fonts==="css"){HFN=`"${fm(head)[0]}"`;CFN=`"${fm(cap)[0]}"`;KFN=`"${fm(crd)[0]}"`;BFN=`"${fm(body)[0]}"`;NFN=`"${fm(nts)[0]}"`;
    for(const f of[`${HW} 40px ${HFN}`,`${CWT} 40px ${CFN}`,`${KW} 40px ${KFN}`,`${NW} 40px ${NFN}`,`800 40px ${BFN}`,`700 40px ${BFN}`,`600 40px ${BFN}`])try{await document.fonts.load(f,"АБВabc")}catch(e){}return}
  HFN="HF";CFN="CF";KFN="KF";BFN="BF";NFN="NF";
  await loadFace("HF",head,HW);await loadFace("CF",cap,CWT);await loadFace("KF",crd,KW);await loadFace("NF",nts,NW);for(const w of[800,700,600])await loadFace("BF",body,w);await document.fonts.ready}

let TL,B,FR,DIR,PC,p,BGC,SCV,OFF,PH,CX,CY,CW,CH,SHIFT,FY;
const cache=new Map();
async function img(src){if(cache.has(src))return cache.get(src);const a=new Image();a.src=src;try{await a.decode()}catch(e){warn("image "+src);return null}
  cache.set(src,a);if(cache.size>40){for(const k of cache.keys()){if(!k.includes("/img/")&&!k.includes("/src/")){cache.delete(k);break}}}return a}
const U=s=>OPT.asset?OPT.asset(s):`/${DIR}/${s}`;
// case for subtitles/cards; words with Latin letters (ChatGPT, iPhone) keep their own spelling
function cs(txt){const c=B.captions.case;if(c!=="upper"&&c!=="lower")return txt;
  return String(txt).split(" ").map(w=>/[A-Za-z]/.test(w)?w:(c==="upper"?w.toUpperCase():w.toLowerCase())).join(" ")}
function fit(c,font,txts,maxw,size,minFrac=0.6,tag="text"){let s=size;c.font=font(s);let w=Math.max(...txts.map(x=>c.measureText(x).width));
  if(w>maxw){s=Math.floor(s*maxw/w);c.font=font(s);if(s<size*minFrac)warn(`${tag} is long, shrunk to ${s}px: ${txts.join(" / ")}`)}return s}
function wrap(c,txt,maxw){const out=[];for(const para of String(txt).split("\n")){let line="";for(const w of para.split(" ")){const s=line?line+" "+w:w;if(c.measureText(s).width>maxw&&line){out.push(line);line=w}else line=s}out.push(line)}return out}
// "*слово*" in card text = accent colour
function richLine(c,line,x,y,base,acc,align="center"){const parts=line.split(/(\*[^*]+\*)/).filter(Boolean).map(s=>s.startsWith("*")?[s.slice(1,-1),acc]:[s,base]);
  const w=parts.reduce((a,[s])=>a+c.measureText(s).width,0);let cx=align==="center"?x-w/2:x;c.textAlign="left";
  for(const[s,col]of parts){c.fillStyle=col;c.fillText(s,cx,y);cx+=c.measureText(s).width}return w}
const plain=s=>String(s).replace(/\*/g,"");

// text block layout: classic spacing for normal fonts, grows for script fonts with tall swashes
function block(lines,fs,first,step,tail){let asc=0,desc=0;for(const l of lines){const m=g.measureText(plain(l).replace(/\p{Extended_Pictographic}/gu,""));asc=Math.max(asc,m.actualBoundingBoxAscent||0);desc=Math.max(desc,m.actualBoundingBoxDescent||0)}
  const F=fs*HK;if(asc<=F*1.0&&desc<=F*0.28)return{y0:F*first,lh:F*step,h:F*first+(lines.length-1)*F*step+F*tail};   // ordinary font: classic spacing
  const y0=Math.max(F*first,asc+F*0.04),lh=Math.max(F*step,asc+desc+F*0.1),bot=Math.max(F*tail,desc+F*0.04);return{y0,lh,h:y0+(lines.length-1)*lh+bot}}
const hx=h=>{h=String(h||"#000000").replace("#","");if(h.length===3)h=h.split("").map(c=>c+c).join("");return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)||0)};
const lum=h=>{const[r,gg,b]=hx(h).map(v=>v/255);return 0.2126*r+0.7152*gg+0.0722*b};
const darker=(h,k)=>"#"+hx(h).map(v=>Math.round(v*(1-k)).toString(16).padStart(2,"0")).join("");
// accent colour that stays readable on a light plate
const accOn=(bg,ac=B.colors.accent)=>lum(bg)>0.6&&lum(ac)>0.85?darker(ac,0.38):ac;
// ---------- time maps ----------
function meSrc(t){const P=TL.pieces||[];if(!P.length)return t;const L=P[P.length-1];
  if(t>=L.out1)return L.src1+(t-L.out1)*L.speed;for(const q of P)if(t<q.out1)return q.src0+Math.max(0,t-q.out0)*q.speed;return L.src1}
function meIdx(t){const fps=FR.me.fps||30;let n=FR.me.n;if(TL.src_max)n=Math.min(n,Math.round(TL.src_max*fps));return Math.min(n,Math.max(1,Math.round(meSrc(t)*fps)+1))}
function zoomAt(t){let z=1;for(const e of TL.zoom||[]){if(t>=e[0]&&t<e[1])z=e.length>=4?lerp(e[2],e[3],eIO((t-e[0])/(e[1]-e[0]))):e[2]}return z}
function splitK(t){let k=0;const D=0.42;for(const[a,b]of TL.split||[]){let v;
  if(t<a||t>b+D)v=0;else if(t>=b)v=1-eIO((t-b)/D);else if(a<0.05)v=1;else v=t<a+D?eIO((t-a)/D):1;k=Math.max(k,v)}return k}

// ---------- shared UI bits ----------
function tap(c,x,y,dt){if(dt<-0.15||dt>0.75)return;const a=dt<0?cl((dt+0.15)/0.15):1-cl((dt-0.35)/0.4);c.save();c.globalAlpha*=a;
  c.beginPath();c.arc(x,y,36*(dt>0&&dt<0.16?1-0.18*Math.sin(dt/0.16*Math.PI):1),0,7);c.fillStyle="rgba(110,110,118,0.45)";c.fill();
  if(dt>0){c.globalAlpha*=1-cl(dt/0.55);c.beginPath();c.arc(x,y,36+80*eOut3(dt/0.55),0,7);c.lineWidth=5;c.strokeStyle="rgba(110,110,118,0.7)";c.stroke()}c.restore()}
function check(c,x,y,s,col){c.save();c.strokeStyle=col;c.lineWidth=s*0.22;c.lineCap="round";c.lineJoin="round";c.beginPath();c.moveTo(x-s*0.45,y);c.lineTo(x-s*0.12,y+s*0.33);c.lineTo(x+s*0.48,y-s*0.35);c.stroke();c.restore()}
function bubbleHL(c,x,y,w,h,a,tag,dt){if(a<=0)return;c.save();c.globalAlpha*=a;const pd=12,ui=B.colors.ui;
  c.shadowColor=ui;c.shadowBlur=26;rr(c,x-pd,y-pd,w+2*pd,h+2*pd,Math.min(44,(h+2*pd)/2));c.lineWidth=7;c.strokeStyle=ui;
  const L=2*(w+h+4*pd);c.setLineDash([L*eOut3(dt/0.5),L*2]);c.stroke();c.setLineDash([]);c.shadowColor="transparent";
  if(tag){c.font=fB(800,27);const tw=c.measureText(tag).width;let tx=x-pd,ty=y-pd-58;if(ty<CY+8)ty=y+h+pd+12;tx=Math.min(tx,CX+CW-tw-48);const q=eBack((dt-0.1)/0.35);
    if(q>0){c.save();c.translate(tx,ty+22);c.scale(q,q);rr(c,0,-22,tw+40,46,23);c.fillStyle=ui;c.fill();c.fillStyle="#141414";c.textAlign="left";c.textBaseline="middle";c.fillText(tag,20,1);c.restore()}}
  c.restore()}

// ---------- split: top panel with screen recordings / images ----------
function shotsAt(t){const S=TL.shots||[],out=[];for(let i=0;i<S.length;i++){const s=S[i];if(t>=s.t[0]&&t<s.t[1]+0.15)out.push(i)}
  if(!out.length){let best=-1;for(let i=0;i<S.length;i++)if(S[i].t[0]<=t&&(best<0||S[i].t[1]>=S[best].t[1]))best=i;if(best<0&&S.length)best=0;if(best>=0)out.push(best)}return out}
function recInfo(name){const r=FR.rec&&FR.rec[name];if(!r)warn("no frames for recording "+name);return r||{n:1,w:1170,h:2532,fps:30}}
function cropAt(sh,r){return sh.crop&&sh.crop.length?pw(sh.crop,r):(sh._ri.h-CH*sh._ri.w/CW)/2}
async function loadShot(sh,t){if(sh.img)return await img(U(sh.img));const ri=sh._ri,r=pw(sh.m,Math.min(t,sh.t[1]));if(OPT.recImage)return await OPT.recImage(sh.rec,r);
  return await img(U(`rf/${sh.rec}/${pad4(Math.min(ri.n,Math.max(1,Math.round(r*(ri.fps||30))+1)))}.jpg`))}
function ffBadge(a){if(a<=0)return;p.save();p.globalAlpha=a;const x=CX+CW-150,y=CY+CH-84;rr(p,x,y,126,60,30);p.fillStyle="rgba(22,22,24,0.88)";p.fill();p.fillStyle=B.colors.ui;
  for(const ox of[0,24]){p.beginPath();p.moveTo(x+34+ox,y+16);p.lineTo(x+58+ox,y+30);p.lineTo(x+34+ox,y+44);p.closePath();p.fill()}p.restore()}
function badge(c,txt,x,y,a){if(a<=0||!txt)return;c.save();c.globalAlpha*=a;c.font=fB(800,27);const tw=c.measureText(txt).width;
  c.shadowColor="rgba(0,0,0,0.3)";c.shadowBlur=14;rr(c,x,y,tw+40,52,26);c.fillStyle=B.colors.ui;c.fill();c.shadowColor="transparent";c.fillStyle="#141414";c.textAlign="left";c.textBaseline="middle";c.fillText(txt,x+20,y+27);c.restore()}
function drawShot(sh,im,t,alpha){if(!im||alpha<=0)return;p.save();p.globalAlpha=alpha;
  if(sh.rec){const ri=sh._ri,RW=ri.w,SC=CW/RW,RH=CH/SC,r=pw(sh.m,Math.min(t,sh.t[1])),cy=cropAt(sh,r),kx=(im.videoWidth||im.naturalWidth||RW)/RW;
    const q=SCV.getContext("2d");q.setTransform(1,0,0,1,0,0);q.globalAlpha=1;q.filter="none";q.clearRect(0,0,CW,CH);q.drawImage(im,0,cy*kx,RW*kx,RH*kx,0,0,CW,CH);
    for(const b of sh.blur||[]){if(r<b[0]||r>b[1])continue;const x=b[2]*SC,y=Math.max(0,(b[3]-cy)*SC),y2=Math.min(CH,(b[3]+b[5]-cy)*SC);if(y2<=y)continue;
      q.save();q.beginPath();q.rect(x,y,b[4]*SC,y2-y);q.clip();q.fillStyle="#fff";q.fillRect(x,y,b[4]*SC,y2-y);q.filter="blur(11px)";q.drawImage(im,0,cy*kx,RW*kx,RH*kx,0,0,CW,CH);q.filter="none";q.fillStyle="rgba(250,250,250,0.18)";q.fillRect(x,y,b[4]*SC,y2-y);q.restore()}
    p.drawImage(SCV,CX,CY);
    for(const h of TL.hl||[]){if(h[2]!==sh.rec||h[0]<sh.t[0]-0.01||h[0]>sh.t[1]||t<h[0]-0.05||t>h[1]+0.35)continue;const[x,y,w,hh]=h[3];const a=cl((t-h[0])/0.2)*(1-cl((t-h[1])/0.3));
      bubbleHL(p,CX+x*SC,CY+(y-cy)*SC,w*SC,hh*SC,a,h[4],t-h[0])}
    for(const tp of TL.taps||[]){if(tp[1]!==sh.rec||tp[0]<sh.t[0]-0.01||tp[0]>sh.t[1])continue;tap(p,CX+tp[2]*SC,CY+(tp[3]-cy)*SC,t-tp[0])}
    if(sh.ff)ffBadge(cl((t-sh.t[0])/0.12)*(1-cl((t-sh.t[1]+0.1)/0.12)))}
  else{const d=t-sh.t[0],u=eIO((d-0.35)/Math.max(0.1,sh.t[1]-sh.t[0]-0.7)),h=im.height*CW/im.width,off=Math.max(0,h-CH)*u,s=lerp(1.06,1,eOut3(d/0.45));
    p.fillStyle="#fff";p.fillRect(CX,CY,CW,CH);p.save();p.translate(CX+CW/2,CY+CH/2);p.scale(s,s);p.translate(-(CX+CW/2),-(CY+CH/2));
    if(h>=CH)p.drawImage(im,CX,CY-off,CW,h);else{const w2=im.width*CH/im.height;if(w2>=CW)p.drawImage(im,CX-(w2-CW)/2,CY,w2,CH);else p.drawImage(im,CX,CY+(CH-h)/2,CW,h)}p.restore();
    const fl=Math.exp(-d*6)*0.7;if(fl>0.02){p.fillStyle=`rgba(255,250,235,${fl})`;p.fillRect(CX,CY,CW,CH)}
    badge(p,sh.label===undefined?B.labels.result:sh.label,CX+22,CY+22,cl((d-0.15)/0.25))}
  p.restore()}
function stepPill(t){const S=TL.steps||[];let i=-1;for(let k=0;k<S.length;k++)if(t>=S[k][0])i=k;if(i<0)return;
  const dt=t-S[i][0],a=cl(dt/0.3),ui=B.colors.ui;const one=(s,al,dy)=>{if(al<=0)return;p.save();p.globalAlpha=al;p.font=fB(800,28);p.letterSpacing="3px";const w1=p.measureText(s[1]).width;p.letterSpacing="0px";p.font=fB(700,34);const w2=p.measureText(s[2]||"").width;
    const w=w1+w2+(s[2]?108:88),x=540-w/2,y=78+OFF+dy;rr(p,x,y-34,w,68,34);p.fillStyle="rgba(255,255,255,0.08)";p.fill();p.lineWidth=2;p.strokeStyle=ui+"99";p.stroke();
    p.beginPath();p.arc(x+34,y,8,0,7);p.fillStyle=ui;p.fill();p.textBaseline="middle";p.textAlign="left";p.font=fB(800,28);p.letterSpacing="3px";p.fillStyle=ui;p.fillText(s[1],x+54,y+1);p.letterSpacing="0px";
    if(s[2]){p.font=fB(700,34);p.fillStyle="#F2EEE6";p.fillText(s[2],x+54+w1+20,y+1)}p.restore()};
  if(dt<0.3&&i>0)one(S[i-1],1-a,-a*14);one(S[i],a,(1-eOut3(a))*14)}
async function drawPanel(t){p.setTransform(1,0,0,1,0,0);p.globalAlpha=1;p.drawImage(BGC,0,0);stepPill(t);
  p.save();p.shadowColor="rgba(0,0,0,0.65)";p.shadowBlur=60;p.shadowOffsetY=20;rr(p,CX,CY,CW,CH,30);p.fillStyle=B.colors.panel_frame;p.fill();p.restore();
  p.save();rr(p,CX,CY,CW,CH,30);p.clip();
  for(const i of shotsAt(t)){const sh=TL.shots[i];let a=1;if(t<sh.t[0]+0.12&&i>0)a=cl((t-sh.t[0])/0.12);if(sh.scene){drawScene(sh,t,a);continue}const im=await loadShot(sh,t);drawShot(sh,im,t,a)}
  p.restore();rr(p,CX,CY,CW,CH,30);p.lineWidth=2;p.strokeStyle=B.colors.ui+"66";p.stroke()}

// ---------- cards (full-screen part) ----------
function cardState(t,c){const[t0,t1]=c.t;if(t<t0||t>t1+0.25)return null;return{a:cl((t-t0)/0.12)*(1-cl((t-t1)/0.25)),s:eBack((t-t0)/0.42)*(1-0.08*cl((t-t1)/0.25)),d:t-t0}}
function shadowCard(x,y,w,h,r,fill){g.save();g.shadowColor="rgba(0,0,0,0.38)";g.shadowBlur=46;g.shadowOffsetY=16;rr(g,x,y,w,h,r);g.fillStyle=fill||B.colors.card;g.fill();g.restore()}
const CARD={
  text(c,st){const lines=[].concat(c.title||"").flatMap(s=>String(s).split("\n"));const size=fit(g,s=>fK(900,s),lines.map(plain),820,c.size||88,0.6,"card");
    const sub=c.sub?String(c.sub):null;let sh=0,sl=[];if(sub){g.font=fB(700,38);sl=wrap(g,sub,820);sh=sl.length*48+18}
    g.font=fK(900,size);const lay=block(lines,size,0.92,1.1,0.18);
    const bh=lay.h+48+sh,bw=Math.max(...lines.map(l=>{g.font=fK(900,size);return g.measureText(plain(l)).width}),...sl.map(l=>{g.font=fB(700,38);return g.measureText(l).width}))+96;
    shadowCard(-bw/2,-bh/2,bw,bh,40);g.textBaseline="alphabetic";g.font=fK(900,size);
    lines.forEach((l,i)=>richLine(g,cs(l),0,-bh/2+24+lay.y0+i*lay.lh,B.colors.card_text,B.colors.card_accent));
    if(sub){g.font=fB(700,38);g.fillStyle="#7A7A7A";g.textAlign="center";const top=-bh/2+24+lay.h;sl.forEach((l,i)=>g.fillText(l,0,top+56+i*48))}},
  list(c,st,t){const items=c.items||[],w=c.w||820,rowH=82,head=c.title?118:30,h=head+items.length*rowH+30;g.save();g.translate(0,0);
    shadowCard(-w/2,-h/2,w,h,30);if(c.title){g.save();rr(g,-w/2,-h/2,w,h,30);g.clip();g.fillStyle="#141414";g.fillRect(-w/2,-h/2,w,100);g.restore();
      const ts=fit(g,s=>fK(900,s),[plain(c.title)],w-80,46,0.6,"list title");g.textAlign="left";g.textBaseline="middle";richLine(g,cs(c.title),-w/2+40,-h/2+52,"#FFFFFF",B.colors.ui,"left")}
    items.forEach((it,i)=>{const at=c.at?c.at[i]:c.t[0]+0.35+i*0.3,d=t-at,ry=-h/2+head+i*rowH+rowH/2;g.fillStyle="rgba(0,0,0,0.06)";rr(g,-w/2+30,ry-30,w-60,60,16);g.fill();if(d<0)return;
      g.save();g.globalAlpha*=cl(d/0.15);const ix=-w/2+66;g.beginPath();g.arc(ix,ry,22,0,7);g.fillStyle=c.icon==="num"?"#141414":B.colors.card_accent;g.fill();
      if(c.icon==="num"){g.fillStyle="#fff";g.font=fB(800,26);g.textAlign="center";g.textBaseline="middle";g.fillText(String(i+1),ix,ry+1)}else check(g,ix,ry+1,24,"#fff");
      g.font=fB(800,38);const s=fit(g,z=>fB(800,z),[plain(it)],w-160,38,0.55,"list item");g.textBaseline="middle";richLine(g,it,ix+44+(1-eOut3(d/0.3))*20,ry+2,B.colors.card_text,B.colors.card_accent,"left");g.restore()});g.restore()},
  image(c,st,t){const im=cache.get(U(c.file));if(!im)return;if(c.size==="full")return;const mw=c.w||820,mh=c.h||560;let w=mw,h=im.height*w/im.width;if(h>mh){h=mh;w=im.width*h/im.height}
    g.save();g.shadowColor="rgba(0,0,0,0.42)";g.shadowBlur=46;g.shadowOffsetY=16;rr(g,-w/2,-h/2,w,h,30);g.fillStyle="#fff";g.fill();g.restore();
    g.save();rr(g,-w/2,-h/2,w,h,30);g.clip();g.drawImage(im,-w/2,-h/2,w,h);const fl=Math.exp(-st.d*6)*0.6;if(fl>0.02){g.fillStyle=`rgba(255,250,235,${fl})`;g.fillRect(-w/2,-h/2,w,h)}g.restore();
    if(c.label)badge(g,c.label,-w/2+22,-h/2+22,cl((st.d-0.15)/0.25))},
  number(c,st,t){const m=String(c.value).match(/^(\D*)(\d+(?:[.,]\d+)?)(.*)$/);let txt=String(c.value);
    if(m){const v=parseFloat(m[2].replace(",",".")),f=c.from||0,u=eOut3(st.d/(c.count||0.8)),dec=(m[2].split(/[.,]/)[1]||"").length;txt=m[1]+(f+(v-f)*u).toFixed(dec).replace(".",m[2].includes(",")?",":".")+m[3]}
    const w=c.w||600,h=c.label?300:220;shadowCard(-w/2,-h/2,w,h,40);g.textAlign="center";g.textBaseline="middle";
    if(c.label){g.font=fB(800,28);g.letterSpacing="4px";g.fillStyle="#8A8A8F";g.fillText(cs(c.label),0,-h/2+64);g.letterSpacing="0px"}
    const s=fit(g,z=>fK(900,z),[txt],w-80,c.size||132,0.5,"number");g.fillStyle=c.color||B.colors.card_text;g.fillText(txt,0,c.label?34:8)},
  sticker(c,st){g.save();g.rotate((c.rot||-8)*Math.PI/180);g.font=`${c.size||220}px ${EMO}`;g.textAlign="center";g.textBaseline="middle";g.fillText(c.emoji||"🔥",0,0);g.restore()},
  cta(c,st,t){const word=c.word||(B.cta&&B.cta.word)||"СЛОВО",tw=c.type_at||c.t[0]+0.35,th=tw+0.2+word.length*0.055+0.3;
    shadowCard(-430,-75,860,150,40,"#fff");g.beginPath();g.arc(-350,0,48,0,7);g.fillStyle=B.colors.ui;g.fill();g.fillStyle="#141414";g.beginPath();g.arc(-350,-13,16,0,7);g.fill();g.beginPath();g.ellipse(-350,25,27,18,0,Math.PI,0);g.fill();
    g.textAlign="left";g.textBaseline="middle";g.font=fB(700,30);g.fillStyle="#7A7A7A";g.fillText(c.hint||B.labels.comment,-276,-30);
    const n=Math.max(0,Math.min(word.length,Math.floor((t-(tw-0.2))/0.055)));const ws=fit(g,z=>fK(900,z),[word],560,60,0.5,"cta word");g.fillStyle="#141414";const sw=word.slice(0,n);g.fillText(sw,-278,24);
    if(n<word.length||Math.floor(t*2.4)%2===0){const cw=g.measureText(sw).width;if(t<th+0.6||n<word.length){g.fillStyle=B.colors.ui;g.fillRect(-274+cw,-6,5,ws*0.95)}}
    const hp=eBack((t-th)/0.32);if(hp>0){g.save();g.translate(362,0);g.scale(hp*1.15,hp*1.15);g.fillStyle="#FF3B6B";g.beginPath();g.moveTo(0,22);g.bezierCurveTo(-46,-8,-30,-46,0,-22);g.bezierCurveTo(30,-46,46,-8,0,22);g.fill();g.restore()}},
  follow(c,st,t){const tt=c.tap||c.t[0]+0.45,on=t>=tt,m=eOut3((t-tt)/0.2),w=500,h=112;
    g.save();g.shadowColor="rgba(0,0,0,0.35)";g.shadowBlur=40;g.shadowOffsetY=14;rr(g,-w/2,-h/2,w,h,56);g.fillStyle=on?`rgb(${lerp(0,239,m)},${lerp(149,239,m)},${lerp(246,239,m)})`:"#0095F6";g.fill();g.restore();
    g.textAlign="center";g.textBaseline="middle";g.font=fB(800,44);g.fillStyle=on&&m>0.5?"#141414":"#fff";g.fillText(on&&m>0.5?B.labels.followed:B.labels.follow,0,2);tap(g,0,0,t-tt)}
};
// ---------- animation library: each part is {h(c): height, draw(c,st,t)} drawn around (0,0) ----------
// Same parts work as a card over the person and inside a motion panel of the split (shots with "scene").
// Item times ("at", "tap", "*_at" like "show_at") are reel seconds here; plan.json keeps source seconds and timeline.py converts them.
const ap=(t,t0,d=0.35)=>cl((t-t0)/d);
const typed=(s,t,t0,cps=26)=>String(s).slice(0,Math.floor(cl((t-t0)*cps,0,String(s).length)));
function caret(c,x,y,h,t){if(Math.floor(t*2.2)%2===0){c.fillStyle=B.colors.ui;c.fillRect(x+3,y-h*0.8,4,h)}}
function pill(c,x,y,txt,o={}){const sz=o.size||28,h=o.h||Math.round(sz*1.9);c.font=fB(800,sz);const tw=c.measureText(txt).width,w=tw+(o.pad||22)*2+(o.dot?24:0);
  const x0=o.al==="center"?x-w/2:o.al==="right"?x-w:x;rr(c,x0,y-h/2,w,h,h/2);c.fillStyle=o.bg||B.colors.ui;c.fill();if(o.bd){c.lineWidth=2.5;c.strokeStyle=o.bd;c.stroke()}
  if(o.dot){c.beginPath();c.arc(x0+(o.pad||22)+7,y,7,0,7);c.fillStyle=o.dot;c.fill()}c.fillStyle=o.fg||"#141414";c.textAlign="left";c.textBaseline="middle";c.fillText(txt,x0+(o.pad||22)+(o.dot?24:0),y+1);return w}
function popIn(c,t,t0,cx,cy,fn,d=0.4){const k=ap(t,t0,d);if(k<=0)return;c.save();c.globalAlpha*=cl(k*2);const s=lerp(0.6,1,eBack(k));c.translate(cx,cy);c.scale(s,s);c.translate(-cx,-cy);fn();c.restore()}
function slideIn(c,t,t0,dx,dy,fn,d=0.4){const k=ap(t,t0,d);if(k<=0)return;c.save();c.globalAlpha*=cl(k*1.6);const e=eOut3(k);c.translate((1-e)*dx,(1-e)*dy);fn();c.restore()}
const atOf=(c,i,step=0.35)=>c.at&&c.at[i]!=null?c.at[i]:c.t[0]+0.3+i*step;
const fmtN=v=>Math.round(v).toLocaleString("ru-RU").replace(/ /g," ");
const RED="#E5484D",GREEN="#2E9E5B",MUT="#8A8578",SOFT="#F2EEE6";
function headBar(c,w,h,title){if(!title)return 0;c.save();rr(c,-w/2,-h/2,w,h,30);c.clip();c.fillStyle="#141414";c.fillRect(-w/2,-h/2,w,96);c.restore();
  fit(c,s=>fK(900,s),[plain(title)],w-80,44,0.6,"title");c.textAlign="left";c.textBaseline="middle";richLine(c,cs(title),-w/2+40,-h/2+50,"#FFFFFF",B.colors.ui,"left");return 112}
function imgOf(f){return f?cache.get(U(f)):null}
function cover(c,im,x,y,w,h){if(!im)return;const s=Math.max(w/im.width,h/im.height),iw=im.width*s,ih=im.height*s;c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.drawImage(im,x+(w-iw)/2,y+(h-ih)/2,iw,ih);c.restore()}
function textH(font,txt,maxw,lh){g.font=font;return wrap(g,txt,maxw).length*lh}

const PART={
  chat:{h(c){const w=c.w||860;g.font=fB(700,36);const q=wrap(g,c.q||"",w*0.62).length,a=c.a?wrap(g,c.a,w*0.7).length:0;return 36+(q*46+70)+(a?24+a*46+70:0)+36},
    draw(c,st,t){const w=c.w||860,h=PART.chat.h(c);shadowCard(-w/2,-h/2,w,h,36);g.font=fB(700,36);
      const ql=wrap(g,c.q||"",w*0.62),bw=Math.max(...ql.map(l=>g.measureText(l).width))+60,qh=ql.length*46+70,x1=w/2-36,y0=-h/2+36,t0=atOf(c,0),full=ql.join(" ");
      slideIn(g,t,t0-0.15,30,0,()=>{rr(g,x1-bw,y0,bw,qh,30);g.fillStyle="#141414";g.fill();g.font=fB(700,24);g.fillStyle="#9A958A";g.textAlign="left";g.textBaseline="alphabetic";g.fillText(c.who_q||"Ты",x1-bw+30,y0+38);
        g.font=fB(700,36);g.fillStyle="#fff";let n=typed(full,t,t0,c.cps||30).length;ql.forEach((l,i)=>{const s=l.slice(0,Math.max(0,n));n-=l.length+1;g.fillText(s,x1-bw+30,y0+84+i*46);if(n<0&&n>-l.length-2&&t<t0+full.length/(c.cps||30)+0.6)caret(g,x1-bw+30+g.measureText(s).width,y0+84+i*46,36,t)})});
      if(!c.a)return;const t1=atOf(c,1),al=wrap(g,c.a,w*0.7),aw=Math.max(...al.map(l=>g.measureText(l).width))+60,ah=al.length*46+70,ay=y0+qh+24,x0=-w/2+36;
      slideIn(g,t,t1,-30,0,()=>{rr(g,x0,ay,aw,ah,30);g.fillStyle=SOFT;g.fill();g.font=fB(700,24);g.fillStyle=B.colors.card_accent;g.textAlign="left";g.textBaseline="alphabetic";g.fillText(c.who_a||"Claude",x0+30,ay+38);
        if(t<t1+0.55){for(let i=0;i<3;i++){g.beginPath();g.arc(x0+44+i*26,ay+80,8+3*Math.max(0,Math.sin(t*9-i)),0,7);g.fillStyle="#B9B3A6";g.fill()}return}
        g.globalAlpha*=ap(t,t1+0.55,0.3);g.font=fB(700,36);g.fillStyle=B.colors.card_text;al.forEach((l,i)=>g.fillText(l,x0+30,ay+84+i*46))})}},
  search:{h(c){return 32+96+18+(c.status?78:0)+(c.rows||[]).length*112+22},
    draw(c,st,t){const w=c.w||860,h=PART.search.h(c);shadowCard(-w/2,-h/2,w,h,36);let y=-h/2+32;const t0=atOf(c,0);
      rr(g,-w/2+30,y,w-60,96,48);g.fillStyle=SOFT;g.fill();g.save();g.strokeStyle="#141414";g.lineWidth=6;g.beginPath();g.arc(-w/2+86,y+44,16,0,7);g.moveTo(-w/2+98,y+57);g.lineTo(-w/2+112,y+71);g.stroke();g.restore();
      g.font=fB(700,36);g.fillStyle=B.colors.card_text;g.textAlign="left";g.textBaseline="middle";const q=typed(c.q||"",t,t0,c.cps||30);g.fillText(q,-w/2+136,y+49);if(q.length<String(c.q||"").length||t<t0+String(c.q||"").length/30+0.5)caret(g,-w/2+136+g.measureText(q).width,y+62,36,t);y+=96+18;
      if(c.status){const t1=atOf(c,1),k=eOut3((t-t1)/1.6);if(t>=t1){g.globalAlpha*=1;g.font=fB(700,30);g.fillStyle=MUT;g.fillText(c.status,-w/2+40,y+24);g.font=fK(900,38);g.textAlign="right";g.fillStyle=B.colors.card_accent;g.fillText(fmtN((c.count||40)*k),w/2-40,y+24);
        rr(g,-w/2+40,y+52,w-80,14,7);g.fillStyle="rgba(0,0,0,0.08)";g.fill();rr(g,-w/2+40,y+52,(w-80)*Math.max(0.02,k),14,7);g.fillStyle=B.colors.ui;g.fill()}y+=78}
      (c.rows||[]).forEach((r,i)=>{const ti=atOf(c,i+(c.status?2:1));slideIn(g,t,ti,40,0,()=>{rr(g,-w/2+30,y+i*112,w-60,96,22);g.fillStyle="#F7F5F0";g.fill();g.beginPath();g.arc(-w/2+82,y+i*112+48,20,0,7);g.fillStyle=[B.colors.ui,B.colors.card_accent,GREEN][i%3];g.fill();
        g.textAlign="left";g.textBaseline="alphabetic";g.font=fB(800,34);g.fillStyle=B.colors.card_text;g.fillText(r[0],-w/2+124,y+i*112+44);if(r[1]){g.font=fB(700,26);g.fillStyle=MUT;g.fillText(r[1],-w/2+124,y+i*112+78)}})})}},
  checklist:{h(c){return (c.title?112:30)+(c.items||[]).length*84+26},
    draw(c,st,t){const w=c.w||860,h=PART.checklist.h(c);shadowCard(-w/2,-h/2,w,h,30);const head=headBar(g,w,h,c.title)||30;
      (c.items||[]).forEach((it,i)=>{const ti=atOf(c,i,0.45),k=ap(t,ti,0.3),y=-h/2+head+i*84+40;g.beginPath();g.arc(-w/2+70,y,24,0,7);g.lineWidth=4;g.strokeStyle=k>0?GREEN:"#C9C3B6";g.stroke();
        if(k>0){g.beginPath();g.arc(-w/2+70,y,24*eBack(k),0,7);g.fillStyle=GREEN;g.fill();g.save();g.beginPath();g.rect(-w/2+40,y-30,60*cl(k*1.4),60);g.clip();check(g,-w/2+70,y+1,26,"#fff");g.restore()}
        g.font=fB(800,36);g.textAlign="left";g.textBaseline="middle";g.fillStyle=k>0?B.colors.card_text:"#9A958A";fit(g,s=>fB(800,s),[plain(it)],w-170,36,0.55,"checklist");richLine(g,it,-w/2+118,y+2,k>0?B.colors.card_text:"#9A958A",B.colors.card_accent,"left")})}},
  bars:{h(c){return (c.title?112:30)+(c.items||[]).length*100+26},
    draw(c,st,t){const w=c.w||860,h=PART.bars.h(c);shadowCard(-w/2,-h/2,w,h,30);const head=headBar(g,w,h,c.title)||30,its=c.items||[],mx=c.max||Math.max(...its.map(x=>+x[1]||0),1);
      its.forEach(([lab,v],i)=>{const ti=atOf(c,i,0.3),k=eOut3((t-ti)/0.9),y=-h/2+head+i*100;g.textAlign="left";g.textBaseline="alphabetic";g.font=fB(800,32);g.fillStyle=B.colors.card_text;g.fillText(lab,-w/2+40,y+36);
        g.textAlign="right";g.font=fK(900,34);g.fillStyle=B.colors.card_accent;g.fillText(fmtN(v*cl(k))+(c.unit||""),w/2-40,y+38);rr(g,-w/2+40,y+54,w-80,22,11);g.fillStyle="rgba(0,0,0,0.07)";g.fill();
        if(k>0){const sh=c.stuck===i&&t>ti+0.9?Math.sin(t*38)*3:0;rr(g,-w/2+40+sh,y+54,(w-80)*cl(v/mx)*cl(k),22,11);g.fillStyle=i===c.hot?RED:B.colors.ui;g.fill()}})}},
  funnel:{h(c){return 34+(c.items||[]).length*116+(c.drop?10:0)+20},
    draw(c,st,t){const w=c.w||860,h=PART.funnel.h(c);shadowCard(-w/2,-h/2,w,h,30);const its=c.items||[],mx=Math.max(...its.map(x=>+x[1]||0),1),cols=[B.colors.ui,darker(B.colors.ui,0.18),RED];
      its.forEach(([lab,n],i)=>{const ti=atOf(c,i,0.25),k=eOut3((t-ti)/0.6);if(k<=0)return;const y=-h/2+34+i*116,bw=(w-80)*Math.max(0.32,n/mx)*k;rr(g,-w/2+40,y,bw,100,20);g.fillStyle=i===its.length-1?RED:cols[Math.min(i,1)];g.fill();
        g.textAlign="left";g.textBaseline="alphabetic";g.font=fB(800,30);g.fillStyle="#141414";g.fillText(lab,-w/2+66,y+40);g.font=fK(900,34);g.fillText(fmtN(n),-w/2+66,y+82)});
      if(c.drop){const y=-h/2+34+(its.length-1)*116+50,bx=-w/2+40+(w-80)*Math.max(0.32,(its[its.length-1]||[0,0])[1]/mx)+24;popIn(g,t,c.drop_at!=null?c.drop_at:atOf(c,its.length,0.25)+0.4,bx+120,y,()=>pill(g,bx,y,c.drop,{size:28,bg:"#FDE7E8",bd:RED,fg:"#8E1F24",dot:RED}))}}},
  calendar:{h(c){const rows=Math.ceil(((c.start||1)-1+(c.days||31))/7);return 112+52+rows*80+26},
    draw(c,st,t){const w=c.w||860,h=PART.calendar.h(c),cw=(w-60)/7,s0=(c.start||1)-1;shadowCard(-w/2,-h/2,w,h,30);headBar(g,w,h,c.title||"МЕСЯЦ");
      g.font=fB(800,22);g.fillStyle=MUT;g.textAlign="center";g.textBaseline="middle";["ПН","ВТ","СР","ЧТ","ПТ","СБ","ВС"].forEach((d,i)=>g.fillText(d,-w/2+30+cw*(i+0.5),-h/2+138));
      const pos=d=>{const k=s0+d-1;return[-w/2+30+cw*(k%7+0.5),-h/2+164+Math.floor(k/7)*80+40]};
      for(let d=1;d<=(c.days||31);d++){const[x,y]=pos(d);g.font=fB(700,30);g.fillStyle=B.colors.card_text;g.fillText(String(d),x,y)}
      (c.marks||[]).forEach((m,i)=>{const[x,y]=pos(m[0]),ti=atOf(c,i,0.4),k=ap(t,ti,0.35);if(k<=0)return;g.save();g.translate(x,y);g.rotate(-0.12);const s=lerp(1.8,1,eBack(k));g.scale(s,s);g.globalAlpha*=cl(k*2);
        if(m[1]){pill(g,0,0,m[1],{size:20,al:"center",bg:B.colors.ui,pad:12,h:40})}else{g.beginPath();g.arc(0,0,30,0,7);g.lineWidth=5;g.strokeStyle=RED;g.stroke()}g.restore()})}},
  profile:{h(c){return 250},
    draw(c,st,t){const w=c.w||860,h=250;shadowCard(-w/2,-h/2,w,h,36);const ax=-w/2+125,im=imgOf(c.img);g.save();g.beginPath();g.arc(ax,0,80,0,7);g.clip();
      if(im)cover(g,im,ax-80,-80,160,160);else{g.fillStyle=B.colors.ui;g.fillRect(ax-80,-80,160,160);g.fillStyle="#141414";g.font=fK(900,80);g.textAlign="center";g.textBaseline="middle";g.fillText((c.name||c.handle||"?").replace("@","")[0].toUpperCase(),ax,6)}g.restore();
      g.beginPath();g.arc(ax,0,84,0,7);g.lineWidth=5;g.strokeStyle=B.colors.ui;g.stroke();g.textAlign="left";g.textBaseline="alphabetic";g.font=fK(900,44);g.fillStyle=B.colors.card_text;g.fillText(c.handle||"@you",-w/2+240,-38);
      if(c.name){g.font=fB(700,28);g.fillStyle=MUT;g.fillText(c.name,-w/2+240,0)}const f=c.followers||[0,1000],k=eOut3((t-(c.count_at!=null?c.count_at:c.t[0]+0.3))/1.4);
      g.font=fK(900,60);g.fillStyle=B.colors.card_accent;const nv=fmtN(lerp(f[0],f[1],k));g.fillText(nv,-w/2+240,74);const nw=g.measureText(nv).width;g.font=fB(700,28);g.fillStyle=MUT;g.fillText(c.label||"подписчиков",-w/2+256+nw,72)}},
  flip:{h(c){return 210+(c.label?64:0)},
    draw(c,st,t){const v=String(c.value||"00"),f=String(c.from!=null?c.from:"0".repeat(v.length)).padStart(v.length,"0"),tw=128,gap=16,W0=v.length*(tw+gap)-gap,h=PART.flip.h(c);
      for(let i=0;i<v.length;i++){const x=-W0/2+i*(tw+gap),y=-h/2,ti=(c.at&&c.at[0]!=null?c.at[0]:c.t[0]+0.2)+i*0.12,k=cl((t-ti)/0.45),ch=k>=1?v[i]:(k>0.5?v[i]:f[i]),sy=Math.abs(Math.cos(k*Math.PI));
        g.save();g.shadowColor="rgba(0,0,0,0.35)";g.shadowBlur=24;g.shadowOffsetY=10;rr(g,x,y,tw,190,22);g.fillStyle="#141414";g.fill();g.restore();
        g.save();g.translate(x+tw/2,y+95);g.scale(1,k>0&&k<1?Math.max(0.05,sy):1);g.font=fK(900,140);g.fillStyle=/\d/.test(ch)?"#FFFFFF":B.colors.ui;g.textAlign="center";g.textBaseline="middle";g.fillText(ch,0,8);g.restore();
        g.fillStyle="rgba(255,255,255,0.08)";g.fillRect(x,y+94,tw,3)}
      if(c.label){g.font=fB(800,34);g.fillStyle="#fff";g.textAlign="center";g.textBaseline="alphabetic";g.save();g.shadowColor="rgba(0,0,0,0.6)";g.shadowBlur=14;g.fillText(c.label,0,h/2-12);g.restore()}}},
  polaroids:{h(c){return 430},
    draw(c,st,t){const fs=(c.files||[]).slice(0,4),n=fs.length||1,rot=[-8,5,-3,7],span=Math.min(860,n*250+60),pw=290;
      fs.forEach((f,i)=>{const x=n===1?0:-span/2+pw/2+i*(span-pw)/(n-1),ti=atOf(c,i,0.3),k=ap(t,ti,0.45);if(k<=0)return;g.save();g.translate(x,lerp(-160,0,eBack(k)));g.rotate((rot[i%4]+(1-k)*14)*Math.PI/180);g.globalAlpha*=cl(k*2);
        g.shadowColor="rgba(0,0,0,0.4)";g.shadowBlur=30;g.shadowOffsetY=12;g.fillStyle="#FBFAF6";g.fillRect(-pw/2,-180,pw,350);g.shadowColor="transparent";cover(g,imgOf(f),-pw/2+16,-164,pw-32,pw-32);
        const cap=(c.captions||[])[i];if(cap){g.font=fN(34);g.fillStyle="#2B2B2B";g.textAlign="center";g.textBaseline="middle";g.fillText(cap,0,138)}g.restore()})}},
  phone:{h(c){return 720},
    draw(c,st,t){const k=eOut3(st.d/0.5);g.save();g.translate(0,(1-k)*80);g.rotate((c.rot!=null?c.rot:-4)*Math.PI/180);g.shadowColor="rgba(0,0,0,0.45)";g.shadowBlur=50;g.shadowOffsetY=20;rr(g,-180,-350,360,700,58);g.fillStyle="#0E0E10";g.fill();g.shadowColor="transparent";
      g.save();rr(g,-166,-336,332,672,46);g.clip();g.fillStyle="#222";g.fillRect(-166,-336,332,672);cover(g,imgOf(c.file),-166,-336,332,672);g.restore();rr(g,-60,-326,120,30,15);g.fillStyle="#0E0E10";g.fill();g.restore();
      if(c.label)badge(g,c.label,-150,-390,ap(t,c.t[0]+0.3,0.25))}},
  note:{h(c){g.font=fN(56);return Math.max(300,wrap(g,c.text||"",520).length*Math.round(62*NK)+150)},
    draw(c,st,t){const w=c.w||640,h=PART.note.h(c);g.save();g.rotate((c.rot!=null?c.rot:-3)*Math.PI/180);g.shadowColor="rgba(0,0,0,0.35)";g.shadowBlur=36;g.shadowOffsetY=14;g.fillStyle=c.color||"#FFE680";g.fillRect(-w/2,-h/2,w,h);g.shadowColor="transparent";
      g.fillStyle="rgba(255,255,255,0.55)";g.save();g.translate(0,-h/2);g.rotate(0.05);g.fillRect(-90,-22,180,44);g.restore();g.font=fN(56);const L=wrap(g,c.text||"",520),lh=Math.round(62*NK);
      let n=typed(L.join(" "),t,atOf(c,0)+0.2,c.cps||22).length;g.fillStyle=c.ink||"#1E1E1E";g.textAlign="left";g.textBaseline="alphabetic";L.forEach((l,i)=>{g.fillText(l.slice(0,Math.max(0,n)),-w/2+60,-h/2+100+i*lh);n-=l.length+1});g.restore()}},
  beforeafter:{h(c){return c.before&&c.before.file?460:340},
    draw(c,st,t){const w=c.w||880,h=PART.beforeafter.h(c),cw=(w-24)/2,lb=c.labels||["ДО","ПОСЛЕ"],ta=atOf(c,0,0.8);
      const side=(o,x,acc)=>{shadowCard(x,-h/2,cw,h,30);g.save();rr(g,x,-h/2,cw,h,30);g.clip();if(o.file)cover(g,imgOf(o.file),x,-h/2+70,cw,h-70);g.restore();
        pill(g,x+24,-h/2+40,lb[acc?1:0],{size:24,bg:acc?B.colors.ui:"#E4E0D7",h:44,pad:16});if(!o.file){g.font=fK(900,46);fit(g,s=>fK(900,s),[plain(o.title||"")],cw-60,46,0.5,"before/after");g.fillStyle=acc?B.colors.card_text:"#8F8A80";g.textAlign="left";g.textBaseline="alphabetic";
          wrap(g,o.title||"",cw-60).slice(0,3).forEach((l,i)=>g.fillText(l,x+30,-h/2+130+i*56));if(o.sub){g.font=fB(700,28);g.fillStyle=MUT;wrap(g,o.sub,cw-60).slice(0,2).forEach((l,i)=>g.fillText(l,x+30,h/2-70+i*36))}}};
      side(c.before||{},-w/2,false);const k=ap(t,ta,0.5);if(k>0){g.save();g.beginPath();g.rect(-w/2+cw+24,-h/2-40,cw*eOut3(k)+4,h+80);g.clip();side(c.after||{},-w/2+cw+24,true);g.restore()}}},
  quote:{h(c){const w=c.w||860;return 120+textH(fK(900,52),c.text||"",w-120,64)+(c.author?60:20)},
    draw(c,st,t){const w=c.w||860,h=PART.quote.h(c);shadowCard(-w/2,-h/2,w,h,36);g.font=`900 160px ${KFN}, ${BFN}`;g.fillStyle=B.colors.ui;g.textAlign="left";g.textBaseline="alphabetic";g.fillText("“",-w/2+36,-h/2+150);
      g.font=fK(900,52);const L=wrap(g,c.text||"",w-120);L.forEach((l,i)=>{g.save();g.globalAlpha*=ap(t,c.t[0]+0.15+i*0.18,0.3);richLine(g,cs(l),-w/2+60,-h/2+110+i*64,B.colors.card_text,B.colors.card_accent,"left");g.restore()});
      if(c.author){g.font=fB(700,30);g.fillStyle=MUT;g.textAlign="left";g.fillText("— "+c.author,-w/2+60,h/2-36)}}},
  word:{h(c){return Math.round((c.size||190)*1.15)},
    draw(c,st,t){const txt=cs(c.text||""),fx=c.fx||"pop",d=st.d;let fs=fit(g,s=>fK(900,s),[txt],960,c.size||190,0.4,"word");g.save();
      if(fx==="shake"){const k=eBack(d/0.35);g.scale(k,k);if(d>0.35)g.translate(Math.sin(t*47)*6,Math.cos(t*39)*5)}else if(fx==="slam"){const k=cl(d/0.22),s=lerp(2.4,1,eOut3(k))+(k>=1?0.06*Math.exp(-(d-0.22)*9)*Math.sin((d-0.22)*40):0);g.scale(s,s)}
      else if(fx==="stretch"){g.scale(1+0.08*Math.sin(d*6),1-0.05*Math.sin(d*6))}else{const k=eBack(d/0.4);g.scale(k,k)}
      g.font=fK(900,fs);g.textAlign="center";g.textBaseline="middle";g.lineJoin="round";g.lineWidth=fs*0.12;g.strokeStyle="#141414";g.strokeText(txt,0,0);g.shadowColor="rgba(0,0,0,0.5)";g.shadowBlur=30;g.fillStyle=c.color||B.colors.accent;g.fillText(txt,0,0);g.restore()}},
  hub:{h(c){return 600},
    draw(c,st,t){const w=c.w||900,h=600;shadowCard(-w/2,-h/2,w,h,36);const N=c.nodes||[],cx=0,cy=-20;
      N.forEach((nd,i)=>{const an=-Math.PI/2+i*2*Math.PI/Math.max(1,N.length)+Math.PI/Math.max(1,N.length),x=cx+Math.cos(an)*300,y=cy+Math.sin(an)*190,ti=atOf(c,i,0.25),k=ap(t,ti,0.4);if(k<=0)return;
        g.save();g.globalAlpha*=cl(k*2);g.strokeStyle=t>(c.glow_at!=null?c.glow_at:1e9)?B.colors.ui:"rgba(0,0,0,0.18)";g.lineWidth=4;g.beginPath();g.moveTo(cx,cy);g.lineTo(lerp(cx,x,eOut3(k)),lerp(cy,y,eOut3(k)));g.stroke();g.restore();
        popIn(g,t,ti+0.1,x,y,()=>{rr(g,x-86,y-56,172,112,22);g.fillStyle="#F7F5F0";g.fill();g.lineWidth=2;g.strokeStyle="rgba(0,0,0,0.1)";g.stroke();g.textAlign="center";g.textBaseline="middle";
          if(nd[1]){g.font=`44px ${EMO}`;g.fillText(nd[1],x,y-14)}else{g.beginPath();g.arc(x,y-16,22,0,7);g.fillStyle=B.colors.ui;g.fill();g.font=fK(900,24);g.fillStyle="#141414";g.fillText(String(nd[0])[0].toUpperCase(),x,y-14)}g.font=fB(800,24);g.fillStyle=B.colors.card_text;g.fillText(nd[0],x,y+30)})});
      popIn(g,t,c.t[0]+0.2,cx,cy,()=>{g.beginPath();g.arc(cx,cy,92,0,7);g.fillStyle="#141414";g.fill();g.lineWidth=6;g.strokeStyle=B.colors.ui;g.stroke();g.font=fK(900,36);g.fillStyle="#fff";g.textAlign="center";g.textBaseline="middle";g.fillText(c.center||"Claude",cx,cy+2)});
      if(c.count){const tc=c.count_at!=null?c.count_at:atOf(c,N.length,0.25),m=String(c.count).match(/^(\D*)([\d\s]+)(.*)$/),k=eOut3((t-tc)/1.0);
        popIn(g,t,tc,0,h/2-52,()=>{let s=c.count;if(m){const v=parseInt(m[2].replace(/\s/g,""));s=m[1]+fmtN(v*k)+m[3]}pill(g,0,h/2-52,s,{size:32,al:"center",bg:"#141414",fg:B.colors.ui,bd:B.colors.ui})})}}},
  form:{h(c){return 64+90+(c.fields||[]).length*108+96+((c.checks||[]).length?(c.checks.length*64+10):0)+30},
    draw(c,st,t){const w=c.w||860,h=PART.form.h(c);shadowCard(-w/2,-h/2,w,h,30,"#F7F5EF");g.save();rr(g,-w/2,-h/2,w,h,30);g.clip();g.fillStyle="#E4E0D7";g.fillRect(-w/2,-h/2,w,64);g.restore();
      [["#FF6159",0],["#FFBF2F",26],["#2ACB42",52]].forEach(([col,o])=>{g.beginPath();g.arc(-w/2+34+o,-h/2+32,9,0,7);g.fillStyle=col;g.fill()});rr(g,-w/2+110,-h/2+14,w-260,36,18);g.fillStyle="#fff";g.fill();
      g.font=fB(700,22);g.fillStyle="#666";g.textAlign="left";g.textBaseline="middle";g.fillText(c.url||"site.ru/form",-w/2+130,-h/2+33);let y=-h/2+64+30;g.font=fK(900,46);g.fillStyle="#141414";g.textBaseline="alphabetic";g.fillText(c.title||"Заявка",-w/2+40,y+40);y+=72;
      (c.fields||[]).forEach(([lab,val],i)=>{const ti=atOf(c,i,0.4);g.font=fB(700,24);g.fillStyle="#6A655B";g.fillText(lab,-w/2+40,y+i*108+14);rr(g,-w/2+40,y+i*108+26,w*0.62,62,14);g.fillStyle="#fff";g.fill();g.lineWidth=2.5;g.strokeStyle=t>ti&&t<ti+String(val).length/40+0.3?B.colors.ui:"#D8D3C8";g.stroke();
        g.font=fB(700,30);g.fillStyle="#141414";g.textBaseline="middle";g.fillText(typed(val,t,ti,40),-w/2+62,y+i*108+58);g.textBaseline="alphabetic"});
      y+=(c.fields||[]).length*108+10;const tp=c.press_at!=null?c.press_at:atOf(c,(c.fields||[]).length,0.4),pr=ap(t,tp,0.12)*(1-ap(t,tp+0.2,0.2));rr(g,-w/2+40,y,280,70,35);g.fillStyle=pr>0.3?darker(B.colors.ui,0.25):"#141414";g.fill();
      g.font=fB(800,30);g.fillStyle="#fff";g.textAlign="center";g.textBaseline="middle";g.fillText(c.button||"Отправить",-w/2+180,y+36);tap(g,-w/2+180,y+35,t-tp);y+=96;
      (c.checks||[]).forEach((s,i)=>{const ti=c.checks_at&&c.checks_at[i]!=null?c.checks_at[i]:tp+0.35+i*0.3;slideIn(g,t,ti,30,0,()=>{rr(g,-w/2+40,y+i*64,w-80,54,16);g.fillStyle="#E3F4E9";g.fill();check(g,-w/2+72,y+i*64+28,24,GREEN);
        g.font=fB(800,28);g.fillStyle="#1D5B36";g.textAlign="left";g.textBaseline="middle";g.fillText(s,-w/2+104,y+i*64+28)})})}},
  site:{h(c){return 560},
    draw(c,st,t){const w=c.w||900,h=560;shadowCard(-w/2,-h/2,w,h,30);const sx=-w/2+30,sw=400,sy=-h/2+30,sh=h-60,bc=c.brand_color||(c.colors||["#2E4A3B"])[0],ac=(c.colors||[])[1]||"#C8873A";
      g.save();rr(g,sx,sy,sw,sh,18);g.clip();g.fillStyle="#F7F2E9";g.fillRect(sx,sy,sw,sh);g.fillStyle="#E7E0D3";g.fillRect(sx,sy,sw,40);g.fillStyle=bc;g.fillRect(sx,sy+40,sw,200);
      g.font=fK(900,44);g.fillStyle="#F7F2E9";g.textAlign="left";g.textBaseline="alphabetic";fit(g,s=>fK(900,s),[c.brand||"Бренд"],sw-60,44,0.5,"site");g.fillText(c.brand||"Бренд",sx+30,sy+130);rr(g,sx+30,sy+168,150,44,22);g.fillStyle=ac;g.fill();
      for(let i=0;i<2;i++){rr(g,sx+20+i*190,sy+262,170,sh-282,14);g.fillStyle="#fff";g.fill();g.fillStyle="#E9DCC9";g.fillRect(sx+34+i*190,sy+276,142,90)}
      const ks=(t-(c.scan_at!=null?c.scan_at:c.t[0]+0.4))/1.2;if(ks>0&&ks<1.3){const y=sy+40+(sh-40)*cl(ks),gr=g.createLinearGradient(0,y-60,0,y);gr.addColorStop(0,"rgba(255,207,77,0)");gr.addColorStop(1,"rgba(255,207,77,.55)");g.fillStyle=gr;g.fillRect(sx,y-60,sw,60);g.fillStyle=B.colors.ui;g.fillRect(sx,y,sw,4)}g.restore();
      const rx=sx+sw+40;let ry=sy+20;const tc=c.colors_at!=null?c.colors_at:c.t[0]+1.2;if(c.colors&&t>tc){g.font=fB(800,26);g.fillStyle=MUT;g.textAlign="left";g.fillText(c.colors_label||"фирменные цвета",rx,ry+20);
        c.colors.slice(0,5).forEach((col,i)=>popIn(g,t,tc+i*0.1,rx+40+i*84,ry+80,()=>{rr(g,rx+i*84,ry+42,72,72,16);g.fillStyle=col;g.fill();g.lineWidth=2;g.strokeStyle="rgba(0,0,0,0.12)";g.stroke()}));ry+=150}
      const tf=c.fonts_at!=null?c.fonts_at:c.t[0]+2;if(c.fonts&&t>tf){g.font=fB(800,26);g.fillStyle=MUT;g.fillText(c.fonts_label||"шрифты",rx,ry+20);let x=rx;c.fonts.slice(0,3).forEach((f,i)=>{slideIn(g,t,tf+i*0.12,20,0,()=>{x+=pill(g,x,ry+70,f,{size:26,bg:SOFT})+12})});ry+=130}
      if(c.done){const td=c.done_at!=null?c.done_at:c.t[0]+2.8;slideIn(g,t,td,0,20,()=>{rr(g,rx,ry,w/2-sw/2-70+180,64,18);g.fillStyle="#E3F4E9";g.fill();check(g,rx+34,ry+32,24,GREEN);g.font=fB(800,28);g.fillStyle="#1D5B36";g.textBaseline="middle";g.fillText(c.done,rx+66,ry+33)})}}}
};
for(const k in PART)CARD[k]=PART[k].draw;

// ---------- motion panel scene (split shot with "scene"): header + parts stacked, drawn live ----------
function drawScene(sh,t,alpha){const S=sh.scene||{},keep=g;g=p;p.save();p.globalAlpha=alpha;p.fillStyle=B.colors.panel_bg;p.fillRect(CX,CY,CW,CH);
  const gr=p.createRadialGradient(CX+CW/2,CY+CH*0.6,20,CX+CW/2,CY+CH*0.6,CW*0.8);gr.addColorStop(0,B.colors.panel_glow+"30");gr.addColorStop(1,B.colors.panel_glow+"00");p.fillStyle=gr;p.fillRect(CX,CY,CW,CH);
  const d=t-sh.t[0];let top=CY+34;if(S.title){slideIn(p,t,sh.t[0]+0.05,0,-16,()=>{p.font=fK(900,50);p.textAlign="left";p.textBaseline="alphabetic";fit(p,s=>fK(900,s),[plain(S.title)],CW-360,50,0.6,"scene title");richLine(p,cs(S.title),CX+40,top+52,"#FFFFFF",B.colors.accent,"left")});top+=88}
  if(S.tag)popIn(p,t,S.tag_at!=null?S.tag_at:sh.t[0]+0.3,CX+CW-120,CY+70,()=>pill(p,CX+CW-36,CY+70,S.tag,{size:26,al:"right",bg:"rgba(0,0,0,0)",bd:B.colors.ui,fg:B.colors.ui}));
  const body=S.body||[],bot=CY+CH-(S.foot?54:26),avail=bot-top,gap=22;let tot=body.reduce((s,c)=>s+PART_H(c),0)+gap*Math.max(0,body.length-1),mw=Math.max(...body.map(c=>c.w||(c.type==="hub"||c.type==="site"||c.type==="beforeafter"?900:860)),1);
  const sc=Math.min(1,(CW-60)/mw,avail/Math.max(1,tot));let y=top+(avail-tot*sc)/2;
  for(const c of body){const hh=PART_H(c)*sc,t0=c.show_at!=null?c.show_at:sh.t[0]+0.15,cc=c.t?c:Object.assign(c,{t:[t0,sh.t[1]]}),k=ap(t,cc.t[0],0.4);
    if(k>0){p.save();p.globalAlpha*=cl(k*1.6);p.translate(CX+CW/2,y+hh/2+(1-eOut3(k))*24);p.scale(sc,sc);const f=CARD[c.type];if(f)f(cc,{a:1,s:1,d:t-cc.t[0]},t);else warn("unknown part "+c.type);p.restore()}y+=hh+gap*sc}
  if(S.foot)slideIn(p,t,sh.t[0]+0.6,0,10,()=>{p.font=fB(700,24);p.fillStyle="rgba(255,255,255,0.55)";p.textAlign="center";p.textBaseline="alphabetic";p.fillText(S.foot,CX+CW/2,CY+CH-22)});
  p.restore();g=keep}
function PART_H(c){return PART[c.type]?PART[c.type].h(c):cardH(c)}

function fullImages(t){for(const c of TL.cards||[]){if(c.type!=="image"||c.size!=="full")continue;const st=cardState(t,c);if(!st)continue;const im=cache.get(U(c.file));if(!im)continue;
  const s=Math.max(W/im.width,H/im.height)*(1.04+0.04*cl(st.d/Math.max(0.5,c.t[1]-c.t[0])));g.save();g.globalAlpha=cl(st.d/0.15)*(1-cl((t-c.t[1])/0.25));
  g.drawImage(im,540-im.width*s/2,960-im.height*s/2,im.width*s,im.height*s);g.restore();if(c.label)badge(g,c.label,60,B.safe_top+180,cl((st.d-0.15)/0.25))}}
// card height, so cards hang from a fixed top line (under the face) instead of being centred on it
function cardH(c){switch(c.type){
  case "text":{const lines=[].concat(c.title||"").flatMap(s=>String(s).split("\n"));const size=fit(g,s=>fK(900,s),lines.map(plain),820,c.size||88,0.6,"card");g.font=fK(900,size);const lay=block(lines,size,0.92,1.1,0.18);let sh=0;if(c.sub){g.font=fB(700,38);sh=wrap(g,String(c.sub),820).length*48+18}return lay.h+48+sh}
  case "list":return (c.title?118:30)+(c.items||[]).length*82+30;
  case "image":{const im=cache.get(U(c.file));if(!im)return 400;const mw=c.w||820,mh=c.h||560;let w=mw,h=im.height*w/im.width;if(h>mh)h=mh;return h}
  case "number":return c.label?300:220;
  case "cta":return 150;case "follow":return 112;case "sticker":return (c.size||220);default:return PART[c.type]?PART[c.type].h(c):300}}
let CARD_BOTTOM=0;
function cards(t,k,layer){CARD_BOTTOM=0;for(const c of TL.cards||[]){if(c.type==="image"&&c.size==="full")continue;if(k>0.01&&!c.in_split)continue;
  if(layer==="behind"?!c.behind:(c.behind&&PERSON))continue;const st=cardState(t,c);if(!st)continue;const f=CARD[c.type];if(!f){warn("unknown card "+c.type);continue}
  const h=cardH(c),cy=c.y!=null?c.y:B.cards.top+h/2;if(c.y==null&&c.type!=="sticker"&&st.a>0.5)CARD_BOTTOM=Math.max(CARD_BOTTOM,cy+h/2);
  g.save();g.globalAlpha=st.a;g.translate(c.x||540,cy+(1-eOut3(st.d/0.42))*40);g.scale(st.s,st.s);f(c,st,t);g.restore()}}

// ---------- hook + subtitles ----------
function hook(t,k){const hk=TL.hook;if(!hk||!hk.lines||!hk.lines.length)return;let end=hk.t1||2.5;for(const[a]of TL.split||[])if(a>0.3&&a<end)end=a;
  const a=1-cl((t-end+0.25)/0.25);if(a<=0)return;const L=hk.lines.map(cs),st=B.hook.style;
  g.save();g.globalAlpha=a;const fs=fit(g,s=>fH(900,s),L.map(plain),860,B.hook.size,0.55,"hook");g.font=fH(900,fs);
  const lay=block(L,fs,0.98,1.06,0.08),by=hk.y||B.hook.y,bw=Math.max(...L.map(l=>g.measureText(plain(l)).width))+96,bh=lay.h+44,q=t<0.05?1:eBack(t/0.35);
  g.translate(540,by+bh/2);g.scale(lerp(0.9,1,q),lerp(0.9,1,q));g.translate(-540,-(by+bh/2));
  if(st==="plate"){g.shadowColor="rgba(0,0,0,0.22)";g.shadowBlur=30;g.shadowOffsetY=8;rr(g,540-bw/2,by,bw,bh,46);g.fillStyle=B.colors.plate;g.fill();g.shadowColor="transparent"}
  g.textBaseline="alphabetic";L.forEach((l,i)=>{const y=by+22+lay.y0+i*lay.lh;
    if(st!=="plate"){g.save();g.lineJoin="round";g.lineWidth=12;g.strokeStyle="rgba(0,0,0,0.5)";g.textAlign="center";g.strokeText(plain(l),540,y);g.restore();g.save();g.shadowColor="rgba(0,0,0,0.5)";g.shadowBlur=20}
    const ha=B.colors.hook_accent||B.colors.accent;richLine(g,l,540,y,st==="plate"?B.colors.plate_text:"#FFFFFF",st==="plate"?accOn(B.colors.plate,ha):ha);if(st!=="plate")g.restore()});g.restore()}
function subtitles(t,k){const S=TL.subs||[];let cur=null;for(const x of S)if(t>=x[0]&&t<x[1]){cur=x;break}if(!cur)return;const C=B.captions;
  const d=t-cur[0],q=eBack(d/0.16),sy=C.split_y==null?934+OFF:C.split_y,y=lerp(k<0.01&&CARD_BOTTOM?Math.min(1700,Math.max(C.y,CARD_BOTTOM+80)):C.y,sy,k),txt=cs(String(cur[2]).replace(/\s+/g," "));
  const fs=fit(g,s=>fC(900,s),[txt],C.max_width,C.size,0.55,"subtitle");g.font=fC(900,fs);
  g.save();g.globalAlpha=cl(d/0.05);g.translate(540,y);const sc=lerp(0.82,1,q);g.scale(sc,sc);g.textAlign="center";g.textBaseline="middle";const col=cur[3]?C.accent||B.colors.accent:B.colors.caption;
  if(C.style==="box"){const w=g.measureText(txt).width+56;rr(g,-w/2,-fs*0.68,w,fs*1.36,18);g.fillStyle="rgba(0,0,0,0.78)";g.fill();g.fillStyle=col;g.fillText(txt,0,4)}
  else if(C.style==="outline"){g.lineJoin="round";g.lineWidth=fs*0.16;g.strokeStyle="#000";g.strokeText(txt,0,4);g.fillStyle=col;g.fillText(txt,0,4)}
  else{g.lineJoin="round";g.lineWidth=10;g.strokeStyle="rgba(0,0,0,0.35)";g.strokeText(txt,0,4);g.shadowColor="rgba(0,0,0,0.6)";g.shadowBlur=18;g.shadowOffsetY=5;g.fillStyle=col;g.fillText(txt,0,4)}
  g.restore()}

// ---------- frame ----------
// ---------- person cut out of the background (masks from scripts/cutout.py, or the right half of a side-by-side proxy) ----------
let PERSON=false,PCV=null,MCV=null,TCV=null;
const rangeA=(L,t,f=0.2)=>{let a=0,v=null;for(const r of L||[]){if(t>=r[0]-f&&t<=r[1]+f){const x=cl((t-r[0]+f)/f)*cl((r[1]+f-t)/f);if(x>a){a=x;v=r}}}return[a,v]};
function meDraw(c,me,w,h){if(OPT.sbs&&me.videoWidth)c.drawImage(me,0,0,me.videoWidth/2,me.videoHeight,0,0,w,h);else c.drawImage(me,0,0,w,h)}
async function personLayer(t,me){const mw=540,mh=960;let mk=null;
  if(OPT.sbs&&me&&me.videoWidth)mk=me;else if(FR.mask){const fps=FR.mask.fps||30;mk=await img(U(`mk/${pad4(Math.min(FR.mask.n,Math.max(1,Math.round(meSrc(t)*fps)+1)))}.jpg`))}
  if(!mk||!me)return false;if(!PCV){PCV=document.createElement("canvas");PCV.width=mw;PCV.height=mh;MCV=document.createElement("canvas");MCV.width=mw;MCV.height=mh;TCV=document.createElement("canvas");TCV.width=mw;TCV.height=mh}
  const m=MCV.getContext("2d",{willReadFrequently:true});m.globalCompositeOperation="copy";if(mk===me)m.drawImage(me,me.videoWidth/2,0,me.videoWidth/2,me.videoHeight,0,0,mw,mh);else m.drawImage(mk,0,0,mw,mh);
  const id=m.getImageData(0,0,mw,mh),a=id.data;for(let i=0;i<a.length;i+=4){a[i+3]=a[i];a[i]=a[i+1]=a[i+2]=255}m.putImageData(id,0,0);
  const q=PCV.getContext("2d");q.globalCompositeOperation="copy";meDraw(q,me,mw,mh);q.globalCompositeOperation="destination-in";q.drawImage(MCV,0,0);q.globalCompositeOperation="source-over";return true}
async function frame(t){const k=splitK(t);if(k>0)await drawPanel(t);
  g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.fillStyle="#000";g.fillRect(0,0,W,H);
  const me=OPT.meImage?await OPT.meImage(t):await img(U(`mf/${pad4(meIdx(t))}.jpg`));const dy=(730-SHIFT)*k,z=zoomAt(t);
  const meT=()=>{g.translate(540,FY+dy);g.scale(z,z);g.translate(-540,-FY)};
  if(me){g.save();meT();meDraw(g,me,W,H);g.restore()}
  const[ca,cv]=rangeA(TL.cutout,t),[ga,gv]=rangeA(TL.glow,t),behind=(TL.cards||[]).some(c=>c.behind&&t>=c.t[0]-0.05&&t<=c.t[1]+0.3);
  PERSON=false;if(me&&(ca>0||ga>0||behind))PERSON=await personLayer(t,me);
  if(PERSON){if(ca>0){g.save();g.globalAlpha=ca;const bg=cv[2]||"#F3EEE3";g.fillStyle=bg==="paper"?"#F3EEE3":bg;g.fillRect(0,0,W,H);
      if(bg==="paper"){const gr=g.createRadialGradient(540,800,200,540,900,1300);gr.addColorStop(0,"rgba(255,255,255,0.5)");gr.addColorStop(1,"rgba(120,100,70,0.18)");g.fillStyle=gr;g.fillRect(0,0,W,H)}g.restore()}
    cards(t,k,"behind");
    if(ga>0){const tq=TCV.getContext("2d");tq.globalCompositeOperation="copy";tq.drawImage(PCV,0,0);tq.globalCompositeOperation="source-in";tq.fillStyle=gv[2]||B.colors.accent;tq.fillRect(0,0,540,960);tq.globalCompositeOperation="source-over";
      g.save();meT();g.globalAlpha=ga*0.9;g.filter="blur(22px)";g.drawImage(TCV,-12,-12,W+24,H+24);g.filter="blur(6px)";g.drawImage(TCV,0,0,W,H);g.filter="none";g.restore()}
    g.save();meT();g.drawImage(PCV,0,0,W,H);g.restore()}
  if(k>0){const ph=PH*k;g.drawImage(PC,0,ph-PH);const gr=g.createLinearGradient(0,ph,0,ph+40);gr.addColorStop(0,"rgba(0,0,0,0.45)");gr.addColorStop(1,"rgba(0,0,0,0)");g.fillStyle=gr;g.fillRect(0,ph,W,40)}
  fullImages(t);cards(t,k,"front");hook(t,k);subtitles(t,k)};

async function init(cfg){TL=cfg.tl;B=merge(DEF,cfg.brand||{});const LY=TL.layout||{};if(LY.cards_top!=null)B.cards.top=LY.cards_top;if(LY.caption_y!=null)B.captions.y=LY.caption_y;FR=cfg.frames||{me:{n:1,fps:30},rec:{}};DIR=cfg.dir;
  OFF=B.safe_top;PH=920+OFF;CX=40;CY=140+OFF;CW=1000;CH=740;SHIFT=B.split.shift;FY=B.face_y;
  await loadFonts();
  for(const s of TL.shots||[]){if(s.rec){s._ri=recInfo(s.rec);s.t=[s.m[0][0],s.m[s.m.length-1][0]]}}
  const files=new Set();const walk=o=>{if(!o||typeof o!=="object")return;if(Array.isArray(o)){o.forEach(walk);return}for(const k of["file","img"])if(typeof o[k]==="string"&&/\.(png|jpe?g|webp|gif)$/i.test(o[k]))files.add(o[k]);if(Array.isArray(o.files))o.files.forEach(f=>files.add(f));for(const k in o)if(k!=="m"&&typeof o[k]==="object")walk(o[k])};
  walk(TL.cards);walk((TL.shots||[]).filter(s=>s.scene));for(const f of files)await img(U(f));
  BGC=document.createElement("canvas");BGC.width=W;BGC.height=PH;{const x=BGC.getContext("2d");x.fillStyle=B.colors.panel_bg;x.fillRect(0,0,W,PH);
    const gr=x.createRadialGradient(540,520+OFF,40,540,520+OFF,800);gr.addColorStop(0,B.colors.panel_glow+"33");gr.addColorStop(1,B.colors.panel_glow+"00");x.fillStyle=gr;x.fillRect(0,0,W,PH);
    if(B.split.dots){x.fillStyle="rgba(255,255,255,0.07)";for(let yy=14;yy<PH;yy+=28)for(let xx=14;xx<W;xx+=28){x.beginPath();x.arc(xx,yy,1.6,0,7);x.fill()}}}
  PC=document.createElement("canvas");PC.width=W;PC.height=PH;p=PC.getContext("2d");SCV=document.createElement("canvas");SCV.width=CW;SCV.height=CH;return "ok"}
return {init,frame,warnings:()=>[...WARN],defaults:DEF,families:FAMILY,fonts:FONT_META};
}
root.ReelEngine=ReelEngine;
})(typeof window!=="undefined"?window:this);
