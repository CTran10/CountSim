import type { GameRules, PenetrationConfig } from "../../game-core/src/types";

import type {
  CasinoGamePreset,
  CatalogSource,
  CurrentAvailability
} from "./types";

const ACCESSED_AT = "2026-08-23";
const SURVEY_OBSERVED_AT = "2024-08-01";
const LOCATION = "Black Hawk, Colorado";
const CURRENT_CAVEAT =
  "The official venue page confirms current gaming availability only. It does not verify this deck count, rules, limits, or penetration. Confirm the table placard and house rules before relying on this preset.";
const TRAINING_DEFAULT_NOTE =
  "Adjustable training default only. No defensible penetration observation was available, so this value is not a claim about a live table, dealer, shift, or cut-card placement.";
const UNVERIFIED_FIELDS_NOTE =
  "Fields not documented in the August 2024 survey, including surrender procedure, maximum split hands, split-ace drawing, dealer peek, and burn-card procedure, remain training-model assumptions pending table-specific verification.";

const COLORADO_RULE_8: CatalogSource = {
  title: "Colorado Gaming Regulations, Rule 8: Rules of Blackjack",
  url: "https://www.sos.state.co.us/CCR/GenerateRulePdf.do?ruleVersionId=52",
  type: "regulation",
  observedAt: "2025-04-14",
  accessedAt: ACCESSED_AT,
  confidence: "high",
  notes:
    "Current statewide regulation. Effective April 14, 2025, it permits a posted blackjack payout as low as 6:5 and requires signage for the dealer soft-17 rule, blackjack payout, action restrictions, and minimum and maximum bets. It does not establish the exact rules at any listed table."
};

const AUGUST_2024_SURVEY: CatalogSource = {
  title: "Blackjack Survey for Colorado Casinos",
  url: "https://uscasinoadvantage.com/blackjack/colorado/",
  type: "published",
  observedAt: SURVEY_OBSERVED_AT,
  accessedAt: ACCESSED_AT,
  confidence: "medium",
  notes:
    "Independent survey reporting games, rules, and minimums found in August 2024; the page was last updated November 4, 2024. Historical, not live inventory."
};

const OFFICIAL_SOURCES = {
  ballys: {
    title: "Bally's Black Hawk Casino Experience",
    url: "https://casinos.ballys.com/black-hawk/casino.htm",
    type: "official",
    accessedAt: ACCESSED_AT,
    confidence: "high",
    notes:
      "Official page currently lists blackjack and multiple betting limits, but does not distinguish North from West or publish deck counts, rules, or limits."
  },
  lodge: {
    title: "The Lodge Casino in Black Hawk",
    url: "https://thelodgecasino.com/",
    type: "official",
    accessedAt: ACCESSED_AT,
    confidence: "high",
    notes:
      "Official page currently lists table games generally, but does not specifically publish blackjack inventory, deck counts, rules, or limits."
  },
  ameristar: {
    title: "Table Games at Ameristar Black Hawk Casino",
    url: "https://www.ameristarblackhawk.com/casino/table-games",
    type: "official",
    accessedAt: ACCESSED_AT,
    confidence: "high",
    notes:
      "Official page currently lists blackjack, Double Deck Blackjack, $10 blackjack Monday through Thursday, and $15 blackjack Friday through Sunday. It does not tie those posted limits to a specific deck count or publish the modeled rules."
  },
  monarch: {
    title: "Blackjack at Monarch Casino Resort Spa Black Hawk",
    url: "https://monarchblackhawk.com/casino/table-games/blackjack",
    type: "official",
    accessedAt: ACCESSED_AT,
    confidence: "high",
    notes:
      "Official blackjack page confirms current game availability, but does not publish deck counts, core rules, limits, or penetration."
  }
} as const satisfies Record<string, CatalogSource>;

interface PresetSeed {
  readonly id: string;
  readonly casino: string;
  readonly venue: string;
  readonly name: string;
  readonly decks: 2 | 6;
  readonly doubleAfterSplit: boolean;
  readonly resplitAces: boolean;
  readonly minimumCents: number | null;
  readonly minimumNotes: string;
  readonly currentAvailability: CurrentAvailability;
  readonly officialSource: CatalogSource;
  readonly deviationSetId: string;
  readonly rulesNotes?: string;
  readonly currentPostedLimits?: {
    readonly minimumCents: number;
    readonly schedule: string;
    readonly caveat: string;
  };
}

function makeRules(seed: PresetSeed): GameRules {
  return {
    decks: seed.decks,
    blackjackPayout: "3:2",
    dealerSoft17: "H17",
    doubleRule: "any_two",
    doubleAfterSplit: seed.doubleAfterSplit,
    surrender: "none",
    maxSplitHands: 4,
    resplitAces: seed.resplitAces,
    hitSplitAces: false,
    doubleSplitAces: false,
    dealerPeek: true,
    burnCard: false
  };
}

function makePenetration(decks: 2 | 6): PenetrationConfig {
  return {
    mode: "fixed",
    penetration: decks === 2 ? 0.65 : 0.75,
    notes: TRAINING_DEFAULT_NOTE
  };
}

function makePreset(seed: PresetSeed): CasinoGamePreset {
  const availabilityCaveat =
    seed.currentAvailability === "table_games_officially_listed"
      ? "The official venue page confirms table games generally, not current blackjack availability or this configuration. The August 2024 blackjack record is historical. Confirm the table placard and house rules before relying on this preset."
      : CURRENT_CAVEAT;

  return {
    id: seed.id,
    casino: seed.casino,
    venue: seed.venue,
    location: LOCATION,
    name: seed.name,
    rules: makeRules(seed),
    penetration: makePenetration(seed.decks),
    penetrationBasis: {
      kind: "training_default",
      adjustable: true,
      confidence: "low",
      notes: TRAINING_DEFAULT_NOTE
    },
    deviationSetId: seed.deviationSetId,
    historicalLimits: {
      minimumCents: seed.minimumCents,
      maximumCents: null,
      observedAt: SURVEY_OBSERVED_AT,
      confidence: "medium",
      notes: `${seed.minimumNotes} No exact historical maximum was published by the cited survey.`
    },
    provenance: {
      rulesObservedAt: SURVEY_OBSERVED_AT,
      rulesConfidence: "medium",
      rulesNotes: `${seed.rulesNotes ?? "Rules follow the August 2024 published survey and the supplied training specification."} ${UNVERIFIED_FIELDS_NOTE}`,
      currentAvailability: seed.currentAvailability,
      currentAvailabilityAccessedAt: ACCESSED_AT,
      currentPostedLimits:
        seed.currentPostedLimits === undefined
          ? null
          : {
              minimumCents: seed.currentPostedLimits.minimumCents,
              maximumCents: null,
              schedule: seed.currentPostedLimits.schedule,
              accessedAt: ACCESSED_AT,
              confidence: "high",
              caveat: seed.currentPostedLimits.caveat
            },
      currentStatusCaveat: availabilityCaveat
    },
    sources: [seed.officialSource, AUGUST_2024_SURVEY, COLORADO_RULE_8],
    confidence: "low",
    notes: [
      "Historical conditions may have changed.",
      "This preset is training data, not live casino inventory.",
      UNVERIFIED_FIELDS_NOTE
    ]
  };
}

const SEEDS: readonly PresetSeed[] = [
  {
    id: "ballys-north-dd",
    casino: "Bally's",
    venue: "Bally's North",
    name: "Double Deck",
    decks: 2,
    doubleAfterSplit: true,
    resplitAces: false,
    minimumCents: 1500,
    minimumNotes: "The August 2024 survey reported a $15 minimum.",
    currentAvailability: "blackjack_officially_listed",
    officialSource: OFFICIAL_SOURCES.ballys,
    deviationSetId: "hilo-dd-h17-das",
    rulesNotes:
      "The August 2024 survey supports 3:2, H17, double on any two cards, and DAS. Resplit aces is disabled pending preset-specific verification."
  },
  {
    id: "ballys-north-6d",
    casino: "Bally's",
    venue: "Bally's North",
    name: "Six Deck",
    decks: 6,
    doubleAfterSplit: true,
    resplitAces: true,
    minimumCents: 1000,
    minimumNotes: "The August 2024 survey reported a $10 minimum.",
    currentAvailability: "blackjack_officially_listed",
    officialSource: OFFICIAL_SOURCES.ballys,
    deviationSetId: "hilo-6d-h17-das-rsa"
  },
  {
    id: "ballys-west-dd",
    casino: "Bally's",
    venue: "Bally's West",
    name: "Double Deck",
    decks: 2,
    doubleAfterSplit: true,
    resplitAces: false,
    minimumCents: 1500,
    minimumNotes: "The August 2024 survey reported a $15 minimum.",
    currentAvailability: "blackjack_officially_listed",
    officialSource: OFFICIAL_SOURCES.ballys,
    deviationSetId: "hilo-dd-h17-das",
    rulesNotes:
      "The August 2024 survey supports 3:2, H17, double on any two cards, and DAS. Resplit aces is disabled because the source does not verify it for this venue."
  },
  {
    id: "ballys-west-6d",
    casino: "Bally's",
    venue: "Bally's West",
    name: "Six Deck",
    decks: 6,
    doubleAfterSplit: true,
    resplitAces: true,
    minimumCents: 1000,
    minimumNotes: "The August 2024 survey reported a $10 minimum.",
    currentAvailability: "blackjack_officially_listed",
    officialSource: OFFICIAL_SOURCES.ballys,
    deviationSetId: "hilo-6d-h17-das-rsa"
  },
  {
    id: "lodge-dd",
    casino: "The Lodge",
    venue: "The Lodge Casino",
    name: "Double Deck",
    decks: 2,
    doubleAfterSplit: false,
    resplitAces: false,
    minimumCents: 2500,
    minimumNotes: "The August 2024 survey reported a $25 minimum.",
    currentAvailability: "table_games_officially_listed",
    officialSource: OFFICIAL_SOURCES.lodge,
    deviationSetId: "hilo-dd-h17-no-das",
    rulesNotes:
      "The August 2024 survey specifically reports no double after split for this double-deck game. Resplit aces is disabled because the source does not verify it."
  },
  {
    id: "lodge-6d",
    casino: "The Lodge",
    venue: "The Lodge Casino",
    name: "Six Deck",
    decks: 6,
    doubleAfterSplit: true,
    resplitAces: true,
    minimumCents: 1500,
    minimumNotes: "The August 2024 survey reported a $15 minimum.",
    currentAvailability: "table_games_officially_listed",
    officialSource: OFFICIAL_SOURCES.lodge,
    deviationSetId: "hilo-6d-h17-das-rsa"
  },
  {
    id: "ameristar-dd",
    casino: "Ameristar",
    venue: "Ameristar Casino Resort Spa Black Hawk",
    name: "Double Deck",
    decks: 2,
    doubleAfterSplit: true,
    resplitAces: true,
    minimumCents: 10000,
    minimumNotes:
      "The August 2024 survey reported a $100 minimum and resplit aces.",
    currentAvailability: "blackjack_officially_listed",
    officialSource: OFFICIAL_SOURCES.ameristar,
    deviationSetId: "hilo-dd-h17-das-rsa",
    currentPostedLimits: {
      minimumCents: 1000,
      schedule:
        "$10 blackjack Monday through Thursday; $15 Friday through Sunday",
      caveat:
        "Current venue-wide blackjack posting. It confirms Double Deck Blackjack is offered but does not say this schedule applies to the double-deck table, and it may change."
    }
  },
  {
    id: "ameristar-6d",
    casino: "Ameristar",
    venue: "Ameristar Casino Resort Spa Black Hawk",
    name: "Six Deck",
    decks: 6,
    doubleAfterSplit: true,
    resplitAces: true,
    minimumCents: 1500,
    minimumNotes:
      "The August 2024 survey reported a $15 minimum for six-deck blackjack; this preset models the surveyed 3:2 traditional game, not the separately listed 6:5 Free Bet variant.",
    currentAvailability: "blackjack_officially_listed",
    officialSource: OFFICIAL_SOURCES.ameristar,
    deviationSetId: "hilo-6d-h17-das-rsa",
    currentPostedLimits: {
      minimumCents: 1000,
      schedule:
        "$10 blackjack Monday through Thursday; $15 Friday through Sunday",
      caveat:
        "Current venue-wide blackjack posting. The official page does not identify a six-deck table or tie this schedule to a deck count, and it may change."
    }
  },
  {
    id: "monarch-dd",
    casino: "Monarch",
    venue: "Monarch Casino Resort Spa",
    name: "Double Deck",
    decks: 2,
    doubleAfterSplit: true,
    resplitAces: false,
    minimumCents: 2500,
    minimumNotes: "The August 2024 survey reported a $25 minimum.",
    currentAvailability: "blackjack_officially_listed",
    officialSource: OFFICIAL_SOURCES.monarch,
    deviationSetId: "hilo-dd-h17-das",
    rulesNotes:
      "The August 2024 survey supports 3:2, H17, double on any two cards, and DAS. Resplit aces is disabled because the source does not verify it for this game."
  },
  {
    id: "monarch-6d",
    casino: "Monarch",
    venue: "Monarch Casino Resort Spa",
    name: "Six Deck",
    decks: 6,
    doubleAfterSplit: true,
    resplitAces: false,
    minimumCents: 1500,
    minimumNotes: "The August 2024 survey reported a $15 minimum.",
    currentAvailability: "blackjack_officially_listed",
    officialSource: OFFICIAL_SOURCES.monarch,
    deviationSetId: "hilo-6d-h17-das",
    rulesNotes:
      "The August 2024 survey supports 3:2, H17, double on any two cards, and DAS. Resplit aces is disabled pending preset-specific verification."
  }
];

export const BLACK_HAWK_PRESETS: readonly CasinoGamePreset[] =
  SEEDS.map(makePreset);
