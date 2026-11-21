# Hornea las trayectorias de Apolo 13 (1970) y Artemis II (2026) para simulaciones/luna/regreso-libre/.
# Integra la nave con la gravedad de la Tierra y de la Luna (posición real de la Luna con Astronomy Engine) y busca, desde el paso
# por la Luna (altura y hora reales), la velocidad y el ángulo que llevan a la Tierra a la ida (perigeo de salida, 185 km) y a la vuelta
# (perigeo de reentrada). Apolo 13 incluye el encendido PC+2 (+262 m/s, 2 h 20 min después). Uso: pip install astronomy-engine scipy
#   python3 tools/hornear_regreso_libre.py   (desde la raíz del repositorio)
import astronomy as A, numpy as np, json, sys
from scipy.integrate import solve_ivp
from scipy.optimize import fsolve
AU=149597870.7; GE=398600.4418; GM=4902.800; RM=1737.4; RE=6371.0
def T(y,mo,d,h,mi,s=0): return A.Time.Make(y,mo,d,h,mi,s)
# Moon ephemeris cache: tabulate every 10 min and interpolate (fast)
class Moon:
    def __init__(s,t0,span_h):
        s.t0=t0.ut; s.ts=np.arange(-span_h*3600, span_h*3600+1, 600.0)
        s.P=np.array([[*vars_(A.GeoMoon(A.Time(s.t0+t/86400)))] for t in s.ts])
    def pos(s,t):
        return np.array([np.interp(t,s.ts,s.P[:,k]) for k in range(3)])
def vars_(v): return (v.x*AU,v.y*AU,v.z*AU)
def run(M,t0,y0,t1,burns=()):
    def f(t,y):
        r=y[:3]; m=M.pos(t); d=r-m
        a=-GE*r/np.linalg.norm(r)**3 - GM*d/np.linalg.norm(d)**3 - GM*m/np.linalg.norm(m)**3
        return np.r_[y[3:],a]
    def hit(t,y): return np.linalg.norm(y[:3])-2000.0
    hit.terminal=True
    segs=[]; t=t0; y=np.array(y0,float)
    pts=sorted([b for b in burns if (b[0]-t0)*(t1-t0)>0], key=lambda b: abs(b[0]-t0))+[(t1,None)]
    for tb,dv in pts:
        sol=solve_ivp(f,(t,tb),y,method='DOP853',rtol=1e-10,atol=1e-6,events=hit,dense_output=True,max_step=1800)
        segs.append(sol); y=sol.y[:,-1].copy(); t=sol.t[-1]
        if sol.status==1 or dv is None: break
        v=y[3:]; y[3:]+=v/np.linalg.norm(v)*dv
    return segs
def perigee(segs):
    best=(1e18,0,None)
    for s in segs:
        r=np.linalg.norm(s.y[:3],axis=0); i=np.argmin(r)
        if r[i]<best[0]:
            a=s.t[max(0,i-1)]; c=s.t[min(len(s.t)-1,i+1)]; tt=np.linspace(min(a,c),max(a,c),400); yy=s.sol(tt); rr=np.linalg.norm(yy[:3],axis=0); j=np.argmin(rr)
            best=(rr[j],tt[j],yy[:,j])
    # refine with dense
    return best
def state(M,tp,th,v,h,sgn):
    m=M.pos(tp); vm=(M.pos(tp+30)-M.pos(tp-30))/60
    n=np.cross(m,vm); n/=np.linalg.norm(n); far=m/np.linalg.norm(m); tt=np.cross(n,far)
    d=np.cos(th)*far+np.sin(th)*tt
    r=m+(RM+h)*d; vel=vm+sgn*v*np.cross(n,d)
    return np.r_[r,vel]
def solve(name,tp,h,rin,rout,burns,span,sgn,guess):
    M=Moon(tp,span); tp0=0.0
    def res(x):
        y=state(M,tp0,x[0],x[1],h,sgn)
        b=perigee(run(M,tp0,y,-span*3600)); f=perigee(run(M,tp0,y,span*3600,burns))
        return [ (b[0]-rin)/1000, (f[0]-rout)/1000 ]
    x=fsolve(res,guess,full_output=True); print(name,x[0],res(x[0]),x[2]); return M,x[0]
if False:  # exploración inicial
    for sgn in (1,-1):
        for th in (-0.3,0,0.3):
            try:
                M=Moon(T(2026,4,6,23,0),120)
                y=state(M,0,th,1.25,6545,sgn); b=perigee(run(M,0,y,-120*3600)); f=perigee(run(M,0,y,120*3600))
                print(sgn,th,round(b[0]),round(b[1]/3600,1),round(f[0]),round(f[1]/3600,1))
            except Exception as e: print(e)

from scipy.optimize import least_squares
import json
def fit(tp,h,rin,rout,burns,span,guess):
    M=Moon(tp,span)
    def res(x):
        y=state(M,0,x[0],x[1],h,-1)
        b=perigee(run(M,0,y,-span*3600)); f=perigee(run(M,0,y,span*3600,burns))
        return [(b[0]-rin)/100,(f[0]-rout)/100]
    r=least_squares(res,guess,x_scale=[0.01,0.01],diff_step=[1e-4,1e-5],xtol=1e-12,ftol=1e-12)
    x=r.x; y=state(M,0,x[0],x[1],h,-1)
    bs=run(M,0,y,-span*3600); fs=run(M,0,y,span*3600,burns); b=perigee(bs); f=perigee(fs)
    print(x, b[0], b[1]/3600, f[0], f[1]/3600)
    return M,y,b,f
def sample(M,y,b,f,burns,dt=600):
    # muestras cada dt s desde el perigeo de salida hasta el de llegada: posición nave (km) y Luna
    out=[]; bs=run(M,0,y,b[1]-1); fs=run(M,0,y,f[1]+1,burns)
    def at(t):
        segs=bs if t<0 else fs
        for s in segs:
            lo,hi=min(s.t[0],s.t[-1]),max(s.t[0],s.t[-1])
            if lo-1e-6<=t<=hi+1e-6: return s.sol(t)[:3]
        return None
    ts=np.r_[np.arange(b[1],f[1],dt), np.arange(-6*3600,6*3600,120), np.arange(-24*3600,24*3600,600), np.arange(b[1],b[1]+3*3600,40), np.arange(f[1]-3*3600,f[1],40), f[1]]
    ts=np.unique(np.round(ts[(ts>=b[1])&(ts<=f[1])]))
    for t in ts:
        p=at(t); m=M.pos(t); out.append([round(t/3600,4)]+[round(v) for v in p]+[round(v) for v in m])
    return out

def frame(M):
    m=M.pos(0); vm=(M.pos(30)-M.pos(-30))/60; x=m/np.linalg.norm(m); z=np.cross(m,vm); z/=np.linalg.norm(z); yv=np.cross(z,x)
    return np.array([x,yv,z])
def bake(name,tp,h,burns,span,guess,dt,heo=None):
    M,y,b,f=fit(tp,h,6563,6440,burns,span,guess); R=frame(M); S=sample(M,y,b,f,burns,dt)
    P=[]; 
    for r in S:
        c=R@np.array(r[1:4]); m=R@np.array(r[4:7]); P.append([r[0]]+[round(v/1000,4) for v in c]+[round(v/1000,2) for v in m])
    sun=A.GeoVector(A.Body.Sun,A.Time(M.t0),True); s=R@np.array([sun.x,sun.y,sun.z]); s/=np.linalg.norm(s)
    out={'t0':round(b[1]/3600,4),'t1':round(f[1]/3600,4),'t':[p[0] for p in P],'c':[p[1:4] for p in P],'m':[p[4:7] for p in P],'sun':[round(v,4) for v in s],'rp':round(float(np.linalg.norm(R@y[:3]-R@M.pos(0)))-1737.4)}
    if heo:
        r0=b[2][:3]; v0=b[2][3:]; rp=np.linalg.norm(r0); a=(rp+6371+heo)/2; vp=np.sqrt(GE*(2/rp-1/a)); vv=v0/np.linalg.norm(v0)*vp
        per=2*np.pi*np.sqrt(a**3/GE)
        sol=solve_ivp(lambda t,Y: np.r_[Y[3:],-GE*Y[:3]/np.linalg.norm(Y[:3])**3],(0,-per),np.r_[r0,vv],rtol=1e-10,dense_output=True)
        ts=np.linspace(0,-per,240); out['heo']=[[round(v/1000,3) for v in R@sol.sol(t)[:3]] for t in ts]; out['heoT']=round(per/3600,2)
    json.dump(out,open(name+'.json','w'),separators=(',',':')); print(name,len(P),out['rp'],out['sun'])
bake('a13',T(1970,4,15,0,21),254,((2*3600+19.6*60,0.262),),110,[-0.0294,2.44287],1200)
bake('a2',T(2026,4,6,23,0),6545,(),130,[0.00394,1.37813],1200,heo=74000)

import json
a=json.load(open('a13.json')); b=json.load(open('a2.json'))
json.dump({'a13':a,'a2':b},open('simulaciones/luna/regreso-libre/trayectorias.json','w'),separators=(',',':'))
