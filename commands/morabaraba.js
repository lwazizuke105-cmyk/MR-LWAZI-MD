/**
 * 🎯 MORABARABA GAME
 * ZetFlash RST Bot
 *
 * Morabaraba (also called "Umlabalaba" or "Twelve Men's Morris") is a
 * traditional Southern African board game. Two players each have 12 cows
 * (pieces). The goal is to reduce the opponent to 2 pieces or block all
 * their moves.
 *
 * PHASES:
 *  1. PLACING  – Players take turns placing their 12 cows on the board.
 *  2. MOVING   – Players move cows to adjacent positions.
 *  3. FLYING   – When a player has only 3 cows left, they can move anywhere.
 *
 * MILLS (SHOOTING):
 *  Forming 3 in a row (a "mill") lets you remove one opponent's cow.
 *
 * Commands:
 *  .morabaraba          – Show rules & how to play
 *  .morabaraba start    – Start a new game (waiting for opponent)
 *  .morabaraba join     – Join an existing game
 *  .morabaraba place <pos>   – Place a cow (e.g. .morabaraba place a1)
 *  .morabaraba move <from> <to> – Move a cow (e.g. .morabaraba move a1 a4)
 *  .morabaraba shoot <pos>  – Remove opponent's cow after forming a mill
 *  .morabaraba board    – Show current board
 *  .morabaraba quit     – Quit the game
 */

const games = {}; // chatId -> game state

// ── Board definition ─────────────────────────────────────────────────────────
// 24 positions on a standard Nine/Twelve Men's Morris board
// Positions labelled a1-a4, b1-b4 (inner), c1-c4 (outer), d1-d4 (corners)
// We use a simplified 24-node layout

const POSITIONS = [
    'a1','a2','a3','a4',
    'b1','b2','b3','b4',
    'c1','c2','c3','c4',
    'd1','d2','d3','d4',
    'e1','e2','e3','e4',
    'f1','f2','f3','f4'
];

// Adjacency list (which positions connect to which)
const ADJACENCY = {
    a1: ['a2','d1'], a2: ['a1','a3','b2'], a3: ['a2','a4'], a4: ['a3','d4'],
    b1: ['b2','c1'], b2: ['b1','b3','a2'], b3: ['b2','b4'], b4: ['b3','c4'],
    c1: ['b1','c2'], c2: ['c1','c3','d2'], c3: ['c2','c4'], c4: ['c3','b4'],
    d1: ['a1','d2','e1'], d2: ['d1','d3','c2','f2'], d3: ['d2','d4','e3'], d4: ['d3','a4'],
    e1: ['d1','e2','f1'], e2: ['e1','e3'], e3: ['e2','e4','d3'], e4: ['e3','f4'],
    f1: ['e1','f2'], f2: ['f1','f3','d2'], f3: ['f2','f4'], f4: ['f3','e4']
};

// All possible mills (3-in-a-row)
const MILLS = [
    ['a1','a2','a3'], ['a2','a3','a4'],
    ['b1','b2','b3'], ['b2','b3','b4'],
    ['c1','c2','c3'], ['c2','c3','c4'],
    ['d1','d2','d3'], ['d2','d3','d4'],
    ['e1','e2','e3'], ['e2','e3','e4'],
    ['f1','f2','f3'], ['f2','f3','f4'],
    ['a1','d1','e1'], ['d1','d2','f2'],
    ['a4','d4','d3'], ['d3','e3','e4'],
    ['b1','c1','c2'], ['b4','c4','c3'],
    ['a2','b2','b3'], ['a3','b3','b4']
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function createGame(player1) {
    return {
        phase: 'PLACING',       // PLACING | MOVING | FLYING
        board: {},              // pos -> 'X' | 'O'
        players: { X: player1, O: null },
        turn: 'X',
        toPlace: { X: 3, O: 3 },
        pendingMill: false,     // waiting for shoot command
        winner: null,
        state: 'WAITING'        // WAITING | PLAYING | DONE
    };
}

function renderBoard(board) {
    function c(pos) {
        if (board[pos] === 'X') return '🐄';
        if (board[pos] === 'O') return '🐂';
        return '⬜';
    }
    return (
`*🎯 MORABARABA BOARD*
\`\`\`
${c('a1')}─────${c('a2')}─────${c('a3')}─────${c('a4')}
│         │         │         │
│  ${c('b1')}───${c('b2')}───${c('b3')}───${c('b4')}  │
│  │    │    │    │  │
│  │ ${c('c1')}─${c('c2')}─${c('c3')}─${c('c4')} │  │
│  │  │  │  │  │  │
${c('d1')}──${c('d1')}──${c('d2')}──${c('d3')}──${c('d4')}──${c('d4')}
│  │  │  │  │  │  │
│  │ ${c('e1')}─${c('e2')}─${c('e3')}─${c('e4')} │  │
│  │    │    │    │  │
│  ${c('f1')}───${c('f2')}───${c('f3')}───${c('f4')}  │
│         │         │         │
${c('f1')}─────${c('f2')}─────${c('f3')}─────${c('f4')}
\`\`\`
🐄 = Player 1 (X)  |  🐂 = Player 2 (O)  |  ⬜ = Empty`
    );
}

function renderSimpleBoard(board) {
    function c(pos) {
        if (board[pos] === 'X') return '🐄';
        if (board[pos] === 'O') return '🐂';
        return `[${pos}]`;
    }
    const lines = [];
    lines.push('*🎯 MORABARABA BOARD*');
    lines.push('');
    lines.push(`${c('a1')}──${c('a2')}──${c('a3')}──${c('a4')}`);
    lines.push(`│  ${c('b1')}─${c('b2')}─${c('b3')}─${c('b4')}  │`);
    lines.push(`│  │ ${c('c1')}─${c('c2')}─${c('c3')}─${c('c4')} │  │`);
    lines.push(`${c('d1')}─${c('d1')}─${c('d2')}─${c('d3')}─${c('d4')}─${c('d4')}`);
    lines.push(`│  │ ${c('e1')}─${c('e2')}─${c('e3')}─${c('e4')} │  │`);
    lines.push(`│  ${c('f1')}─${c('f2')}─${c('f3')}─${c('f4')}  │`);
    lines.push(`${c('f1')}──${c('f2')}──${c('f3')}──${c('f4')}`);
    lines.push('');
    lines.push('🐄 = Player 1 (X)  |  🐂 = Player 2 (O)');
    return lines.join('\n');
}

function checkMill(board, player, pos) {
    return MILLS.some(mill => mill.includes(pos) && mill.every(p => board[p] === player));
}

function countPieces(board, player) {
    return Object.values(board).filter(v => v === player).length;
}

function hasValidMoves(board, player) {
    return Object.entries(board)
        .filter(([, v]) => v === player)
        .some(([pos]) => (ADJACENCY[pos] || []).some(adj => !board[adj]));
}

function getPlayerSymbol(game, senderId) {
    if (game.players.X === senderId) return 'X';
    if (game.players.O === senderId) return 'O';
    return null;
}

function opponentOf(sym) { return sym === 'X' ? 'O' : 'X'; }

function mentionName(jid) { return `@${jid.split('@')[0]}`; }

// ── Command handler ───────────────────────────────────────────────────────────

async function morabarabaCommand(sock, chatId, message, senderId) {
    const rawText =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text || '';
    const parts = rawText.trim().split(/\s+/);
    const sub = (parts[1] || '').toLowerCase();

    // ── Show rules ──────────────────────────────────────────────────────────
    if (!sub || sub === 'rules' || sub === 'how' || sub === 'help') {
        return sock.sendMessage(chatId, {
            text: `🎯 *MORABARABA – Traditional Southern African Board Game*
━━━━━━━━━━━━━━━━━━━━━━━━
📖 *What is Morabaraba?*
Morabaraba (also called Umlabalaba) is a classic strategy game from Southern Africa. Two players each control 12 "cows" (pieces) on a board of 24 points connected by lines.

🎯 *Goal*
Reduce your opponent to only 2 cows, OR block all their moves so they cannot play.

📋 *Phases*
1️⃣ *PLACING* – Each player places their 3 cows one at a time on empty spots.
2️⃣ *MOVING* – Players slide cows to adjacent connected spots.
3️⃣ *FLYING* – When a player has only 3 cows left, they can move to ANY empty spot.

🔫 *Shooting (Mills)*
When you place or move a cow to complete a line of 3 (called a *mill*), you *shoot* (remove) one of your opponent's cows. You cannot remove a cow that is part of a mill unless no other cows are available.

♟️ *Board Positions*
The board has 24 positions: a1-a4, b1-b4, c1-c4, d1-d4, e1-e4, f1-f4

🎮 *Commands*
• *.morabaraba start* – Start a new game
• *.morabaraba join* – Join the waiting game
• *.morabaraba place a1* – Place a cow on position a1
• *.morabaraba move a1 b1* – Move cow from a1 to b1
• *.morabaraba shoot c3* – Remove opponent's cow at c3 (after a mill)
• *.morabaraba board* – Show current board
• *.morabaraba quit* – Quit the game

🐄 You are Player 1 (X)  |  🐂 Opponent is Player 2 (O)
━━━━━━━━━━━━━━━━━━━━━━━━
_Type *.morabaraba start* to begin!_`
        }, { quoted: message });
    }

    // ── Start game ──────────────────────────────────────────────────────────
    if (sub === 'start') {
        if (games[chatId] && games[chatId].state !== 'DONE') {
            return sock.sendMessage(chatId, {
                text: '❌ A game is already in progress! Type *.morabaraba quit* to end it first.'
            }, { quoted: message });
        }
        games[chatId] = createGame(senderId);
        return sock.sendMessage(chatId, {
            text: `🎯 *Morabaraba game started!*\n${mentionName(senderId)} is Player 1 🐄 (X)\n\nWaiting for Player 2 to join...\nType *.morabaraba join* to play!`,
            mentions: [senderId]
        }, { quoted: message });
    }

    // ── Join game ───────────────────────────────────────────────────────────
    if (sub === 'join') {
        const game = games[chatId];
        if (!game || game.state === 'DONE') {
            return sock.sendMessage(chatId, { text: '❌ No game waiting. Type *.morabaraba start* to begin.' }, { quoted: message });
        }
        if (game.players.X === senderId) {
            return sock.sendMessage(chatId, { text: '❌ You already started this game!' }, { quoted: message });
        }
        if (game.state === 'PLAYING') {
            return sock.sendMessage(chatId, { text: '❌ Game already has 2 players!' }, { quoted: message });
        }
        game.players.O = senderId;
        game.state = 'PLAYING';
        return sock.sendMessage(chatId, {
            text: `🎯 *Morabaraba – Game On!*\n🐄 Player 1: ${mentionName(game.players.X)}\n🐂 Player 2: ${mentionName(senderId)}\n\n*Phase: PLACING*\nEach player places 12 cows.\n\n🐄 ${mentionName(game.players.X)}, you go first!\nType *.morabaraba place <pos>* (e.g. *.morabaraba place a1*)`,
            mentions: [game.players.X, senderId]
        }, { quoted: message });
    }

    const game = games[chatId];

    // ── Board ───────────────────────────────────────────────────────────────
    if (sub === 'board') {
        if (!game || game.state === 'DONE') {
            return sock.sendMessage(chatId, { text: '❌ No active game. Type *.morabaraba start* to begin.' }, { quoted: message });
        }
        const playerSym = getPlayerSymbol(game, senderId);
        const turnName = mentionName(game.players[game.turn]);
        return sock.sendMessage(chatId, {
            text: `${renderSimpleBoard(game.board)}\n\n🎯 Turn: ${turnName} (${game.turn === 'X' ? '🐄' : '🐂'})\nPhase: *${game.phase}*\n🐄 Cows to place: ${game.toPlace.X} | 🐂 Cows to place: ${game.toPlace.O} (3 tokens total)`,
            mentions: [game.players[game.turn]]
        }, { quoted: message });
    }

    // ── Quit ────────────────────────────────────────────────────────────────
    if (sub === 'quit' || sub === 'surrender') {
        if (!game || game.state === 'DONE') {
            return sock.sendMessage(chatId, { text: '❌ No active game.' }, { quoted: message });
        }
        const sym = getPlayerSymbol(game, senderId);
        if (!sym) return sock.sendMessage(chatId, { text: '❌ You are not in this game.' }, { quoted: message });
        const winner = opponentOf(sym);
        game.state = 'DONE';
        game.winner = winner;
        return sock.sendMessage(chatId, {
            text: `🏳️ ${mentionName(senderId)} surrendered!\n🏆 *${mentionName(game.players[winner])} wins!*`,
            mentions: [senderId, game.players[winner]]
        }, { quoted: message });
    }

    // ── Place ───────────────────────────────────────────────────────────────
    if (sub === 'place') {
        if (!game || game.state !== 'PLAYING') {
            return sock.sendMessage(chatId, { text: '❌ No active game or game not started yet.' }, { quoted: message });
        }
        const sym = getPlayerSymbol(game, senderId);
        if (!sym) return sock.sendMessage(chatId, { text: '❌ You are not in this game.' }, { quoted: message });
        if (game.turn !== sym) {
            return sock.sendMessage(chatId, { text: `⏳ It's not your turn! Waiting for ${mentionName(game.players[game.turn])}.`, mentions: [game.players[game.turn]] }, { quoted: message });
        }
        if (game.phase !== 'PLACING') {
            return sock.sendMessage(chatId, { text: '❌ Placing phase is over. Use *.morabaraba move <from> <to>*.' }, { quoted: message });
        }
        if (game.pendingMill) {
            return sock.sendMessage(chatId, { text: '🔫 You formed a mill! First use *.morabaraba shoot <pos>* to remove an opponent\'s cow.' }, { quoted: message });
        }
        const pos = (parts[2] || '').toLowerCase();
        if (!POSITIONS.includes(pos)) {
            return sock.sendMessage(chatId, { text: `❌ Invalid position *${pos}*.\nValid positions: ${POSITIONS.join(', ')}` }, { quoted: message });
        }
        if (game.board[pos]) {
            return sock.sendMessage(chatId, { text: `❌ Position *${pos}* is already occupied!` }, { quoted: message });
        }
        game.board[pos] = sym;
        game.toPlace[sym]--;

        const formedMill = checkMill(game.board, sym, pos);
        if (formedMill) {
            game.pendingMill = true;
            return sock.sendMessage(chatId, {
                text: `🐄 ${mentionName(senderId)} placed a cow on *${pos}* and formed a *MILL!* 🔫\nType *.morabaraba shoot <pos>* to remove one of ${mentionName(game.players[opponentOf(sym)])}'s cows!`,
                mentions: [senderId, game.players[opponentOf(sym)]]
            }, { quoted: message });
        }

        // Switch turn
        game.turn = opponentOf(sym);

        // Check if placing phase is done
        if (game.toPlace.X === 0 && game.toPlace.O === 0) {
            game.phase = 'MOVING';
        }

        return sock.sendMessage(chatId, {
            text: `✅ ${mentionName(senderId)} placed a cow on *${pos}*.\n\n${renderSimpleBoard(game.board)}\n\n🎯 Turn: ${mentionName(game.players[game.turn])} (${game.turn === 'X' ? '🐄' : '🐂'})\nPhase: *${game.phase}*`,
            mentions: [senderId, game.players[game.turn]]
        }, { quoted: message });
    }

    // ── Move ────────────────────────────────────────────────────────────────
    if (sub === 'move') {
        if (!game || game.state !== 'PLAYING') {
            return sock.sendMessage(chatId, { text: '❌ No active game.' }, { quoted: message });
        }
        const sym = getPlayerSymbol(game, senderId);
        if (!sym) return sock.sendMessage(chatId, { text: '❌ You are not in this game.' }, { quoted: message });
        if (game.turn !== sym) {
            return sock.sendMessage(chatId, { text: `⏳ It's not your turn!`, mentions: [game.players[game.turn]] }, { quoted: message });
        }
        if (game.phase === 'PLACING') {
            return sock.sendMessage(chatId, { text: '❌ Still in placing phase. Use *.morabaraba place <pos>*.' }, { quoted: message });
        }
        if (game.pendingMill) {
            return sock.sendMessage(chatId, { text: '🔫 You formed a mill! First use *.morabaraba shoot <pos>*.' }, { quoted: message });
        }
        const from = (parts[2] || '').toLowerCase();
        const to = (parts[3] || '').toLowerCase();
        if (!POSITIONS.includes(from) || !POSITIONS.includes(to)) {
            return sock.sendMessage(chatId, { text: `❌ Invalid positions. Use valid board positions.` }, { quoted: message });
        }
        if (game.board[from] !== sym) {
            return sock.sendMessage(chatId, { text: `❌ You don't have a cow at *${from}*.` }, { quoted: message });
        }
        if (game.board[to]) {
            return sock.sendMessage(chatId, { text: `❌ Position *${to}* is already occupied.` }, { quoted: message });
        }

        const pieces = countPieces(game.board, sym);
        const isFlying = game.phase === 'FLYING' || pieces <= 3;
        if (isFlying) game.phase = 'FLYING';

        if (!isFlying && !(ADJACENCY[from] || []).includes(to)) {
            return sock.sendMessage(chatId, { text: `❌ *${to}* is not adjacent to *${from}*. You can only move to connected positions.` }, { quoted: message });
        }

        game.board[to] = sym;
        delete game.board[from];

        const formedMill = checkMill(game.board, sym, to);
        if (formedMill) {
            game.pendingMill = true;
            return sock.sendMessage(chatId, {
                text: `🐄 ${mentionName(senderId)} moved *${from}* → *${to}* and formed a *MILL!* 🔫\nType *.morabaraba shoot <pos>* to remove one of ${mentionName(game.players[opponentOf(sym)])}'s cows!`,
                mentions: [senderId, game.players[opponentOf(sym)]]
            }, { quoted: message });
        }

        game.turn = opponentOf(sym);

        // Check win condition
        const oppPieces = countPieces(game.board, opponentOf(sym));
        if (oppPieces <= 2 || !hasValidMoves(game.board, opponentOf(sym))) {
            game.state = 'DONE';
            game.winner = sym;
            return sock.sendMessage(chatId, {
                text: `${renderSimpleBoard(game.board)}\n\n🏆 *${mentionName(senderId)} WINS!* 🎉\nOpponent has ${oppPieces} cow(s) left.`,
                mentions: [senderId]
            }, { quoted: message });
        }

        return sock.sendMessage(chatId, {
            text: `✅ ${mentionName(senderId)} moved *${from}* → *${to}*.\n\n${renderSimpleBoard(game.board)}\n\n🎯 Turn: ${mentionName(game.players[game.turn])} (${game.turn === 'X' ? '🐄' : '🐂'})\nPhase: *${game.phase}*`,
            mentions: [senderId, game.players[game.turn]]
        }, { quoted: message });
    }

    // ── Shoot ───────────────────────────────────────────────────────────────
    if (sub === 'shoot') {
        if (!game || game.state !== 'PLAYING') {
            return sock.sendMessage(chatId, { text: '❌ No active game.' }, { quoted: message });
        }
        const sym = getPlayerSymbol(game, senderId);
        if (!sym) return sock.sendMessage(chatId, { text: '❌ You are not in this game.' }, { quoted: message });
        if (!game.pendingMill) {
            return sock.sendMessage(chatId, { text: '❌ You have no pending mill to shoot.' }, { quoted: message });
        }
        if (game.turn !== sym) {
            return sock.sendMessage(chatId, { text: `⏳ It's not your turn!` }, { quoted: message });
        }
        const pos = (parts[2] || '').toLowerCase();
        if (!POSITIONS.includes(pos)) {
            return sock.sendMessage(chatId, { text: `❌ Invalid position *${pos}*.` }, { quoted: message });
        }
        const opp = opponentOf(sym);
        if (game.board[pos] !== opp) {
            return sock.sendMessage(chatId, { text: `❌ No opponent cow at *${pos}*.` }, { quoted: message });
        }

        // Cannot shoot a cow in a mill unless no other option
        const inMill = MILLS.some(mill => mill.includes(pos) && mill.every(p => game.board[p] === opp));
        const oppPiecesNotInMill = Object.entries(game.board)
            .filter(([p, v]) => v === opp && !MILLS.some(mill => mill.includes(p) && mill.every(mp => game.board[mp] === opp)));
        if (inMill && oppPiecesNotInMill.length > 0) {
            return sock.sendMessage(chatId, { text: `❌ You cannot shoot a cow that is part of a mill while other cows are available.` }, { quoted: message });
        }

        delete game.board[pos];
        game.pendingMill = false;
        game.turn = opponentOf(sym);

        // Update phase
        const oppRemaining = countPieces(game.board, opp);
        if (oppRemaining <= 3) game.phase = 'FLYING';

        // Check win
        if (oppRemaining <= 2 || !hasValidMoves(game.board, opp)) {
            game.state = 'DONE';
            game.winner = sym;
            return sock.sendMessage(chatId, {
                text: `🔫 ${mentionName(senderId)} shot the cow at *${pos}*!\n\n${renderSimpleBoard(game.board)}\n\n🏆 *${mentionName(senderId)} WINS!* 🎉`,
                mentions: [senderId]
            }, { quoted: message });
        }

        return sock.sendMessage(chatId, {
            text: `🔫 ${mentionName(senderId)} shot the cow at *${pos}*!\n\n${renderSimpleBoard(game.board)}\n\n🎯 Turn: ${mentionName(game.players[game.turn])} (${game.turn === 'X' ? '🐄' : '🐂'})\nPhase: *${game.phase}*`,
            mentions: [senderId, game.players[game.turn]]
        }, { quoted: message });
    }

    // ── Unknown sub-command ─────────────────────────────────────────────────
    return sock.sendMessage(chatId, {
        text: `❓ Unknown command. Type *.morabaraba* to see all commands and rules.`
    }, { quoted: message });
}

module.exports = { morabarabaCommand };
