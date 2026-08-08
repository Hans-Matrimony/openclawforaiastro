#!/usr/bin/env python3
"""Small dependency-free Tarot card draw helper."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import random
from typing import Any, Dict, List, Optional


SPREADS: Dict[str, List[str]] = {
    "one_card": ["main guidance"],
    "three_card": ["past influence", "present energy", "near future direction"],
    "love": ["your heart", "their energy", "relationship pattern", "best next step"],
    "career": ["current work energy", "challenge", "opportunity", "best next step"],
    "decision": ["option A energy", "option B energy", "hidden factor", "advice", "likely direction"],
    "yes_no": ["current energy", "hidden influence", "likely direction"],
}

SPREAD_ALIASES = {
    "one": "one_card",
    "single": "one_card",
    "1": "one_card",
    "3": "three_card",
    "three": "three_card",
    "past_present_future": "three_card",
    "relationship": "love",
    "romance": "love",
    "job": "career",
    "work": "career",
    "choice": "decision",
    "yesno": "yes_no",
    "yes-no": "yes_no",
}

MAJOR_ARCANA: List[Dict[str, Any]] = [
    {
        "name": "The Fool",
        "keywords": ["new start", "trust", "unknown path"],
        "meaning": "A fresh step is opening, but it asks for awareness rather than blind risk.",
        "polarity": 1,
    },
    {
        "name": "The Magician",
        "keywords": ["skill", "action", "manifesting"],
        "meaning": "You have more tools than you may be using right now.",
        "polarity": 1,
    },
    {
        "name": "The High Priestess",
        "keywords": ["intuition", "silence", "inner knowing"],
        "meaning": "Something important is still beneath the surface. Slow observation helps.",
        "polarity": 0,
    },
    {
        "name": "The Empress",
        "keywords": ["care", "growth", "softness"],
        "meaning": "Growth is possible through patience, care, and emotional honesty.",
        "polarity": 1,
    },
    {
        "name": "The Emperor",
        "keywords": ["structure", "stability", "boundaries"],
        "meaning": "A firm boundary or practical plan will help more than overthinking.",
        "polarity": 1,
    },
    {
        "name": "The Hierophant",
        "keywords": ["tradition", "values", "guidance"],
        "meaning": "Advice, values, or a conventional path may matter in this situation.",
        "polarity": 0,
    },
    {
        "name": "The Lovers",
        "keywords": ["choice", "bond", "alignment"],
        "meaning": "The heart is involved, but the real theme is choosing with clarity.",
        "polarity": 1,
    },
    {
        "name": "The Chariot",
        "keywords": ["movement", "willpower", "control"],
        "meaning": "Progress is possible when emotions and action move in the same direction.",
        "polarity": 1,
    },
    {
        "name": "Strength",
        "keywords": ["patience", "courage", "soft control"],
        "meaning": "Gentle courage will work better than force.",
        "polarity": 1,
    },
    {
        "name": "The Hermit",
        "keywords": ["space", "reflection", "inner light"],
        "meaning": "Distance or quiet reflection is helping you understand the truth.",
        "polarity": 0,
    },
    {
        "name": "Wheel of Fortune",
        "keywords": ["change", "timing", "cycles"],
        "meaning": "The situation is moving through a cycle. Timing is important.",
        "polarity": 1,
    },
    {
        "name": "Justice",
        "keywords": ["truth", "balance", "fairness"],
        "meaning": "Clarity comes through honesty, accountability, and balanced choices.",
        "polarity": 0,
    },
    {
        "name": "The Hanged Man",
        "keywords": ["pause", "new view", "surrender"],
        "meaning": "This may not move by force. A different perspective is needed.",
        "polarity": 0,
    },
    {
        "name": "Death",
        "keywords": ["ending", "transition", "release"],
        "meaning": "An old pattern is closing so something healthier can begin.",
        "polarity": -1,
    },
    {
        "name": "Temperance",
        "keywords": ["healing", "balance", "patience"],
        "meaning": "The energy improves through moderation, patience, and emotional balance.",
        "polarity": 1,
    },
    {
        "name": "The Devil",
        "keywords": ["attachment", "fear", "pattern"],
        "meaning": "A strong attachment or repeated pattern needs honest attention.",
        "polarity": -1,
    },
    {
        "name": "The Tower",
        "keywords": ["shake-up", "truth", "release"],
        "meaning": "A sudden truth may clear something unstable, even if it feels intense.",
        "polarity": -1,
    },
    {
        "name": "The Star",
        "keywords": ["hope", "renewal", "faith"],
        "meaning": "There is healing energy here, but it needs trust and time.",
        "polarity": 1,
    },
    {
        "name": "The Moon",
        "keywords": ["confusion", "fear", "hidden things"],
        "meaning": "Not everything is clear yet. Avoid deciding from fear.",
        "polarity": -1,
    },
    {
        "name": "The Sun",
        "keywords": ["clarity", "warmth", "success"],
        "meaning": "The energy is open, honest, and supportive.",
        "polarity": 1,
    },
    {
        "name": "Judgement",
        "keywords": ["awakening", "review", "second chance"],
        "meaning": "A wake-up moment or honest review can change the direction.",
        "polarity": 1,
    },
    {
        "name": "The World",
        "keywords": ["completion", "closure", "integration"],
        "meaning": "A cycle is reaching completion, bringing maturity and perspective.",
        "polarity": 1,
    },
]

SUITS = {
    "Wands": {
        "theme": "action, desire, confidence, energy",
        "polarity": 1,
    },
    "Cups": {
        "theme": "feelings, relationships, healing, intuition",
        "polarity": 1,
    },
    "Swords": {
        "theme": "thoughts, truth, tension, communication",
        "polarity": -1,
    },
    "Pentacles": {
        "theme": "work, money, stability, practical growth",
        "polarity": 1,
    },
}

RANKS = {
    "Ace": ("a new opening", 1),
    "Two": ("a choice, exchange, or waiting point", 0),
    "Three": ("growth through effort or support", 1),
    "Four": ("stability, pause, or protection", 0),
    "Five": ("conflict, worry, or adjustment", -1),
    "Six": ("movement toward balance", 1),
    "Seven": ("assessment, guardedness, or persistence", 0),
    "Eight": ("movement, effort, or focused change", 1),
    "Nine": ("near-completion, pressure, or self-protection", 0),
    "Ten": ("completion, load, or outcome energy", 0),
    "Page": ("a message, learning phase, or early signal", 1),
    "Knight": ("active movement, pursuit, or restlessness", 1),
    "Queen": ("mature inner response and emotional intelligence", 1),
    "King": ("mature outer action, leadership, or control", 1),
}


def build_deck() -> List[Dict[str, Any]]:
    deck = list(MAJOR_ARCANA)
    for suit, suit_info in SUITS.items():
        for rank, (rank_meaning, rank_polarity) in RANKS.items():
            deck.append(
                {
                    "name": f"{rank} of {suit}",
                    "keywords": [rank_meaning, suit_info["theme"]],
                    "meaning": f"This points to {rank_meaning} in the area of {suit_info['theme']}.",
                    "polarity": rank_polarity if rank_polarity != 0 else suit_info["polarity"],
                }
            )
    return deck


def canonical_spread(raw: str) -> str:
    key = raw.strip().lower().replace(" ", "_")
    key = SPREAD_ALIASES.get(key, key)
    if key not in SPREADS:
        valid = ", ".join(sorted(SPREADS))
        raise SystemExit(f"Unknown spread '{raw}'. Valid spreads: {valid}")
    return key


def reversed_meaning(card: dict[str, Any]) -> str:
    return (
        f"The energy of {card['name']} may be blocked, delayed, or asking for a more careful approach."
    )


def draw_cards(
    *,
    spread: str,
    question: str,
    count_override: Optional[int],
    reversals: bool,
    seed: Optional[str],
) -> Dict[str, Any]:
    positions = list(SPREADS[spread])
    count = count_override if count_override is not None else len(positions)
    if count < 1 or count > 10:
        raise SystemExit("--cards must be between 1 and 10")
    if count > len(positions):
        positions.extend([f"card {idx}" for idx in range(len(positions) + 1, count + 1)])

    rng = random.Random(seed) if seed is not None else random.SystemRandom()
    deck = build_deck()
    selected = rng.sample(deck, count)
    cards = []
    score = 0
    for index, card in enumerate(selected):
        is_reversed = bool(reversals and rng.choice([True, False]))
        polarity = int(card["polarity"])
        score += -polarity if is_reversed else polarity
        cards.append(
            {
                "position": positions[index],
                "name": card["name"],
                "orientation": "reversed" if is_reversed else "upright",
                "keywords": card["keywords"],
                "meaning": reversed_meaning(card) if is_reversed else card["meaning"],
            }
        )

    summary = "Read the cards as reflective guidance, not a guaranteed prediction."
    if spread == "yes_no":
        if score >= 2:
            direction = "leaning yes"
        elif score <= -2:
            direction = "leaning no"
        else:
            direction = "mixed/unclear"
        summary = (
            f"Yes/no direction: {direction}. This is a symbolic lean, not a fixed outcome."
        )

    return {
        "spread": spread,
        "question": question.strip() or "General guidance",
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "reversals_used": reversals,
        "cards": cards,
        "summary": summary,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Draw Tarot cards for reflective guidance.")
    parser.add_argument("--spread", default="three_card", help="Spread name")
    parser.add_argument("--question", default="", help="User question")
    parser.add_argument("--cards", type=int, default=None, help="Override number of cards")
    parser.add_argument("--reversals", action="store_true", help="Allow reversed cards")
    parser.add_argument("--seed", default=None, help="Deterministic seed for testing")
    args = parser.parse_args()

    spread = canonical_spread(args.spread)
    result = draw_cards(
        spread=spread,
        question=args.question,
        count_override=args.cards,
        reversals=args.reversals,
        seed=args.seed,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
