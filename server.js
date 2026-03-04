const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Client, PrivateKey } = require('@hiveio/dhive');

const app = express();
app.use(cors());

// --- HIVE CONFIGURATION ---
const client = new Client(["https://api.hive.blog", "https://api.deathwing.me"]);
const ACCOUNT_NAME = 'cbrs'; // Your trusted bank account
const ACTIVE_KEY = process.env.HIVE_ACTIVE_KEY ? PrivateKey.fromString(process.env.HIVE_ACTIVE_KEY) : null;

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

io.on('connection', (socket) => {
    console.log(`📡 New Wheel Connection: ${socket.id}`);

    // --- WHEEL OF NAMES AUTOMATIC PAYOUTS ---
    socket.on('process_wheel_payouts', async (data) => {
        const { hostName, winners } = data; 
        
        if (!ACTIVE_KEY) {
            console.log("❌ Wheel Payout Error: cbrs Active Key not set.");
            socket.emit('wheel_payout_result', { success: false, message: "Server misconfiguration. Active Key missing." });
            return;
        }

        console.log(`🎁 Escrow complete! Paying ${winners.length} winners for host: ${hostName}`);
        
        // Loop through and automatically pay every winner from the cbrs bank
        for (const winner of winners) {
            if (winner.prize <= 0) continue;
            try {
                // Ensure the prize string is formatted perfectly for Hive ("0.000 HIVE")
                const amountFormatted = parseFloat(winner.prize).toFixed(3) + " HIVE";
                
                await client.broadcast.transfer({ 
                    from: ACCOUNT_NAME, 
                    to: winner.name, 
                    amount: amountFormatted, 
                    memo: `🎉 You won the Hive Wheel Giveaway hosted by @${hostName}!` 
                }, ACTIVE_KEY);
                
                console.log(`✅ Wheel Payout Success: ${amountFormatted} sent to ${winner.name}`);
            } catch (err) { 
                console.error(`❌ Wheel Payout Failed for ${winner.name}:`, err.message); 
            }
        }
        
        // Alert the frontend that the server finished its job
        socket.emit('wheel_payout_result', { success: true });
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Disconnected: ${socket.id}`);
    });
});

// I set this to 3001 so it doesn't conflict with your Hivecade server (3000) if you test locally!
const PORT = process.env.PORT || 3001; 
server.listen(PORT, () => {
    console.log(`🚀 Hive Wheel Giveaway Server running on port ${PORT}`);
    if (!ACTIVE_KEY) {
        console.log("⚠️ WARNING: HIVE_ACTIVE_KEY environment variable is not set! Payouts will fail.");
    } else {
        console.log("✅ Active Key loaded successfully.");
    }
});
