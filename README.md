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
