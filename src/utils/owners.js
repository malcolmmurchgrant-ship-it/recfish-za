// ─── owners.js ───────────────────────────────────────────────────────────────
// The platform owners' login accounts. These match the owner lists in the
// database rules (scripts 128, 131 and 133) — keep the two in step.
export const OWNER_IDS = [
  'b9c5048a-b229-46af-9042-44551b162d75',   // Malcolm (mpca99@telkomsa.net)
  '3b3c072a-8601-4368-9d30-03830ac9f72c',   // Malcolm (malcolmmurchgrant@gmail.com)
]
export const isOwner = (uid) => !!uid && OWNER_IDS.includes(uid)
