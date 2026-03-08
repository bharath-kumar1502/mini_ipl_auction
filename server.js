const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 8000;

app.use(express.static(path.join(__dirname, '/')));

const { teamsData, playersData: auctionPlayers } = require('./js/data.js');

// Helper to shuffle players per room grouped sequentially by their Set order (M1, BA1, etc)
function shuffleBySet(array) {
    const setGroups = [];
    let currentSet = "";
    let currentGroup = [];

    for (const p of array) {
        if (p.set !== currentSet) {
            if (currentGroup.length > 0) setGroups.push(currentGroup);
            currentSet = p.set;
            currentGroup = [];
        }
        currentGroup.push(p);
    }
    if (currentGroup.length > 0) setGroups.push(currentGroup);

    const finalQueue = [];
    for (const group of setGroups) {
        const arr = [...group];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        finalQueue.push(...arr);
    }
    return finalQueue;
}

// Dictionary to hold all active rooms
const rooms = {};

// Helper to generate a unique 4 char room code
function generateRoomCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code;
    do {
        code = "";
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (rooms[code]);
    return code;
}

// Helper to get counts for rule enforcement
function getOverseasCount(team) {
    const retainedOS = (team.retained || []).filter(p => p.country && p.country !== "India").length;
    const boughtOS = (team.squad || []).filter(p => p.country && p.country !== "India").length;
    return retainedOS + boughtOS;
}

function getTotalSquadSize(team) {
    return (team.retained || []).length + (team.squad || []).length;
}

// Helper to sanitize state for sending to clients
function getClientState(room) {
    const { timerInterval, ...safeState } = room;
    return safeState;
}

// Start Server
server.listen(PORT, () => {
    console.log(`IPL Auction Server running on http://localhost:${PORT}`);
});

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('createRoom', ({ username }) => {
        const code = generateRoomCode();
        rooms[code] = {
            code: code,
            users: {},
            assignedTeams: [],
            teams: JSON.parse(JSON.stringify(teamsData)),
            players: shuffleBySet(auctionPlayers),
            auctionStarted: false,
            currentPlayerIndex: 0,
            currentBid: 0,
            highestBidderId: null,
            timer: 10,
            timerInterval: null
        };
        socket.join(code);

        socket.emit('roomCreated', { code, state: getClientState(rooms[code]) });
    });

    socket.on('joinRoom', ({ username, roomCode }) => {
        if (!rooms[roomCode]) {
            socket.emit('errorMsg', "Invalid Room Code. It may have expired.");
            return;
        }
        socket.join(roomCode);
        socket.emit('roomJoined', { code: roomCode, state: getClientState(rooms[roomCode]) });
    });

    socket.on('selectTeam', ({ roomCode, teamId, username }) => {
        const room = rooms[roomCode];
        if (!room) return;

        if (room.assignedTeams.includes(teamId)) {
            socket.emit('errorMsg', "Team already selected in this room.");
            return;
        }

        room.users[socket.id] = { username, teamId, roomCode };
        room.assignedTeams.push(teamId);

        // Update everyone in this room
        io.to(roomCode).emit('gameStateUpdate', getClientState(room));
    });

    socket.on('placeBid', ({ roomCode, teamId, bidAmount }) => {
        const room = rooms[roomCode];
        if (!room || !room.auctionStarted) return;

        const team = room.teams.find(t => t.id === teamId);
        const currentPlayer = room.players[room.currentPlayerIndex];

        if (!team || !currentPlayer) return;

        // RULE ENFORCEMENT
        if (getTotalSquadSize(team) >= 25) {
            socket.emit('errorMsg', "Squad is full (Max 25 players).");
            return;
        }

        if (currentPlayer.country !== "India" && getOverseasCount(team) >= 9) {
            socket.emit('errorMsg', "Overseas limit reached (Max 9 players).");
            return;
        }

        const remainingSlotsNeeded = Math.max(0, 17 - getTotalSquadSize(team)); // 17 because if we win this one, we have 18-currentSize-1 more to go
        const reservedBudget = remainingSlotsNeeded * 2000000; // 20 Lakhs base price reserve

        if (team.budget - bidAmount < reservedBudget) {
            socket.emit('errorMsg', `Insufficient funds to meet Minimum 18 player rule. Need to reserve ${reservedBudget / 10000000} Cr.`);
            return;
        }

        if (bidAmount > room.currentBid && team.budget >= bidAmount) {
            room.currentBid = bidAmount;
            room.highestBidderId = teamId;
            room.timer = 10;

            console.log(`[BID ACCEPTED] Room ${roomCode}: ${teamId} bid ${bidAmount}`);

            io.to(roomCode).emit('bidAccepted', {
                currentBid: room.currentBid,
                highestBidderId: room.highestBidderId,
                timer: room.timer
            });
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);

        // Find if they were in a room
        for (const code in rooms) {
            const room = rooms[code];
            if (room.users[socket.id]) {
                const teamId = room.users[socket.id].teamId;
                room.assignedTeams = room.assignedTeams.filter(id => id !== teamId);
                delete room.users[socket.id];

                io.to(code).emit('gameStateUpdate', getClientState(room));

                // If room empty and game hasn't really started, we can delete it
                if (Object.keys(room.users).length === 0 && !room.auctionStarted) {
                    delete rooms[code];
                }
            }
        }
    });

    socket.on('startAuction', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (room && !room.auctionStarted) {
            console.log(`[AUCTION STARTING] Room ${roomCode}`);
            room.auctionStarted = true;
            io.to(roomCode).emit('auctionStarted');

            // Ensure any late joiners or existing players get the updated state
            io.to(roomCode).emit('gameStateUpdate', getClientState(room));

            startTimer(roomCode);
        }
    });
});

// Server-side Timer Logic Per Room
function startTimer(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    if (room.timerInterval) clearInterval(room.timerInterval);

    room.timerInterval = setInterval(() => {
        room.timer--;
        io.to(roomCode).emit('timerTick', room.timer);

        if (room.timer === 7 || room.timer === 4) {
            triggerAIBid(roomCode);
        }

        if (room.timer <= 0) {
            clearInterval(room.timerInterval);
            resolveAuction(roomCode);
        }
    }, 1000);
}

function nextBidIncrement(current, room) {
    if (current === 0) return room.players[room.currentPlayerIndex].basePrice;
    if (current < 10000000) return current + 500000;   // 5 Lakhs below 1Cr
    if (current < 20000000) return current + 1000000;  // 10 Lakhs below 2Cr
    return current + 2000000;                          // 20 Lakhs above 2Cr
}

function triggerAIBid(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    const currentPlayer = room.players[room.currentPlayerIndex];
    if (!currentPlayer) return;

    // AI only considers unassigned teams (it will not bid for teams owned by users)
    const aiTeams = room.teams.filter(t => !room.assignedTeams.includes(t.id));
    if (aiTeams.length === 0) return;

    let interestedTeams = aiTeams.filter(team => {
        const nextPrice = nextBidIncrement(room.currentBid, room);

        if (team.budget < nextPrice) return false;
        if (room.highestBidderId === team.id) return false;

        // RULE ENFORCEMENT for AI
        if (getTotalSquadSize(team) >= 25) return false;
        if (currentPlayer.country !== "India" && getOverseasCount(team) >= 9) return false;

        const slotsNeededAI = Math.max(0, 17 - getTotalSquadSize(team));
        if (team.budget - nextPrice < (slotsNeededAI * 2000000)) return false;


        let baseValuation = currentPlayer.basePrice * (currentPlayer.rating / 40);
        let budgetMultiplier = Math.max(0.5, team.budget / 200000000); // Richer teams bid more
        let maxValuation = baseValuation * budgetMultiplier;


        // Add random variance
        maxValuation = maxValuation * (Math.random() * 0.4 + 0.8);

        return nextPrice <= maxValuation;
    });

    if (interestedTeams.length > 0) {
        const biddingTeam = interestedTeams[Math.floor(Math.random() * interestedTeams.length)];
        const nextBid = nextBidIncrement(room.currentBid, room);

        room.currentBid = nextBid;
        room.highestBidderId = biddingTeam.id;
        room.timer = 10;

        console.log(`[AI] ${biddingTeam.shortName} bids ${nextBid} for ${currentPlayer.name}`);

        io.to(roomCode).emit('bidAccepted', {
            currentBid: room.currentBid,
            highestBidderId: room.highestBidderId,
            timer: room.timer
        });
    }
}

function resolveAuction(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    const currentPlayer = room.players[room.currentPlayerIndex];

    if (room.currentBid > 0 && room.highestBidderId) {
        // Officially deduct budget and add player to squad on the server state
        const buyer = room.teams.find(t => t.id === room.highestBidderId);
        if (buyer) {
            buyer.budget -= room.currentBid;
            buyer.squad.push({ ...currentPlayer, boughtFor: room.currentBid });
        }

        io.to(roomCode).emit('playerSold', {
            soldTo: room.highestBidderId,
            amount: room.currentBid,
            playerIndex: room.currentPlayerIndex
        });
    } else {
        io.to(roomCode).emit('playerUnsold', {
            playerIndex: room.currentPlayerIndex
        });
    }

    setTimeout(() => {
        room.currentPlayerIndex++;

        if (room.currentPlayerIndex >= room.players.length) {
            console.log(`[AUCTION FINISHED] Room ${roomCode}`);
            io.to(roomCode).emit('auctionFinished', { teams: room.teams });
            return;
        }

        room.currentBid = 0;
        room.highestBidderId = null;
        room.timer = 10;

        io.to(roomCode).emit('nextPlayer', {
            playerIndex: room.currentPlayerIndex
        });

        // Refresh client states with new budgets
        io.to(roomCode).emit('gameStateUpdate', getClientState(room));

        startTimer(roomCode);
    }, 4000);
}
