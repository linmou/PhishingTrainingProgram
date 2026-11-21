<!-- Intent: define student dashboard loading, retry and realtime ownership.
Updated: 2026-11-08. Baseline commit: a69b836. -->

# Student dashboard

`StudentView` loads active rooms and their active learner sessions for the current user. Room reads make at most two attempts, separated by two seconds. An initial load failure leaves an offline message; **Try Again** explicitly starts another load. Subscriptions begin three seconds after the first successful load.

Room and session realtime events refresh the list. Once subscriptions are established, refresh failures keep them connected so a later event can recover the list. A successful refresh clears the loading error. Join errors belong to the join operation and remain visible through background refreshes; another join or **Try Again** clears them.

User changes reset the list and loading state, cancel pending subscription setup and unsubscribe old channels. Unmount does the same cleanup. Request identities reject results from earlier users, an unmounted view or a slower overlapping refresh.

Focused verification: `src/pages/__tests__/StudentView.lifecycle.test.tsx`, plus the existing room-visibility and capacity suites. Browser acceptance uses the student dashboard against the explicitly selected project; check initial listing, join failure persistence and explicit recovery.
