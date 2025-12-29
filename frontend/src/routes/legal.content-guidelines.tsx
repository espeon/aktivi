import { createFileRoute } from "@tanstack/react-router";
import Markdown from "react-markdown";
import content from "../doc/content-guidelines.md?raw";

export const Route = createFileRoute("/legal/content-guidelines")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="py-8 space-y-2">
        <h1 className="text-4xl font-semibold">Privacy Policy</h1>
        <p>Last updated Dec 29, 2025</p>
      </div>
      <article className="prose prose-invert lg:prose-lg dark:prose-invert prose-headings:font-bold prose-a:text-primary hover:prose-a:underline text-wrap">
        <Markdown>{content}</Markdown>
      </article>
    </div>
  );
}
