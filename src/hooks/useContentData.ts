import { useQuery } from "@tanstack/react-query";
import { listNews, listHighlights } from "@/services/content.service";
import { listSponsors } from "@/services/sponsors.service";

export function useContentData() {
  const query = useQuery({
    queryKey: ["content"],
    queryFn: async () => {
      const [news, highlights, sponsors] = await Promise.all([listNews(), listHighlights(), listSponsors()]);
      return { news, highlights, sponsors };
    },
    staleTime: 5 * 60_000,
  });
  return { ...query, news: query.data?.news ?? [], highlights: query.data?.highlights ?? [], sponsors: query.data?.sponsors ?? [] };
}
