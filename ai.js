/**
 * Rikiki - Intelligence Artificielle (ai.js)
 */

class RikikiAI {

    static calculateBid(hand, trumpSuit, allPlayers, botIndex, dealerIndex, cardCount, isBlindRound) {
        // MANCHE AVEUGLE : le bot ne sait pas ce qu'il a, annonce 0
        if (isBlindRound) return 0;

        if (!hand || hand.length === 0) return 0;
        let estimatedTricks = 0;
        const suitCounts = { 'H': 0, 'D': 0, 'C': 0, 'S': 0 };
        hand.forEach(card => suitCounts[card.suit]++);

        hand.forEach(card => {
            const isTrump = (card.suit === trumpSuit);
            if (isTrump) {
                if (card.value >= 11) estimatedTricks += 0.9;
                else if (card.value >= 8) estimatedTricks += 0.5;
                else estimatedTricks += 0.2;
            } else {
                if (card.value === 14) estimatedTricks += 0.7;
                else if (card.value === 13) estimatedTricks += (suitCounts[card.suit] <= 3) ? 0.5 : 0.3;
                else if (card.value === 12) estimatedTricks += (suitCounts[card.suit] <= 2) ? 0.3 : 0.1;
            }
        });

        let finalBid = Math.round(estimatedTricks);
        finalBid = Math.min(finalBid, hand.length);

        // REGLE DU DONNEUR INTERDIT
        if (allPlayers && botIndex !== undefined && dealerIndex !== undefined && botIndex === dealerIndex) {
            let sumOfOtherBids = 0;
            allPlayers.forEach(p => {
                if (p.id !== botIndex && p.currentBid !== -1) {
                    sumOfOtherBids += p.currentBid;
                }
            });
            const forbiddenBid = cardCount - sumOfOtherBids;
            if (finalBid === forbiddenBid) {
                if (finalBid === hand.length) {
                    finalBid = Math.max(0, finalBid - 1);
                } else {
                    finalBid++;
                }
            }
        }

        return finalBid;
    }

    static getValidPlayableCards(hand, trickCards) {
        if (!trickCards || trickCards.length === 0) return hand;
        const ledSuit = trickCards[0].card.suit;
        const matchingCards = hand.filter(card => card.suit === ledSuit);
        if (matchingCards.length > 0) return matchingCards;
        return hand;
    }

    static chooseCardToPlay(hand, trickCards, trumpSuit, tricksWon, currentBid, isBlindRound) {
        const playableCards = this.getValidPlayableCards(hand, trickCards);
        if (playableCards.length === 1) return playableCards[0];

        // MANCHE AVEUGLE : joue une carte aléatoire parmi les jouables
        if (isBlindRound) {
            return playableCards[Math.floor(Math.random() * playableCards.length)];
        }

        const wantsToWin = (tricksWon < currentBid);

        if (wantsToWin) {
            if (trickCards.length === 0) {
                return this.getBestOpeningCard(playableCards, trumpSuit);
            }
            const winningCards = playableCards.filter(card => {
                const testTable = [...trickCards, { player: { id: 'temp_bot' }, card: card }];
                return determineTrickWinner(testTable, trumpSuit).player.id === 'temp_bot';
            });
            if (winningCards.length > 0) {
                return this.getHighestValueCard(winningCards, trumpSuit);
            }
            return this.getLowestValueCard(playableCards, trumpSuit);
        } else {
            if (trickCards.length === 0) {
                return this.getSafestLosingCard(playableCards, trumpSuit);
            }
            const losingCards = playableCards.filter(card => {
                const testTable = [...trickCards, { player: { id: 'temp_bot' }, card: card }];
                return determineTrickWinner(testTable, trumpSuit).player.id !== 'temp_bot';
            });
            if (losingCards.length > 0) {
                return this.getHighestValueCard(losingCards, trumpSuit);
            }
            return this.getLowestValueCard(playableCards, trumpSuit);
        }
    }

    static getHighestValueCard(cards, trumpSuit) {
        return cards.reduce((highest, card) => card.value > highest.value ? card : highest, cards[0]);
    }

    static getLowestValueCard(cards, trumpSuit) {
        return cards.reduce((lowest, card) => card.value < lowest.value ? card : lowest, cards[0]);
    }

    static getBestOpeningCard(cards, trumpSuit) {
        const normalStrong = cards.filter(c => c.suit !== trumpSuit && c.value >= 13);
        if (normalStrong.length > 0) return normalStrong[0];
        return this.getHighestValueCard(cards, trumpSuit);
    }

    static getSafestLosingCard(cards, trumpSuit) {
        const nonTrumps = cards.filter(c => c.suit !== trumpSuit);
        if (nonTrumps.length > 0) return this.getLowestValueCard(nonTrumps, trumpSuit);
        return this.getLowestValueCard(cards, trumpSuit);
    }
}
