export interface SampleTeamSeedEntry {
  name: string
  formatId: string
  archetype: string
  paste: string
  source: string
}

export const SAMPLE_TEAMS: SampleTeamSeedEntry[] = [
  // ========== gen9ou ==========
  {
    name: "OU Balance",
    formatId: "gen9ou",
    archetype: "balance",
    source: "curated-seed",
    paste: `Gholdengo @ Air Balloon
Ability: Good as Gold
Tera Type: Fighting
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Make It Rain
- Shadow Ball
- Focus Blast
- Recover

Great Tusk @ Booster Energy
Ability: Protosynthesis
Tera Type: Ground
EVs: 252 Atk / 4 Def / 252 Spe
Jolly Nature
- Headlong Rush
- Ice Spinner
- Rapid Spin
- Knock Off

Kingambit @ Leftovers
Ability: Supreme Overlord
Tera Type: Dark
EVs: 252 HP / 252 Atk / 4 SpD
Adamant Nature
- Kowtow Cleave
- Sucker Punch
- Iron Head
- Swords Dance

Dragapult @ Choice Specs
Ability: Infiltrator
Tera Type: Ghost
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Shadow Ball
- Draco Meteor
- Flamethrower
- U-turn

Slowking-Galar @ Assault Vest
Ability: Regenerator
Tera Type: Poison
EVs: 252 HP / 4 Def / 252 SpD
Sassy Nature
IVs: 0 Spe
- Future Sight
- Sludge Bomb
- Flamethrower
- Chilly Reception

Clefable @ Leftovers
Ability: Magic Guard
Tera Type: Steel
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
- Moonblast
- Flamethrower
- Stealth Rock
- Soft-Boiled`,
  },
  {
    name: "OU Bulky Offense",
    formatId: "gen9ou",
    archetype: "bulky-offense",
    source: "curated-seed",
    paste: `Gliscor @ Toxic Orb
Ability: Poison Heal
Tera Type: Water
EVs: 244 HP / 8 Def / 200 SpD / 56 Spe
Careful Nature
- Earthquake
- Knock Off
- Toxic
- Roost

Gholdengo @ Choice Specs
Ability: Good as Gold
Tera Type: Fighting
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Make It Rain
- Shadow Ball
- Focus Blast
- Trick

Heatran @ Leftovers
Ability: Flash Fire
Tera Type: Grass
EVs: 252 HP / 4 SpA / 252 SpD
Calm Nature
- Magma Storm
- Earth Power
- Stealth Rock
- Taunt

Great Tusk @ Heavy-Duty Boots
Ability: Protosynthesis
Tera Type: Ground
EVs: 252 HP / 4 Atk / 252 Spe
Jolly Nature
- Headlong Rush
- Rapid Spin
- Knock Off
- Ice Spinner

Dragonite @ Choice Band
Ability: Multiscale
Tera Type: Normal
EVs: 252 Atk / 4 Def / 252 Spe
Adamant Nature
- Outrage
- Extreme Speed
- Earthquake
- Ice Spinner

Kingambit @ Black Glasses
Ability: Supreme Overlord
Tera Type: Dark
EVs: 252 HP / 252 Atk / 4 SpD
Adamant Nature
- Kowtow Cleave
- Sucker Punch
- Iron Head
- Swords Dance`,
  },
  {
    name: "OU Hyper Offense",
    formatId: "gen9ou",
    archetype: "hyper-offense",
    source: "curated-seed",
    paste: `Roaring Moon @ Booster Energy
Ability: Protosynthesis
Tera Type: Flying
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Dragon Dance
- Acrobatics
- Knock Off
- Earthquake

Iron Valiant @ Life Orb
Ability: Quark Drive
Tera Type: Fairy
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Moonblast
- Close Combat
- Shadow Ball
- Calm Mind

Dragapult @ Choice Specs
Ability: Infiltrator
Tera Type: Ghost
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Shadow Ball
- Draco Meteor
- Flamethrower
- U-turn

Gholdengo @ Focus Sash
Ability: Good as Gold
Tera Type: Fighting
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Make It Rain
- Shadow Ball
- Focus Blast
- Nasty Plot

Great Tusk @ Heavy-Duty Boots
Ability: Protosynthesis
Tera Type: Ground
EVs: 252 Atk / 4 Def / 252 Spe
Jolly Nature
- Headlong Rush
- Stealth Rock
- Rapid Spin
- Ice Spinner

Kingambit @ Black Glasses
Ability: Supreme Overlord
Tera Type: Flying
EVs: 252 HP / 252 Atk / 4 SpD
Adamant Nature
- Kowtow Cleave
- Sucker Punch
- Iron Head
- Swords Dance`,
  },
  {
    name: "OU Offense",
    formatId: "gen9ou",
    archetype: "offense",
    source: "curated-seed",
    paste: `Dragonite @ Choice Band
Ability: Multiscale
Tera Type: Normal
EVs: 252 Atk / 4 SpD / 252 Spe
Adamant Nature
- Outrage
- Extreme Speed
- Earthquake
- Ice Spinner

Iron Valiant @ Booster Energy
Ability: Quark Drive
Tera Type: Electric
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Moonblast
- Thunderbolt
- Shadow Ball
- Psyshock

Great Tusk @ Leftovers
Ability: Protosynthesis
Tera Type: Ground
EVs: 252 HP / 4 Atk / 252 Spe
Jolly Nature
- Headlong Rush
- Rapid Spin
- Knock Off
- Stealth Rock

Gholdengo @ Air Balloon
Ability: Good as Gold
Tera Type: Water
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Make It Rain
- Shadow Ball
- Recover
- Nasty Plot

Kingambit @ Leftovers
Ability: Supreme Overlord
Tera Type: Flying
EVs: 252 HP / 252 Atk / 4 SpD
Adamant Nature
- Kowtow Cleave
- Sucker Punch
- Iron Head
- Swords Dance

Garganacl @ Leftovers
Ability: Purifying Salt
Tera Type: Ghost
EVs: 252 HP / 252 Def / 4 SpD
Impish Nature
- Salt Cure
- Recover
- Stealth Rock
- Body Press`,
  },
  {
    name: "OU Rain",
    formatId: "gen9ou",
    archetype: "rain",
    source: "curated-seed",
    paste: `Pelipper @ Damp Rock
Ability: Drizzle
Tera Type: Ground
EVs: 248 HP / 8 SpA / 252 SpD
Calm Nature
- Scald
- Hurricane
- U-turn
- Roost

Barraskewda @ Choice Band
Ability: Swift Swim
Tera Type: Water
EVs: 252 Atk / 4 SpD / 252 Spe
Adamant Nature
- Liquidation
- Flip Turn
- Close Combat
- Aqua Jet

Iron Valiant @ Booster Energy
Ability: Quark Drive
Tera Type: Fairy
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Moonblast
- Close Combat
- Shadow Ball
- Calm Mind

Kingambit @ Leftovers
Ability: Supreme Overlord
Tera Type: Water
EVs: 252 HP / 252 Atk / 4 SpD
Adamant Nature
- Kowtow Cleave
- Sucker Punch
- Iron Head
- Swords Dance

Ferrothorn @ Leftovers
Ability: Iron Barbs
Tera Type: Water
EVs: 252 HP / 24 Def / 232 SpD
Relaxed Nature
IVs: 0 Spe
- Power Whip
- Knock Off
- Spikes
- Leech Seed

Great Tusk @ Heavy-Duty Boots
Ability: Protosynthesis
Tera Type: Ground
EVs: 252 Atk / 4 Def / 252 Spe
Jolly Nature
- Headlong Rush
- Rapid Spin
- Knock Off
- Ice Spinner`,
  },
  {
    name: "OU Sun",
    formatId: "gen9ou",
    archetype: "sun",
    source: "curated-seed",
    paste: `Torkoal @ Heat Rock
Ability: Drought
Tera Type: Ground
EVs: 248 HP / 8 Def / 252 SpD
Bold Nature
IVs: 0 Spe
- Lava Plume
- Stealth Rock
- Yawn
- Rapid Spin

Gouging Fire @ Booster Energy
Ability: Protosynthesis
Tera Type: Fairy
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Dragon Dance
- Flare Blitz
- Breaking Swipe
- Morning Sun

Gholdengo @ Choice Specs
Ability: Good as Gold
Tera Type: Fighting
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Make It Rain
- Shadow Ball
- Focus Blast
- Trick

Great Tusk @ Heavy-Duty Boots
Ability: Protosynthesis
Tera Type: Ground
EVs: 252 Atk / 4 Def / 252 Spe
Jolly Nature
- Headlong Rush
- Ice Spinner
- Knock Off
- Rapid Spin

Ogerpon-Hearthflame @ Hearthflame Mask
Ability: Mold Breaker
Tera Type: Fire
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Ivy Cudgel
- Horn Leech
- Knock Off
- Swords Dance

Kingambit @ Leftovers
Ability: Supreme Overlord
Tera Type: Dark
EVs: 252 HP / 252 Atk / 4 SpD
Adamant Nature
- Kowtow Cleave
- Sucker Punch
- Iron Head
- Swords Dance`,
  },
  {
    name: "OU Sand",
    formatId: "gen9ou",
    archetype: "sand",
    source: "curated-seed",
    paste: `Tyranitar @ Smooth Rock
Ability: Sand Stream
Tera Type: Ghost
EVs: 252 HP / 4 Atk / 252 SpD
Careful Nature
- Stone Edge
- Knock Off
- Stealth Rock
- Thunder Wave

Garchomp @ Life Orb
Ability: Rough Skin
Tera Type: Steel
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Scale Shot
- Swords Dance
- Iron Head

Gholdengo @ Air Balloon
Ability: Good as Gold
Tera Type: Fighting
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Make It Rain
- Shadow Ball
- Focus Blast
- Recover

Landorus-Therian @ Leftovers
Ability: Intimidate
Tera Type: Water
EVs: 252 HP / 4 Atk / 252 Def
Impish Nature
- Earthquake
- U-turn
- Stealth Rock
- Knock Off

Corviknight @ Rocky Helmet
Ability: Pressure
Tera Type: Fire
EVs: 252 HP / 168 Def / 88 SpD
Impish Nature
- Body Press
- Brave Bird
- Defog
- Roost

Kingambit @ Leftovers
Ability: Supreme Overlord
Tera Type: Flying
EVs: 252 HP / 252 Atk / 4 SpD
Adamant Nature
- Kowtow Cleave
- Sucker Punch
- Iron Head
- Swords Dance`,
  },
  {
    name: "OU Stall",
    formatId: "gen9ou",
    archetype: "stall",
    source: "curated-seed",
    paste: `Toxapex @ Black Sludge
Ability: Regenerator
Tera Type: Fairy
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
- Scald
- Toxic Spikes
- Haze
- Recover

Corviknight @ Rocky Helmet
Ability: Pressure
Tera Type: Fire
EVs: 252 HP / 168 Def / 88 SpD
Impish Nature
- Body Press
- Brave Bird
- Defog
- Roost

Clefable @ Leftovers
Ability: Magic Guard
Tera Type: Steel
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
- Moonblast
- Knock Off
- Stealth Rock
- Soft-Boiled

Blissey @ Heavy-Duty Boots
Ability: Natural Cure
Tera Type: Ghost
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
- Seismic Toss
- Toxic
- Heal Bell
- Soft-Boiled

Great Tusk @ Leftovers
Ability: Protosynthesis
Tera Type: Poison
EVs: 252 HP / 4 Atk / 252 Spe
Jolly Nature
- Headlong Rush
- Rapid Spin
- Knock Off
- Ice Spinner

Slowking-Galar @ Assault Vest
Ability: Regenerator
Tera Type: Poison
EVs: 252 HP / 4 Def / 252 SpD
Sassy Nature
IVs: 0 Spe
- Future Sight
- Sludge Bomb
- Flamethrower
- Chilly Reception`,
  },

  // ========== gen9uu ==========
  {
    name: "UU Balance",
    formatId: "gen9uu",
    archetype: "balance",
    source: "curated-seed",
    paste: `Skeledirge @ Heavy-Duty Boots
Ability: Unaware
Tera Type: Fairy
EVs: 252 HP / 252 Def / 4 SpA
Bold Nature
- Torch Song
- Shadow Ball
- Slack Off
- Will-O-Wisp

Cobalion @ Leftovers
Ability: Justified
Tera Type: Ghost
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Close Combat
- Iron Head
- Stealth Rock
- Swords Dance

Salamence @ Choice Specs
Ability: Intimidate
Tera Type: Fire
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Draco Meteor
- Hurricane
- Flamethrower
- Hydro Pump

Gastrodon @ Leftovers
Ability: Storm Drain
Tera Type: Grass
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
- Scald
- Earth Power
- Recover
- Toxic

Bisharp @ Eviolite
Ability: Defiant
Tera Type: Dark
EVs: 252 Atk / 4 SpD / 252 Spe
Adamant Nature
- Knock Off
- Iron Head
- Sucker Punch
- Swords Dance

Quaquaval @ Life Orb
Ability: Moxie
Tera Type: Water
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Aqua Step
- Close Combat
- Brave Bird
- Swords Dance`,
  },
  {
    name: "UU Offense",
    formatId: "gen9uu",
    archetype: "offense",
    source: "curated-seed",
    paste: `Iron Moth @ Heavy-Duty Boots
Ability: Quark Drive
Tera Type: Grass
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Fire Blast
- Sludge Wave
- Energy Ball
- Psychic

Lucario @ Life Orb
Ability: Inner Focus
Tera Type: Steel
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Close Combat
- Meteor Mash
- Extreme Speed
- Swords Dance

Salamence @ Choice Scarf
Ability: Moxie
Tera Type: Steel
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Outrage
- Earthquake
- Dragon Dance
- Dual Wingbeat

Sandy Shocks @ Booster Energy
Ability: Protosynthesis
Tera Type: Steel
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Thunderbolt
- Earth Power
- Stealth Rock
- Volt Switch

Bisharp @ Eviolite
Ability: Defiant
Tera Type: Dark
EVs: 252 Atk / 4 SpD / 252 Spe
Adamant Nature
- Knock Off
- Iron Head
- Sucker Punch
- Swords Dance

Alomomola @ Heavy-Duty Boots
Ability: Regenerator
Tera Type: Grass
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
- Flip Turn
- Wish
- Protect
- Toxic`,
  },
  {
    name: "UU Bulky Offense",
    formatId: "gen9uu",
    archetype: "bulky-offense",
    source: "curated-seed",
    paste: `Scizor @ Heavy-Duty Boots
Ability: Technician
Tera Type: Dark
EVs: 248 HP / 252 Atk / 8 SpD
Adamant Nature
- Bullet Punch
- U-turn
- Knock Off
- Swords Dance

Skeledirge @ Heavy-Duty Boots
Ability: Unaware
Tera Type: Fairy
EVs: 252 HP / 4 SpA / 252 SpD
Calm Nature
- Torch Song
- Hex
- Slack Off
- Will-O-Wisp

Krookodile @ Leftovers
Ability: Intimidate
Tera Type: Poison
EVs: 252 Atk / 4 Def / 252 Spe
Jolly Nature
- Earthquake
- Knock Off
- Stealth Rock
- Taunt

Salamence @ Life Orb
Ability: Moxie
Tera Type: Steel
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Dragon Dance
- Dual Wingbeat
- Earthquake
- Dragon Claw

Iron Moth @ Choice Specs
Ability: Quark Drive
Tera Type: Grass
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Fire Blast
- Sludge Wave
- Energy Ball
- Psychic

Quaquaval @ Life Orb
Ability: Moxie
Tera Type: Water
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Aqua Step
- Close Combat
- Ice Spinner
- Swords Dance`,
  },

  // ========== gen9vgc2025 ==========
  {
    name: "VGC Koraidon Sun",
    formatId: "gen9vgc2025",
    archetype: "sun",
    source: "curated-seed",
    paste: `Koraidon @ Assault Vest
Ability: Orichalcum Pulse
Level: 50
Tera Type: Fire
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Collision Course
- Flare Blitz
- Drain Punch
- U-turn

Flutter Mane @ Choice Specs
Ability: Protosynthesis
Level: 50
Tera Type: Fairy
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Moonblast
- Shadow Ball
- Dazzling Gleam
- Mystical Fire

Incineroar @ Safety Goggles
Ability: Intimidate
Level: 50
Tera Type: Ghost
EVs: 252 HP / 4 Atk / 252 SpD
Careful Nature
- Flare Blitz
- Knock Off
- Fake Out
- Parting Shot

Rillaboom @ Miracle Seed
Ability: Grassy Surge
Level: 50
Tera Type: Fire
EVs: 252 HP / 252 Atk / 4 SpD
Adamant Nature
- Grassy Glide
- Wood Hammer
- Fake Out
- U-turn

Urshifu @ Focus Sash
Ability: Unseen Fist
Level: 50
Tera Type: Stellar
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Wicked Blow
- Close Combat
- Sucker Punch
- Detect

Amoonguss @ Sitrus Berry
Ability: Regenerator
Level: 50
Tera Type: Water
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
IVs: 0 Atk / 0 Spe
- Spore
- Pollen Puff
- Rage Powder
- Clear Smog`,
  },
  {
    name: "VGC Calyrex-Shadow",
    formatId: "gen9vgc2025",
    archetype: "offense",
    source: "curated-seed",
    paste: `Calyrex-Shadow @ Focus Sash
Ability: As One (Spectrier)
Level: 50
Tera Type: Fairy
EVs: 4 HP / 252 SpA / 252 Spe
Timid Nature
- Astral Barrage
- Psyshock
- Nasty Plot
- Protect

Flutter Mane @ Life Orb
Ability: Protosynthesis
Level: 50
Tera Type: Stellar
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Moonblast
- Shadow Ball
- Icy Wind
- Protect

Incineroar @ Sitrus Berry
Ability: Intimidate
Level: 50
Tera Type: Water
EVs: 252 HP / 4 Atk / 252 SpD
Careful Nature
- Flare Blitz
- Knock Off
- Fake Out
- Parting Shot

Rillaboom @ Assault Vest
Ability: Grassy Surge
Level: 50
Tera Type: Fire
EVs: 252 HP / 252 Atk / 4 SpD
Adamant Nature
- Grassy Glide
- Wood Hammer
- Fake Out
- U-turn

Urshifu-Rapid-Strike @ Mystic Water
Ability: Unseen Fist
Level: 50
Tera Type: Water
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Surging Strikes
- Close Combat
- Aqua Jet
- Detect

Whimsicott @ Covert Cloak
Ability: Prankster
Level: 50
Tera Type: Steel
EVs: 252 HP / 4 SpA / 252 Spe
Timid Nature
- Moonblast
- Tailwind
- Encore
- Helping Hand`,
  },
  {
    name: "VGC Terapagos Goodstuffs",
    formatId: "gen9vgc2025",
    archetype: "balance",
    source: "curated-seed",
    paste: `Terapagos @ Leftovers
Ability: Tera Shift
Level: 50
Tera Type: Stellar
EVs: 252 HP / 4 SpA / 252 SpD
Calm Nature
- Tera Starstorm
- Earth Power
- Calm Mind
- Protect

Flutter Mane @ Choice Specs
Ability: Protosynthesis
Level: 50
Tera Type: Fairy
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Moonblast
- Shadow Ball
- Dazzling Gleam
- Mystical Fire

Incineroar @ Safety Goggles
Ability: Intimidate
Level: 50
Tera Type: Water
EVs: 252 HP / 252 Def / 4 SpD
Impish Nature
- Flare Blitz
- Knock Off
- Fake Out
- Parting Shot

Urshifu @ Choice Band
Ability: Unseen Fist
Level: 50
Tera Type: Dark
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Wicked Blow
- Close Combat
- Sucker Punch
- U-turn

Rillaboom @ Miracle Seed
Ability: Grassy Surge
Level: 50
Tera Type: Fire
EVs: 252 HP / 252 Atk / 4 SpD
Adamant Nature
- Grassy Glide
- Wood Hammer
- Fake Out
- U-turn

Ogerpon-Wellspring @ Wellspring Mask
Ability: Water Absorb
Level: 50
Tera Type: Water
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Ivy Cudgel
- Horn Leech
- Spiky Shield
- Swords Dance`,
  },

  // ========== gen9monotype ==========
  {
    name: "Mono Steel",
    formatId: "gen9monotype",
    archetype: "balance",
    source: "curated-seed",
    paste: `Gholdengo @ Air Balloon
Ability: Good as Gold
Tera Type: Fighting
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Make It Rain
- Shadow Ball
- Focus Blast
- Recover

Kingambit @ Leftovers
Ability: Supreme Overlord
Tera Type: Flying
EVs: 252 HP / 252 Atk / 4 SpD
Adamant Nature
- Kowtow Cleave
- Sucker Punch
- Iron Head
- Swords Dance

Corviknight @ Rocky Helmet
Ability: Pressure
Tera Type: Fire
EVs: 252 HP / 168 Def / 88 SpD
Impish Nature
- Body Press
- Brave Bird
- Defog
- Roost

Heatran @ Leftovers
Ability: Flash Fire
Tera Type: Grass
EVs: 252 HP / 4 SpA / 252 SpD
Calm Nature
- Magma Storm
- Earth Power
- Stealth Rock
- Taunt

Scizor @ Heavy-Duty Boots
Ability: Technician
Tera Type: Dark
EVs: 248 HP / 252 Atk / 8 SpD
Adamant Nature
- Bullet Punch
- U-turn
- Knock Off
- Swords Dance

Ferrothorn @ Leftovers
Ability: Iron Barbs
Tera Type: Water
EVs: 252 HP / 24 Def / 232 SpD
Relaxed Nature
IVs: 0 Spe
- Power Whip
- Knock Off
- Spikes
- Leech Seed`,
  },
  {
    name: "Mono Dragon",
    formatId: "gen9monotype",
    archetype: "offense",
    source: "curated-seed",
    paste: `Dragapult @ Choice Specs
Ability: Infiltrator
Tera Type: Ghost
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Shadow Ball
- Draco Meteor
- Flamethrower
- U-turn

Dragonite @ Heavy-Duty Boots
Ability: Multiscale
Tera Type: Steel
EVs: 252 Atk / 4 SpD / 252 Spe
Adamant Nature
- Dragon Dance
- Earthquake
- Extreme Speed
- Iron Head

Garchomp @ Life Orb
Ability: Rough Skin
Tera Type: Steel
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Scale Shot
- Swords Dance
- Iron Head

Roaring Moon @ Booster Energy
Ability: Protosynthesis
Tera Type: Flying
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Dragon Dance
- Acrobatics
- Knock Off
- Earthquake

Kommo-o @ Leftovers
Ability: Bulletproof
Tera Type: Steel
EVs: 252 HP / 4 Atk / 252 SpD
Careful Nature
- Stealth Rock
- Drain Punch
- Dragon Tail
- Thunder Wave

Cyclizar @ Heavy-Duty Boots
Ability: Regenerator
Tera Type: Ghost
EVs: 252 HP / 4 Def / 252 Spe
Jolly Nature
- Rapid Spin
- Knock Off
- Shed Tail
- Dragon Claw`,
  },

  // ========== gen9doublesou ==========
  {
    name: "Doubles OU Rain",
    formatId: "gen9doublesou",
    archetype: "rain",
    source: "curated-seed",
    paste: `Pelipper @ Damp Rock
Ability: Drizzle
Tera Type: Ghost
EVs: 252 HP / 4 SpA / 252 SpD
Calm Nature
- Weather Ball
- Hurricane
- Tailwind
- Protect

Flutter Mane @ Choice Specs
Ability: Protosynthesis
Tera Type: Water
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Moonblast
- Shadow Ball
- Dazzling Gleam
- Thunderbolt

Iron Hands @ Assault Vest
Ability: Quark Drive
Tera Type: Grass
EVs: 252 HP / 252 Atk / 4 SpD
Adamant Nature
- Drain Punch
- Thunder Punch
- Fake Out
- Heavy Slam

Barraskewda @ Choice Band
Ability: Swift Swim
Tera Type: Water
EVs: 252 Atk / 4 SpD / 252 Spe
Adamant Nature
- Liquidation
- Flip Turn
- Close Combat
- Aqua Jet

Amoonguss @ Rocky Helmet
Ability: Regenerator
Tera Type: Steel
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
IVs: 0 Atk / 0 Spe
- Spore
- Pollen Puff
- Rage Powder
- Clear Smog

Kingambit @ Lum Berry
Ability: Supreme Overlord
Tera Type: Dark
EVs: 252 HP / 252 Atk / 4 SpD
Adamant Nature
- Kowtow Cleave
- Sucker Punch
- Iron Head
- Protect`,
  },
  {
    name: "Doubles OU Trick Room",
    formatId: "gen9doublesou",
    archetype: "trick-room",
    source: "curated-seed",
    paste: `Hatterene @ Focus Sash
Ability: Magic Bounce
Tera Type: Water
EVs: 252 HP / 252 SpA / 4 SpD
Quiet Nature
IVs: 0 Atk / 0 Spe
- Trick Room
- Dazzling Gleam
- Psychic
- Mystical Fire

Torkoal @ Charcoal
Ability: Drought
Tera Type: Grass
EVs: 252 HP / 252 SpA / 4 SpD
Quiet Nature
IVs: 0 Atk / 0 Spe
- Eruption
- Heat Wave
- Earth Power
- Protect

Iron Hands @ Assault Vest
Ability: Quark Drive
Tera Type: Grass
EVs: 252 HP / 252 Atk / 4 SpD
Brave Nature
IVs: 0 Spe
- Drain Punch
- Thunder Punch
- Fake Out
- Heavy Slam

Amoonguss @ Sitrus Berry
Ability: Regenerator
Tera Type: Steel
EVs: 252 HP / 252 Def / 4 SpD
Relaxed Nature
IVs: 0 Atk / 0 Spe
- Spore
- Pollen Puff
- Rage Powder
- Protect

Kingambit @ Life Orb
Ability: Supreme Overlord
Tera Type: Flying
EVs: 252 HP / 252 Atk / 4 SpD
Brave Nature
IVs: 0 Spe
- Kowtow Cleave
- Sucker Punch
- Iron Head
- Protect

Flutter Mane @ Life Orb
Ability: Protosynthesis
Tera Type: Fairy
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Moonblast
- Shadow Ball
- Icy Wind
- Protect`,
  },
]
