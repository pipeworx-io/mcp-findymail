interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Findymail MCP — B2B email finder & reverse-email lookup (findymail.com)
 *
 * Complements Hunter: person → work email (by name + company domain) and
 * reverse email → person/LinkedIn profile.
 *
 * Tools:
 * - findymail_find_email:    person name + company domain -> work email
 * - findymail_reverse_email: email address -> person/LinkedIn profile
 *
 * Auth: Findymail uses a Bearer token. Pass _apiKey = your Findymail API key.
 * BYO-key only — the user's own key bears Findymail's credit COGS.
 */


const BASE_URL = 'https://app.findymail.com';

const tools: McpToolExport['tools'] = [
  {
    name: 'findymail_find_email',
    description:
      'Find the work email for a person by name + company domain — give a person\'s full name and their company domain and get their verified business email (with job title and LinkedIn when available). B2B prospecting / outreach. Example: findymail_find_email({ name: "Patrick Collison", domain: "stripe.com", _apiKey: "your-findymail-key" })',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Full name of the person, e.g. "Patrick Collison"',
        },
        domain: {
          type: 'string',
          description: 'Company domain (no protocol), e.g. "stripe.com"',
        },
        _apiKey: {
          type: 'string',
          description: 'Your Findymail API key (get one at findymail.com)',
        },
      },
      required: ['name', 'domain', '_apiKey'],
    },
  },
  {
    name: 'findymail_reverse_email',
    description:
      'Look up the person/LinkedIn profile behind an email address — give an email and get the person\'s name, company, job title, and LinkedIn URL when available. Reverse-email enrichment. Example: findymail_reverse_email({ email: "patrick@stripe.com", _apiKey: "your-findymail-key" })',
    inputSchema: {
      type: 'object' as const,
      properties: {
        email: {
          type: 'string',
          description: 'Email address to look up, e.g. "patrick@stripe.com"',
        },
        _apiKey: {
          type: 'string',
          description: 'Your Findymail API key (get one at findymail.com)',
        },
      },
      required: ['email', '_apiKey'],
    },
  },
];

async function findymailPost(
  path: string,
  body: unknown,
  apiKey: string,
  tool: string,
): Promise<Record<string, unknown>> {
  if (!apiKey) {
    throw new Error(
      `${tool} requires a Findymail API key. Pass your Findymail key as _apiKey (get one at findymail.com). This is a paid, credit-based data source — bring your own key.`,
    );
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Findymail auth failed (HTTP ${res.status}). Check your Findymail _apiKey is valid and active (get/copy it at findymail.com), then retry.`,
    );
  }
  if (res.status === 402) {
    throw new Error('Findymail: out of credits. Top up your Findymail account at findymail.com and retry.');
  }
  if (!res.ok) throw new Error(`Findymail ${tool} error: HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

async function findEmail(args: Record<string, unknown>, apiKey: string) {
  const name = args.name as string;
  const domain = args.domain as string;
  if (!name) {
    throw new Error('findymail_find_email requires a `name` (the person\'s full name, e.g. "Patrick Collison").');
  }
  if (!domain) {
    throw new Error('findymail_find_email requires a `domain` (company domain, no protocol, e.g. "stripe.com").');
  }

  const data = await findymailPost('/api/search/name', { name, domain }, apiKey, 'findymail_find_email');
  // /api/search/name returns { contact: { email, name, domain, linkedin_url,
  // company, job_title, company_city/region/country, city/region/country, id } }.
  const contact = (data.contact ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' && v ? v : null);

  return {
    name: s(contact.name),
    email: s(contact.email),
    domain: s(contact.domain) ?? domain,
    company: s(contact.company),
    job_title: s(contact.job_title),
    linkedin_url: s(contact.linkedin_url),
    location: [contact.city, contact.region, contact.country].filter((x) => typeof x === 'string' && x).join(', ') || null,
  };
}

async function reverseEmail(args: Record<string, unknown>, apiKey: string) {
  const email = args.email as string;
  if (!email) {
    throw new Error('findymail_reverse_email requires an `email` address to look up.');
  }

  const data = await findymailPost(
    '/api/search/reverse-email',
    { email, with_profile: true },
    apiKey,
    'findymail_reverse_email',
  );
  // reverse-email returns the profile FLAT at top level (no `contact` wrapper),
  // camelCase: fullName, username, headline, jobTitle, companyName,
  // companyWebsite, companyLinkedinUrl, city/region/country, skills, jobs, ...
  const p = data as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' && v ? v : null);
  const username = s(p.username);

  return {
    email,
    name: s(p.fullName),
    headline: s(p.headline),
    job_title: s(p.jobTitle),
    company: s(p.companyName),
    company_website: s(p.companyWebsite),
    company_linkedin: s(p.companyLinkedinUrl),
    linkedin_url: username ? `https://www.linkedin.com/in/${username}` : null,
    location: [p.city, p.region, p.country].filter((x) => typeof x === 'string' && x).join(', ') || null,
    summary: s(p.summary),
    skills: Array.isArray(p.skills) ? (p.skills as unknown[]).filter((x) => typeof x === 'string') : null,
    raw: data,
  };
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = args._apiKey as string;
  delete args._apiKey;

  switch (name) {
    case 'findymail_find_email':
      return findEmail(args, apiKey);
    case 'findymail_reverse_email':
      return reverseEmail(args, apiKey);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// BYO-key only: nominal access meter; the user's own Findymail key bears the COGS.
export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
