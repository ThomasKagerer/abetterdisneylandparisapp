import importlib.util,unittest,math
from pathlib import Path
from shapely.geometry import Polygon,LineString
spec=importlib.util.spec_from_file_location('plazas',Path(__file__).parents[1]/'prepare-plazas.py');plazas=importlib.util.module_from_spec(spec);spec.loader.exec_module(plazas)
class Plazas(unittest.TestCase):
 def graph(self):
  a=(200000,5400000);self.offset=a
  self.poly=Polygon([(a[0]+x,a[1]+y) for x,y in [(0,0),(100,0),(100,100),(0,100)]])
  return {'nodes':[plazas.ll((a[0]+10,a[1]+50)),plazas.ll((a[0]+90,a[1]+50))],'edges':[[0,1,180],[1,0,180]],'rides':[{'node':0}]}
 def test_open_square_has_direct_shortcut(self):
  data=self.graph();plazas.add_visibility(data,[self.poly]);links=[d for a,b,d in data['edges'][2:] if a==0 and b==1];self.assertTrue(links);self.assertAlmostEqual(links[0],80,delta=.01)
 def test_all_links_avoid_hole(self):
  data=self.graph();x,y=self.offset;hole=Polygon([(x+40,y+40),(x+60,y+40),(x+60,y+60),(x+40,y+60)])
  allowed=self.poly.difference(hole);plazas.add_visibility(data,[allowed]);self.assertFalse(any(a==0 and b==1 for a,b,d in data['edges'][2:]))
  for a,b,d in data['edges'][2:]:self.assertTrue(allowed.buffer(.02).covers(LineString([plazas.xy(data['nodes'][a]),plazas.xy(data['nodes'][b])])))
if __name__=='__main__':unittest.main()
