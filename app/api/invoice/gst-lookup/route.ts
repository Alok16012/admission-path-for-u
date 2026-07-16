const STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',      '02': 'Himachal Pradesh',
  '03': 'Punjab',               '04': 'Chandigarh',
  '05': 'Uttarakhand',          '06': 'Haryana',
  '07': 'Delhi',                '08': 'Rajasthan',
  '09': 'Uttar Pradesh',        '10': 'Bihar',
  '11': 'Sikkim',               '12': 'Arunachal Pradesh',
  '13': 'Nagaland',             '14': 'Manipur',
  '15': 'Mizoram',              '16': 'Tripura',
  '17': 'Meghalaya',            '18': 'Assam',
  '19': 'West Bengal',          '20': 'Jharkhand',
  '21': 'Odisha',               '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',       '24': 'Gujarat',
  '25': 'Daman & Diu',          '26': 'Dadra & Nagar Haveli',
  '27': 'Maharashtra',          '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',            '30': 'Goa',
  '31': 'Lakshadweep',          '32': 'Kerala',
  '33': 'Tamil Nadu',           '34': 'Puducherry',
  '35': 'Andaman & Nicobar',    '36': 'Telangana',
  '37': 'Andhra Pradesh',       '38': 'Ladakh',
  '97': 'Other Territory',      '99': 'Centre Jurisdiction',
};

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export async function GET(request: Request) {
  const gstin = new URL(request.url).searchParams.get('gstin')?.toUpperCase().trim() ?? '';

  if (!GSTIN_RE.test(gstin)) {
    return Response.json({ error: 'Invalid GSTIN' }, { status: 400 });
  }

  const stateCode = gstin.slice(0, 2);
  const stateName = STATE_CODES[stateCode] ?? '';

  let legalName = '';
  let tradeName = '';
  let address   = '';

  try {
    const res = await fetch(
      `https://api.gst.gov.in/commonmaster/public/searchTaxpayer?gstin=${gstin}`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (res.ok) {
      const json = await res.json();
      const info  = json?.taxpayerInfo ?? json;
      legalName   = info?.lgnm      ?? '';
      tradeName   = info?.tradeNam  ?? info?.tradeName ?? '';
      address     = info?.pradr?.adr ?? '';
    }
  } catch {
    // network error / timeout — fall through with local data
  }

  return Response.json({ gstin, stateCode, stateName, legalName, tradeName, address });
}
