RO_UserInterface_resources
=======================

Overview
--------
This repository stores resource folders containing the contents of the folder from a Rose Online installation. Each top-level folder is a separate "user interface profile" that adjusts UI elements and cursors for use with RO_UserInterface.

Current profiles
----------------
- poc — proof-of-concept adjustments (modified sizes/models)

Purpose
-------
Use these folders as the source-of-truth for different loot item profiles in RO_LootManager. The manager can read a chosen profile folder to apply model files and size adjustments when generating loot displays or patches.

Repository layout
-----------------
Root/
- original/    (contents of 3ddata/item from installation)
- poc/         (modified items for testing)
- prisonFarm/  (optimal profile for prison farming)
- .idea/       (IDE metadata)

Usage notes
-----------
- Each profile folder should mirror the directory structure of `poc`.
- Keep filenames and subfolders consistent with the game installation so RO_LootManager can map items correctly.
- When adding a new profile, create a new top-level folder (profile name) and place the copied/adjusted files inside.
- Any new top-level profile folder SHOULD include a manifest.json with the following fields: name, version, timestamp (ISO 8601), description, and useful metadata such as author, url, managedSubfolders, or tags.
- The repository root also includes a manifest.json next to README.md to summarize the project and its available profiles.

Contributing
------------
- Add or update profiles by creating a new folder or editing an existing one.
- Document any size/model tweaks in a small text file (e.g., `CHANGES.txt`) inside the profile folder.

Support
-------
For questions about integration with RO_LootManager, contact the repository owner or the project maintainers.
