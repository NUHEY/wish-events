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
- Prefer a single column for tool descriptions on mobile and two-column event cards with date/time allowed to wrap. Do not hide essential actions behind hover.
- Use at least 44px height for primary controls, 16px mobile date input text, visible focus styles, named icon controls, and native form labels.
- Confirmation dialogs contain keyboard focus, expose their title/message, close with Escape, and restore focus to their opener.
- At widths 320, 360, 390, and 430px, check Japanese and English, open menus, date/range/month modes, long text, empty states, and the bottom safe area. The page itself must not scroll horizontally.
- Verify that canceled navigation leaves the current form editable and does not leave a loading overlay. Verify that a successful action is not repeated because its feedback failed.

## Rounded corners and text

- Standard buttons and text/select fields use `rounded-md` (10px). Keep selects aligned with the adjacent input style.
- Preserve the size hierarchy: nested blocks use `rounded-lg`, menus and compact cards use `rounded-xl`, and large feature panels use `rounded-2xl`. Small icons inside a panel have a smaller radius than their container. Avatars and status pills remain circular.
- Keep short control labels and status badges on one line. Wrap groups of chips as whole items. A BETA badge may move to the next line without splitting the tab label.
- Let descriptive headings and tool cards grow for longer Japanese or English text; do not force a fixed height that clips their content. Multi-line card headings need readable line spacing.

## Mobile review baseline (September 2026)

- Use 320, 360, 390, and 430 CSS px as the review widths. No page-level horizontal scroll; long descriptions, names, dates and schedule titles must remain readable. Event titles may use the configured line limit because the full title is available on the detail page.
- Shared primary buttons, small buttons, inputs, notification controls and navigation targets are at least 44px high on mobile. This is the project usability standard; desktop compact controls may be smaller. Icon-only targets need an accessible name and visible focus.
- Reserve 16px page gutters and use 16px inner panel padding on mobile, growing to 20px on larger screens. Adjacent controls share the existing 10px radius; nested panels use 14px and main cards use 20–26px.
- Put common choices before advanced adjustments. Settings explain whether a choice saves immediately or requires the save button. Group feature visibility by purpose; keep each choice a compact row on mobile and expose the selected state with `aria-pressed`.
- Use user-facing terms such as “カード内の余白” instead of “セルの密度”. Include the unit in numeric field labels and explain milliseconds where needed.
- Distinguish visibility settings (what residents see) from institutional permissions (what staff can do). Neither a hidden link nor a hidden control replaces server authorization.
