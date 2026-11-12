#!/bin/sh
cd "$(dirname "$0")"
python3 -I run.py "mix.html?job=iso&comps=cur,feel07" 240 > out/iso.json 2> out/iso.err
python3 -I run.py "mix.html?job=matrix&scenes=a,p&comps=cur&ducks=cur,feel07,shelf,prop" 250 > out/pump.json 2> out/pump.err
python3 -I run.py "mix.html?job=matrix&scenes=b,c,d&comps=cur,feel07&ducks=cur" 250 > out/bcd.json 2> out/bcd.err
python3 -I run.py "mix.html?job=tell" 200 > out/tell.json 2> out/tell.err
python3 -I run.py "mix.html?job=null&scenes=c,a" 200 > out/null.json 2> out/null.err
python3 -I run.py "mix.html?job=matrix&scenes=b,c,p&recipes=doom&comps=cur,lim2&ducks=prop&weaponGain=1.41" 250 > out/propwg.json 2> out/propwg.err
echo done > out/ALLDONE
