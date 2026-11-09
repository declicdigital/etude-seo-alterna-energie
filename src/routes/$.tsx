import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { DigicomView } from '@/components/digicom-view';
import { resolvePath } from '@/lib/slugs';
import { getAccess } from '@/lib/access';
import { rememberEditorialDestination, clearEditorialDestination } from '@/lib/editorial-links';
import { digicomHead } from '@/lib/digicom-route';
export const Route = createFileRoute('/$')({
  ssr: false,
  validateSearch: z.object({ step: z.string().optional(), focus: z.string().optional() }),
  beforeLoad: async ({ params, location }) => {
    const destination = resolvePath(params._splat ?? '', new URLSearchParams(location.searchStr));
    if (!destination) throw notFound();
    rememberEditorialDestination(location.href);
    const access = await getAccess();
    if (!access.userId) throw redirect({ to: '/auth' });
    if (access.status !== 'approved') throw redirect({ to: '/en-attente' });
    clearEditorialDestination();
    return { access, destination };
  },
  head: ({ params }) => digicomHead((params._splat ?? 'Accueil').split('/').map(s => s.replace(/-/g, ' ')).join(' · ')),
  component: SlugPage,
});
function SlugPage() {
  const { access, destination } = Route.useRouteContext();
  return <DigicomView sheetParam={destination.sheet} access={access} targetHash={destination.hash} />;
}