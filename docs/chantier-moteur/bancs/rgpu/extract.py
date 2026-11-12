import sys,html
s=sys.stdin.read()
i=s.rfind('<pre id="rgpu-out">')
if i<0:
    i=s.rfind('<pre id="out">')
    if i<0: sys.exit('no output marker')
j=s.find('>',i)+1;k=s.find('</pre>',j)
sys.stdout.write(html.unescape(s[j:k]))
