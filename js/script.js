// TATA IPL 2026 MULTIPLAYER SOCKET CLIENT
const socket = io();

let userTeam = null;
let userName = "Player_" + Math.floor(Math.random() * 1000);
let gameState = null;
let roomCode = null;

// DOM Elements
const screens = {
    selection: document.getElementById('selection-screen'),
    auction: document.getElementById('auction-screen'),
};

const ui = {
    teamsGrid: document.getElementById('teams-grid'),
    leaderboard: document.getElementById('leaderboard-list'),
    mySquad: document.getElementById('my-squad-list'),
    currentPlayerImg: document.getElementById('current-player-avatar'),
    currentPlayerName: document.getElementById('current-player-name'),
    currentPlayerRole: document.getElementById('current-player-role'),
    currentPlayerBasePrice: document.getElementById('current-player-base-price'),
    currentPlayerRating: document.getElementById('current-player-rating'),
    currentBidDisplay: document.getElementById('current-bid'),
    highestBidderDisplay: document.getElementById('highest-bidder-name'),
    timerDisplay: document.getElementById('timer'),
    btnBid: document.getElementById('btn-bid'),
    btnPass: document.getElementById('btn-pass'),
    soldMessage: document.getElementById('sold-message'),
    btnCreateRoom: document.getElementById('btn-create-room'),
    btnJoinRoom: document.getElementById('btn-join-room'),
    btnPlayAlone: document.getElementById('btn-play-alone'),
    headerSubtitle: document.getElementById('header-subtitle'),
    overviewModal: document.getElementById('team-overview-modal'),
    overviewLogo: document.getElementById('overview-logo-container'),
    overviewName: document.getElementById('overview-team-name'),
    overviewPurse: document.getElementById('overview-team-purse'),
    overviewList: document.getElementById('overview-retained-list'),
    btnOverviewCancel: document.getElementById('btn-overview-cancel'),
    btnOverviewConfirm: document.getElementById('btn-overview-confirm'),
    // Team Detail Modal (Squad Viewer)
    teamModal: document.getElementById('team-modal'),
    teamModalHeader: document.getElementById('team-modal-header'),
    teamModalStats: document.getElementById('team-modal-stats'),
    teamModalSquad: document.getElementById('team-modal-squad'),
    btnTeamModalClose: document.getElementById('btn-team-modal-close')
};

// Formatting helpers
const formatCurrency = (amount) => {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
};

function promptDetails(title, showCode = false) {
    return new Promise((resolve) => {
        const modal = document.getElementById('username-modal');
        const titleEl = document.getElementById('modal-title');
        const inputEl = document.getElementById('username-input');
        const codeEl = document.getElementById('roomcode-input');
        const btnCancel = document.getElementById('btn-modal-cancel');
        const btnConfirm = document.getElementById('btn-modal-confirm');

        titleEl.innerText = title;
        inputEl.value = userName.startsWith("Player_") ? "" : userName;
        codeEl.value = "";
        codeEl.style.display = showCode ? 'block' : 'none';

        modal.style.display = 'flex';
        inputEl.focus();

        const cleanup = () => {
            modal.style.display = 'none';
            btnCancel.removeEventListener('click', onCancel);
            btnConfirm.removeEventListener('click', onConfirm);
            inputEl.removeEventListener('keydown', onKey);
            codeEl.removeEventListener('keydown', onKey);
        };

        const onCancel = () => { cleanup(); resolve(null); };
        const onConfirm = () => {
            cleanup();
            resolve({
                name: inputEl.value.trim() || userName,
                code: codeEl.value.trim().toUpperCase()
            });
        };
        const onKey = (e) => {
            if (e.key === 'Enter') onConfirm();
            if (e.key === 'Escape') onCancel();
        };

        btnCancel.addEventListener('click', onCancel);
        btnConfirm.addEventListener('click', onConfirm);
        inputEl.addEventListener('keydown', onKey);
        codeEl.addEventListener('keydown', onKey);
    });
}

// Start
window.onload = () => {
    renderTeamSelection();
};

ui.btnCreateRoom.addEventListener('click', async () => {
    const res = await promptDetails("Enter Username to Host", false);
    if (res) {
        userName = res.name;
        socket.emit('createRoom', { username: userName });
    }
});

ui.btnJoinRoom.addEventListener('click', async () => {
    const res = await promptDetails("Enter Username & Room Code", true);
    if (res && res.code) {
        userName = res.name;
        socket.emit('joinRoom', { username: userName, roomCode: res.code });
    } else if (res && !res.code) {
        alert("A Room Code is strictly required to join a game.");
    }
});

ui.btnPlayAlone.addEventListener('click', () => {
    userName = "Player";
    socket.emit('createRoom', { username: userName });
});

// --- SOCKET EVENTS ---
socket.on('roomCreated', (data) => {
    roomCode = data.code;
    gameState = data.state;
    ui.headerSubtitle.innerText = `Room Code: ${roomCode} | Welcome ${userName}! Select your team below.`;

    if (userTeam && !gameState.assignedTeams.includes(userTeam.id)) {
        socket.emit('selectTeam', { roomCode, teamId: userTeam.id, username: userName });
        enterAuctionRoom();
    } else {
        renderTeamSelection();
    }
});

socket.on('roomJoined', (data) => {
    roomCode = data.code;
    gameState = data.state;
    ui.headerSubtitle.innerText = `Room Code: ${roomCode} | Welcome ${userName}! Select your team below.`;
    renderTeamSelection();
});

socket.on('gameStateUpdate', (state) => {
    gameState = state;
    if (userTeam) {
        userTeam = gameState.teams.find(t => t.id === userTeam.id) || userTeam;
    }
    if (screens.selection.style.display !== 'none') {
        renderTeamSelection();
    } else if (userTeam) {
        updateLeaderboard();
        updateMySquad();
    }
});

socket.on('auctionStarted', () => {
    console.log("Auction Started Event Received");
    if (gameState) gameState.auctionStarted = true;
});

socket.on('timerTick', (timeLeft) => {
    ui.timerDisplay.innerText = timeLeft;
    if (timeLeft <= 3) ui.timerDisplay.style.color = '#ff4444';
    else ui.timerDisplay.style.color = 'inherit';
});

socket.on('bidAccepted', (bidData) => {
    if (gameState) {
        gameState.currentBid = bidData.currentBid;
        gameState.highestBidderId = bidData.highestBidderId;
        gameState.timer = bidData.timer;
    }

    ui.currentBidDisplay.innerText = formatCurrency(bidData.currentBid);
    const serverTeams = gameState ? gameState.teams : teamsData;
    const bidderTeam = serverTeams.find(t => t.id === bidData.highestBidderId);
    if (bidderTeam) {
        ui.highestBidderDisplay.innerText = bidderTeam.shortName;
        ui.highestBidderDisplay.style.color = bidderTeam.color;
    }
    if (userTeam && bidData.highestBidderId !== userTeam.id) {
        ui.btnBid.disabled = false;
    }
});

socket.on('playerSold', (data) => {
    ui.btnBid.disabled = true;
    ui.btnPass.disabled = true;
    const serverTeams = gameState ? gameState.teams : teamsData;
    const buyer = serverTeams.find(t => t.id === data.soldTo);

    ui.soldMessage.innerText = `SOLD to ${buyer.name} for ${formatCurrency(data.amount)}`;
    ui.soldMessage.style.display = 'block';
    ui.soldMessage.className = 'sold-label success';

    // Squad update will happen on the subsequent gameStateUpdate from the server
});

socket.on('playerUnsold', (data) => {
    ui.btnBid.disabled = true;
    ui.btnPass.disabled = true;
    ui.soldMessage.innerText = `UNSOLD`;
    ui.soldMessage.style.display = 'block';
    ui.soldMessage.className = 'sold-label danger';
});

socket.on('nextPlayer', (data) => {
    if (gameState) {
        gameState.currentPlayerIndex = data.playerIndex;
        gameState.currentBid = 0;
        gameState.highestBidderId = null;
        gameState.timer = 10;
    }

    console.log("Loading player index", data.playerIndex);
    ui.soldMessage.style.display = 'none';
    ui.btnBid.disabled = false;
    ui.btnPass.disabled = false;
    loadPlayer(data.playerIndex);
});

socket.on('errorMsg', (msg) => {
    alert(msg);
    ui.btnBid.disabled = false; // re-enable so they can try again if it was a logic block
});

socket.on('auctionFinished', (data) => {
    gameState.teams = data.teams;
    renderFinalSummary();
});

function renderFinalSummary() {
    screens.auction.style.display = 'none';
    document.getElementById('final-summary-screen').style.display = 'block';
    const grid = document.getElementById('final-summary-grid');
    grid.innerHTML = '';

    gameState.teams.forEach(team => {
        const card = document.createElement('div');
        card.className = 'summary-card';

        const osCount = getOverseasCount(team);
        const squadSize = getTotalSquadSize(team);

        card.innerHTML = `
            <h3>${team.logo} ${team.name}</h3>
            <div class="summary-stats">
                <span>Purse: ${formatCurrency(team.budget)}</span>
                <span>Squad: ${squadSize}/25 (O: ${osCount}/9)</span>
            </div>
            <div class="summary-squad-list">
                ${(team.retained || []).map(p => `
                    <div class="summary-player-item">
                        <span>🛡️ ${p.name} (R)</span>
                        <span>-</span>
                    </div>
                `).join('')}
                ${(team.squad || []).map(p => `
                    <div class="summary-player-item">
                        <span>🏏 ${p.name}</span>
                        <span>${formatCurrency(p.boughtFor)}</span>
                    </div>
                `).join('')}
            </div>
        `;
        grid.appendChild(card);
    });
}


// 1. Team Selection Phase
function renderTeamSelection() {
    ui.teamsGrid.innerHTML = '';
    const assignedTeams = gameState ? gameState.assignedTeams : [];
    const serverTeams = gameState ? gameState.teams : teamsData;

    serverTeams.forEach(team => {
        const card = document.createElement('div');
        const isTaken = assignedTeams.includes(team.id);

        card.className = `team-card ${team.shortName.toLowerCase()}`;
        if (isTaken) card.style.opacity = '0.5';
        card.innerHTML = `
            <div class="team-logo">${team.logo}</div>
            <h3>${team.name} ${isTaken ? '(TAKEN)' : ''}</h3>
            <p>Purse: <strong>${formatCurrency(team.budget)}</strong></p>
        `;

        if (!isTaken) {
            card.addEventListener('click', () => {
                showTeamOverview(team);
            });
        }
        ui.teamsGrid.appendChild(card);
    });
}

function showTeamOverview(team) {
    ui.overviewLogo.innerHTML = team.logo;
    ui.overviewName.innerText = team.name;
    ui.overviewPurse.innerText = formatCurrency(team.budget);

    // Clear and populate retained players
    ui.overviewList.innerHTML = '';
    team.retained.forEach(player => {
        const item = document.createElement('div');
        item.className = 'overview-squad-item';

        // Dynamically style based on 'Traded' vs 'Retained'
        const tagLabel = player.status ? player.status.toUpperCase() : "RETAINED";
        const tagColor = player.status === "Traded" ? "#c084fc" : "var(--accent)";

        item.innerHTML = `<span>🛡️ ${player.name}</span> <span style="color:${tagColor}; font-size:0.8rem;">${tagLabel}</span>`;
        ui.overviewList.appendChild(item);
    });

    ui.overviewModal.style.display = 'flex';

    // Cleanup logic for previous listeners
    const cleanup = () => {
        ui.overviewModal.style.display = 'none';
        ui.btnOverviewCancel.removeEventListener('click', onCancel);
        ui.btnOverviewConfirm.removeEventListener('click', onConfirm);
    };

    const onCancel = () => cleanup();
    const onConfirm = async () => {
        cleanup();

        if (!roomCode) {
            // Quick-start logic: If they never pressed Create/Join, auto Play Alone
            userName = "Player";
            socket.emit('createRoom', { username: userName });
            userTeam = team;
            return;
        }

        userTeam = team;
        socket.emit('selectTeam', { roomCode, teamId: team.id, username: userName });
        enterAuctionRoom();
    };

    ui.btnOverviewCancel.addEventListener('click', onCancel);
    ui.btnOverviewConfirm.addEventListener('click', onConfirm);
}

function enterAuctionRoom() {
    document.body.classList.add('auction-mode');
    screens.selection.style.display = 'none';
    screens.auction.style.display = 'grid';


    updateLeaderboard();
    updateMySquad();

    // Load first player
    loadPlayer(gameState ? gameState.currentPlayerIndex : 0);

    // Auto-tell server to start if we are the first to join or if it's not started
    if (!gameState || !gameState.auctionStarted) {
        console.log("Triggering startAuction for room", roomCode);
        setTimeout(() => {
            socket.emit('startAuction', { roomCode });
        }, 1000);
    }
}

// 2. UI Updates
function updateLeaderboard() {
    ui.leaderboard.innerHTML = '';
    const serverTeams = gameState ? gameState.teams : teamsData;
    const sortedTeams = [...serverTeams].sort((a, b) => b.budget - a.budget);
    sortedTeams.forEach(team => {
        const item = document.createElement('div');
        item.className = `leaderboard-item ${userTeam && team.id === userTeam.id ? 'user-team' : ''}`;

        // Find if an active player owns this
        let ownerLabel = "";
        for (let sid in gameState.users) {
            if (gameState.users[sid].teamId === team.id) {
                ownerLabel = `[${gameState.users[sid].username}]`;
            }
        }
        if (!ownerLabel) ownerLabel = "[AI]";

        // Calculate overseas count
        const osCount = (team.retained || []).filter(p => p.country && p.country !== "India").length +
            (team.squad || []).filter(p => p.country && p.country !== "India").length;

        item.innerHTML = `
            <span>${team.logo} ${team.shortName} <small style="color:rgba(255,255,255,0.4); font-size:0.7rem;">(O: ${osCount}/9)</small> ${ownerLabel}</span>
            <span class="purse ${team.budget < 50000000 ? 'low-funds' : ''}">${formatCurrency(team.budget)}</span>
        `;

        // Click to view squad
        item.addEventListener('click', () => {
            renderTeamModal(team.id);
        });

        ui.leaderboard.appendChild(item);
    });
}

function renderTeamModal(teamId) {
    const serverTeams = gameState ? gameState.teams : teamsData;
    const team = serverTeams.find(t => t.id === teamId);
    if (!team) return;

    ui.teamModalHeader.innerHTML = `<h2>${team.logo} ${team.name}</h2>`;
    ui.teamModalStats.innerHTML = `
        <div>Purse: <strong>${formatCurrency(team.budget)}</strong></div>
        <div>Squad: <strong>${getTotalSquadSize(team)}/25</strong></div>
        <div>Overseas: <strong>${getOverseasCount(team)}/9</strong></div>
    `;

    ui.teamModalSquad.innerHTML = '';

    // Add retained
    (team.retained || []).forEach(p => {
        const div = document.createElement('div');
        div.className = 'team-modal-player';
        div.innerHTML = `<span>🛡️ ${p.name}</span> <span class="price">RETAINED</span>`;
        ui.teamModalSquad.appendChild(div);
    });

    // Add bought
    (team.squad || []).forEach(p => {
        const div = document.createElement('div');
        div.className = 'team-modal-player';
        div.innerHTML = `<span>🏏 ${p.name}</span> <span class="price">${formatCurrency(p.boughtFor)}</span>`;
        ui.teamModalSquad.appendChild(div);
    });

    ui.teamModal.style.display = 'flex';
}

ui.btnTeamModalClose.addEventListener('click', () => {
    ui.teamModal.style.display = 'none';
});

// Close modal on click outside
window.addEventListener('click', (e) => {
    if (e.target === ui.teamModal) ui.teamModal.style.display = 'none';
});


function updateMySquad() {
    ui.mySquad.innerHTML = '';

    // Add a summary header if possible, or just players
    const osCount = (userTeam.retained || []).filter(p => p.country && p.country !== "India").length +
        (userTeam.squad || []).filter(p => p.country && p.country !== "India").length;

    const summary = document.createElement('div');
    summary.style.padding = '0 0.5rem 0.5rem';
    summary.style.fontSize = '0.8rem';
    summary.style.color = 'var(--accent)';
    summary.innerHTML = `SQUAD: ${getTotalSquadSize(userTeam)}/25 | OVERSEAS: ${osCount}/9`;
    ui.mySquad.appendChild(summary);

    (userTeam.retained || []).forEach(player => {
        const item = document.createElement('div');
        item.className = 'squad-item retained';
        const tagLabel = player.status || "Retained";
        item.innerHTML = `<span>🛡️ ${player.name}</span> <span class="tag">${tagLabel}</span>`;
        ui.mySquad.appendChild(item);
    });
    userTeam.squad.forEach(player => {
        const item = document.createElement('div');
        item.className = 'squad-item';
        item.innerHTML = `<span>${player.name}</span> <span class="tag bought">${formatCurrency(player.boughtFor)}</span>`;
        ui.mySquad.appendChild(item);
    });
}

// 3. Auction UI Syncing
function loadPlayer(index) {
    const serverPlayers = gameState ? gameState.players : auctionPlayers;
    if (index >= serverPlayers.length) {
        ui.auction.innerHTML = `<div class="end-screen"><h1>Auction Concluded!</h1><p>All players have been processed.</p></div>`;
        return;
    }

    const player = serverPlayers[index];
    ui.soldMessage.style.display = 'none';

    const colors = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#38bdf8', '#fb923c', '#2dd4bf'];
    const colIdx = player.name.length % colors.length;
    ui.currentPlayerImg.style.backgroundColor = colors[colIdx];

    ui.currentPlayerName.innerHTML = `<span class="set-label">${player.setCategory}</span> ${player.name}`;
    ui.currentPlayerRole.innerText = `${player.role} | ${player.country || 'International'}`;
    ui.currentPlayerBasePrice.innerText = "Base: " + formatCurrency(player.basePrice);
    ui.currentPlayerRating.innerText = "⭐ " + player.rating;

    ui.currentBidDisplay.innerText = "₹0.00 Cr";
    ui.highestBidderDisplay.innerText = "-";
    ui.highestBidderDisplay.style.color = "inherit";

    ui.btnBid.disabled = false;
    ui.btnPass.disabled = false;
}

function nextBidIncrement(current) {
    if (current === 0) {
        const serverPlayers = gameState ? gameState.players : auctionPlayers;
        return serverPlayers[gameState ? gameState.currentPlayerIndex : 0].basePrice;
    }
    if (current < 10000000) return current + 500000;
    if (current < 20000000) return current + 1000000;
    return current + 2000000;
}

// User Actions
ui.btnBid.addEventListener('click', () => {
    if (!gameState || !gameState.auctionStarted) {
        console.warn("Bidding blocked: gameState missing or auction not started");
        return;
    }
    if (!userTeam || !userTeam.id) {
        console.warn("Bidding blocked: userTeam missing");
        return;
    }
    if (gameState.highestBidderId === userTeam.id) return;

    const targetBid = nextBidIncrement(gameState.currentBid);

    // Client side check (server will also check)
    const osCount = getOverseasCount(userTeam);
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    if (currentPlayer.country !== "India" && osCount >= 9) {
        alert("Overseas Limit Reached!");
        return;
    }

    if (userTeam.budget < targetBid) {
        alert("Insufficient Funds!");
        return;
    }

    console.log(`[BID] Placing bid for ${userTeam.id} in room ${roomCode} for ${targetBid}`);
    socket.emit('placeBid', { roomCode, teamId: userTeam.id, bidAmount: targetBid });
    ui.btnBid.disabled = true; // disable locally until server confirms
});

ui.btnPass.addEventListener('click', () => {
    ui.btnBid.disabled = true; // explicitly pass
});
// Helper for frontend rules
function getTotalSquadSize(team) {
    return (team.retained || []).length + (team.squad || []).length;
}

function getOverseasCount(team) {
    return (team.retained || []).filter(p => p.country && p.country !== "India").length +
        (team.squad || []).filter(p => p.country && p.country !== "India").length;
}
