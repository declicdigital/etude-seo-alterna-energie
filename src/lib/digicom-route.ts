export function digicomHead(label: string) {
  const title = `${label} — Digicom`;
  const description = `${label} : suivi de la communication digitale dans Digicom.`;
  return { meta: [
    { title }, { name: 'description', content: description },
    { property: 'og:title', content: title }, { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] };
}