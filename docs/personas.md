# User Personas & Experience Layers

Nasty Plot serves a wide spectrum of competitive Pokemon players, from first-time teambuilders to tournament grinders to developers building on top of the platform. Like Lichess, the goal is a single product that feels simple to newcomers and powerful to experts -- not through gating, but through progressive disclosure.

This document defines four user personas, maps their journeys through the product, and describes the experience layers that let complexity reveal itself naturally.

---

## Personas

### Casey -- The Newcomer

> "I just want to build a team that doesn't get destroyed every game."

**Background:** Casey plays Pokemon casually -- they've finished Scarlet and Violet, bred a few Pokemon, maybe watched a YouTube video about competitive. They've heard of Smogon but find it intimidating. Terms like "OU," "252/252/4 spread," and "pivot" are foreign.

**Goals:**

- Build their first competitive team without feeling lost
- Understand _why_ certain Pokemon and moves are considered good
- Win some battles and feel like they're learning, not just losing

**Pain Points:**

- Information overload. A typical Smogon analysis page assumes knowledge Casey doesn't have.
- No sense of where to start. "Pick a Pokemon" is paralyzing when there are 400+ options.
- Doesn't understand EVs, IVs, or natures -- and doesn't want to until they need to.
- Jargon everywhere: "hazard control," "momentum," "breaking," "walling."

**How Casey uses Nasty Plot:**

- Starts with the **guided builder**, which walks them through team construction step by step: pick a format, choose a core, fill roles.
- Imports a **sample team** to learn from rather than building from scratch.
- Reads **simplified analysis**: "Your team is weak to Ground-type moves" rather than "You have 4/6 Pokemon with Ground weakness and no viable Ground-immune switch-in with offensive pressure."
- Plays against the **Greedy AI** -- strong enough to punish bad plays and teach, but not so strong it's demoralizing.
- Keeps **hints always on** during battles. The hint panel tells them "Earthquake is a good move here -- your Pokemon is faster and does a lot of damage" instead of leaving them guessing.
- Asks **Pecharunt** questions in plain language: "Why is this Pokemon good?" and gets answers without assumed knowledge.

**Casey's first session might look like:**

1. Open Nasty Plot, land on the home page
2. Click "Build a Team" and choose Guided mode
3. Pick OU because the tooltip says "The most popular competitive format"
4. Select a sample team ("Rain Offense") to start from
5. Look at the simplified analysis: "This team is strong against Fire and Ground types but struggles against Grass types"
6. Swap one Pokemon based on a recommendation
7. Start a battle against the Greedy AI with hints on
8. Follow the hint suggestions, win a close game
9. Feel good. Come back tomorrow.

---

### Jordan -- The Intermediate Player

> "I know what I'm doing, but I keep losing to the same things and I don't know how to fix it."

**Background:** Jordan has been playing on Showdown for a while. They can build a team, know the common threats, and understand type matchups intuitively. They've hit a plateau around 1300-1400 Elo and can't figure out what separates them from the next level.

**Goals:**

- Break through their skill ceiling
- Understand _why_ their team loses specific matchups, not just _that_ it does
- Learn to read opponents and predict switches
- Iterate on teams systematically instead of rebuilding from scratch every time

**Pain Points:**

- Can identify problems ("I always lose to Rain teams") but not solutions
- Rebuilds teams constantly instead of iterating on what works
- Doesn't use damage calc enough -- plays on vibes instead of numbers
- No structured way to review their games and spot patterns

**How Jordan uses Nasty Plot:**

- Uses the **freeform builder** exclusively. They know what they want; they just need the tools.
- **Imports and exports Showdown paste** constantly -- Nasty Plot and Showdown are used side by side.
- Runs **post-game review** after losses. The win probability graph shows them exactly where the game turned. "Oh, I was actually winning until turn 14 when I switched Garchomp into Zapdos."
- Trains against the **Heuristic AI**, which plays reasonably and punishes predictability.
- Uses the **damage calculator** to check specific interactions: "Does my Garchomp actually OHKO their Heatran after Stealth Rock?"
- Asks **Pecharunt** for matchup-specific advice: "How do I beat Rain teams with this squad?" and gets actionable answers referencing their actual team.
- Uses **recommendations** to find Pokemon that patch specific weaknesses rather than browsing randomly.

**Jordan's typical workflow:**

1. Paste their current team from Showdown into Nasty Plot
2. Run the analysis -- see the full coverage matrix and threat list
3. Notice a Ground weakness they hadn't considered
4. Check recommendations: "What Pokemon covers Ground and fits this team?"
5. Swap in the recommendation, adjust the set with damage calc
6. Export the updated paste back to Showdown
7. Play 5 games on ladder
8. Come back to Nasty Plot to review the losses
9. Iterate. Repeat.

---

### Alex -- The Competitive Player

> "I need to find the edge. What's the 2% optimization that wins the mirror?"

**Background:** Alex is a tournament player or high-ladder grinder (1700+ Elo). They have deep meta knowledge, understand set optimization, and can predict opponents' teams from Team Preview. They don't need to learn competitive Pokemon -- they need tools that keep up with their pace.

**Goals:**

- Find marginal advantages through precise optimization
- Test team variants efficiently without playing 50 manual games
- Prepare for specific tournament metas (what will the top 16 bring?)
- Maximize win rate across a large sample, not just individual games

**Pain Points:**

- Manual testing is painfully slow. Playing 50 games to validate a 4 EV change is absurd.
- No good way to compare team variants head-to-head with statistical significance
- Meta shifts between tournament rounds -- what worked in Swiss may not work in top cut
- EV optimization is guesswork without precise damage thresholds

**How Alex uses Nasty Plot:**

- Lives in the **freeform builder** but relies heavily on **team versioning**: fork a team, make a change, compare both versions.
- Runs **batch simulations** (100+ games) to validate changes with statistical confidence. "Version A wins 58% against the meta; Version B wins 61%. The difference is the Slowking EV spread."
- Defines **meta profiles** -- weighted distributions of what they expect to face. "In my tournament bracket, expect 30% Stall, 25% Rain, 20% Sun, 25% Balance."
- Trains against the **Expert AI** (MCTS-based) for realistic practice. The set predictor tracks what the AI believes about their Pokemon.
- Uses the **full damage calculator** obsessively. Field conditions, items, abilities, specific HP thresholds -- everything matters.
- Reviews replays with **move classification**: best, good, neutral, inaccuracy, mistake, blunder. "I made 3 inaccuracies in that game -- all on turn transitions."
- Asks **Pecharunt** for deep analysis: "Switching to 252 Def Bold Slowking with Regenerator gives you a Heatran counter that doesn't sacrifice your Water immunity -- your current Toxapex trades that for Toxic stall, which underperforms against Heavy-Duty Boots users in the current meta."

**Alex's tournament prep workflow:**

1. Build their base team in freeform mode
2. Fork the team into 3 variants (anti-stall, anti-rain, generalist)
3. Define a meta profile matching the expected tournament field
4. Batch simulate each variant: 200 games against the meta profile
5. Compare win rates, identify the best generalist option
6. Drill specific matchups against Expert AI
7. Review replays of losses, classify mistakes
8. Fine-tune EV spreads with damage calc (survive X, outspeed Y, OHKO Z)
9. Export to Showdown for final ladder testing
10. Repeat for top-cut meta adjustments between rounds

---

### Sam -- The Developer

> "I want to plug your battle engine into my own project."

**Background:** Sam is a programmer who builds Pokemon tools, contributes to open-source projects, or wants to automate competitive analysis. They might be building a custom AI, a team rating bot, or a meta analysis dashboard. They care about APIs, type safety, and clean interfaces.

**Goals:**

- Programmatic access to the battle engine, analysis tools, and Pokemon data
- Build custom tools on top of Nasty Plot's packages
- Automate team testing and meta analysis
- Potentially contribute to the project

**Pain Points:**

- Most Pokemon tools have no programmatic interface -- it's all web UIs
- Undocumented APIs and inconsistent data formats
- Can't script simulations or batch operations
- Building from `@pkmn/*` directly is possible but requires significant glue code

**How Sam uses Nasty Plot:**

- Uses the **MCP server** to integrate Nasty Plot's capabilities into Claude workflows (24 tools, 5 resources covering data queries, analysis, team CRUD, and meta recommendations).
- Imports **packages directly** as ESM modules with full TypeScript types: `@nasty-plot/core` for domain types, `@nasty-plot/battle-engine` for simulation, `@nasty-plot/damage-calc` for calculations.
- Uses the **battle engine API** to run automated battles: create a `BattleManager`, attach AI players, simulate hundreds of games.
- Calls **API routes** for operations that need the database (usage stats, Smogon sets, team CRUD).
- Appreciates the **service pattern** -- pure functions, no class hierarchies, barrel exports -- because it makes the code easy to import and compose.
- Reads `CLAUDE.md` and `docs/` to understand the architecture before diving in.

**Sam's integration workflow:**

1. Clone the repo, run `pnpm install`
2. Read `CLAUDE.md` for architecture overview
3. Import `@nasty-plot/battle-engine` into their project
4. Set up automated battles between custom AI strategies
5. Use `@nasty-plot/damage-calc` for damage calculations in their pipeline
6. Hit the API routes for data that requires the database
7. Optionally connect via MCP for Claude-assisted workflows

---

## Experience Layers

Nasty Plot organizes its features into four experience layers. These are not access tiers or skill gates -- they're design guidelines for how features should present themselves based on the user's demonstrated comfort level.

### Layer 0: Guided

**Target persona:** Casey (The Newcomer)
**Design principle:** Reduce choices, explain everything, build confidence.

This layer is about removing friction. Casey shouldn't need to understand the meta to build a viable team, and they shouldn't need to know damage formulas to win a battle.

- **Guided team builder** walks through team construction step by step: choose a format, pick a starting core, fill coverage roles. Each step explains the _why_.
- **Sample teams** provide pre-built, tested teams to start from. Casey can modify them rather than building from zero.
- **Simplified analysis dashboard** shows 3-4 key metrics: type weaknesses, offensive coverage gaps, and an overall "team health" indicator. No coverage matrices or threat indices.
- **Contextual tooltips** explain jargon on hover: "OU (OverUsed) is the most popular competitive format. It includes the strongest non-banned Pokemon."
- **Hint system always visible** during battles. Every turn shows a recommended move with a plain-language explanation.
- **AI difficulty defaults to Greedy** -- challenging enough to teach, forgiving enough to not frustrate.
- **Pecharunt speaks simply.** No assumed knowledge. "This Pokemon has high Attack and Speed, which means it can hit hard before the opponent moves" instead of "Base 130 Atk with base 108 Spe lets it function as a wallbreaker in the current metagame."

### Layer 1: Standard

**Target persona:** Jordan (The Intermediate Player)
**Design principle:** Full tools, no hand-holding, clear feedback loops.

Jordan knows what they want to do -- they need the tools to do it efficiently. This layer exposes everything without overwhelming, and focuses on helping Jordan understand cause and effect in their team's performance.

- **Full freeform builder** with all fields exposed: EVs, IVs, nature, ability, item, tera type, moves. No step-by-step -- just a form.
- **Showdown paste import/export** is front and center. Jordan lives between Nasty Plot and Showdown; the paste format bridges them seamlessly.
- **Complete analysis** with the full coverage matrix, threat list, and speed tier comparisons. No simplification -- Jordan can handle the data.
- **Post-game review** with the win probability graph showing how the game shifted turn by turn. Jordan can see exactly where they won or lost the game.
- **Hint system is toggleable.** Jordan might want hints while learning a new team but turns them off once they're comfortable.
- **All AI difficulty tiers available.** Jordan picks their training partner based on what they're practicing.
- **Damage calculator** available for checking specific interactions. Streamlined interface -- enter two Pokemon, see the numbers.
- **Recommendations engine** suggests Pokemon and sets based on team weaknesses, usage data, and synergy scores.
- **Pecharunt speaks naturally.** Can explain deeper concepts when asked but doesn't lecture. Answers reference Jordan's actual team and specific matchups.

### Layer 2: Advanced

**Target persona:** Alex (The Competitive Player)
**Design principle:** Precision tools for optimization. Statistical rigor. No unnecessary clicks.

Alex doesn't need explanations -- they need data, fast iteration, and statistical confidence. This layer is about treating teambuilding as engineering.

- **Team versioning** lets Alex fork a team, make changes, and compare variants side by side. Merge the winner back, discard the rest.
- **Batch simulation** runs N games (50, 100, 500) against a defined meta and reports win rates, common loss patterns, and turn-by-turn statistics.
- **Meta profile definition** lets Alex specify the expected opponent distribution for a tournament or ladder segment. Batch sims run against these profiles.
- **Full damage calculator** with field conditions (weather, terrain, screens, hazards), item interactions, ability triggers, and specific HP thresholds. Supports "what EV spread lets me survive X and OHKO Y?"
- **Replay analysis with move classification.** Every move in a replay is tagged: best, good, neutral, inaccuracy, mistake, blunder. Alex can filter replays by mistake density.
- **EV optimization suggestions** based on damage thresholds: "Investing 44 EVs in Defense lets you survive Garchomp's Earthquake from full, freeing 208 EVs for Speed."
- **Set predictor visualization** shows what the opponent's AI believes about Alex's team, and what Alex's side predicts about the opponent.
- **Pecharunt in expert mode.** Terse, precise, data-driven. References specific damage rolls, speed tiers, and meta percentages. No fluff.

### Layer 3: Developer

**Target persona:** Sam (The Developer)
**Design principle:** Clean APIs, full type safety, composable packages.

This layer isn't about the web UI at all -- it's about Nasty Plot as a platform.

- **MCP server** provides 24 tools and 5 resources for Claude integration. Data queries, team CRUD, analysis, and meta recommendations are all available as MCP tool calls.
- **Direct package imports** via ESM. Every package has barrel exports from `src/index.ts` and full TypeScript types. `@nasty-plot/core` exports domain types like `TeamSlotData` and `PokemonSpecies`. `@nasty-plot/battle-engine` exports `BattleManager` and AI players.
- **Battle engine API** for automated battles. Create managers, attach AI strategies, run simulations, and collect results programmatically.
- **Batch simulator API** for running large-scale tests without the web UI.
- **Full type exports** from `@nasty-plot/core` -- `TeamSlotData`, `PokemonSpecies`, `StatsTable`, `StatName`, and more.
- **REST API routes** for operations that need the database: usage stats, Smogon sets, team CRUD, recommendations.
- **Service pattern** (pure functions, no class hierarchies) makes packages easy to import and compose in external projects.

---

## Progressive Disclosure Design Principles

The four layers are guidelines, not gates. The entire system is governed by five principles:

### 1. Not Gated

Users self-select their depth. There is no "unlock Level 2" gatekeeping, no experience points, no forced tutorials. Casey can open the freeform builder on day one. Alex can use the guided builder if they want a quick team. The layers describe _defaults and emphasis_, not access control.

### 2. Discoverable

Advanced features are visible but not overwhelming. The team editor shows a collapsed "Advanced Analysis" section -- Casey can see it exists without being confronted by a coverage matrix. The batch simulation button is on the battle page, not buried in settings. Features advertise their existence without demanding attention.

### 3. Contextual

Features appear when they're relevant. The "Fork Team" button appears after you've saved a team, not on the empty state. Post-game review is offered after a battle ends, not in a menu. Recommendations appear when your team has a gap, not as a permanent sidebar. The UI responds to what the user is doing, not what it thinks they should be doing.

### 4. Pecharunt Adapts

The AI assistant's language complexity scales with demonstrated user behavior. If Casey asks "what Pokemon should I use?", Pecharunt suggests a sample team with a simple explanation. If Alex asks the same question, Pecharunt references usage stats, meta trends, and specific set optimizations. The signal is the user's vocabulary and question depth, not an explicit setting.

Pecharunt calibration signals:

- **Vocabulary used:** "strong Pokemon" (L0) vs. "wallbreaker for the current OU meta" (L2)
- **Question specificity:** "Is this team good?" (L0) vs. "Does this EV spread let Slowking survive Heatran's Magma Storm?" (L2)
- **Feature usage:** guided builder users get simpler language; batch sim users get expert language
- **Explicit requests:** "Explain like I'm new" or "Skip the basics" override auto-detection

### 5. Escape Hatches

Every simplification has a path to the full version. The simplified analysis has a "Show full analysis" link. The guided builder has a "Switch to freeform" button. Hint explanations link to the damage calc that produced them. Users should never feel trapped in a simplified view -- the depth is always one click away.

---

## Feature Availability Matrix

This table maps features to personas and their experience layers. "Primary" means the feature is central to that persona's workflow. "Available" means visible and usable but not emphasized. "API" means accessible programmatically rather than through the web UI.

| Feature                    | Casey (L0)     | Jordan (L1)   | Alex (L2)               | Sam (L3)     | Implemented? |
| -------------------------- | -------------- | ------------- | ----------------------- | ------------ | ------------ |
| Guided builder             | Primary        | Available     | Available               | --           | Yes          |
| Freeform builder           | Available      | Primary       | Primary                 | --           | Yes          |
| Paste import/export        | --             | Primary       | Primary                 | API          | Yes          |
| Sample teams browser       | Primary        | Available     | Available               | API          | Yes          |
| Type coverage analysis     | Simplified     | Full          | Full                    | API          | Yes          |
| Threat identification      | Simplified     | Full          | Full                    | API          | Yes          |
| Synergy scoring            | --             | Available     | Full                    | API          | Yes          |
| Damage calculator          | --             | Standard      | Full (field conditions) | API          | Yes          |
| Matchup matrix             | --             | Available     | Primary                 | API          | Yes          |
| Recommendations            | Auto-suggested | On demand     | On demand               | API          | Yes          |
| Battle vs AI (4 tiers)     | Greedy default | All tiers     | All tiers               | Programmatic | Yes          |
| Move hints/classification  | Always on      | Toggleable    | Toggleable              | --           | Yes          |
| Win probability            | --             | Post-game     | Live + post-game        | API          | Yes          |
| Set predictor (Bayesian)   | --             | --            | Available               | API          | Yes          |
| Battle replay viewer       | --             | Available     | Primary                 | API          | Yes          |
| Batch simulation           | --             | --            | Primary                 | API          | Yes          |
| Battle commentary (LLM)    | Available      | Available     | Available               | --           | Yes          |
| Post-game review           | --             | Basic (graph) | Full (classification)   | --           | Partial      |
| Team versioning            | --             | --            | Primary                 | API          | Not yet      |
| Meta profiles              | --             | --            | Primary                 | API          | Not yet      |
| Replay move classification | --             | Basic         | Full                    | API          | Not yet      |
| EV optimization            | --             | --            | Available               | API          | Not yet      |
| MCP server (24 tools)      | --             | --            | --                      | Primary      | Yes          |
| Package APIs (14 packages) | --             | --            | --                      | Primary      | Yes          |
| REST API                   | --             | --            | --                      | Primary      | Yes          |

"--" means the feature is not the primary audience for that persona, but access is never blocked.

---

## Persona Journey Maps

### Casey: First Week

```
Day 1: Home page -> "Build a Team" -> Guided mode -> Pick OU -> Import sample team
Day 2: Review simplified analysis -> Swap one Pokemon based on suggestion -> Export
Day 3: First battle vs Greedy AI -> Hints on -> Win with hint guidance
Day 4: Ask Pecharunt "Why is Garchomp good?" -> Read simple explanation
Day 5: Try modifying sample team more -> Start recognizing type matchups
Day 7: Build second team from scratch in guided mode -> Feeling confident
```

### Jordan: Typical Week

```
Monday:    Paste import current ladder team -> Run analysis -> Note weaknesses
Tuesday:   Check recommendations -> Swap one slot -> Export, test on ladder
Wednesday: Lose to Rain twice -> Ask Pecharunt "How do I beat Rain with this team?"
Thursday:  Implement Pecharunt's suggestion -> Damage calc the key interactions
Friday:    Play 10 games -> Post-game review the losses -> Spot a pattern
Weekend:   Iterate on the team -> Paste export final version -> Ladder session
```

### Alex: Tournament Prep

```
Week -2:  Build base team -> Fork 3 variants -> Define meta profile for the event
Week -1:  Batch sim all variants (200 games each) -> Pick best generalist
          Deep damage calc for EV optimization -> Fine-tune spreads
          Practice vs Expert AI -> Review replays, classify mistakes
Day of:   Export final team to Showdown
Between rounds: Adjust meta profile for top cut -> Quick batch sim -> EV tweaks
```

### Sam: Integration Project

```
Day 1: Clone repo, read CLAUDE.md, explore package structure
Day 2: Import @nasty-plot/battle-engine, run first automated battle
Day 3: Set up batch simulation pipeline, collect win rate data
Day 4: Connect MCP server to Claude workflow for analysis automation
Day 5: Build custom visualization on top of battle engine output
```

---

## Design Implications

### UI Architecture

The experience layers imply a UI that adapts without mode-switching:

- **Default state** is Layer 1 (Standard). This is the most common entry point -- someone who knows enough to use the tools but isn't an expert.
- **Guided mode** is an explicit opt-in that shifts the UI to Layer 0. It can be exited at any time.
- **Advanced features** (versioning, batch sim, meta profiles) are visible as collapsed sections or secondary actions. They don't clutter the primary workflow but are always discoverable.
- **Developer features** (MCP, API) live in documentation and the server -- they don't affect the web UI at all.

### Pecharunt's Voice

Pecharunt is the connective tissue across all layers. Its ability to adapt tone and depth is critical:

| Layer | Example Response to "Is my team good?"                                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L0    | "Your team looks solid! You have good type coverage and a mix of attackers and defenders. One thing to watch: you don't have a great answer to Ground-type moves. Consider adding a Flying-type or a Pokemon with Levitate."                                                                                                                                                                                                       |
| L1    | "Your team has decent offensive coverage but you're missing a Ground immunity. You're running 3 Pokemon weak to Earthquake with no safe switch-in. Consider Zapdos or Rotom-Wash -- both check Ground-types while adding to your team's offensive profile."                                                                                                                                                                        |
| L2    | "Your current build has a structural Ground weakness -- Garchomp, Heatran, and Kingambit are all hit super effectively with no Levitate or Flying-type to pivot into. In the current OU meta, Landorus-T appears on 34% of teams, making this exploitable. Zapdos-Therian with Intimidate patches this while threatening Garchomp variants. Running 252 HP / 168 Def lets it survive +1 Stone Edge from Garchomp 94% of the time." |

### Content Strategy

Each persona needs different content:

- **Casey** needs tooltips, inline explanations, and "What is this?" links
- **Jordan** needs matchup guides, set comparisons, and "How to beat X" articles
- **Alex** needs damage thresholds, speed tier charts, and meta snapshots
- **Sam** needs API documentation, type references, and architecture guides

---

## Success Metrics by Persona

How we know each persona is being served well:

| Persona | Success Signal                                                                                  |
| ------- | ----------------------------------------------------------------------------------------------- |
| Casey   | Completes guided builder flow. Plays 3+ battles in first week. Returns after day 1.             |
| Jordan  | Imports a paste. Uses post-game review. Iterates on the same team (not just creating new ones). |
| Alex    | Runs batch simulations. Uses team versioning. Session length > 30 minutes.                      |
| Sam     | Successfully imports a package. Makes API calls. Opens a PR or files an issue.                  |

| Persona | Failure Signal                                                                                 |
| ------- | ---------------------------------------------------------------------------------------------- |
| Casey   | Abandons guided builder midway. Never plays a battle. Doesn't return.                          |
| Jordan  | Only imports but never uses analysis. Doesn't review games. Creates many teams, finishes none. |
| Alex    | Doesn't trust batch sim results. Falls back to manual testing on Showdown.                     |
| Sam     | Can't figure out package structure. Gives up on API integration.                               |
