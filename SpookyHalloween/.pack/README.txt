UPDATED FOR THE 16 OCTOBER 2026 PATCH  (version 1.1.0)
=====================================================
Rebuilt on the patched interface: the new chat settings button, party and
group controls, the HUD status icons and the data-driven minimap all work,
and every Spooky colour and addition is kept.

The headstone's sprites moved to spritesheet_spooky.css. The HP, MP, EXP
and fuel bars carry their colour in the texture now -- the patch stopped
tinting bar fills from the stylesheet.

UPGRADING FROM 1.0  -- one file to delete
    Delete this file from your ROSE Online folder if it is there:

        data\ui\themes\rose\styles\spritesheet_glassui.css

    Version 1.0 shipped its own copy of that sheet. A copy in your folder
    overrides the game's, so the patch's new buttons would draw blank.
    Spooky's sprites now live in their own file, spritesheet_spooky.css,
    and the game's sheet is left alone.

-----------------------------------------------------

VOID HALLOWEEN -- SPOOKY UI
===========================
A ghostly interface theme with Halloween accents, its own cursors,
and the haunted tombstone minimap.

Only one UI theme at a time: install another straight over the top.

INSTALL
    Copy the folders from this zip into your ROSE Online folder.
    Every file it installs is listed in .pack\FILE_LIST.txt.

UNINSTALL
    Delete those files.
