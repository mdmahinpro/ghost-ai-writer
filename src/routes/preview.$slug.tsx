import { createFileRoute } from "@tanstack/react-router";
import { PreviewArticle } from "@/components/pages/preview";

export const Route = createFileRoute("/preview/$slug")({
  component: function PreviewRoute() {
    const { slug } = Route.useParams();
    return <PreviewArticle slug={slug} />;
  },
});
