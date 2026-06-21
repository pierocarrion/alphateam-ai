const KNOWN: Record<string, string> = {
  Maya: "maya",
  Daniel: "daniel",
  Sofía: "sofia",
  Sofia: "sofia",
  Theo: "theo",
  Priya: "priya",
  Juan: "juan",
};

export function personIdFromName(name: string): string {
  const trimmed = name.trim();
  if (KNOWN[trimmed]) return KNOWN[trimmed];
  return trimmed.toLowerCase().replace(/\s+/g, "-");
}
