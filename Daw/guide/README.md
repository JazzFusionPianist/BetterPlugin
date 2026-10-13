# the user guide

The buyer's guide to Slur Studio: a landscape PDF in English and in Korean, made from one source.

    node guide/build.mjs            both languages → guide/pdf/*.pdf
    node guide/build.mjs ko         one language
    node guide/build.mjs --look=12,13   also photographs those sheets (into $GUIDE_LOOK, else guide/pdf/look)
    node guide/shots.mjs            takes the pictures of the app again → guide/pics/

Run from `Daw/`. Both use headless Chrome through `test/cdp.mjs`. The build names every sheet whose words run
past its foot and fails; fix the sheet (shorter words, a narrower picture) until it is quiet.

## when a feature is added to the app

1. Add a page to its chapter in `chapters/` (or a chapter, listed in `chapters/index.mjs`). Every sentence is
   written twice: `t('english', '한국어')`. Inside a sentence: `[[⌘K]]` a key, `{{word}}` a word exactly as the
   screen writes it, `((File > Save As…))` a line of the Mac's menu bar, `` `kick -3` `` a typed command line.
2. If it has something to show, add a picture to `SHOTS` in `shots.mjs`. Pictures are taken from the app's own page
   with real key presses and pointer presses; beside each `pics/name.png` lies `pics/name.json` with the place of
   every named part (`data-a`), and `fig('name', { calls: [[1, 'part', 't']] })` draws a numbered line to it.
3. Take it off the page "not in this version" (`chapters/14-rest.mjs`) if it was listed there.
4. Build, look at the sheets, send both PDFs.

The key commands (`chapters/90-keys.mjs`) are set from `keys.json`, which `shots.mjs` writes from the app's own
key sheet: a key added to the app's sheet is in the guide at the next run. Its Korean lines come from
`ui/lang.ko.js`.

## the pictures

`shots.mjs` photographs the installed app's page (`/Applications/Slur Studio.app/Contents/Resources/ui`), because
the working tree may be in the middle of someone's change. `GUIDE_UI=tree` takes the working tree,
`GUIDE_UI=/a/path/index.html` any other copy. Names of people and projects in the pictures are made up in
`shots.mjs`; keep it so.

The Korean edition quotes the screen's words in English, as the pictures show them. Once the app's Korean wording
(`ui/lang.ko.js`) is settled, `GUIDE_KO_SCREEN=1` makes `{{word}}` say itself in Korean, and the pictures are to be
taken again with the page in Korean.
