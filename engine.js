/**
 * Rikiki - Moteur Logique (engine.js)
 * Gère les cartes, le deck, le mélange, la distribution et les règles de plis.
 */

class Card {
    constructor(suit, value) {
        this.suit = suit; // 'H' (Coeur), 'D' (Carreau), 'C' (Trèfle), 'S' (Pique)
        this.value = value; // 2 à 14 (14 = As)
    }

    getSuitName() {
        const names = { 'H': 'Cœur', 'D': 'Carreau', 'C': 'Trèfle', 'S': 'Pique' };
        return names[this.suit];
    }

    getValueLabel() {
        if (this.value <= 10) return this.value.toString();
        const labels = { 11: 'Valet', 12: 'Dame', 13: 'Roi', 14: 'As' };
        return labels[this.value];
    }

    /**
     * Génère l'élément HTML complet d'une carte en liant les fichiers du dossier /cartes
     */
    renderHTML(isFaceUp = true) {
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('card');

        if (isFaceUp) {
            // Face de la carte (Ex: cartes/S13.svg)
            const filename = `cartes/${this.suit}${this.value}.svg`;
            cardDiv.style.backgroundImage = `url('${filename}')`;
            cardDiv.classList.remove('card-back');
        } else {
            // DOS DE LA CARTE : On applique directement l'image locale via le script
            cardDiv.style.backgroundImage = "url('cartes/BACK.svg')";
            cardDiv.classList.add('card-back');
        }

        return cardDiv;
    }
}

class Deck {
    constructor() {
        this.cards = [];
    }

    initDeck() {
        this.cards = [];
        const suits = ['H', 'D', 'C', 'S'];
        for (let suit of suits) {
            for (let value = 2; value <= 14; value++) {
                this.cards.push(new Card(suit, value));
            }
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    drawCard() {
        return this.cards.pop() || null;
    }
}

/**
 * SÉQUENCES OFFICIELLES RIKIKI (De 3 à 7 Joueurs)
 */
function generateRoundsSequence(playerCount) {
    let sequence = [];
    
    switch (playerCount) {
        case 3: // 21 manches
            for (let i = 1; i <= 10; i++) sequence.push(i);
            sequence.push(10);
            for (let i = 10; i >= 1; i--) sequence.push(i);
            break;
            
        case 4: // 20 manches
        case 5: // 20 manches
            for (let i = 1; i <= 10; i++) sequence.push(i);
            for (let i = 10; i >= 1; i--) sequence.push(i);
            break;
            
        case 6: // 18 manches (Sommet : 4x la manche à 8)
            for (let i = 1; i <= 8; i++) sequence.push(i);
            sequence.push(8, 8, 8); 
            for (let i = 7; i >= 1; i--) sequence.push(i);
            break;
            
        case 7: // 14 manches
            for (let i = 1; i <= 7; i++) sequence.push(i);
            sequence.push(7);
            for (let i = 6; i >= 1; i--) sequence.push(i);
            break;
            
        default: // Sécurité par défaut
            for (let i = 1; i <= 10; i++) sequence.push(i);
            for (let i = 10; i >= 1; i--) sequence.push(i);
    }
    
    return sequence;
}

function distributeCards(deck, players, cardCount) {
    players.forEach(p => p.hand = []);
    for (let i = 0; i < cardCount; i++) {
        players.forEach(p => {
            const card = deck.drawCard();
            if (card) p.hand.push(card);
        });
    }
    return deck.drawCard(); // La retourne d'Atout
}

function determineTrickWinner(trickCards, trumpSuit) {
    if (!trickCards || trickCards.length === 0) return null;
    
    let bestPlay = trickCards[0];
    const ledSuit = trickCards[0].card.suit;

    for (let i = 1; i < trickCards.length; i++) {
        const currentPlay = trickCards[i];
        const currentCard = currentPlay.card;
        const bestCard = bestPlay.card;

        if (currentCard.suit === trumpSuit && bestCard.suit !== trumpSuit) {
            bestPlay = currentPlay;
        } else if (currentCard.suit === trumpSuit && bestCard.suit === trumpSuit) {
            if (currentCard.value > bestCard.value) bestPlay = currentPlay;
        } else if (currentCard.suit === ledSuit && bestCard.suit === ledSuit) {
            if (currentCard.value > bestCard.value) bestPlay = currentPlay;
        }
    }

    return bestPlay;
}
