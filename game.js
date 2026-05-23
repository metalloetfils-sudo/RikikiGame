/**
 * Rikiki - Gestionnaire Principal de Partie (game.js)
 * - Disposition optimisée des joueurs autour de la table
 * - Règle manche aveugle : 1ère et dernière manche
 *   → Chacun voit les cartes des autres, pas les siennes
 *   → Les bots jouent/annoncent aléatoirement (ils ne "savent" pas)
 */

class Player {
    constructor(id, name, isBot = true) {
        this.id = id;
        this.name = name;
        this.isBot = isBot;
        this.hand = [];
        this.currentBid = -1;
        this.tricksWon = 0;
        this.scoreHistory = [];
        this.totalScore = 0;
    }
}

class RikikiGame {
    constructor() {
        this.players = [];
        this.deck = new Deck();
        this.roundsSequence = [];
        this.currentRoundIndex = 0;
        this.trumpCard = null;
        this.trumpSuit = null;

        this.dealerIndex = 0;
        this.currentPlayerIndex = 0;
        this.firstPlayerOfTrickIndex = 0;

        this.trickCards = [];
        this.gameState = "SETUP";

        this.botAvatars = ['🤖', '🦹', '👾', '🎭', '👽', '🤡'];

        this.initDomElements();
        this.bindEvents();
    }

    // ─── Détecte si la manche courante est une manche aveugle ───────────────
    isBlindRound() {
        const total = this.roundsSequence.length;
        return this.currentRoundIndex === 0 || this.currentRoundIndex === total - 1;
    }

    initDomElements() {
        this.dom = {
            setupScreen: document.getElementById('setup-screen'),
            gameScreen: document.getElementById('game-screen'),
            playerCountSelect: document.getElementById('player-count'),
            playersInputContainer: document.getElementById('players-input-container'),
            startGameBtn: document.getElementById('start-game-btn'),
            currentRound: document.getElementById('current-round'),
            currentTrump: document.getElementById('current-trump'),
            infoStatut: document.getElementById('info-statut'),
            opponentsContainer: document.getElementById('opponents-container'),
            playedCards: document.getElementById('played-cards'),
            humanHand: document.getElementById('human-hand'),
            humanStatus: document.getElementById('human-status'),
            humanName: document.getElementById('human-name'),
            humanScore: document.getElementById('human-score'),
            humanPlayerZone: document.getElementById('human-player-zone'),
            bidActionZone: document.getElementById('bid-action-zone'),
            bidButtons: document.getElementById('bid-buttons'),
            toggleScoreBtn: document.getElementById('toggle-score-btn'),
            scoreModal: document.getElementById('score-modal'),
            closeScoreBtn: document.getElementById('close-score-btn'),
            scoreTableContainer: document.getElementById('score-table-container'),
            atoutDisplay: document.getElementById('atout-display'),
            atoutCard: document.getElementById('atout-card'),
            blindBanner: document.getElementById('blind-banner')
        };
    }

    bindEvents() {
        if (this.dom.playerCountSelect) {
            this.dom.playerCountSelect.addEventListener('change', () => this.generatePlayerInputs());
        }
        if (this.dom.startGameBtn) {
            this.dom.startGameBtn.addEventListener('click', () => this.setupGame());
        }
        if (this.dom.toggleScoreBtn) {
            this.dom.toggleScoreBtn.addEventListener('click', () => this.showScoresWindow(false));
        }
        if (this.dom.closeScoreBtn) {
            this.dom.closeScoreBtn.addEventListener('click', () => this.dom.scoreModal.classList.add('hidden'));
        }
        this.generatePlayerInputs();
    }

    generatePlayerInputs() {
        if (!this.dom.playerCountSelect || !this.dom.playersInputContainer) return;
        const count = parseInt(this.dom.playerCountSelect.value, 10);
        this.dom.playersInputContainer.innerHTML = "";

        const humanDiv = document.createElement('div');
        humanDiv.innerHTML = `<label>Votre nom :</label><input type="text" id="p-name-0" value="Bruno" />`;
        this.dom.playersInputContainer.appendChild(humanDiv);

        for (let i = 1; i < count; i++) {
            const botDiv = document.createElement('div');
            botDiv.innerHTML = `<label>Nom de l'adversaire ${i} :</label><input type="text" id="p-name-${i}" value="Robot ${i}" />`;
            this.dom.playersInputContainer.appendChild(botDiv);
        }
    }

    setupGame() {
        const count = parseInt(this.dom.playerCountSelect.value, 10);
        this.players = [];

        for (let i = 0; i < count; i++) {
            const nameInput = document.getElementById(`p-name-${i}`);
            const name = nameInput ? nameInput.value.trim() : `Joueur ${i + 1}`;
            this.players.push(new Player(i, name, i !== 0));
        }

        if (this.dom.humanName) this.dom.humanName.textContent = this.players[0].name;
        this.roundsSequence = generateRoundsSequence(count);
        this.currentRoundIndex = 0;
        this.dealerIndex = Math.floor(Math.random() * count);

        if (this.dom.setupScreen) this.dom.setupScreen.classList.add('hidden');
        if (this.dom.gameScreen) this.dom.gameScreen.classList.remove('hidden');

        this.startNewRound();
    }

    resetToHome() {
        if (this.dom.scoreModal) this.dom.scoreModal.classList.add('hidden');
        this.players = [];
        this.trickCards = [];
        this.currentRoundIndex = 0;
        if (this.dom.playedCards) this.dom.playedCards.innerHTML = "";
        if (this.dom.humanHand) this.dom.humanHand.innerHTML = "";
        if (this.dom.gameScreen) this.dom.gameScreen.classList.add('hidden');
        if (this.dom.setupScreen) this.dom.setupScreen.classList.remove('hidden');
        this.generatePlayerInputs();
    }

    // ─── Positions des adversaires autour de la table ───────────────────────
    // Le joueur humain est TOUJOURS en bas (position fixe).
    // Les adversaires sont répartis en arc de cercle de gauche à droite en passant par le haut.
    // Positions définies en % (left, top) depuis le centre du slot.
    getOpponentPositions(totalOpponents) {
        // Positions calculées sur l'ellipse de la table.
        // La table est un ovale border-radius:50%/40%.
        // On place les n adversaires en arc de cercle du bas-gauche au bas-droit
        // en passant par le haut (angles -200° à -340° en radians, sens horaire).
        // rx=42%, ry=38% = demi-axes de l'ellipse intérieure (légèrement en retrait du bord).
        const rx = 38; // demi-axe horizontal %
        const ry = 34; // demi-axe vertical %
        const cx = 50; // centre X %
        const cy = 50; // centre Y %

        // Arc de 205° à 335° — du bas-gauche au bas-droit en passant par le haut
        const startDeg = 205; // bas gauche
        const endDeg   = 335; // bas droit
        const positions = [];

        for (let i = 0; i < totalOpponents; i++) {
            // répartition uniforme sur l'arc
            const deg = totalOpponents === 1
                ? 270  // unique : haut centre
                : startDeg + (endDeg - startDeg) * (i / (totalOpponents - 1));
            const rad = (deg * Math.PI) / 180;
            const left = cx + rx * Math.cos(rad);
            const top  = cy + ry * Math.sin(rad);
            positions.push({ left: Math.round(left * 10) / 10, top: Math.round(top * 10) / 10 });
        }
        return positions;
    }

    updateBidButtons() {
        const cardCount = this.roundsSequence[this.currentRoundIndex];
        let html = '';

        let sumOfOtherBids = 0;
        this.players.forEach(p => {
            if (p.currentBid !== -1) sumOfOtherBids += p.currentBid;
        });

        const isLastPlayer = (this.currentPlayerIndex === this.dealerIndex);
        const forbiddenBid = cardCount - sumOfOtherBids;

        // En manche aveugle, l'humain annonce librement MAIS la règle "total ≠ cardCount" s'applique aussi
        if (this.isBlindRound()) {
            for (let i = 0; i <= cardCount; i++) {
                const isForbidden = (isLastPlayer && i === forbiddenBid && cardCount > 0);
                if (isForbidden) {
                    html += `<button class="bid-btn disabled" disabled title="Interdit">${i}</button>`;
                } else {
                    html += `<button class="bid-btn" onclick="window.game.submitHumanBid(${i})">${i}</button>`;
                }
            }

        } else {
            for (let i = 0; i <= cardCount; i++) {
                if (isLastPlayer && i === forbiddenBid) {
                    html += `<button class="bid-btn disabled" disabled title="Interdit">${i}</button>`;
                } else {
                    html += `<button class="bid-btn" onclick="window.game.submitHumanBid(${i})">${i}</button>`;
                }
            }
        }

        if (this.dom.bidButtons) this.dom.bidButtons.innerHTML = html;
    }

    submitHumanBid(bidValue) {
        this.players[0].currentBid = bidValue;
        if (this.dom.bidActionZone) this.dom.bidActionZone.classList.add('hidden');
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.renderOpponentsTable();
        this.renderHumanHand();
        this.biddingCycle();
    }

    startNewRound() {
        this.gameState = "BIDDING";
        this.trickCards = [];
        if (this.dom.playedCards) this.dom.playedCards.innerHTML = "";

        const cardCount = this.roundsSequence[this.currentRoundIndex];
        const totalRounds = this.roundsSequence.length;
        const remainingRounds = totalRounds - (this.currentRoundIndex + 1);
        const blind = this.isBlindRound();

        let roundText = `${this.currentRoundIndex + 1}/${totalRounds} (${cardCount}c`;
        if (remainingRounds === 0) roundText += " - Dernier!)";
        else roundText += ` - ${remainingRounds} rest.)`;
        if (this.dom.currentRound) this.dom.currentRound.textContent = roundText;

        // Bannière manche aveugle — désactivée
        if (this.dom.blindBanner) {
            this.dom.blindBanner.classList.add('hidden');
        }

        this.deck.initDeck();
        this.deck.shuffle();

        this.trumpCard = distributeCards(this.deck, this.players, cardCount);

        if (this.trumpCard) {
            this.trumpSuit = this.trumpCard.suit;

            let trumpValueLabel = "";
            if (typeof this.trumpCard.getValueLabel === "function") {
                trumpValueLabel = this.trumpCard.getValueLabel();
            } else {
                const labels = { 11: 'V', 12: 'D', 13: 'R', 14: 'A' };
                trumpValueLabel = labels[this.trumpCard.value] || this.trumpCard.value;
            }

            const suitSymbols = { 'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠' };
            const suitNames = { 'H': 'Coeur', 'D': 'Carreau', 'C': 'Trefle', 'S': 'Pique' };

            if (this.dom.currentTrump) {
                this.dom.currentTrump.className = "";
                if (this.trumpSuit === 'H' || this.trumpSuit === 'D') {
                    this.dom.currentTrump.classList.add('trump-red');
                } else {
                    this.dom.currentTrump.classList.add('trump-black');
                }
                this.dom.currentTrump.textContent = `${suitSymbols[this.trumpSuit]} ${suitNames[this.trumpSuit]}`;
            }

            if (this.dom.atoutDisplay && this.dom.atoutCard) {
                this.dom.atoutDisplay.classList.remove('hidden');
                const filename = `cartes/${this.trumpCard.suit}${this.trumpCard.value}.svg`;
                this.dom.atoutCard.style.backgroundImage = `url('${filename}')`;
            }
        } else {
            this.trumpSuit = 'NONE';
            if (this.dom.currentTrump) {
                this.dom.currentTrump.className = "";
                this.dom.currentTrump.textContent = "Sans Atout";
            }
            if (this.dom.atoutDisplay) this.dom.atoutDisplay.classList.add('hidden');
        }

        this.players.forEach(p => {
            p.currentBid = -1;
            p.tricksWon = 0;
        });

        this.currentPlayerIndex = (this.dealerIndex + 1) % this.players.length;
        this.firstPlayerOfTrickIndex = this.currentPlayerIndex;

        this.renderOpponentsTable();
        this.renderHumanHand();

        if (this.dom.infoStatut) this.dom.infoStatut.textContent = blind
            ? "🙈 Manche aveugle — Phase d'annonces..."
            : "Phase d'annonces...";

        this.biddingCycle();
    }

    // ─── Tailles adaptatives selon le nombre d'adversaires ──────────────────
    getSlotScale(totalOpponents) {
        // cardW/cardH  = cartes face visible (manche aveugle)
        // miniW/miniH  = dos de cartes (manches normales)
        // miniOverlap  = chevauchement négatif entre dos de cartes (px)
        const scales = {
            1: { cardW: 72, cardH:104, miniW: 53, miniH: 77, miniOverlap: -8,  slotW: 180, avatarSize: 44, fontSize: 1.0,  bubblePad: '7px 16px', gap: 4 },
            2: { cardW: 66, cardH: 96, miniW: 46, miniH: 66, miniOverlap: -7,  slotW: 160, avatarSize: 42, fontSize: 0.95, bubblePad: '6px 14px', gap: 4 },
            3: { cardW: 58, cardH: 84, miniW: 41, miniH: 59, miniOverlap: -6,  slotW: 140, avatarSize: 40, fontSize: 0.9,  bubblePad: '6px 12px', gap: 3 },
            4: { cardW: 50, cardH: 72, miniW: 35, miniH: 50, miniOverlap: -5,  slotW: 120, avatarSize: 36, fontSize: 0.85, bubblePad: '5px 10px', gap: 3 },
            5: { cardW: 42, cardH: 62, miniW: 29, miniH: 42, miniOverlap: -5,  slotW: 105, avatarSize: 32, fontSize: 0.78, bubblePad: '4px 8px',  gap: 2 },
            6: { cardW: 36, cardH: 52, miniW: 26, miniH: 38, miniOverlap: -4,  slotW:  95, avatarSize: 28, fontSize: 0.72, bubblePad: '4px 7px',  gap: 2 },
        };
        return scales[totalOpponents] || scales[6];
    }

    // ─── Rendu des adversaires autour de la table ────────────────────────────
    renderOpponentsTable() {
        if (!this.dom.opponentsContainer) return;
        this.dom.opponentsContainer.innerHTML = "";

        const opponents = this.players.slice(1);
        const totalOpponents = opponents.length;
        const positions = this.getOpponentPositions(totalOpponents);
        const blind = this.isBlindRound();
        const sc = this.getSlotScale(totalOpponents);

        opponents.forEach((opp, index) => {
            const pos = positions[index] || { left: 50, top: 50 };

            const slot = document.createElement('div');
            slot.classList.add('opponent-slot');
            slot.id = `opponent-slot-${opp.id}`;
            slot.style.left = `${pos.left}%`;
            slot.style.top = `${pos.top}%`;
            slot.style.width = `${sc.slotW}px`;

            const bidText = opp.currentBid === -1 ? "?" : opp.currentBid;
            const avatar = this.botAvatars[(opp.id - 1) % this.botAvatars.length];
            const isDealer = this.dealerIndex === opp.id ? ' 🪙' : '';

            const bubbleStyle = `padding:${sc.bubblePad}; font-size:${sc.fontSize * 0.9}rem;`;
            let bubbleHtml = opp.currentBid !== -1
                ? `<div class="opponent-bid-bubble" style="${bubbleStyle}">✋ ${opp.currentBid} | 🎯 ${opp.tricksWon}</div>`
                : `<div class="opponent-bid-bubble pending" style="${bubbleStyle}">?</div>`;

            const avatarStyle = `width:${sc.avatarSize}px; height:${sc.avatarSize}px; font-size:${sc.avatarSize * 0.6}px;`;
            const infoStyle = `font-size:${sc.fontSize * 0.78}rem;`;

            let cardsHtml = '';
            if (blind && opp.hand.length > 0) {
                const cardStyle = `width:${sc.cardW}px; height:${sc.cardH}px; background-color:white; border-radius:4px; background-size:cover; background-position:center; box-shadow:0 2px 5px rgba(0,0,0,0.4); border:1px solid #ccc; flex-shrink:0;`;
                const rowStyle = `display:flex; flex-wrap:wrap; justify-content:center; gap:${sc.gap}px; margin-top:4px; overflow:visible;`;
                cardsHtml = `<div style="${rowStyle}">`;
                opp.hand.forEach(card => {
                    const filename = `cartes/${card.suit}${card.value}.svg`;
                    cardsHtml += `<div style="${cardStyle} background-image:url('${filename}');"></div>`;
                });
                cardsHtml += `</div>`;
            } else {
                // Dos de cartes avec taille adaptée + chevauchement selon nb joueurs
                const miniStyle = `width:${sc.miniW}px; height:${sc.miniH}px; background-color:#2c3e50; background-image:url('cartes/BACK.svg'); background-size:cover; border:1px solid white; border-radius:3px; flex-shrink:0; margin-left:${sc.miniOverlap}px;`;
                const miniFirst = `width:${sc.miniW}px; height:${sc.miniH}px; background-color:#2c3e50; background-image:url('cartes/BACK.svg'); background-size:cover; border:1px solid white; border-radius:3px; flex-shrink:0; margin-left:0;`;
                const miniCards = opp.hand.map((_, idx) =>
                    `<div style="${idx === 0 ? miniFirst : miniStyle}"></div>`
                ).join('');
                const rowStyle = `display:flex; flex-wrap:nowrap; justify-content:center; margin-top:4px; overflow:visible;`;
                cardsHtml = `<div style="${rowStyle}">${miniCards}</div>`;
            }

            slot.innerHTML = `
                ${bubbleHtml}
                <div class="opponent-avatar" style="${avatarStyle}">
                    ${avatar}
                    <div class="opponent-score-badge">${opp.totalScore}</div>
                </div>
                <div class="opponent-info" style="${infoStyle}">
                    <div class="opponent-name">${opp.name}${isDealer}</div>
                    <div class="opponent-tricks">Plis: ${opp.tricksWon}/${bidText}</div>
                </div>
                ${cardsHtml}
            `;

            this.dom.opponentsContainer.appendChild(slot);
        });

        this.highlightActivePlayer();
    }

    highlightActivePlayer() {
        document.querySelectorAll('.opponent-slot').forEach(el => el.classList.remove('active-turn'));
        if (this.currentPlayerIndex === 0) {
            if (this.dom.humanPlayerZone) {
                this.dom.humanPlayerZone.style.boxShadow = "0 -5px 20px rgba(241, 196, 15, 0.4)";
            }
        } else {
            if (this.dom.humanPlayerZone) {
                this.dom.humanPlayerZone.style.boxShadow = "none";
            }
            const activeSlot = document.getElementById(`opponent-slot-${this.currentPlayerIndex}`);
            if (activeSlot) activeSlot.classList.add('active-turn');
        }
    }

    // ─── Rendu de la main humaine ─────────────────────────────────────────────
    renderHumanHand() {
        if (!this.dom.humanHand) return;
        this.dom.humanHand.innerHTML = "";
        this.players[0].hand.sort((a, b) => a.suit.localeCompare(b.suit) || b.value - a.value);

        const blind = this.isBlindRound();

        this.players[0].hand.forEach((card) => {
            // En manche aveugle : carte face cachée, non cliquable visuellement
            const cardEl = card.renderHTML(!blind);
            if (blind) {
                cardEl.classList.add('blind-own-card');
                cardEl.title = "Manche aveugle — vous ne pouvez pas voir vos cartes";
            }
            cardEl.addEventListener('click', () => {
                if (this.gameState === "PLAYING" && this.currentPlayerIndex === 0) {
                    this.handleHumanPlayCard(card);
                }
            });
            this.dom.humanHand.appendChild(cardEl);
        });

        const human = this.players[0];
        const bidText = human.currentBid === -1 ? "?" : human.currentBid;
        const blindTag = blind ? ' 🙈' : '';

        if (this.dom.humanStatus) {
            this.dom.humanStatus.innerHTML = `Annonce: <strong>${bidText}</strong> | Plis: <strong>${human.tricksWon}</strong>${this.dealerIndex === 0 ? ' 🪙' : ''}${blindTag}`;
        }
        if (this.dom.humanScore) {
            this.dom.humanScore.textContent = human.totalScore;
        }
    }

    biddingCycle() {
        if (this.gameState !== "BIDDING") return;

        const currentActive = this.players[this.currentPlayerIndex];
        const allBidded = this.players.every(p => p.currentBid !== -1);

        if (allBidded) {
            this.gameState = "PLAYING";
            this.currentPlayerIndex = (this.dealerIndex + 1) % this.players.length;
            this.firstPlayerOfTrickIndex = this.currentPlayerIndex;
            if (this.dom.infoStatut) this.dom.infoStatut.textContent = `À ${this.players[this.currentPlayerIndex].name} de jouer`;
            this.renderOpponentsTable();
            this.renderHumanHand();

            if (this.players[this.currentPlayerIndex].isBot) {
                setTimeout(() => this.botPlayCycle(), 1000);
            }
            return;
        }

        if (currentActive.isBot) {
            const cardCount = this.roundsSequence[this.currentRoundIndex];
            const blind = this.isBlindRound();

            // En manche aveugle, le bot annonce aussi librement (il ne voit pas ses cartes = aléatoire)
            const botBid = RikikiAI.calculateBid(
                currentActive.hand, this.trumpSuit,
                this.players, this.currentPlayerIndex,
                this.dealerIndex, cardCount, blind
            );

            currentActive.currentBid = botBid;
            if (this.dom.infoStatut) this.dom.infoStatut.textContent = `${currentActive.name} annonce ${botBid}${blind ? ' 🙈' : ''}`;
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;

            setTimeout(() => {
                this.renderOpponentsTable();
                this.biddingCycle();
            }, 800);
        } else {
            this.highlightActivePlayer();
            this.showBidButtons();
        }
    }

    showBidButtons() {
        this.updateBidButtons();
        if (this.dom.bidActionZone) this.dom.bidActionZone.classList.remove('hidden');
    }

    handleHumanPlayCard(card) {
        if (this.gameState !== "PLAYING" || this.currentPlayerIndex !== 0) return;

        const validCards = RikikiAI.getValidPlayableCards(this.players[0].hand, this.trickCards);
        if (!validCards.includes(card)) {
            if (this.dom.infoStatut) this.dom.infoStatut.textContent = "Couleur obligatoire !";
            if (navigator.vibrate) navigator.vibrate(100);
            return;
        }

        this.players[0].hand = this.players[0].hand.filter(c => c !== card);
        this.trickCards.push({ player: this.players[0], card: card });

        this.renderPlayOnTable(card, this.players[0].name);
        this.renderHumanHand();

        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.checkTrickStatus();
    }

    botPlayCycle() {
        if (this.gameState !== "PLAYING") return;
        const bot = this.players[this.currentPlayerIndex];
        const blind = this.isBlindRound();

        const chosenCard = RikikiAI.chooseCardToPlay(
            bot.hand, this.trickCards, this.trumpSuit,
            bot.tricksWon, bot.currentBid, blind
        );

        bot.hand = bot.hand.filter(c => c !== chosenCard);
        this.trickCards.push({ player: bot, card: chosenCard });

        this.renderPlayOnTable(chosenCard, bot.name);
        this.renderOpponentsTable();

        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.checkTrickStatus();
    }

    renderPlayOnTable(card, playerName) {
        if (!this.dom.playedCards) return;

        const visualCard = card.renderHTML(true);
        visualCard.classList.add('card-played-anim');

        const totalPlayers = this.players.length;
        const activePlayer = this.players.find(p => p.name === playerName);
        const playerIndex = activePlayer ? activePlayer.id : this.trickCards.length - 1;

        const angle = (playerIndex * (360 / totalPlayers)) - 90;
        const radius = 22;
        const offsetX = Math.cos((angle * Math.PI) / 180) * radius;
        const offsetY = Math.sin((angle * Math.PI) / 180) * radius;
        const cardRotation = ((playerIndex * 29) % 17) - 8;

        visualCard.style.position = "absolute";
        visualCard.style.left = "50%";
        visualCard.style.top = "50%";
        visualCard.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) rotate(${cardRotation}deg)`;
        visualCard.style.zIndex = this.trickCards.length;
        visualCard.style.margin = "0";

        const nameLabel = document.createElement('div');
        nameLabel.className = 'played-card-label';
        nameLabel.textContent = playerName;
        visualCard.appendChild(nameLabel);

        this.dom.playedCards.appendChild(visualCard);

        let valeurAffichee = (typeof card.getValueLabel === "function") ? card.getValueLabel() : card.value;
        let couleurAffichee = (typeof card.getSuitName === "function") ? card.getSuitName() : card.suit;
        if (this.dom.infoStatut) this.dom.infoStatut.textContent = `${playerName}: ${valeurAffichee} de ${couleurAffichee}`;
    }

    checkTrickStatus() {
        if (this.trickCards.length === this.players.length) {
            setTimeout(() => this.resolveTrick(), 1500);
        } else {
            this.highlightActivePlayer();
            if (this.players[this.currentPlayerIndex].isBot) {
                setTimeout(() => this.botPlayCycle(), 1000);
            }
        }
    }

    resolveTrick() {
        const winnerPlay = determineTrickWinner(this.trickCards, this.trumpSuit);
        const winner = winnerPlay.player;
        winner.tricksWon++;

        if (this.dom.infoStatut) this.dom.infoStatut.textContent = `${winner.name} remporte le pli !`;
        this.trickCards = [];
        if (this.dom.playedCards) this.dom.playedCards.innerHTML = "";

        this.currentPlayerIndex = winner.id;
        this.firstPlayerOfTrickIndex = winner.id;

        this.renderOpponentsTable();
        this.renderHumanHand();

        if (this.players[0].hand.length === 0) {
            this.resolveRound();
        } else {
            if (this.players[this.currentPlayerIndex].isBot) {
                setTimeout(() => this.botPlayCycle(), 1000);
            }
        }
    }

    resolveRound() {
        this.players.forEach(p => {
            let roundScore = 0;
            if (p.tricksWon === p.currentBid) {
                roundScore = 10 + (p.tricksWon * 2);
            } else {
                const ecart = Math.abs(p.tricksWon - p.currentBid);
                roundScore = -(ecart * 2);
            }
            p.totalScore += roundScore;
            p.scoreHistory.push(p.totalScore);
        });

        this.currentRoundIndex++;

        if (this.currentRoundIndex >= this.roundsSequence.length) {
            this.gameState = "GAME_OVER";
            if (this.dom.infoStatut) this.dom.infoStatut.textContent = "Partie terminée !";
            this.showScoresWindow(false);
        } else {
            this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
            this.gameState = "ROUND_OVER";
            if (this.dom.infoStatut) this.dom.infoStatut.textContent = "Manche finie !";
            this.showScoresWindow(true);
        }
    }

    showScoresWindow(showNextRoundButton = false) {
        if (!this.dom.scoreModal || !this.dom.scoreTableContainer) return;
        this.dom.scoreModal.classList.remove('hidden');

        let html = `<table><thead><tr><th>M.</th>`;
        this.players.forEach(p => { html += `<th>${p.name}</th>`; });
        html += `</tr></thead><tbody>`;

        this.roundsSequence.forEach((cardCount, m) => {
            const isBlind = (m === 0 || m === this.roundsSequence.length - 1);
            const isCurrentRow = (m === this.currentRoundIndex - 1 && this.gameState === "ROUND_OVER");
            html += `<tr class="${isCurrentRow ? 'current-row-highlight' : ''}">`;
            html += `<td><strong>${m + 1} (${cardCount}c)${isBlind ? ' 🙈' : ''}</strong></td>`;

            this.players.forEach(p => {
                if (m < this.currentRoundIndex) {
                    html += `<td><strong>${p.scoreHistory[m]}</strong></td>`;
                } else {
                    html += `<td>-</td>`;
                }
            });
            html += `</tr>`;
        });
        html += `</tbody></table>`;

        if (showNextRoundButton) {
            const nextIsBlind = this.isBlindRound();
            const blindWarning = nextIsBlind
                ? `<p class="blind-next-warning">🙈 La prochaine manche est une manche aveugle !</p>`
                : '';
            html += `
                ${blindWarning}
                <div style="text-align: center; margin-top: 20px;">
                    <button id="next-round-action-btn" class="modal-btn">
                        Manche suivante ➔
                    </button>
                </div>
            `;
        } else {
            html += `
                <div style="text-align: center; margin-top: 20px;">
                    <button id="home-return-btn" class="modal-btn secondary">
                        🏠 Accueil
                    </button>
                </div>
            `;
        }

        this.dom.scoreTableContainer.innerHTML = html;

        if (showNextRoundButton) {
            const nextBtn = document.getElementById('next-round-action-btn');
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    this.dom.scoreModal.classList.add('hidden');
                    this.gameState = "BIDDING";
                    this.startNewRound();
                });
            }
        } else {
            const homeBtn = document.getElementById('home-return-btn');
            if (homeBtn) {
                homeBtn.addEventListener('click', () => this.resetToHome());
            }
        }
    }
}
