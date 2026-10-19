"""Explicit, resumable three-task Suno demo generation. Credentials never enter served files."""
import json,sys,time
from pathlib import Path
import requests
ROOT=Path(__file__).resolve().parents[1]
KEYFILE=Path('/Users/waiwingtang/Projects/Multimedia AI Lab/.env')
env={}
for line in KEYFILE.read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        k,v=line.split('=',1);env[k.strip()]=v.strip().strip('\"\'')
key=env.get('EVOLINK_API_KEY')
if not key: raise SystemExit('Missing EvoLink credential')
base=env.get('EVOLINK_BASE_URL','https://api.evolink.ai').rstrip('/')
tracks=[('01-tidal-garden','潮汐花園','Original instrumental ambient electronica, approximately 76 BPM, 90 seconds. Spacious underwater atmosphere, warm evolving pads, isolated soft low kick, delicate high bell plucks. Quiet introduction, gentle pulse grows in middle, spacious ending. Clear contrasting bass and treble, no vocals.'),('02-firefly-convergence','螢火同步','Original instrumental melodic downtempo electronica, approximately 108 BPM, 90 seconds. Rounded distinct kick drum and bass, interlocking crystalline arpeggios, syncopated percussion, shimmering spacious synths. Intro then rhythmic build then brief breakdown and full groove return. No vocals.'),('03-mycelium-drive','菌網脈衝','Original instrumental psychedelic electronic dance music, approximately 132 BPM, 90 seconds. Deep tight four on floor kick, elastic rolling bass, spiralling acid-like synth pattern, crisp high percussion, gradual energy build, quiet breakdown, rhythmic return, resolved ending. Rich frequency contrast without harsh noise. No vocals.')]
state=ROOT/'.local/suno';state.mkdir(parents=True,exist_ok=True)
def save(p,v):
    tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(v,ensure_ascii=False,indent=2));tmp.replace(p)
def call(method,path,payload=None):
    r=requests.request(method,base+path,headers={'Authorization':'Bearer '+key},json=payload,timeout=(10,120),allow_redirects=False)
    if not r.ok: raise RuntimeError('EvoLink HTTP '+str(r.status_code))
    return r.json()
for slug,title,style in tracks:
    path=state/(slug+'.json')
    if path.exists(): continue
    payload={'model':'suno-v5.5-beta','custom_mode':True,'instrumental':True,'title':title,'duration':90,'style':style,'negative_tags':'vocals, speech, clipping, harsh noise','style_weight':.8,'weirdness_constraint':.4}
    save(path,{'status':'submitting','payload':payload})
    result=call('POST','/v1/audios/generations',payload)
    if not result.get('id'): raise RuntimeError('No task ID; inspect before resubmission')
    save(path,{'status':result.get('status'),'task_id':result['id'],'payload':payload})
    print('Submitted:',slug,flush=True)
for attempt in range(60):
    manifest=[];done=True
    for slug,title,style in tracks:
        path=state/(slug+'.json');record=json.loads(path.read_text())
        if not record.get('task_id'): raise RuntimeError('Uncertain submission; no automatic retry')
        if record.get('status')!='completed':
            result=call('GET','/v1/tasks/'+record['task_id']);record.update(status=result.get('status'),result=result);save(path,record)
        print(slug,record['status'],flush=True)
        if record['status'] in ('failed','cancelled','canceled'): raise RuntimeError('Generation failed; no automatic resubmit')
        if record['status']!='completed':done=False;continue
        result=record['result'];urls=[x['audio_url'] for x in result.get('result_data',[]) if isinstance(x,dict) and x.get('audio_url')]
        urls=list(dict.fromkeys(urls or [x for x in result.get('results',[]) if isinstance(x,str)]))
        if not urls: raise RuntimeError('Completed task has no audio result')
        for i,url in enumerate(urls):
            dest=ROOT/'music'/f'{slug}{"" if i==0 else "-alt"+str(i)}.mp3'
            if not dest.exists():
                r=requests.get(url,timeout=(10,120));r.raise_for_status();dest.write_bytes(r.content)
        manifest.append({'id':slug,'title':title,'src':'music/'+slug+'.mp3','provider':'Suno via EvoLink','requestedDuration':90,'style':style})
    save(ROOT/'music/manifest.json',manifest)
    if done:print('Three demo compositions downloaded.',flush=True);break
    time.sleep(20)
else: raise SystemExit('Polling window ended; rerun to resume existing tasks.')
