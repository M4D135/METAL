#!/usr/bin/env python3
# usage: ctx.py file regex [before] [after]  -> prints line:col and context around each match
import re,sys
f=sys.argv[1];rx=re.compile(sys.argv[2]);b=int(sys.argv[3]) if len(sys.argv)>3 else 160;a=int(sys.argv[4]) if len(sys.argv)>4 else 240
for n,line in enumerate(open(f,encoding='utf-8'),1):
    for m in rx.finditer(line):
        s=max(0,m.start()-b);e=min(len(line),m.end()+a)
        print(f"{n}:{m.start()}: {line[s:e].rstrip()}")
        print()
