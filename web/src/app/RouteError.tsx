// Shown instead of React Router's developer error page. A stale chunk after a deploy reloads the page once.

import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import { Card, CardTitle } from '../ui/controls';
import { isStaleChunk, reloadForNewBuild } from './staleBuild';

export default function RouteError() {
  const error = useRouteError();
  const stale = isStaleChunk(error);
  useEffect(() => {
    if (stale) reloadForNewBuild();
  }, [stale]);
  return (
    <main id="page" className="min-h-0 flex-1 overflow-auto px-4 pt-[0.4rem] pb-10 lg:px-7 lg:pt-2">
      <div className="mx-auto max-w-[40rem]">
        <Card>
          <CardTitle>{stale ? 'WeKnow was updated.' : 'Something went wrong on this page.'}</CardTitle>
          <p className="text-small text-ink-2">
            {stale ? 'Load the page again to get the new version.' : 'Load the page again, or go back to Ask.'}
          </p>
          <div className="mt-[0.9rem] flex flex-wrap gap-2">
            <button type="button" className="btn btn-yes" onClick={() => window.location.reload()}>
              Load again
            </button>
            <a className="btn" href="/">
              Back to Ask
            </a>
          </div>
        </Card>
      </div>
    </main>
  );
}
