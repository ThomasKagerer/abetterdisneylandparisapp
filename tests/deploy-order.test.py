"""Simulate Docker calls; no live containers or network are touched."""
import json, os, subprocess, tempfile
from pathlib import Path
source=Path(__file__).resolve().parents[1]/'docker/deploy.sh'
fake='''#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
p=Path(os.environ['DISNEY_DEPLOY_TEST_STATE']);s=json.loads(p.read_text());name=Path(sys.argv[0]).name;a=sys.argv[1:];s['calls'].append([name]+a)
def done(out='',code=0):
 p.write_text(json.dumps(s));print(out) if out else None;sys.exit(code)
if name=='findmnt':done('/dev/sda1')
if name=='sleep':done()
if name=='mkdir':done()
if name=='curl':done('{"build":108}',1 if s.get('health_fail') else 0)
if name!='docker':done(code=1)
if a[:2]==['image','inspect']:done('Built image')
if a[:2] in [['network','inspect'],['volume','inspect']]:done()
if a[:2]==['container','inspect']:done(code=0 if a[2] in s['containers'] else 1)
if a[0]=='inspect':done(s['containers'].get(a[-1],{}).get('id',''),0 if a[-1] in s['containers'] else 1)
if a[0]=='create':
 if s.get('create_fail'):done(code=1)
 n=a[a.index('--name')+1];s['containers'][n]={'id':'new-id','running':False};done('new-id')
if a[0]=='stop':s['containers'][a[1]]['running']=False;done(a[1])
if a[0]=='rename':s['containers'][a[2]]=s['containers'].pop(a[1]);done()
if a[0]=='start':
 if s.get('start_fail') and s['containers'][a[1]]['id']=='new-id':done(code=1)
 s['containers'][a[1]]['running']=True;done(a[1])
done(code=1)
'''
for mode in ['success','create_fail','start_fail','health_fail']:
 with tempfile.TemporaryDirectory(prefix='disney-deploy-order-') as directory:
  folder=Path(directory);state=folder/'state.json';state.write_text(json.dumps({'containers':{'disney-public-web':{'id':'old-id','running':True}},'calls':[],mode:mode!='success'}))
  for name in ['docker','findmnt','curl','sleep','mkdir']:
   f=folder/name;f.write_text(fake);f.chmod(0o755)
  env={**os.environ,'PATH':str(folder)+os.pathsep+os.environ['PATH'],'DISNEY_DEPLOY_TEST_STATE':str(state),'DISNEY_REUSE_IMAGE':'1','DISNEY_INITIALIZED':'1'}
  # Replace only the output file path, so tests write solely in their temp dir.
  script=source.read_text().replace('/mnt/backup/docker-projects/disney-public/tools/started-version.json',str(folder/'version.json'))
  result=subprocess.run(['sh','-c',script],env=env,cwd=folder,capture_output=True,text=True)
  s=json.loads(state.read_text());calls=s['calls'];creates=[i for i,x in enumerate(calls) if x[:2]==['docker','create']];stops=[i for i,x in enumerate(calls) if x[:3]==['docker','stop','disney-public-web']]
  assert creates
  if mode=='create_fail':assert not stops and result.returncode!=0
  else:assert creates[0]<stops[0],calls
  live=s['containers']['disney-public-web'];assert live['running'],(mode,result.stderr,s)
  if mode=='success':assert result.returncode==0 and live['id']=='new-id'
  else:assert result.returncode!=0 and live['id']=='old-id',(mode,result.stderr,s)
print('Passed: prepare before downtime, failed preparation keeps old app, failed start/health restores old app.')
