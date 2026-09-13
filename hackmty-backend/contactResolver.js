"use strict";

function normalizeContactText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-MX");
}

function normalizeClabe(value) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function canonicalContact(record) {
  const registeredName =
    record.name ||
    record.alias ||
    record.nickname ||
    record.display_name ||
    record.fullName ||
    record.full_name ||
    "";
  const clabe = normalizeClabe(
    record.clabe || record.accountNumber || record.account_number || "",
  );
  return {
    id: String(record.id || record.contact_id || record._id || ""),
    name: registeredName,
    alias: registeredName,
    nickname: registeredName,
    firstName: registeredName.split(/\s+/)[0] || registeredName,
    fullName: registeredName,
    clabe,
    accountNumber: clabe,
    accountId: String(record.accountId || record.account_id || ""),
    bank: record.bank || "Banorte",
    userId: record.userId || record.user_id || record.contact_user_id || null,
  };
}

function editDistance(leftValue, rightValue) {
  const left = normalizeContactText(leftValue);
  const right = normalizeContactText(rightValue);
  if (!left) return right.length;
  if (!right) return left.length;
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const previous = row[rightIndex];
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        diagonal + cost,
      );
      diagonal = previous;
    }
  }
  return row[right.length];
}

function scoreContact(query, contact) {
  const target = normalizeContactText(query);
  const targetClabe = normalizeClabe(query);
  if (!target && !targetClabe) return null;
  const fields = [
    ["clabe", contact.clabe, 150],
    ["name", contact.name, 140],
    ["alias", contact.alias, 130],
    ["nickname", contact.nickname, 125],
    ["fullName", contact.fullName, 120],
    ["firstName", contact.firstName, 115],
  ];
  let best = null;
  for (const [matchedBy, value, exactScore] of fields) {
    if (matchedBy === "clabe") {
      const term = normalizeClabe(value);
      if (term && targetClabe && term === targetClabe) {
        best = { matchedBy, score: exactScore };
      }
      continue;
    }
    const term = normalizeContactText(value);
    if (!term) continue;
    let score = null;
    if (target === term) {
      score = exactScore;
    } else if (
      target.length >= 3 &&
      (term.startsWith(target) ||
        term.split(" ").some((token) => token === target))
    ) {
      score = exactScore - 25;
    } else {
      const distance = editDistance(target, term);
      const tolerance = Math.max(1, Math.floor(Math.min(target.length, term.length) * 0.2));
      if (target.length >= 3 && distance <= tolerance) {
        score = 80 - distance;
      }
    }
    if (score !== null && (!best || score > best.score)) {
      best = { matchedBy, score };
    }
  }
  return best;
}

function resolveContact(query, records) {
  const matches = records
    .map((record) => {
      const contact = canonicalContact(record);
      const match = scoreContact(query, contact);
      return match ? { record, contact, ...match } : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score);

  if (!matches.length) return null;
  if (
    matches.length > 1 &&
    matches[0].score === matches[1].score &&
    matches[0].contact.id !== matches[1].contact.id
  ) {
    return null;
  }
  return matches[0];
}

module.exports = {
  canonicalContact,
  editDistance,
  normalizeClabe,
  normalizeContactText,
  resolveContact,
  scoreContact,
};
