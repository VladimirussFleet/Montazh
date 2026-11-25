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
let UFN="UF",MFN="MF",HFN="HF",BFN="BF",CFN="CF",KFN="KF",NFN="NF",HW=900,HK=1,CWT=900,CK=1,KW=900,KK=1,NW=700,NK=1.25;
// hook: head font; cards and numbers: cards font; subtitles: captions font (both default to head)
const fH=(w,s)=>`${HW} ${Math.round(s*HK)}px ${HFN}, ${BFN}, ${EMO}`, fB=(w,s)=>`${w} ${s}px ${BFN}, ${EMO}`,
      fC=(w,s)=>`${CWT} ${Math.round(s*CK)}px ${CFN}, ${BFN}, ${EMO}`, fK=(w,s)=>`${KW} ${Math.round(s*KK)}px ${KFN}, ${BFN}, ${EMO}`, fN=s=>`${NW} ${Math.round(s*NK)}px ${NFN}, ${BFN}, ${EMO}`, fM=(w,s)=>`${w>=750?800:700} ${s}px ${MFN}, ${BFN}, ${EMO}`, fU=s=>`800 ${s}px ${UFN}, ${BFN}, ${EMO}`;
async function loadFonts(){
  const head=B.fonts.head,cap=B.fonts.captions||head,crd=B.fonts.cards||head,body=B.fonts.body,nts=B.fonts.notes||"caveat";[,HW,HK]=fm(head);[,CWT,CK]=fm(cap);[,KW,KK]=fm(crd);[,NW,NK]=fm(nts);
  if(OPT.fonts==="css"){MFN=`"JetBrains Mono"`;UFN=`"Unbounded"`;HFN=`"${fm(head)[0]}"`;CFN=`"${fm(cap)[0]}"`;KFN=`"${fm(crd)[0]}"`;BFN=`"${fm(body)[0]}"`;NFN=`"${fm(nts)[0]}"`;
    for(const f of[`${HW} 40px ${HFN}`,`${CWT} 40px ${CFN}`,`${KW} 40px ${KFN}`,`${NW} 40px ${NFN}`,`800 40px ${BFN}`,`700 40px ${BFN}`,`600 40px ${BFN}`,`800 40px ${MFN}`,`700 40px ${MFN}`,`800 40px ${UFN}`])try{await document.fonts.load(f,"АБВabc")}catch(e){}return}
  HFN="HF";CFN="CF";KFN="KF";BFN="BF";NFN="NF";
  await loadFace("HF",head,HW);await loadFace("CF",cap,CWT);await loadFace("KF",crd,KW);await loadFace("NF",nts,NW);try{await loadFace("MF","jetbrains-mono",700);await loadFace("MF","jetbrains-mono",800);await loadFace("UF","unbounded",800)}catch(e){};for(const w of[800,700,600])await loadFace("BF",body,w);await document.fonts.ready}

let TL,B,FR,DIR,PC,p,BGC,SCV,OFF,PH,CX,CY,CW,CH,SHIFT,FY,FL=false,FLX=null,FLWIN=null,PN=null;
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
function splitK(t){let k=0;const D=0.42,cut=(TL.layout||{}).split_cut;for(const[a,b]of TL.split||[]){let v;if(cut){if(t>=a&&t<b)k=1;continue}
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
// faceless reel (layout.faceless): the whole frame is the panel background, with a slow drifting glow
function flBg(t){p.drawImage(BGC,0,0);const x=540+Math.sin(t*0.37)*260,y=CY+CH*0.5+Math.cos(t*0.29)*300,gr=p.createRadialGradient(x,y,30,x,y,760);
  gr.addColorStop(0,B.colors.panel_glow+"26");gr.addColorStop(1,B.colors.panel_glow+"00");p.fillStyle=gr;p.fillRect(0,0,W,PH)}
// faceless ranges in an ordinary reel (plan "faceless": [[a, b]]): the same full-frame panel as layout.faceless, drawn on its own canvas
async function flPanel(t,win){const s={FL,PH,CH,PC,p,BGC};FL=true;PH=H;CH=FLX.CH;PC=FLX.PC;p=FLX.p;BGC=FLX.BGC;FLWIN=win;try{await drawPanel(t)}finally{({FL,PH,CH,PC,p,BGC}=s);FLWIN=null}}
async function drawPanel(t){p.setTransform(1,0,0,1,0,0);p.globalAlpha=1;if(FL)flBg(t);else p.drawImage(BGC,0,0);stepPill(t);
  const ids=FLWIN?(TL.shots||[]).map((s,i)=>i).filter(i=>TL.shots[i].t[1]>FLWIN[0]+0.05&&TL.shots[i].t[0]<FLWIN[1]-0.05):shotsAt(t),bare=FL&&ids.every(i=>TL.shots[i].scene),hard=!FL&&(TL.layout||{}).split_cut;
  if(!bare){p.save();p.shadowColor=PN?"rgba(40,30,10,0.22)":"rgba(0,0,0,0.65)";p.shadowBlur=60;p.shadowOffsetY=20;rr(p,CX,CY,CW,CH,30);p.fillStyle=B.colors.panel_frame;p.fill();p.restore()}
  p.save();if(!bare){rr(p,CX,CY,CW,CH,30);p.clip()}
  for(const i of ids){const sh=TL.shots[i];let a=1;if(t<sh.t[0]+0.12&&i>0&&!(hard&&splitK(sh.t[0]-0.05)<=0))a=cl((t-sh.t[0])/0.12);if(sh.scene){drawScene(sh,t,a);continue}const im=await loadShot(sh,t);drawShot(sh,im,t,a)}
  p.restore();if(!bare){rr(p,CX,CY,CW,CH,30);p.lineWidth=2;p.strokeStyle=PN?(PN.border||"rgba(23,23,26,0.18)"):B.colors.ui+"66";p.stroke()}}

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
  number(c,st,t){const m=String(c.value).match(/^(\D*?)(\d(?:[\d\s\u00A0\u202F]*\d)?(?:[.,]\d+)?)(.*)$/);let txt=String(c.value);
    if(m){const grp=/\s|\u00A0|\u202F/.test(m[2]),raw=m[2].replace(/[\s\u00A0\u202F]/g,""),v=parseFloat(raw.replace(",",".")),f=c.from||0,u=eOut3(st.d/(c.count||0.8)),dec=(raw.split(/[.,]/)[1]||"").length;
      let n=(f+(v-f)*u).toFixed(dec).replace(".",raw.includes(",")?",":".");if(grp)n=n.replace(/^(\d+)/,x=>x.replace(/\B(?=(\d{3})+(?!\d))/g,"\u00A0"));txt=m[1]+n+m[3]}
    const w=c.w||600,h=c.label?300:220;shadowCard(-w/2,-h/2,w,h,40);g.textAlign="center";g.textBaseline="middle";
    if(c.label){let ls=28;g.letterSpacing="4px";g.font=fB(800,ls);while(ls>16&&g.measureText(cs(c.label)).width>w-70){ls-=1;g.letterSpacing=(ls*4/28).toFixed(1)+"px";g.font=fB(800,ls)}g.fillStyle="#8A8A8F";g.fillText(cs(c.label),0,-h/2+64);g.letterSpacing="0px"}
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

// gallery layout: tiles in rows of `cols`, the last row centred
function galLay(c){const n=(c.files||[]).length||1,cols=c.cols||Math.min(n,4),rows=Math.ceil(n/cols),w=c.w||940,gap=c.gap||18,tw=(w-gap*(cols-1))/cols,th=tw*(c.ratio||16/9);return{n,cols,rows,w,gap,tw,th,h:rows*th+(rows-1)*gap}}
// prompt layout: a long command wraps onto up to 3 lines and the field grows
function prLay(c){const w=c.w||900,fw=w-68,q=String(c.q||""),mx=fw-190,sz=c.size||62;g.font=fB(800,sz);if(g.measureText(q).width<=mx)return{w,fw,fs:sz,L:[q],fh:128};
  let fs=Math.round(sz*0.74);g.font=fB(800,fs);let L=wrap(g,q,mx);while(L.length>3&&fs>30){fs-=2;g.font=fB(800,fs);L=wrap(g,q,mx)}return{w,fw,fs,L,fh:Math.round(L.length*fs*1.22+60)}}
// checklist rows: a narrow card (w < 700) wraps long items onto two lines
function clRows(c){const w=c.w||860,fs=c.fs||36;g.font=fB(800,fs);return (c.items||[]).map(it=>{const L=w<700&&g.measureText(plain(it)).width>w-160?wrap(g,plain(it),w-160):[it];return{L,h:Math.max(84,Math.round(L.length*fs*1.16+44))}})}

// window: a browser, Claude Code or a file in an app window. Lines (`blocks`) appear by words and push the older ones up.
// c.kind browser|claude|file, c.url/url_at, c.title, c.tag, c.blocks[{k,at,...}], c.cursor[[t,x,y,click]], c.cam[[t,s,fx,fy]], c.stamp{text,at}
function winTheme(c){return (c.kind==="claude"||c.kind==="terminal")&&!c.light?{bg:"#1F1E1C",bar:"#2B2A27",tx:"#EEEBE4",mu:"#9C978C",card:"#2B2A27",line:"rgba(255,255,255,0.08)",dark:1}
  :{bg:"#FFFFFF",bar:"#EFEDE8",tx:"#151515",mu:"#8A8578",card:"#F5F3EE",line:"rgba(0,0,0,0.07)",dark:0}}
function wbH(b,cw){const k=b.k;g.font=fM(700,b.fs||30);
  if(k==="user")return wrap(g,"> "+(b.text||""),cw-20).length*Math.round((b.fs||30)*1.4)+22;
  if(k==="text"){g.font=fB(700,b.fs||28);return wrap(g,b.text||"",cw-10).length*Math.round((b.fs||28)*1.38)+14}
  if(k==="code")return (b.lines||[]).length*Math.round((b.fs||26)*1.5)+16;
  return {count:200,row:86,big:118,tool:58,progress:92,cand:124,ask:60,ok:62,bad:62,gap:b.h||20,head:74}[k]||60}
function wbDraw(b,x,y,cw,t,T){const k=b.k,a0=b.at;g.textAlign="left";g.textBaseline="middle";
  if(k==="head"){g.font=fK(900,b.fs||40);g.fillStyle=T.tx;g.fillText(b.text||"",x,y+34);if(b.sub){g.font=fB(700,24);g.fillStyle=T.mu;g.textAlign="right";g.fillText(b.sub,x+cw,y+36)}return}
  if(k==="row"){const hl=b.hl_at!=null?b.hl_at:b.hl,on=hl!=null&&t>=hl,kk=on?eOut3((t-hl)/0.35):0;rr(g,x,y+4,cw,74,18);g.fillStyle=on?`rgba(217,178,91,${0.18*kk})`:T.card;g.fill();if(on){g.save();g.lineWidth=4;g.strokeStyle=B.colors.ui;g.globalAlpha*=kk;rr(g,x,y+4,cw,74,18);g.stroke();g.restore()}
    if(b.skel){g.fillStyle=T.line;rr(g,x+70,y+26,cw*0.34,14,7);g.fill();rr(g,x+70,y+50,cw*0.22,10,5);g.fill();rr(g,x+cw-150,y+32,120,16,8);g.fill()}
    g.font=fK(900,30);g.fillStyle=on?B.colors.card_accent:T.mu;g.fillText(String(b.rank||""),x+24,y+42);if(b.skel)return;
    g.font=fM(800,30);g.fillStyle=T.tx;g.fillText(b.name||"",x+70,y+(b.sub?30:42));if(b.sub){g.font=fB(700,21);g.fillStyle=T.mu;g.fillText(b.sub,x+70,y+60)}
    if(b.val){g.font=fK(900,30);g.textAlign="right";g.fillStyle=on?B.colors.card_accent:T.tx;g.fillText(b.val,x+cw-24,y+42)}return}
  if(k==="count"){const ca=b.count_at!=null?b.count_at:a0,kk=eOut3(cl((t-ca)/(b.dur||1.6)));let fs=b.fs||104;g.font=fK(900,fs);const txt=fmtN(Math.round((b.n||0)*kk));while(fs>40&&g.measureText(fmtN(b.n||0)).width>cw-20){fs-=4;g.font=fK(900,fs)}
    g.textAlign="center";g.fillStyle=t>=ca+(b.dur||1.6)?B.colors.card_accent:T.tx;g.fillText(txt,x+cw/2,y+78);if(b.label&&t>=(b.label_at!=null?b.label_at:a0))popIn(g,t,b.label_at!=null?b.label_at:a0,x+cw/2,y+156,()=>{g.font=fB(800,b.lfs||32);g.fillStyle=T.tx;g.textAlign="center";g.fillText(b.label,x+cw/2,y+156)},0.3);return}
  if(k==="big"){popIn(g,t,a0,x+cw/2,y+58,()=>pill(g,x+cw/2,y+58,b.text||"",{size:b.fs||40,al:"center",bg:B.colors.ui,fg:"#141414",pad:30}));return}
  if(k==="user"){const fs=b.fs||30,lh=Math.round(fs*1.4),full="> "+(b.text||""),q="> "+typed(b.text||"",t,a0,b.cps||24);g.font=fM(700,fs);const L=wrap(g,full,cw-20);let n=q.length;
    L.forEach((l,i)=>{const part=l.slice(0,Math.max(0,n));n-=l.length+1;if(!part)return;const yy=y+10+i*lh+lh/2;if(i===0){g.fillStyle=B.colors.ui;g.fillText(">",x,yy);g.fillStyle=T.tx;g.fillText(part.slice(1),x+g.measureText(">").width,yy)}else{g.fillStyle=T.tx;g.fillText(part,x,yy)}
      if(n<=0&&q.length<full.length)caret(g,x+g.measureText(part).width,yy+fs*0.4,fs,t)});return}
  if(k==="text"){const fs=b.fs||28;g.font=fB(700,fs);g.fillStyle=b.color||T.tx;wrap(g,b.text||"",cw-10).forEach((l,i)=>g.fillText(l,x,y+6+i*Math.round(fs*1.38)+fs*0.7));return}
  if(k==="tool"){const dn=b.done_at!=null?b.done_at:b.done,done=dn!=null&&t>=dn,cx=x+16,cy=y+29;if(done){g.beginPath();g.arc(cx,cy,13,0,7);g.fillStyle=GREEN;g.fill();g.strokeStyle="#fff";g.lineWidth=3.5;g.beginPath();g.moveTo(cx-6,cy);g.lineTo(cx-1,cy+5);g.lineTo(cx+7,cy-5);g.stroke()}
    else{g.save();g.lineWidth=4;g.strokeStyle=B.colors.ui;g.beginPath();g.arc(cx,cy,11,t*7,t*7+4.2);g.stroke();g.restore()}
    g.font=fM(800,b.fs||28);g.fillStyle=T.tx;g.fillText(b.text||"",x+44,cy);if(b.note){const nw=g.measureText(b.text||"").width;g.font=fB(700,24);g.fillStyle=T.mu;g.fillText(done&&b.note_done?b.note_done:b.note,x+64+nw,cy+1)}return}
  if(k==="progress"){const kk=cl((t-a0)/(b.dur||1.2));g.font=fB(700,25);g.fillStyle=T.mu;g.fillText(b.label||"",x,y+20);if(b.count!=null){g.font=fK(900,30);g.textAlign="right";g.fillStyle=B.colors.ui;g.fillText(fmtN(b.count*eOut3(kk))+(b.unit||""),x+cw,y+20)}
    rr(g,x,y+50,cw,14,7);g.fillStyle=T.line;g.fill();rr(g,x,y+50,Math.max(14,cw*eOut3(kk)),14,7);g.fillStyle=B.colors.ui;g.fill();return}
  if(k==="cand"){const st=b.stamp&&t>=b.stamp_at,gd=b.good_at!=null&&t>=b.good_at;g.save();if(st)g.globalAlpha*=lerp(1,0.42,cl((t-b.stamp_at)/0.3));rr(g,x,y+6,cw,108,20);g.fillStyle=T.card;g.fill();
    if(gd){g.lineWidth=4;g.strokeStyle=GREEN;rr(g,x,y+6,cw,108,20);g.stroke()}
    g.font=fM(800,29);g.fillStyle=T.tx;g.fillText(b.name||"",x+26,y+40);let cxp=x+26;(b.chips||[]).forEach((ch,i)=>{const ca=b.chips_at!=null?b.chips_at+i*0.12:a0;if(t<ca)return;const bad=ch[1]==="bad";
      const wv=pill(g,cxp,y+84,ch[0],{size:20,al:"left",pad:14,bg:bad?"rgba(229,72,77,0.18)":"rgba(46,158,91,0.2)",fg:bad?"#FF8A8D":"#6FD39A",h:34});if(!T.dark){}cxp+=wv+10});
    if(gd){g.font=fK(900,40);g.fillStyle=GREEN;g.textAlign="right";g.fillText("✓",x+cw-26,y+48)}g.restore();
    if(st){const kk=ap(t,b.stamp_at,0.25),s2=lerp(2.2,1,eOut3(kk));g.save();g.globalAlpha*=cl(kk*2);g.translate(x+cw-150,y+60);g.rotate(-0.12);g.scale(s2,s2);g.font=fK(900,38);const tw=g.measureText(b.stamp).width;
      g.lineWidth=5;g.strokeStyle=RED;rr(g,-tw/2-18,-30,tw+36,60,8);g.stroke();g.fillStyle=RED;g.textAlign="center";g.fillText(b.stamp,0,2);g.restore()}return}
  if(k==="ask"){g.font=fM(800,b.fs||30);g.fillStyle=T.tx;const q=b.text||"";g.fillText(q,x,y+30);if(b.ans&&t>=b.ans_at){const qw=g.measureText(q+" ").width;g.fillStyle=B.colors.ui;const an=typed(b.ans,t,b.ans_at,10);g.fillText(an,x+qw,y+30)}return}
  if(k==="ok"||k==="bad"){const ok=k==="ok",cx=x+16,cy=y+31;g.beginPath();g.arc(cx,cy,15,0,7);g.fillStyle=ok?GREEN:RED;g.fill();g.strokeStyle="#fff";g.lineWidth=4;g.beginPath();
    if(ok){g.moveTo(cx-7,cy);g.lineTo(cx-1,cy+6);g.lineTo(cx+8,cy-6)}else{g.moveTo(cx-6,cy-6);g.lineTo(cx+6,cy+6);g.moveTo(cx+6,cy-6);g.lineTo(cx-6,cy+6)}g.stroke();
    let fz=b.fs||30;g.font=fB(800,fz);while(fz>20&&g.measureText(b.text||"").width>cw-50){fz--;g.font=fB(800,fz)}g.fillStyle=ok?(T.dark?"#8FE3B0":GREEN):(T.dark?"#FF9C9E":RED);g.fillText(b.text||"",x+46,cy+1);return}
  if(k==="code"){const fs=b.fs||26,lh=Math.round(fs*1.5);const HL=b.hl_at!=null?[b.hl_at,...(b.hl_rows||[0,99])]:b.hl;(b.lines||[]).forEach((l,i)=>{const yy=y+8+i*lh+lh/2;if(HL&&t>=HL[0]&&i>=HL[1]&&i<=HL[2]){const kk=eOut3((t-HL[0])/0.4);g.fillStyle=`rgba(255,207,77,${0.35*kk})`;g.fillRect(x-10,yy-lh/2,(cw+20)*kk,lh)}
    g.font=fM(700,fs);g.fillStyle=/^(---|#)/.test(l)?B.colors.card_accent:/^\w+:/.test(l)?T.mu:T.tx;g.fillText(l,x,yy)});return}}
function winAt(keys,t,n){if(!keys||!keys.length)return null;let a=keys[0],b=keys[keys.length-1];if(t<=a[0])return a.slice(1,n+1);if(t>=b[0])return b.slice(1,n+1);
  for(let i=0;i<keys.length-1;i++)if(t>=keys[i][0]&&t<=keys[i+1][0]){a=keys[i];b=keys[i+1];break}const u=eIO((t-a[0])/Math.max(1e-6,b[0]-a[0]));return a.slice(1,n+1).map((v,j)=>typeof v==="number"?lerp(v,b[j+1],u):v)}
// ---------- "lab" parts: a light paper look for reels that leave the dark brand style (layout.panel) ----------
const LBL={ink:"#17171A",blue:"#2B4BF2",grn:"#14A363",red:"#E5484D",hl:"#FFE45C",mut:"#8C877C",card:"#FFFFFF",line:"rgba(23,23,26,0.14)",soft:"#ECE7DB",onAcc:"#FFFFFF",onInk:"#FFFFFF",map:"#E7E1D2",street:"#FFFFFF",dim:"#C9C3B5",ghost:"#B9B2A2",table:"#17171A",stampBg:"rgba(255,255,255,0.94)",vary:["#17171A","#3C3A36","#5B5850","#2B2A28"],dark:0};
let LB=LBL;
function labTheme(){LB=PN?LBL:{ink:"#F2EEE6",blue:B.colors.ui,grn:"#2EBD6B",red:"#FF5A5F",hl:B.colors.accent,mut:"#9C978C",card:"#1F1E1B",line:"rgba(255,255,255,0.16)",soft:"#2C2B28",onAcc:"#141414",onInk:"#141414",map:"#191816",street:"#3A3833",dim:"#3A3833",ghost:"#4E4B44",table:"#2C2A26",stampBg:"rgba(16,16,18,0.92)",vary:["#F2EEE6","#D9D3C6","#BDB6A7","#E6E0D3"],dark:1}}
const fD=s=>LB.dark?fK(900,s):fU(s);
function labHead(c,w,h,t){g.textAlign="left";g.textBaseline="alphabetic";let y=-h/2+44;
  if(c.kicker){slideIn(g,t,c.t[0]+0.05,0,-10,()=>{g.font=fM(800,22);g.letterSpacing="3px";g.fillStyle=LB.blue;g.fillText(c.kicker.toUpperCase(),-w/2+8,y-6);g.letterSpacing="0px"});y+=42}
  if(c.title){const ta=c.title_at!=null?c.title_at:c.t[0]+0.1;slideIn(g,t,ta,0,-14,()=>{let fs=c.title_size||44;g.font=fD(fs);while(fs>24&&g.measureText(plain(c.title)).width>w-(c.head_pad||(c.tag?190:20))){fs-=2;g.font=fD(fs)}richLine(g,cs(c.title),-w/2+8,y,LB.ink,LB.blue,"left")})}
  if(c.tag)popIn(g,t,c.t[0]+0.4,w/2-60,-h/2+30,()=>pill(g,w/2-8,-h/2+30,c.tag,{size:20,al:"right",bg:"rgba(0,0,0,0)",bd:LB.mut,fg:LB.mut,h:36,pad:14}))}
function person(x,y,s,col,o={}){if(!(s>0.5))return;g.save();g.translate(x,y);g.beginPath();g.arc(0,-s*0.27,s*0.2,0,7);g.moveTo(s*0.36,s*0.44);g.bezierCurveTo(s*0.36,-s*0.04,-s*0.36,-s*0.04,-s*0.36,s*0.44);g.closePath();
  if(o.ai){g.setLineDash([s*0.09,s*0.07]);g.lineWidth=Math.max(2,s*0.055);g.strokeStyle=col;g.stroke();g.setLineDash([])}else{g.fillStyle=col;g.fill()}g.restore()}
function hash01(i,k=1){const x=Math.sin(i*127.1+k*311.7)*43758.5453;return x-Math.floor(x)}
function bubble(x,y,txt,o={}){g.font=fB(800,o.size||26);const L=wrap(g,txt,o.maxw||360),lh=Math.round((o.size||26)*1.3),bw=Math.max(...L.map(l=>g.measureText(l).width))+40,bh=L.length*lh+26;
  let bx=Math.max(o.minx!=null?o.minx:-1e9,Math.min(x-bw/2,(o.maxx!=null?o.maxx:1e9)-bw)),by=y-bh-18;g.save();g.shadowColor="rgba(40,30,10,0.18)";g.shadowBlur=18;g.shadowOffsetY=6;rr(g,bx,by,bw,bh,18);g.fillStyle=o.bg||LB.card;g.fill();g.restore();
  if(o.bd){rr(g,bx,by,bw,bh,18);g.lineWidth=3;g.strokeStyle=o.bd;g.stroke()}g.beginPath();g.moveTo(x-10,by+bh-1);g.lineTo(x,y-4);g.lineTo(x+10,by+bh-1);g.fillStyle=o.bg||LB.card;g.fill();
  g.fillStyle=o.fg||LB.ink;g.textAlign="left";g.textBaseline="middle";L.forEach((l,i)=>g.fillText(l,bx+20,by+13+lh/2+i*lh))}
function pin(x,y,col,r=22){g.beginPath();g.arc(x,y-r*1.9,r,Math.PI*0.82,Math.PI*0.18,false);g.lineTo(x,y);g.closePath();g.fillStyle=col;g.fill();g.beginPath();g.arc(x,y-r*1.9,r*0.42,0,7);g.fillStyle=LB.dark?"#141414":"#fff";g.fill()}
function hlSwipe(x,y,w,h,t,t0,col){const k=eOut3(ap(t,t0,0.35));if(k<=0)return;g.save();g.globalAlpha*=0.85;g.fillStyle=col||LB.hl;g.beginPath();g.moveTo(x-6,y+h*0.15);g.lineTo(x-6+(w+12)*k,y);g.lineTo(x-6+(w+12)*k,y+h);g.lineTo(x-6,y+h*1.02);g.closePath();g.fill();g.restore()}
function crowdLay(n,cols,W2,H2,cy){if(!cols){let best=0;for(let k=4;k<=26;k++){const c2=Math.min(W2/k,H2/Math.ceil(n/k));if(c2>best+0.5){best=c2;cols=k}}}const rows=Math.ceil(n/cols),cell=Math.min(W2/cols,H2/rows),last=n-(rows-1)*cols;const ox=-cols*cell/2+cell/2,oy=cy-rows*cell/2+cell/2;
  return i=>{const r=Math.floor(i/cols),cc=i%cols,sh=r===rows-1?(cols-last)*cell/2:0;return[ox+cc*cell+sh,oy+r*cell,cell]}}
const QN=(x,keys)=>Array.isArray(x)?Object.fromEntries(keys.map((k,i)=>[k,x[i]])):x;
const PART={
  // crowd: 100 buyers. title, n, cols, at (fill), idea{text,at}, offer{text,at}, stamp{text,at}, focus{idx,at,title,rows:[[label,value,at]]}, vote_at, buy, vote_dur, quotes[[idx,text,at]], ai_at, shrink_at+shrink_to
  crowd:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660,n=c.n||100;if(c.vote_at!=null&&c.head_pad==null)c.head_pad=380;labHead(c,w,h,t);
      let gtop=-h/2+(c.title?110:30)+(c.kicker?42:0);const ban=c.offer||c.idea;
      if(ban){const b=ban,bh=84;slideIn(g,t,b.at,0,-20,()=>{rr(g,-w/2+8,gtop,w-16,bh,20);g.fillStyle=LB.card;g.fill();g.lineWidth=3;g.strokeStyle=c.offer?LB.blue:LB.ink;g.stroke();
          g.fillStyle=c.offer?LB.blue:LB.ink;rr(g,-w/2+24,gtop+18,48,48,12);g.fill();g.fillStyle=LB.onAcc;g.font=fD(24);g.textAlign="center";g.textBaseline="middle";g.fillText(c.offer?"₽":"!",-w/2+48,gtop+43);
          g.textAlign="left";g.font=fB(800,30);g.fillStyle=LB.ink;let tx=b.text;while(g.measureText(tx).width>w-140&&tx.length>4)tx=tx.slice(0,-2);g.fillText(tx,-w/2+92,gtop+44)});gtop+=bh+26}
      const voteOn=c.vote_at!=null&&t>=c.vote_at,dur=c.vote_dur||1.4,buy=c.buy||0;
      if(c.vote_at!=null){const k=cl((t-c.vote_at)/dur),nb=Math.round(buy*k),nn=Math.round((n-buy)*k);const bx=w/2-8;
        popIn(g,t,c.vote_at-0.1,bx-120,-h/2+40,()=>{[[nn,(c.vote_labels||[])[1]||"не купят",LB.red],[nb,(c.vote_labels||[])[0]||"купят",LB.grn]].forEach(([v,l,col],j)=>{const x1=bx-j*176;rr(g,x1-162,-h/2+6,162,78,16);g.fillStyle=LB.card;g.fill();g.lineWidth=3;g.strokeStyle=col;g.stroke();
          g.textAlign="right";g.textBaseline="alphabetic";g.font=fM(800,40);g.fillStyle=col;g.fillText(String(v),x1-14,-h/2+52);g.textAlign="left";g.font=fB(800,18);g.fillStyle=LB.mut;g.fillText(l,x1-150,-h/2+74)})})}
      const sh=c.shrink_at!=null?eIO(ap(t,c.shrink_at,0.9)):0,to=c.shrink_to||20;
      const QS=(c.quotes||[]).map(q=>QN(q,["idx","text","at","vote"]));const L1=crowdLay(n,c.cols||0,w-20,h/2-gtop-(c.stamp?0:10),(gtop+h/2)/2),L2=crowdLay(to,c.cols2||0,w-120,h/2-gtop-20,(gtop+h/2)/2);
      const order=c._ord||(c._ord=[...Array(n).keys()].sort((a,b)=>hash01(a,3)-hash01(b,3)));const rank=c._rk||(c._rk=(()=>{const r=[];order.forEach((v,i)=>r[v]=i);return r})());
      const yesSet=c._yes||(c._yes=new Set([...Array(n).keys()].filter(i=>!QS.some(q=>q.idx===i&&q.vote)).sort((a,b)=>hash01(a,9)-hash01(b,9)).slice(0,Math.max(0,buy-QS.filter(q=>q.vote==="good").length))));
      const aiK=c.ai_at!=null?ap(t,c.ai_at,0.5):0,F=c.focus,fK=F&&t>=F.at?eOut3(ap(t,F.at,0.45)):0;
      for(let i=0;i<n;i++){const a0=(c.at!=null?c.at:c.t[0]+0.2)+(rank[i]/n)*(c.fill_dur||0.9);if(t<a0)continue;const k=eBack(ap(t,a0,0.3));let[x,y,cell]=L1(i);
        let al=1;if(sh>0){if(i<to){const[x2,y2,c2]=L2(i);x=lerp(x,x2,sh);y=lerp(y,y2,sh);cell=lerp(cell,c2,sh)}else al=1-sh}if(al<=0.01)continue;
        let col=c.vary_at!=null&&t>=c.vary_at?LB.vary[Math.floor(hash01(i,7)*4)]:LB.ink;
        if(voteOn){const fl=c.vote_at+(rank[i]/n)*dur;if(t>=fl){const fq=QS.find(q=>q.idx===i&&q.vote),yes=fq?fq.vote==="good":yesSet.has(i);col=yes?LB.grn:LB.red}}
        g.save();g.globalAlpha*=al*(F&&i!==F.idx?lerp(1,0.22,fK):1);person(x,y,cell*0.86*k,col,{ai:aiK>0.5});g.restore()}
      if(c.stamp&&t>=c.stamp.at){const kk=ap(t,c.stamp.at,0.25);g.save();g.globalAlpha*=cl(kk*2);g.translate(c.stamp.x||w/2-180,c.stamp.y||h/2-110);g.rotate(-0.09);g.scale(lerp(1.9,1,eOut3(kk)),lerp(1.9,1,eOut3(kk)));g.font=fD(40);const tw=g.measureText(c.stamp.text).width;
        rr(g,-tw/2-26,-44,tw+52,88,12);g.fillStyle=LB.stampBg;g.fill();g.lineWidth=7;g.strokeStyle=c.stamp.color||LB.blue;g.stroke();g.fillStyle=c.stamp.color||LB.blue;g.textAlign="center";g.textBaseline="middle";g.fillText(c.stamp.text,0,4);g.restore()}
      if(F&&fK>0){const[x,y,cell]=L1(F.idx);g.save();g.beginPath();g.arc(x,y,cell*0.62*lerp(1.6,1,fK),0,7);g.lineWidth=5;g.strokeStyle=LB.blue;g.globalAlpha*=fK;g.stroke();g.restore();
        const cw=470,chh=96+(F.rows||[]).length*66,cx=x>0?-w/2+16:w/2-16-cw,cy=Math.max(gtop-10,Math.min(h/2-chh-6,y-chh/2));
        slideIn(g,t,F.at+0.1,x>0?-30:30,0,()=>{g.save();g.shadowColor="rgba(40,30,10,0.22)";g.shadowBlur=30;g.shadowOffsetY=10;rr(g,cx,cy,cw,chh,22);g.fillStyle=LB.card;g.fill();g.restore();rr(g,cx,cy,cw,chh,22);g.lineWidth=3;g.strokeStyle=LB.blue;g.stroke();
          person(cx+52,cy+50,58,LB.blue,{ai:aiK>0.5});g.font=fD(28);g.fillStyle=LB.ink;g.textAlign="left";g.textBaseline="middle";g.fillText(F.title||"Покупатель",cx+96,cy+48);
          (F.rows||[]).map(r=>QN(r,["label","value","at"])).forEach((r,j)=>{if(t<r.at)return;slideIn(g,t,r.at,12,0,()=>{const ry=cy+104+j*66;g.font=fB(800,19);g.fillStyle=LB.mut;g.fillText(r.label.toUpperCase(),cx+28,ry);g.font=fB(800,27);g.fillStyle=LB.ink;let v=r.value;while(g.measureText(v).width>cw-56&&v.length>4)v=v.slice(0,-2);g.fillText(v,cx+28,ry+30)},0.3)})})}
      for(const q of QS){if(t<q.at)continue;const[x,y,cell]=L1(q.idx);popIn(g,t,q.at,x,y-cell*0.5,()=>bubble(x,y-cell*0.45,q.text,{size:28,maxw:360,minx:-w/2+4,maxx:w/2-4,bd:q.vote==="good"?LB.grn:q.vote==="bad"?LB.red:LB.ink}),0.35)}
      if(c.ai_at!=null&&t>=c.ai_at){const my=(gtop+h/2)/2;popIn(g,t,c.ai_at,0,my,()=>pill(g,0,my,c.ai_label||"ИИ-персоны, не люди",{size:34,al:"center",bg:LB.red,fg:"#fff",h:70,pad:30}))}}},
  // team: one skill splits into roles. center, center_at, nodes[], at (first node), step, sweep_at
  team:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660,N=c.nodes||[],n=N.length,cy=(c.title?50:0)+10;g.font=fB(800,25);const mxw=Math.max(...N.map(s2=>g.measureText(s2).width))+76;const rx=Math.min(w*0.4,w/2-mxw/2-4),ry=h*0.33,a0=c.at!=null?c.at:c.t[0]+0.4,step=c.step||0.07;labHead(c,w,h,t);
      const nr=Math.ceil(n/2),rowH=Math.min(70,(h/2-cy-10)*2/nr),P=N.map((_,i)=>{const right=i<nr,r=right?i:i-nr,cnt=right?nr:n-nr;return[(right?1:-1)*(w/2-mxw/2-4),cy+(r-(cnt-1)/2)*rowH]});
      P.forEach(([x,y],i)=>{const ti=a0+i*step;if(t<ti)return;const k=eOut3(ap(t,ti,0.35));g.save();g.strokeStyle=LB.line;g.lineWidth=3;g.beginPath();g.moveTo(0,cy);const ex=x-Math.sign(x)*(mxw/2-10);g.lineTo(lerp(0,ex,k),lerp(cy,y,k));g.stroke();g.restore()});
      const sw=c.sweep_at;P.forEach(([x,y],i)=>{const ti=a0+i*step;popIn(g,t,ti,x,y,()=>{const on=sw!=null&&t>=sw+i*0.09,kk=on?eOut3(ap(t,sw+i*0.09,0.25)):0;g.font=fB(800,25);const tw=g.measureText(N[i]).width,bw=tw+76,bh=58;
        g.save();g.shadowColor="rgba(40,30,10,0.14)";g.shadowBlur=14;g.shadowOffsetY=5;rr(g,x-bw/2,y-bh/2,bw,bh,bh/2);g.fillStyle=on?LB.blue:LB.card;g.fill();g.restore();rr(g,x-bw/2,y-bh/2,bw,bh,bh/2);g.lineWidth=2.5;g.strokeStyle=on?LB.blue:LB.line;g.stroke();
        g.beginPath();g.arc(x-bw/2+29,y,17,0,7);g.fillStyle=on?LB.onAcc:LB.ink;g.fill();g.font=fM(800,15);g.fillStyle=on?LB.blue:LB.onInk;g.textAlign="center";g.textBaseline="middle";g.fillText(String(i+1).padStart(2,"0"),x-bw/2+29,y+1);
        g.font=fB(800,25);g.fillStyle=on?LB.onAcc:LB.ink;g.textAlign="left";g.fillText(N[i],x-bw/2+56,y+1)},0.35)});
      popIn(g,t,c.center_at!=null?c.center_at:c.t[0]+0.15,0,cy,()=>{g.beginPath();g.arc(0,cy,104,0,7);g.fillStyle=LB.dark?LB.card:LB.ink;g.fill();if(LB.dark){g.lineWidth=5;g.strokeStyle=LB.blue;g.stroke()}g.font=fM(800,24);g.fillStyle=LB.dark?LB.ink:"#fff";g.textAlign="center";g.textBaseline="middle";g.fillText(c.center||"",0,cy-12);
        if(c.count&&t>=a0){g.font=fD(26);g.fillStyle=LB.hl;g.fillText(String(Math.min(n,Math.floor((t-a0)/step)+1))+" "+(c.count||""),0,cy+26)}})}},
  // board: seats [[name, method]], seat_at (list), vote_at, votes [[text,"good"/"bad"]]
  board:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660,S=c.seats||[],n=S.length,gap=w/n;labHead(c,w,h,t);const ty=h/2-150;
      g.save();g.beginPath();g.moveTo(-w*0.36,ty);g.lineTo(w*0.36,ty);g.lineTo(w*0.47,ty+120);g.lineTo(-w*0.47,ty+120);g.closePath();g.fillStyle=LB.table;g.fill();g.restore();
      g.fillStyle="rgba(255,255,255,0.08)";g.fillRect(-w*0.36,ty,w*0.72,6);
      S.forEach((s,i)=>{const x=-w/2+gap*(i+0.5),sa=(c.seat_at||[])[i]!=null?c.seat_at[i]:c.t[0]+0.3+i*0.3,on=t>=sa,ay=ty-110;
        g.save();g.globalAlpha*=on?1:0.35;g.beginPath();g.arc(x,ay,74,0,7);g.fillStyle=on?LB.blue:LB.dim;g.fill();g.font=fD(56);g.fillStyle=LB.onAcc;g.textAlign="center";g.textBaseline="middle";g.fillText(s[0][0],x,ay+4);g.restore();
        if(on){const k=ap(t,sa,0.6);if(k<1){g.beginPath();g.arc(x,ay,74+k*40,0,7);g.strokeStyle=`rgba(43,75,242,${1-k})`;g.lineWidth=6;g.stroke()}}
        const pw=gap-30;g.save();g.globalAlpha*=on?1:0.5;rr(g,x-pw/2,ty+18,pw,86,10);g.fillStyle=LB.card;g.fill();g.font=fD(26);g.fillStyle=LB.ink;g.textAlign="center";g.textBaseline="middle";g.fillText(s[0],x,ty+46);g.font=fB(800,20);g.fillStyle=LB.mut;g.fillText(s[1]||"",x,ty+80);g.restore();
        const v=(c.votes||[])[i];if(v&&c.vote_at!=null){const va=c.vote_at+i*0.22;if(t>=va){const k=ap(t,va,0.35);g.save();g.translate(x,ay-150);g.rotate((i-1)*0.05);g.scale(1,Math.abs(Math.cos((1-eOut3(k))*Math.PI/2)));const good=v[1]!=="bad";g.font=fD(30);const tw=g.measureText(v[0]).width;
          rr(g,-tw/2-26,-34,tw+52,68,14);g.fillStyle=good?LB.grn:LB.red;g.fill();g.fillStyle="#fff";g.textAlign="center";g.textBaseline="middle";g.fillText(v[0],0,3);g.restore()}}})}},
  // citymap: you{label,at}, pins [[label, price, x, y]], at (first pin), step, price_at
  citymap:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660;labHead(c,w,h,t);const top=-h/2+(c.title?96:20),mh=h/2-top-10;
      g.save();rr(g,-w/2+8,top,w-16,mh,26);g.fillStyle=LB.map;g.fill();g.clip();g.strokeStyle=LB.street;g.lineCap="round";
      [[0.18,1],[0.47,1],[0.78,1]].forEach(([f])=>{g.lineWidth=22;g.beginPath();g.moveTo(-w/2,top+mh*f);g.lineTo(w/2,top+mh*f);g.stroke()});[-0.3,0.05,0.33].forEach(f=>{g.lineWidth=22;g.beginPath();g.moveTo(w*f,top);g.lineTo(w*f,top+mh);g.stroke()});
      g.lineWidth=34;g.beginPath();g.moveTo(-w/2,top+mh*0.95);g.lineTo(w/2,top+mh*0.05);g.stroke();g.fillStyle="rgba(20,163,99,0.18)";rr(g,w*0.36,top+mh*0.52,w*0.12,mh*0.22,14);g.fill();g.restore();
      const a0=c.at!=null?c.at:c.t[0]+0.4,step=c.step||0.2;
      (c.pins||[]).forEach((p2,i)=>{const ti=a0+i*step;if(t<ti)return;const k=ap(t,ti,0.45),x=p2[2]*w/2,y=top+mh*p2[3];g.save();g.globalAlpha*=cl(k*2);g.translate(0,-(1-eBack(k))*60);pin(x,y,LB.ink,24);g.restore();
        if(c.price_at!=null&&t>=c.price_at+i*0.15)popIn(g,t,c.price_at+i*0.15,x,y-90,()=>{g.font=fM(800,30);const tw=g.measureText(p2[1]).width;rr(g,x+26,y-92,tw+32,52,10);g.fillStyle=LB.card;g.fill();g.lineWidth=3;g.strokeStyle=LB.ink;g.stroke();g.fillStyle=LB.ink;g.textAlign="left";g.textBaseline="middle";g.fillText(p2[1],x+42,y-65);
          if(p2[0]){g.font=fB(800,20);g.fillStyle=LB.mut;g.fillText(p2[0],x+28,y-112)}});
      });
      if(c.you){const y0=c.you,x=(y0.x||0)*w/2,y=top+mh*(y0.y!=null?y0.y:0.6);popIn(g,t,y0.at,x,y-40,()=>{const k=(t-y0.at)%1.4/1.4;g.beginPath();g.arc(x,y,18+k*50,0,7);g.strokeStyle=`rgba(43,75,242,${0.6*(1-k)})`;g.lineWidth=5;g.stroke();pin(x,y,LB.blue,30);
        g.font=fD(26);const tw=g.measureText(y0.label||"Ты").width;rr(g,x-tw/2-18,y+12,tw+36,48,24);g.fillStyle=LB.blue;g.fill();g.fillStyle=LB.onAcc;g.textAlign="center";g.textBaseline="middle";g.fillText(y0.label||"Ты",x,y+37)})}}},
  // breakeven: at (axes), cost_at, rev_at, margin_at, point_at, labels
  breakeven:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660;labHead(c,w,h,t);const x0=-w/2+70,x1=w/2-30,y0=h/2-60,y1=-h/2+(c.title?130:40),X=f=>lerp(x0,x1,f),Y=f=>lerp(y0,y1,f),fc=0.3,vc=0.35,cx=fc/(1-vc);
      const ka=eOut3(ap(t,c.at!=null?c.at:c.t[0]+0.2,0.5));g.save();g.strokeStyle=LB.ink;g.lineWidth=4;g.beginPath();g.moveTo(x0,Y(1.02)+(1-ka)*200);g.lineTo(x0,y0);g.lineTo(lerp(x0,x1,ka),y0);g.stroke();
      g.font=fB(800,22);g.fillStyle=LB.mut;g.textAlign="right";g.textBaseline="alphabetic";g.fillText(c.x_label||"продажи",x1,y0+40);g.save();g.translate(x0-24,Y(1));g.rotate(-Math.PI/2);g.textAlign="right";g.fillText(c.y_label||"рубли",0,0);g.restore();g.restore();
      const kr=eIO(ap(t,c.rev_at,0.9)),kc=eIO(ap(t,c.cost_at,0.9)),mk=c.margin_at!=null?eOut3(ap(t,c.margin_at,0.6)):0;
      if(mk>0){g.save();g.globalAlpha*=mk;g.beginPath();g.moveTo(X(0),Y(fc));g.lineTo(X(cx),Y(cx));g.lineTo(X(0),Y(0));g.closePath();g.fillStyle="rgba(229,72,77,0.16)";g.fill();g.beginPath();g.moveTo(X(cx),Y(cx));g.lineTo(X(1),Y(1));g.lineTo(X(1),Y(fc+vc));g.closePath();g.fillStyle="rgba(20,163,99,0.2)";g.fill();
        g.font=fD(28);g.fillStyle=LB.grn;g.textAlign="center";g.fillText(c.profit||"прибыль",X(0.88),Y(0.70)+12);g.font=fD(24);g.fillStyle=LB.red;g.fillText(c.loss||"убыток",X(0.13),Y(0.25)+10);g.restore()}
      const line=(k,f,col,lab)=>{if(k<=0)return;g.save();g.lineWidth=7;g.lineCap="round";g.strokeStyle=col;g.beginPath();g.moveTo(X(0),Y(f(0)));g.lineTo(X(k),Y(f(k)));g.stroke();if(k>0.95){g.font=fB(800,24);g.fillStyle=col;g.textAlign="right";g.fillText(lab,X(1)-4,Y(f(1))+(f(1)<0.9?40:-18))}g.restore()};
      line(kc,f=>fc+vc*f,LB.red,c.cost_label||"расходы");line(kr,f=>f,LB.ink,c.rev_label||"выручка");
      if(c.point_at!=null&&t>=c.point_at){const k=ap(t,c.point_at,0.4),px=X(cx),py=Y(cx);g.save();g.setLineDash([10,10]);g.strokeStyle=LB.blue;g.lineWidth=3;g.beginPath();g.moveTo(px,py);g.lineTo(px,y0);g.stroke();g.restore();
        g.beginPath();g.arc(px,py,Math.max(0.1,14*eBack(k)),0,7);g.fillStyle=LB.blue;g.fill();const pk=(t-c.point_at)%1.2/1.2;g.beginPath();g.arc(px,py,14+pk*36,0,7);g.strokeStyle=`rgba(43,75,242,${1-pk})`;g.lineWidth=4;g.stroke();
        popIn(g,t,c.point_at+0.1,px-200,py-80,()=>{const lab=c.point_label||"точка безубыточности";g.font=fD(28);const tw=g.measureText(lab).width,bx=Math.max(x0+10,px-tw-60);hlSwipe(bx,py-104,tw+24,46,t,c.point_at+0.15);g.fillStyle=LB.dark?"#141414":LB.ink;g.textAlign="left";g.textBaseline="middle";g.fillText(lab,bx+12,py-80)})}}},
  // timeline: days, items [[day,label,at]], at (axis)
  timeline:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660,D=c.days||14,x0=-w/2+40,x1=w/2-40,y=60,X=d=>lerp(x0,x1,(d-1)/(D-1));labHead(c,w,h,t);const ka=eOut3(ap(t,c.at!=null?c.at:c.t[0]+0.2,0.8));
      g.save();g.lineCap="round";g.lineWidth=8;g.strokeStyle=LB.ink;g.beginPath();g.moveTo(x0,y);g.lineTo(lerp(x0,x1,ka),y);g.stroke();
      for(let d=1;d<=D;d++){if(X(d)>lerp(x0,x1,ka)+1)break;g.beginPath();g.arc(X(d),y,d===1||d===D?11:7,0,7);g.fillStyle=LB.ink;g.fill();g.font=fM(800,20);g.fillStyle=LB.mut;g.textAlign="center";g.textBaseline="alphabetic";g.fillText(String(d),X(d),y+44)}
      g.font=fB(800,20);g.fillStyle=LB.mut;g.textAlign="left";g.fillText("день",x0-10,y+76);g.restore();
      (c.items||[]).map(it=>QN(it,["day","label","at"])).forEach((it,i)=>{const ti=it.at!=null?it.at:(c.at||c.t[0])+0.6+i*0.3;const x=X(it.day),up=i%2===0,fy=up?y-40:y+110;if(t<ti)return;const k=eOut3(ap(t,ti,0.35));
        g.save();g.strokeStyle=LB.blue;g.lineWidth=4;g.beginPath();g.moveTo(x,y);g.lineTo(x,lerp(y,up?fy-60:fy+10,k));g.stroke();g.restore();
        popIn(g,t,ti+0.05,x,fy,()=>{g.font=fB(800,25);const tw=g.measureText(it.label).width,bw=tw+36,bx=Math.max(-w/2+4,Math.min(w/2-4-bw,x-bw/2)),by=up?fy-120:fy+10;rr(g,bx,by,bw,60,14);g.fillStyle=LB.blue;g.fill();g.fillStyle=LB.onAcc;g.textAlign="left";g.textBaseline="middle";g.fillText(it.label,bx+18,by+31);
          g.font=fM(800,18);g.fillStyle=LB.blue;g.fillText("ДЕНЬ "+it.day,bx+2,up?by-16:by+80)},0.35)})}},
  // ceiling: yes[[text,at]] (AI figures agreeing), value, bar_at, ceil_at, real_at, labels
  ceiling:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660;labHead(c,w,h,t);const Y=(c.yes||[]).map(q=>QN(q,["text","at"]));
      Y.forEach((q,i)=>{const x=-w/2+140+i*((w-280)/Math.max(1,Y.length-1)),y=-30;if(t<(c.ai_at||c.t[0]))return;popIn(g,t,c.ai_at||c.t[0]+0.2,x,y,()=>person(x,y,120,LB.ink,{ai:true}),0.3);if(t>=q.at)popIn(g,t,q.at,x,y-80,()=>bubble(x,y-76,q.text,{size:30,bd:LB.grn,fg:LB.grn}),0.3)});
      const bx0=-w/2+20,bx1=w/2-20,by=h/2-120,bw=bx1-bx0,V=(c.value||0)/100;if(c.bar_at==null||t<c.bar_at)return;
      slideIn(g,t,c.bar_at,0,20,()=>{rr(g,bx0,by,bw,64,32);g.fillStyle=LB.soft;g.fill();const k=eOut3(ap(t,c.bar_at+0.2,0.8));rr(g,bx0,by,Math.max(64,bw*V*k),64,32);g.fillStyle=LB.grn;g.fill();
        g.font=fD(30);g.fillStyle="#fff";g.textAlign="left";g.textBaseline="middle";if(V*k>0.15)g.fillText(Math.round(c.value*k)+"%",bx0+22,by+34);g.font=fB(800,22);g.fillStyle=LB.mut;g.fillText(c.bar_label||"готовы купить",bx0+bw*V+24,by+34)});
      if(c.ceil_at!=null&&t>=c.ceil_at){const k=ap(t,c.ceil_at,0.35),x=bx0+bw*V;g.save();g.globalAlpha*=cl(k*2);g.strokeStyle=LB.red;g.lineWidth=6;g.beginPath();g.moveTo(x,by-36-(1-eOut3(k))*40);g.lineTo(x,by+100);g.stroke();
        g.font=fD(28);g.fillStyle=LB.red;g.textAlign="center";g.textBaseline="alphabetic";g.fillText(c.ceil_label||"ПОТОЛОК",x,by-48);g.restore()}
      if(c.real_at!=null&&t>=c.real_at){const k=eOut3(ap(t,c.real_at,0.5)),x=bx0+bw*V;g.save();g.globalAlpha*=k;g.strokeStyle=LB.ink;g.fillStyle=LB.ink;g.lineWidth=5;g.beginPath();g.moveTo(x-20,by+96);g.lineTo(x-20-160*k,by+96);g.stroke();g.beginPath();g.moveTo(x-20-160*k-14,by+96);g.lineTo(x-20-160*k+6,by+84);g.lineTo(x-20-160*k+6,by+108);g.closePath();g.fill();
        g.font=fB(800,24);g.textAlign="center";g.textBaseline="middle";g.fillText(c.real_label||"в жизни — ниже",x-100,by+132);g.restore()}}},
  // weak: items [[text, at]] objections, real_at, real_text
  weak:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660;labHead(c,w,h,t);let y=-h/2+(c.title?120:30);
      (c.items||[]).map(it=>QN(it,["text","at"])).forEach((it,i)=>{if(t<it.at)return;const yy=y+10+i*100;slideIn(g,t,it.at,-24,0,()=>{person(-w/2+40,yy+30,70,LB.red,{ai:true});g.font=fB(800,36);const tw=g.measureText("«"+it.text+"»").width;hlSwipe(-w/2+90,yy+6,tw+10,54,t,it.at+0.1,"rgba(229,72,77,0.18)");g.fillStyle=LB.ink;g.textAlign="left";g.textBaseline="middle";g.fillText("«"+it.text+"»",-w/2+96,yy+33)},0.35)});
      if(c.real_at!=null&&t>=c.real_at){const by=h/2-150;slideIn(g,t,c.real_at,0,24,()=>{rr(g,-w/2+8,by,w-16,140,26);g.fillStyle=LB.dark?LB.card:LB.ink;g.fill();if(LB.dark){g.lineWidth=3;g.strokeStyle=LB.blue;g.stroke()}for(let i=0;i<5;i++)popIn(g,t,c.real_at+0.15+i*0.08,-w/2+70+i*62,by+70,()=>person(-w/2+70+i*62,by+76,70,i%2?(LB.dark?LB.ink:"#FFFFFF"):LB.hl),0.3);
        g.font=fD(32);g.fillStyle=LB.dark?LB.ink:"#fff";g.textAlign="left";g.textBaseline="middle";g.fillText(c.real_text||"проверь на живых",-w/2+390,by+60);g.font=fB(800,22);g.fillStyle=LB.dark?LB.mut:"rgba(255,255,255,0.6)";g.fillText(c.real_sub||"",-w/2+392,by+102)})}}},
  // limits: n (20), at, more_at (100 ghosts appear), drain_at, labels
  limits:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660;labHead(c,w,h,t);const gw=w-260,top=-h/2+(c.title?130:40),gh=h/2-top-20,n=c.n||20,M=c.more||100;
      const L=crowdLay(M,20,gw,gh,(top+h/2)/2-10),Ls=crowdLay(n,10,gw-40,gh*0.5,(top+h/2)/2-10),mk=c.more_at!=null?eIO(ap(t,c.more_at,0.6)):0;
      for(let i=0;i<M;i++){const isN=i<n;if(!isN&&mk<=0)continue;let[x,y,cell]=L(i);if(isN){const[x2,y2,c2]=Ls(i);x=lerp(x2,x,mk);y=lerp(y2,y,mk);cell=lerp(c2,cell,mk)}
        const a0=(c.at||c.t[0])+i*0.02;if(isN&&t<a0)continue;g.save();if(!isN)g.globalAlpha*=mk*(0.5+0.5*hash01(i));person(x-120,y,cell*0.86*(isN?eBack(ap(t,a0,0.3)):1),isN?LB.blue:LB.ghost);g.restore()}
      if(c.count_label){g.font=fD(40);g.fillStyle=LB.blue;g.textAlign="center";g.textBaseline="alphabetic";g.fillText(mk>0.5?String(M):String(n),-120,h/2-6);}
      const bx=w/2-170,bw=140,bh=gh-40,by=top+20,lv=lerp(c.full||0.9,c.low||0.12,eIO(ap(t,c.drain_at!=null?c.drain_at:1e9,1.0))),col=lv<0.3?LB.red:lv<0.55?"#E8A23A":LB.grn;
      rr(g,bx+bw/2-26,by-18,52,22,6);g.fillStyle=LB.ink;g.fill();rr(g,bx,by,bw,bh,22);g.fillStyle=LB.card;g.fill();g.lineWidth=6;g.strokeStyle=LB.ink;g.stroke();
      g.save();rr(g,bx+12,by+12,bw-24,bh-24,14);g.clip();g.fillStyle=col;g.fillRect(bx+12,by+12+(bh-24)*(1-lv),bw-24,(bh-24)*lv);g.restore();
      g.font=fB(800,24);g.fillStyle=LB.ink;g.textAlign="center";g.textBaseline="alphabetic";g.fillText(c.battery_label||"лимиты",bx+bw/2,by+bh+40)}},
  // pricetag: good, good_at, bad, bad_at, comma_at, read, read_at
  // subs: receipt of paid subscriptions; each is crossed out and swapped for a free one. items [{from, show_at, cat, cat_at, sub, sub_at, to, at, feats:[{text,at}], stars:{n,at}}], monthly_at, title
  subs:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660,I=c.items||[],n=I.length,rw=c.rw||360,rx=-w/2,top=-h/2,ra=c.at!=null?c.at:c.t[0];
      let cur=-1;I.forEach((it,i)=>{const sa=it.show_at!=null?it.show_at:(it.at!=null?it.at-1:1e9);if(t>=sa)cur=i});
      g.save();rr(g,rx,top,rw,h,24);g.fillStyle=LB.card;g.fill();g.lineWidth=2;g.strokeStyle=LB.line;g.stroke();g.restore();
      g.textAlign="left";g.textBaseline="alphabetic";g.font=fD(34);g.fillStyle=LB.ink;g.fillText(c.title||"Подписки",rx+26,top+56);
      if(c.monthly_at!=null&&t>=c.monthly_at)popIn(g,t,c.monthly_at,rx+rw-70,top+44,()=>pill(g,rx+rw-18,top+44,"↻ в месяц",{size:18,al:"right",bg:"rgba(255,90,95,0.16)",fg:LB.red,h:34,pad:12}));
      g.save();g.setLineDash([8,8]);g.strokeStyle=LB.line;g.lineWidth=2;g.beginPath();g.moveTo(rx+18,top+82);g.lineTo(rx+rw-18,top+82);g.moveTo(rx+18,top+h-78);g.lineTo(rx+rw-18,top+h-78);g.stroke();g.restore();
      const rh=(h-82-86)/Math.max(1,n);let paid=0;
      I.forEach((it,i)=>{const ri=it.row_at!=null?it.row_at:ra+i*0.18;if(t<ri)return;const sw=it.at!=null&&t>=it.at,ks=sw?eOut3(ap(t,it.at,0.35)):0,ry=top+86+i*rh;if(!sw)paid++;
        slideIn(g,t,ri,-16,0,()=>{if(i===cur){rr(g,rx+10,ry+3,rw-20,rh-6,12);g.fillStyle=LB.dark?"rgba(217,178,91,0.14)":"rgba(43,75,242,0.08)";g.fill();g.lineWidth=2.5;g.strokeStyle=LB.blue;g.stroke()}
          g.textBaseline="middle";g.textAlign="left";g.font=fB(800,26);g.fillStyle=sw?LB.mut:LB.ink;const ny=ry+(sw?rh*0.36:rh*0.5);g.fillText(it.from,rx+26,ny);
          if(sw){const tw=g.measureText(it.from).width;g.strokeStyle=LB.red;g.lineWidth=3;g.beginPath();g.moveTo(rx+24,ny);g.lineTo(rx+24+(tw+4)*ks,ny);g.stroke();g.save();g.globalAlpha*=ks;g.font=fB(800,19);g.fillStyle=LB.grn;g.fillText("→ "+it.to,rx+26,ry+rh*0.76);g.restore()}
          g.textAlign="right";g.font=fM(800,22);g.fillStyle=sw?LB.grn:LB.red;g.fillText(sw?"0 ₽":"₽/мес",rx+rw-22,ry+rh*0.5)},0.3)});
      g.textAlign="left";g.textBaseline="alphabetic";g.font=fB(800,22);g.fillStyle=LB.mut;g.fillText(c.total_label||"платных",rx+26,top+h-30);
      if(t>=ra){g.textAlign="right";g.font=fD(46);g.fillStyle=paid>0?LB.red:LB.grn;g.fillText(String(paid),rx+rw-24,top+h-24)}
      if(cur<0){const IN=c.intro;if(!IN)return;const X0=rx+rw+28,W2=w/2-X0,cx=X0+W2/2;
        popIn(g,t,IN.at,cx,top+150,()=>{g.font=fD(200);g.fillStyle=LB.red;g.textAlign="center";g.textBaseline="alphabetic";g.fillText(IN.big||"9",cx,top+210);g.font=fD(34);g.fillStyle=LB.ink;wrap(g,IN.label||"",W2-40).forEach((l,i)=>g.fillText(l,cx,top+270+i*42))},0.4);
        if(IN.free_at!=null&&t>=IN.free_at)slideIn(g,t,IN.free_at,0,30,()=>{const by=top+370,bh=h/2-by;rr(g,X0,by,W2,bh,22);g.fillStyle=LB.card;g.fill();g.lineWidth=4;g.strokeStyle=LB.blue;g.stroke();g.font=fM(800,20);g.fillStyle=LB.grn;g.textAlign="left";g.textBaseline="alphabetic";g.fillText("GITHUB · 0 ₽",X0+26,by+44);
          g.font=fD(34);g.fillStyle=LB.ink;wrap(g,IN.free_text||"",W2-52).forEach((l,i)=>g.fillText(l,X0+26,by+96+i*42))},0.4);return}
      const it=I[cur],X0=rx+rw+28,W2=w/2-X0,sa=it.show_at!=null?it.show_at:it.at-1,sw=it.at!=null&&t>=it.at,fitName=(s2,max)=>{let fs=max;g.font=fD(fs);while(fs>26&&g.measureText(s2).width>W2-52){fs-=2;g.font=fD(fs)}return fs};
      const fh=214;slideIn(g,t,sa,24,0,()=>{g.save();if(sw)g.globalAlpha*=lerp(1,0.5,ap(t,it.at,0.4));rr(g,X0,top,W2,fh,22);g.fillStyle=LB.card;g.fill();g.lineWidth=3;g.strokeStyle=LB.red;g.stroke();
        g.textAlign="left";g.textBaseline="alphabetic";g.font=fM(800,20);g.fillStyle=LB.red;g.fillText("ПЛАТНО · ↻ КАЖДЫЙ МЕСЯЦ",X0+26,top+44);fitName(it.from,54);g.fillStyle=LB.ink;g.fillText(it.from,X0+26,top+112);
        if(it.cat&&t>=(it.cat_at||sa)){g.font=fB(800,24);g.fillStyle=LB.mut;g.fillText(it.cat,X0+26,top+156)}if(it.sub&&t>=(it.sub_at||sa)){g.font=fB(800,24);g.fillStyle=LB.red;g.fillText(it.sub,X0+26,top+190)}
        if(sw){const k=eOut3(ap(t,it.at,0.35));fitName(it.from,54);const tw=g.measureText(it.from).width;g.globalAlpha=1;g.strokeStyle=LB.red;g.lineWidth=8;g.beginPath();g.moveTo(X0+20,top+96);g.lineTo(X0+20+(tw+14)*k,top+96);g.stroke()}g.restore()},0.35);
      if(!sw)return;const ay=top+fh+12;slideIn(g,t,it.at,0,-10,()=>{g.strokeStyle=LB.blue;g.fillStyle=LB.blue;g.lineWidth=6;g.beginPath();g.moveTo(X0+W2/2,ay);g.lineTo(X0+W2/2,ay+34);g.stroke();g.beginPath();g.moveTo(X0+W2/2-16,ay+28);g.lineTo(X0+W2/2+16,ay+28);g.lineTo(X0+W2/2,ay+46);g.closePath();g.fill()},0.3);
      const ty=ay+60,th=h/2-ty;slideIn(g,t,it.at+0.05,0,30,()=>{rr(g,X0,ty,W2,th,22);g.fillStyle=LB.card;g.fill();g.lineWidth=4;g.strokeStyle=LB.blue;g.stroke();g.textAlign="left";g.textBaseline="alphabetic";g.font=fM(800,20);g.fillStyle=LB.grn;g.fillText("БЕСПЛАТНО · GITHUB",X0+26,ty+42);
        fitName(it.to,54);g.fillStyle=LB.ink;g.fillText(it.to,X0+26,ty+106);let fy=ty+130;const chips=[...(it.feats||[])];
        if(it.stars&&t>=it.stars.at){const k=eOut3(ap(t,it.stars.at,0.9));chips.unshift({text:"★ "+fmtN(it.stars.n*k),at:it.stars.at,star:1})}
        chips.forEach(f=>{if(t<f.at||fy+52>ty+th)return;popIn(g,t,f.at,X0+40,fy+24,()=>pill(g,X0+26,fy+24,f.text,{size:22,al:"left",bg:f.star?LB.blue:LB.soft,fg:f.star?LB.onAcc:LB.ink,h:44,pad:16}),0.3);fy+=54})},0.4)}},
  // voice: rec_at (5-second recording), rec_dur, clone_at, ru_at, ru_text
  voice:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660;labHead(c,w,h,t);const y1=-h/2+(c.title?200:90),x0=-w/2+20;
      if(t>=c.rec_at){const secs=Math.min(5,(t-c.rec_at)/(c.rec_dur||1.2)*5);popIn(g,t,c.rec_at,x0+50,y1,()=>{g.beginPath();g.arc(x0+50,y1,48,0,7);g.fillStyle=LB.red;g.fill();g.fillStyle="#fff";rr(g,x0+40,y1-26,20,36,10);g.fill();g.strokeStyle="#fff";g.lineWidth=4;g.beginPath();g.arc(x0+50,y1-4,18,0.15,Math.PI-0.15);g.stroke();g.beginPath();g.moveTo(x0+50,y1+14);g.lineTo(x0+50,y1+24);g.stroke()},0.3);
        g.font=fM(800,40);g.fillStyle=LB.ink;g.textAlign="left";g.textBaseline="middle";g.fillText("0:0"+Math.floor(secs),x0+118,y1+2);const wx=x0+250,ww=w/2-wx-10,nb=Math.floor(ww/14);
        for(let i=0;i<nb*secs/5;i++){const a=8+hash01(i,4)*38;g.fillStyle=LB.mut;rr(g,wx+i*14,y1-a/2,8,a,4);g.fill()}g.font=fB(800,20);g.fillStyle=LB.mut;g.fillText(c.rec_label||"5 секунд записи",wx,y1+46)}
      if(c.clone_at!=null&&t>=c.clone_at){const y2=y1+200,k=eOut3(ap(t,c.clone_at,0.8));g.save();g.strokeStyle=LB.blue;g.fillStyle=LB.blue;g.lineWidth=6;g.beginPath();g.moveTo(0,y1+62);g.lineTo(0,y1+108);g.stroke();g.beginPath();g.moveTo(-16,y1+102);g.lineTo(16,y1+102);g.lineTo(0,y1+120);g.closePath();g.fill();g.restore();
        g.font=fD(30);g.fillStyle=LB.blue;g.textAlign="left";g.textBaseline="alphabetic";g.fillText(c.clone_label||"клон твоего голоса",x0,y2-70);const nb=Math.floor((w-40)/16);
        for(let i=0;i<nb*k;i++){const a=14+Math.abs(Math.sin(t*7+i*0.55))*44+hash01(i,6)*30;g.fillStyle=LB.blue;rr(g,x0+i*16,y2-a/2,10,a,5);g.fill()}
        if(c.ru_at!=null&&t>=c.ru_at)popIn(g,t,c.ru_at,w/2-200,y2+80,()=>{pill(g,w/2-20,y2+110,c.ru_text||"говорит по-русски",{size:30,al:"right",bg:LB.blue,fg:LB.onAcc,h:64,pad:26});pill(g,-w/2+20,y2+110,"RU",{size:30,al:"left",bg:"rgba(0,0,0,0)",bd:LB.blue,fg:LB.blue,h:64,pad:22})},0.35)}}},
  // inbox: name, name_sub, at, channels [{name, short, color, msg, at}]
  inbox:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660,C=c.channels||[];labHead(c,w,h,t);const top=-h/2+(c.title?100:20),wx=-w/2+250,ww=w/2-wx,wh=h/2-top;
      slideIn(g,t,c.at!=null?c.at:c.t[0]+0.1,20,0,()=>{rr(g,wx,top,ww,wh,22);g.fillStyle=LB.card;g.fill();g.lineWidth=3;g.strokeStyle=LB.blue;g.stroke();g.font=fD(32);g.fillStyle=LB.ink;g.textAlign="left";g.textBaseline="middle";g.fillText(c.name||"Inbox",wx+26,top+40);
        g.font=fB(800,20);g.fillStyle=LB.mut;g.fillText(c.name_sub||"один чат для всех каналов",wx+26,top+74);g.fillStyle=LB.line;g.fillRect(wx,top+98,ww,2)},0.35);
      const rowH=Math.min(110,(wh-110)/Math.max(1,C.length));
      C.forEach((ch,i)=>{if(t<ch.at)return;const by=top+60+i*((wh-60)/Math.max(1,C.length)),bx=-w/2+60,ry=top+112+i*rowH;
        popIn(g,t,ch.at,bx,by,()=>{rr(g,bx-44,by-44,88,88,22);g.fillStyle=ch.color||LB.blue;g.fill();g.font=fD(30);g.fillStyle="#fff";g.textAlign="center";g.textBaseline="middle";g.fillText(ch.short||ch.name[0],bx,by+2);g.font=fB(800,19);g.fillStyle=LB.ink;g.fillText(ch.name,bx,by+64)},0.35);
        const k=eIO(ap(t,ch.at+0.2,0.6));if(k<1){const mx=lerp(bx+50,wx+40,k),my=lerp(by,ry+rowH/2,k);g.save();g.globalAlpha*=cl(k*3);g.beginPath();g.arc(mx,my,12,0,7);g.fillStyle=ch.color||LB.blue;g.fill();g.restore()}
        else slideIn(g,t,ch.at+0.8,12,0,()=>{g.beginPath();g.arc(wx+40,ry+rowH/2,10,0,7);g.fillStyle=ch.color||LB.blue;g.fill();g.textAlign="left";g.textBaseline="middle";g.font=fB(800,19);g.fillStyle=ch.color||LB.blue;g.fillText(ch.name,wx+62,ry+rowH/2-18);g.font=fB(800,26);g.fillStyle=LB.ink;let m=ch.msg||"";while(g.measureText(m).width>ww-90&&m.length>4)m=m.slice(0,-2);g.fillText(m,wx+62,ry+rowH/2+16);g.fillStyle=LB.line;g.fillRect(wx+20,ry+rowH-1,ww-40,1.5)},0.3)})}},
  // paykey: progs [{name, at}], free_at, key_at, pay_at, key_label, flow labels
  paykey:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660,P=c.progs||[];labHead(c,w,h,t);const top=-h/2+(c.title?120:40),pw=360,px=-w/2+10,kx=w/2-280,kw=270,ph=130,ky=top+(P.length*(ph+30)-30)/2-120;
      P.forEach((p2,i)=>{if(t<p2.at)return;const y=top+i*(ph+30);slideIn(g,t,p2.at,-20,0,()=>{rr(g,px,y,pw,ph,20);g.fillStyle=LB.card;g.fill();g.lineWidth=3;g.strokeStyle=LB.line;g.stroke();g.font=fM(800,18);g.fillStyle=LB.mut;g.textAlign="left";g.textBaseline="alphabetic";g.fillText("ПРОГРАММА",px+24,y+38);
        let fs=36;g.font=fD(fs);while(fs>22&&g.measureText(p2.name).width>pw-48){fs-=2;g.font=fD(fs)}g.fillStyle=LB.ink;g.fillText(p2.name,px+24,y+88);if(c.free_at!=null&&t>=c.free_at)popIn(g,t,c.free_at+i*0.1,px+pw-60,y+34,()=>pill(g,px+pw-16,y+36,"0 ₽",{size:22,al:"right",bg:LB.grn,fg:"#fff",h:40,pad:14}),0.3)})});
      if(c.key_at==null||t<c.key_at)return;const kk=ky+20;
      slideIn(g,t,c.key_at,20,0,()=>{rr(g,kx,kk,kw,240,22);g.fillStyle=LB.card;g.fill();g.lineWidth=4;g.strokeStyle=c.pay_at!=null&&t>=c.pay_at?LB.red:LB.blue;g.stroke();const cx=kx+70,cy=kk+80;g.strokeStyle=LB.blue;g.lineWidth=10;g.beginPath();g.arc(cx,cy,24,0,7);g.stroke();g.beginPath();g.moveTo(cx+24,cy);g.lineTo(cx+120,cy);g.moveTo(cx+90,cy);g.lineTo(cx+90,cy+22);g.moveTo(cx+112,cy);g.lineTo(cx+112,cy+18);g.stroke();
        g.font=fD(30);g.fillStyle=LB.ink;g.textAlign="left";g.textBaseline="alphabetic";g.fillText(c.key_label||"API-ключ",kx+24,kk+160);if(c.pay_at!=null&&t>=c.pay_at){g.font=fD(30);g.fillStyle=LB.red;g.fillText(c.pay_label||"платно",kx+24,kk+206)}},0.35);
      const L=c.flow||["генерации","данные"];P.forEach((p2,i)=>{const y=top+i*(ph+30)+ph/2,x1=px+pw,x2=kx;for(let j=0;j<3;j++){const ph2=((t-c.key_at)*0.8+j/3+i*0.17)%1;if(t<c.key_at+0.2)continue;const x=lerp(x1+10,x2-10,ph2),yy=lerp(y,kk+120,ph2);g.beginPath();g.arc(x,yy,9,0,7);g.fillStyle=LB.blue;g.fill()}
        if(t>=c.key_at+0.3)popIn(g,t,c.key_at+0.3+i*0.2,(x1+x2)/2,(y+kk+120)/2-30,()=>pill(g,(x1+x2)/2,(y+kk+120)/2-34,L[i%L.length],{size:20,al:"center",bg:LB.soft,fg:LB.ink,h:38,pad:14}),0.3)});
      if(c.pay_at!=null&&t>=c.pay_at){const nC=Math.min(7,Math.floor((t-c.pay_at)*5)+1);for(let i=0;i<nC;i++){const cy=kk+240+50-i*14;g.save();g.beginPath();g.ellipse(kx+kw/2,cy+30,52,16,0,0,7);g.fillStyle=B.colors.accent||LB.hl;g.fill();g.strokeStyle="#8A6A1E";g.lineWidth=3;g.stroke();g.restore()}
        g.font=fD(28);g.fillStyle="#141414";g.textAlign="center";g.textBaseline="middle";g.fillText("$",kx+kw/2,kk+240+80-(nC-1)*14)}}},
  // claim: text, src, check_at (magnifier), stamps [{text, at, color}], chips [{text, at, good}]
  claim:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660;labHead(c,w,h,t);const cw=w-20,cx=-w/2+10,fsz=c.size||52;g.font=fD(fsz);const L=wrap(g,c.text||"",cw-150),lh=Math.round(fsz*1.2),ch=L.length*lh+120,chH=(c.chips||[]).length*96+40,top=Math.max(-h/2+(c.title||c.kicker?100:30),-(ch+chH)/2);
      slideIn(g,t,c.at!=null?c.at:c.t[0]+0.1,0,20,()=>{rr(g,cx,top,cw,ch,26);g.fillStyle=LB.card;g.fill();g.lineWidth=3;g.strokeStyle=LB.line;g.stroke();g.font=fD(110);g.fillStyle=LB.blue;g.textAlign="left";g.textBaseline="alphabetic";g.fillText("“",cx+22,top+104);
        g.font=fD(fsz);g.fillStyle=LB.ink;L.forEach((l,i)=>g.fillText(l,cx+112,top+80+i*lh));if(c.src){g.font=fB(800,24);g.fillStyle=LB.mut;g.fillText(c.src,cx+112,top+ch-30)}},0.4);
      if(c.check_at!=null&&t>=c.check_at&&t<c.check_at+1.6){const k=eIO(ap(t,c.check_at,1.4)),mx=lerp(cx+120,cx+cw-120,k),my=top+60+Math.sin(k*Math.PI*2)*30;g.save();g.lineWidth=10;g.strokeStyle=LB.blue;g.beginPath();g.arc(mx,my,52,0,7);g.stroke();g.fillStyle=LB.dark?"rgba(217,178,91,0.12)":"rgba(43,75,242,0.08)";g.fill();g.lineWidth=16;g.lineCap="round";g.beginPath();g.moveTo(mx+38,my+38);g.lineTo(mx+80,my+80);g.stroke();g.restore()}
      (c.stamps||[]).forEach((s2,i)=>{if(t<s2.at)return;const kk=ap(t,s2.at,0.25),col=s2.color==="red"?LB.red:s2.color==="green"?LB.grn:LB.blue;g.save();g.globalAlpha*=cl(kk*2);g.translate(s2.x!=null?s2.x:w/2-230,s2.y!=null?s2.y:top+ch-40);g.rotate(-0.08);const sc=lerp(2,1,eOut3(kk));g.scale(sc,sc);g.font=fD(s2.size||50);const tw=g.measureText(s2.text).width;
        rr(g,-tw/2-28,-50,tw+56,100,12);g.fillStyle=LB.stampBg;g.fill();g.lineWidth=8;g.strokeStyle=col;g.stroke();g.fillStyle=col;g.textAlign="center";g.textBaseline="middle";g.fillText(s2.text,0,4);g.restore()});
      let yy=top+ch+70;(c.chips||[]).forEach(cp=>{if(t<cp.at)return;popIn(g,t,cp.at,0,yy,()=>pill(g,0,yy,cp.text,{size:34,al:"center",bg:cp.good===0?LB.red:cp.good?LB.grn:LB.blue,fg:cp.good===0||cp.good?"#fff":LB.onAcc,h:74,pad:30}),0.35);yy+=96})}},
  // steps: points [{label, value, at}], max, unit, strike {idx, at, text}
  steps:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660,P=c.points||[],n=P.length,mx=c.max||Math.max(...P.map(p2=>p2.value));labHead(c,w,h,t);const x0=-w/2+40,x1=w/2-40,y0=h/2-80,y1=-h/2+(c.title?200:110),X=i=>lerp(x0+80,x1-80,n>1?i/(n-1):0.5),Y=v=>lerp(y0,y1,v/mx);
      g.save();g.strokeStyle=LB.line;g.lineWidth=3;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y0);g.stroke();g.restore();
      P.forEach((p2,i)=>{if(t<p2.at)return;const k=eOut3(ap(t,p2.at,0.5)),x=X(i),y=Y(p2.value);if(i>0){const xp=X(i-1),yp=Y(P[i-1].value);g.save();g.strokeStyle=LB.blue;g.lineWidth=7;g.lineCap="round";g.beginPath();g.moveTo(xp,yp);const xm=lerp(xp,x,cl(k*2));g.lineTo(xm,yp);if(k>0.5)g.lineTo(x,lerp(yp,y,cl((k-0.5)*2)));g.stroke();g.restore()}
        popIn(g,t,p2.at+0.1,x,y,()=>{g.beginPath();g.arc(x,y,14,0,7);g.fillStyle=LB.blue;g.fill();g.font=fD(c.vsize||48);g.fillStyle=LB.ink;g.textAlign="center";g.textBaseline="alphabetic";g.fillText(p2.value+(c.unit||""),x,y-30);g.font=fB(800,22);g.fillStyle=LB.mut;g.fillText(p2.label,x,y0+40);
          g.save();g.setLineDash([6,8]);g.strokeStyle=LB.line;g.lineWidth=2;g.beginPath();g.moveTo(x,y+16);g.lineTo(x,y0);g.stroke();g.restore()},0.35)});
      const S=c.strike;if(S&&t>=S.at){const p2=P[S.idx],x=X(S.idx),y=Y(p2.value),k=eOut3(ap(t,S.at,0.3));g.font=fD(c.vsize||48);const tw=g.measureText(p2.value+(c.unit||"")).width;g.strokeStyle=LB.red;g.lineWidth=7;g.beginPath();g.moveTo(x-tw/2-8,y-46);g.lineTo(x-tw/2-8+(tw+16)*k,y-46);g.stroke();
        if(S.text)popIn(g,t,S.at+0.1,x,y-110,()=>pill(g,x,y-110,S.text,{size:24,al:"center",bg:LB.red,fg:"#fff",h:46,pad:16}),0.3)}}},
  // gate: prize, pay_at (coin), open_at, coin, days, check_at, check_step, check_label, check_label_at
  gate:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660;labHead(c,w,h,t);const lx=-w/2+200,ly=-h/2+(c.title?330:250),op=c.open_at!=null&&t>=c.open_at,ko=op?eOut3(ap(t,c.open_at,0.4)):0;
      popIn(g,t,c.at!=null?c.at:c.t[0]+0.15,lx,ly,()=>{g.save();g.lineWidth=22;g.strokeStyle=op?LB.grn:LB.mut;g.beginPath();g.arc(lx,ly-110-ko*44,70,Math.PI,0);g.lineTo(lx+70,ly-110-ko*44+ (op?-0:40));g.moveTo(lx-70,ly-110-ko*44);g.lineTo(lx-70,ly-70);g.stroke();g.restore();
        rr(g,lx-150,ly-90,300,220,26);g.fillStyle=LB.card;g.fill();g.lineWidth=5;g.strokeStyle=op?LB.grn:LB.blue;g.stroke();g.font=fD(40);g.fillStyle=LB.ink;g.textAlign="center";g.textBaseline="middle";g.fillText(c.prize||"25 млн",lx,ly+6);g.font=fB(800,22);g.fillStyle=LB.mut;g.fillText(c.prize_sub||"токенов в день",lx,ly+52);
        g.fillStyle=LB.dark?"#000":"#2A2926";rr(g,lx-40,ly-74,80,12,6);g.fill()},0.4);
      if(c.pay_at!=null&&t>=c.pay_at&&!(t>c.open_at+0.3)){const k=ap(t,c.pay_at,0.5),cy=lerp(ly-330,ly-74,eIO(k));g.save();g.globalAlpha*=1-cl((t-c.open_at)/0.3);g.beginPath();g.arc(lx,cy,46,0,7);g.fillStyle=B.colors.accent||LB.hl;g.fill();g.lineWidth=5;g.strokeStyle="#8A6A1E";g.stroke();g.font=fD(34);g.fillStyle="#141414";g.textAlign="center";g.textBaseline="middle";g.fillText(c.coin||"$5",lx,cy+2);g.restore()}
      if(op)popIn(g,t,c.open_at+0.1,lx,ly+180,()=>pill(g,lx,ly+180,c.open_label||"после пополнения на $5",{size:24,al:"center",bg:LB.grn,fg:"#fff",h:50,pad:18}),0.3);
      if(c.check_at==null||t<c.check_at)return;const D=c.days||7,gx=40,gw=w/2-gx-10,bw=(gw-(D-1)*10)/D,gy=ly-60,names=c.day_names||["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
      for(let i=0;i<D;i++){const x=gx+i*(bw+10),ti=c.check_at+i*(c.check_step||0.2);popIn(g,t,c.check_at+i*0.04,x+bw/2,gy+50,()=>{rr(g,x,gy,bw,110,14);g.fillStyle=LB.card;g.fill();g.lineWidth=2.5;g.strokeStyle=LB.line;g.stroke();g.font=fB(800,18);g.fillStyle=LB.mut;g.textAlign="center";g.textBaseline="middle";g.fillText(names[i%7],x+bw/2,gy+24);
        if(t>=ti){const k=eBack(ap(t,ti,0.3));g.save();g.translate(x+bw/2,gy+70);g.scale(k,k);g.beginPath();g.arc(0,0,20,0,7);g.fillStyle=LB.grn;g.fill();g.strokeStyle="#fff";g.lineWidth=5;g.beginPath();g.moveTo(-9,0);g.lineTo(-2,7);g.lineTo(10,-7);g.stroke();g.restore()}},0.3)}
      if(c.check_label&&t>=(c.check_label_at||c.check_at))popIn(g,t,c.check_label_at||c.check_at,gx+gw/2,gy+170,()=>{g.font=fD(30);g.fillStyle=LB.ink;g.textAlign="center";g.textBaseline="middle";g.fillText(c.check_label,gx+gw/2,gy+170)},0.3)}},
  // tank: total, total_sub, at, models [{name, rate, heavy, at}], heavy_label, heavy_at, low
  tank:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660,M=c.models||[];labHead(c,w,h,t);const top=-h/2+(c.title?110:40),tw=w-40,tx=-w/2+20,a0=c.at!=null?c.at:c.t[0]+0.1;
      let used=0;M.forEach(m=>{if(t>m.at)used+=(t-m.at)*(m.rate||1)});const lv=Math.max(c.low||0.08,1-used*(c.speed||0.06));
      slideIn(g,t,a0,0,-10,()=>{g.font=fD(34);g.fillStyle=LB.ink;g.textAlign="left";g.textBaseline="alphabetic";g.fillText(c.total||"25 млн в день",tx+4,top+30);g.font=fB(800,22);g.fillStyle=LB.mut;g.textAlign="right";g.fillText(c.total_sub||"один лимит на все модели",tx+tw-4,top+28);
        rr(g,tx,top+50,tw,70,22);g.fillStyle=LB.soft;g.fill();g.save();rr(g,tx,top+50,tw,70,22);g.clip();g.fillStyle=lv<0.3?LB.red:LB.blue;g.fillRect(tx,top+50,tw*lv,70);g.restore();rr(g,tx,top+50,tw,70,22);g.lineWidth=3;g.strokeStyle=LB.line;g.stroke();
        },0.35);
      const n=M.length,by=h/2-150,bw=Math.min(240,(tw-(n-1)*30)/n);M.forEach((m,i)=>{if(t<m.at)return;const bx=tx+(tw-(n*bw+(n-1)*30))/2+i*(bw+30),cx=bx+bw/2,col=m.heavy?LB.red:LB.blue,thick=m.heavy?26:10;
        g.save();g.strokeStyle=col;g.globalAlpha*=0.35;g.lineWidth=thick;g.beginPath();g.moveTo(cx,top+120);g.lineTo(cx,by);g.stroke();g.restore();
        const sp=m.heavy?2.4:0.8;for(let j=0;j<(m.heavy?6:3);j++){const ph=((t-m.at)*sp+j/(m.heavy?6:3))%1;g.beginPath();g.arc(cx,lerp(top+124,by-8,ph),thick*0.55,0,7);g.fillStyle=col;g.fill()}
        popIn(g,t,m.at,cx,by+60,()=>{rr(g,bx,by,bw,120,20);g.fillStyle=LB.card;g.fill();g.lineWidth=m.heavy?5:3;g.strokeStyle=m.heavy?LB.red:LB.line;g.stroke();g.font=fD(m.heavy?32:28);g.fillStyle=LB.ink;g.textAlign="center";g.textBaseline="middle";g.fillText(m.name,cx,by+46);g.font=fB(800,20);g.fillStyle=m.heavy?LB.red:LB.mut;g.fillText(m.sub||"",cx,by+86)},0.35)});
      if(c.heavy_at!=null&&t>=c.heavy_at){const i=M.findIndex(m=>m.heavy);if(i>=0){const bx=tx+(tw-(n*bw+(n-1)*30))/2+i*(bw+30)+bw/2;popIn(g,t,c.heavy_at,bx,by-60,()=>pill(g,bx,by-50,c.heavy_label||"тратит в разы быстрее",{size:24,al:"center",bg:LB.red,fg:"#fff",h:50,pad:18}),0.3)}}}},
  // ratelimit: rpm label, at, agent_at, wait_at, wait_label
  ratelimit:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660;labHead(c,w,h,t);const ly=60,gx=120,a0=c.at!=null?c.at:c.t[0]+0.1;
      popIn(g,t,a0,gx,ly-150,()=>{g.fillStyle=LB.blue;rr(g,gx-60,ly-110,16,190,8);g.fill();rr(g,gx+44,ly-110,16,190,8);g.fill();rr(g,gx-90,ly-210,180,84,18);g.fillStyle=LB.card;g.fill();g.lineWidth=4;g.strokeStyle=LB.blue;g.stroke();g.font=fD(40);g.fillStyle=LB.ink;g.textAlign="center";g.textBaseline="middle";g.fillText(c.rpm||"15 / мин",gx,ly-166)},0.35);
      g.fillStyle=LB.line;g.fillRect(-w/2+20,ly+60,w-40,3);
      if(t>=a0){const per=c.period||0.55;for(let j=0;j<12;j++){const ph=((t-a0)/per/6+j/12)%1,x=lerp(gx+30,w/2-20,ph);g.save();g.globalAlpha*=1-ph*0.6;g.beginPath();g.arc(x,ly,13,0,7);g.fillStyle=LB.grn;g.fill();g.restore()}}
      if(c.agent_at!=null&&t>=c.agent_at){const ax=-w/2+80;popIn(g,t,c.agent_at,ax,ly,()=>{person(ax,ly,110,LB.ink,{ai:true});g.font=fB(800,22);g.fillStyle=LB.ink;g.textAlign="center";g.textBaseline="alphabetic";g.fillText(c.agent_label||"агент",ax,ly+96)},0.35);
        const q=Math.min(48,Math.floor((t-c.agent_at)*(c.q_rate||14))),cols=8;for(let i=0;i<q;i++){const r=Math.floor(i/cols),cc=i%cols,x=gx-90-cc*30,y=ly-r*30+(r%2?0:0);if(x<ax+70)continue;g.beginPath();g.arc(x,y,12,0,7);g.fillStyle=i>20?LB.red:LB.blue;g.fill()}}
      if(c.wait_at!=null&&t>=c.wait_at)popIn(g,t,c.wait_at,-120,ly+150,()=>pill(g,-120,ly+150,c.wait_label||"очередь растёт",{size:30,al:"center",bg:LB.red,fg:"#fff",h:64,pad:26}),0.35)}},
  // dossier: rows [{label, value, at}], stamp {text, at}, photo_at
  dossier:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660;labHead(c,w,h,t);const top=-h/2+(c.title?110:40),cx=-w/2+10,cw=w-20,ch=h/2-top,a0=c.at!=null?c.at:c.t[0]+0.1;
      slideIn(g,t,a0,0,20,()=>{rr(g,cx,top,cw,ch,24);g.fillStyle=LB.card;g.fill();g.lineWidth=3;g.strokeStyle=LB.line;g.stroke();rr(g,cx+30,top+30,230,280,16);g.fillStyle=LB.soft;g.fill();person(cx+145,top+190,240,LB.dim);g.font=fD(120);g.fillStyle=LB.blue;g.textAlign="center";g.textBaseline="middle";g.fillText("?",cx+145,top+150)},0.4);
      (c.rows||[]).forEach((r,i)=>{if(t<r.at)return;const ry=top+50+i*96;slideIn(g,t,r.at,14,0,()=>{g.font=fB(800,20);g.fillStyle=LB.mut;g.textAlign="left";g.textBaseline="alphabetic";g.fillText(r.label.toUpperCase(),cx+300,ry+20);g.font=fD(36);g.fillStyle=r.ok?LB.ink:LB.red;g.fillText(r.value,cx+300,ry+64)},0.3)});
      const S=c.stamp;if(S&&t>=S.at){const kk=ap(t,S.at,0.25);g.save();g.globalAlpha*=cl(kk*2);g.translate(S.x!=null?S.x:cx+cw-230,S.y!=null?S.y:top+ch-70);g.rotate(-0.1);const sc=lerp(2,1,eOut3(kk));g.scale(sc,sc);g.font=fD(44);const tw2=g.measureText(S.text).width;rr(g,-tw2/2-26,-44,tw2+52,88,12);g.fillStyle=LB.stampBg;g.fill();g.lineWidth=7;g.strokeStyle=LB.red;g.stroke();g.fillStyle=LB.red;g.textAlign="center";g.textBaseline="middle";g.fillText(S.text,0,4);g.restore()}}},
  // pipe: from, box, to, at, items [{text, at}], see_at, see_label
  pipe:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660,It=c.items||[];labHead(c,w,h,t);const y=40,lx=-w/2+80,rx=w/2-80,a0=c.at!=null?c.at:c.t[0]+0.1;
      g.save();g.strokeStyle=LB.line;g.lineWidth=14;g.lineCap="round";g.beginPath();g.moveTo(lx+60,y);g.lineTo(rx-60,y);g.stroke();g.restore();
      popIn(g,t,a0,lx,y,()=>{person(lx,y+10,130,LB.ink);g.font=fB(800,24);g.fillStyle=LB.ink;g.textAlign="center";g.textBaseline="alphabetic";g.fillText(c.from||"ты",lx,y+110)},0.35);
      popIn(g,t,a0+0.1,rx,y,()=>{for(let i=0;i<3;i++){rr(g,rx-50+i*8,y-60+i*22,100,40,10);g.fillStyle=LB.soft;g.fill();g.lineWidth=2;g.strokeStyle=LB.line;g.stroke()}g.font=fB(800,22);g.fillStyle=LB.mut;g.textAlign="center";g.fillText(c.to||"нейросети",rx,y+110)},0.35);
      It.forEach((it,i)=>{if(t<it.at)return;const k=(t-it.at)/(c.travel||1.6),ph=k%1;if(k<1||c.loop){const x=lerp(lx+60,rx-60,ph);g.save();if(Math.abs(x)<130)g.globalAlpha*=0.15;pill(g,x,y,it.text,{size:24,al:"center",bg:LB.blue,fg:LB.onAcc,h:48,pad:16});g.restore()}});
      popIn(g,t,a0+0.2,0,y,()=>{rr(g,-130,y-120,260,240,26);g.fillStyle=LB.dark?"#0B0B0C":"#17171A";g.fill();g.lineWidth=5;g.strokeStyle=LB.red;g.stroke();g.font=fD(90);g.fillStyle=LB.red;g.textAlign="center";g.textBaseline="middle";g.fillText("?",0,y-14);g.font=fD(28);g.fillStyle="#fff";g.fillText(c.box||"сервис",0,y+76)},0.35);
      let lx2=-w/2+20;const ly2=h/2-40;It.forEach((it,i)=>{if(t<it.at+0.8)return;popIn(g,t,it.at+0.8,lx2+60,ly2,()=>{},0.3);const ww=pill(g,lx2,ly2,"✓ "+it.text,{size:24,al:"left",bg:"rgba(255,90,95,0.16)",fg:LB.red,h:48,pad:16});lx2+=ww+14});
      if(c.see_at!=null&&t>=c.see_at)popIn(g,t,c.see_at,0,y-170,()=>pill(g,0,y-170,c.see_label||"всё проходит через него",{size:26,al:"center",bg:LB.red,fg:"#fff",h:54,pad:20}),0.3)}},
  // vending: at, coin_at, drop_at, label, no {text, at, stamp_at}
  vending:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660;labHead(c,w,h,t);const top=-h/2+(c.title?100:30),mx=-w/2+30,mw=330,mh=h/2-top-10,a0=c.at!=null?c.at:c.t[0]+0.1;
      popIn(g,t,a0,mx+mw/2,top+mh/2,()=>{rr(g,mx,top,mw,mh,26);g.fillStyle=LB.card;g.fill();g.lineWidth=5;g.strokeStyle=LB.blue;g.stroke();rr(g,mx+24,top+24,mw-130,mh-150,14);g.fillStyle=LB.dark?"#121212":"#DDE6EC";g.fill();
        const cols=["#FF5A5F","#D9B25B","#2EBD6B"];for(let r=0;r<4;r++)for(let k=0;k<3;k++){const cx2=mx+50+k*((mw-150)/3),cy2=top+60+r*((mh-200)/4);rr(g,cx2,cy2,36,54,10);g.fillStyle=cols[(r+k)%3];g.fill()}
        rr(g,mx+mw-86,top+60,50,90,10);g.fillStyle=LB.soft;g.fill();g.fillStyle="#141414";rr(g,mx+mw-66,top+80,10,50,5);g.fill();rr(g,mx+40,top+mh-100,mw-80,64,14);g.fillStyle=LB.soft;g.fill();
        g.font=fB(800,18);g.fillStyle=LB.mut;g.textAlign="center";g.textBaseline="middle";g.fillText(c.label||"",mx+mw/2,top+mh-24)},0.4);
      if(c.coin_at!=null&&t>=c.coin_at&&t<c.coin_at+0.9){const k=eIO(ap(t,c.coin_at,0.8)),cx3=lerp(mx+mw+140,mx+mw-61,k),cy3=lerp(top-40,top+105,k);g.beginPath();g.arc(cx3,cy3,40,0,7);g.fillStyle=B.colors.accent||LB.hl;g.fill();g.lineWidth=4;g.strokeStyle="#8A6A1E";g.stroke();g.font=fD(28);g.fillStyle="#141414";g.textAlign="center";g.textBaseline="middle";g.fillText(c.coin||"$5",cx3,cy3+2)}
      if(c.drop_at!=null&&t>=c.drop_at){const k=eBack(ap(t,c.drop_at,0.5));const cy4=lerp(top+60,top+mh-92,cl(k));rr(g,mx+mw/2-22,cy4,44,62,10);g.fillStyle="#D9B25B";g.fill()}
      const N=c.no;if(N&&t>=N.at){const fx=w/2-220,fy=0;slideIn(g,t,N.at,20,0,()=>{g.fillStyle=LB.blue;rr(g,fx-150,fy-120,120,40,10);g.fill();rr(g,fx-150,fy-100,300,220,20);g.fillStyle=LB.card;g.fill();g.lineWidth=4;g.strokeStyle=LB.blue;g.stroke();g.font=fD(30);g.fillStyle=LB.ink;g.textAlign="center";g.textBaseline="middle";
          const L=wrap(g,N.text||"",260);L.forEach((l,i)=>g.fillText(l,fx,fy+10+(i-(L.length-1)/2)*38))},0.35);
        if(N.stamp_at!=null&&t>=N.stamp_at){const k=eOut3(ap(t,N.stamp_at,0.3));g.save();g.lineWidth=16;g.strokeStyle=LB.red;g.lineCap="round";g.globalAlpha*=k;g.beginPath();g.arc(fx,fy+10,170*lerp(1.3,1,k),0,7);g.stroke();g.beginPath();g.moveTo(fx-120,fy+130);g.lineTo(fx+120,fy-110);g.stroke();g.restore();
          popIn(g,t,N.stamp_at+0.1,fx,fy+230,()=>pill(g,fx,fy+230,N.stamp||"не отправляй",{size:30,al:"center",bg:LB.red,fg:"#fff",h:62,pad:24}),0.3)}}}},
  pricetag:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660;labHead(c,w,h,t);const tag=(x,y,txt,col,fs)=>{g.font=fM(800,fs);const tw=g.measureText(txt).width,bw=tw+90,bh=fs*1.9;g.save();g.translate(x,y);g.rotate(-0.04);
        g.beginPath();g.moveTo(-bw/2+40,-bh/2);g.lineTo(bw/2,-bh/2);g.lineTo(bw/2,bh/2);g.lineTo(-bw/2+40,bh/2);g.lineTo(-bw/2,0);g.closePath();g.fillStyle=LB.card;g.fill();g.lineWidth=5;g.strokeStyle=col;g.stroke();g.beginPath();g.arc(-bw/2+30,0,9,0,7);g.fillStyle=col;g.fill();
        g.fillStyle=LB.ink;g.textAlign="left";g.textBaseline="middle";g.fillText(txt,-bw/2+56,4);g.restore();return{tw,bw}};
      const lx=-w/4+10,rx=w/4+20,ty=-40;
      if(c.good_at!=null&&t>=c.good_at){popIn(g,t,c.good_at,lx,ty,()=>{tag(lx,ty,c.good,LB.grn,60)});popIn(g,t,c.good_at+0.3,lx,ty+130,()=>{g.beginPath();g.arc(lx,ty+130,40,0,7);g.fillStyle=LB.grn;g.fill();g.strokeStyle="#fff";g.lineWidth=8;g.beginPath();g.moveTo(lx-17,ty+130);g.lineTo(lx-4,ty+144);g.lineTo(lx+19,ty+118);g.stroke();
        g.font=fB(800,26);g.fillStyle=LB.grn;g.textAlign="center";g.textBaseline="alphabetic";g.fillText(c.good_label||"целое число",lx,ty+210)})}
      if(c.bad_at!=null&&t>=c.bad_at){popIn(g,t,c.bad_at,rx,ty,()=>{const r=tag(rx,ty,c.bad,LB.ink,60);if(c.comma_at!=null&&t>=c.comma_at){const i=c.bad.indexOf(",");g.font=fM(800,60);const ox=g.measureText(c.bad.slice(0,i)).width+g.measureText(",").width/2,cx=rx-r.bw/2+56+ox,k=ap(t,c.comma_at,0.4);
          g.save();g.strokeStyle=LB.red;g.lineWidth=6;g.beginPath();g.arc(cx,ty+18,30,-Math.PI/2,-Math.PI/2+Math.PI*2*eOut3(k));g.stroke();g.restore()}})}
      if(c.read_at!=null&&t>=c.read_at){const k=ap(t,c.read_at,0.4),sh=k<1?Math.sin(k*40)*10*(1-k):0;g.save();g.globalAlpha*=cl(k*2);g.strokeStyle=LB.red;g.fillStyle=LB.red;g.lineWidth=5;g.beginPath();g.moveTo(rx,ty+70);g.lineTo(rx,ty+130);g.stroke();g.beginPath();g.moveTo(rx-12,ty+120);g.lineTo(rx+12,ty+120);g.lineTo(rx,ty+138);g.closePath();g.fill();
        g.font=fB(800,22);g.fillStyle=LB.mut;g.textAlign="center";g.textBaseline="alphabetic";g.fillText(c.read_label||"скилл читает как",rx,ty+170);g.font=fM(800,58);g.fillStyle=LB.red;g.fillText(c.read,rx+sh,ty+240);g.restore()}}},

  chat:{h(c){const w=c.w||860;g.font=fB(700,36);const q=wrap(g,c.q||"",w*0.62).length,a=c.a?wrap(g,c.a,w*0.7).length:0;return 36+(q*46+70)+(a?24+a*46+70:0)+36},
    draw(c,st,t){const w=c.w||860,h=PART.chat.h(c);shadowCard(-w/2,-h/2,w,h,36);g.font=fB(700,36);
      const ql=wrap(g,c.q||"",w*0.62),bw=Math.max(...ql.map(l=>g.measureText(l).width))+60,qh=ql.length*46+70,x1=w/2-36,y0=-h/2+36,t0=atOf(c,0),full=ql.join(" ");
      slideIn(g,t,t0-0.15,30,0,()=>{rr(g,x1-bw,y0,bw,qh,30);g.fillStyle="#141414";g.fill();g.font=fB(700,24);g.fillStyle="#9A958A";g.textAlign="left";g.textBaseline="alphabetic";g.fillText(c.who_q||"Ты",x1-bw+30,y0+38);
        g.font=fB(700,36);g.fillStyle="#fff";let n=typed(full,t,t0,c.cps||30).length;ql.forEach((l,i)=>{const s=l.slice(0,Math.max(0,n));n-=l.length+1;g.fillText(s,x1-bw+30,y0+84+i*46);if(n<0&&n>-l.length-2&&t<t0+full.length/(c.cps||30)+0.6)caret(g,x1-bw+30+g.measureText(s).width,y0+84+i*46,36,t)})});
      if(!c.a)return;const t1=atOf(c,1),al=wrap(g,c.a,w*0.7),aw=Math.max(...al.map(l=>g.measureText(l).width))+60,ah=al.length*46+70,ay=y0+qh+24,x0=-w/2+36;
      slideIn(g,t,t1,-30,0,()=>{rr(g,x0,ay,aw,ah,30);g.fillStyle=SOFT;g.fill();g.font=fB(700,24);g.fillStyle=B.colors.card_accent;g.textAlign="left";g.textBaseline="alphabetic";g.fillText(c.who_a||"Claude",x0+30,ay+38);
        if(t<t1+0.55){for(let i=0;i<3;i++){g.beginPath();g.arc(x0+44+i*26,ay+80,8+3*Math.max(0,Math.sin(t*9-i)),0,7);g.fillStyle="#B9B3A6";g.fill()}return}
        g.globalAlpha*=ap(t,t1+0.55,0.3);g.font=fB(700,36);g.fillStyle=B.colors.card_text;al.forEach((l,i)=>g.fillText(l,x0+30,ay+84+i*46))})}},
  // prompt: attached video, the command is typed into an input field, send, "working…" → ✓ status
  prompt:{h(c){const P=prLay(c);return 40+(c.file?172:0)+P.fh+18+(c.status?100:0)+32},
    draw(c,st,t){const P=prLay(c),w=P.w,h=PART.prompt.h(c),q=String(c.q||""),cps=c.cps||22,t0=atOf(c,0),t1=c.at&&c.at[1]!=null?c.at[1]:t0+q.length/cps+0.3,x0=-w/2+34;
      shadowCard(-w/2,-h/2,w,h,44);let y=-h/2+40;
      if(c.file){const im=imgOf(c.file);rr(g,x0,y,480,150,26);g.fillStyle=SOFT;g.fill();
        g.save();rr(g,x0+14,y+13,94,124,16);g.clip();g.fillStyle="#222";g.fill();if(im)cover(g,im,x0+14,y+13,94,124);if(c.file_play!==false){g.fillStyle="rgba(0,0,0,0.28)";g.fillRect(x0+14,y+13,94,124)}g.restore();
        if(c.file_play!==false){g.fillStyle="#fff";g.beginPath();g.moveTo(x0+50,y+57);g.lineTo(x0+50,y+93);g.lineTo(x0+80,y+75);g.closePath();g.fill()}
        g.textAlign="left";g.textBaseline="alphabetic";g.font=fB(800,38);g.fillStyle=B.colors.card_text;g.fillText(c.file_label||"video.mov",x0+132,y+66);
        g.font=fB(700,30);g.fillStyle=MUT;g.fillText(c.file_sub||"видео",x0+132,y+110);y+=172}
      const fw=P.fw,fh=P.fh,fs=P.fs,typing=t>=t0-0.05&&t<t1;rr(g,x0,y,fw,fh,Math.min(64,fh/2));g.fillStyle="#FFFFFF";g.fill();g.lineWidth=typing?5:3;g.strokeStyle=typing?B.colors.ui:"rgba(0,0,0,0.14)";g.stroke();
      const n=typed(q,t,t0,cps).length;g.textAlign="left";g.textBaseline="middle";const ly=i=>P.L.length>1?y+30+fs*0.61+i*fs*1.22:y+fh/2+2;
      if(!n){g.font=fB(700,Math.round(fs*(P.L.length>1?0.9:0.72)));g.fillStyle="#B5AFA3";g.fillText(c.hint||"Напиши, что сделать…",x0+48,ly(0));if(t<t1)caret(g,x0+44,ly(0)+fs*0.38,fs,t)}
      else{g.font=fB(800,fs);g.fillStyle=B.colors.card_text;let k=0,car=null;P.L.forEach((l,i)=>{const part=l.slice(0,Math.max(0,n-k));if(part.length)g.fillText(part,x0+48,ly(i));if(n>=k&&n<=k+l.length)car=[x0+48+g.measureText(part).width,ly(i)];k+=l.length+1});
        if(t<t1&&car)caret(g,car[0],car[1]+fs*0.38,fs,t)}
      const bx=x0+fw-70,by=y+fh-64,pr=t>=t1&&t<t1+0.16?0.84:1;g.save();g.translate(bx,by);g.scale(pr,pr);g.beginPath();g.arc(0,0,48,0,7);g.fillStyle=n?"#141414":"#D9D4CA";g.fill();
      g.strokeStyle="#fff";g.lineWidth=8;g.lineCap="round";g.lineJoin="round";g.beginPath();g.moveTo(0,19);g.lineTo(0,-18);g.moveTo(-16,-2);g.lineTo(0,-19);g.lineTo(16,-2);g.stroke();g.restore();y+=fh+18;
      if(c.status&&t>=t1+0.08){const d=t-t1-0.08,wk=c.work!=null?c.work:0.45,cy=y+44;g.save();g.globalAlpha*=cl(d/0.15);g.textAlign="left";g.textBaseline="middle";
        if(d<wk){for(let i=0;i<3;i++){g.beginPath();g.arc(x0+26+i*30,cy,9+4*Math.max(0,Math.sin(t*9-i)),0,7);g.fillStyle="#B9B3A6";g.fill()}g.font=fB(700,38);g.fillStyle=MUT;g.fillText(c.working||"Монтирую…",x0+120,cy+2)}
        else{const k=ap(t,t1+0.08+wk,0.3);g.beginPath();g.arc(x0+32,cy,30*eBack(k),0,7);g.fillStyle=GREEN;g.fill();check(g,x0+32,cy+1,30,"#fff");g.font=fB(800,40);g.fillStyle=B.colors.card_text;g.fillText(c.status,x0+82,cy+2)}
        g.restore()}}},
  // gallery: a grid of pictures popping in one by one on words, with an optional label and number on each
  gallery:{h(c){return galLay(c).h},
    draw(c,st,t){const L=galLay(c),fs=c.files||[],lb=c.labels||[],nb=c.numbers;
      fs.forEach((f,i)=>{const r=Math.floor(i/L.cols),inRow=Math.min(L.cols,L.n-r*L.cols),col=i-r*L.cols,rowW=inRow*L.tw+(inRow-1)*L.gap,
        x=-rowW/2+col*(L.tw+L.gap),y=-L.h/2+r*(L.th+L.gap),k=ap(t,atOf(c,i,0.12),0.35);if(k<=0)return;
        g.save();g.translate(x+L.tw/2,y+L.th/2);const z=lerp(0.55,1,eBack(k));g.scale(z,z);g.globalAlpha*=cl(k*2.5);
        g.save();g.shadowColor="rgba(0,0,0,0.4)";g.shadowBlur=24;g.shadowOffsetY=8;rr(g,-L.tw/2,-L.th/2,L.tw,L.th,18);g.fillStyle="#fff";g.fill();g.restore();
        g.save();rr(g,-L.tw/2,-L.th/2,L.tw,L.th,18);g.clip();const im=imgOf(f);if(im)cover(g,im,-L.tw/2,-L.th/2,L.tw,L.th);g.restore();
        if(lb[i]){g.font=fB(800,Math.round(L.tw*0.14));const tw=g.measureText(lb[i]).width+28,bh=Math.round(L.tw*0.2);rr(g,-tw/2,L.th/2-bh-12,tw,bh,bh/2);g.fillStyle="rgba(15,15,18,0.82)";g.fill();g.fillStyle="#fff";g.textAlign="center";g.textBaseline="middle";g.fillText(lb[i],0,L.th/2-bh/2-11)}
        if(nb){const R=Math.round(L.tw*0.15);g.beginPath();g.arc(-L.tw/2+R+10,-L.th/2+R+10,R,0,7);g.fillStyle=B.colors.accent;g.fill();g.font=fB(900,Math.round(R*1.15));g.fillStyle="#141414";g.textAlign="center";g.textBaseline="middle";g.fillText(typeof nb==="string"?nb.replace("#",i+1):String(i+1),-L.tw/2+R+10,-L.th/2+R+12)}
        g.restore()})}},
  // toggle: a segmented switch (e.g. «Чат | Работа»), the knob slides to another option at at[0]
  toggle:{h(c){return c.label?236:180},
    draw(c,st,t){const w=c.w||760,h=PART.toggle.h(c),O=c.options||["Чат","Работа"],n=O.length;shadowCard(-w/2,-h/2,w,h,40);let y=-h/2+40;
      if(c.label){g.font=fB(700,30);g.fillStyle=MUT;g.textAlign="left";g.textBaseline="middle";g.fillText(c.label,-w/2+40,y+14);y+=56}
      const tx=-w/2+30,tw=w-60,th=100,sw=tw/n,from=c.from||0,to=c.to!=null?c.to:n-1,t0=atOf(c,0),pos=lerp(from,to,eOut3(ap(t,t0,0.35)));
      rr(g,tx,y,tw,th,50);g.fillStyle=SOFT;g.fill();
      g.save();g.shadowColor="rgba(0,0,0,0.18)";g.shadowBlur=14;g.shadowOffsetY=4;rr(g,tx+6+pos*sw,y+6,sw-12,th-12,44);g.fillStyle="#141414";g.fill();g.restore();
      O.forEach((o,i)=>{g.font=fB(800,44);g.textAlign="center";g.textBaseline="middle";g.fillStyle=Math.abs(pos-i)<0.5?"#FFFFFF":MUT;g.fillText(o,tx+sw*(i+0.5),y+th/2+2)});
      const tt=t-t0;if(tt>-0.02&&tt<0.55){const r=cl(tt/0.55);g.beginPath();g.arc(tx+sw*(to+0.5),y+th/2,34+80*r,0,7);g.lineWidth=6;g.strokeStyle=`rgba(255,207,77,${1-r})`;g.stroke()}}},
  search:{h(c){return 32+96+18+(c.status?78:0)+(c.rows||[]).length*112+22},
    draw(c,st,t){const w=c.w||860,h=PART.search.h(c);shadowCard(-w/2,-h/2,w,h,36);let y=-h/2+32;const t0=atOf(c,0);
      rr(g,-w/2+30,y,w-60,96,48);g.fillStyle=SOFT;g.fill();g.save();g.strokeStyle="#141414";g.lineWidth=6;g.beginPath();g.arc(-w/2+86,y+44,16,0,7);g.moveTo(-w/2+98,y+57);g.lineTo(-w/2+112,y+71);g.stroke();g.restore();
      g.font=fB(700,36);g.fillStyle=B.colors.card_text;g.textAlign="left";g.textBaseline="middle";const q=typed(c.q||"",t,t0,c.cps||30);g.fillText(q,-w/2+136,y+49);if(q.length<String(c.q||"").length||t<t0+String(c.q||"").length/30+0.5)caret(g,-w/2+136+g.measureText(q).width,y+62,36,t);y+=96+18;
      if(c.status){const t1=atOf(c,1),k=eOut3((t-t1)/1.6);if(t>=t1){g.globalAlpha*=1;g.font=fB(700,30);g.fillStyle=MUT;g.fillText(c.status,-w/2+40,y+24);g.font=fK(900,38);g.textAlign="right";g.fillStyle=B.colors.card_accent;g.fillText(fmtN((c.count||40)*k),w/2-40,y+24);
        rr(g,-w/2+40,y+52,w-80,14,7);g.fillStyle="rgba(0,0,0,0.08)";g.fill();rr(g,-w/2+40,y+52,(w-80)*Math.max(0.02,k),14,7);g.fillStyle=B.colors.ui;g.fill()}y+=78}
      (c.rows||[]).forEach((r,i)=>{const ti=atOf(c,i+(c.status?2:1));slideIn(g,t,ti,40,0,()=>{rr(g,-w/2+30,y+i*112,w-60,96,22);g.fillStyle="#F7F5F0";g.fill();g.beginPath();g.arc(-w/2+82,y+i*112+48,20,0,7);g.fillStyle=[B.colors.ui,B.colors.card_accent,GREEN][i%3];g.fill();
        g.textAlign="left";g.textBaseline="alphabetic";g.font=fB(800,34);g.fillStyle=B.colors.card_text;g.fillText(r[0],-w/2+124,y+i*112+44);if(r[1]){g.font=fB(700,26);g.fillStyle=MUT;g.fillText(r[1],-w/2+124,y+i*112+78)}})})}},
  checklist:{h(c){return (c.title?112:30)+clRows(c).reduce((s,r)=>s+r.h,0)+26},
    draw(c,st,t){const w=c.w||860,h=PART.checklist.h(c),fs=c.fs||36,R=clRows(c);shadowCard(-w/2,-h/2,w,h,30);const head=headBar(g,w,h,c.title)||30;let yy=-h/2+head;
      (c.items||[]).forEach((it,i)=>{const ti=atOf(c,i,0.45),k=ap(t,ti,0.3),r=R[i],y=yy+r.h/2-2;yy+=r.h;g.beginPath();g.arc(-w/2+70,y,24,0,7);g.lineWidth=4;g.strokeStyle=k>0?GREEN:"#C9C3B6";g.stroke();
        if(k>0){g.beginPath();g.arc(-w/2+70,y,24*eBack(k),0,7);g.fillStyle=GREEN;g.fill();g.save();g.beginPath();g.rect(-w/2+40,y-30,60*cl(k*1.4),60);g.clip();check(g,-w/2+70,y+1,26,"#fff");g.restore()}
        g.font=fB(800,fs);g.textAlign="left";g.textBaseline="middle";g.fillStyle=k>0?B.colors.card_text:"#9A958A";
        if(r.L.length>1)r.L.forEach((l,j)=>g.fillText(l,-w/2+118,y+2+(j-(r.L.length-1)/2)*fs*1.16));
        else{fit(g,s=>fB(800,s),[plain(it)],w-170,fs,0.55,"checklist");richLine(g,it,-w/2+118,y+2,k>0?B.colors.card_text:"#9A958A",B.colors.card_accent,"left")}})}},
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
    draw(c,st,t){const fs=(c.files||[]).slice(0,5),n=fs.length||1,rot=[-8,5,-3,7,-5],sk=n>4?0.86:1,span=Math.min(860,n*250+60),pw=290*sk;
      fs.forEach((f,i)=>{const x=n===1?0:-span/2+pw/2+i*(span-pw)/(n-1),ti=atOf(c,i,0.3),k=ap(t,ti,0.45);if(k<=0)return;g.save();if(c.from){const e=eBack(k),z=lerp(0.25,1,eOut3(k));g.translate(lerp(c.from[0],x,e),lerp(c.from[1],0,e));g.rotate((rot[i%5]*e+(1-k)*-30)*Math.PI/180);g.scale(sk*z,sk*z)}
        else{g.translate(x,lerp(-160,0,eBack(k)));g.rotate((rot[i%5]+(1-k)*14)*Math.PI/180);g.scale(sk,sk)}g.globalAlpha*=cl(k*2);
        g.shadowColor="rgba(0,0,0,0.4)";g.shadowBlur=30;g.shadowOffsetY=12;g.fillStyle="#FBFAF6";g.fillRect(-145,-180,290,350);g.shadowColor="transparent";cover(g,imgOf(f),-129,-164,258,258);
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
        pill(g,x+24,-h/2+40,lb[acc?1:0],{size:24,bg:acc?B.colors.ui:"#E4E0D7",h:44,pad:16});if(!o.file){let fz=46;g.font=fK(900,fz);const lim=o.sub?h/2-104:h/2-34,bad=()=>{const L=wrap(g,o.title||"",cw-60);return L.length>3||L.some(l=>g.measureText(plain(l)).width>cw-60)||-h/2+130+(L.length-1)*Math.round(fz*1.2)>lim};while(fz>24&&bad()){fz-=2;g.font=fK(900,fz)}g.fillStyle=acc?B.colors.card_text:"#8F8A80";g.textAlign="left";g.textBaseline="alphabetic";
          wrap(g,o.title||"",cw-60).slice(0,3).forEach((l,i)=>g.fillText(l,x+30,-h/2+130+i*Math.round(fz*1.2)));if(o.sub){g.font=fB(700,28);g.fillStyle=MUT;wrap(g,o.sub,cw-60).slice(0,2).forEach((l,i)=>g.fillText(l,x+30,h/2-70+i*36))}}};
      side(c.before||{},-w/2,false);const k=ap(t,ta,0.5);if(k>0){g.save();g.beginPath();g.rect(-w/2+cw+24,-h/2-40,cw*eOut3(k)+4,h+80);g.clip();side(c.after||{},-w/2+cw+24,true);g.restore()}}},
  quote:{h(c){const w=c.w||860;return 120+textH(fK(900,52),c.text||"",w-120,64)+(c.author?60:20)},
    draw(c,st,t){const w=c.w||860,h=PART.quote.h(c);shadowCard(-w/2,-h/2,w,h,36);g.font=`900 160px ${KFN}, ${BFN}`;g.fillStyle=B.colors.ui;g.textAlign="left";g.textBaseline="alphabetic";g.fillText("“",-w/2+36,-h/2+150);
      g.font=fK(900,52);const L=wrap(g,c.text||"",w-120);L.forEach((l,i)=>{g.save();g.globalAlpha*=ap(t,c.t[0]+0.15+i*0.18,0.3);richLine(g,cs(l),-w/2+60,-h/2+110+i*64,B.colors.card_text,B.colors.card_accent,"left");g.restore()});
      if(c.author){g.font=fB(700,30);g.fillStyle=MUT;g.textAlign="left";g.fillText("— "+c.author,-w/2+60,h/2-36)}}},
  word:{h(c){return Math.round((c.size||190)*1.15)},
    draw(c,st,t){const txt=cs(c.text||""),fx=c.fx||"pop",d=st.d;let fs=c.fit===false?(c.size||190):fit(g,s=>fK(900,s),[txt],960,c.size||190,0.4,"word");g.save();
      if(fx==="shake"){const k=eBack(d/0.35);g.scale(k,k);if(d>0.35)g.translate(Math.sin(t*47)*6,Math.cos(t*39)*5)}else if(fx==="slam"){const k=cl(d/0.22),s=lerp(2.4,1,eOut3(k))+(k>=1?0.06*Math.exp(-(d-0.22)*9)*Math.sin((d-0.22)*40):0);g.scale(s,s)}
      else if(fx==="stretch"){g.scale(1+0.08*Math.sin(d*6),1-0.05*Math.sin(d*6))}else{const k=eBack(d/0.4);g.scale(k,k)}
      g.font=fK(900,fs);g.textAlign="center";g.textBaseline="middle";g.lineJoin="round";
      if(c.alpha!=null){g.globalAlpha*=c.alpha;g.shadowColor="rgba(0,0,0,0.25)";g.shadowBlur=40}else{g.lineWidth=fs*0.12;g.strokeStyle="#141414";g.strokeText(txt,0,0);g.shadowColor="rgba(0,0,0,0.5)";g.shadowBlur=30}
      g.fillStyle=c.color||B.colors.accent;g.fillText(txt,0,0);g.restore()}},
  hub:{h(c){return 600},
    draw(c,st,t){const w=c.w||900,h=600;shadowCard(-w/2,-h/2,w,h,36);const N=c.nodes||[],cx=0,cy=-20;
      N.forEach((nd,i)=>{const an=-Math.PI/2+i*2*Math.PI/Math.max(1,N.length)+Math.PI/Math.max(1,N.length),x=cx+Math.cos(an)*300,y=cy+Math.sin(an)*190,ti=atOf(c,i,0.25),k=ap(t,ti,0.4);if(k<=0)return;
        g.save();g.globalAlpha*=cl(k*2);g.strokeStyle=t>(c.glow_at!=null?c.glow_at:1e9)?B.colors.ui:"rgba(0,0,0,0.18)";g.lineWidth=4;g.beginPath();g.moveTo(cx,cy);g.lineTo(lerp(cx,x,eOut3(k)),lerp(cy,y,eOut3(k)));g.stroke();g.restore();
        popIn(g,t,ti+0.1,x,y,()=>{rr(g,x-86,y-56,172,112,22);g.fillStyle="#F7F5F0";g.fill();g.lineWidth=2;g.strokeStyle="rgba(0,0,0,0.1)";g.stroke();g.textAlign="center";g.textBaseline="middle";
          if(nd[1]){g.font=`44px ${EMO}`;g.fillText(nd[1],x,y-14)}else{g.beginPath();g.arc(x,y-16,22,0,7);g.fillStyle=B.colors.ui;g.fill();g.font=fK(900,24);g.fillStyle="#141414";g.fillText(String(nd[0])[0].toUpperCase(),x,y-14)}g.font=fB(800,24);g.fillStyle=B.colors.card_text;g.fillText(nd[0],x,y+30)})});
      popIn(g,t,c.t[0]+0.2,cx,cy,()=>{g.beginPath();g.arc(cx,cy,92,0,7);g.fillStyle="#141414";g.fill();g.lineWidth=6;g.strokeStyle=B.colors.ui;g.stroke();g.font=fK(900,36);g.fillStyle="#fff";g.textAlign="center";g.textBaseline="middle";g.fillText(c.center||"Claude",cx,cy+2)});
      if(c.count){const tc=c.count_at!=null?c.count_at:atOf(c,N.length,0.25),m=String(c.count).match(/^(\D*?)(\d(?:[\d\s]*\d)?)(.*)$/),k=eOut3((t-tc)/1.0);
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
  window:{h(c){return c.h||660},
    draw(c,st,t){const w=c.w||940,h=c.h||660,T=winTheme(c),bh=64;g.save();
      const cam=winAt(c.cam,t,3);g.beginPath();g.rect(-w/2-40,-h/2-40,w+80,h+80);g.clip();if(cam){const[s2,fx,fy]=cam;g.translate(-fx*(s2-1),-fy*(s2-1));g.scale(s2,s2)}
      shadowCard(-w/2,-h/2,w,h,26,T.bg);g.save();rr(g,-w/2,-h/2,w,h,26);g.clip();g.fillStyle=T.bar;g.fillRect(-w/2,-h/2,w,bh);g.fillStyle=T.line;g.fillRect(-w/2,-h/2+bh,w,2);
      ["#FF5F57","#FEBC2E","#28C840"].forEach((col,i)=>{g.beginPath();g.arc(-w/2+34+i*28,-h/2+bh/2,9,0,7);g.fillStyle=col;g.fill()});
      g.textBaseline="middle";if(c.kind==="browser"){const ux=-w/2+130,uw=w-130-(c.tag?170:30);rr(g,ux,-h/2+12,uw,40,20);g.fillStyle=T.dark?"#1F1E1C":"#FFFFFF";g.fill();
        g.fillStyle=T.mu;g.beginPath();g.arc(ux+24,-h/2+bh/2,6,0,7);g.fill();g.font=fB(700,24);g.textAlign="left";g.fillStyle=T.tx;const u=c.url_at!=null?typed(c.url||"",t,c.url_at,c.url_cps||20):(c.url||"");g.fillText(u,ux+44,-h/2+bh/2+1);
        if(c.url_at!=null&&u.length<String(c.url||"").length)caret(g,ux+44+g.measureText(u).width,-h/2+bh/2+11,24,t)}
      else{g.font=fB(800,24);g.textAlign="center";g.fillStyle=T.mu;g.fillText(c.title||(c.kind==="file"?"SKILL.md":"Claude Code"),0,-h/2+bh/2+1);if(c.kind==="claude"){const ax=-g.measureText(c.title||"Claude Code").width/2-34,ay=-h/2+bh/2;g.save();g.strokeStyle=B.colors.ui;g.lineWidth=4;g.lineCap="round";for(let i=0;i<4;i++){const an=i*Math.PI/4;g.beginPath();g.moveTo(ax-Math.cos(an)*11,ay-Math.sin(an)*11);g.lineTo(ax+Math.cos(an)*11,ay+Math.sin(an)*11);g.stroke()}g.restore()}}
      if(c.tag){g.font=fB(800,20);g.textAlign="right";pill(g,w/2-24,-h/2+bh/2,c.tag,{size:20,al:"right",bg:"rgba(0,0,0,0)",bd:T.mu,fg:T.mu,h:34,pad:14})}
      const z=c.zoom||1.2,x0=-w/2+36,cw=(w-72)/z,y0=-h/2+bh+22,vh=(h-bh-44)/z;let tot=0;const vis=[];
      for(const b of (c.blocks||[])){if(b.at==null||t<b.at-0.001)continue;if(b.until!=null&&t>b.until+0.3)continue;const bh2=wbH(b,cw),kk=eOut3((t-b.at)/0.32),hh=bh2*kk;vis.push([b,tot,kk]);tot+=hh+(b.k==="gap"?0:8)}
      const off=Math.max(0,tot-vh);g.save();g.beginPath();g.rect(-w/2,y0-10,w,vh*z+20);g.clip();g.translate(x0,y0);g.scale(z,z);
      for(const[b,yy,kk]of vis){const out=b.until!=null&&t>b.until?1-cl((t-b.until)/0.3):1;g.save();g.globalAlpha*=cl(kk*1.4)*out;wbDraw(b,0,yy-off+(1-kk)*16,cw,t,T);g.restore()}g.restore();
      if(off>2){const fg=g.createLinearGradient(0,y0-10,0,y0+40);fg.addColorStop(0,T.bg);fg.addColorStop(1,T.bg+"00");g.fillStyle=fg;g.fillRect(-w/2,y0-10,w,50)}
      if(c.stamp&&t>=c.stamp.at){const kk=ap(t,c.stamp.at,0.25);g.save();g.globalAlpha*=cl(kk*2);g.translate(0,c.stamp.y||40);g.rotate(-0.1);const s3=lerp(2,1,eOut3(kk));g.scale(s3,s3);g.font=fK(900,c.stamp.size||72);const tw=g.measureText(c.stamp.text).width;
        g.lineWidth=8;g.strokeStyle=c.stamp.color||RED;rr(g,-tw/2-30,-56,tw+60,112,12);g.fillStyle="rgba(255,255,255,0.9)";g.fill();g.stroke();g.fillStyle=c.stamp.color||RED;g.textAlign="center";g.textBaseline="middle";g.fillText(c.stamp.text,0,4);g.restore()}
      g.restore();
      const cu=winAt(c.cursor,t,2);if(cu&&c.cursor&&t>=c.cursor[0][0]-0.2){const[cx,cy]=cu;for(const k2 of c.cursor){if(k2[3]&&t>=k2[0]&&t<k2[0]+0.5){const kk=(t-k2[0])/0.5;g.beginPath();g.arc(k2[1],k2[2],10+40*kk,0,7);g.strokeStyle=`rgba(217,178,91,${1-kk})`;g.lineWidth=5;g.stroke()}}
        g.save();g.translate(cx,cy);g.beginPath();g.moveTo(0,0);g.lineTo(0,40);g.lineTo(10,30);g.lineTo(18,48);g.lineTo(25,45);g.lineTo(17,27);g.lineTo(30,27);g.closePath();g.fillStyle="#fff";g.fill();g.lineWidth=3;g.strokeStyle="#141414";g.stroke();g.restore()}
      g.restore()}},
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
function drawScene(sh,t,alpha){const S=sh.scene||{},keep=g;g=p;p.save();p.globalAlpha=alpha;
  if(FL)flBg(t);else if(PN){p.fillStyle=PN.bg||"#F7F4EC";p.fillRect(CX,CY,CW,CH);if(PN.grid){p.strokeStyle="rgba(23,23,26,0.055)";p.lineWidth=1.5;for(let v=CX+20;v<CX+CW;v+=40){p.beginPath();p.moveTo(v,CY);p.lineTo(v,CY+CH);p.stroke()}for(let v=CY+20;v<CY+CH;v+=40){p.beginPath();p.moveTo(CX,v);p.lineTo(CX+CW,v);p.stroke()}}}else{p.fillStyle=B.colors.panel_bg;p.fillRect(CX,CY,CW,CH);
    const gr=p.createRadialGradient(CX+CW/2,CY+CH*0.6,20,CX+CW/2,CY+CH*0.6,CW*0.8);gr.addColorStop(0,B.colors.panel_glow+"30");gr.addColorStop(1,B.colors.panel_glow+"00");p.fillStyle=gr;p.fillRect(CX,CY,CW,CH)}
  const d=t-sh.t[0],tagAt=S.tag_at!=null?S.tag_at:sh.t[0]+0.3;let top=CY+(S.pad_top!=null?S.pad_top:34);
  if(FL){   // big header on the left: title, tag under it
    if(S.title)slideIn(p,t,sh.t[0]+0.05,0,-20,()=>{p.textAlign="left";p.textBaseline="alphabetic";const fs=fit(p,s=>fK(900,s),[plain(S.title)],CW-40,80,0.6,"scene title");p.font=fK(900,fs);richLine(p,cs(S.title),CX+16,CY+76,"#FFFFFF",B.colors.accent,"left")});
    if(S.tag)popIn(p,t,tagAt,CX+150,CY+140,()=>pill(p,CX+16,CY+140,S.tag,{size:28,al:"left",bg:"rgba(0,0,0,0)",bd:B.colors.ui,fg:B.colors.ui}));
    if(S.title||S.tag)top=Math.max(top,CY+(S.tag?196:120))}
  else{if(S.title){slideIn(p,t,sh.t[0]+0.05,0,-16,()=>{p.font=fK(900,50);p.textAlign="left";p.textBaseline="alphabetic";fit(p,s=>fK(900,s),[plain(S.title)],CW-360,50,0.6,"scene title");richLine(p,cs(S.title),CX+40,top+52,"#FFFFFF",B.colors.accent,"left")});top+=88}
    if(S.tag)popIn(p,t,tagAt,CX+CW-120,CY+70,()=>pill(p,CX+CW-36,CY+70,S.tag,{size:26,al:"right",bg:"rgba(0,0,0,0)",bd:B.colors.ui,fg:B.colors.ui}))}
  const body=S.body||[],bot=CY+CH-(S.foot?(FL?64:54):26),avail=bot-top,gap=FL?34:22;let tot=body.reduce((s,c)=>s+PART_H(c),0)+gap*Math.max(0,body.length-1),mw=Math.max(...body.map(c=>c.w||(c.type==="hub"||c.type==="site"||c.type==="beforeafter"?900:c.type==="window"?940:860)),1);
  const sc=Math.min(FL?1.12:1,(CW-(FL?30:60))/mw,avail/Math.max(1,tot));let y=top+(avail-tot*sc)/2;
  for(const c of body){const hh=PART_H(c)*sc,t0=c.show_at!=null?c.show_at:sh.t[0]+0.15,cc=c.t?c:Object.assign(c,{t:[t0,sh.t[1]]}),k=cc.t[0]<=0.05?1:ap(t,cc.t[0],0.4);
    if(k>0){p.save();p.globalAlpha*=cl(k*1.6);p.translate(CX+CW/2,y+hh/2+(1-eOut3(k))*24);p.scale(sc,sc);const f=CARD[c.type];if(f)f(cc,{a:1,s:1,d:t-cc.t[0]},t);else warn("unknown part "+c.type);p.restore()}y+=hh+gap*sc}
  if(S.foot)slideIn(p,t,sh.t[0]+0.6,0,10,()=>{p.font=fB(700,FL?28:24);p.fillStyle="rgba(255,255,255,0.55)";p.textAlign="center";p.textBaseline="alphabetic";p.fillText(S.foot,CX+CW/2,CY+CH-(FL?18:22))});
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
  const h=cardH(c),cy=c.y!=null?c.y:FL?CY+CH/2:B.cards.top+h/2;if(!FL&&c.y==null&&c.type!=="sticker"&&st.a>0.5)CARD_BOTTOM=Math.max(CARD_BOTTOM,cy+h/2);
  g.save();g.globalAlpha=st.a;g.translate(c.x||540,cy+(1-eOut3(st.d/0.42))*40);g.scale(st.s,st.s);f(c,st,t);g.restore()}}

// ---------- hook + subtitles ----------
function hook(t,k){const hk=TL.hook;if(!hk||!hk.lines||!hk.lines.length)return;let end=hk.t1||2.5;if(!FL)for(const[a]of TL.split||[])if(a>0.3&&a<end)end=a;
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
async function frame(t){
  if(FL){await drawPanel(t);g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.drawImage(PC,0,0);PERSON=false;fullImages(t);cards(t,0,"front");hook(t,0);subtitles(t,0);return}
  const[fa,fw]=FLX?rangeA(TL.faceless,t,0.12):[0];
  if(fa>=0.999){await flPanel(t,fw);g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.drawImage(FLX.PC,0,0);PERSON=false;fullImages(t);hook(t,0);subtitles(t,0);return}
  const k=splitK(t);if(k>0)await drawPanel(t);
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
  fullImages(t);cards(t,k,"front");hook(t,k);
  if(fa>0){await flPanel(t,fw);g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=fa;g.drawImage(FLX.PC,0,0);g.restore()}
  subtitles(t,fa>0.5?0:k)};

async function init(cfg){TL=cfg.tl;B=merge(DEF,cfg.brand||{});const LY=TL.layout||{};PN=LY.panel||null;if(LY.colors)Object.assign(B.colors,LY.colors);labTheme();if(LY.cards_top!=null)B.cards.top=LY.cards_top;if(LY.caption_y!=null)B.captions.y=LY.caption_y;FR=cfg.frames||{me:{n:1,fps:30},rec:{}};DIR=cfg.dir;
  OFF=LY.split_top!=null?LY.split_top:B.safe_top;PH=920+OFF;CX=40;CY=140+OFF;CW=1000;CH=740;SHIFT=LY.split_shift!=null?LY.split_shift:B.split.shift;FY=B.face_y;   // split_top / split_shift — сдвиг сплита в одном ролике
  FL=!!LY.faceless;if(FL){PH=H;CH=Math.round(B.captions.y-130-CY)}   // no person: graphics fill the frame down to the subtitles
  await loadFonts();
  for(const s of TL.shots||[]){if(s.rec){s._ri=recInfo(s.rec);s.t=[s.m[0][0],s.m[s.m.length-1][0]]}}
  const files=new Set();const walk=o=>{if(!o||typeof o!=="object")return;if(Array.isArray(o)){o.forEach(walk);return}for(const k of["file","img"])if(typeof o[k]==="string"&&/\.(png|jpe?g|webp|gif)$/i.test(o[k]))files.add(o[k]);if(Array.isArray(o.files))o.files.forEach(f=>files.add(f));for(const k in o)if(k!=="m"&&typeof o[k]==="object")walk(o[k])};
  walk(TL.cards);walk((TL.shots||[]).filter(s=>s.scene));for(const f of files)await img(U(f));
  const bgOf=(ph,gy,rad)=>{const c=document.createElement("canvas");c.width=W;c.height=ph;const x=c.getContext("2d");if(PN){x.fillStyle=PN.outer||PN.bg||"#EDE8DC";x.fillRect(0,0,W,ph);if(PN.grid){x.strokeStyle="rgba(23,23,26,0.06)";x.lineWidth=2;for(let v=18;v<W;v+=40){x.beginPath();x.moveTo(v,0);x.lineTo(v,ph);x.stroke()}for(let v=18;v<ph;v+=40){x.beginPath();x.moveTo(0,v);x.lineTo(W,v);x.stroke()}}return c}x.fillStyle=B.colors.panel_bg;x.fillRect(0,0,W,ph);
    const gr=x.createRadialGradient(540,gy,40,540,gy,rad);gr.addColorStop(0,B.colors.panel_glow+"33");gr.addColorStop(1,B.colors.panel_glow+"00");x.fillStyle=gr;x.fillRect(0,0,W,ph);
    if(B.split.dots){x.fillStyle="rgba(255,255,255,0.07)";for(let yy=14;yy<ph;yy+=28)for(let xx=14;xx<W;xx+=28){x.beginPath();x.arc(xx,yy,1.6,0,7);x.fill()}}return c};
  BGC=FL?bgOf(PH,CY+CH*0.45,1100):bgOf(PH,520+OFF,800);
  PC=document.createElement("canvas");PC.width=W;PC.height=PH;p=PC.getContext("2d");
  FLX=null;if(!FL&&(TL.faceless||[]).length){const ch=Math.round(B.captions.y-130-CY),pc=document.createElement("canvas");pc.width=W;pc.height=H;FLX={PC:pc,p:pc.getContext("2d"),BGC:bgOf(H,CY+ch*0.45,1100),CH:ch}}SCV=document.createElement("canvas");SCV.width=CW;SCV.height=CH;return "ok"}
return {init,frame,warnings:()=>[...WARN],defaults:DEF,families:FAMILY,fonts:FONT_META};
}
root.ReelEngine=ReelEngine;
})(typeof window!=="undefined"?window:this);
