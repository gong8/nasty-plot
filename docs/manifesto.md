# The Nasty Plot Manifesto

---

## The Problem Nobody Talks About

Competitive Pokemon has a dirty secret: it might be impossible to explain.

Not impossible to play -- millions of people play on Pokemon Showdown every day. Not impossible to win -- top players consistently outperform the field, tournament after tournament, which means skill is real and learnable. But impossible to _explain_ in the way that chess or Go or poker have been explained, systematized, and taught through structured tools.

Consider the numbers. There are over 900 Pokemon. Each can learn dozens of moves from a pool of 300+. Each carries one of hundreds of abilities, holds one of hundreds of items, picks one of 25 natures, distributes 510 effort values across six stats in increments of 4, and optionally Terastallizes into any of 18 types. A team is six of these. The combinatorial space isn't just large -- it's estimated at roughly 6 times 10 to the 218th power possible teams. That number is so vast it makes the number of atoms in the observable universe look like pocket change.

Chess has approximately 10 to the 120th possible games. Chess also has Lichess. It has Stockfish, a superhuman engine that evaluates 70 million positions per second and explains, move by move, whether you played well or poorly. It has opening databases going back centuries. It has endgame tablebases that have _solved_ every position with seven or fewer pieces on the board. It has structured learning paths that take you from "the horsey moves in an L" to grandmaster preparation in a continuous, well-lit staircase.

Pokemon has Showdown.

Showdown is a masterpiece of engineering -- a faithful battle simulator that lets you play the game without owning the cartridge. It is the _battlefield_. But it is not the _war room_. It doesn't teach you why you lost. It doesn't help you build a team. It doesn't simulate a thousand games overnight while you sleep and tell you that your team has a 37% win rate against rain and you should probably do something about that. It gives you the sword and the arena and says "good luck."

The knowledge that separates a beginner from a top player is scattered across a dozen sources. Smogon forums, where analysis posts from 2014 might still be the best thing written about a particular archetype. YouTube videos that are brilliant but unsearchable -- you can't ctrl-F a YouTube video to find the moment where someone explains why Landorus-Therian is the glue that holds balance teams together. Discord servers where the advice is real-time but ephemeral, scrolling past before you can absorb it. Word of mouth in tournament lobbies, the kind of knowledge that lives in people's heads and dies when they stop playing.

And even the tools that do exist -- damage calculators, usage statistics, set recommendations -- show you _what_ without explaining _how to think_. A damage calculator tells you that Earthquake from Great Tusk does 78-92% to Heatran. It does not tell you whether that matters right now, in this position, on this turn, given what your opponent might do. Usage statistics tell you that 47% of Gholdengo run Nasty Plot. They don't tell you what that means for your team-building decisions, or how to play around it when you see Gholdengo on the opponent's team preview.

The gap is not in information. The gap is in _understanding_.

---

## The Five Pillars

Aaron Traylor's thesis cuts to the heart of it: competitive Pokemon rests on five pillars, and each one is genuinely difficult to teach in isolation because they all depend on each other. The game isn't hard because any single aspect is incomprehensible. It's hard because everything interacts with everything else, and the interaction creates emergent complexity that resists simple explanation.

These are the five pillars, and they are the foundation that Nasty Plot is built on.

### Long-Term Planning

Every battle is won or lost before the first move is made. Not in the team-building sense -- though that's true too -- but in the strategic sense. The best players are not choosing the best move on this turn. They are choosing the move that sets up a position three, five, ten turns from now where their win condition becomes inevitable.

Whimsicott uses Tailwind on turn 1. It does zero damage. On the surface, it looks like a wasted turn while the opponent is free to attack. But Whimsicott just doubled the speed of every Pokemon on its team for four turns. That means Dragonite, sitting on the bench with a Dragon Dance already planned, doesn't need to outspeed naturally -- it just needs to survive one turn of setup, and then it sweeps through the opponent's weakened team at double speed with boosted attack. Whimsicott sacrificed itself so that Dragonite could become unstoppable. That's not a move. That's a chapter in a story that was outlined before the battle started.

Stealth Rock on turn 2 doesn't look dramatic either. The opponent's Volcarona is at full health in the back, waiting for its moment. But now, every time Volcarona switches in, it loses 50% of its HP to rocks. It can never safely enter the battle. An entire win condition has been neutralized by a single move that happened fifteen turns ago. The opponent's plan was to sweep with Volcarona. That plan is dead, and they might not even realize it yet.

Long-term planning is the pillar that separates someone who plays Pokemon from someone who _competes_ at Pokemon. Beginners pick the move that does the most damage right now. Veterans pick the move that makes the last five turns of the game impossible to lose.

### Simultaneous Action Selection

Chess is sequential. You move, then I move. You can see exactly what I did before you respond. Pokemon is not chess.

Both players choose their action simultaneously, every single turn. You don't know if the opponent will attack, switch, set up, or use a status move. They don't know what you'll do either. This creates a game theory matrix on every turn -- not in the abstract mathematical sense, but in the very real sense that your best move depends on their move, and their best move depends on yours.

Annihilape is facing Gengar. You have Rage Fist, a physical Ghost move that gets stronger every time you're hit. You also have Shadow Ball, a special Ghost move with consistent power. If the opponent keeps Gengar in, Rage Fist does more damage. But if they predict your physical attack and switch to a physically defensive Pokemon, you've wasted the turn. If you go Shadow Ball and they stay in, you do less damage than Rage Fist would have, but if they switch to a Fairy-type thinking you'll go Ghost, Shadow Ball still hits whatever comes in neutrally.

This is happening on every single turn. Both players constructing probability distributions over the other's likely actions, choosing the play that maximizes expected value across all possible opponent responses. It's a Nash equilibrium problem, and it occurs thirty or more times in a single battle. Competitive players solve these matrices intuitively -- which is exactly why the skill is so hard to transfer. "I just felt like they were going to switch" is not a teachable insight.

### Imperfect Information

You see their six Pokemon in Team Preview. You know species. You know nothing else.

Is that Gardevoir a Calm Mind sweeper with Psychic, Moonblast, Focus Blast, and Calm Mind? Or is it a Choice Specs wallbreaker with Trick, Psychic, Moonblast, and Thunderbolt? The first one wants to stay in and set up. The second one wants to fire off a massive hit and switch. The correct way to play against each is completely different. And you won't know which one it is until they reveal information -- and even then, the information might be deliberately misleading.

Is the Landorus physical or special? If it's physical, your Skarmory walls it completely. If it's special, Skarmory is dead weight. Is Kingambit running Swords Dance or Substitute? If it's Swords Dance, you need to pressure it immediately. If it's Substitute, you need to break the sub before it gets a free hit.

Every move the opponent reveals narrows the possibility space. If you see Heatran use Magma Storm, that's one moveslot accounted for -- it probably also has Earth Power, and then two flexible slots. But if you see Heatran use Taunt on turn 1, the set is immediately different: it's probably a specially defensive set with Stealth Rock, not an offensive set. One revealed move shifts the entire probability distribution of the remaining three.

And then there's the bluff dimension. Bringing a set that nobody expects, specifically to exploit the fact that opponents will assume the standard set. Running Choice Scarf Gardevoir when everyone expects Choice Specs, because the surprise KO on their faster Pokemon is worth the lower damage output. Information warfare is a real axis of competitive Pokemon, and it's almost never discussed explicitly.

### Probability Management

Damage in Pokemon is not deterministic. Every attack deals between 85% and 100% of its calculated damage, uniformly distributed across 16 rolls. Stone Edge has 80% accuracy. Focus Blast has 70%. Critical hits occur 4.17% of the time and ignore defensive boosts. Scald has a 30% chance to burn. Body Slam has a 30% chance to paralyze. King's Rock flinch chance stacks with Serene Grace.

A single turn can produce hundreds of distinct outcomes. Your Garchomp uses Earthquake on their Heatran. The damage rolls between 78% and 92%. If they're at 85% health, some rolls KO and some don't. If you don't KO, they use Earth Power back, which rolls between 65% and 77%. If _they_ don't KO, you finish with another Earthquake, which again rolls. But there's a 4.17% chance either attack crits, which changes everything. And a 10% chance Earth Power drops your Special Defense, which matters if they switch to a special attacker next.

The "skyscraper of outcomes" -- a single turn can branch into hundreds of possible game states depending on damage rolls, accuracy checks, critical hit rolls, and secondary effect procs. Good players don't just consider the best case. They reason about _expected value_. Is Stone Edge the right play? It does more damage than Rock Slide, but Rock Slide never misses. If you need the KO to win the game, the 20% miss chance on Stone Edge means you lose the game 1 in 5 times you choose it. Rock Slide does less damage but you hit every time. The right play depends on whether you can afford the risk -- and that calculation depends on the entire game state, not just this turn.

The best players manage probability the way poker players manage pot odds. They don't gamble. They put themselves in positions where the math is on their side so consistently that variance washes out over enough games. They don't need to get lucky. They need to play enough games that luck doesn't matter.

### Team Building: The Meta-Pillar

And then there's team building. The pillar that contains all other pillars. The one that sits upstream of every decision in every game you'll ever play.

Team building is where the 6 times 10 to the 218th combinatorial space lives. It's also the pillar that depends on all four others simultaneously. You build for long-term gameplans: does this team have a coherent win condition that unfolds over 30 turns? You build for simultaneous action flexibility: does every Pokemon on this team have options on every turn, or do some of them become dead weight in certain matchups? You build for information advantages: does this team reveal its game plan too early, or can it keep the opponent guessing? You build for probability management: does this team rely on high-variance moves, or does it have consistent, reliable damage output?

And you build for the meta. Not some abstract concept -- the concrete reality of what you expect to face. If 30% of the ladder is running rain teams, your team needs an answer to rain. If Gholdengo is on 45% of teams, you need something that can take a hit from it and threaten it back. If Iron Valiant is rising in usage, you need to know whether your team handles both the physical and special sets.

Team building is iterative. Build a team. Play ten games. Notice you lose to Volcarona every time. Add a Stealth Rock setter. Play ten more games. Notice your team is now too passive and loses to setup sweepers. Replace the wall with a more offensive check. Play ten more. The cycle never ends, and each iteration requires re-evaluating all four other pillars.

This is the pillar that Nasty Plot was built to crack.

---

## What We Believe

### Progressive Learning

Don't dump everything at once.

A newcomer to competitive Pokemon doesn't need to hear about Nash equilibria and damage roll distributions. They need to hear "Garchomp is a good Pokemon because it's fast, it hits hard, and it has Earthquake which hits a lot of things super effectively." That's the first layer. The next layer is "Garchomp works well with Rotom-Wash because Rotom covers Garchomp's Ice weakness." Then "this team needs Stealth Rock support because three of your opponent's common Pokemon are weak to it." Then "Garchomp outspeeds most of the unboosted metagame but loses to Choice Scarf users, so you need a speed control backup."

Layer complexity like Lichess does. Casual mode doesn't show you the engine evaluation. You just play. Intermediate mode shows you accuracy percentages after the game -- here's where you blundered. Advanced mode gives you real-time engine evaluation, opening book deviations, endgame tablebase lookups. The depth is always there. The surface adapts to the user.

Nobody should be gated from the full power of the tool. But nobody should be overwhelmed on day one either. The onramp should be gentle, and the road should go as deep as the user wants to travel.

### Respect for Complexity

It is tempting to oversimplify. To say "just use OU sample teams" or "just pick the highest usage Pokemon" or "just click the recommended moves." And sometimes that's fine -- sometimes you just want to play, not study. But Nasty Plot is built on the belief that competitive Pokemon is _genuinely complex_, and that complexity is what makes it beautiful.

The goal is not to make competitive Pokemon easy. Easy means shallow, and shallow means boring. The goal is to make it _tractable_. To give you tools that let you engage with the real complexity without drowning in it. To surface the patterns and structures that experienced players see intuitively but can't always articulate.

A damage calculator that just shows numbers is a lookup table. A damage calculator that shows you "this is a 2HKO, which means Heatran has to switch, which means your opponent is forced to bring in their Water-type, which you can predict and hit with Thunderbolt on the switch" -- that's a tool for understanding.

We will never hide the complexity. We will never round off the sharp edges. We will build tools that help you _see_ the complexity for what it is: a beautiful, deep game that rewards careful thought.

### Simulation Over Intuition

"I think this team is good."

How good? Good against what? Good in what conditions? Good when you play it, or good when a perfect player plays it? "Good" is not a useful concept when you're trying to improve. Numbers are.

Nasty Plot is built on the belief that simulation at scale reveals truths that intuition misses. Play three games with a new team and you have anecdotes. Run a thousand simulated games against the metagame and you have data. "This team wins 62% of games against the OU metagame with a 95% confidence interval of 59% to 65%." That's a claim you can reason about. That's a starting point for improvement.

"But AI-vs-AI games aren't realistic." True. But they reveal structural problems -- type coverage gaps, speed tier issues, matchups where your team has no win condition -- with statistical power that three games on the ladder never could. The simulation doesn't replace playing. It supplements it. It tells you where to look, what to worry about, and what's probably fine.

The goal is to move team building from an art to a science. Not to eliminate the art -- the creative spark that produces a team nobody has seen before will always be human. But to give the artist a lab where they can test their creations rigorously before taking them to the tournament.

### AI Teaches Why, Not Just What

The LLM-powered assistant -- Pecharunt -- is not a search engine. It doesn't just look up "what moves does Garchomp learn?" That's a database query, and we have a database for that. Pecharunt's job is to answer the question behind the question. Not "what" but "why." Not "which move" but "what should I be thinking about when I choose a move."

"Should I use Earthquake or Stone Edge here?"

A search engine tells you the damage ranges. Pecharunt tells you: "Earthquake is the better play here. Great Tusk outspeeds Heatran by 20 points, and Earthquake is a guaranteed 2HKO from full health. Stone Edge would technically do more damage, but it has a 20% miss chance, and missing here likely loses the game because Heatran sets up Stealth Rock for free. Additionally, if they switch to Landorus predicting Earthquake, you still do 45% to it, which puts it in range of Ice Spinner later. The expected value of Earthquake is higher across all likely opponent actions."

That's not just data. That's reasoning. That's the kind of explanation a skilled mentor would give you -- considering the full game state, the opponent's likely responses, the downstream consequences, and the probability math. That's what makes the difference between using a tool and learning from a tool.

Pecharunt grows with the user. Simple questions get simple answers. Ask a complex question -- "how should I restructure my team to handle rain better without losing my Volcarona matchup?" -- and Pecharunt gives a complex answer, referencing your specific team, the specific threats, and the specific tradeoffs you'd be making. Context-aware, not generic. Your team, your format, your problem.

### The Tool Adapts to the User

Newcomers get guided team builders. "You picked Garchomp -- great choice! You need a Pokemon that covers its Ice weakness. Here are three options that also help with your team's lack of a Stealth Rock setter." Step by step, decision by decision, with explanations at each stage.

Veterans get batch simulation controls, raw evaluator output, matchup matrices, team versioning, and the ability to override every recommendation. They don't need the training wheels. They need the power tools.

But here's the important part: nobody is gated. The guided mode isn't a walled garden that hides the complexity. It's a path that reveals it gradually. A newcomer using guided mode can switch to freeform mode at any time. A veteran can turn on hints mid-battle to see what the engine thinks. The depth is always one click away.

This is not a tool for beginners that experts tolerate. It's not a tool for experts that beginners bounce off. It's a tool that meets you where you are and goes as deep as you want to go.

### Build in Public, Iterate in the Open

Nasty Plot is two things at once: a useful tool for competitive Pokemon, and a learning artifact for software engineering.

Every design decision is documented. The architecture is explained. The session notes capture not just what was built but _why_ it was built that way, what alternatives were considered, and what tradeoffs were made. The codebase is a case study in building a complex, data-driven application with modern tools: TypeScript, monorepo architecture, battle simulation, AI opponents, LLM integration, and more.

This dual purpose is intentional. The best way to learn to build software is to build software that matters to you. The best way to build software that matters is to build it for a community you belong to. Nasty Plot is built by a competitive Pokemon player, for competitive Pokemon players, using software engineering as the medium.

The code is the documentation. The git history is the story. The plans and session notes are the director's commentary. Everything is in the open, because everything should be.

---

## The Vision

### Showdown is the Battlefield. Nasty Plot is the War Room.

Pokemon Showdown gives you the arena. Nasty Plot gives you the preparation. The scouting reports. The simulation results. The strategic analysis. The AI sparring partner. The mentor who explains what you did wrong and how to fix it.

The war room is where you do the real work. Where you study the meta, build your team, test it against a hundred different archetypes, identify weaknesses, iterate, fork a new variant, test again, compare, and converge on something that's genuinely ready for battle. The war room is where "I think this team is good" becomes "I know this team wins 62% against the current meta, struggles against rain, and has a dead slot against stall."

Then you take it to Showdown. And you play with confidence, because you've already done the work.

### The Core Loop

Build. Test. Analyze. Tweak. Fork. Repeat.

This is the fundamental cycle of competitive team building, and every feature in Nasty Plot exists to support some part of it.

**Build** -- The team builder, guided or freeform. Pick your Pokemon, choose your sets, distribute your EVs. Import a Showdown paste. Start from a sample team. Let Pecharunt suggest the next slot based on what you already have.

**Test** -- The battle simulator. Play against AI opponents of increasing difficulty, from random move selection to heuristic-based play to Monte Carlo tree search. Play with full information to study the matchup. Play with hidden information to practice reading the opponent. Run batch simulations for statistical power.

**Analyze** -- Type coverage analysis. Threat identification. Speed tier breakdowns. Damage calculation matrices. Win probability graphs over the course of a battle. Critical turn detection -- the moment where the game swung, and what you could have done differently.

**Tweak** -- Change a moveslot. Adjust EVs. Swap an item. The team builder remembers what you had before. You can compare variants side by side. "Does 252 Speed Adamant Great Tusk actually outspeed anything important that 252 Speed Jolly misses?"

**Fork** -- Like git branching for teams. You have a team that works, but you want to try replacing Gholdengo with Iron Valiant without losing your current version. Fork it. Now you have two variants. Test both. Compare win rates. Merge the better one back, or keep both for different tournament environments.

**Repeat** -- The meta shifts. New Pokemon get suspect tested. Usage stats change. Your team that was perfect last month might have new weaknesses. The cycle continues, and the tools are there every time you come back.

### Team Versioning

Your team has a history. Not just "the team I'm using now" but "the team I started with, the version where I swapped Landorus for Gliscor, the version where I tried Shed Tail Cyclizar but it was too inconsistent, and the current version with Dragapult that I've been running for two weeks."

Version control for teams. Branch, compare, merge. See the diff between two versions of your team. See how win rates changed when you made a specific swap. Understand which changes actually made you better and which were lateral moves.

This isn't just record-keeping. It's a tool for learning. When you can see the evolution of your team over time, you start to understand _why_ certain changes worked. You build intuition not from guessing but from evidence.

### Meta Awareness

You can't build a team in a vacuum. You build for a metagame -- the set of Pokemon, sets, and strategies that you expect to face. And the metagame changes. What was dominant last month might be niche this month. What was niche might be rising.

Nasty Plot integrates usage statistics, set distribution data, and teammate correlations directly into the building process. Not as a wall of numbers in a separate tab, but as context woven into every decision. When you're choosing your fifth team member, you see not just "Pokemon that cover your remaining weaknesses" but "Pokemon that cover your remaining weaknesses _and_ handle the threats that are currently popular in OU."

Define what you expect to face. Simulate against it. Adapt. The meta is a moving target, and your tools should move with it.

### Battle Training

Playing on the ladder teaches you to play. But it doesn't teach you to _review_.

After a battle in Nasty Plot, you get a win probability graph that shows, turn by turn, who was winning. You see the moment where a 70% win position became a 30% win position. You see the critical turn -- the one where you clicked Stone Edge instead of switching to your Fairy-type, and the miss cost you the game. You see the turn where the engine recommended a different play and explains why.

Post-game review turns every battle into a learning experience. Not just "did I win" but "why did I win" and "where could I have lost." This is what chess players do with Stockfish. This is what poker players do with solvers. This is what competitive Pokemon has never had.

Beyond review, there's drilling. Battle puzzles that isolate specific skills. "You're down to Garchomp and Dragonite against their three. Find the winning line." Scenario training that forces you to practice the hard parts -- playing from behind, managing endgame speed ties, navigating imperfect information with Bayesian reasoning.

Not just play. Study. Drill. Improve. Repeat.

### Pecharunt: The AI Companion

The AI assistant is not a gimmick. It's the connective tissue that ties every feature together.

Pecharunt has context. It knows your team. It knows the format. It knows the metagame. It knows what page you're on and what you're trying to do. Ask it a question while building your team and it answers in the context of _your_ team, not in generic terms. Ask it during a battle and it considers _this_ game state, not some hypothetical.

For newcomers, Pecharunt is a patient teacher. It explains concepts simply, builds understanding layer by layer, and never assumes knowledge you don't have. "Stealth Rock is a move that places sharp stones on the opponent's side. Every time they switch a Pokemon in, it takes damage based on its Rock-type weakness. This is powerful because it punishes switching, and competitive Pokemon involves a lot of switching."

For veterans, Pecharunt is a sparring partner. It challenges your assumptions, suggests alternatives you might not have considered, and engages in genuine strategic analysis. "Your team looks solid against standard OU, but you have three Pokemon that lose to Calm Mind Cresselia, which has been rising in usage this month. Have you considered running Knock Off on your Kingambit to handle setup sweepers more reliably? It costs you the Sucker Punch mind game, but Cresselia can't boost against Knock Off pressure."

Pecharunt grows with you. The same assistant, different depths.

### Everything Connected

The biggest problem with current competitive Pokemon tools isn't that they're bad. Many of them are excellent. The problem is that they're separate. You build your team on one website. You check damage calcs on another. You look up usage stats on a third. You play on Showdown. You review by... going back to Showdown and re-reading the battle log, if you even remembered to save it.

Context switching kills understanding. Every time you leave one tool to open another, you lose the thread. You forget what you were checking. You lose the connection between "I need to check if this EV spread survives Gholdengo's Shadow Ball" and "oh wait, I also need to check if this makes me too slow to outspeed Dragapult."

In Nasty Plot, everything is connected. Your team data flows into the damage calculator. The damage calculator feeds into the threat analysis. The threat analysis informs the recommendation engine. The recommendation engine is context-aware because it knows your format, your team composition, and the current metagame. The battle simulator uses your actual team, against actual competitive teams, and the results feed back into the analysis layer.

One tool. One context. No switching.

---

## The Name

### Nasty Plot

In Pokemon, the move Nasty Plot sharply raises the user's Special Attack -- a plus-two boost, doubling its power in a single turn. It's a setup move. You sacrifice a turn of attacking to invest in future power. You plot, and then you strike. The opponent sees it happening and knows the next hit is going to hurt, but by then it might be too late.

That's what building a team is. That's what studying the metagame is. That's what reviewing your battles and drilling your weak spots is. Preparation that multiplies your power. The nasty plot before the sweep.

The name is a double meaning, and both meanings are the point. Nasty Plot is the tool for plotting. For scheming. For doing the work before the work. For treating competitive Pokemon not as a game you play casually but as a craft you develop deliberately.

Plot. Prepare. Strike.

### Pecharunt

The AI assistant is named after the Mythical Pokemon Pecharunt, the final addition to the Scarlet and Violet Pokedex. In lore, Pecharunt is a manipulator and strategist -- its signature ability, Poison Puppeteer, lets it control the actions of poisoned opponents, turning their own power against them. Its entire existence is about understanding others' capabilities and using that knowledge to gain advantage.

That's what a good strategic advisor does. It understands the opponent's likely moves, reveals the game plan they're probably executing, and helps you exploit the patterns they don't know they're showing. It doesn't fight the battle for you. It gives you the knowledge to fight it better.

Pecharunt, the AI, does the same thing. It reads the metagame so you don't have to do it from scratch. It identifies patterns in your opponents' teams that you might miss. It suggests the move that accounts for what the opponent is probably thinking, not just what does the most damage on paper.

The name fits. The role fits. And for anyone who knows the lore, the wink is intentional.

---

## A Final Word

Competitive Pokemon might be impossible to explain in a single video, a single article, or a single conversation. The five pillars interact in ways that defy linear explanation. Long-term planning depends on probability management. Simultaneous action selection depends on imperfect information. Imperfect information depends on team building. Team building depends on everything.

But it's not impossible to _learn_. People learn it every day -- through playing, through reading, through watching, through discussion. The problem has never been that the knowledge doesn't exist. The problem is that the knowledge has no home. No single place where it all comes together, where the tools teach the concepts and the concepts inform the tools.

That's what Nasty Plot is for.

Not to replace Showdown. Not to replace Smogon. Not to replace the community that has built competitive Pokemon into what it is today. But to give that community a war room. A place where the scattered knowledge converges into a coherent learning experience. Where the tools are smart enough to explain themselves. Where a newcomer can start building their first team with guidance and, a hundred teams later, be running batch simulations against the metagame with an AI sparring partner suggesting optimizations.

The staircase from beginner to competitor should be continuous. The depth should be infinite. The surface should be welcoming.

That's the nasty plot.

That's what we're building.
