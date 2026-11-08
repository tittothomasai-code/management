// nightsky.js (feat/night-real): physically plausible night sky for night.js. Values are generic (SIM).
// Sky dome: scattering gradient (zenith ~ mag 21.5 sky, dark blue-black) to a faint horizon airglow, warm
// light-pollution dome toward the rig, Milky Way band (galactic plane, low-contrast noise), moon aureole.
// Stars: magnitude-limited field, N(<m) ~ 10^(0.5 m) (inverse CDF), flux 10^(-0.4 m), colour from a
// spectral-class mix (O/B..M -> blackbody RGB), atmospheric extinction near horizon and scintillation
// that grows with airmass. Moon: phase-correct disc with low-contrast maria plus soft aureole.
// Exports build helpers only; night.js owns state/fading. Every material keeps .opacity as the fade input.
let T=null;export function use(three){T=three;MOON=MOON||new T.Vector3(...MOON_POS)}
const VS=`varying vec3 vD;void main(){vD=normalize(position);vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;}`;
const FS=`uniform float uOp,uMW;uniform vec3 uMoon,uPol;varying vec3 vD;
float h3(vec3 p){p=fract(p*0.3183+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
void main(){vec3 d=normalize(vD);float h=d.y,hp=max(h,0.);
 vec3 zen=vec3(.010,.016,.034),hor=vec3(.075,.086,.105);
 vec3 c=mix(hor,zen,pow(hp,.42));
 float az=max(dot(normalize(vec3(d.x,0.,d.z)),uPol),0.);
 c+=vec3(.085,.060,.038)*exp(-hp*11.)*(.35+.65*az*az);           // sodium/LED skyglow dome from the site
 c+=vec3(.010,.016,.010)*exp(-abs(h-.06)*30.);                     // faint airglow layer
 float mc=max(dot(d,uMoon),0.);c+=vec3(.05,.058,.07)*pow(mc,60.)+vec3(.012,.015,.02)*pow(mc,6.); // moon aureole
 if(uMW>0.){vec3 gp=normalize(vec3(.42,.55,-.72));float b=dot(d,gp);float band=exp(-b*b/.018);
  
#ifdef LOWQ
  float n=n3(d*9.);float dust=0.;
#else
  float n=n3(d*7.)*.55+n3(d*15.)*.30+n3(d*31.)*.15;float dust=smoothstep(.45,.75,n3(d*11.+3.))*exp(-b*b/.004);
#endif

  c+=vec3(.045,.047,.055)*band*(.45+.9*n)*(1.-.7*dust)*smoothstep(0.,.35,hp)*uMW;}
 if(h<0.)c=mix(c,vec3(.03,.032,.036),smoothstep(0.,-.08,h));
 gl_FragColor=vec4(c,uOp);}`;
export function sky(R,q){const m=new T.Mesh(new T.SphereGeometry(R,32,20),new T.ShaderMaterial({defines:q=='low'?{LOWQ:1}:{},vertexShader:VS,fragmentShader:FS,side:T.BackSide,transparent:true,depthWrite:false,fog:false,toneMapped:false,
 uniforms:{uOp:{value:0},uMW:{value:q=='low'?0.7:1},uMoon:{value:MOON.clone().normalize()},uPol:{value:new T.Vector3(0,0,1)}}}));
 m.material.opacity=0;m.onBeforeRender=()=>{m.material.uniforms.uOp.value=m.material.opacity};m.renderOrder=-10;m.name='nightSky';m.frustumCulled=false;return m}
export const MOON_POS=[-520,620,-760];let MOON=null;
// spectral mix of naked-eye stars (approx): B 10%, A 22%, F 19%, G 14%, K 28%, M 7%
const SPEC=[[.10,[.70,.78,1]],[.22,[.86,.90,1]],[.19,[1,.98,.95]],[.14,[1,.93,.82]],[.28,[1,.82,.62]],[.07,[1,.70,.46]]];
const SVS=`attribute float aMag,aPh;attribute vec3 aCol;uniform float uT,uPx;varying vec3 vC;varying float vA;
void main(){vec3 d=normalize(position);float h=max(d.y,0.);float am=1./max(h+.025,.05);
 float f=max(.45,pow(10.,-.4*(aMag-4.)))*exp(-.11*(am-1.));                 // flux relative to mag 1, extinction 0.11 mag/airmass
 float tw=1.-min(.6,.04*am)*(.5+.5*sin(uT*(6.+aPh*9.)+aPh*40.));    // scintillation grows with airmass
 vA=clamp(f,0.,1.)*min(1.,.85)*tw*smoothstep(0.,.06,h);vC=aCol*min(1.5,max(1.,f));
 gl_PointSize=uPx*(1.4+1.8*clamp((3.-aMag)/4.5,0.,1.));
 vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;}`;
const SFS=`uniform float uOp;varying vec3 vC;varying float vA;void main(){vec2 c=gl_PointCoord-.5;float r=dot(c,c);float a=exp(-r*7.)*vA*uOp;if(a<.003)discard;gl_FragColor=vec4(vC*a,a);}`;
export function stars(n,R){const pos=new Float32Array(n*3),mag=new Float32Array(n),ph=new Float32Array(n),col=new Float32Array(n*3);let s=24680;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
 const M0=-1.2,M1=6.3,k=0.5*Math.log(10),A=Math.exp(k*M0),B=Math.exp(k*M1);
 for(let i=0;i<n;i++){const y=-0.02+rnd()*1.02,th=rnd()*6.2832,r=Math.sqrt(Math.max(0,1-y*y));pos.set([Math.cos(th)*r*R,y*R,Math.sin(th)*r*R],i*3);
  mag[i]=Math.log(A+rnd()*(B-A))/k;ph[i]=rnd();let u=rnd(),c=SPEC[5][1];for(const [p,cc] of SPEC){if(u<p){c=cc;break}u-=p}col.set(c,i*3)}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('aMag',new T.BufferAttribute(mag,1));g.setAttribute('aPh',new T.BufferAttribute(ph,1));g.setAttribute('aCol',new T.BufferAttribute(col,3));
 const mat=new T.ShaderMaterial({vertexShader:SVS,fragmentShader:SFS,transparent:true,depthWrite:false,blending:T.AdditiveBlending,fog:false,toneMapped:false,uniforms:{uT:{value:0},uOp:{value:0},uPx:{value:Math.min(2,devicePixelRatio||1)*1.6}}});mat.opacity=0;
 const m=new T.Points(g,mat);m.onBeforeRender=()=>{mat.uniforms.uOp.value=mat.opacity;mat.uniforms.uT.value=performance.now()/1000};m.name='nightStars';m.renderOrder=-9;m.frustumCulled=false;return m}
// moon: illuminated fraction from phase angle; waxing gibbous ~ 78 % (generic)
export const PHASE=0.30;
function moonTex(){const c=document.createElement('canvas'),S=256;c.width=c.height=S;const g=c.getContext('2d'),r=S*0.46,o=S/2;let s=97;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
 const L=document.createElement('canvas');L.width=L.height=S;const l=L.getContext('2d');l.fillStyle='#d9d6cc';l.beginPath();l.arc(o,o,r,0,7);l.fill();
 l.globalCompositeOperation='source-atop';[[.40,.36,.16],[.55,.42,.12],[.47,.58,.14],[.62,.60,.08],[.33,.55,.07]].forEach(([x,y,rr])=>{const gr=l.createRadialGradient(x*S,y*S,0,x*S,y*S,rr*S);gr.addColorStop(0,'rgba(120,118,112,.55)');gr.addColorStop(1,'rgba(120,118,112,0)');l.fillStyle=gr;l.fillRect(0,0,S,S)});
 for(let i=0;i<140;i++){const x=o+(rnd()-.5)*2*r,y=o+(rnd()-.5)*2*r,rr=1+rnd()*4;l.fillStyle=`rgba(${rnd()<.5?90:240},${rnd()<.5?90:238},230,.12)`;l.beginPath();l.arc(x,y,rr,0,7);l.fill()}
 const limb=l.createRadialGradient(o,o,r*.6,o,o,r);limb.addColorStop(0,'rgba(0,0,0,0)');limb.addColorStop(1,'rgba(0,0,0,.25)');l.fillStyle=limb;l.fillRect(0,0,S,S);
 // terminator: shadow = disc minus ellipse (phase angle)
 l.globalCompositeOperation='destination-out';const k=Math.cos(PHASE*Math.PI);l.fillStyle='rgba(0,0,0,.96)';l.beginPath();l.arc(o,o,r+1,Math.PI/2,Math.PI*1.5);l.ellipse(o,o,Math.abs(k)*r,r+1,0,-Math.PI/2,Math.PI/2,k<0);l.fill();
 g.fillStyle='rgba(20,24,32,.35)';g.beginPath();g.arc(o,o,r,0,7);g.fill(); // earthshine/dark limb
 g.drawImage(L,0,0);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t}
let MT=null;export function moon(){MOON=MOON||new T.Vector3(...MOON_POS);MT=MT||moonTex();const m=new T.Sprite(new T.SpriteMaterial({map:MT,transparent:true,opacity:0,depthWrite:false,fog:false,toneMapped:false}));m.position.copy(MOON);m.scale.setScalar(34);m.name='nightMoon';m.renderOrder=-8;return m}
export function moonLight(){const l=new T.DirectionalLight(0xa9bbd9,0.32);l.position.copy(MOON||new T.Vector3(...MOON_POS)).normalize().multiplyScalar(200);l.name='nightMoonLight';return l}
export const COL={led:0xf2f4ff,flood:0xfff1dc,sodium:0xffd2a0,window:0xffe6c4,beacon:0xff2a14,fog:0x0b0e15};
// restrained night overlay styling (understated, neutral)
export function css(){if(document.getElementById('nightRealCss'))return;const st=document.createElement('style');st.id='nightRealCss';
 st.textContent=`#srRC.night{background:rgba(10,12,16,.88)!important;border-color:#3b4250!important;color:#d8dde6!important;box-shadow:0 4px 18px rgba(0,0,0,.6)!important}
 body.dw-night #hud button,body.dw-night #srBar button{filter:saturate(.75)}`;document.head.appendChild(st)}
