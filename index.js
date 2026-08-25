const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let sock = null;

const pairingHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MR LWAZI-MD · Premium Pairing Portal</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,600;14..32,700;14..32,800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif}
body{min-height:100vh;display:flex;justify-content:center;align-items:center;background:#0b0e14;background-image:radial-gradient(ellipse at 20% 50%, rgba(56,189,248,0.08) 0%, transparent 60%),radial-gradient(ellipse at 80% 50%, rgba(37,211,102,0.05) 0%, transparent 60%),linear-gradient(180deg,#0b0e14 0%,#151e2b 100%);padding:20px}
.card{width:420px;max-width:100%;background:rgba(18,26,40,0.75);backdrop-filter:blur(24px) saturate(1.4);border:1px solid rgba(255,255,255,0.06);border-radius:32px;padding:36px 28px 28px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,0.6);position:relative;overflow:hidden}
.avatar{width:100px;height:100px;border-radius:50%;background:linear-gradient(135deg,#0f2a3a,#1a3a4a);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:44px;color:#38bdf8;border:2px solid rgba(56,189,248,0.15);box-shadow:0 0 40px rgba(56,189,248,0.08)}
h1{font-size:28px;font-weight:800;background:linear-gradient(135deg,#f0f9ff 0%,#7dd3fc 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px}
.subtitle{color:rgba(255,255,255,0.45);font-size:13px;margin-bottom:22px;border-bottom:1px solid rgba(255,255,255,0.04);padding-bottom:18px}
.input-wrap{position:relative;margin-bottom:14px}.input-wrap i{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.2);font-size:14px}
input{width:100%;padding:16px 16px 16px 46px;border:1px solid rgba(255,255,255,0.06);border-radius:14px;outline:none;background:rgba(255,255,255,0.04);color:#f0f9ff;font-size:14px}
.btn{width:100%;padding:16px;border:none;border-radius:14px;cursor:pointer;font-size:14px;font-weight:600;color:#fff;background:linear-gradient(135deg,#0f2a3a,#1a4a5a);border:1px solid rgba(56,189,248,0.08);display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px}
.btn-success{background:linear-gradient(135deg,#0b2a1a,#1a4a2a);border-color:rgba(37,211,102,0.08)}.btn i{color:#38bdf8}.btn-success i{color:#25D366}
#status{margin-top:16px;color:rgba(255,255,255,0.5);font-size:13px;min-height:24px;word-break:break-all}
#codeDisplay{font-size:32px;color:#25D366;letter-spacing:6px;font-weight:800;margin:10px 0;font-family:monospace;display:none}
.info{display:flex;justify-content:space-between;gap:10px;margin-top:22px}
.box{flex:1;background:rgba(255,255,255,0.03);padding:12px 8px;border-radius:12px;color:rgba(255,255,255,0.4);font-size:12px;border:1px solid rgba(255,255,255,0.03);display:flex;align-items:center;justify-content:center;gap:8px}
.footer{margin-top:22px;color:rgba(255,255,255,0.15);font-size:11px;border-top:1px solid rgba(255,255,255,0.03);padding-top:16px}
.spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(56,189,248,0.1);border-top-color:#38bdf8;border-radius:50%;animation:spin 0.7s linear infinite;margin-right:6px}
@keyframes spin{to{transform:rotate(360deg)}}
</style></head><body>
<div class="card">
<div class="avatar"><i class="fas fa-bolt"></i></div>
<h1>MR LWAZI-MD</h1>
<div class="subtitle"><i class="fas fa-link"></i> Premium WhatsApp Pairing Portal</div>
<div class="input-wrap"><i class="fas fa-phone"></i><input type="text" id="number" placeholder="Enter WhatsApp number e.g 234..."></div>
<div id="codeDisplay"></div>
<button class="btn" onclick="generatePair()"><i class="fas fa-bolt"></i><span>Generate Pair Code</span></button>
<button class="btn btn-success" onclick="window.open('https://whatsapp.com/channel/0029VbDK7drI1rcoEQNE1K3S','_blank')"><i class="fab fa-whatsapp"></i><span>Join WhatsApp Channel</span></button>
<div id="status"><i class="fas fa-circle" style="font-size:6px;color:rgba(255,255,255,0.08)"></i> Ready</div>
<div class="info"><div class="box"><i class="fas fa-lock"></i> Secure</div><div class="box"><i class="fas fa-bolt"></i> Fast</div><div class="box"><i class="fas fa-globe"></i> Online</div></div>
<div class="footer">Powered by FLASHPOINT TECH</div>
</div>
<script>
async function generatePair(){
 let number=document.getElementById("number").value.trim();
 const statusEl=document.getElementById("status");
 const codeEl=document.getElementById("codeDisplay");
 if(!number){statusEl.innerHTML='<i class="fas fa-circle-exclamation" style="color:#f87171"></i> Enter number';return;}
 number=number.replace(/[^0-9]/g,'');
 if(number.length<10){statusEl.innerHTML='<i class="fas fa-circle-exclamation" style="color:#f87171"></i> Invalid number';return;}
 statusEl.innerHTML='<span class="spinner"></span> Generating for +'+number+' ...';
 codeEl.style.display='none';
 try{
   const res=await fetch('/pair?number='+number);
   const data=await res.json();
   if(data.code){
     codeEl.textContent=data.code;
     codeEl.style.display='block';
     statusEl.innerHTML='<i class="fas fa-check-circle" style="color:#34d399"></i> Code: <b style="color:#34d399">'+data.code+'</b><br><span style="font-size:11px;opacity:0.6">Enter in WhatsApp > Linked Devices > Link with phone number</span>';
   }else{
     statusEl.innerHTML='<i class="fas fa-circle-exclamation" style="color:#f87171"></i> '+(data.error||'Failed, check Render logs');
   }
 }catch(e){statusEl.innerHTML='<i class="fas fa-circle-exclamation" style="color:#f87171"></i> Server error';}
}
document.getElementById("number").addEventListener("keydown",e=>{if(e.key==="Enter")generatePair()});
</script>
</body></html>`;

app.get('/', (req,res)=> res.send(pairingHTML));

async function startPair(number){
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  sock = makeWASocket({
    auth: state,
    logger: pino({level:'silent'}),
    printQRInTerminal: false,
    browser: ["MR LWAZI-MD", "Chrome", "1.0"]
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update)=>{
    if(update.connection==='open'){
      console.log('Bot connected!');
      // Load main bot after paired
      try{ require('./main.js'); }catch(e){console.log('main.js not loaded',e.message)}
    }
  });
  await delay(1000);
  if(!sock.authState.creds.registered){
    const code = await sock.requestPairingCode(number);
    return code;
  } else {
    return null;
  }
}

app.get('/pair', async (req,res)=>{
  let number = req.query.number;
  if(!number) return res.json({error:'No number'});
  number = number.replace(/[^0-9]/g,'');
  try{
    const code = await startPair(number);
    if(code) res.json({code: code});
    else res.json({error: 'Already registered, delete session folder'});
  }catch(e){
    console.log(e);
    res.json({error: e.message});
  }
});

app.listen(PORT, ()=> console.log('MR LWAZI-MD Pairing server live on '+PORT));

// If already has session, start bot directly
if(fs.existsSync('./session/creds.json')){
  console.log('Session exists, starting main bot...');
  require('./main.js');
}