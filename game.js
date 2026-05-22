/**
 * Rikiki - Gestionnaire Principal de Partie (game.js) - Version Améliorée
 * Orchestre les joueurs, les manches, le tour par tour et les mises à jour visuelles.
 */

class Player {
    constructor(id, name, isBot = true) {
        this.id = id;
        this.name = name;
        this.isBot = isBot;
        this.hand = [];
        this.currentBid = -1;
        this.tricksWon = 0;
        this.scoreHistory = []; // Stocke le score cumulé à la fin de chaque manche
        this.totalScore = 0;
    }
}

class RikikiGame {
    constructor() {
        this.players = [];
        this.deck = new Deck();
        this.roundsSequence = [];
        this.currentRoundIndex = 0; // Index de la manche en cours
        this.trumpCard = null;
        this.trumpSuit = null;
        
        this.dealerIndex = 0;       // Qui distribue
        this.currentPlayerIndex = 0; // À qui le tour de jouer
        this.firstPlayerOfTrickIndex = 0; // Qui a ouvert le pli en cours
        
        this.trickCards = [];       // Cartes actuellement posées sur la table [{player, card}]
        this.gameState = "SETUP";   // SETUP, BIDDING, PLAYING, ROUND_OVER, GAME_OVER

        this.initDomElements();
        this.bindEvents();
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
            humanPlayerZone: document.getElementById('human-player-zone'),
            bidActionZone: document.getElementById('bid-action-zone'),
            bidButtons: document.getElementById('bid-buttons'),
            toggleScoreBtn: document.getElementById('toggle-score-btn'),
            scoreModal: document.getElementById('score-modal'),
            closeScoreBtn: document.getElementById('close-score-btn'),
            scoreTableContainer: document.getElementById('score-table-container')
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

        // Profil principal (Humain)
        const humanDiv = document.createElement('div');
        humanDiv.innerHTML = `<label>Votre nom :</label><input type="text" id="p-name-0" value="Bruno" />`;
        this.dom.playersInputContainer.appendChild(humanDiv);

        // Liste des Bots adverses
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

        
        // Cache la modal de score au cas où elle est ouverte
        if (this.dom.scoreModal) this.dom.scoreModal.classList.add('hidden');
        
        // Nettoyage de l'état du jeu
        this.players = [];
        this.trickCards = [];
        this.currentRoundIndex = 0;
        if (this.dom.playedCards) this.dom.playedCards.innerHTML = "";
        if (this.dom.humanHand) this.dom.humanHand.innerHTML = "";
        
        // Écrans
        if (this.dom.gameScreen) this.dom.gameScreen.classList.add('hidden');
        if (this.dom.setupScreen) this.dom.setupScreen.classList.remove('hidden');
        
        this.generatePlayerInputs();
    }

    updateBidButtons() {
        const cardCount = this.roundsSequence[this.currentRoundIndex];
        let html = '';
        
        let sumOfOtherBids = 0;
        this.players.forEach(p => {
            if (p.currentBid !== -1) {
                sumOfOtherBids += p.currentBid;
            }
        });

        const isLastPlayer = (this.currentPlayerIndex === this.dealerIndex);
        const forbiddenBid = cardCount - sumOfOtherBids;

        for (let i = 0; i <= cardCount; i++) {
            if (isLastPlayer && i === forbiddenBid) {
                html += `<button class="bid-btn disabled" style="background-color: #3d1d1d; color: #721c24; border: 1px solid #721c24; cursor: not-allowed;" disabled title="Le total des annonces ne peut pas être égal à ${cardCount}">${i}</button>`;
            } else {
                html += `<button class="bid-btn" onclick="window.game.submitHumanBid(${i})">${i}</button>`;
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
        if (this.dom.playedCards) {
            this.dom.playedCards.innerHTML = "";
        }
        
        const cardCount = this.roundsSequence[this.currentRoundIndex];
        const totalRounds = this.roundsSequence.length;
        const remainingRounds = totalRounds - (this.currentRoundIndex + 1);
        
        let roundText = `${this.currentRoundIndex + 1} / ${totalRounds} (${cardCount} c. `;
        if (remainingRounds === 0) {
            roundText += "- Dernier match !)";
        } else {
            roundText += `- ${remainingRounds} restante${remainingRounds > 1 ? 's' : ''})`;
        }
        if (this.dom.currentRound) this.dom.currentRound.textContent = roundText;

        this.deck.initDeck();
        this.deck.shuffle();
        
        this.trumpCard = distributeCards(this.deck, this.players, cardCount);
        
        if (this.trumpCard) {
            this.trumpSuit = this.trumpCard.suit;
            
            let trumpValueLabel = "";
            if (typeof this.trumpCard.getValueLabel === "function") {
                trumpValueLabel = this.trumpCard.getValueLabel();
            } else {
                const labels = { 11: 'Valet', 12: 'Dame', 13: 'Roi', 14: 'As' };
                trumpValueLabel = labels[this.trumpCard.value] || this.trumpCard.value;
            }

            const suitSymbols = { 'H': '♥ Cœur', 'D': '♦ Carreau', 'C': '♣ Trèfle', 'S': '♠ Pique' };
            
            if (this.dom.currentTrump) {
                this.dom.currentTrump.className = "";
                if (this.trumpSuit === 'H' || this.trumpSuit === 'D') {
                    this.dom.currentTrump.classList.add('trump-red');
                } else {
                    this.dom.currentTrump.classList.add('trump-black');
                }
                this.dom.currentTrump.textContent = `${trumpValueLabel} de ${suitSymbols[this.trumpSuit]}`;
            }
        } else {
            this.trumpSuit = 'NONE';
            if (this.dom.currentTrump) {
                this.dom.currentTrump.className = "";
                this.dom.currentTrump.textContent = "Sans Atout";
            }
        }

        this.players.forEach(p => {
            p.currentBid = -1;
            p.tricksWon = 0;
        });

        this.currentPlayerIndex = (this.dealerIndex + 1) % this.players.length;
        this.firstPlayerOfTrickIndex = this.currentPlayerIndex;

        this.renderOpponentsTable();
        this.renderHumanHand();
        
        if (this.dom.infoStatut) this.dom.infoStatut.textContent = "Phase d'annonces...";
        this.biddingCycle();
    }

    renderOpponentsTable() {
        if (!this.dom.opponentsContainer) return;
        this.dom.opponentsContainer.innerHTML = "";
        const opponents = this.players.slice(1);
        const totalOpponents = opponents.length;

        opponents.forEach((opp, index) => {
            const slot = document.createElement('div');
            slot.classList.add('opponent-slot');
            slot.id = `opponent-slot-${opp.id}`;

            const angle = (index * (360 / (totalOpponents + 1))) + 135;
            slot.style.left = `${50 + 38 * Math.cos((angle * Math.PI) / 180)}%`;
            slot.style.top = `${50 + 35 * Math.sin((angle * Math.PI) / 180)}%`;

            const bidText = opp.currentBid === -1 ? "?" : opp.currentBid;
            let miniCardsHtml = "";
            for(let c=0; c < opp.hand.length; c++) {
                miniCardsHtml += `<div class="opponent-mini-card"></div>`;
            }

            // AJOUT DU SCORE ICI DANS LA CASE DU BOT
            slot.innerHTML = `
                <div class="opponent-name">${opp.name} ${this.dealerIndex === opp.id ? '🪙' : ''}</div>
                <div class="opponent-score" style="color: #f1c40f; font-weight: bold; font-size: 0.85rem; margin: 2px 0;">Score : ${opp.totalScore} pts</div>
                <div class="opponent-status">Annonce : ${bidText} | Plis : ${opp.tricksWon}</div>
                <div class="opponent-cards-artificiel">${miniCardsHtml}</div>
            `;
            this.dom.opponentsContainer.appendChild(slot);
        });
        this.highlightActivePlayer();
    }

    highlightActivePlayer() {
        document.querySelectorAll('.opponent-slot').forEach(el => el.classList.remove('active-turn'));
        if (this.currentPlayerIndex === 0) {
            if (this.dom.humanPlayerZone) this.dom.humanPlayerZone.style.boxShadow = "0 0 20px #3498db";
        } else {
            if (this.dom.humanPlayerZone) this.dom.humanPlayerZone.style.boxShadow = "none";
            const activeSlot = document.getElementById(`opponent-slot-${this.currentPlayerIndex}`);
            if (activeSlot) activeSlot.classList.add('active-turn');
        }
    }

    renderHumanHand() {
        if (!this.dom.humanHand) return;
        this.dom.humanHand.innerHTML = "";
        this.players[0].hand.sort((a, b) => a.suit.localeCompare(b.suit) || b.value - a.value);

        this.players[0].hand.forEach((card) => {
            const cardEl = card.renderHTML(true);
            cardEl.addEventListener('click', () => {
                if (this.gameState === "PLAYING" && this.currentPlayerIndex === 0) {
                    this.handleHumanPlayCard(card);
                }
            });
            this.dom.humanHand.appendChild(cardEl);
        });

        // AJOUT DU SCORE ICI DANS TA BARRE DE STATUT (HUMAIN)
        const human = this.players[0];
        const bidText = human.currentBid === -1 ? "?" : human.currentBid;
        if (this.dom.humanStatus) {
            this.dom.humanStatus.innerHTML = `Score : <strong style="color: #f1c40f;">${human.totalScore} pts</strong> | Annonce : <strong>${bidText}</strong> | Plis : <strong>${human.tricksWon}</strong> ${this.dealerIndex === 0 ? '🪙' : ''}`;
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
            if (this.dom.infoStatut) this.dom.infoStatut.textContent = `À ${this.players[this.currentPlayerIndex].name} de jouer.`;
            this.renderOpponentsTable();
            this.renderHumanHand();
            
            if (this.players[this.currentPlayerIndex].isBot) {
                setTimeout(() => this.botPlayCycle(), 1000);
            }
            return;
        }

        if (currentActive.isBot) {
            const cardCount = this.roundsSequence[this.currentRoundIndex];
            const botBid = RikikiAI.calculateBid(currentActive.hand, this.trumpSuit, this.players, this.currentPlayerIndex, this.dealerIndex, cardCount);
            
            currentActive.currentBid = botBid;
            if (this.dom.infoStatut) this.dom.infoStatut.textContent = `${currentActive.name} annonce ${botBid}`;
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
        const validCards = RikikiAI.getValidPlayableCards(this.players[0].hand, this.trickCards);
        if (!validCards.includes(card)) {
            if (this.dom.infoStatut) this.dom.infoStatut.textContent = "Couleur obligatoire ! Vous devez suivre.";
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

        const chosenCard = RikikiAI.chooseCardToPlay(bot.hand, this.trickCards, this.trumpSuit, bot.tricksWon, bot.currentBid);
        bot.hand = bot.hand.filter(c => c !== chosenCard);
        this.trickCards.push({ player: bot, card: chosenCard });

        this.renderPlayOnTable(chosenCard, bot.name);
        this.renderOpponentsTable();

        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.checkTrickStatus();
    }

    renderPlayOnTable(card, playerName) {
        if (!this.dom.playedCards) return;

        // Configuration pour centrer le conteneur global s'il ne l'est pas en CSS
        this.dom.playedCards.style.position = "relative";
        this.dom.playedCards.style.width = "100%";
        this.dom.playedCards.style.height = "100%";

        const visualCard = card.renderHTML(true);
        
        // Calcul des positions dynamiques pour la disposition en rosace pro
        const totalPlayers = this.players.length;
        
        // On récupère l'index du joueur qui vient de poser la carte pour calculer son angle sur le tapis
        const activePlayer = this.players.find(p => p.name === playerName);
        const playerIndex = activePlayer ? activePlayer.id : this.trickCards.length;

        // Calcul de l'angle sur un cercle de 360 degrés divisé par le nombre de joueurs
        const angle = (playerIndex * (360 / totalPlayers)) - 90; // -90 pour commencer par le haut
        
        // Rayon d'écartement par rapport au centre parfait (en pixels)
        // 25px permet d'écarter légèrement les cartes pour qu'on les voie toutes, tout en restant groupées au centre
        const radius = 25; 
        const offsetX = Math.cos((angle * Math.PI) / 180) * radius;
        const offsetY = Math.sin((angle * Math.PI) / 180) * radius;
        
        // Inclinaison aléatoire naturelle propre au jeu de cartes (-8° à +8°)
        const cardRotation = ((playerIndex * 29) % 17) - 8;

        // Application des styles en pixel-perfect
        visualCard.style.position = "absolute";
        visualCard.style.left = "50%";
        visualCard.style.top = "50%";
        
        // Le translate(-50%, -50%) garantit le centrage brut, la rotation et l'offset s'appliquent par-dessus
        visualCard.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) rotate(${cardRotation}deg)`;
        visualCard.style.zIndex = this.trickCards.length; // La dernière carte jouée va au-dessus des autres
        visualCard.style.margin = "0"; // Élimine les décalages parasites des marges CSS
        visualCard.style.transition = "all 0.2s ease-out";

        // Création du badge de nom pro, discret et lisible
        const nameLabel = document.createElement('div');
        nameLabel.textContent = playerName;
        nameLabel.style.position = "absolute";
        nameLabel.style.bottom = "-20px"; // Placé juste sous la carte
        nameLabel.style.left = "50%";
        nameLabel.style.transform = "translateX(-50%)";
        nameLabel.style.background = "rgba(18, 24, 32, 0.85)"; // Look sombre premium
        nameLabel.style.color = "#ffffff";
        nameLabel.style.border = "1px solid rgba(212, 175, 55, 0.4)"; // Petit liseré doré subtil
        nameLabel.style.padding = "2px 7px";
        nameLabel.style.borderRadius = "4px";
        nameLabel.style.fontSize = "11px";
        nameLabel.style.fontWeight = "600";
        nameLabel.style.whiteSpace = "nowrap";
        nameLabel.style.boxShadow = "0 2px 6px rgba(0,0,0,0.4)";
        nameLabel.style.pointerEvents = "none";
        
        visualCard.appendChild(nameLabel);
        this.dom.playedCards.appendChild(visualCard);

        // Envoi des infos dans le bandeau de statut textuel supérieur
        let valeurAffichee = (typeof card.getValueLabel === "function") ? card.getValueLabel() : card.value;
        let couleurAffichee = (typeof card.getSuitName === "function") ? card.getSuitName() : card.suit;
        if (this.dom.infoStatut) this.dom.infoStatut.textContent = `${playerName} a joué : ${valeurAffichee} de ${couleurAffichee}`;
    }

    checkTrickStatus() {
        if (this.trickCards.length === this.players.length) {
            setTimeout(() => this.resolveTrick(), 1500);
        } else {
            this.highlightActivePlayer();
            if (this.players[this.currentPlayerIndex].isBot) {
                setTimeout(() => { this.botPlayCycle(); }, 1000);
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
                setTimeout(() => { this.botPlayCycle(); }, 1000);
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
            if (this.dom.infoStatut) this.dom.infoStatut.textContent = "Partie terminée ! Consultez le tableau final.";
            this.showScoresWindow(false); 
        } else {
            this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
            this.gameState = "ROUND_OVER";
            if (this.dom.infoStatut) this.dom.infoStatut.textContent = "Manche finie. Cliquez sur 'Manche suivante' pour continuer.";
            this.showScoresWindow(true); 
        }
    }

    showScoresWindow(showNextRoundButton = false) {
        if (!this.dom.scoreModal || !this.dom.scoreTableContainer) return;
        this.dom.scoreModal.classList.remove('hidden');
        
        let html = `<table><thead><tr><th>Manche</th>`;
        this.players.forEach(p => { html += `<th>${p.name}</th>`; });
        html += `</tr></thead><tbody>`;

        this.roundsSequence.forEach((cardCount, m) => {
            let isCurrentRow = (m === this.currentRoundIndex - 1 && this.gameState === "ROUND_OVER");
            html += `<tr class="${isCurrentRow ? 'current-row-highlight' : ''}">`;
            html += `<td><strong>M. ${m + 1} (${cardCount} c.)</strong></td>`;
            
            this.players.forEach(p => {
                if (m < this.currentRoundIndex) {
                    html += `<td>${p.scoreHistory[m]} pts</td>`;
                } else {
                    html += `<td>-</td>`;
                }
            });
            html += `</tr>`;
        });
        html += `</tbody></table>`;
        
        // CONFIGURATION DES BOUTONS DE FIN DE LOGIQUE
        if (showNextRoundButton) {
            html += `
                <div style="text-align: center; margin-top: 25px;">
                    <button id="next-round-action-btn" class="bid-btn" style="width: auto; padding: 12px 30px; font-size: 16px; cursor: pointer;">
                        Passer à la manche suivante ➔
                    </button>
                </div>
            `;
        } else {
            // CORRECTION : AJOUT DU BOUTON RETOUR À L'ACCUEIL QUAND LA PARTIE EST FINIE (GAME_OVER)
            html += `
                <div style="text-align: center; margin-top: 25px;">
                    <button id="home-return-btn" class="bid-btn" style="width: auto; padding: 12px 30px; font-size: 16px; background-color: #2980b9; color: white; border: 1px solid #3498db; cursor: pointer;">
                        🏠 Revenir à la page d'accueil
                    </button>
                </div>
            `;
        }

        this.dom.scoreTableContainer.innerHTML = html;

        // Attachement des événements dynamiques selon le bouton injecté
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
                homeBtn.addEventListener('click', () => {
                    this.resetToHome();
                });
            }
        }
    }
}

// Initialisation globale
window.addEventListener('DOMContentLoaded', () => {
    window.game = new RikikiGame();
});
