import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders trusted admin-authored markdown with Tailwind typography-ish styles. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-5 leading-relaxed text-foreground/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h1 className="mt-10 text-3xl font-bold tracking-tight" {...props} />
          ),
          h2: (props) => (
            <h2
              className="mt-10 border-b border-border pb-2 text-2xl font-bold tracking-tight"
              {...props}
            />
          ),
          h3: (props) => (
            <h3 className="mt-8 text-xl font-semibold" {...props} />
          ),
          p: (props) => <p className="text-pretty leading-7" {...props} />,
          ul: (props) => (
            <ul className="list-disc space-y-2 pl-6 marker:text-muted-foreground" {...props} />
          ),
          ol: (props) => (
            <ol className="list-decimal space-y-2 pl-6 marker:text-muted-foreground" {...props} />
          ),
          li: (props) => <li className="leading-7" {...props} />,
          a: (props) => (
            <a
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
              {...props}
            />
          ),
          strong: (props) => (
            <strong className="font-semibold text-foreground" {...props} />
          ),
          blockquote: (props) => (
            <blockquote
              className="border-l-4 border-primary/40 bg-muted/40 py-3 pl-4 pr-4 italic text-muted-foreground rounded-r-lg"
              {...props}
            />
          ),
          hr: (props) => (
            <hr className="my-8 border-t border-border" {...props} />
          ),
          table: (props) => (
            <div className="my-6 overflow-x-auto rounded-lg border border-border">
              <table
                className="w-full text-left text-sm border-collapse"
                {...props}
              />
            </div>
          ),
          thead: (props) => (
            <thead className="bg-muted/60 font-semibold" {...props} />
          ),
          tbody: (props) => (
            <tbody className="divide-y divide-border" {...props} />
          ),
          tr: (props) => (
            <tr className="transition-colors hover:bg-muted/30" {...props} />
          ),
          th: (props) => (
            <th className="px-4 py-3 font-semibold text-foreground" {...props} />
          ),
          td: (props) => (
            <td className="px-4 py-3 text-foreground/80" {...props} />
          ),
          code: (props) => (
            <code
              className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono"
              {...props}
            />
          ),
          pre: (props) => (
            <pre
              className="my-4 overflow-x-auto rounded-lg bg-muted p-4 text-sm"
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
