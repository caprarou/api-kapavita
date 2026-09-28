#!/usr/bin/env python3
import os,json,math
import psycopg
DSN=os.environ.get('KAPAVITA_DATA_DSN','dbname=kapavita')
def detect(rows):
 events=[]; group=[]
 for row in rows:
  if float(row[3] or 0)<=.5: group.append(row)
  elif group:
   hours=(group[-1][0]-group[0][0]).total_seconds()/3600
   if hours>=2: events.append({'type':'stop','startedAt':group[0][0].isoformat(),'endedAt':group[-1][0].isoformat(),'durationHours':round(hours,1),'latitude':round(sum(float(x[1]) for x in group)/len(group),5),'longitude':round(sum(float(x[2]) for x in group)/len(group),5),'confidence':'automatic'})
   group=[]
 return events
def main():
 with psycopg.connect(DSN) as db: rows=db.execute("SELECT observed_at,ST_Y(location),ST_X(location),speed_knots FROM observations.vessel_positions WHERE mmsi=248554000 ORDER BY observed_at").fetchall()
 result={'mmsi':248554000,'points':len(rows),'events':detect(rows)}
 if len(rows)<2: result['status']='insufficient_data'; result['message']='Δεν υπάρχουν αρκετά αποθηκευμένα AIS δεδομένα για αναγνώριση γεγονότων.'
 else: result['status']='ok' if result['events'] else 'no_events'; result['message']='Δεν έχει αναγνωριστεί ακόμη παραμονή τουλάχιστον 2 ωρών.' if not result['events'] else 'Αυτόματα γεγονότα AIS.'
 print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__': main()
