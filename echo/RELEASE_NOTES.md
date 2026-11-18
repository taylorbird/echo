<!-- Notes for the release being cut; echo/release-electron.sh reads this. -->

echo 1.7 shows its updates, remembers widget permissions and reworks the phone layout.

- Updates: when a new version is out, a notice now sits in the window's bottom-right corner until you install it. Before, it was tucked inside the Alerts popover. Press Install, then Restart, or just quit echo and it installs.
- Settings → echo → Updates → "Update without asking" downloads new versions as soon as they're out and installs them when you quit.
- Settings → echo is now its own group in the Settings sidebar, between Behavior and About, marked with echo's penguin.
- Homebrew users need one last `brew upgrade --cask --greedy echo` to get 1.7.0; from then on echo's own update notice brings each new version.
- Widgets: when a widget asks for permissions, tick "Remember" and echo won't ask again for the ones you approved. Before, some widgets asked on every click. The widget panel's shield button forgets them.
- Phone layout (also used when the echo window is very narrow): the space drawer now matches the desktop rail, with the rooms outside spaces and the All chats, Rooms, Direct messages and Recent filters under the open place. "Spaces along the top" moved from Appearance to Settings → echo.
- A Mentions section tops the phone list, holding DMs with unread messages and rooms that mention you.
- The phone's top and bottom bars stand apart from the list under any theme, the picked view shows under the title, and the room header shows the room's picture.
