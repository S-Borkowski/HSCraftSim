"""Replay positive-base tooltip branches in the supplied executable.

The level is the already-selected tooltip context. This does not emulate a
live player's global data or combat pipeline. All outputs come from x86 code.
"""
import itertools,json
from pathlib import Path
from native_display_values import DisplayOracle

BUILD='c6ecc069cfc02e105c988d48f9469f4e2e6260ad44c41dab8001f2612b8b3db4'
ROOT=Path(__file__).resolve().parents[2]

def main():
    oracle=DisplayOracle();fixtures=[]
    cases={
        'attack':[{22:base,28:enhanced,31:per_level}
                  for base,enhanced,per_level in itertools.product((1,64,63.7),(0,479,-20),(0,1.5,-0.2))],
        'speed':[{23:base,68:speed}
                 for base,speed in itertools.product((0.5,1.75,2.1),(0,40,123.5,-20))],
        'defense':[{154:base,29:enhanced,30:percent_level,156:flat_level}
                   for base,enhanced,percent_level,flat_level in itertools.product((1,329,328.7),(0,584,-10),(0,1.5,-0.2),(0,2.5))],
    }
    for part,inputs in cases.items():
        for stats,(rarity,w),level in itertools.product(inputs,((1,0),(5,None),(6,0),(6,1),(7,1),(8,1)),(1,50,100)):
            args=dict(item_type=1 if part=='defense' else 3,rarity=rarity,w=w,level=level)
            result=oracle.capture_display(part,stats,**args)
            fixtures.append(dict(part=part,stats=stats,**args,base=result['base'],modified=result['modified']))
        print(part,len(fixtures),flush=True)
    output=dict(buildSha256=BUILD,source='GetItemTooltipString numeric blocks',fixtures=fixtures)
    (ROOT/'tests/current_display_native.json').write_text(json.dumps(output,separators=(',',':'))+'\n',encoding='utf8')
    print('Captured',len(fixtures),'native display cases',flush=True)

if __name__=='__main__':main()
