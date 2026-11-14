export type MapTravelMode = "walk" | "motorcycle" | "car" | "bus" | "airplane";

export type MapVoiceCommand = {
  intent: "open" | "search" | "directions" | "controls" | "close" | "current_location" | "travel_mode" | "unknown";
  place?: string;
  mode?: MapTravelMode;
};

const PLACE_ALIASES: Array<[RegExp, string]> = [
  [/^(?:b\s*\.?g\s*\.?c\s*\.?|bonifacio global(?: city)?)$/i, "Bonifacio Global City, Taguig, Metro Manila, Philippines"],
  [/^(?:makati|makati city)$/i, "Makati, Metro Manila, Philippines"],
  [/^(?:quezon city|q\s*\.?c\s*\.?|qc)$/i, "Quezon City, Metro Manila, Philippines"],
  [/^(?:manila|city of manila)$/i, "Manila, Metro Manila, Philippines"],
  [/^(?:taguig|taguig city)$/i, "Taguig, Metro Manila, Philippines"],
  [/^(?:pasig|pasig city)$/i, "Pasig, Metro Manila, Philippines"],
  [/^(?:muntinlupa|alabang)$/i, "Alabang, Muntinlupa, Metro Manila, Philippines"],
  [/^(?:ortigas|ortigas center)$/i, "Ortigas Center, Pasig, Metro Manila, Philippines"],
  [/^(?:bgc taguig|taguig bgc)$/i, "Bonifacio Global City, Taguig, Metro Manila, Philippines"],
  [/^(?:tokyo|tokyo japan)$/i, "Tokyo, Japan"],
  [/^(?:osaka|osaka japan)$/i, "Osaka, Japan"],
];

function cleanTranscript(raw: string) {
  return raw
    .replace(/[“”]/g, '"')
    .replace(/^\s*(?:(?:hey|hi|okay|ok)\s+)?jverse(?:\s+ai)?[\s,.:!\-]*/i, "")
    .replace(/^\s*(?:please|can you|could you|would you|i want to|i need to|gusto ko|paki|pakisuyo)\s+/i, "")
    .replace(/\s+/g, " ")
    .replace(/[?.!,]+$/g, "")
    .trim();
}

export function normalizeSpokenPlace(raw: string) {
  const place = cleanTranscript(raw)
    .replace(/^\s*(?:the\s+)?(?:place|location|area|city|map)\s+(?:of|for|to|at|in)\s+/i, "")
    .replace(/^\s*(?:sa|ng|nasa|dito sa)\s+/i, "")
    .replace(/\s+(?:please|thanks|thank you|salamat)$/i, "")
    .trim();

  for (const [pattern, canonical] of PLACE_ALIASES) {
    if (pattern.test(place)) return canonical;
  }
  return place;
}

function extractPlace(command: string) {
  const place = command
    .replace(/^\s*(?:open|show(?:\s+me)?|find|search(?:\s+for)?|locate|pin|focus\s+on|where\s+is|navigate(?:\s+me)?|take\s+me|go\s+to|bring\s+me|route|directions?)\s*/i, "")
    .replace(/^\s*(?:to|at|in|for|from|papunta\s+sa|pumunta\s+sa|hanapin\s+(?:ang\s+)?|ipakita\s+(?:ang\s+)?|nasaan\s+(?:ang\s+)?)\s*/i, "")
    .replace(/^\s*(?:the\s+)?map\s*(?:of|to|for|at|in)?\s*/i, "")
    .replace(/\s+(?:on\s+the\s+)?map$/i, "")
    .replace(/\s+(?:by|using|via|on)\s+(?:foot|walking|walk|motor(?:cycle|bike| bike)|car|driving|bus|airplane|plane|flight)$/i, "")
    .trim();
  return normalizeSpokenPlace(place);
}

export function parseMapVoiceCommand(raw: string): MapVoiceCommand {
  const command = cleanTranscript(raw);
  if (!command) return { intent: "unknown" };

  if (/\b(?:close|hide|exit|dismiss|isara|itago)\b.*\b(?:map|navigation|globe)\b/i.test(command)) return { intent: "close" };
  if (/\b(?:open|show|reveal|buksan|ipakita)\b.*\b(?:controls?|buttons?|options?|settings?)\b/i.test(command)) return { intent: "controls" };
  if (/\b(?:use|find|locate|show)\b.*\b(?:my|current|present)\s+location\b|\b(?:nasaan ako|gamitin ang lokasyon ko)\b/i.test(command)) return { intent: "current_location" };

  const mode: MapTravelMode | undefined = /\b(?:motorcycle|motorbike|motor bike|motor)\b/i.test(command) ? "motorcycle"
    : /\b(?:walk|walking|foot|lakad)\b/i.test(command) ? "walk"
      : /\b(?:car|drive|driving|kotse)\b/i.test(command) ? "car"
        : /\b(?:bus|commute)\b/i.test(command) ? "bus"
          : /\b(?:airplane|aeroplane|plane|flight|eroplano)\b/i.test(command) ? "airplane"
            : undefined;

  const asksDirections = /\b(?:directions?|route|navigate|navigation|papunta|direksyon)\b/i.test(command);
  const asksPlace = /\b(?:show(?:\s+me)?|find|search|locate|pin|focus|where\s+is|open|map|go\s+to|take\s+me|bring\s+me|hanapin|ipakita|nasaan|pumunta)\b/i.test(command);
  const onlyDirections = /^(?:(?:get|show|give)\s+)?(?:the\s+)?(?:directions?|route)(?:\s+from\s+there)?$/i.test(command)
    || /^(?:direksyon|ruta)(?:\s+mula\s+doon)?$/i.test(command);

  if (onlyDirections) return { intent: "directions", mode };
  if (asksDirections || asksPlace) {
    const place = extractPlace(command);
    if (!place || /^(?:the\s+)?(?:ai\s+)?(?:global\s+)?map$/i.test(place)) return { intent: mode ? "travel_mode" : "open", mode };
    return { intent: asksDirections ? "directions" : "search", place, mode };
  }
  if (mode) return { intent: "travel_mode", mode };
  return { intent: "unknown" };
}
