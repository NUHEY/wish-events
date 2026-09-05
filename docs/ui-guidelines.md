# WISH Events UI guidelines

These guidelines describe the current interaction contract and checks for future changes. They are not authorization to change account access, visibility, or published content.

## Mobile navigation

- Primary destinations are Home, Events, Talks, and Tools. Keep the same names and routes on mobile and desktop.
- A highlighted navigation item remains a working link to its section root, including from detail pages. Use semantic links so unsaved-change protection and browser link actions work.
- Hide the bottom bar inside a talk room, where the composer uses the available height. Keep the existing room back control.
- Tools includes scheduling, RA questions, useful links, and WISH Knowledge. Related pages highlight Tools.
- Group the account menu into Profile, Dorm life & help, and Account & management. Constrain its height and width to the viewport; long menus must scroll.

## Events and filtering

- Show search, Category, Event status, and Date as separate groups. Each selected button has an accessible pressed state.
- Search and category combine with either a status or a date filter.
- Selecting a date, range, or month clears status. Selecting any status, including All, clears date/range/month. With a date selected, explain that status selection will clear it.
- Date forms use Japan calendar dates. Reject invalid calendar dates and reversed ranges. Do not send a reversed date range merely because a browser permits manual entry.
- Keep the clear-all action visible whenever filters are active. Loading failures are errors, not empty search results.
- Calendar dates have full date accessible names. The calendar trigger exposes its expanded state. Month navigation, mode controls, and form actions have at least 44px height; the seven-column date grid may use narrower cells at 360px.

## Tools information structure

- Group tools by purpose: Scheduling & RA bookings, Dorm life & advice, and Meet up with others.
- Preserve feature visibility and resident/RA destinations. Omit groups with no visible tools.
- Booking links to `#active-schedules` must always lead to a real section, even when there are no schedules. Explain how booking pages become available; distinguish loading failures from an empty list.

## Shared presentation and accessibility

- Reuse existing theme variables, typography, buttons, cards, and spacing. Provide Japanese and English labels for added UI.
- Prefer a single column for tool descriptions on mobile and the existing two-column event cards. Do not hide essential actions behind hover.
- Use at least 44px height for primary controls, 16px mobile date input text, visible focus styles, named icon controls, and native form labels.
- Confirmation dialogs contain keyboard focus, expose their title/message, close with Escape, and restore focus to their opener.
- At widths 360, 390, and 430px, check Japanese and English, open menus, date/range/month modes, long text, empty states, and the bottom safe area. The page itself must not scroll horizontally.
- Verify that canceled navigation leaves the current form editable and does not leave a loading overlay. Verify that a successful action is not repeated because its feedback failed.
