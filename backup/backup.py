import os, subprocess, tempfile, hashlib, datetime, json
import boto3
from botocore.config import Config
required=['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','S3_ENDPOINT','S3_BUCKET']
for name in required:
    if not os.environ.get(name): raise RuntimeError('Missing '+name)
s3=boto3.client('s3',endpoint_url=os.environ['S3_ENDPOINT'],region_name=os.environ.get('AWS_DEFAULT_REGION','auto'),config=Config(s3={'addressing_style':'virtual'}))
bucket=os.environ['S3_BUCKET']
with tempfile.TemporaryDirectory() as tmp:
    dump=tmp+'/butterfly.dump'
    subprocess.run(['pg_dump','--format=custom','--no-owner','--no-acl','--file',dump],check=True)
    subprocess.run(['pg_restore','--list',dump],check=True,stdout=subprocess.DEVNULL)
    digest=hashlib.file_digest(open(dump,'rb'),'sha256').hexdigest()
    key='daily/'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d/%H%M%S')+'-'+digest[:12]+'.dump'
    s3.upload_file(dump,bucket,key,ExtraArgs={'Metadata':{'sha256':digest}})
    recovered=tmp+'/downloaded.dump';s3.download_file(bucket,key,recovered)
    if hashlib.file_digest(open(recovered,'rb'),'sha256').hexdigest()!=digest: raise RuntimeError('Backup verification failed')
    # Restore into a disposable local PostgreSQL instance, never the source database.
    data=tmp+'/restore-db';os.chmod(tmp,0o755)
    subprocess.run(['mkdir',data],check=True);subprocess.run(['chown','postgres:postgres',data],check=True)
    subprocess.run(['su-exec','postgres','initdb','-D',data,'-A','trust'],check=True,stdout=subprocess.DEVNULL)
    subprocess.run(['su-exec','postgres','pg_ctl','-D',data,'-o','-p 55432 -h 127.0.0.1','-w','start'],check=True,stdout=subprocess.DEVNULL)
    env={**os.environ,'PGHOST':'127.0.0.1','PGPORT':'55432','PGUSER':'postgres','PGDATABASE':'postgres','PGPASSWORD':''}
    try:
        subprocess.run(['pg_restore','--exit-on-error','--no-owner','--no-acl','--dbname','postgres',recovered],env=env,check=True)
        count=subprocess.check_output(['psql','-Atc','SELECT count(*) FROM nodes'],env=env,text=True).strip()
        if int(count)<64: raise RuntimeError('Restored database is missing expected seed data')
        print(json.dumps({'event':'backup_verified','object':key,'sha256':digest,'restored_nodes':int(count)}),flush=True)
    finally:
        subprocess.run(['su-exec','postgres','pg_ctl','-D',data,'-m','fast','-w','stop'],stdout=subprocess.DEVNULL,check=True)
