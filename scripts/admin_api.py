#!/usr/bin/env python3
"""KapaVita control API. Loopback only; Caddy terminates HTTPS."""
import getpass
from contextlib import contextmanager
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import sqlite3
import subprocess
import sys
import time
import datetime as dt
from zoneinfo import ZoneInfo
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DB = Path(os.environ.get('KAPAVITA_ADMIN_DB', '/home/dev/.local/share/kapavita/admin.sqlite3'))
VESSEL = ROOT / 'app/dist/data/seaviolet-last-position.json'
ORIGIN = os.environ.get('KAPAVITA_ORIGIN', 'https://api.kapavita.gr')
FEATURES = {
 'regions': True, 'municipalities': True, 'communities': True,
 'population': True, 'airports': True, 'aircraft': True, 'marine': True,
 'weather': True, 'airQuality': True, 'seaviolet': False, 'catalog': True,
}
GRANTS = {'seaviolet:view'}
ATTEMPTS = {}
ATTEMPTS_LOCK = Lock()
VISIT_ATTEMPTS = {}
VISIT_LOCK = Lock()
def connect():
 c = sqlite3.connect(DB, timeout=5)
 c.row_factory = sqlite3.Row
 c.execute('PRAGMA busy_timeout=5000')
 return c
@contextmanager
def transaction():
 c=connect()
 try:
  yield c
  c.commit()
 except Exception:
  c.rollback()
  raise
 finally:
  c.close()
def init():
 DB.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
 if DB.exists(): os.chmod(DB,0o600)
 with transaction() as c:
  c.executescript("""
  PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, hash TEXT NOT NULL, role TEXT NOT NULL, grants TEXT NOT NULL DEFAULT '[]', enabled INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL, last_login INTEGER);
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, csrf TEXT NOT NULL, expires INTEGER NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS flags (key TEXT PRIMARY KEY, enabled INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, at INTEGER NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS visits (day TEXT NOT NULL, page TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,page));
  """)
  for key, enabled in FEATURES.items(): c.execute('INSERT OR IGNORE INTO flags VALUES (?,?)',(key,int(enabled)))
 os.chmod(DB,0o600)
def password_hash(password):
 salt=secrets.token_bytes(16)
 key=hashlib.scrypt(password.encode(),salt=salt,n=2**14,r=8,p=1,dklen=32)
 return salt.hex()+':'+key.hex()
def password_ok(password, stored):
 try:
  salt, digest = stored.split(':')
  return hmac.compare_digest(hashlib.scrypt(password.encode(),salt=bytes.fromhex(salt),n=2**14,r=8,p=1,dklen=32),bytes.fromhex(digest))
 except (ValueError,TypeError): return False
def audit(conn,actor,action,detail=''):
 conn.execute('INSERT INTO audit(at,actor,action,detail) VALUES (?,?,?,?)',(int(time.time()),actor,action,detail[:120]))
def flags(conn):
 return {row['key']:bool(row['enabled']) for row in conn.execute('SELECT key,enabled FROM flags')}
def principal(conn,cookie):
 match=re.search(r'(?:^|;\s*)__Host-kv_session=([a-f0-9]{64})(?:;|$)',cookie)
 if not match: return None
 token=hashlib.sha256(bytes.fromhex(match.group(1))).hexdigest()
 return conn.execute('SELECT users.*, sessions.csrf, sessions.token_hash FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires>? AND users.enabled=1',(token,int(time.time()))).fetchone()
def grants(user):
 return json.loads(user['grants']) if user else []
def user_info(user):
 return {'id':user['id'],'username':user['username'],'role':user['role'],'grants':grants(user)}
def user_statistics(db):
 now=int(time.time())
 rows=db.execute('SELECT role,enabled,COUNT(*) AS total FROM users GROUP BY role,enabled').fetchall()
 roles={name:sum(row['total'] for row in rows if row['role']==name) for name in ('admin','editor','viewer')}
 today=dt.datetime.now(ZoneInfo('Europe/Athens')).date()
 days=[(today-dt.timedelta(days=n)).isoformat() for n in range(6,-1,-1)]
 totals={row['day']:row['total'] for row in db.execute('SELECT day,SUM(views) AS total FROM visits WHERE day>=? GROUP BY day',(days[0],))}
 pages={row['page']:row['total'] for row in db.execute('SELECT page,SUM(views) AS total FROM visits WHERE day>=? GROUP BY page',(days[0],))}
 return {'accounts':sum(row['total'] for row in rows),'enabledAccounts':sum(row['total'] for row in rows if row['enabled']),
         'roles':roles,'activeSessions':db.execute('SELECT COUNT(*) FROM sessions WHERE expires>?',(now,)).fetchone()[0],
         'logins7d':db.execute("SELECT COUNT(*) FROM audit WHERE action='login' AND at>=?",(now-7*86400,)).fetchone()[0],
         'created30d':db.execute('SELECT COUNT(*) FROM users WHERE created>=?',(now-30*86400,)).fetchone()[0],
         'views7d':[{'day':day,'views':totals.get(day,0)} for day in days],
         'viewsToday':totals.get(today.isoformat(),0),'pages7d':pages}
def server_status():
 total,used,free=shutil.disk_usage(ROOT)
 try:
  memory=next(line.split()[1] for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:'))
  mem_mb=round(int(memory)/1024)
 except (OSError,StopIteration): mem_mb=None
 docker=shutil.which('docker')
 if docker:
  try:
   result=subprocess.run([docker,'info','--format','{{.ServerVersion}}'],capture_output=True,text=True,timeout=2)
   docker_state='διαθέσιμο' if result.returncode==0 else 'εγκατεστημένο, χωρίς πρόσβαση στον daemon'
  except (OSError,subprocess.TimeoutExpired): docker_state='μη διαθέσιμο'
 else: docker_state='μη εγκατεστημένο'
 return {'diskFreeGb':round(free/1073741824,1),'diskTotalGb':round(total/1073741824,1),'memoryAvailableMb':mem_mb,'database':'SQLite ενεργή · μελλοντική PostgreSQL/Docker μη εγκατεστημένη','docker':docker_state,'aisFile':VESSEL.exists(),'loadAverage1m':round(os.getloadavg()[0],2),'uptimeHours':round(float(Path('/proc/uptime').read_text().split()[0])/3600,1),'serverTime':int(time.time())}
def username_ok(username): return isinstance(username,str) and re.fullmatch(r'[a-z0-9_.-]{3,32}',username) is not None

class Handler(BaseHTTPRequestHandler):
 def log_message(self,format,*args):
  print('%s %s'%(self.address_string(),format%args),flush=True)
 def reply(self,status,data,cookie=None):
  raw=json.dumps(data,ensure_ascii=False).encode()
  self.send_response(status)
  self.send_header('Content-Type','application/json; charset=utf-8')
  self.send_header('Content-Length',str(len(raw)))
  self.send_header('Cache-Control','no-store')
  self.send_header('X-Content-Type-Options','nosniff')
  self.send_header('Referrer-Policy','no-referrer')
  if cookie: self.send_header('Set-Cookie',cookie)
  self.end_headers(); self.wfile.write(raw)
 def body(self):
  length=int(self.headers.get('Content-Length','0'))
  if length<1 or length>16000: raise ValueError('invalid body length')
  data=json.loads(self.rfile.read(length))
  if not isinstance(data,dict): raise ValueError('JSON object required')
  return data
 def context(self):
  db=connect(); return db,principal(db,self.headers.get('Cookie',''))
 def do_GET(self):
  path=urlsplit(self.path).path
  with transaction() as db:
   user=principal(db,self.headers.get('Cookie',''))
   if path=='/api/public':
    public=flags(db)
    self.reply(200,{'features':public,'seavioletAllowed':public['seaviolet'] or bool(user and (user['role']=='admin' or 'seaviolet:view' in grants(user)))})
   elif path=='/api/session':
    self.reply(200,{'user':user_info(user) if user else None,'csrf':user['csrf'] if user else None})
   elif path=='/api/v1/vessel/seaviolet':
    if not (flags(db)['seaviolet'] or user and (user['role']=='admin' or 'seaviolet:view' in grants(user))): self.reply(403,{'error':'Δεν έχεις πρόσβαση στο πλοίο.'});return
    try:
     data=json.loads(VESSEL.read_text())
     if data.get('mmsi')!=248554000: raise ValueError('MMSI mismatch')
     self.reply(200,data)
    except (OSError,ValueError,json.JSONDecodeError): self.reply(404,{'error':'Δεν έχει παραληφθεί στίγμα AIS.'})
   elif path=='/api/admin':
    if not user or user['role']!='admin':self.reply(403,{'error':'Πρόσβαση διαχειριστή απαιτείται.'});return
    users=[{'id':row['id'],'username':row['username'],'role':row['role'],'grants':json.loads(row['grants']),'enabled':bool(row['enabled']),'lastLogin':row['last_login']} for row in db.execute('SELECT * FROM users ORDER BY id')]
    logs=[dict(row) for row in db.execute('SELECT at,actor,action,detail FROM audit ORDER BY id DESC LIMIT 30')]
    self.reply(200,{'features':flags(db),'users':users,'audit':logs,'status':server_status(),'statistics':user_statistics(db)})
   else:self.reply(404,{'error':'Δεν βρέθηκε.'})
 def do_POST(self):self.mutate()
 def do_PUT(self):self.mutate()
 def do_PATCH(self):self.mutate()
 def mutate(self):
  path=urlsplit(self.path).path
  origin=self.headers.get('Origin')
  if origin and origin!=ORIGIN:self.reply(403,{'error':'Μη επιτρεπτή προέλευση.'});return
  try: payload=self.body()
  except (ValueError,json.JSONDecodeError):self.reply(400,{'error':'Μη έγκυρο αίτημα.'});return
  with transaction() as db:
   user=principal(db,self.headers.get('Cookie',''))
   if path=='/api/visit' and self.command=='POST':
    page=payload.get('page')
    if page not in ('map','catalog','seaviolet','admin'):self.reply(400,{'error':'Μη έγκυρη σελίδα.'});return
    ip=self.headers.get('X-Forwarded-For',self.client_address[0]).split(',')[0].strip()[:64]
    now=time.time()
    with VISIT_LOCK:
     recent=[x for x in VISIT_ATTEMPTS.get(ip,[]) if now-x<60]
     if len(recent)>=30:self.reply(429,{'error':'Πολλά αιτήματα.'});return
     VISIT_ATTEMPTS[ip]=recent+[now]
    day=dt.datetime.now(ZoneInfo('Europe/Athens')).date().isoformat()
    db.execute('INSERT INTO visits(day,page,views) VALUES (?,?,1) ON CONFLICT(day,page) DO UPDATE SET views=views+1',(day,page))
    self.reply(200,{'ok':True});return
   if path=='/api/login' and self.command=='POST':
    ip=self.headers.get('X-Forwarded-For',self.client_address[0]).split(',')[0].strip()[:64]
    now=time.time()
    with ATTEMPTS_LOCK:
     recent=[x for x in ATTEMPTS.get(ip,[]) if now-x<900]
     ATTEMPTS[ip]=recent
     blocked=len(recent)>=5
    if blocked:self.reply(429,{'error':'Περίμενε 15 λεπτά πριν ξαναδοκιμάσεις.'});return
    name=str(payload.get('username','')).lower()
    found=db.execute('SELECT * FROM users WHERE username=? AND enabled=1',(name,)).fetchone()
    candidate=found['hash'] if found else password_hash('dummy-value')
    correct=password_ok(str(payload.get('password','')),candidate)
    if not found or not correct:
     with ATTEMPTS_LOCK:ATTEMPTS[ip].append(now)
     self.reply(401,{'error':'Λάθος στοιχεία σύνδεσης.'});return
    token=secrets.token_hex(32);csrf=secrets.token_hex(24)
    db.execute('INSERT INTO sessions VALUES (?,?,?,?)',(hashlib.sha256(bytes.fromhex(token)).hexdigest(),found['id'],csrf,int(now)+28800))
    db.execute('UPDATE users SET last_login=? WHERE id=?',(int(now),found['id']))
    audit(db,name,'login')
    with ATTEMPTS_LOCK:ATTEMPTS.pop(ip,None)
    self.reply(200,{'user':user_info(found),'csrf':csrf},'__Host-kv_session='+token+'; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800')
    return
   if not user:self.reply(401,{'error':'Χρειάζεται σύνδεση.'});return
   if not hmac.compare_digest(self.headers.get('X-CSRF-Token',''),user['csrf']):self.reply(403,{'error':'Μη έγκυρη συνεδρία.'});return
   if path=='/api/logout' and self.command=='POST':
    db.execute('DELETE FROM sessions WHERE token_hash=?',(user['token_hash'],))
    self.reply(200,{'ok':True},'__Host-kv_session=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return
   if path=='/api/password' and self.command=='POST':
    old,new=str(payload.get('current','')),str(payload.get('new',''))
    if not password_ok(old,user['hash']) or len(new)<12 or len(new)>256:self.reply(400,{'error':'Έλεγξε τον τωρινό κωδικό και βάλε νέο με τουλάχιστον 12 χαρακτήρες.'});return
    db.execute('UPDATE users SET hash=? WHERE id=?',(password_hash(new),user['id']))
    db.execute('DELETE FROM sessions WHERE user_id=? AND token_hash<>?',(user['id'],user['token_hash']))
    audit(db,user['username'],'password-changed')
    self.reply(200,{'ok':True});return
   if user['role']!='admin':self.reply(403,{'error':'Μόνο ο διαχειριστής μπορεί να αλλάξει ρυθμίσεις.'});return
   if path=='/api/admin/flags' and self.command=='PUT':
    values=payload.get('features')
    if not isinstance(values,dict) or set(values)!=set(FEATURES) or not all(type(v) is bool for v in values.values()):self.reply(400,{'error':'Μη έγκυρες επιλογές.'});return
    for key,enabled in values.items(): db.execute('UPDATE flags SET enabled=? WHERE key=?',(int(enabled),key))
    audit(db,user['username'],'flags-updated',','.join(k for k,v in values.items() if v))
    self.reply(200,{'features':flags(db)});return
   if path=='/api/admin/users' and self.command=='POST':
    name=str(payload.get('username','')).lower()
    role=payload.get('role','viewer'); g=payload.get('grants',[])
    if not username_ok(name) or role not in ('admin','editor','viewer') or not isinstance(g,list) or not all(isinstance(item,str) and item in GRANTS for item in g):self.reply(400,{'error':'Μη έγκυρος χρήστης ή δικαιώματα.'});return
    password=secrets.token_urlsafe(20)
    try:
     db.execute('INSERT INTO users(username,hash,role,grants,created) VALUES (?,?,?,?,?)',(name,password_hash(password),role,json.dumps(g),int(time.time())))
    except sqlite3.IntegrityError:self.reply(409,{'error':'Το όνομα υπάρχει ήδη.'});return
    audit(db,user['username'],'user-created',name)
    self.reply(201,{'username':name,'temporaryPassword':password});return
   match=re.fullmatch(r'/api/admin/users/(\d+)',path)
   if match and self.command=='PATCH':
    target=int(match.group(1));role=payload.get('role');g=payload.get('grants');enabled=payload.get('enabled')
    if role not in ('admin','editor','viewer') or not isinstance(g,list) or not all(isinstance(item,str) and item in GRANTS for item in g) or type(enabled) is not bool:self.reply(400,{'error':'Μη έγκυρα δικαιώματα.'});return
    before=db.execute('SELECT * FROM users WHERE id=?',(target,)).fetchone()
    if not before:self.reply(404,{'error':'Ο χρήστης δεν βρέθηκε.'});return
    if before['id']==user['id'] and (role!='admin' or not enabled):self.reply(400,{'error':'Δεν μπορείς να αφαιρέσεις τη δική σου διαχειριστική πρόσβαση.'});return
    if before['role']=='admin' and (role!='admin' or not enabled):
     count=db.execute("SELECT count(*) FROM users WHERE role='admin' AND enabled=1").fetchone()[0]
     if count<=1:self.reply(400,{'error':'Πρέπει να παραμείνει ένας ενεργός διαχειριστής.'});return
    db.execute('UPDATE users SET role=?,grants=?,enabled=? WHERE id=?',(role,json.dumps(g),int(enabled),target))
    if not enabled:db.execute('DELETE FROM sessions WHERE user_id=?',(target,))
    audit(db,user['username'],'user-updated',before['username'])
    self.reply(200,{'ok':True});return
   self.reply(404,{'error':'Δεν βρέθηκε.'})
def bootstrap():
 init()
 with transaction() as db:
  if db.execute("SELECT COUNT(*) FROM users WHERE role='admin'").fetchone()[0]:
   print('Admin already exists. No bootstrap credentials were changed.');return
  name=input('Admin username (lowercase): ').strip().lower()
  if not username_ok(name):raise SystemExit('Username must be 3-32 lowercase ASCII letters, digits, _, . or -')
  password=getpass.getpass('Admin password (min 12 characters): ')
  confirmation=getpass.getpass('Repeat password: ')
  if len(password)<12 or password!=confirmation:raise SystemExit('Password invalid or mismatch')
  db.execute('INSERT INTO users(username,hash,role,grants,created) VALUES (?,?,?,?,?)',(name,password_hash(password),'admin','[]',int(time.time())))
  audit(db,name,'bootstrap')
 print('Administrator created. No password was printed or stored in Git.')
if __name__=='__main__':
 if len(sys.argv)>1 and sys.argv[1]=='bootstrap':bootstrap()
 else:
  init()
  ThreadingHTTPServer(('127.0.0.1',int(os.environ.get('KAPAVITA_ADMIN_PORT','8787'))),Handler).serve_forever()
