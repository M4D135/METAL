import json,sys
j=json.load(open(sys.argv[1]))
if j.get('errors'): print('ERRORS',j['errors'])
for r in j['rows']:
    print('%s %-4s %-6s %-8s| pkOut %.3f pre %.3f above %d (%s%%, %d ép.) rms %.2f | GR min %.2f moy %.2f <-3dB %s%% <-6dB %s%% | duck %s shelf %s'%(r['scene'],r['recipe'],r['comp'],r['duck'],r['peakOut'],r['peakPreGuard'],r['aboveKnee'],r['aboveKneePct'],r['clipEpisodes'],r['rmsOutDb'],r['gr']['minDb'],r['gr']['meanDb'],r['gr']['pctBelow3'],r['gr']['pctBelow6'],r['duckDepth']['minDb'],r['duckDepth']['shelfMinDb']))
    sh=' '.join('%s[n%d trans/mus p10 %s p50 %s GR p50 %s p10 %s]'%(k,v['n'],v['transientOverMusicDb'] and v['transientOverMusicDb']['p10'],v['transientOverMusicDb'] and v['transientOverMusicDb']['p50'],v['grDb']['p50'],v['grDb']['p10']) for k,v in r['shots'].items())
    print('     ',sh)
    print('      400ms fx/mus',r['shortTerm']['fxOverMusicDb'],'| fx',r['levels']['fxRmsDb'],'mus',r['levels']['musicRmsDb'],'| <120Hz fx',r['low120']['fxDb'],'mus',r['low120']['musicDb'],'diff',r['low120']['fxMinusMusicDb'],'| voix',r['voices'],'| ms/s',r['render']['msPerAudioSecond'],'params',r['render']['audioParamCalls'], '| pump',r.get('pump') and {k:v for k,v in r['pump'].items() if k!='perBurst'})
