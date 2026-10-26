ROSE ONLINE - ICE UI THEME  (test version)
==========================================

A full reskin of the game's interface: cream panels, light ice-blue boxes, gold
highlights and matching icons, plus a few extras (Loot Filter, target element,
DPS meter, group/party improvements). Only UI files: no game data, no exe changes.

Please tell me what you like and what you don't!


INSTALL
-------
1. Close the game.
2. (Recommended) Back up your current  ROSE Online\data\ui  folder if you have one
   (most players don't have this folder at all).
3. Copy the "data" folder from this zip into your ROSE Online folder, for example
       C:\Program Files\ROSE Online\
   so you end up with  ROSE Online\data\ui\themes\rose\...
   Say yes if Windows asks to merge/replace.
4. Start the game.

UNINSTALL
---------
Delete  ROSE Online\data\ui  (or only the files from this zip) and restart.
The game falls back to its original look. The extras' settings are small text
files in the ROSE Online folder (see "Files the mod creates"); delete them too
if you want a clean slate.


WHAT'S IN IT
------------
Look
- Every window themed: inventory, character, skills, quests, chat, shops, storage,
  mall, mail, crafting, clan, party, group, minimap, world map, options and more.
- Close-button style icons (zulie, weight, currency, minimap dock, party toolbar...).
- Dark-blue tooltips, ice HP/MP/EXP bars, gold flourishes on the window corners.
- Zone name as a title card when you enter a map.
- Player shop signs: clean see-through blue bar with the zulie coin.

Loot Filter  (Options > Loot Filter)
- Type exact drop names (comma separated) into the colour lists: Yellow, Blue,
  Purple, Red, Green, Rainbow. Matching drops get a coloured glow, a bigger name
  and a light beam.
- Profiles: save sets of lists and switch between them with one click.
- "Only show filtered drops" / "Dim other drops (50%)".
- Read the "How it works" box in that tab. Important:
    * After changing the lists and pressing Save, RESTART the game for the glow.
    * Keep Game > "Show dropped item name" ON, the filter needs it.

Add-ons  (Options > Add-ons)
- Target Bar: the target's element next to its name + the elements it is weak
  against, and a DPS meter (DPS, average, time to kill). Both can be switched off.
  The DPS meter counts all damage the target takes (your party's too).
- Target Marker: colour of the arrows next to a selected player (red/blue/green,
  needs a restart).
- A list of the other extras and where to find them.

Party / Group
- Crowd-control frames + words on member cards (Flame, Sleep/Stun, Taunt, Silence,
  Poison, Bleed, Slow). The FX button in the window's toolbar turns them on/off.
- Party: "Far" when a member is out of range, "RIP" when dead, "Full" at 10.
- Group: equal card sizes, click anywhere on a card to target, member count on
  hover, Group Options (cogwheel) > Buff rows 1/2/3.

Other
- Item Mall: click an item to try it on straight away.
- HUD: the buff/proc tray rides along with the HUD (keeps its position).
- Inventory: collapse button next to the X.


FILES THE MOD CREATES (in the ROSE Online folder)
-------------------------------------------------
loot_filter.txt            your Loot Filter lists
loot_filter_profiles.txt   your Loot Filter profiles
sp_addons.txt              Add-ons switches, group buff rows, marker colour
data\ui\themes\rose\styles\lf_rules.css     glow rules, rebuilt from your lists


KNOWN LIMITS
------------
- Some things the game only loads at start: Loot Filter list changes and the target
  marker colour need a restart.
- The group window can't tell "dead" from "out of range" (the game doesn't send it).
- Target element only shows while the mob's nameplate is on screen.
- Some windows were themed without a live test (duel, arena scoreboard, monster
  inspector, style change, choice box, mall cart/storage). Screenshots welcome.
- If something looks broken after a game patch, remove the mod and let me know.
