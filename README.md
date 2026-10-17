RO_UserInterface_resources
=========================

Overview
--------
This repository contains custom Rose Online UI resource packs for RO_UserInterface. Each top-level folder is a separate profile/theme with its own cursor set, UI styling, and supporting assets.

Current profiles
----------------
- Ancient
- Crimson
- Moldie
- Void
- .default (recovery/default fallback; contains the Rednim cursor set)

Repository layout
-----------------
Root/
- .default/      (default/recovery pack with Rednim cursors)
- Ancient/       (Ancient-themed UI pack)
- Crimson/       (Crimson-themed UI pack)
- Moldie/        (Moldie-themed UI pack)
- Void/          (Void-themed UI pack)
- README.md      (project documentation)
- manifest.json  (repository metadata)

Profile structure
-----------------
Each profile typically includes:
- res/                     (cursor files such as default.cur, attack.cur, left.cur, etc.)
- data/ui/themes/...       (theme CSS and HTML UI assets)
- 3ddata/control/Res/     (UI texture resources)
- manifestUi.json          (profile-specific metadata)

Usage notes
-----------
- Pick the folder that matches the UI style you want to use.
- .default is the recovery/default fallback and is meant to restore the standard cursor set when needed.
- Keep the folder structure consistent with the game installation so the UI resources can be swapped cleanly.
- The root manifest.json stores project-level metadata for the repository.

<!-- rose-online-toolbox:start -->
ROSE Online Toolbox themes
--------------------------
183 UI themes from [ROSE Online Toolbox](https://roseonlinetoolbox.com/mods), one folder each, exported by its
`scripts/export-ui-resources.ts`. They restyle the game windows (data/ui/themes/rose) and keep the default
cursors. Each folder's manifestUi.json links to the theme's page, and .preview/ holds a screenshot.

- Premium themes: RoyalRegalia, MoonsilverGrove, Dragonforge, ArcanePrism, CelestialObservatory, SakuraLacquer, ArumicNexus, JadeDynasty
- Whimsical themes: JellybeanJamboree, CandyKingdom, CloudNine, MushroomHollow, KittyCafe, BubbleLagoon, DreamySlumber, RainbowUnicorn, GingerbreadCottage
- OG ROSE themes: SevenHearts2002, KROSE2004, PreEvo2005, Evolution2006, NaROSEAzure, WarpPortalEra
- Classic colorways: ClassicRosePetal, ClassicMintBreeze, ClassicLemonDrop, ClassicLilacDream, ClassicPeachSunset, ClassicSkyBlue, ClassicSilverMoon, ClassicCocoaCream, ClassicCrimsonKnight, ClassicForestRanger, ClassicTealLagoon, ClassicPlumWine
- Essentials: FlatDark, HighContrast, SoftSlate, EmberGlass, RoseQuartzGlass, JadeGlass, Graphite, MidnightBlue, Fjord, DuskMauve, Mocha
- Planet themes: JunonVerdant, KenjiBeach, LunaFrost, EucarArcana, EldeonWildwood, MarshOfGhosts, OrloDunes, AruasRadiance, HebarnsEclipse, ZantCanyon, PolisRoyal, LunaAurora, LunarGlass, AnimaLake, AdventurersPlains, SnowValley, GoblinCave, ElVerloonDesert, SikukuRuins, ForgottenTemple, XitaRefuge, SunshineCoast, BirthIsland, BreezyHills, ForestOfWisdom, LuxemTower, DesertOfTheDead, GorgeOfSilence, CaveOfUlverick, ManaSnowfields, ArumicValley, ShadyJungle, ForestOfWandering, DesertCityOfMuris, TheWasteland, DraconisPeaks, OblivionTemple, SeaOfDawn, GardenOfAru
- Retro themes: Retro98, TavernLeather, HeroMenuBlue, PhosphorTerminal, AmberCRT, PocketDot, InkParchment, ArcadeMarquee, StoneKeep, ComicPanel, TextMode, VaporMall, PixelCastle, FilmNoir, SepiaPhotograph, HiFiStereo, VHSTape, Blueprint, Chalkboard, FantasyConsole, 16BitTwilight, Typewriter
- Futuristic themes: NeonGrid, HoloCyan, CastleGear, CarbonStrike, CryoLab, Biohazard, VoidChrome, SolarFlare, SakuraCircuit, DeepSeaSonar, MarsColony, QuantumPrism, NightOps, GoldChrome, Glitch, SynthwaveSunset, PlasmaCore, OrbitalStation, IonStorm, StarlightNav
- Job class themes: KnightsBulwark, ChampionsFury, MagesArcana, ClericsGrace, RaidersShade, ScoutsTrail, BourgeoisVelvet, ArtisansWorkshop, SoldiersSteel, MusesStarlight, HawkersWind, DealersLedger
- Fantasy RPG themes: GothicCathedral, ElvenGrove, DwarvenForge, SamuraiLacquer, PirateCove, RoyalGuard, WitchsHut, CrystalMenu, NecromancersCrypt, PaladinsLight, DruidsCircle, DragonsHoard, FrostGiant, SunkenTemple, VampireCourt, DesertSultan, VikingHall, ShrineGate, AlchemistsLab, FairyTale, GolemStone, RangersCampfire
- Seasonal themes: PumpkinNight, WinterFestival, SpringBlossom, SummerLanterns, HarvestMoon, LunarNewYear, HeartsDay, AutumnLeaves, RainySeason, FireworksNight, EggHunt, SantaPlanetoid
- Gemstone themes: RubyGlass, SapphireGlass, AquamarineGlass, Emerald, Amethyst, Topaz, Opal, Onyx, Pearl, Garnet
<!-- rose-online-toolbox:end -->
