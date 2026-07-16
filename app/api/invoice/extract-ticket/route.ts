// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse');

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return Response.json({ error: 'No file uploaded' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let text = '';

    if (file.type === 'application/pdf') {
      const parsed = await pdfParse(buffer);
      text = parsed.text;
    } else {
      return Response.json({ error: 'Please upload a PDF file' }, { status: 400 });
    }

    const data = parseTicketText(text);
    return Response.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}

function clean(s: string) {
  return s
    .replace(/\x00/g, '')        // remove null bytes (PDF fi-ligature artifact)
    .replace(/[\x01-\x08\x0b\x0e-\x1f]/g, '') // remove other control chars
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTicketText(text: string) {
  const t = clean(text);

  // ── PNR ──
  // All patterns capture first group; we always .slice(0,6) to trim any suffix noise.
  // A valid PNR must be 5-6 chars, ALL uppercase, and contain at least one digit.
  function extractPnr(src: string): string {
    const checks: Array<() => string> = [
      // 1. Explicit "PNR: XXXXXX" label — page 3 of Akasa ("PahwaPNR: D1DH2L", no word-boundary)
      () => src.match(/PNR\s*:\s*([A-Z0-9]{5,8})/)?.[1] ?? '',
      // 2. Akasa "Promo Code D1DH2LConrmed" — after null removal, [A-Z0-9]+ stops at lowercase
      () => (src.match(/Promo Code\s+([A-Z0-9]+)/)?.[1] ?? '').slice(0, 6),
      // 3. 6 uppercase chars right before "Con" (null-cleaned: "D1DH2LConrmed")
      () => src.match(/([A-Z0-9]{6})Con(?:rmed|firmed|\s*rmed)/)?.[1] ?? '',
      // 4. Booking Reference / Record Locator label
      () => src.match(/(?:Booking\s*Ref(?:erence)?|Record\s*Locator)\s*[:/]\s*([A-Z0-9]{5,8})/i)?.[1]?.slice(0, 6) ?? '',
    ];
    for (const fn of checks) {
      const c = fn().slice(0, 6);
      if (c.length >= 5 && /\d/.test(c) && /[A-Z]/.test(c)) return c;
    }
    return '';
  }
  const pnr = extractPnr(t);

  // ── Passenger name — last 2-word capitalized name before "Mobile:" ──
  const passengerName =
    t.match(/([A-Z][a-z]+ [A-Z][a-z]+)\s*Mobile:/)?.[1] ||
    t.match(/(?:Passenger|Traveller)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/)?.[1] ||
    t.match(/Travel Itinerary\s+([A-Z][a-z]+(?: [A-Z][a-z]+)+)PNR/)?.[1]?.trim() ||
    '';

  // ── Flight number ──
  const flightNo =
    t.match(/Flight(?:\s*No)?[.:\s]*([A-Z0-9]{2}\s?\d{3,4})/i)?.[1]?.replace(/\s/, '') ||
    t.match(/\b([A-Z]{2}\s?\d{3,4})\b/)?.[1]?.replace(/\s/, '') ||
    '';

  // ── Airline ──
  const airlineMap: Record<string, string> = {
    AI: 'Air India', QP: 'Akasa Air', '6E': 'IndiGo', SG: 'SpiceJet',
    UK: 'Vistara', G8: 'Go First', IX: 'Air Asia India',
  };
  const prefix = flightNo.slice(0, 2).toUpperCase();
  const airline = airlineMap[prefix] || '';

  // ── Sector / From / To ──
  const sectorMatch =
    t.match(/([A-Z]{3})\s*[-–→]\s*([A-Z]{3})/) ||
    t.match(/\(([A-Z]{3})\).*?\(([A-Z]{3})\)/);
  const fromCode = sectorMatch?.[1] || '';
  const toCode = sectorMatch?.[2] || '';
  const sector = fromCode && toCode ? `${fromCode}-${toCode}` : '';

  // ── City names ──
  const cityMatch = t.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*\((?:Terminal)?\s*\d?\)\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*\((?:Terminal)?\s*\d?\)/);
  const fromCity = cityMatch?.[1] || fromCode;
  const toCity = cityMatch?.[2] || toCode;

  // ── Travel date — prefer date associated with flight number ──
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  function parseMonthDate(d: string, m: string, y: string) {
    const mo = months[m.toLowerCase().slice(0, 3)];
    return mo ? `${y}-${mo}-${d.padStart(2, '0')}` : '';
  }
  let travelDate = '';
  // 1. Date right before flight number e.g. "06 May 2026QP 1810"
  const flightDateMatch = t.match(/(\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\s*[A-Z]{2}\s*\d{3,4}/i);
  if (flightDateMatch) {
    travelDate = parseMonthDate(flightDateMatch[1], flightDateMatch[2], flightDateMatch[3]);
  }
  // 2. Any "DD Mon YYYY" fallback
  if (!travelDate) {
    const dm = t.match(/(\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+(\d{4})/i);
    if (dm) travelDate = parseMonthDate(dm[1], dm[2], dm[3]);
  }
  // 3. DD/MM/YYYY fallback
  if (!travelDate) {
    const dm = t.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
    if (dm) travelDate = `${dm[3]}-${dm[2]}-${dm[1]}`;
  }

  // ── Times ──
  const times = [...t.matchAll(/\b(\d{2}:\d{2})\b/g)].map((m) => m[1]);
  const departureTime = times[0] || '';
  const arrivalTime = times[1] || '';

  // ── Fares ──
  const fareMatches = [...t.matchAll(/₹\s*([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, '')));
  const totalFare = fareMatches.length ? Math.max(...fareMatches) : 0;
  const baseFareMatch = t.match(/Adult\s*₹\s*([\d,]+)/i);
  const baseFare = baseFareMatch ? Number(baseFareMatch[1].replace(/,/g, '')) : (fareMatches[0] || 0);

  return {
    passengerName,
    pnr,
    flightNo,
    airline,
    sector,
    fromCity,
    fromCode,
    toCity,
    toCode,
    travelDate,
    departureTime,
    arrivalTime,
    baseFare,
    totalFare,
  };
}
