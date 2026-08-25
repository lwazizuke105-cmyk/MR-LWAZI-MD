const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req,res)=>{
  res.send(`
  <html><head><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{background:#111;color:#fff;text-align:center;padding:20px;font-family:sans-serif}
  .box{background:#222;padding:20px;border-radius:15px;max-width:380px;margin:auto}
  </style></head><body>
  <div class="box"><h2>LWAZI-MD is Running ✅</h2>
  <p>Bot is LIVE on Render</p>
  <p>If not paired, check Render Logs for Pairing Code</p>
  <p>Number format: 234...</p>
  </div></body></html>`);
});

app.listen(PORT, ()=>console.log('Web server live on '+PORT));

// Now start your real bot
require('./main.js');