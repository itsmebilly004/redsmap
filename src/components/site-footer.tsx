import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-glass-border py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-5 rotate-45 rounded-sm bg-primary" />
            <span className="font-semibold">ArkTrader Hub</span>
          </div>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Independent third-party platform built on top of the Deriv API. Not affiliated with
            Deriv.
          </p>
        </div>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Terms
          </Link>
          <Link to="/" className="hover:text-foreground">
            Privacy
          </Link>
          <a
            href="https://deriv.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            Deriv
          </a>
        </div>
      </div>
    </footer>
  );
}
