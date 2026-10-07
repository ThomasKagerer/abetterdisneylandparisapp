import glob,json,os
from pathlib import Path
root=Path('/var/lib/weletapi-disney-waits')
for park in (4,28):
 path=root/f'park-{park}.json'
 cache=json.loads(path.read_text()) if path.exists() else {'rides':[],'history':{}}
 records={}
 for source in glob.glob(f'/tmp/systemd-private-*/tmp/weletapi-disney-waits-2a2b301b623d/park-{park}.json')+[str(path)]:
  if not Path(source).exists():continue
  for ride,samples in json.loads(Path(source).read_text()).get('history',{}).items():
   for sample in samples: records.setdefault(ride,{})[sample['at']]=sample
 cache['history']={ride:sorted(samples.values(),key=lambda s:s['at'])[-9000:] for ride,samples in records.items()}
 cache['fetched']=0
 temporary=path.with_suffix('.migrate');temporary.write_text(json.dumps(cache));os.chown(temporary,33,33);os.chmod(temporary,0o600);os.replace(temporary,path)
 print(f'Park {park}: {sum(map(len,cache["history"].values()))} preserved samples')
