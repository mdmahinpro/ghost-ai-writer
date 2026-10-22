import { createFileRoute } from "@tanstack/react-router";
import { AuthorDetail } from "@/components/pages/authors";

export const Route = createFileRoute("/authors/$id")({
  component: function AuthorRoute() {
    const { id } = Route.useParams();
    return <AuthorDetail id={id} />;
  },
});
