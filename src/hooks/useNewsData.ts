import { useQuery } from "@tanstack/react-query";
import { listNews } from "@/services/content.service";

export function useNewsData() {
  const query = useQuery({ queryKey: ["news"], queryFn: listNews, staleTime: 5 * 60_000 });
  return { ...query, news: query.data ?? [] };
}
