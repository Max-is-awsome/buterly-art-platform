import express from 'express';import pg from 'pg';import session from 'express-session';import pgSession from 'connect-pg-simple';import passport from 'passport';import {Strategy} from 'passport-google-oauth20';import helmet from 'helmet';import {rateLimit} from 'express-rate-limit';import {readFile} from 'node:fs/promises';import {artworkSchema,decodeMedia,profileSchema} from './validation.mjs';
for(const key of ['DATABASE_URL','SESSION_SECRET','PUBLIC_ORIGIN'])if(!process.env[key])throw Error(`Missing ${key}`);
if(process.env.SESSION_SECRET.length<32)throw Error('SESSION_SECRET must contain at least 32 characters');
const origin=new URL(process.env.PUBLIC_ORIGIN).origin;const production=process.env.NODE_ENV==='production';const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10});await pool.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
const seed=JSON.parse(await readFile(new URL('./seed.json',import.meta.url),'utf8'));const db=await pool.connect();try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(421109)');for(const n of seed){const {id,parents,...data}=n;await db.query('INSERT INTO nodes(id,data) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,data])}for(const n of seed)for(const p of n.parents)await db.query('INSERT INTO ripples VALUES($1,$2) ON CONFLICT DO NOTHING',[p,n.id]);await db.query("SELECT setval(pg_get_serial_sequence('nodes','id'),GREATEST((SELECT MAX(id) FROM nodes),64))");await db.query('COMMIT')}catch(e){await db.query('ROLLBACK');throw e}finally{db.release()}
const app=express();app.set('trust proxy',1);app.disable('x-powered-by');app.use(helmet());app.use('/api',rateLimit({windowMs:60000,limit:180}));app.use(express.json({limit:'14mb'}));app.use(session({store:new(pgSession(session))({pool,createTableIfMissing:true}),secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,name:'butterfly.sid',cookie:{httpOnly:true,secure:production,sameSite:'lax',maxAge:7*86400000}}));
const googleConfigured=!!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET);if(googleConfigured)passport.use(new Strategy({clientID:process.env.GOOGLE_CLIENT_ID,clientSecret:process.env.GOOGLE_CLIENT_SECRET,callbackURL:`${origin}/api/auth/google/callback`,state:true},async(_access,_refresh,profile,done)=>{try{if(!profile._json.email_verified)return done(null,false);const result=await pool.query('INSERT INTO users(google_id,email) VALUES($1,$2) ON CONFLICT(google_id) DO UPDATE SET email=EXCLUDED.email RETURNING id',[profile.id,profile.emails[0].value]);done(null,{id:result.rows[0].id})}catch(e){done(e)}}));passport.serializeUser((u,done)=>done(null,u.id));passport.deserializeUser(async(id,done)=>{try{const r=await pool.query('SELECT id FROM users WHERE id=$1',[id]);done(null,r.rows[0]||false)}catch(e){done(e)}});app.use(passport.initialize());app.use(passport.session());
app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')!==origin)return res.status(403).json({error:'Untrusted request origin'});next()});
const auth=(req,res,next)=>req.user?next():res.status(401).json({error:'Sign in with Google to continue'});
app.get('/api/health',async(_req,res)=>{await pool.query('SELECT 1');res.json({ok:true})});app.get('/api/auth/google',(req,res,next)=>googleConfigured?next():res.status(503).send('Google sign-in is being configured. Public exploration remains available.'),passport.authenticate('google',{scope:['openid','email']}));app.get('/api/auth/google/callback',passport.authenticate('google',{failureRedirect:'/?signin=failed'}),(_req,res)=>res.redirect('/'));
app.get('/api/me',(req,res)=>res.json({user:req.user?{id:Number(req.user.id)}:null,googleConfigured}));app.post('/api/logout',(req,res,next)=>req.logout(e=>{if(e)return next(e);req.session.destroy(()=>{res.clearCookie('butterfly.sid');res.json({ok:true})})}));
app.get('/api/profile', auth, async (req, res) => {
  const result = await pool.query(
    'SELECT display_name AS "displayName", bio, links FROM artist_profiles WHERE user_id=$1',
    [req.user.id]
  );
  res.json(result.rows[0] ?? {displayName: '', bio: '', links: {}});
});
app.put('/api/profile', auth, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: parsed.error.issues[0].message});
  const {displayName, bio, links} = parsed.data;
  if (!displayName) {
    await pool.query(
      `WITH cleared AS (DELETE FROM artist_profiles WHERE user_id=$1)
       UPDATE nodes SET show_artist=false WHERE author_id=$1 AND show_artist`,
      [req.user.id]
    );
  } else {
    const result = await pool.query(
      `INSERT INTO artist_profiles (user_id, display_name, bio, links)
       VALUES ($1,$2,$3,COALESCE($4::jsonb,'{}'::jsonb))
       ON CONFLICT (user_id) DO UPDATE SET display_name=EXCLUDED.display_name,
         bio=EXCLUDED.bio, links=COALESCE($4::jsonb,artist_profiles.links)
       RETURNING display_name AS "displayName", bio, links`,
      [req.user.id, displayName, bio, links ?? null]
    );
    return res.json(result.rows[0]);
  }
  res.json({displayName, bio, links: {}});
});
app.put('/api/nodes/:id/credit', auth, async (req, res) => {
  const id = Number(req.params.id);
  const showArtist = req.body?.showArtist;
  if (!Number.isSafeInteger(id) || id < 0 || typeof showArtist !== 'boolean') {
    return res.status(400).json({error: 'Invalid artwork or credit setting.'});
  }
  const result = await pool.query(
    'UPDATE nodes SET show_artist=$1 WHERE id=$2 AND author_id=$3',
    [showArtist, id, req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({error: 'Artwork not found.'});
  res.json({ok: true});
});
app.get('/api/nodes', async (req, res) => {
  const result = await pool.query(`
    SELECT n.id, n.author_id, n.data, n.show_artist, p.display_name, p.bio, p.links,
      ARRAY(SELECT parent_id FROM ripples WHERE child_id=n.id ORDER BY parent_id) AS parents
    FROM nodes n
    LEFT JOIN artist_profiles p ON p.user_id=n.author_id AND n.show_artist
    ORDER BY n.id LIMIT 10000
  `);
  res.json(result.rows.map(n => {
    const mine = !!req.user && String(n.author_id) === String(req.user.id);
    return {
      ...n.data, id: Number(n.id), parents: n.parents.map(Number), mine,
      artist: n.display_name ? {displayName: n.display_name, bio: n.bio, links: n.links} : null,
      ...(mine ? {showArtist: n.show_artist} : {})
    };
  }));
});
app.post('/api/nodes',auth,rateLimit({windowMs:3600000,limit:30}),async(req,res)=>{const parsed=artworkSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Check the title, artwork, medium, and inspirations.'});const n=parsed.data;let bytes;try{if(n.url)bytes=decodeMedia(n.url,n.mime)}catch(e){return res.status(400).json({error:e.message})}const c=await pool.connect();try{await c.query('BEGIN');const p=await c.query('SELECT id,data FROM nodes WHERE id=ANY($1::bigint[])',[n.parents]);if(p.rowCount!==n.parents.length){await c.query('ROLLBACK');return res.status(400).json({error:'An inspiration no longer exists'})}const pos=p.rows[0].data.pos;const data={title:n.title,medium:n.medium,statement:n.statement,text:n.text,pos:[pos[0]+1.2,pos[1]+1.4,pos[2]+1]};if(bytes){const m=await c.query('INSERT INTO media(author_id,mime,bytes) VALUES($1,$2,$3) RETURNING id',[req.user.id,n.mime,bytes]);data.url=`/api/media/${m.rows[0].id}`;data.mime=n.mime}const r=await c.query('INSERT INTO nodes(author_id,data,show_artist) VALUES($1,$2,$3) RETURNING id',[req.user.id,data,n.showArtist]);const id=Number(r.rows[0].id);for(const parent of n.parents)await c.query('INSERT INTO ripples VALUES($1,$2)',[parent,id]);await c.query('DELETE FROM drafts WHERE user_id=$1',[req.user.id]);await c.query('COMMIT');res.status(201).json({...data,id,parents:n.parents,mine:true,showArtist:n.showArtist})}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}});
app.get('/api/media/:id',async(req,res)=>{if(!/^\d+$/.test(req.params.id))return res.sendStatus(404);const r=await pool.query('SELECT mime,bytes FROM media WHERE id=$1',[req.params.id]);if(!r.rowCount)return res.sendStatus(404);res.set('Content-Type',r.rows[0].mime).set('Cache-Control','public,max-age=86400').send(r.rows[0].bytes)});
app.get('/api/private',auth,async(req,res)=>{const[d,b]=await Promise.all([pool.query('SELECT data FROM drafts WHERE user_id=$1',[req.user.id]),pool.query('SELECT node_id FROM bookmarks WHERE user_id=$1',[req.user.id])]);res.json({draft:d.rows[0]?.data||null,saved:b.rows.map(x=>Number(x.node_id))})});app.put('/api/draft',auth,async(req,res)=>{if(JSON.stringify(req.body).length>60000)return res.status(400).json({error:'Draft too large'});await pool.query('INSERT INTO drafts(user_id,data) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()',[req.user.id,req.body]);res.json({ok:true})});app.put('/api/bookmarks/:id',auth,async(req,res)=>{if(!/^\d+$/.test(req.params.id))return res.sendStatus(400);if(req.body.saved)await pool.query('INSERT INTO bookmarks VALUES($1,$2) ON CONFLICT DO NOTHING',[req.user.id,req.params.id]);else await pool.query('DELETE FROM bookmarks WHERE user_id=$1 AND node_id=$2',[req.user.id,req.params.id]);res.json({ok:true})});
app.post('/api/reports',auth,async(req,res)=>{const reason=String(req.body.reason||'').trim();if(!Number.isSafeInteger(req.body.nodeId)||reason.length<5||reason.length>2000)return res.status(400).json({error:'Provide an artwork and a reason (5–2000 characters)'});await pool.query('INSERT INTO reports(user_id,node_id,reason) VALUES($1,$2,$3)',[req.user.id,req.body.nodeId,reason]);res.status(201).json({ok:true})});
app.use((err,req,res,_next)=>{console.error('Request failed',req.method,req.path,err.code||err.name);res.status(err.status===413?413:500).json({error:err.status===413?'Upload is too large':'Unable to complete request. Please try again.'})});const server=app.listen(Number(process.env.PORT||3000),'0.0.0.0');process.on('SIGTERM',()=>server.close(()=>pool.end().then(()=>process.exit(0))));
