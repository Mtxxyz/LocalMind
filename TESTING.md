# LocalMind — Manual smoke test

Run the standalone `src-tauri/target/release/LocalMind.exe` from a folder you can write to.

## First run
- [ ] App opens to the lock screen if a password is set, otherwise straight to the notes UI.
- [ ] No console window, no installer, no network prompt.
- [ ] Settings → Data shows a `LocalMind-data` folder next to the `.exe`.
- [ ] `localmind.db` and `attachments/` are created there.

## Notes
- [ ] `Ctrl+Shift+N` creates a note and opens it in **edit** mode.
- [ ] `Ctrl+E` toggles between edit and preview; selecting another note opens in **preview**.
- [ ] Typing shows "Saving…" then "Saved locally"; content survives an app restart.
- [ ] `Ctrl+F` focuses search; results update as you type (including tag names).
- [ ] Pin, archive, and trash work; trashed notes only disappear when restored or manually emptied.

## Organization
- [ ] Create a folder and a nested subfolder via the `+` on the folder row.
- [ ] Move a note with the folder dropdown in the editor toolbar.
- [ ] Create a tag and toggle it on a note; filtering by tag shows the note.

## Attachments and reminders
- [ ] Use the paperclip to attach a file — it appears under the note.
- [ ] Drag a file from Explorer onto the editor — it is attached too.
- [ ] Files are copied into `LocalMind-data/attachments` and survive restart.
- [ ] Set a reminder a minute in the future — the in-app banner appears while the app runs.

## Quick capture
- [ ] With the app closed or unfocused, `Ctrl+N` opens the Quick Capture window.
- [ ] Saving creates a new note, visible in the main window.
- [ ] With a password set, `Ctrl+N` does nothing until the app is unlocked.

## Themes and lock
- [ ] Settings → Appearance: Light, Dark, and System all apply.
- [ ] All 8 templates render correctly in both modes; accent override applies.
- [ ] Set a password, restart, and confirm the lock screen rejects wrong and accepts right.
- [ ] Removing a password requires the current password.

## Export / restore
- [ ] Export a single note to `.md` with front matter.
- [ ] Export a folder with subfolders to a single `.md`.
- [ ] Export a JSON backup, clear data, restore it, and verify notes/tags/attachments return.

## Privacy
- [ ] No accounts, telemetry, or update checks appear anywhere.
- [ ] Firewall monitor shows no outbound connections from LocalMind.
