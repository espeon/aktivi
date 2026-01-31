import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/event/$id")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/event/$id"!</div>;
}
