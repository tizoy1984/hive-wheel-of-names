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

        console.log(`🎁 Escrow complete! Preparing to pay ${winners.length} winners for host: ${hostName}`);
        
        // 1. Create an empty array to hold all of our bundled transactions
        const operations = [];
        
        // 2. Loop through the winners and build the operations
        for (const winner of winners) {
            if (winner.prize <= 0) continue;
            
            const amountFormatted = parseFloat(winner.prize).toFixed(3) + " HIVE";
            
            // Push the transfer operation into our bundle
            operations.push([
                'transfer',
                {
                    from: ACCOUNT_NAME, 
                    to: winner.name, 
                    amount: amountFormatted, 
                    memo: `🎉 You won the Hive Wheel Giveaway hosted by @${hostName}!` 
                }
            ]);
        }

        // Safety check just in case there are no valid prizes
        if (operations.length === 0) {
            socket.emit('wheel_payout_result', { success: true });
            return;
        }

        // 3. Broadcast the entire bundle in ONE single transaction!
        try {
            await client.broadcast.sendOperations(operations, ACTIVE_KEY);
            console.log(`✅ SUCCESS: Bulk payout of ${operations.length} transfers completed at once!`);
            
            // Alert the frontend that the server finished its job
            socket.emit('wheel_payout_result', { success: true });
        } catch (err) { 
            console.error(`❌ Bulk Payout Failed:`, err.message); 
            socket.emit('wheel_payout_result', { success: false, message: "Blockchain rejected the transfer." });
        }
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
