import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders trusted admin-authored markdown with Tailwind typography-ish styles. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-4 leading-relaxed text-foreground/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h1 className="mt-8 text-3xl font-bold tracking-tight" {...props} />
          ),
          h2: (props) => (
            <h2 className="mt-8 text-2xl font-bold tracking-tight" {...props} />
          ),
          h3: (props) => (
            <h3 className="mt-6 text-xl font-semibold" {...props} />
          ),
          p: (props) => <p className="text-pretty" {...props} />,
          ul: (props) => (
            <ul className="list-disc space-y-1 pl-6" {...props} />
          ),
          ol: (props) => (
            <ol className="list-decimal space-y-1 pl-6" {...props} />
          ),
          a: (props) => (
            <a className="text-primary underline underline-offset-4" {...props} />
          ),
          blockquote: (props) => (
            <blockquote
              className="border-l-4 border-primary/40 pl-4 italic text-muted-foreground"
              {...props}
            />
          ),
          code: (props) => (
            <code
              className="rounded bg-muted px-1.5 py-0.5 text-sm"
              {...props}
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
