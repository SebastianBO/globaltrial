import { NextRequest, NextResponse } from 'next/server';

// Company logo services in order of preference
const LOGO_SERVICES = [
  {
    name: 'Clearbit',
    getUrl: (domain: string) => `https://logo.clearbit.com/${domain}`,
    requiresDomain: true
  },
  {
    name: 'Logo.dev',
    getUrl: (domain: string) => `https://img.logo.dev/${domain}?token=free`,
    requiresDomain: true
  },
  {
    name: 'Brandfetch',
    getUrl: (company: string) => `https://icon.horse/icon/${encodeURIComponent(company.toLowerCase().replace(/\s+/g, ''))}`,
    requiresDomain: false
  },
  {
    name: 'DuckDuckGo',
    getUrl: (company: string) => `https://icons.duckduckgo.com/ip3/${encodeURIComponent(company.toLowerCase().replace(/\s+/g, ''))}.ico`,
    requiresDomain: false
  }
];

// Known pharma company domains
const PHARMA_DOMAINS: Record<string, string> = {
  'pfizer': 'pfizer.com',
  'johnson & johnson': 'jnj.com',
  'j&j': 'jnj.com',
  'merck': 'merck.com',
  'msd': 'msd.com',
  'roche': 'roche.com',
  'novartis': 'novartis.com',
  'sanofi': 'sanofi.com',
  'gsk': 'gsk.com',
  'glaxosmithkline': 'gsk.com',
  'astrazeneca': 'astrazeneca.com',
  'bristol myers squibb': 'bms.com',
  'bms': 'bms.com',
  'eli lilly': 'lilly.com',
  'lilly': 'lilly.com',
  'abbvie': 'abbvie.com',
  'amgen': 'amgen.com',
  'gilead': 'gilead.com',
  'biogen': 'biogen.com',
  'regeneron': 'regeneron.com',
  'moderna': 'modernatx.com',
  'biontech': 'biontech.de',
  'vertex': 'vrtx.com',
  'takeda': 'takeda.com',
  'bayer': 'bayer.com',
  'boehringer ingelheim': 'boehringer-ingelheim.com',
  'novo nordisk': 'novonordisk.com',
  'teva': 'tevapharm.com',
  'allergan': 'allergan.com',
  'mylan': 'mylan.com',
  'viatris': 'viatris.com',
  'alexion': 'alexion.com',
  'incyte': 'incyte.com',
  'jazz pharmaceuticals': 'jazzpharma.com',
  'horizon therapeutics': 'horizontherapeutics.com'
};

function extractDomain(company: string): string | null {
  const normalized = company.toLowerCase().trim();
  
  // Check known pharma domains first
  for (const [key, domain] of Object.entries(PHARMA_DOMAINS)) {
    if (normalized.includes(key)) {
      return domain;
    }
  }
  
  // Try to extract domain from company name
  // Remove common suffixes
  const cleanName = normalized
    .replace(/\b(inc|incorporated|corp|corporation|co|company|ltd|limited|llc|lp|plc|pharma|pharmaceuticals|pharmaceutical|therapeutics|sciences|bio|biotech|biotechnology|labs|laboratories|research|group|holdings|international|global)\b/gi, '')
    .trim()
    .replace(/[^a-z0-9]/g, '');
  
  if (cleanName) {
    return `${cleanName}.com`;
  }
  
  return null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const company = searchParams.get('company');
  
  if (!company) {
    return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
  }
  
  const domain = extractDomain(company);
  const logoUrls = [];
  
  // Generate logo URLs from all services
  for (const service of LOGO_SERVICES) {
    if (service.requiresDomain && !domain) {
      continue;
    }
    
    const param = service.requiresDomain ? domain : company;
    logoUrls.push({
      service: service.name,
      url: service.getUrl(param!)
    });
  }
  
  // Add a fallback SVG logo with company initials
  const initials = company
    .split(/\s+/)
    .map(word => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
    
  const fallbackSvg = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}"/>
      <text x="100" y="100" font-family="Arial, sans-serif" font-size="80" font-weight="bold" fill="white" text-anchor="middle" dy=".35em">${initials}</text>
    </svg>`
  )}`;
  
  return NextResponse.json({
    company,
    domain,
    logos: logoUrls,
    fallback: fallbackSvg,
    // Return the first available logo URL as primary
    primaryLogo: logoUrls[0]?.url || fallbackSvg
  });
}