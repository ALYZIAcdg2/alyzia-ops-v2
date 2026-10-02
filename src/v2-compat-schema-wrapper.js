import app from "./audit-entry-wrapper.js";

let schemaReady=false;
let schemaPromise=null;

async function hasColumn(env,table,column){
  const {results=[]}=await env.OPS_DB.prepare(`PRAGMA table_info(${table})`).all();
  return results.some(r=>String(r.name||"").toLowerCase()===String(column||"").toLowerCase());
}

async function ensureCompatSchema(env){
  if(schemaReady)return;
  if(schemaPromise)return schemaPromise;
  schemaPromise=(async()=>{
    await env.OPS_DB.prepare(`
      CREATE TABLE IF NOT EXISTS airline_profiles (
        airline TEXT PRIMARY KEY,
        import_mode TEXT NOT NULL DEFAULT 'GENERIC',
        visible_kpis_json TEXT NOT NULL DEFAULT '{}',
        visible_cards_json TEXT NOT NULL DEFAULT '{}',
        notes_enabled INTEGER NOT NULL DEFAULT 1,
        attachments_enabled INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await env.OPS_DB.prepare(`
      CREATE TABLE IF NOT EXISTS prepa_inbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gmail_message_id TEXT UNIQUE,
        gmail_thread_id TEXT,
        source TEXT,
        airline TEXT,
        flight_number TEXT,
        flight_date TEXT,
        subject TEXT,
        sender TEXT,
        received_at TEXT,
        body_text TEXT,
        drive_folder_id TEXT,
        drive_email_pdf_id TEXT,
        attachments_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'PENDING',
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at TEXT
      )
    `).run();
    await env.OPS_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_prepa_inbox_status ON prepa_inbox(status,updated_at)`).run();
    await env.OPS_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_prepa_inbox_flight ON prepa_inbox(airline,flight_number,flight_date)`).run();

    // 0001_v2_core created cabin_configs before the copied V1 backend schema.
    // CREATE TABLE IF NOT EXISTS cannot add the later source_label column, so
    // repair that one schema drift explicitly and idempotently.
    if(!(await hasColumn(env,"cabin_configs","source_label"))){
      await env.OPS_DB.prepare(`ALTER TABLE cabin_configs ADD COLUMN source_label TEXT`).run();
    }

    schemaReady=true;
  })();
  try{return await schemaPromise}
  catch(e){schemaPromise=null;throw e}
}

function needsCompat(pathname){
  return pathname.startsWith("/api/airline-profiles") ||
    pathname.startsWith("/api/prepa") ||
    pathname.startsWith("/api/cabin");
}

export default {
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname;
    if(needsCompat(path)){
      try{await ensureCompatSchema(env)}
      catch(e){
        return new Response(JSON.stringify({ok:false,error:"V2_SCHEMA_COMPAT",detail:String(e?.message||e)}),{
          status:500,
          headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}
        });
      }
    }
    return app.fetch(request,env,ctx);
  },
  scheduled(controller,env,ctx){
    if(typeof app.scheduled==="function")return app.scheduled(controller,env,ctx);
  }
};
