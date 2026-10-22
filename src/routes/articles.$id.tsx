import { createFileRoute } from "@tanstack/react-router";
import { ArticleDetail } from "@/components/pages/articles";

export const Route = createFileRoute("/articles/$id")({
  component: function ArticleRoute() {
    const { id } = Route.useParams();
    return <ArticleDetail id={id} />;
  },
});
