import { buildKnowledgeBase } from "@/lib/knowledge-base";

/**
 * /llms.txt — the site's knowledge base as plain text.
 *
 * Serves two audiences from one document: a chatbot that needs to answer
 * questions about fidyah and this platform, and the AI crawlers that look
 * for llms.txt by convention.
 *
 * Revalidated hourly rather than on every request: the content changes only
 * when an admin edits the landing settings or publishes an article, and a
 * crawler hitting this repeatedly shouldn't mean a database round trip each
 * time.
 */
export const revalidate = 3600;

export async function GET() {
  const body = await buildKnowledgeBase();

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
